import { env } from "cloudflare:workers";
import { z } from "zod";
import { callConfig } from "./call-token";
import { allEmojis } from "./emojis";
import { musicCommand, musicPlayback, musicSnapshot } from "./music-server";
import { themeIds } from "./themes";
import {
  IMAGE_MIMES,
  imageSignatureMatches,
  MAX_IMAGE_BYTES,
} from "./upload-limits";
import {
  identitySchema,
  messageSchema,
  roomSchema,
  slugSchema,
} from "./validation";

import {
  access,
  admin,
  hash,
  passwordHash,
  rate,
  safeRoom,
  session,
} from "./server-auth";
import { all, db, fail, first, json, run } from "./server-utils";

export async function handle(req: Request) {
  const requestReceivedAt = Date.now();
  try {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/api\//, "").split("/");
    const method = req.method;
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin)
        fail("Cross-origin request rejected.", 403);
      await rate("ip:" + (req.headers.get("cf-connecting-ip") || "local"), 240);
    }
    let user = await session(req);
    if (parts[0] === "session") {
      if (method === "GET") return json({ user });
      if (method === "DELETE") {
        if (user)
          await run("UPDATE sessions SET expires=0 WHERE id=?", user.id);
        return json({ ok: true }, 200, {
          "Set-Cookie":
            "dropby_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        });
      }
      if (method !== "POST") fail("Method not allowed.", 405);
      const identity = identitySchema.parse(await req.json());
      if (user) {
        await run(
          "UPDATE sessions SET name=?,avatar=?,color=? WHERE id=?",
          identity.name,
          identity.avatar,
          identity.color,
          user.id,
        );
        return json({ user: { ...user, ...identity } });
      }
      await rate(
        "sessions:" + (req.headers.get("cf-connecting-ip") || "local"),
        30,
        3600000,
      );
      const token = crypto.randomUUID() + crypto.randomUUID();
      const id = crypto.randomUUID();
      const expires = Date.now() + 30 * 86400000;
      await run(
        "INSERT INTO sessions (id,tokenHash,name,avatar,color,expires,accountId) VALUES (?,?,?,?,?,?,?)",
        id,
        await hash(token),
        identity.name,
        identity.avatar,
        identity.color,
        expires,
        req.headers.get("oai-authenticated-user-id"),
      );
      return json(
        {
          user: {
            id,
            ...identity,
            expires,
            signedIn: !!req.headers.get("oai-authenticated-user-id"),
          },
        },
        200,
        {
          "Set-Cookie": `dropby_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${url.protocol === "https:" ? "; Secure" : ""}`,
        },
      );
    }
    if (!user) fail("Choose an identity to continue.", 401);
    user = user!;
    if (parts[0] === "rooms" && parts.length === 1 && method === "POST") {
      await rate("create:" + user.id, 12, 3600000);
      const data = roomSchema.parse(await req.json());
      const id = crypto.randomUUID();
      const pw =
        data.visibility === "private"
          ? await passwordHash(data.password)
          : null;
      try {
        await db().batch([
          db()
            .prepare(
              "INSERT INTO rooms (id,slug,description,visibility,passwordHash,owner,theme,locked,created,logo) VALUES (?,?,?,?,?,?,?,0,?,?)",
            )
            .bind(
              id,
              data.slug,
              data.description,
              data.visibility,
              pw,
              user.id,
              "alpine",
              Date.now(),
              data.logo,
            ),
          db()
            .prepare(
              "INSERT INTO memberships (roomId,sessionId,role,lastSeen) VALUES (?,?,?,?)",
            )
            .bind(id, user.id, "owner", Date.now()),
        ]);
      } catch (e) {
        if (String(e).includes("UNIQUE"))
          fail("That room name is already in use.", 409);
        throw e;
      }
      return json(
        {
          room: safeRoom((await first("SELECT * FROM rooms WHERE id=?", id))!),
        },
        201,
      );
    }
    if (parts[0] === "media" && method === "GET") {
      const a = await first("SELECT * FROM attachments WHERE id=?", parts[1]);
      if (!a) fail("File unavailable.", 404);
      const r = await first("SELECT slug FROM rooms WHERE id=?", a!.roomId);
      if (!r) fail("File unavailable.", 404);
      await access(r!.slug, user);
      if (
        !(await first(
          "SELECT id FROM messages WHERE attachmentId=? AND deleted=0 UNION ALL SELECT id FROM music_tracks WHERE attachmentId=? LIMIT 1",
          a!.id,
          a!.id,
        ))
      )
        fail("File unavailable.", 404);
      const range = req.headers.get("range");
      let start = 0,
        end = a!.size - 1;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${a!.size}` },
          });
        if (!match[1]) start = Math.max(0, a!.size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          start > end ||
          start >= a!.size
        )
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${a!.size}` },
          });
      }
      const object = await env.BUCKET?.get(
        a!.id,
        range
          ? { range: { offset: start, length: end - start + 1 } }
          : undefined,
      );
      if (!object) fail("File unavailable.", 404);
      return new Response(object!.body, {
        status: range ? 206 : 200,
        headers: {
          "Content-Type": a!.mime,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
          ...(range
            ? { "Content-Range": `bytes ${start}-${end}/${a!.size}` }
            : {}),
          "Content-Disposition": `${a!.mime === "application/pdf" || a!.mime === "text/plain" ? "attachment" : "inline"}; filename="${a!.name.replace(/[^\w. -]/g, "_")}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    if (parts[0] !== "rooms" || !parts[1]) fail("Not found.", 404);
    const slug = slugSchema.parse(parts[1]);
    const action = parts[2];
    if (action === "join" && method === "POST") {
      await rate("join:" + user.id, 15);
      const body = z
        .object({ password: z.string().max(128).default("") })
        .parse(await req.json());
      const r = await first("SELECT * FROM rooms WHERE slug=?", slug);
      const old =
        r &&
        (await first(
          "SELECT * FROM memberships WHERE roomId=? AND sessionId=?",
          r.id,
          user.id,
        ));
      if (old?.banned) fail("This room is unavailable.", 403);
      if (!r) fail("Room not found. You can create it instead.", 404);
      if (
        !old &&
        r!.visibility === "private" &&
        (!r!.passwordHash ||
          (await passwordHash(body.password, r!.passwordHash.split(":")[0])) !==
            r!.passwordHash)
      )
        fail("This room is unavailable or the password is incorrect.", 403);
      if (r!.locked && !old)
        fail("This room is not accepting new members.", 403);
      await run(
        "INSERT INTO memberships (roomId,sessionId,role,lastSeen) VALUES (?,?,?,?) ON CONFLICT(roomId,sessionId) DO UPDATE SET lastSeen=excluded.lastSeen",
        r!.id,
        user.id,
        "member",
        Date.now(),
      );
      return json({ room: safeRoom(r!) });
    }
    const { room, member } = await access(slug, user);
    if (action === "music" && parts.length === 3) {
      const musicJson = (value: Record<string, any>) =>
        json({ ...value, serverReceivedAt: requestReceivedAt });
      if (method === "GET") {
        if (url.searchParams.get("playback") === "1")
          return musicJson(
            await musicPlayback(
              room.id,
              user.id,
              Number(url.searchParams.get("revision")),
            ),
          );
        await run(
          "UPDATE memberships SET lastSeen=? WHERE roomId=? AND sessionId=? AND EXISTS(SELECT 1 FROM music_choices c JOIN music_states s ON s.roomId=c.roomId AND s.trackId=c.trackId WHERE c.roomId=? AND c.sessionId=? AND c.response='accepted' AND s.playing=1)",
          Date.now(),
          room.id,
          user.id,
          room.id,
          user.id,
        );
        return musicJson(await musicSnapshot(room.id, user.id));
      }
      if (method !== "POST") fail("Method not allowed.", 405);
      await rate("music:" + user.id, 90);
      return musicJson(await musicCommand(req, room, user, member));
    }
    if (action === "logo") {
      if (method === "GET") {
        if (!room.logoImageId) fail("Room image unavailable.", 404);
        const object = await env.BUCKET?.get(room.logoImageId);
        if (!object) fail("Room image unavailable.", 404);
        return new Response(object!.body, {
          headers: {
            "Content-Type": object!.httpMetadata?.contentType || "image/jpeg",
            "Content-Length": String(object!.size),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (method !== "POST") fail("Method not allowed.", 405);
      if (member.role !== "owner")
        fail("Only the room owner can change the room image.", 403);
      await rate("logo:" + user.id, 12);
      if (
        Number(req.headers.get("content-length") || 0) >
        MAX_IMAGE_BYTES + 65536
      )
        fail("Room images can be up to 7 MB.", 413);
      const form = await req.formData(),
        file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES)
        fail("Choose a room image up to 7 MB.", 413);
      const f = file as File;
      if (!IMAGE_MIMES.includes(f.type))
        fail("Choose a JPG, PNG or WebP room image.");
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!imageSignatureMatches(bytes, f.type))
        fail("The room image contents do not match its format.");
      if (!env.BUCKET) fail("Image storage is unavailable.", 503);
      const id = "room-logo-" + crypto.randomUUID();
      await env.BUCKET!.put(id, bytes, {
        httpMetadata: { contentType: f.type },
      });
      try {
        await run("UPDATE rooms SET logoImageId=? WHERE id=?", id, room.id);
      } catch (e) {
        await env.BUCKET!.delete(id);
        throw e;
      }
      if (room.logoImageId) await env.BUCKET!.delete(room.logoImageId);
      return json({ ok: true, logoImageId: id }, 201);
    }
    const now = Date.now();
    if (method === "GET" && !action) {
      await run(
        "UPDATE memberships SET lastSeen=? WHERE roomId=? AND sessionId=?",
        now,
        room.id,
        user.id,
      );
      const before =
        Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;
      const historyFrom = url.searchParams.get("historyFrom");
      const knownVersion = url.searchParams.get("deletedVersion");
      if (
        knownVersion !== null &&
        (!Number.isSafeInteger(Number(knownVersion)) ||
          Number(knownVersion) < 0)
      )
        fail("Invalid deletion version.");
      const deletedVersion = Number(
        (await first(
          "SELECT COUNT(*) AS total FROM messages WHERE roomId=? AND deleted=1",
          room.id,
        ))!.total,
      );
      if (
        historyFrom !== null &&
        (!Number.isSafeInteger(Number(historyFrom)) || Number(historyFrom) < 0)
      )
        fail("Invalid history boundary.");
      const [messages, members, reactions, signals, deletedHistory] =
        await Promise.all([
          all(
            "SELECT m.*,s.name,s.avatar,s.color,a.name AS fileName,a.mime AS fileMime,a.size AS fileSize FROM messages m JOIN sessions s ON s.id=m.senderId LEFT JOIN attachments a ON a.id=m.attachmentId WHERE m.roomId=? AND m.deleted=0 AND m.created<? ORDER BY m.created DESC,m.id DESC LIMIT 100",
            room.id,
            before,
          ),
          all(
            "SELECT s.id,s.name,s.avatar,s.color,m.role,m.lastSeen,m.typingUntil,m.inCall,m.muted,m.banned FROM memberships m JOIN sessions s ON s.id=m.sessionId WHERE m.roomId=? AND m.banned=0",
            room.id,
          ),
          all(
            "SELECT r.messageId,r.sessionId,r.emoji,s.name FROM reactions r JOIN messages m ON m.id=r.messageId JOIN sessions s ON s.id=r.sessionId WHERE m.roomId=? AND m.deleted=0",
            room.id,
          ),
          all(
            "SELECT * FROM signals WHERE roomId=? AND recipientId=? AND created>? ORDER BY created ASC LIMIT 100",
            room.id,
            user.id,
            now - 60000,
          ),
          historyFrom === null || knownVersion === String(deletedVersion)
            ? Promise.resolve([])
            : all(
                "SELECT id FROM messages WHERE roomId=? AND deleted=1 AND created>=? ORDER BY created DESC LIMIT 1001",
                room.id,
                Number(historyFrom),
              ),
        ]);
      return json({
        room: safeRoom(room),
        role: member.role,
        messages: messages.reverse(),
        members: members.map((m) => ({
          ...m,
          online: m.lastSeen > now - 35000,
        })),
        reactions,
        signals,
        hasMore: messages.length === 100,
        deletedMessageIds: deletedHistory.slice(0, 1000).map((m) => m.id),
        historyReset: deletedHistory.length > 1000,
        deletedVersion,
      });
    }
    if (action === "leave" && method === "POST") {
      await run(
        "UPDATE memberships SET lastSeen=0,inCall=0,typingUntil=0 WHERE roomId=? AND sessionId=?",
        room.id,
        user.id,
      );
      return json({ ok: true });
    }
    if (action === "typing" && method === "POST") {
      await run(
        "UPDATE memberships SET typingUntil=? WHERE roomId=? AND sessionId=?",
        now + 4000,
        room.id,
        user.id,
      );
      return json({ ok: true });
    }
    if (action === "settings" && method === "PATCH") {
      if (member.role !== "owner")
        fail("Only the room owner can change settings.", 403);
      const b = z
        .object({
          description: z.string().max(240),
          theme: z.enum(themeIds),
          locked: z.boolean(),
          logo: z.string().min(1).max(12).optional(),
          clearLogoImage: z.boolean().default(false),
        })
        .parse(await req.json());
      await run(
        "UPDATE rooms SET description=?,theme=?,locked=?,logo=?,logoImageId=? WHERE id=?",
        b.description,
        b.theme,
        b.locked ? 1 : 0,
        b.logo || room.logo,
        b.clearLogoImage ? null : room.logoImageId,
        room.id,
      );
      if (b.clearLogoImage && room.logoImageId)
        await env.BUCKET?.delete(room.logoImageId);
      return json({ ok: true });
    }
    if (action === "members" && method === "PATCH") {
      if (!admin(member)) fail("Moderator permission required.", 403);
      const b = z
        .object({
          id: z.string().uuid(),
          action: z.enum(["ban", "mute", "unmute", "moderator", "member"]),
        })
        .parse(await req.json());
      const target = await first(
        "SELECT * FROM memberships WHERE roomId=? AND sessionId=?",
        room.id,
        b.id,
      );
      if (
        !target ||
        target.role === "owner" ||
        b.id === user.id ||
        (member.role !== "owner" &&
          (target.role === "moderator" ||
            ["moderator", "member"].includes(b.action)))
      )
        fail("You cannot change this member.", 403);
      if (b.action === "ban")
        await run(
          "UPDATE memberships SET banned=1,inCall=0 WHERE roomId=? AND sessionId=?",
          room.id,
          b.id,
        );
      else if (b.action === "mute" || b.action === "unmute")
        await run(
          "UPDATE memberships SET muted=? WHERE roomId=? AND sessionId=?",
          b.action === "mute" ? 1 : 0,
          room.id,
          b.id,
        );
      else
        await run(
          "UPDATE memberships SET role=? WHERE roomId=? AND sessionId=?",
          b.action,
          room.id,
          b.id,
        );
      return json({ ok: true });
    }
    if (action === "upload" && method === "POST") {
      if (member.muted) fail("Messaging is restricted for this identity.", 403);
      await rate("upload:" + user.id, 20);
      if (Number(req.headers.get("content-length") || 0) > 16 * 1024 * 1024)
        fail("Files must be under 15 MB.", 413);
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024)
        fail("Choose a file under 15 MB.", 413);
      const f = file as File;
      const mime = f.type.split(";")[0];
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "audio/webm",
          "audio/ogg",
          "audio/mp4",
          "audio/mpeg",
          "application/pdf",
          "text/plain",
        ].includes(mime)
      )
        fail("This file format is not supported.");
      const bytes = new Uint8Array(await f.arrayBuffer());
      const head = Array.from(bytes.slice(0, 12));
      const ascii = new TextDecoder().decode(bytes.slice(0, 12));
      const valid =
        mime === "image/png"
          ? head.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
          : mime === "image/jpeg"
            ? head[0] === 255 && head[1] === 216 && head[2] === 255
            : mime === "image/gif"
              ? ascii.startsWith("GIF8")
              : mime === "image/webp"
                ? ascii.startsWith("RIFF") && ascii.slice(8) === "WEBP"
                : mime.endsWith("/webm")
                  ? head.slice(0, 4).join(",") === "26,69,223,163"
                  : mime === "application/pdf"
                    ? ascii.startsWith("%PDF-")
                    : mime === "audio/ogg"
                      ? ascii.startsWith("OggS")
                      : mime.endsWith("/mp4")
                        ? ascii.slice(4, 8) === "ftyp"
                        : mime === "text/plain"
                          ? !bytes.includes(0)
                          : mime === "audio/mpeg"
                            ? ascii.startsWith("ID3") ||
                              (head[0] === 255 && (head[1] & 224) === 224)
                            : false;
      if (!valid) fail("The file contents do not match its format.");
      if (!env.BUCKET) fail("Media storage is unavailable.", 503);
      const id = crypto.randomUUID();
      await env.BUCKET!.put(id, bytes, { httpMetadata: { contentType: mime } });
      await run(
        "INSERT INTO attachments (id,roomId,senderId,name,mime,size,created) VALUES (?,?,?,?,?,?,?)",
        id,
        room.id,
        user.id,
        f.name.slice(0, 180),
        mime,
        f.size,
        now,
      );
      return json(
        { attachment: { id, name: f.name, mime, size: f.size } },
        201,
      );
    }
    if (action === "messages" && parts.length === 3 && method === "DELETE") {
      await rate("clear-messages:" + user.id, 5);
      // Identity and room come from the authenticated membership, never request input.
      const result = await db().batch([
        db()
          .prepare(
            "UPDATE messages SET deleted=1,text='',pinned=0 WHERE roomId=? AND senderId=? AND deleted=0",
          )
          .bind(room.id, user.id),
        db()
          .prepare(
            "DELETE FROM revisions WHERE messageId IN (SELECT id FROM messages WHERE roomId=? AND senderId=?)",
          )
          .bind(room.id, user.id),
        db()
          .prepare(
            "DELETE FROM reactions WHERE messageId IN (SELECT id FROM messages WHERE roomId=? AND senderId=?)",
          )
          .bind(room.id, user.id),
      ]);
      // Include previously deleted messages so an interrupted file cleanup is retryable.
      const files = await all(
        "SELECT DISTINCT m.attachmentId AS id FROM messages m WHERE m.roomId=? AND m.senderId=? AND m.deleted=1 AND m.attachmentId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM messages live WHERE live.attachmentId=m.attachmentId AND live.deleted=0) AND NOT EXISTS(SELECT 1 FROM music_tracks t WHERE t.attachmentId=m.attachmentId)",
        room.id,
        user.id,
      );
      let cleanupPending = files.length > 0 && !env.BUCKET;
      if (env.BUCKET)
        for (let i = 0; i < files.length; i += 100) {
          try {
            await env.BUCKET.delete(
              files.slice(i, i + 100).map((file) => file.id),
            );
          } catch {
            cleanupPending = true;
          }
        }
      return json({
        ok: true,
        deleted: result[0].meta.changes,
        cleanupPending,
      });
    }
    if (action === "messages" && parts.length === 3 && method === "POST") {
      if (member.muted) fail("Messaging is restricted for this identity.", 403);
      await rate("message:" + user.id, 45);
      const b = messageSchema.parse(await req.json());
      if (
        b.replyId &&
        !(await first(
          "SELECT id FROM messages WHERE id=? AND roomId=? AND deleted=0",
          b.replyId,
          room.id,
        ))
      )
        fail("The original message is unavailable.");
      if (
        b.attachmentId &&
        !(await first(
          "SELECT id FROM attachments WHERE id=? AND roomId=? AND senderId=?",
          b.attachmentId,
          room.id,
          user.id,
        ))
      )
        fail("Attachment unavailable.");
      if (
        b.attachmentId &&
        (await first(
          "SELECT id FROM music_tracks WHERE attachmentId=?",
          b.attachmentId,
        ))
      )
        fail(
          "Music files belong to the listening player. Upload a separate copy for chat.",
        );
      await run(
        "INSERT INTO messages (id,roomId,senderId,text,replyId,attachmentId,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
        b.id,
        room.id,
        user.id,
        b.text,
        b.replyId || null,
        b.attachmentId || null,
        now,
      );
      return json({ ok: true, id: b.id }, 201);
    }
    if (action === "messages" && parts[3]) {
      const m = await first(
        "SELECT * FROM messages WHERE id=? AND roomId=? AND deleted=0",
        parts[3],
        room.id,
      );
      if (!m) fail("Message unavailable.", 404);
      if (parts[4] === "reaction" && method === "POST") {
        await rate("reaction:" + user.id, 90);
        const b = z
          .object({
            emoji: z
              .string()
              .refine(
                (e) => allEmojis.includes(e),
                "Choose a supported emoji.",
              ),
          })
          .parse(await req.json());
        const old = await first(
          "SELECT * FROM reactions WHERE messageId=? AND sessionId=? AND emoji=?",
          m!.id,
          user.id,
          b.emoji,
        );
        if (old)
          await run(
            "DELETE FROM reactions WHERE messageId=? AND sessionId=? AND emoji=?",
            m!.id,
            user.id,
            b.emoji,
          );
        else
          await run(
            "INSERT INTO reactions (messageId,sessionId,emoji) VALUES (?,?,?)",
            m!.id,
            user.id,
            b.emoji,
          );
        return json({ ok: true });
      }
      if (parts[4] === "report" && method === "POST") {
        await rate("report:" + user.id, 5);
        const b = z
          .object({ reason: z.string().trim().min(3).max(500) })
          .parse(await req.json());
        await run(
          "INSERT INTO reports (id,roomId,messageId,reporterId,reason,created) VALUES (?,?,?,?,?,?)",
          crypto.randomUUID(),
          room.id,
          m!.id,
          user.id,
          b.reason,
          now,
        );
        return json({ ok: true });
      }
      if (parts[4] === "pin" && method === "POST") {
        if (!admin(member)) fail("Moderator permission required.", 403);
        await run(
          "UPDATE messages SET pinned=? WHERE id=?",
          m!.pinned ? 0 : 1,
          m!.id,
        );
        return json({ ok: true });
      }
      if (method === "PATCH") {
        if (m!.senderId !== user.id || member.muted)
          fail("You can only edit your own messages.", 403);
        const b = z
          .object({ text: z.string().trim().min(1).max(6000) })
          .parse(await req.json());
        await db().batch([
          db()
            .prepare(
              "INSERT INTO revisions (id,messageId,text,created) VALUES (?,?,?,?)",
            )
            .bind(crypto.randomUUID(), m!.id, m!.text, now),
          db()
            .prepare("UPDATE messages SET text=?,edited=? WHERE id=?")
            .bind(b.text, now, m!.id),
        ]);
        return json({ ok: true });
      }
      if (method === "DELETE") {
        if (m!.senderId !== user.id && !admin(member))
          fail("You cannot delete this message.", 403);
        await db().batch([
          db()
            .prepare("UPDATE messages SET deleted=1,text='' WHERE id=?")
            .bind(m!.id),
          db().prepare("DELETE FROM revisions WHERE messageId=?").bind(m!.id),
          db().prepare("DELETE FROM reactions WHERE messageId=?").bind(m!.id),
        ]);
        if (m!.attachmentId) await env.BUCKET?.delete(m!.attachmentId);
        return json({ ok: true });
      }
    }
    if (action === "call" && method === "POST") {
      const b = z.object({ active: z.boolean() }).parse(await req.json());
      const sfu = b.active
        ? await callConfig(env as unknown as Record<string, string>, room.id, {
            id: user.id,
            name: user.name,
          })
        : null;
      const limit = sfu?.limit || 4;
      if (b.active) {
        const result = await run(
          "UPDATE memberships SET inCall=1,lastSeen=? WHERE roomId=? AND sessionId=? AND ((inCall=1 AND lastSeen>?) OR (SELECT COUNT(*) FROM memberships WHERE roomId=? AND inCall=1 AND lastSeen>? AND banned=0)<?)",
          now,
          room.id,
          user.id,
          now - 35000,
          room.id,
          now - 35000,
          limit,
        );
        if (!result.meta.changes)
          fail(`This call is full (${limit} people).`, 409);
      } else
        await run(
          "UPDATE memberships SET inCall=0,lastSeen=? WHERE roomId=? AND sessionId=?",
          now,
          room.id,
          user.id,
        );
      let iceServers: any = [{ urls: "stun:stun.cloudflare.com:3478" }];
      const configured = (env as any).TURN_ICE_SERVERS;
      if (configured) {
        try {
          iceServers = JSON.parse(configured);
        } catch {
          fail("The call server configuration is invalid.", 503);
        }
      }
      return json({
        ok: true,
        iceServers,
        startedAt: now,
        provider: sfu ? "livekit" : "peer",
        sfu,
        limit,
      });
    }
    if (action === "signals" && method === "POST") {
      await rate("signal:" + user.id, 180);
      if (!member.inCall) fail("Join the call first.", 403);
      const b = z
        .object({ recipientId: z.string().uuid(), data: z.string().max(40000) })
        .parse(await req.json());
      if (
        !(await first(
          "SELECT sessionId FROM memberships WHERE roomId=? AND sessionId=? AND banned=0 AND inCall=1",
          room.id,
          b.recipientId,
        ))
      )
        fail("Call participant unavailable.");
      await run(
        "INSERT INTO signals (id,roomId,senderId,recipientId,data,created) VALUES (?,?,?,?,?,?)",
        crypto.randomUUID(),
        room.id,
        user.id,
        b.recipientId,
        b.data,
        now,
      );
      await run("DELETE FROM signals WHERE created<?", now - 120000);
      return json({ ok: true });
    }
    if (action === "reports" && method === "GET") {
      if (!admin(member)) fail("Moderator permission required.", 403);
      return json({
        reports: await all(
          "SELECT r.*,s.name FROM reports r JOIN sessions s ON s.id=r.reporterId WHERE r.roomId=? ORDER BY r.created DESC LIMIT 100",
          room.id,
        ),
      });
    }
    fail("Not found.", 404);
  } catch (e: any) {
    return json(
      {
        error:
          e instanceof z.ZodError
            ? e.issues[0]?.message
            : e.status
              ? e.message
              : "Something went wrong. Please try again.",
      },
      e instanceof z.ZodError ? 400 : e.status || 500,
    );
  }
}
