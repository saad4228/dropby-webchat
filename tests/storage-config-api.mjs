// Requires the isolated fixture with a missing key or invalid project URL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
const root = process.env.MEDIA_FIXTURE_ROOT;
assert(
  root &&
    path
      .resolve(root)
      .replaceAll("\\", "/")
      .endsWith("/outputs/media-fixture-project"),
);
const settings = readFileSync(path.join(root, ".dev.vars"), "utf8");
assert(
  /^SUPABASE_SERVICE_ROLE_KEY=\s*$/m.test(settings) ||
    /^SUPABASE_URL=invalid-storage-url$/m.test(settings),
);
const origin = process.env.TEST_ORIGIN || "http://localhost:5176";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
let cookie = "";
async function request(endpoint, body) {
  const response = await fetch(origin + "/api/" + endpoint, {
    method: "POST",
    headers: {
      cookie,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return response;
}
assert(
  (
    await request("session", {
      name: "Configuration check",
      avatar: "x",
      color: "#4b6bfa",
    })
  ).ok,
);
const slug = "storage-config-" + randomUUID().slice(0, 8);
assert.equal(
  (await request("rooms", { slug, visibility: "public" })).status,
  201,
);
const base = `rooms/${slug}`;
const file = new FormData();
file.set(
  "file",
  new File(["A test document"], "notes.txt", { type: "text/plain" }),
);
const logo = new FormData();
logo.set(
  "file",
  new File([readFileSync("public/stadium.jpg")], "logo.jpg", {
    type: "image/jpeg",
  }),
);
for (const [endpoint, body] of [
  [
    base + "/uploads",
    { id: randomUUID(), name: "notes.txt", mime: "text/plain", size: 10 },
  ],
  [base + "/upload", file],
  [base + "/logo", logo],
]) {
  const response = await request(endpoint, body);
  assert.equal(response.status, 503);
  assert.match(
    (await response.json()).error,
    /(not configured|project URL is invalid).*Text chat still works/i,
  );
}
assert.equal(
  (
    await request(base + "/messages", {
      id: randomUUID(),
      text: "Text still works with storage unavailable",
    })
  ).status,
  201,
);
console.log(
  "PASS Missing/invalid Supabase settings reject all upload paths clearly while text chat remains available.",
);
