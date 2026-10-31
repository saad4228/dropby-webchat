import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const photo = readFileSync("public/stadium.jpg");
function largePhoto(size: number) {
  return Buffer.concat([photo, Buffer.alloc(Math.max(0, size - photo.length))]);
}
test("Homepage is higher, compact, and scenic below the fold in both appearances", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  expect((await page.locator(".demo-chat").boundingBox())!.y).toBeLessThan(160);
  expect((await page.locator("h1").boundingBox())!.y).toBeLessThan(300);
  const scenery = await page.locator(".home-scenery").evaluate((el) => ({
    position: getComputedStyle(el).position,
    height: el.getBoundingClientRect().height,
  }));
  expect(scenery.position).toBe("fixed");
  expect(scenery.height).toBe(1000);
  await page.screenshot({
    path: "outputs/updated-home-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.locator("#how-it-works").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "outputs/updated-lower-home-dark.png",
    animations: "disabled",
  });
});
test("A large room logo and photo upload persist, and the expanded emoji picker works", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page
    .getByRole("button", { name: "Create a new room", exact: true })
    .click();
  const slug = "updates-" + Date.now();
  await page.getByPlaceholder("weekend-plans").fill(slug);
  await page.getByRole("button", { name: "Room logo 🌿", exact: true }).click();
  await page.getByLabel("Upload room logo").setInputFiles({
    name: "room-cover.jpg",
    mimeType: "image/jpeg",
    buffer: largePhoto(3 * 1024 * 1024),
  });
  await expect(page.getByAltText("Selected room logo")).toBeVisible();
  await page.getByRole("button", { name: "Make it yours" }).click();
  await page.getByPlaceholder("What should we call you?").fill("Image Owner");
  await page.getByRole("button", { name: "Looks like me" }).click();
  await page.getByRole("button", { name: "Create & enter room" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to " + slug + "." }),
  ).toBeVisible();
  await expect(page.locator(".room-home img")).toBeVisible();
  const context = await browser.newContext();
  const friend = await context.newPage();
  await friend.goto("/?room=" + slug);
  await friend
    .getByRole("button", { name: "Skip the details. Quick Join." })
    .click();
  await expect(friend.locator(".room-home img")).toBeVisible();
  await page.getByLabel("Upload a chat attachment").setInputFiles({
    name: "large-photo.jpg",
    mimeType: "image/jpeg",
    buffer: largePhoto(5 * 1024 * 1024),
  });
  await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(friend.getByAltText(/large-photo\.(jpg|webp)/)).toBeVisible();
  await page.getByRole("button", { name: "Choose an emoji" }).click();
  await page
    .getByRole("button", { name: "Animals & nature", exact: true })
    .click();
  await page.getByRole("button", { name: "Insert 🦊", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveValue(
    "🦊",
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    friend.locator(".message-bubble p").filter({ hasText: "🦊" }),
  ).toBeVisible();
  await page.locator(".room-title").click();
  await page
    .getByPlaceholder("A little space for…")
    .fill("Our match night, with a room image.");
  await page.getByRole("button", { name: "Save room settings" }).click();
  await page.screenshot({
    path: "outputs/updated-room-details.png",
    animations: "disabled",
  });
  await friend.locator(".room-title").click();
  await expect(friend.locator(".room-description")).toHaveText(
    /Our match night/,
  );
  await expect(friend.locator(".room-description textarea")).toHaveCount(0);
  await context.close();
});
test("Private wallpapers persist after reload without localStorage overflow", async ({
  page,
}) => {
  test.setTimeout(60000);
  const slug = "wallpaper-" + Date.now();
  expect(
    (
      await page.request.post("/api/session", {
        data: { name: "Wallpaper owner", avatar: "x", color: "#4b6bfa" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.post("/api/rooms", {
        data: { slug, visibility: "public" },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/?room=" + slug);
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.locator(".custom-theme summary").click();
  await page
    .getByLabel("Upload wallpaper (up to 8 MB)")
    .setInputFiles({
      name: "wallpaper.jpg",
      mimeType: "image/jpeg",
      buffer: largePhoto(6 * 1024 * 1024),
    });
  await expect(page.locator(".chat-app")).toHaveAttribute(
    "style",
    /\/api\/media\//,
    { timeout: 30000 },
  );
  const id = (await page.locator(".chat-app").getAttribute("style"))!.match(
    /\/api\/media\/([a-f0-9-]+)/,
  )![1];
  try {
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key)!.length,
        "dropby-appearance:" + slug,
      ),
    ).toBeLessThan(1000);
    await page.reload();
    await expect(page.locator(".chat-app")).toHaveAttribute(
      "style",
      new RegExp(id),
    );
    await page.getByRole("button", { name: "Change room appearance" }).click();
    await page.locator(".custom-theme summary").click();
    await page
      .getByLabel("Upload wallpaper (up to 8 MB)")
      .setInputFiles({
        name: "too-large.jpg",
        mimeType: "image/jpeg",
        buffer: largePhoto(8 * 1024 * 1024 + 1),
      });
    await expect(
      page.getByText("This wallpaper is too large. The maximum is 8 MB.", {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/rooms/${slug}/uploads/${id}`);
  }
});
