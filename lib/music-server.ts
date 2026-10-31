import { cleanupAttachment } from "./media-server";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { MUSIC_MIMES, musicPosition } from "./music";
type Row = Record<string, any>;
const db = () => env.DB!;
const first = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args)
    .first<Row>();
const all = async (sql: string, ...args: any[]) =>
  (
    await db()
      .prepare(sql)
      .bind(...args)
      .all<Row>()
  ).results;
const run = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args)
    .run();
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
const trackSql =
  "SELECT t.*,s.name AS addedByName,a.mime FROM music_tracks t JOIN sessions s ON s.id=t.addedBy JOIN attachments a ON a.id=t.attachmentId";
async function readState(roomId: string) {
  return await first(
    "SELECT ms.*,s.name AS controllerName,m.lastSeen,m.banned,t.duration FROM music_states ms LEFT JOIN sessions s ON s.id=ms.controllerId LEFT JOIN memberships m ON m.roomId=ms.roomId AND m.sessionId=ms.controllerId LEFT JOIN music_tracks t ON t.id=ms.trackId WHERE ms.roomId=?",
    roomId,
  );
}
export async function musicPlayback(
  roomId: string,
  userId: string,
  revision: number,
) {
  const state = await readState(roomId);
  if (
    !state ||
    state.revision !== revision ||
    (state.playing &&
      state.duration &&
      musicPosition(
        { ...state, playing: true } as any,
        state.duration,
        Date.now(),
      ) >= state.duration)
  )
    return musicSnapshot(roomId, userId);
  return {
    state: {
      trackId: state.trackId,
      controllerId: state.controllerId,
      controllerName: state.controllerName,
      controllerOnline: !state.banned && state.lastSeen > Date.now() - 35000,
      position: state.position,
      playing: !!state.playing,
      updatedAt: state.updatedAt,
      revision: state.revision,
    },
    serverNow: Date.now(),
  };
}
async function advance(
  roomId: string,
  state: Row,
  controllerId: string | null,
  stop = false,
) {
  const next = stop
    ? null
    : await first(
        trackSql +
          " WHERE t.roomId=? AND t.played=0 AND t.id!=? ORDER BY t.created,t.id LIMIT 1",
        roomId,
        state.trackId || "",
      );
  const now = Date.now();
  const result = await db().batch([
    db()
      .prepare(
        "UPDATE music_tracks SET played=1 WHERE id=? AND roomId=? AND EXISTS (SELECT 1 FROM music_states WHERE roomId=? AND revision=?)",
      )
      .bind(state.trackId || "", roomId, roomId, state.revision),
    db()
      .prepare(
        "UPDATE music_states SET trackId=?,controllerId=?,position=0,playing=?,updatedAt=?,revision=revision+1 WHERE roomId=? AND revision=? AND (? IS NULL OR EXISTS(SELECT 1 FROM music_tracks WHERE id=? AND roomId=? AND played=0))",
      )
      .bind(
        next?.id || null,
        controllerId,
        next ? 1 : 0,
        now,
        roomId,
        state.revision,
        next?.id || null,
        next?.id || null,
        roomId,
      ),
  ]);
  if (!result[1].meta.changes)
    fail("The song changed. Your player is catching up.", 409);
}
export async function musicSnapshot(roomId: string, userId: string) {
  let state = await readState(roomId);
  let current = state?.trackId
    ? await first(
        trackSql + " WHERE t.id=? AND t.roomId=?",
        state.trackId,
        roomId,
      )
    : null;
  if (
    state &&
    current &&
    state.playing &&
    musicPosition(
      { ...state, playing: !!state.playing } as any,
      current.duration,
      Date.now(),
    ) >= current.duration
  ) {
    try {
      await advance(roomId, state, state.controllerId);
    } catch (e: any) {
      if (e.status !== 409) throw e;
    }
    state = await readState(roomId);
    current = state?.trackId
      ? await first(
          trackSql + " WHERE t.id=? AND t.roomId=?",
          state.trackId,
          roomId,
        )
      : null;
  }
  const [queue, choices, ownChoice] = await Promise.all([
    all(
      trackSql +
        " WHERE t.roomId=? AND t.played=0 AND t.id!=? ORDER BY t.created,t.id LIMIT 20",
      roomId,
      state?.trackId || "",
    ),
    all(
      "SELECT c.sessionId,s.name,c.response,c.changeRequested FROM music_choices c JOIN sessions s ON s.id=c.sessionId JOIN memberships m ON m.roomId=c.roomId AND m.sessionId=c.sessionId WHERE c.roomId=? AND c.trackId=? AND m.banned=0 AND m.lastSeen>?",
      roomId,
      state?.trackId || "",
      Date.now() - 35000,
    ),
    first(
      "SELECT trackId,response,changeRequested FROM music_choices WHERE roomId=? AND sessionId=?",
      roomId,
      userId,
    ),
  ]);
  return {
    state: state
      ? {
          trackId: state.trackId,
          controllerId: state.controllerId,
          controllerName: state.controllerName,
          controllerOnline:
            !state.banned && state.lastSeen > Date.now() - 35000,
          position: state.position,
          playing: !!state.playing,
          updatedAt: state.updatedAt,
          revision: state.revision,
        }
      : {
          trackId: null,
          controllerId: null,
          controllerName: null,
          controllerOnline: false,
          position: 0,
          playing: false,
          updatedAt: Date.now(),
          revision: 0,
        },
    current,
    queue,
    choices: choices.map((c) => ({
      ...c,
      changeRequested: !!c.changeRequested,
    })),
    ownChoice: ownChoice
      ? { ...ownChoice, changeRequested: !!ownChoice.changeRequested }
      : null,
    serverNow: Date.now(),
  };
}
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("queue"),
    attachmentId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    duration: z.number().finite().min(0.5).max(7200),
  }),
  z.object({
    action: z.literal("choice"),
    trackId: z.string().uuid(),
    response: z.enum(["accepted", "declined"]),
    changeRequested: z.boolean().default(false),
  }),
  z.object({
    action: z.enum(["play", "pause", "next", "stop", "claim"]),
    revision: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal("seek"),
    revision: z.number().int().nonnegative(),
    position: z.number().finite().min(0).max(7200),
    at: z.number().finite().nonnegative().optional(),
    trackId: z.string().uuid().optional(),
  }),
  z.object({ action: z.literal("remove"), trackId: z.string().uuid() }),
]);
export async function musicCommand(
  req: Request,
  room: Row,
  user: Row,
  member: Row,
) {
  const b = command.parse(await req.json()),
    roomId = room.id,
    now = Date.now();
  const admin = member.role === "owner" || member.role === "moderator";
  if (member.muted && b.action !== "choice")
    fail("Music sharing is restricted for this identity.", 403);
  if (b.action === "queue") {
    const attachment = await first(
      "SELECT * FROM attachments WHERE id=? AND roomId=? AND senderId=? AND state IN ('ready','attached') AND purpose IN ('music','chat')",
      b.attachmentId,
      roomId,
      user.id,
    );
    if (!attachment || !MUSIC_MIMES.includes(attachment.mime))
      fail("Choose an MP3, M4A, OGG, MP4 or WebM file from this room.");
    if (
      await first(
        "SELECT id FROM messages WHERE attachmentId=? LIMIT 1",
        b.attachmentId,
      )
    )
      fail("Upload a separate file for the music player.");
    if (
      await first(
        "SELECT id FROM music_tracks WHERE attachmentId=?",
        b.attachmentId,
      )
    )
      fail("This file is already in the player.", 409);
    const id = crypto.randomUUID();
    const inserted = await run(
      "INSERT INTO music_tracks (id,roomId,attachmentId,title,duration,addedBy,created,played) SELECT ?,?,?,?,?,?,?,0 WHERE (SELECT COUNT(*) FROM music_tracks WHERE roomId=? AND played=0)<20 AND EXISTS(SELECT 1 FROM attachments WHERE id=? AND state IN ('ready','attached'))",
      id,
      roomId,
      b.attachmentId,
      b.title,
      b.duration,
      user.id,
      now,
      roomId,
      b.attachmentId,
    );
    if (inserted.meta.changes)
      await run(
        "UPDATE attachments SET state='attached' WHERE id=?",
        attachment!.id,
      );
    if (!inserted.meta.changes)
      fail("The queue is full. Make room before adding another song.", 409);
    await run(
      "INSERT INTO music_states (roomId,updatedAt) VALUES (?,?) ON CONFLICT(roomId) DO NOTHING",
      roomId,
      now,
    );
    await run(
      "UPDATE music_states SET trackId=?,controllerId=?,playing=1,position=0,updatedAt=?,revision=revision+1 WHERE roomId=? AND trackId IS NULL",
      id,
      user.id,
      now,
      roomId,
    );
    return { ...(await musicSnapshot(roomId, user.id)), addedId: id };
  }
  const state = await readState(roomId);
  if (b.action === "choice") {
    if (!state || state.trackId !== b.trackId)
      fail("A new song is ready. Choose whether to join it.", 409);
    if (member.muted && b.changeRequested)
      fail("Music requests are restricted for this identity.", 403);
    await run(
      "INSERT INTO music_choices (roomId,sessionId,trackId,response,changeRequested) VALUES (?,?,?,?,?) ON CONFLICT(roomId,sessionId) DO UPDATE SET trackId=excluded.trackId,response=excluded.response,changeRequested=excluded.changeRequested",
      roomId,
      user.id,
      b.trackId,
      b.response,
      b.changeRequested ? 1 : 0,
    );
    return musicSnapshot(roomId, user.id);
  }
  if (b.action === "remove") {
    const track = await first(
      "SELECT * FROM music_tracks WHERE id=? AND roomId=?",
      b.trackId,
      roomId,
    );
    if (!track) return fail("This song is no longer queued.", 404);
    if (track.addedBy !== user.id && !admin)
      fail("You can only remove your own queued songs.", 403);
    if (state?.trackId === track.id)
      fail("Use Skip or End session for the current song.", 409);
    await run(
      "DELETE FROM music_tracks WHERE id=? AND NOT EXISTS(SELECT 1 FROM music_states WHERE roomId=? AND trackId=?)",
      track.id,
      roomId,
      track.id,
    );
    if (await first("SELECT id FROM music_tracks WHERE id=?", track.id))
      fail("This song just started. Refresh the player.", 409);
    await cleanupAttachment(track.attachmentId);
    return musicSnapshot(roomId, user.id);
  }
  if (!state) fail("Add a song to start a listening session.", 409);
  if (b.action === "seek" && b.trackId && b.trackId !== state!.trackId)
    fail("The song changed. Choose a position in the new song.", 409);
  if (state!.revision !== b.revision)
    fail("The player changed. Try that control again.", 409);
  if (b.action === "claim") {
    if (
      !admin &&
      state!.controllerId !== user.id &&
      !state!.banned &&
      state!.lastSeen > now - 35000
    )
      fail("The DJ is still here. You can request a different song.", 403);
    const result = await run(
      "UPDATE music_states SET controllerId=?,revision=revision+1 WHERE roomId=? AND revision=?",
      user.id,
      roomId,
      b.revision,
    );
    if (!result.meta.changes) fail("The DJ changed. Try again.", 409);
  } else {
    if (!admin && state!.controllerId !== user.id)
      fail("Only the DJ or a room moderator can control shared playback.", 403);
    if (b.action === "next" || b.action === "stop")
      await advance(roomId, state!, user.id, b.action === "stop");
    else {
      const track =
        state!.trackId &&
        (await first(
          "SELECT duration FROM music_tracks WHERE id=? AND roomId=?",
          state!.trackId,
          roomId,
        ));
      if (!track) fail("Add a song to start a listening session.", 409);
      const position =
        b.action === "seek"
          ? Math.min(
              b.position +
                (state!.playing && b.at
                  ? Math.max(0, Math.min(5000, now - b.at)) / 1000
                  : 0),
              track!.duration,
            )
          : musicPosition(
              { ...state!, playing: !!state!.playing } as any,
              track!.duration,
              now,
            );
      const playing =
        b.action === "play" ? 1 : b.action === "pause" ? 0 : state!.playing;
      const result = await run(
        "UPDATE music_states SET position=?,playing=?,updatedAt=?,revision=revision+1 WHERE roomId=? AND revision=?",
        position,
        playing,
        now,
        roomId,
        b.revision,
      );
      if (!result.meta.changes) fail("The player changed. Try again.", 409);
    }
  }
  return musicSnapshot(roomId, user.id);
}
