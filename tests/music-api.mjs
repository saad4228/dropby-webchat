import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
const owner = { cookie: "" },
  friend = { cookie: "" },
  stranger = { cookie: "" };
let count = 0;
async function raw(user, path, body, method = body ? "POST" : "GET") {
  const response = await fetch(origin + "/api/" + path, {
    method,
    headers: {
      ...(user.cookie ? { cookie: user.cookie } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (response.headers.get("set-cookie"))
    user.cookie = response.headers.get("set-cookie").split(";")[0];
  return { status: response.status, data: await response.json() };
}
async function request(
  user,
  path,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
) {
  const result = await raw(user, path, body, method);
  assert.equal(result.status, expected, JSON.stringify(result));
  return result.data;
}
function ok(label) {
  console.log("PASS " + ++count + " " + label);
}
for (const [user, name] of [
  [owner, "Music Owner"],
  [friend, "Music Friend"],
  [stranger, "Music Outsider"],
])
  user.id = (
    await request(user, "session", { name, avatar: "🌿", color: "#4b6bfa" })
  ).user.id;
const slug = "music-api-" + randomUUID().slice(0, 8),
  other = slug + "-other";
await request(
  owner,
  "rooms",
  { slug, visibility: "public", description: "Music QA", password: "" },
  "POST",
  201,
);
await request(
  owner,
  "rooms",
  {
    slug: other,
    visibility: "public",
    description: "Separate room",
    password: "",
  },
  "POST",
  201,
);
await request(friend, "rooms/" + slug + "/join", {});
const path = "rooms/" + slug + "/music";
await request(stranger, path, undefined, "GET", 403);
assert.equal((await request(friend, path)).current, null);
ok("Only room members can read the player");
async function upload(user, name = "radio-tone.mp3", mime = "audio/mpeg") {
  const form = new FormData();
  form.append(
    "file",
    new File([readFileSync("tests/fixtures/" + name)], name, { type: mime }),
  );
  return (await request(user, "rooms/" + slug + "/upload", form, "POST", 201))
    .attachment.id;
}
const attachmentId = await upload(owner);
await request(
  friend,
  path,
  { action: "queue", attachmentId, title: "Stolen file", duration: 45 },
  "POST",
  400,
);
await request(
  owner,
  "rooms/" + other + "/music",
  { action: "queue", attachmentId, title: "Wrong room", duration: 45 },
  "POST",
  400,
);
const first = await request(owner, path, {
  action: "queue",
  attachmentId,
  title: "Shared MP3",
  duration: 45,
});
assert.equal(first.current.title, "Shared MP3");
await request(
  owner,
  path,
  { action: "queue", attachmentId, title: "Duplicate", duration: 45 },
  "POST",
  409,
);
await request(
  owner,
  "rooms/" + slug + "/messages",
  { id: randomUUID(), text: "Reuse music attachment", attachmentId },
  "POST",
  400,
);
ok(
  "Song uploads are owner-checked, room-scoped and cannot be deleted through chat",
);
const media = await fetch(origin + "/api/media/" + attachmentId, {
  headers: { cookie: friend.cookie, Range: "bytes=0-127" },
});
assert.equal(media.status, 206);
assert.equal((await media.arrayBuffer()).byteLength, 128);
assert.equal(
  (
    await fetch(origin + "/api/media/" + attachmentId, {
      headers: { cookie: stranger.cookie },
    })
  ).status,
  403,
);
ok("Music files support authenticated byte-range audio playback");
await request(
  friend,
  path,
  { action: "pause", revision: first.state.revision },
  "POST",
  403,
);
await request(
  friend,
  path,
  { action: "claim", revision: first.state.revision },
  "POST",
  403,
);
const paused = await request(owner, path, {
  action: "pause",
  revision: first.state.revision,
});
await request(
  owner,
  path,
  { action: "play", revision: first.state.revision },
  "POST",
  409,
);
const races = await Promise.all([
  raw(owner, path, {
    action: "seek",
    position: 2,
    revision: paused.state.revision,
  }),
  raw(owner, path, {
    action: "seek",
    position: 3,
    revision: paused.state.revision,
  }),
]);
assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
ok(
  "Shared controls enforce DJ permissions and reject stale or simultaneous updates",
);
await request(friend, path, {
  action: "choice",
  trackId: first.current.id,
  response: "accepted",
});
let s = await request(owner, path, {
  action: "choice",
  trackId: first.current.id,
  response: "accepted",
});
assert.equal(s.choices.filter((c) => c.response === "accepted").length, 2);
await request(friend, path, {
  action: "choice",
  trackId: first.current.id,
  response: "declined",
  changeRequested: true,
});
s = await request(owner, path);
assert.equal(s.choices.filter((c) => c.response === "accepted").length, 1);
assert.equal(s.choices.filter((c) => c.changeRequested).length, 1);
assert.equal(s.current.id, first.current.id);
ok("Accepting, declining and requesting a change are personal choices");
const video = await upload(friend, "radio-video.mp4", "video/mp4");
s = await request(friend, path, {
  action: "queue",
  attachmentId: video,
  title: "Video as audio",
  duration: 40,
});
assert.equal(s.queue[0].mime, "video/mp4");
await request(
  owner,
  path,
  { action: "remove", trackId: first.current.id },
  "POST",
  409,
);
const extra = await upload(owner);
s = await request(owner, path, {
  action: "queue",
  attachmentId: extra,
  title: "Remove me",
  duration: 45,
});
const extraId = s.queue.find((t) => t.title === "Remove me").id;
await request(
  friend,
  path,
  { action: "remove", trackId: extraId },
  "POST",
  403,
);
s = await request(owner, path, { action: "remove", trackId: extraId });
assert.ok(!s.queue.some((t) => t.id === extraId));
assert.equal(
  (
    await fetch(origin + "/api/media/" + extra, {
      headers: { cookie: owner.cookie },
    })
  ).status,
  404,
);
ok(
  "The queue accepts video audio and safely removes only authorized queued files",
);
s = await request(owner, path, { action: "next", revision: s.state.revision });
assert.equal(s.current.title, "Video as audio");
await request(
  friend,
  path,
  { action: "choice", trackId: first.current.id, response: "accepted" },
  "POST",
  409,
);
assert.ok(s.ownChoice.trackId !== s.current.id);
assert.equal(s.choices.length, 0);
ok(
  "A song change resets listening consent and old song responses are rejected",
);
await request(
  owner,
  "rooms/" + slug + "/members",
  { id: friend.id, action: "mute" },
  "PATCH",
);
await request(friend, path, {
  action: "choice",
  trackId: s.current.id,
  response: "accepted",
});
await request(
  friend,
  path,
  {
    action: "choice",
    trackId: s.current.id,
    response: "accepted",
    changeRequested: true,
  },
  "POST",
  403,
);
await request(
  friend,
  path,
  { action: "queue", attachmentId: video, title: "Restricted", duration: 40 },
  "POST",
  403,
);
await request(
  owner,
  "rooms/" + slug + "/members",
  { id: friend.id, action: "ban" },
  "PATCH",
);
await request(friend, path, undefined, "GET", 403);
s = await request(owner, path, {
  action: "seek",
  position: 40,
  revision: s.state.revision,
});
assert.equal(s.current, null);
assert.equal(s.state.playing, false);
ok(
  "Restrictions prevent music spam, bans revoke access, and completed sessions stop",
);
console.log("\n" + count + " music API integration checks passed.");
