import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
let count = 0;
const owner = {},
  member = {},
  outsider = {};
async function request(
  user,
  path,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
) {
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
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
const ok = (label) => console.log(`PASS ${++count} ${label}`);
for (const [user, name] of [
  [owner, "Clear Owner"],
  [member, "Clear Member"],
  [outsider, "Clear Outsider"],
]) {
  user.id = (
    await request(user, "session", { name, avatar: "🌿", color: "#4b6bfa" })
  ).user.id;
}
const slug = "clear-api-" + Date.now(),
  other = slug + "-other";
for (const room of [slug, other]) {
  await request(
    owner,
    "rooms",
    { slug: room, visibility: "public" },
    "POST",
    201,
  );
  await request(member, `rooms/${room}/join`, {});
}
await request({}, `rooms/${slug}/messages`, undefined, "DELETE", 401);
await request(outsider, `rooms/${slug}/messages`, undefined, "DELETE", 403);
ok("Only authenticated room members can clear authored messages");
const keep = randomUUID(),
  mine = randomUUID(),
  elsewhere = randomUUID();
await request(
  owner,
  `rooms/${slug}/messages`,
  { id: keep, text: "Owner keeps this" },
  "POST",
  201,
);
await request(
  member,
  `rooms/${slug}/messages`,
  { id: mine, text: "Member clears this" },
  "POST",
  201,
);
await request(
  member,
  `rooms/${other}/messages`,
  { id: elsewhere, text: "Another room stays intact" },
  "POST",
  201,
);
await request(
  member,
  `rooms/${slug}/messages/${mine}`,
  { text: "Edited member message" },
  "PATCH",
);
await request(owner, `rooms/${slug}/messages/${mine}/pin`, {});
await request(owner, `rooms/${slug}/messages/${mine}/reaction`, {
  emoji: "❤️",
});
const file = new FormData();
file.append(
  "file",
  new File([readFileSync("public/stadium.jpg")], "clear-photo.jpg", {
    type: "image/jpeg",
  }),
);
const uploaded = await request(
  member,
  `rooms/${slug}/upload`,
  file,
  "POST",
  201,
);
const photo = randomUUID();
const voiceFile = new FormData();
voiceFile.append(
  "file",
  new File([readFileSync("tests/fixtures/radio-tone.mp3")], "chat-voice.mp3", {
    type: "audio/mpeg",
  }),
);
const voiceId = (
  await request(member, `rooms/${slug}/upload`, voiceFile, "POST", 201)
).attachment.id;
await request(
  member,
  `rooms/${slug}/messages`,
  { id: randomUUID(), text: "My chat audio", attachmentId: voiceId },
  "POST",
  201,
);
const songFile = new FormData();
songFile.append(
  "file",
  new File([readFileSync("tests/fixtures/radio-tone.mp3")], "shared-song.mp3", {
    type: "audio/mpeg",
  }),
);
const song = (
  await request(member, `rooms/${slug}/upload`, songFile, "POST", 201)
).attachment.id;
await request(member, `rooms/${slug}/music`, {
  action: "queue",
  attachmentId: song,
  title: "Keep the room soundtrack",
  duration: 45,
});
await request(
  member,
  `rooms/${slug}/messages`,
  { id: photo, text: "Clear photo", attachmentId: uploaded.attachment.id },
  "POST",
  201,
);
const crossed = await fetch(`${origin}/api/rooms/${slug}/messages`, {
  method: "DELETE",
  headers: { cookie: member.cookie, Origin: "https://attacker.example" },
});
assert.equal(crossed.status, 403);
ok("Cross-origin bulk deletion is rejected");
// Forged sender input cannot select somebody else's messages.
const erased = await request(
  member,
  `rooms/${slug}/messages`,
  { senderId: owner.id },
  "DELETE",
);
assert.equal(erased.deleted, 3);
assert.equal(erased.cleanupPending, false);
const snapshot = await request(owner, `rooms/${slug}?historyFrom=0`);
assert.deepEqual(
  snapshot.messages.map((m) => m.id),
  [keep],
);
assert.equal(snapshot.reactions.length, 0);
assert.ok(snapshot.deletedMessageIds.includes(mine));
assert.ok(snapshot.deletedMessageIds.includes(photo));
assert.equal(snapshot.historyReset, false);
const acknowledged = await request(
  owner,
  `rooms/${slug}?historyFrom=0&deletedVersion=${snapshot.deletedVersion}`,
);
assert.deepEqual(acknowledged.deletedMessageIds, []);
assert.equal(acknowledged.historyReset, false);
ok(
  "Bulk deletion is restricted to the current author and clears pins/reactions from snapshots",
);
assert.ok(
  (await request(member, `rooms/${other}`)).messages.some(
    (m) => m.id === elsewhere,
  ),
);
ok("The same person's messages in other rooms stay intact");
const media = await fetch(`${origin}/api/media/${uploaded.attachment.id}`, {
  headers: { cookie: owner.cookie },
});
assert.equal(media.status, 404);
assert.equal(
  (
    await fetch(`${origin}/api/media/${voiceId}`, {
      headers: { cookie: owner.cookie },
    })
  ).status,
  404,
);
ok("Deleted chat attachments are no longer downloadable");
assert.equal(
  (await request(owner, `rooms/${slug}/music`)).current.attachmentId,
  song,
);
assert.equal(
  (
    await fetch(`${origin}/api/media/${song}`, {
      headers: { cookie: owner.cookie },
    })
  ).status,
  200,
);
ok("Clearing chat messages preserves the shared music player and its media");
await request(
  member,
  `rooms/${slug}/messages`,
  { id: mine, text: "A replay must not resurrect deleted text" },
  "POST",
  201,
);
assert.equal(
  (await request(member, `rooms/${slug}`)).messages.some((m) => m.id === mine),
  false,
);
assert.equal(
  (await request(member, `rooms/${slug}/messages`, undefined, "DELETE"))
    .deleted,
  0,
);
ok("Retries and old message IDs do not resurrect deleted history");
const fresh = randomUUID();
await request(
  member,
  `rooms/${slug}/messages`,
  { id: fresh, text: "A fresh conversation" },
  "POST",
  201,
);
assert.ok(
  (await request(owner, `rooms/${slug}`)).messages.some((m) => m.id === fresh),
);
await request(
  owner,
  `rooms/${slug}/members`,
  { id: member.id, action: "mute" },
  "PATCH",
);
assert.equal(
  (await request(member, `rooms/${slug}/messages`, undefined, "DELETE"))
    .deleted,
  1,
);
ok(
  "Members can send again after clearing, and muted members can still delete their own history",
);
await request(
  owner,
  `rooms/${slug}/members`,
  { id: member.id, action: "ban" },
  "PATCH",
);
await request(member, `rooms/${slug}/messages`, undefined, "DELETE", 403);
await request(owner, `rooms/${slug}?historyFrom=-1`, undefined, "GET", 400);
ok("Bans and history boundary validation remain enforced");
console.log(`\n${count} deletion API checks passed.`);
