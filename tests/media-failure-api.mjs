// Run ONLY against outputs/media-fixture-project and tests/media-storage-fixture.mjs.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
const root = process.env.MEDIA_FIXTURE_ROOT;
assert(
  root &&
    path
      .resolve(root)
      .replaceAll("\\", "/")
      .endsWith("/outputs/media-fixture-project"),
  "Explicit isolated MEDIA_FIXTURE_ROOT required",
);
function findSqlite(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) {
      const found = findSqlite(file);
      if (found) return found;
    } else if (file.endsWith(".sqlite")) return file;
  }
}
const db = new DatabaseSync(
  findSqlite(path.join(root, ".wrangler/state/v3/d1")),
);
db.exec("PRAGMA busy_timeout=10000");
db.exec("DELETE FROM media_alerts; DELETE FROM rate_limits"); // This database is an explicitly isolated fixture.
const token = "fixture-token-local-only",
  owner = { cookie: "dropby_session=" + token };
db.prepare(
  "INSERT OR REPLACE INTO sessions (id,tokenHash,name,avatar,color,expires) VALUES (?,?,?,?,?,?)",
).run(
  "media-fixture-admin",
  createHash("sha256").update(token).digest("hex"),
  "Storage administrator",
  "x",
  "#4b6bfa",
  Date.now() + 86400000,
);
const origin = process.env.TEST_ORIGIN || "http://localhost:5176";
let count = 0;
const slug = "storage-fixture-" + randomUUID().slice(0, 8);
const bytes = new TextEncoder().encode("A controlled storage test fixture.");
async function call(
  pathname,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
  cookie = owner.cookie,
) {
  const r = await fetch(origin + "/api/" + pathname, {
    method,
    headers: {
      cookie,
      ...(body instanceof Uint8Array
        ? { "Content-Type": "text/plain" }
        : body
          ? { "Content-Type": "application/json" }
          : {}),
    },
    body:
      body instanceof Uint8Array
        ? body
        : body
          ? JSON.stringify(body)
          : undefined,
  });
  assert.equal(
    r.status,
    expected,
    `${pathname}: ${r.status} ${await r.clone().text()}`,
  );
  return r;
}
const data = async (...args) => (await call(...args)).json();
const usage = () => data("storage");
const pass = (label) => console.log(`PASS ${++count} ${label}`);
async function init(size = bytes.length) {
  const id = randomUUID();
  await call(
    `rooms/${slug}/uploads`,
    { id, name: "fixture.txt", mime: "text/plain", size, purpose: "chat" },
    "POST",
    201,
  );
  return id;
}
async function upload() {
  const id = await init();
  await call(`rooms/${slug}/uploads/${id}/content`, bytes);
  await Promise.all(
    [0, 1].map(() => call(`rooms/${slug}/uploads/${id}/complete`, {})),
  );
  return id;
}
let browser;
try {
  await call(
    "rooms",
    { slug, visibility: "public", password: "" },
    "POST",
    201,
  );
  const initial = await usage();
  const file = await init();
  assert.equal((await usage()).reserved, initial.reserved + bytes.length);
  await call(`rooms/${slug}/uploads/${file}/content`, bytes);
  await call(`rooms/${slug}/uploads/${file}/complete`, {});
  assert.equal((await usage()).used, initial.used + bytes.length);
  assert.equal((await usage()).reserved, initial.reserved);
  pass("Storage accounting moves a reservation to verified bytes exactly once");
  const message = randomUUID();
  await call(
    `rooms/${slug}/messages`,
    {
      id: message,
      text: "Retained until explicitly deleted",
      attachmentId: file,
    },
    "POST",
    201,
  );
  await fetch("http://127.0.0.1:7799/__fixture", {
    method: "POST",
    body: JSON.stringify({ failDelete: true }),
  });
  const removed = await data(
    `rooms/${slug}/messages/${message}`,
    undefined,
    "DELETE",
  );
  assert.equal(removed.cleanupPending, true);
  assert.equal((await usage()).used, initial.used + bytes.length);
  assert.equal(
    db.prepare("SELECT state FROM attachments WHERE id=?").get(file).state,
    "deleting",
  );
  await call("media/" + file, undefined, "GET", 404);
  pass(
    "A provider deletion failure revokes access but keeps retryable metadata and counted bytes",
  );
  await fetch("http://127.0.0.1:7799/__fixture", {
    method: "POST",
    body: JSON.stringify({ failDelete: false }),
  });
  await call("storage", { action: "cleanup" });
  assert.equal((await usage()).used, initial.used);
  assert.equal(
    db.prepare("SELECT state FROM attachments WHERE id=?").get(file).state,
    "deleted",
  );
  pass(
    "Explicit retry confirms storage absence before releasing accounted bytes",
  );
  const beforeIncomplete = await usage(),
    incomplete = await init();
  await fetch("http://127.0.0.1:7799/__fixture", {
    method: "POST",
    body: JSON.stringify({ failDelete: true }),
  });
  await call(`rooms/${slug}/uploads/${incomplete}`, undefined, "DELETE");
  db.prepare("UPDATE attachments SET deletedAt=? WHERE id=?").run(
    Date.now() - 660000,
    incomplete,
  );
  await call("storage", { action: "cleanup" });
  const pendingIncomplete = await usage();
  assert.equal(
    pendingIncomplete.used + pendingIncomplete.reserved,
    beforeIncomplete.used + beforeIncomplete.reserved + bytes.length,
  );
  await fetch("http://127.0.0.1:7799/__fixture", {
    method: "POST",
    body: JSON.stringify({ failDelete: false }),
  });
  await call("storage", { action: "cleanup" });
  assert.equal((await usage()).used, beforeIncomplete.used);
  pass(
    "Failed cleanup of an unfinished upload retains its full reserved bytes until absence is confirmed",
  );
  const baseline = await usage(),
    room = db.prepare("SELECT id FROM rooms WHERE slug=?").get(slug);
  db.prepare(
    "INSERT INTO attachments (id,roomId,senderId,name,mime,size,created,provider,storagePath,state) VALUES ('quota-fixture',?,'media-fixture-admin','quota fixture','text/plain',?,?,'supabase','quota-fixture','attached')",
  ).run(
    room.id,
    baseline.limit - baseline.used - baseline.reserved - 15_000_000,
    Date.now(),
  );
  const ids = [randomUUID(), randomUUID()];
  const results = await Promise.all(
    ids.map((id) =>
      fetch(origin + `/api/rooms/${slug}/uploads`, {
        method: "POST",
        headers: { cookie: owner.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: "concurrent.txt",
          mime: "text/plain",
          size: 10 * 1024 * 1024,
          purpose: "chat",
        }),
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 507]);
  const critical = await usage();
  assert(critical.used + critical.reserved <= critical.limit);
  assert.equal(critical.level, "critical");
  assert.deepEqual(
    critical.notifications.map((n) => n.threshold).sort(),
    [70, 85, 95],
  );
  pass(
    "Concurrent reservations cannot exceed the budget; all configured warning thresholds are recorded",
  );
  await call(
    `rooms/${slug}/messages`,
    { id: randomUUID(), text: "Text still works at the media budget" },
    "POST",
    201,
  );
  const guest = await fetch(origin + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ordinary member",
      avatar: "x",
      color: "#4b6bfa",
    }),
  });
  await call(
    "storage",
    undefined,
    "GET",
    403,
    guest.headers.get("set-cookie").split(";")[0],
  );
  pass(
    "Quota protection preserves text messaging and restricts global administration",
  );
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
  });
  await page.context().addCookies([
    {
      name: "dropby_session",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(origin + "/?room=" + slug);
  await page
    .getByRole("button", { name: "More room options", exact: true })
    .click();
  await page.getByRole("button", { name: /Media storage/ }).click();
  await expect(page.getByText("A little room to grow.")).toBeVisible();
  await expect(page.getByText(/Media usage reached 95%/)).toBeVisible();
  await page.screenshot({
    path: "outputs/storage-admin-light.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Change room appearance", exact: true })
    .click();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "More room options", exact: true })
    .click();
  await page.getByRole("button", { name: /Media storage/ }).click();
  await expect(page.getByText("A little room to grow.")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Estimated storage usage" }),
  ).toBeVisible();
  await page.screenshot({
    path: "outputs/storage-admin-mobile-dark.png",
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await browser.close();
  browser = null;
  pass(
    "Administrator warnings and estimated usage remain readable on desktop, mobile and dark mode",
  );
  db.prepare("DELETE FROM attachments WHERE id='quota-fixture'").run();
  for (const id of ids)
    if (db.prepare("SELECT id FROM attachments WHERE id=?").get(id)) {
      await call(`rooms/${slug}/uploads/${id}`, undefined, "DELETE");
      db.prepare("UPDATE attachments SET deletedAt=? WHERE id=?").run(
        Date.now() - 600001,
        id,
      );
    }
  await call("storage", { action: "cleanup" });
  assert((await usage()).reserved <= initial.reserved);
  for (const id of ids) {
    const row = db
      .prepare("SELECT state,expectedSize FROM attachments WHERE id=?")
      .get(id);
    if (row) {
      assert.equal(row.state, "deleted");
      assert.equal(row.expectedSize, 0);
    }
  }
  pass(
    "Cancelled reservations are released after the documented safety interval and cleanup",
  );
  const draft = await upload();
  db.prepare("UPDATE attachments SET created=? WHERE id=?").run(
    Date.now() - 49 * 3600000,
    draft,
  );
  const kept = await upload(),
    keptMessage = randomUUID();
  await call(
    `rooms/${slug}/messages`,
    {
      id: keptMessage,
      text: "An active file must survive cleanup",
      attachmentId: kept,
    },
    "POST",
    201,
  );
  db.prepare("UPDATE attachments SET created=? WHERE id=?").run(
    Date.now() - 49 * 3600000,
    kept,
  );
  await call("storage", { action: "cleanup" });
  await call("media/" + draft, undefined, "GET", 404);
  await call("media/" + kept);
  pass(
    "Cleanup removes abandoned drafts while preserving referenced conversations",
  );
  for (let i = 0; i < 6; i++) {
    const attachment = await upload(),
      id = randomUUID();
    const [sent, cancelled] = await Promise.all([
      fetch(origin + `/api/rooms/${slug}/messages`, {
        method: "POST",
        headers: { cookie: owner.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          text: "Race fixture",
          attachmentId: attachment,
        }),
      }),
      fetch(origin + `/api/rooms/${slug}/uploads/${attachment}`, {
        method: "DELETE",
        headers: { cookie: owner.cookie },
      }),
    ]);
    assert([201, 409, 400].includes(sent.status));
    assert([200, 409].includes(cancelled.status));
    const exists = db.prepare("SELECT id FROM messages WHERE id=?").get(id);
    if (exists) {
      assert.equal(sent.status, 201);
      await call("media/" + attachment);
    }
  }
  pass(
    "Racing publication and cancellation never leaves a live message referencing a cancelled file",
  );
  await call("storage", { action: "acknowledge" });
  assert.equal((await usage()).notifications.length, 0);
  pass("Administrator warning acknowledgement persists");
} finally {
  await browser?.close();
  await fetch("http://127.0.0.1:7799/__fixture", {
    method: "POST",
    body: JSON.stringify({ failDelete: false }),
  }).catch(() => {});
  db.prepare("DELETE FROM attachments WHERE id='quota-fixture'").run();
  await call(`rooms/${slug}/messages`, undefined, "DELETE").catch(() => {});
  db.close();
}
console.log(`Storage failure/quota verification: ${count} checks passed.`);
