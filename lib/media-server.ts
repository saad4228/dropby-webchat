import { env } from "cloudflare:workers";
import { z } from "zod";
import { all, db, fail, first, json, run, type Row } from "./server-utils";
import { access, admin, rate } from "./server-auth";
import {
  MEDIA_CONFIG,
  mediaLimit,
  mediaSignature,
  normalizeMime,
  safeFileName,
  validateMedia,
  type MediaPurpose,
} from "./media-config";
import {
  createTus,
  signedRead,
  storageDelete,
  storageHead,
  storagePut,
  storageRead,
  tusRequest,
  verifyPrivateBucket,
} from "./media-storage";

const purposeSchema = z.enum([
  "chat",
  "voice",
  "music",
  "avatar",
  "wallpaper",
  "logo",
  "thumbnail",
]);
const startSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(240),
  mime: z.string().max(100),
  size: z.number().int().positive(),
  purpose: purposeSchema.default("chat"),
  parentId: z.string().uuid().optional(),
  duration: z.number().min(0).max(86400).optional(),
  waveform: z.array(z.number().min(0).max(1)).max(64).optional(),
});
export const mediaAdmin = (user: Row) =>
  ((env as unknown as Record<string, string>).MEDIA_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .includes(user.id);
function budget() {
  const bytes = Number(
    (env as unknown as Record<string, string>).MEDIA_STORAGE_BUDGET_BYTES,
  );
  return Number.isSafeInteger(bytes) && bytes > 0
    ? bytes
    : MEDIA_CONFIG.storageBudget;
}
const charge =
  "CASE WHEN state IN ('uploading','cancelled') THEN MAX(size,expectedSize) ELSE size END";
export async function storageUsage() {
  const row = await first(
    `SELECT COALESCE(SUM(CASE WHEN state IN ('ready','attached','deleting') THEN size ELSE 0 END),0) AS used, COALESCE(SUM(CASE WHEN state IN ('uploading','cancelled') THEN MAX(size,expectedSize) ELSE 0 END),0) AS reserved, COUNT(*) AS files FROM attachments WHERE provider='supabase' AND state!='deleted'`,
  );
  const used = Number(row!.used),
    reserved = Number(row!.reserved),
    limit = budget();
  const [early, high, critical] = MEDIA_CONFIG.warningPercentages;
  const percentage = Math.round(((used + reserved) / limit) * 1000) / 10;
  return {
    used,
    reserved,
    limit,
    percentage,
    files: row!.files,
    estimate: true,
    thresholds: MEDIA_CONFIG.warningPercentages,
    level:
      percentage >= critical
        ? "critical"
        : percentage >= high
          ? "high"
          : percentage >= early
            ? "early"
            : "healthy",
  };
}
async function recordWarnings() {
  const usage = await storageUsage();
  for (const threshold of MEDIA_CONFIG.warningPercentages)
    if (usage.percentage >= threshold)
      await run(
        "INSERT OR IGNORE INTO media_alerts (id,threshold,used,created,acknowledged) VALUES (?,?,?,?,0)",
        new Date().toISOString().slice(0, 10) + ":" + threshold,
        threshold,
        usage.used + usage.reserved,
        Date.now(),
      );
}
export async function storageAdminRoute(req: Request, user: Row) {
  if (!mediaAdmin(user))
    fail(
      "Storage management is available to the application administrator.",
      403,
    );
  if (req.method === "GET")
    return json({
      ...(await storageUsage()),
      notifications: await all(
        "SELECT * FROM media_alerts WHERE acknowledged=0 ORDER BY threshold DESC,created DESC LIMIT 20",
      ),
      cleanup: {
        uploadHours: MEDIA_CONFIG.reservationHours,
        draftHours: MEDIA_CONFIG.orphanHours,
        cancelledMinutes: 10,
      },
    });
  if (req.method === "POST") {
    const body = z
      .object({ action: z.enum(["acknowledge", "cleanup"]) })
      .parse(await req.json());
    if (body.action === "acknowledge") {
      await run("UPDATE media_alerts SET acknowledged=1 WHERE acknowledged=0");
      return json({ ok: true });
    }
    // Manual, explicit policy. Never touches attached messages, tracks, avatars, logos, or wallpapers.
    const candidates = await all(
      "SELECT * FROM attachments WHERE provider='supabase' AND ((state='uploading' AND expires<?) OR (state='ready' AND created<?) OR (state='cancelled' AND deletedAt<?) OR state='deleting') LIMIT 60",
      Date.now(),
      Date.now() - MEDIA_CONFIG.orphanHours * 3600000,
      Date.now() - 600000,
    );
    let cleaned = 0,
      pending = 0;
    for (const row of candidates) {
      if (await isReferenced(row.id)) continue;
      try {
        await deleteAsset(row, true);
        cleaned++;
      } catch {
        pending++;
      }
    }
    return json({ ok: true, cleaned, pending, usage: await storageUsage() });
  }
  fail("Method not allowed.", 405);
}
async function isReferenced(id: string) {
  return !!(await first(
    "SELECT id FROM messages WHERE attachmentId=? AND deleted=0 UNION ALL SELECT id FROM music_tracks WHERE attachmentId=? UNION ALL SELECT id FROM rooms WHERE logoImageId=? UNION ALL SELECT id FROM sessions WHERE avatarImageId=? UNION ALL SELECT id FROM attachments WHERE thumbnailId=? AND state IN ('ready','attached') LIMIT 1",
    id,
    id,
    id,
    id,
    id,
  ));
}
export async function deleteAsset(row: Row, cleanup = false) {
  if (row.provider !== "supabase" || !row.storagePath)
    fail(
      "This file needs a verified storage migration before it can be removed.",
      503,
    );
  if (await isReferenced(row.id)) return false;
  if (row.purpose === "wallpaper" && row.state === "attached" && cleanup)
    return false;
  const children = await all(
    "SELECT * FROM attachments WHERE parentId=? AND state!='deleted'",
    row.id,
  );
  const claimed = await run(
    "UPDATE attachments SET size=CASE WHEN state IN ('uploading','cancelled') THEN MAX(size,expectedSize) ELSE size END,state='deleting' WHERE id=? AND state!='deleted' AND NOT EXISTS(SELECT 1 FROM messages WHERE attachmentId=? AND deleted=0) AND NOT EXISTS(SELECT 1 FROM music_tracks WHERE attachmentId=?) AND NOT EXISTS(SELECT 1 FROM rooms WHERE logoImageId=?) AND NOT EXISTS(SELECT 1 FROM sessions WHERE avatarImageId=?) AND NOT EXISTS(SELECT 1 FROM attachments WHERE thumbnailId=? AND state IN ('ready','attached'))",
    row.id,
    row.id,
    row.id,
    row.id,
    row.id,
    row.id,
  );
  if (!claimed.meta.changes) return false;
  try {
    if (row.resumableUrl?.startsWith("http"))
      await tusRequest(row.resumableUrl, { method: "DELETE" }).catch(() => {});
    await storageDelete(row.storagePath);
    await run(
      "UPDATE attachments SET state='deleted',deletedAt=?,size=0,expectedSize=0,resumableUrl=NULL WHERE id=?",
      Date.now(),
      row.id,
    );
    for (const child of children) await deleteAsset(child, cleanup);
    return true;
  } catch (error) {
    throw error;
  } // 'deleting' continues to count until confirmed absent.
}
export async function cleanupAttachment(id: string) {
  const row = await first("SELECT * FROM attachments WHERE id=?", id);
  if (row && row.state !== "deleted") return deleteAsset(row);
  return true;
}
function attachment(row: Row) {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    thumbnailId: row.thumbnailId,
    duration: row.duration,
    waveform: row.waveform ? JSON.parse(row.waveform) : undefined,
  };
}
async function verifyUploaded(row: Row): Promise<Row> {
  if (row.expires < Date.now())
    fail("This upload expired. Choose the file again.", 409);
  const meta = await storageHead(row.storagePath);
  if (!meta)
    fail("The upload has not finished. Resume it before sending.", 409);
  const mime = normalizeMime(meta!.mime);
  const error = validateMedia(
    { size: meta!.size, type: mime },
    row.purpose as MediaPurpose,
  );
  const response = await storageRead(row.storagePath, "bytes=0-511");
  const reader = response.body?.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    while (length < 512) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parts.push(chunk.value.slice(0, 512 - length));
      length += Math.min(chunk.value.length, 512 - length);
    }
    await reader.cancel();
  }
  const prefix = new Uint8Array(length);
  let position = 0;
  for (const part of parts) {
    prefix.set(part, position);
    position += part.length;
  }
  if (
    error ||
    meta!.size !== row.expectedSize ||
    mime !== row.mime ||
    !mediaSignature(prefix, mime)
  ) {
    await run(
      "UPDATE attachments SET size=?,state='deleting' WHERE id=?",
      meta!.size,
      row.id,
    );
    await deleteAsset({ ...row, size: meta!.size }).catch(() => {});
    fail(
      error ||
        "The uploaded file does not match its declared size or format. Choose another file.",
      400,
    );
  }
  const result = await run(
    "UPDATE attachments SET size=?,state='ready' WHERE id=? AND state='uploading'",
    meta!.size,
    row.id,
  );
  if (!result.meta.changes) {
    const current = await first("SELECT * FROM attachments WHERE id=?", row.id);
    if (current && ["ready", "attached"].includes(current.state))
      return current;
    if (current && ["cancelled", "deleting"].includes(current.state))
      await deleteAsset(current).catch(() => {});
    fail("This upload was cancelled.", 409);
  }
  return { ...row, size: meta!.size, state: "ready" };
}
async function finalize(row: Row, user: Row, room: Row) {
  if (row.state === "uploading") row = await verifyUploaded(row);
  if (row.state === "attached") return attachment(row);
  if (row.state !== "ready")
    fail("This upload was cancelled or expired. Choose the file again.", 409);
  if (["thumbnail", "logo", "avatar"].includes(row.purpose)) {
    const old =
      row.purpose === "avatar"
        ? (
            await first(
              "SELECT avatarImageId AS id FROM sessions WHERE id=?",
              user.id,
            )
          )?.id
        : row.purpose === "logo"
          ? room.logoImageId
          : null;
    // Claim the file and publish its setting in one D1 transaction. Cancellation
    // either wins before this batch, or sees an attached file afterwards.
    const claim =
      row.purpose === "thumbnail"
        ? db()
            .prepare(
              "UPDATE attachments SET state='attached' WHERE id=? AND state='ready' AND EXISTS(SELECT 1 FROM attachments WHERE id=? AND senderId=? AND state IN ('ready','attached') AND thumbnailId IS NULL)",
            )
            .bind(row.id, row.parentId, user.id)
        : db()
            .prepare(
              "UPDATE attachments SET state='attached' WHERE id=? AND state='ready'",
            )
            .bind(row.id);
    const publish =
      row.purpose === "thumbnail"
        ? db()
            .prepare(
              "UPDATE attachments SET thumbnailId=? WHERE id=? AND EXISTS(SELECT 1 FROM attachments WHERE id=? AND state='attached')",
            )
            .bind(row.id, row.parentId, row.id)
        : row.purpose === "logo"
          ? db()
              .prepare(
                "UPDATE rooms SET logoImageId=? WHERE id=? AND EXISTS(SELECT 1 FROM attachments WHERE id=? AND state='attached')",
              )
              .bind(row.id, room.id, row.id)
          : db()
              .prepare(
                "UPDATE sessions SET avatarImageId=? WHERE id=? AND EXISTS(SELECT 1 FROM attachments WHERE id=? AND state='attached')",
              )
              .bind(row.id, user.id, row.id);
    const [claimed] = await db().batch([claim, publish]);
    if (!claimed.meta.changes) {
      const current = await first(
        "SELECT * FROM attachments WHERE id=?",
        row.id,
      );
      if (current?.state === "attached") return attachment(current);
      await deleteAsset(row).catch(() => {});
      fail("This upload was cancelled or is no longer needed.", 409);
    }
    if (old) await cleanupAttachment(old).catch(() => {});
  } else if (row.purpose === "wallpaper") {
    const claimed = await run(
      "UPDATE attachments SET state='attached' WHERE id=? AND state='ready'",
      row.id,
    );
    if (!claimed.meta.changes) {
      const current = await first(
        "SELECT * FROM attachments WHERE id=?",
        row.id,
      );
      if (current?.state === "attached") return attachment(current);
      fail("This upload was cancelled.", 409);
    }
  }
  await recordWarnings();
  return attachment(row);
}
async function boundedBytes(req: Request, maximum: number) {
  const declared = Number(req.headers.get("content-length"));
  if (declared > maximum) fail("This upload chunk is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) {
      await reader.cancel();
      fail("This upload chunk is too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function roomMediaRoute(
  req: Request,
  parts: string[],
  user: Row,
  room: Row,
  member: Row,
) {
  if (member.muted && req.method !== "HEAD")
    fail("File sharing is restricted for this identity.", 403);
  if (req.method === "POST" && parts.length === 3) {
    await rate("upload:" + user.id, 30);
    const body = startSchema.parse(await req.json());
    body.mime = normalizeMime(body.mime);
    const invalid = validateMedia(
      { size: body.size, type: body.mime },
      body.purpose,
    );
    if (invalid)
      fail(
        invalid,
        mediaLimit(body.mime, body.purpose) &&
          body.size > mediaLimit(body.mime, body.purpose)
          ? 413
          : 400,
      );
    if (body.purpose === "logo" && !admin(member))
      fail("Only the room owner or moderator can update its image.", 403);
    if (body.purpose === "thumbnail") {
      const parent = await first(
        "SELECT * FROM attachments WHERE id=? AND roomId=? AND senderId=? AND state IN ('ready','attached')",
        body.parentId || "",
        room.id,
        user.id,
      );
      if (
        !parent ||
        parent.parentId ||
        parent.thumbnailId ||
        !/(image|video)\//.test(parent.mime) ||
        parent.mime === "image/gif"
      )
        fail("Preview unavailable.", 400);
    }
    let row = await first("SELECT * FROM attachments WHERE id=?", body.id);
    if (row) {
      if (
        row.senderId !== user.id ||
        row.roomId !== room.id ||
        row.mime !== body.mime ||
        row.expectedSize !== body.size ||
        row.purpose !== body.purpose
      )
        fail("Upload unavailable.", 403);
    } else {
      await verifyPrivateBucket();
      const extension = body.mime
        .split("/")[1]
        .replace("plain", "txt")
        .replace("jpeg", "jpg");
      const path = `rooms/${room.id}/${user.id}/${crypto.randomUUID()}.${extension}`;
      const result = await run(
        `INSERT INTO attachments (id,roomId,senderId,name,mime,size,created,provider,storagePath,purpose,state,expectedSize,expires,parentId,duration,waveform) SELECT ?,?,?,?,?,0,?,'supabase',?,?,'uploading',?,?,?,?,? WHERE COALESCE((SELECT SUM(${charge}) FROM attachments WHERE provider='supabase' AND state!='deleted'),0)+?<=?`,
        body.id,
        room.id,
        user.id,
        safeFileName(body.name),
        body.mime,
        Date.now(),
        path,
        body.purpose,
        body.size,
        Date.now() + MEDIA_CONFIG.reservationHours * 3600000,
        body.parentId || null,
        body.duration || null,
        body.waveform ? JSON.stringify(body.waveform) : null,
        body.size,
        budget(),
      );
      if (!result.meta.changes)
        fail(
          "There is not enough media space for this file right now. Text chat still works; the administrator can review storage.",
          507,
        );
      row = await first("SELECT * FROM attachments WHERE id=?", body.id);
      await recordWarnings();
    }
    if (
      row!.expires < Date.now() ||
      ["deleted", "deleting", "cancelled"].includes(row!.state)
    )
      fail("This upload expired. Choose the file again.", 409);
    return json(
      {
        id: row!.id,
        expires: row!.expires,
        attachment: ["ready", "attached"].includes(row!.state)
          ? attachment(row!)
          : null,
        endpoint: `/api/rooms/${room.slug}/uploads/${row!.id}`,
        resumable: body.size > MEDIA_CONFIG.resumableAbove,
      },
      201,
    );
  }
  const row = await first(
    "SELECT * FROM attachments WHERE id=? AND roomId=? AND senderId=? AND provider='supabase'",
    parts[3],
    room.id,
    user.id,
  );
  if (!row) fail("Upload unavailable.", 404);
  const r = row!;
  if (req.method === "DELETE" && parts.length === 4) {
    if (r.state === "attached" && r.purpose === "avatar") {
      await run(
        "UPDATE sessions SET avatarImageId=NULL WHERE id=? AND avatarImageId=?",
        user.id,
        r.id,
      );
      await deleteAsset(r);
      return json({ ok: true });
    }
    if (r.state === "attached" && r.purpose === "wallpaper") {
      await deleteAsset(r);
      return json({ ok: true });
    }
    if ((await isReferenced(r.id)) || r.state === "attached")
      fail(
        "Remove the attachment from its message or active setting first.",
        409,
      );
    const cancelled = await run(
      "UPDATE attachments SET state='cancelled',deletedAt=? WHERE id=? AND state IN ('uploading','ready','cancelled') AND NOT EXISTS(SELECT 1 FROM messages WHERE attachmentId=? AND deleted=0) AND NOT EXISTS(SELECT 1 FROM music_tracks WHERE attachmentId=?)",
      Date.now(),
      r.id,
      r.id,
      r.id,
    );
    if (!cancelled.meta.changes)
      fail("This attachment is already in use.", 409);
    if (r.resumableUrl?.startsWith("http"))
      await tusRequest(r.resumableUrl, { method: "DELETE" }).catch(() => {});
    // Hold the reservation until manual cleanup after ten minutes; an already-running request may still finish.
    await storageDelete(r.storagePath).catch(() => {});
    return json({ ok: true, cleanupPending: true });
  }
  if (req.method === "POST" && parts[4] === "complete")
    return json({ attachment: await finalize(r, user, room) });
  if (r.state !== "uploading" || r.expires < Date.now())
    fail("This upload is no longer active.", 409);
  if (parts[4] === "content" && req.method === "POST") {
    if (r.expectedSize > MEDIA_CONFIG.resumableAbove)
      fail("Use a resumable transfer for this file.", 400);
    const bytes = await boundedBytes(req, MEDIA_CONFIG.resumableAbove);
    if (bytes.length !== r.expectedSize || !mediaSignature(bytes, r.mime))
      fail("The file contents do not match its size or format.", 400);
    await storagePut(r.storagePath, bytes, r.mime);
    return json({ ok: true });
  }
  if (parts[4] === "tus") {
    const headers: Record<string, string> = {
      "Tus-Resumable": "1.0.0",
      "Cache-Control": "no-store",
    };
    if (req.method === "POST") {
      const claimed = await run(
        "UPDATE attachments SET resumableUrl='creating' WHERE id=? AND state='uploading' AND resumableUrl IS NULL",
        r.id,
      );
      let upstream = r.resumableUrl;
      if (claimed.meta.changes) {
        try {
          upstream = await createTus(r.storagePath, r.expectedSize, r.mime);
          await run(
            "UPDATE attachments SET resumableUrl=? WHERE id=?",
            upstream,
            r.id,
          );
        } catch (error) {
          await run(
            "UPDATE attachments SET resumableUrl=NULL WHERE id=? AND resumableUrl='creating'",
            r.id,
          );
          throw error;
        }
      }
      if (!upstream?.startsWith("http"))
        fail("This transfer is starting. Please retry in a moment.", 409);
      const offset = claimed.meta.changes
        ? "0"
        : (await tusRequest(upstream, { method: "HEAD" })).headers.get(
            "upload-offset",
          ) || "0";
      return new Response(null, {
        status: 201,
        headers: {
          ...headers,
          Location: new URL(req.url).href,
          "Upload-Offset": offset,
        },
      });
    }
    if (!r.resumableUrl?.startsWith("http"))
      return new Response(null, { status: 404, headers });
    if (req.method === "HEAD") {
      const upstream = await tusRequest(r.resumableUrl, { method: "HEAD" });
      return new Response(null, {
        status: upstream.status,
        headers: {
          ...headers,
          "Upload-Offset": upstream.headers.get("upload-offset") || "0",
          "Upload-Length": String(r.expectedSize),
        },
      });
    }
    if (req.method === "PATCH") {
      const offset = Number(req.headers.get("upload-offset"));
      const bytes = await boundedBytes(req, MEDIA_CONFIG.chunkSize);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset + bytes.length > r.expectedSize
      )
        fail("This chunk exceeds the authorized file size.", 413);
      if (offset === 0 && !mediaSignature(bytes, r.mime))
        fail("The file contents do not match its format.", 400);
      const upstream = await tusRequest(r.resumableUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/offset+octet-stream",
          "Upload-Offset": String(offset),
        },
        body: bytes as unknown as BodyInit,
      });
      return new Response(null, {
        status: upstream.status,
        headers: {
          ...headers,
          "Upload-Offset":
            upstream.headers.get("upload-offset") || String(offset),
        },
      });
    }
  }
  fail("Upload action unavailable.", 405);
}
export async function serveMedia(req: Request, user: Row, id: string) {
  const record = await first(
    "SELECT * FROM attachments WHERE id=? AND state IN ('ready','attached')",
    id,
  );
  if (!record) fail("File unavailable.", 404);
  const row = record!;
  const parent = row.parentId
    ? await first(
        "SELECT * FROM attachments WHERE id=? AND state IN ('ready','attached')",
        row.parentId,
      )
    : row;
  if (!parent) fail("File unavailable.", 404);
  const room = await first("SELECT slug FROM rooms WHERE id=?", parent!.roomId);
  if (parent!.purpose === "avatar") {
    const common = await first(
      "SELECT a.roomId FROM memberships a JOIN memberships b ON b.roomId=a.roomId WHERE a.sessionId=? AND b.sessionId=? AND a.banned=0 AND b.banned=0 LIMIT 1",
      parent!.senderId,
      user.id,
    );
    if (parent!.senderId !== user.id && !common) fail("File unavailable.", 403);
  } else {
    if (!room) fail("File unavailable.", 404);
    await access(room!.slug, user);
    if (parent!.purpose === "wallpaper" && parent!.senderId !== user.id)
      fail("This wallpaper is personal.", 403);
  }
  if (
    !["wallpaper", "avatar"].includes(parent!.purpose) &&
    !(await isReferenced(parent!.id)) &&
    parent!.senderId !== user.id
  )
    fail("File unavailable.", 404);
  if (row.provider !== "supabase" || !row.storagePath)
    fail(
      "This file needs a verified storage migration before it can be opened.",
      503,
    );
  if (new URL(req.url).pathname.endsWith("/url")) {
    return json({
      url: await signedRead(row.storagePath),
      expiresIn: MEDIA_CONFIG.signedReadSeconds,
    });
  }
  const etag = `"${id}-${row.size}"`;
  const headers: Record<string, string> = {
    "Content-Type": row.mime,
    "Cache-Control": "private, max-age=0, must-revalidate",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  };
  if (!/^(image|video|audio)\//.test(row.mime))
    headers["Content-Disposition"] =
      `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`;
  if (req.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  const range = req.headers.get("range");
  let start = 0,
    end = row.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${row.size}` },
      });
    if (!match[1]) start = Math.max(0, row.size - Number(match[2]));
    else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= row.size ||
      end < start
    )
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${row.size}` },
      });
    headers["Content-Range"] = `bytes ${start}-${end}/${row.size}`;
  }
  const upstream = await storageRead(
    row.storagePath,
    range ? `bytes=${start}-${end}` : undefined,
  );
  if (upstream.status === 404) fail("File unavailable.", 404);
  // A provider/CDN may encode its response. Never reuse an encoded length for
  // the decoded stream: a mismatched Content-Length can leave playback waiting.
  if (upstream.headers.has("content-range"))
    headers["Content-Range"] = upstream.headers.get("content-range")!;
  return new Response(upstream.body, { status: upstream.status, headers });
}
