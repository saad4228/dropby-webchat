import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID, randomFillSync } from "node:crypto";
import sharp from "sharp";
type Attachment = {
  id: string;
  fileMime: string;
  fileSize: number;
  thumbnailId?: string;
  duration?: number;
  waveform?: string;
  purpose?: string;
};
async function setup(page: Page) {
  if (process.env.MEDIA_MOBILE === "1")
    await page.setViewportSize({ width: 390, height: 844 });
  const slug = "smart-media-" + randomUUID().slice(0, 8);
  expect(
    (
      await page.request.post("/api/session", {
        data: { name: "Media Browser", avatar: "🌿", color: "#4b6bfa" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.post("/api/rooms", {
        data: { slug, visibility: "public", password: "" },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/?room=" + slug);
  await expect(
    page.getByRole("textbox", { name: "Your message" }),
  ).toBeVisible();
  if (process.env.MEDIA_MOBILE === "1") {
    await page
      .getByRole("button", { name: "Change room appearance", exact: true })
      .click();
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .last()
      .click();
  }
  return slug;
}
async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Your message" }).fill(text);
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      /\/messages$/.test(new URL(r.url()).pathname),
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  expect((await saved).status()).toBe(201);
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}
async function snapshot(page: Page, slug: string) {
  return (await page.request.get("/api/rooms/" + slug)).json();
}
async function cleanup(page: Page, slug: string) {
  await page.request.delete(`/api/rooms/${slug}/messages`);
  await page.request.patch(`/api/rooms/${slug}/settings`, {
    data: { clearLogoImage: true },
  });
}
test("Smart media optimizes photos, preserves GIFs, defers video/audio, records voice and saves wallpapers", async ({
  page,
}) => {
  test.setTimeout(180000);
  const slug = await setup(page);
  let wallpaperId = "";
  page.on("response", async (response) => {
    if (
      response.request().method() === "POST" &&
      /\/uploads$/.test(new URL(response.url()).pathname) &&
      response.ok()
    ) {
      try {
        const b = response.request().postDataJSON();
        if (b.purpose === "wallpaper") wallpaperId = (await response.json()).id;
      } catch {}
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const raw = randomFillSync(Buffer.alloc(1400 * 1000 * 3));
    const image = await sharp(raw, {
      raw: { width: 1400, height: 1000, channels: 3 },
    })
      .png()
      .toBuffer();
    await page.getByLabel("Upload a chat attachment").setInputFiles({
      name: "a-photo.png",
      mimeType: "image/png",
      buffer: image,
    });
    await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
      timeout: 40000,
    });
    await send(page, "An optimized photo");
    let data = await snapshot(page, slug);
    let message: Attachment = data.messages.find(
      (m: any) => m.text === "An optimized photo",
    );
    expect(message.fileMime).toBe("image/webp");
    expect(message.fileSize).toBeLessThan(image.length);
    expect(message.thumbnailId).toBeTruthy();
    const gif = readFileSync("tests/fixtures/animated-two-frame.gif");
    await page.getByLabel("Upload a chat attachment").setInputFiles({
      name: "two-frames.gif",
      mimeType: "image/gif",
      buffer: gif,
    });
    await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await send(page, "An animated GIF");
    data = await snapshot(page, slug);
    message = data.messages.find((m: any) => m.text === "An animated GIF");
    expect(message.fileMime).toBe("image/gif");
    expect(message.fileSize).toBe(gif.length);
    expect(message.thumbnailId).toBeNull();
    expect((await page.request.get("/api/media/" + message.id)).status()).toBe(
      404,
    );
    const gifMessage = data.messages.find(
      (m: any) => m.text === "An animated GIF",
    );
    expect(
      await (
        await page.request.get("/api/media/" + gifMessage.attachmentId)
      ).body(),
    ).toEqual(gif);
    const requested: string[] = [];
    page.on("request", (r) => requested.push(new URL(r.url()).pathname));
    await page
      .getByLabel("Upload a chat attachment")
      .setInputFiles("tests/fixtures/radio-video.mp4");
    await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await send(page, "Video waits for Play");
    data = await snapshot(page, slug);
    const video = data.messages.find(
      (m: any) => m.text === "Video waits for Play",
    );
    expect(video.thumbnailId).toBeTruthy();
    await page.waitForTimeout(600);
    expect(
      requested.filter((p) => p === "/api/media/" + video.attachmentId),
    ).toHaveLength(0);
    await page
      .getByRole("button", { name: "Play video: radio-video.mp4" })
      .click();
    await expect
      .poll(() =>
        requested.some((p) => p === "/api/media/" + video.attachmentId),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Record a voice note", exact: true })
      .click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Pause recording" }).click();
    await page.getByRole("button", { name: "Resume recording" }).click();
    await page.waitForTimeout(350);
    await page
      .getByRole("button", { name: "Stop and preview recording" })
      .click();
    await page.getByRole("button", { name: "Attach note" }).click();
    await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await send(page, "An Opus voice note");
    data = await snapshot(page, slug);
    const voice = data.messages.find(
      (m: any) => m.text === "An Opus voice note",
    );
    expect(voice.fileMime).toMatch(/^audio\/(webm|ogg|mp4)$/);
    expect(voice.duration).toBeGreaterThan(1);
    expect(JSON.parse(voice.waveform)).toHaveLength(34);
    expect(
      requested.filter((p) => p === "/api/media/" + voice.attachmentId),
    ).toHaveLength(0);
    await page
      .getByRole("button", { name: "Play voice note", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause voice note", exact: true }),
    ).toBeVisible();
    expect(
      requested.filter((p) => p === "/api/media/" + voice.attachmentId),
    ).toHaveLength(1);
    await page
      .getByRole("button", { name: "Change room appearance", exact: true })
      .click();
    await page.getByLabel("Upload wallpaper (up to 8 MB)").setInputFiles({
      name: "personal.gif",
      mimeType: "image/gif",
      buffer: gif,
    });
    await expect
      .poll(async () => page.locator(".chat-app").getAttribute("style"))
      .toContain("/api/media/");
    wallpaperId =
      (await page.locator(".chat-app").getAttribute("style"))?.match(
        /\/api\/media\/([a-f0-9-]+)/,
      )?.[1] || "";
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .last()
      .click();
    await page.reload();
    await expect
      .poll(async () => page.locator(".chat-app").getAttribute("style"))
      .toContain("/api/media/" + wallpaperId);
    await expect(
      page.getByText("An optimized photo", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "outputs/smart-media-desktop.png" });
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page, slug);
    if (wallpaperId)
      await page.request.delete(`/api/rooms/${slug}/uploads/${wallpaperId}`);
  }
});
test("A large document survives a network interruption, pause and page reload without restarting its uploaded bytes", async ({
  page,
}) => {
  test.setTimeout(150000);
  const slug = await setup(page),
    file = {
      name: "resume-me.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(7 * 1024 * 1024, 65),
    };
  let firstSent = false,
    blocked = false,
    failed = false;
  const offsets: number[] = [];
  let creations = 0;
  await page.route("**/uploads/*/tus", async (route) => {
    const request = route.request();
    if (request.method() === "POST") creations++;
    if (request.method() === "PATCH") {
      const offset = Number(request.headers()["upload-offset"]);
      offsets.push(offset);
      if (!failed) {
        failed = true;
        await route.abort("internetdisconnected");
        return;
      }
      if (offset > 0 && !blocked) {
        blocked = true;
        await new Promise((resolve) => setTimeout(resolve, 1300));
      }
    }
    await route.continue().catch(() => {});
  });
  page.on("response", (r) => {
    if (r.request().method() === "PATCH" && r.status() === 204)
      firstSent = true;
  });
  try {
    await page.getByLabel("Upload a chat attachment").setInputFiles(file);
    await expect.poll(() => firstSent, { timeout: 45000 }).toBe(true);
    await page
      .getByRole("button", { name: "Pause upload", exact: true })
      .click();
    await expect(
      page.getByText("Paused · your progress is saved", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Resume resume-me.txt/ }),
    ).toBeVisible();
    await page.getByLabel("Upload a chat attachment").setInputFiles(file);
    await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
      timeout: 45000,
    });
    await send(page, "A resumed document");
    const data = await snapshot(page, slug);
    const message = data.messages.find(
      (m: any) => m.text === "A resumed document",
    );
    expect(message.fileSize).toBe(file.buffer.length);
    expect(creations).toBe(1);
    expect(offsets.filter((n) => n === 0)).toHaveLength(2); // failed attempt + first successful chunk
    expect(offsets.some((n) => n === 6 * 1024 * 1024)).toBe(true);
    // Cancel while the reservation response is still in flight. No binary
    // transfer should start after the user has dismissed the upload.
    let release!: () => void,
      reserved!: () => void,
      cancelledId = "";
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reservation = new Promise<void>((resolve) => {
      reserved = resolve;
    });
    await page.route("**/uploads", async (route) => {
      const response = await route.fetch();
      cancelledId = (await response.json()).id;
      reserved();
      await gate;
      await route.fulfill({ response });
    });
    await page
      .getByLabel("Upload a chat attachment")
      .setInputFiles({ ...file, name: "cancel-me.txt" });
    await reservation;
    const cancellation = page.waitForResponse(
      (r) =>
        r.request().method() === "DELETE" &&
        r.url().endsWith("/uploads/" + cancelledId),
    );
    await page
      .getByRole("button", { name: "Cancel upload", exact: true })
      .click();
    release();
    expect((await cancellation).status()).toBe(200);
    expect(creations).toBe(1);
    await expect(page.getByText("Ready to send", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await cleanup(page, slug);
  }
});
test("Mobile supports documents, GIFs, file limits and a profile photo without changing the room layout", async ({
  page,
}) => {
  test.setTimeout(100000);
  await page.setViewportSize({ width: 390, height: 844 });
  const slug = await setup(page);
  try {
    await page.getByLabel("Upload a chat attachment").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("A document from a phone."),
    });
    await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await send(page, "A document on mobile");
    await expect(
      page.getByRole("link").filter({ hasText: "notes.txt" }),
    ).toBeVisible();
    await page.getByLabel("Upload a chat attachment").setInputFiles({
      name: "too-large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
    });
    await expect(
      page.getByText("This file is too large. The maximum is 8 MB.", {
        exact: true,
      }),
    ).toBeVisible();
    await send(page, "Text still works after a rejected upload");
    await page
      .getByRole("button", { name: "More room options", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Change your identity", exact: true })
      .click();
    await page
      .getByLabel("Upload profile photo")
      .setInputFiles("public/saad-profile.jpg");
    await page
      .getByRole("button", { name: "Looks like me", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Let’s drop in", exact: true })
      .click();
    await expect
      .poll(
        async () => {
          const r = await page.request.get("/api/session");
          return (await r.json()).user.avatar;
        },
        { timeout: 30000 },
      )
      .toMatch(/^media:/);
    await page.screenshot({ path: "outputs/smart-media-mobile.png" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    const previousUser = (await (await page.request.get("/api/session")).json())
      .user;
    await page
      .getByRole("button", { name: "More room options", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Change your identity", exact: true })
      .click();
    await page.getByRole("button", { name: "Initials", exact: true }).click();
    await page
      .getByRole("button", { name: "Looks like me", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Let’s drop in", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/session")).json()).user.avatar,
      )
      .not.toMatch(/^media:/);
    expect(
      (
        await page.request.get("/api/media/" + previousUser.avatar.slice(6))
      ).status(),
    ).toBe(404);
  } finally {
    await cleanup(page, slug);
    const user = (await (await page.request.get("/api/session")).json()).user;
    if (user.avatar.startsWith("media:"))
      await page.request.delete(
        `/api/rooms/${slug}/uploads/${user.avatar.slice(6)}`,
      );
  }
});
