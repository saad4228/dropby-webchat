import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
function findDatabase(dir: string): string | undefined {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) {
      const found = findDatabase(p);
      if (found) return found;
    } else if (p.endsWith(".sqlite")) return p;
  }
}
function seedFixture(sql: string, fixturePath: string) {
  const root = process.env.MEDIA_FIXTURE_ROOT;
  if (root) {
    expect(
      path
        .resolve(root)
        .replaceAll("\\", "/")
        .endsWith("/outputs/media-fixture-project"),
    ).toBe(true);
    const db = new DatabaseSync(
      findDatabase(path.join(root, ".wrangler/state/v3/d1"))!,
    );
    try {
      db.exec("PRAGMA busy_timeout=10000");
      db.exec(sql);
    } finally {
      db.close();
    }
    return;
  }
  writeFileSync(fixturePath, sql);
  execFileSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--file",
      fixturePath,
    ],
    { stdio: "pipe" },
  );
}

test("Any member can confirm clearing all their messages, including cached older history and uploads", async ({
  page,
  browser,
}) => {
  test.setTimeout(80000);
  const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
  test.skip(
    !["localhost", "127.0.0.1"].includes(new URL(origin).hostname),
    "The pagination fixture is local-only.",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const slug = "clear-browser-" + Date.now();
  const ownerResponse = await page.request.post("/api/session", {
    data: { name: "History Owner", avatar: "🌿", color: "#4b6bfa" },
  });
  expect(ownerResponse.ok(), await ownerResponse.text()).toBe(true);
  const owner = (await ownerResponse.json()).user;
  const roomResponse = await page.request.post("/api/rooms", {
    data: { slug, visibility: "public" },
  });
  expect(roomResponse.status()).toBe(201);
  const room = (await roomResponse.json()).room;
  const context = await browser.newContext({ baseURL: origin });
  const friend = await context.newPage();
  friend.on("pageerror", (e) => errors.push(e.message));
  const memberResponse = await friend.request.post("/api/session", {
    data: { name: "History Member", avatar: "🦊", color: "#4b6bfa" },
  });
  expect(memberResponse.ok(), await memberResponse.text()).toBe(true);
  const member = (await memberResponse.json()).user;
  expect(
    (await friend.request.post(`/api/rooms/${slug}/join`, { data: {} })).ok(),
  ).toBe(true);

  // Seed only this local test room to exercise >100 messages without bypassing
  // or weakening the production API's message rate limit.
  const rows = Array.from({ length: 110 }, (_, i) => ({
    id: randomUUID(),
    sender: i % 2 ? owner.id : member.id,
    text: i % 2 ? `Keep this ${i}` : `Remove mine ${i}`,
    created: Date.now() - 300000 + i * 10,
  }));
  const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
  const sql =
    "INSERT INTO messages(id,roomId,senderId,text,created) VALUES " +
    rows
      .map(
        (r) =>
          `(${quote(r.id)},${quote(room.id)},${quote(r.sender)},${quote(r.text)},${r.created})`,
      )
      .join(",") +
    ";";
  const fixturePath = path.resolve("outputs", slug + ".sql");
  seedFixture(sql, fixturePath);
  const uploadResponse = await friend.request.post(
    `/api/rooms/${slug}/upload`,
    {
      multipart: {
        file: {
          name: "clear-me.jpg",
          mimeType: "image/jpeg",
          buffer: readFileSync("public/stadium.jpg"),
        },
      },
    },
  );
  expect(uploadResponse.status()).toBe(201);
  const attachment = (await uploadResponse.json()).attachment;
  const photoId = randomUUID();
  expect(
    (
      await friend.request.post(`/api/rooms/${slug}/messages`, {
        data: {
          id: photoId,
          text: "My attached photo",
          attachmentId: attachment.id,
        },
      })
    ).status(),
  ).toBe(201);
  await Promise.all([
    page.goto(`/?room=${slug}`),
    friend.goto(`/?room=${slug}`),
  ]);
  for (const p of [page, friend]) {
    await p
      .getByRole("button", { name: "A little further back", exact: true })
      .click();
    await expect(p.locator(`#message-${rows[0].id}`)).toHaveCount(1);
    await expect(p.locator(`#message-${rows[1].id}`)).toHaveCount(1);
  }
  await page.locator(`#message-${photoId} .image-message`).click();
  await expect(page.locator(".media-viewer")).toBeVisible();
  await friend
    .getByRole("button", { name: "More room options", exact: true })
    .click();
  await friend
    .getByRole("button", { name: "Delete all my messages", exact: true })
    .click();
  await expect(
    friend.getByRole("heading", { name: "Delete all your messages?" }),
  ).toBeVisible();
  await expect(
    friend.getByRole("button", { name: "Keep my messages" }),
  ).toBeFocused();
  await friend.getByRole("button", { name: "Keep my messages" }).click();
  await expect(friend.locator(`#message-${rows[0].id}`)).toHaveCount(1);
  await friend
    .getByRole("button", { name: "Delete all my messages", exact: true })
    .click();
  await friend.screenshot({
    path: "outputs/delete-messages-confirmation.png",
    animations: "disabled",
  });
  await friend
    .getByRole("button", { name: "Delete my messages", exact: true })
    .click();
  await expect(
    friend.getByRole("heading", { name: "Delete all your messages?" }),
  ).toHaveCount(0);
  for (const p of [page, friend]) {
    await expect(p.locator(`#message-${rows[0].id}`)).toHaveCount(0);
    await expect(p.locator(`#message-${photoId}`)).toHaveCount(0);
    await expect(p.locator(`#message-${rows[1].id}`)).toHaveCount(1);
    await expect(p.locator(".message-row")).toHaveCount(55);
  }
  await expect(page.locator(".media-viewer")).toHaveCount(0);
  expect((await page.request.get(`/api/media/${attachment.id}`)).status()).toBe(
    404,
  );
  await friend
    .getByRole("textbox", { name: "Your message" })
    .fill("A fresh start after clearing");
  await friend
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(
    page.getByText("A fresh start after clearing", { exact: true }),
  ).toBeVisible();
  await friend.reload();
  await expect(
    friend.getByText("A fresh start after clearing", { exact: true }),
  ).toBeVisible();
  await expect(friend.locator(`#message-${rows[0].id}`)).toHaveCount(0);
  // A very large deletion invalidates the cached window once. Acknowledging
  // its version must allow older-history loading on subsequent polls.
  const tombstones = Array.from(
    { length: 1001 },
    (_, i) =>
      `(${quote(randomUUID())},${quote(room.id)},${quote(member.id)},'',${Date.now() - 120000 + i},1)`,
  );
  const chunks = [];
  for (let i = 0; i < tombstones.length; i += 200)
    chunks.push(
      "INSERT INTO messages(id,roomId,senderId,text,created,deleted) VALUES " +
        tombstones.slice(i, i + 200).join(",") +
        ";",
    );
  seedFixture(chunks.join("\n"), fixturePath);
  const large = await (
    await page.request.get(`/api/rooms/${slug}?historyFrom=0`)
  ).json();
  expect(large.historyReset).toBe(true);
  expect(large.deletedMessageIds).toHaveLength(1000);
  const ack = await (
    await page.request.get(
      `/api/rooms/${slug}?historyFrom=0&deletedVersion=${large.deletedVersion}`,
    )
  ).json();
  expect(ack.historyReset).toBe(false);
  expect(ack.deletedMessageIds).toHaveLength(0);
  await expect(page.locator(".message-row")).toHaveCount(56);
  await expect(friend.locator(".message-row")).toHaveCount(56);
  expect(errors).toEqual([]);
  await context.close();
});
