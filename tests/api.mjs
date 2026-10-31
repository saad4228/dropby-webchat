import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
let count = 0;
const guest = () => ({ cookie: "", id: "" });
const owner = guest(),
  member = guest(),
  stranger = guest();
async function request(
  user,
  path,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
) {
  const r = await fetch(origin + "/api/" + path, {
    method,
    headers: {
      ...user.headers,
      ...(user.cookie ? { cookie: user.cookie } : {}),
      ...(body instanceof FormData
        ? {}
        : body
          ? { "Content-Type": "application/json" }
          : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (r.headers.get("set-cookie"))
    user.cookie = r.headers.get("set-cookie").split(";")[0];
  const json = await r.json();
  assert.equal(
    r.status,
    expected,
    `${method} ${path}: ${JSON.stringify(json)}`,
  );
  return json;
}
function ok(label) {
  count++;
  console.log(`PASS ${count} ${label}`);
}
for (const [u, name] of [
  [owner, "Test Owner"],
  [member, "Test Member"],
  [stranger, "Test Stranger"],
]) {
  const { user } = await request(u, "session", {
    name,
    avatar: "🌿",
    color: "#4b6bfa",
  });
  u.id = user.id;
  assert.ok(u.cookie);
}
ok("Independent HttpOnly guest identities");
const slug = "qa-" + randomUUID().slice(0, 8),
  priv = slug + "-private";
await request(
  owner,
  "rooms",
  { slug, visibility: "public", description: "QA room", password: "" },
  "POST",
  201,
);
ok("Create public room");
await request(member, "rooms/" + slug, undefined, "GET", 403);
ok("Reject message history before joining");
await request(member, "rooms/" + slug + "/join", {});
const s = await request(member, "rooms/" + slug);
assert.equal(s.members.length, 2);
assert.equal(s.messages.length, 0);
ok("Join an empty real room without sample members");
assert.equal(s.room.logo, "✳");
const logoForm = new FormData();
logoForm.append(
  "file",
  new File([readFileSync("public/stadium.jpg")], "room.jpg", {
    type: "image/jpeg",
  }),
);
await request(owner, "rooms/" + slug + "/logo", logoForm, "POST", 201);
assert.ok((await request(member, "rooms/" + slug)).room.logoImageId);
const logo = await fetch(origin + "/api/rooms/" + slug + "/logo", {
  headers: { cookie: member.cookie },
});
assert.equal(logo.status, 200);
assert.equal(logo.headers.get("content-type"), "image/jpeg");
ok("Room images persist and are visible to authorized members");
await request(member, "rooms/" + slug + "/logo", {}, "POST", 403);
const hiddenLogo = await fetch(origin + "/api/rooms/" + slug + "/logo", {
  headers: { cookie: stranger.cookie },
});
assert.equal(hiddenLogo.status, 403);
ok("Only owners change logos and non-members cannot retrieve them");
await request(member, "rooms", { slug, visibility: "public" }, "POST", 409);
ok("Prevent duplicate room creation");
await request(
  owner,
  "rooms",
  { slug: priv, visibility: "private", password: "room-pass-123" },
  "POST",
  201,
);
await request(stranger, "rooms/" + priv, undefined, "GET", 403);
await request(
  stranger,
  "rooms/" + priv + "/join",
  { password: "wrong" },
  "POST",
  403,
);
await request(stranger, "rooms/" + priv + "/join", {
  password: "room-pass-123",
});
ok("Private room password and metadata authorization");
const messageId = randomUUID();
await request(
  owner,
  "rooms/" + slug + "/messages",
  { id: messageId, text: "Hello from one browser 👋" },
  "POST",
  201,
);
await request(
  owner,
  "rooms/" + slug + "/messages",
  { id: messageId, text: "Hello from one browser 👋" },
  "POST",
  201,
);
const received = await request(member, "rooms/" + slug);
assert.equal(received.messages.length, 1);
assert.equal(received.messages[0].text, "Hello from one browser 👋");
ok("Persisted multi-user messaging and idempotent sends");
await request(
  member,
  "rooms/" + slug + "/messages/" + messageId,
  { text: "unauthorized" },
  "PATCH",
  403,
);
await request(
  member,
  "rooms/" + slug + "/messages/" + messageId,
  undefined,
  "DELETE",
  403,
);
ok("Reject unauthorized edits and deletion");
await request(
  owner,
  "rooms/" + slug + "/messages/" + messageId,
  { text: "Edited hello" },
  "PATCH",
);
assert.equal(
  (await request(member, "rooms/" + slug)).messages[0].text,
  "Edited hello",
);
ok("Synchronize edits");
await request(
  member,
  "rooms/" + slug + "/messages/" + messageId + "/reaction",
  { emoji: "❤️" },
);
assert.equal((await request(owner, "rooms/" + slug)).reactions.length, 1);
await request(
  member,
  "rooms/" + slug + "/messages/" + messageId + "/reaction",
  { emoji: "❤️" },
);
assert.equal((await request(owner, "rooms/" + slug)).reactions.length, 0);
ok("Add and remove synchronized reactions");
await request(
  member,
  "rooms/" + slug + "/messages/" + messageId + "/reaction",
  { emoji: "🦊" },
);
assert.ok(
  (await request(owner, "rooms/" + slug)).reactions.some(
    (r) => r.emoji === "🦊",
  ),
);
await request(
  member,
  "rooms/" + slug + "/messages/" + messageId + "/reaction",
  { emoji: "🦊" },
);
ok("Expanded emoji reactions synchronize");
await request(owner, "rooms/" + slug + "/messages/" + messageId + "/pin", {});
assert.equal((await request(member, "rooms/" + slug)).messages[0].pinned, 1);
ok("Moderator pins");
const replyId = randomUUID();
await request(
  member,
  "rooms/" + slug + "/messages",
  { id: replyId, text: "A real reply", replyId: messageId },
  "POST",
  201,
);
assert.equal(
  (await request(owner, "rooms/" + slug)).messages[1].replyId,
  messageId,
);
ok("Message replies");
await request(
  stranger,
  "rooms/" + priv + "/messages",
  { id: randomUUID(), text: "cross-room", replyId: messageId },
  "POST",
  400,
);
ok("Reject cross-room reply references");
const form = new FormData();
form.append(
  "file",
  new File(["A safe text document."], "hello.txt", { type: "text/plain" }),
);
const uploaded = await request(
  owner,
  "rooms/" + slug + "/upload",
  form,
  "POST",
  201,
);
await request(
  owner,
  "rooms/" + slug + "/messages",
  { id: randomUUID(), text: "", attachmentId: uploaded.attachment.id },
  "POST",
  201,
);
let media = await fetch(origin + "/api/media/" + uploaded.attachment.id, {
  headers: { cookie: member.cookie },
});
assert.equal(media.status, 200);
assert.equal(await media.text(), "A safe text document.");
media = await fetch(origin + "/api/media/" + uploaded.attachment.id, {
  headers: { cookie: stranger.cookie },
});
assert.equal(media.status, 403);
ok("Persistent media upload and private retrieval");
const partial = await fetch(origin + "/api/media/" + uploaded.attachment.id, {
  headers: { cookie: member.cookie, Range: "bytes=0-5" },
});
assert.equal(partial.status, 206);
assert.equal(await partial.text(), "A safe");
const invalidRange = await fetch(
  origin + "/api/media/" + uploaded.attachment.id,
  { headers: { cookie: member.cookie, Range: "bytes=9000-9999" } },
);
assert.equal(invalidRange.status, 416);
ok("Authorized byte-range playback and invalid-range handling");
const bad = new FormData();
bad.append(
  "file",
  new File(["<script>alert(1)</script>"], "bad.png", { type: "image/png" }),
);
await request(owner, "rooms/" + slug + "/upload", bad, "POST", 400);
ok("Reject file MIME spoofing");
await request(
  member,
  "rooms/" + slug + "/settings",
  { description: "hacked", theme: "forest", locked: true },
  "PATCH",
  403,
);
await request(
  owner,
  "rooms/" + slug + "/settings",
  { description: "Updated room", theme: "forest", locked: true },
  "PATCH",
);
assert.equal((await request(member, "rooms/" + slug)).room.theme, "forest");
await request(stranger, "rooms/" + slug + "/join", {}, "POST", 403);
ok("Owner-only settings, shared themes and room lock");
for (const theme of ["love", "football", "cosmic", "arcade"]) {
  await request(
    owner,
    "rooms/" + slug + "/settings",
    { description: "Updated room", theme, locked: true },
    "PATCH",
  );
  assert.equal((await request(member, "rooms/" + slug)).room.theme, theme);
}
await request(
  owner,
  "rooms/" + slug + "/settings",
  { description: "Updated room", theme: "unknown", locked: true },
  "PATCH",
  400,
);
assert.equal((await request(member, "rooms/" + slug)).room.theme, "arcade");
ok(
  "Expressive themes persist for other members and invalid presets are rejected",
);
await request(member, "rooms/" + slug + "/typing", {});
assert.ok(
  (await request(owner, "rooms/" + slug)).members.find(
    (m) => m.id === member.id,
  ).typingUntil > Date.now(),
);
ok("Typing and presence synchronization");
await request(owner, "rooms/" + slug + "/call", { active: true });
await request(member, "rooms/" + slug + "/call", { active: true });
await request(owner, "rooms/" + slug + "/signals", {
  recipientId: member.id,
  data: JSON.stringify({ type: "test" }),
});
assert.equal((await request(member, "rooms/" + slug)).signals.length, 1);
await request(owner, "rooms/" + slug + "/call", { active: false });
await request(member, "rooms/" + slug + "/call", { active: false });
ok("Authorized call presence and signaling");
await request(member, "rooms/" + slug + "/messages/" + messageId + "/report", {
  reason: "Test moderation report",
});
assert.equal(
  (await request(owner, "rooms/" + slug + "/reports")).reports.length,
  1,
);
await request(member, "rooms/" + slug + "/reports", undefined, "GET", 403);
ok("Private moderation reports");
await request(
  owner,
  "rooms/" + slug + "/members",
  { id: member.id, action: "mute" },
  "PATCH",
);
await request(
  member,
  "rooms/" + slug + "/messages",
  { id: randomUUID(), text: "muted" },
  "POST",
  403,
);
await request(
  owner,
  "rooms/" + slug + "/members",
  { id: member.id, action: "unmute" },
  "PATCH",
);
ok("Server-enforced messaging restrictions");
await request(
  owner,
  "rooms/" + slug + "/members",
  { id: member.id, action: "ban" },
  "PATCH",
);
await request(member, "rooms/" + slug, undefined, "GET", 403);
await request(member, "rooms/" + slug + "/join", {}, "POST", 403);
ok("Banned identities lose room access");
await request(
  owner,
  "rooms/" + slug + "/messages/" + messageId,
  undefined,
  "DELETE",
);
assert.ok(
  !(await request(owner, "rooms/" + slug)).messages.some(
    (m) => m.id === messageId,
  ),
);
ok("Message deletion persists");
const cross = await fetch(origin + "/api/rooms/" + slug + "/messages", {
  method: "POST",
  headers: {
    cookie: owner.cookie,
    Origin: "https://attacker.example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ id: randomUUID(), text: "CSRF" }),
});
assert.equal(cross.status, 403);
ok("Cross-origin mutations rejected");
const retainedId = randomUUID();
await request(
  owner,
  "rooms/" + priv + "/messages",
  { id: retainedId, text: "Keep this message after sign-out." },
  "POST",
  201,
);
assert.equal((await request(owner, "session")).user.id, owner.id);
await request(owner, "session", undefined, "DELETE");
await request(owner, "rooms/" + slug, undefined, "GET", 401);
ok("Session continuity and revocation");
assert.ok(
  (await request(stranger, "rooms/" + priv)).messages.some(
    (m) => m.id === retainedId,
  ),
);
ok("Signing out preserves authored message history");
// The portable starter simulates the real top-level sign-in route; it correctly
// strips arbitrary caller-supplied identity headers.
const account = guest();
await request(account, "session", {
  name: "Saved identity",
  avatar: "🦊",
  color: "#4b6bfa",
});
const guestCookie = account.cookie;
const signIn = await fetch(origin + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
assert.equal(signIn.status, 302);
const authCookie = signIn.headers.get("set-cookie").split(";")[0];
account.cookie = guestCookie + "; " + authCookie;
const linked = await request(account, "session");
assert.equal(linked.user.signedIn, true);
const another = { cookie: authCookie };
assert.equal((await request(another, "session")).user.id, linked.user.id);
ok("Optional account identity survives a new device session");
const spoofed = {
  cookie: "",
  headers: { "oai-authenticated-user-id": "spoofed-" + randomUUID() },
};
assert.equal((await request(spoofed, "session")).user, null);
ok("Unverified identity headers are stripped by the hosting boundary");
console.log(`\n${count} API integration checks passed.`);
