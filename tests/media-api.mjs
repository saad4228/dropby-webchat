import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin = process.env.TEST_ORIGIN || "http://localhost:5174";
const owner = { cookie: "" },
  friend = { cookie: "" },
  outsider = { cookie: "" };
let count = 0;
const room = "media-check-" + randomUUID().slice(0, 8),
  assets = [];
async function request(
  user,
  path,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
  extra = {},
) {
  const response = await fetch(origin + "/api/" + path, {
    method,
    headers: {
      ...(user.cookie ? { cookie: user.cookie } : {}),
      ...(body && !(body instanceof Uint8Array)
        ? { "Content-Type": "application/json" }
        : {}),
      ...extra,
    },
    body:
      body instanceof Uint8Array
        ? body
        : body
          ? JSON.stringify(body)
          : undefined,
  });
  const cookie = response.headers.get("set-cookie");
  if (cookie) user.cookie = cookie.split(";")[0];
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${response.status} ${expected >= 400 ? "" : await response.clone().text()}`,
  );
  return response;
}
function pass(label) {
  console.log(`PASS ${++count} ${label}`);
}
async function start(name, mime, size, purpose = "chat", extra = {}) {
  const id = randomUUID();
  const response = await request(
    owner,
    `rooms/${room}/uploads`,
    { id, name, mime, size, purpose, ...extra },
    "POST",
    201,
  );
  assets.push(id);
  return response.json();
}
async function small(name, mime, bytes, purpose = "chat", extra = {}) {
  const lease = await start(name, mime, bytes.length, purpose, extra);
  await request(
    owner,
    `rooms/${room}/uploads/${lease.id}/content`,
    bytes,
    "POST",
    200,
    { "Content-Type": mime },
  );
  const completed = await Promise.all(
    [0, 1].map(() =>
      request(owner, `rooms/${room}/uploads/${lease.id}/complete`, {}),
    ),
  );
  return (await completed[0].json()).attachment;
}
try {
  for (const [user, name] of [
    [owner, "Media QA"],
    [friend, "Media Friend"],
    [outsider, "Media Outsider"],
  ]) {
    const response = await request(user, "session", {
      name,
      avatar: "x",
      color: "#4b6bfa",
    });
    user.id = (await response.json()).user.id;
  }
  await request(
    owner,
    "rooms",
    { slug: room, visibility: "private", password: "media-test-password" },
    "POST",
    201,
  );
  await request(friend, `rooms/${room}/join`, {
    password: "media-test-password",
  });
  await request(
    outsider,
    `rooms/${room}/uploads`,
    { id: randomUUID(), name: "x.txt", mime: "text/plain", size: 1 },
    "POST",
    403,
  );
  pass("Only room members can reserve media");
  await request(
    owner,
    `rooms/${room}/uploads`,
    {
      id: randomUUID(),
      name: "oversize.png",
      mime: "image/png",
      size: 8 * 1024 * 1024 + 1,
    },
    "POST",
    413,
  );
  await request(
    owner,
    `rooms/${room}/uploads`,
    { id: randomUUID(), name: "bad.svg", mime: "image/svg+xml", size: 10 },
    "POST",
    400,
  );
  pass(
    "The backend independently enforces type-specific caps and MIME allowlists",
  );
  const text = new TextEncoder().encode(
    "A small document from the DropBy media integration check.",
  );
  const file = await small("notes.txt", "text/plain", text);
  await request(outsider, "media/" + file.id, undefined, "GET", 403);
  await request(friend, "media/" + file.id, undefined, "GET", 404);
  const id = randomUUID();
  await request(
    owner,
    `rooms/${room}/messages`,
    { id, text: "A private document", attachmentId: file.id },
    "POST",
    201,
  );
  assert.equal(
    await (await request(friend, "media/" + file.id)).text(),
    new TextDecoder().decode(text),
  );
  pass(
    "Drafts are private to their uploader; sent attachments persist and are shared with joined members",
  );
  const etag = (await request(owner, "media/" + file.id)).headers.get("etag");
  await request(owner, "media/" + file.id, undefined, "GET", 304, {
    "If-None-Match": etag,
  });
  pass("Authorized conditional requests avoid duplicate file transfers");
  const gif = Uint8Array.from(
    Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64",
    ),
  );
  const picture = await small("animation.gif", "image/gif", gif);
  assert.deepEqual(
    new Uint8Array(
      await (await request(owner, "media/" + picture.id)).arrayBuffer(),
    ),
    gif,
  );
  pass("GIF bytes are preserved rather than flattened");
  const wallpaper = await small(
    "test-wallpaper.gif",
    "image/gif",
    gif,
    "wallpaper",
  );
  await request(owner, "media/" + wallpaper.id);
  await request(friend, "media/" + wallpaper.id, undefined, "GET", 403);
  const bad = await start("spoof.png", "image/png", 4);
  await request(
    owner,
    `rooms/${room}/uploads/${bad.id}/content`,
    new Uint8Array([1, 2, 3, 4]),
    "POST",
    400,
    { "Content-Type": "image/png" },
  );
  pass(
    "Content signatures are checked independently of the filename and declared MIME",
  );
  const large = new Uint8Array(7 * 1024 * 1024).fill(65),
    lease = await start("resumable.txt", "text/plain", large.length);
  assert.equal(lease.resumable, true);
  const created = await request(
    owner,
    `rooms/${room}/uploads/${lease.id}/tus`,
    undefined,
    "POST",
    201,
    { "Tus-Resumable": "1.0.0", "Upload-Length": String(large.length) },
  );
  assert.equal(new URL(created.headers.get("location")).origin, origin);
  const base = `rooms/${room}/uploads/${lease.id}/tus`,
    chunk = 6 * 1024 * 1024;
  await request(owner, base, large.slice(0, chunk), "PATCH", 204, {
    "Tus-Resumable": "1.0.0",
    "Upload-Offset": "0",
    "Content-Type": "application/offset+octet-stream",
  });
  const head = await request(owner, base, undefined, "HEAD", 200, {
    "Tus-Resumable": "1.0.0",
  });
  assert.equal(Number(head.headers.get("upload-offset")), chunk);
  await request(owner, base, large.slice(chunk), "PATCH", 204, {
    "Tus-Resumable": "1.0.0",
    "Upload-Offset": String(chunk),
    "Content-Type": "application/offset+octet-stream",
  });
  const completed = (
    await (
      await request(owner, `rooms/${room}/uploads/${lease.id}/complete`, {})
    ).json()
  ).attachment;
  assert.equal(completed.size, large.length);
  pass(
    "A real Supabase TUS transfer resumes from the acknowledged offset and finalizes verified metadata",
  );
  const range = await request(
    owner,
    "media/" + lease.id,
    undefined,
    "GET",
    206,
    { Range: "bytes=0-15" },
  );
  assert.equal((await range.arrayBuffer()).byteLength, 16);
  pass("Media ranges stream only the requested bytes");
  const signed = await (
    await request(owner, "media/" + file.id + "/url")
  ).json();
  assert(
    signed.url.startsWith("https://") ||
      signed.url.startsWith("http://127.0.0.1"),
  );
  assert.equal(signed.expiresIn, 60);
  const signedResponse = await fetch(signed.url);
  assert.equal(signedResponse.status, 200);
  assert.equal(await signedResponse.text(), new TextDecoder().decode(text));
  const repeatedSigned = await fetch(signed.url);
  assert.equal(repeatedSigned.status, 200);
  await repeatedSigned.arrayBuffer();
  console.log(
    "Signed storage header observations (not a bandwidth measurement):",
    JSON.stringify({
      cacheControl: repeatedSigned.headers.get("cache-control"),
      cacheStatus: repeatedSigned.headers.get("cf-cache-status"),
      age: repeatedSigned.headers.get("age"),
    }),
  );
  const unsigned = new URL(signed.url);
  unsigned.search = "";
  assert.equal((await fetch(unsigned)).ok, false);
  await request(outsider, "media/" + file.id + "/url", undefined, "GET", 403);
  pass("Temporary private URLs require room access");
  await request(friend, "storage", undefined, "GET", 403);
  pass("Room members cannot inspect application-wide storage administration");
  await request(owner, `rooms/${room}/messages/${id}`, undefined, "DELETE");
  await request(owner, "media/" + file.id, undefined, "GET", 404);
  pass("Deleting an attachment revokes access for every participant");
  const snapshot = await (await request(friend, `rooms/${room}`)).json();
  assert.equal(snapshot.messages.length, 0);
  pass("Conversation refresh reconciles deleted content");
} finally {
  if (owner.cookie) {
    await request(owner, `rooms/${room}/messages`, undefined, "DELETE").catch(
      () => {},
    );
    for (const id of assets)
      await request(
        owner,
        `rooms/${room}/uploads/${id}`,
        undefined,
        "DELETE",
      ).catch(() => {});
  }
}
console.log(`Media API verification: ${count} checks passed.`);
