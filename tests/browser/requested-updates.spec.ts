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
  await expect(friend.getByAltText("large-photo.jpg")).toBeVisible();
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
test("Wallpapers larger than 2 MB persist after reload without localStorage overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Say something nice..." }).click();
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.locator(".custom-theme summary").click();
  await page.getByLabel("Upload wallpaper (up to 7 MB)").setInputFiles({
    name: "wallpaper.jpg",
    mimeType: "image/jpeg",
    buffer: largePhoto(6 * 1024 * 1024),
  });
  await expect(page.locator(".chat-app")).toHaveAttribute("style", /blob:/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const r = indexedDB.open("dropby-personal-appearance", 1);
            r.onsuccess = () => {
              const db = r.result;
              const get = db
                .transaction("wallpapers")
                .objectStore("wallpapers")
                .get("football-night");
              get.onsuccess = () => {
                resolve(get.result?.length || 0);
                db.close();
              };
              get.onerror = () => reject(get.error);
            };
            r.onerror = () => reject(r.error);
          }),
      ),
    )
    .toBeGreaterThan(6 * 1024 * 1024);
  expect(
    await page.evaluate(
      () => localStorage.getItem("dropby-appearance:football-night")!.length,
    ),
  ).toBeLessThan(1000);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Say something nice..." }).click();
  await expect(page.locator(".chat-app")).toHaveAttribute("style", /blob:/);
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.locator(".custom-theme summary").click();
  await page.getByLabel("Upload wallpaper (up to 7 MB)").setInputFiles({
    name: "too-large.jpg",
    mimeType: "image/jpeg",
    buffer: largePhoto(8 * 1024 * 1024),
  });
  await expect(page.getByRole("status")).toContainText("7 MB");
});
