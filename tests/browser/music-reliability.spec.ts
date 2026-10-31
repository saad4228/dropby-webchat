import { test, expect, type Page } from "@playwright/test";
const audioTime = (page: Page) =>
  page
    .locator(".music-dock audio")
    .evaluate((a: HTMLAudioElement) => a.currentTime);
async function clickSeek(page: Page, fraction: number) {
  const slider = page.getByRole("slider", { name: "Seek shared song" }),
    box = (await slider.boundingBox())!;
  await page.mouse.click(
    box.x + 6 + (box.width - 12) * fraction,
    box.y + box.height / 2,
  );
}
test("Rewind is immediate despite server delay, rapid seeks settle on the last choice, and playback stays stable", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const slug = "rewind-" + Date.now();
  expect(
    (
      await page.request.post("/api/session", {
        data: { name: "Rewind DJ", avatar: "🌿", color: "#4b6bfa" },
      })
    ).ok(),
  ).toBe(true);
  await page.request.post("/api/rooms", {
    data: {
      slug,
      visibility: "public",
      description: "Playback regression",
      password: "",
    },
  });
  const context = await browser.newContext({
      baseURL: process.env.TEST_ORIGIN || "http://localhost:5173",
    }),
    friend = await context.newPage();
  expect(
    (
      await friend.request.post("/api/session", {
        data: { name: "Rewind Listener", avatar: "🦊", color: "#4b6bfa" },
      })
    ).ok(),
  ).toBe(true);
  await friend.request.post("/api/rooms/" + slug + "/join", { data: {} });
  await Promise.all([
    page.goto("/?room=" + slug),
    friend.goto("/?room=" + slug),
  ]);
  await page.getByRole("button", { name: "Open room music player" }).click();
  await expect(
    page.getByRole("button", { name: "Add your first song" }),
  ).toBeEnabled();
  await page
    .getByLabel("Upload a music or video file")
    .setInputFiles("tests/fixtures/radio-tone.mp3");
  await expect(page.locator(".music-now h4")).toHaveText("radio-tone");
  let mediaLoads = 0;
  await friend.route("**/api/media/*", async (route) => {
    mediaLoads++;
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await friend.getByRole("button", { name: "Open room music player" }).click();
  await page
    .getByRole("button", { name: "Listen together", exact: true })
    .click();
  await friend
    .getByRole("button", { name: "Listen together", exact: true })
    .click();
  await expect(
    friend.getByText("Preparing audio for smooth playback…"),
  ).toBeVisible();
  await expect
    .poll(() =>
      friend
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0),
    )
    .toBe(true);
  await expect
    .poll(async () =>
      Math.abs((await audioTime(page)) - (await audioTime(friend))),
    )
    .toBeLessThan(0.45);
  const originalSource = await friend
    .locator(".music-dock audio")
    .getAttribute("src");
  expect(originalSource).toMatch(/^blob:/);
  let delayed = 0;
  await page.route("**/api/rooms/*/music", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.action === "seek"
    ) {
      delayed++;
      await new Promise((resolve) =>
        setTimeout(resolve, delayed === 1 ? 900 : 180),
      );
    }
    await route.continue();
  });
  await clickSeek(page, 0.66);
  const immediate = await audioTime(page);
  expect(immediate).toBeGreaterThan(28);
  expect(immediate).toBeLessThan(32);
  await page.waitForTimeout(400);
  expect(await audioTime(page)).toBeGreaterThan(28); // an old snapshot must not undo the local seek
  await expect
    .poll(() => audioTime(friend), { timeout: 3000 })
    .toBeGreaterThan(28);
  await expect
    .poll(async () =>
      Math.abs((await audioTime(page)) - (await audioTime(friend))),
    )
    .toBeLessThan(0.45);
  await clickSeek(page, 0.15);
  await clickSeek(page, 0.45);
  await clickSeek(page, 0.05);
  expect(await audioTime(page)).toBeLessThan(4);
  await expect.poll(() => audioTime(friend), { timeout: 3000 }).toBeLessThan(5);
  await expect
    .poll(async () =>
      Math.abs((await audioTime(page)) - (await audioTime(friend))),
    )
    .toBeLessThan(0.45);
  // Measure actual media events after the explicit commands have settled.
  await page.waitForTimeout(500);
  for (const p of [page, friend])
    await p.locator(".music-dock audio").evaluate((a) => {
      (window as any).radioEvents = { seeks: 0, loads: 0 };
      a.addEventListener("seeking", () => {
        (window as any).radioEvents.seeks++;
      });
      a.addEventListener("loadstart", () => {
        (window as any).radioEvents.loads++;
      });
    });
  const started = await audioTime(friend);
  await page.waitForTimeout(6000);
  expect((await audioTime(friend)) - started).toBeGreaterThan(5.5);
  for (const p of [page, friend]) {
    expect(await p.evaluate(() => (window as any).radioEvents)).toEqual({
      seeks: 0,
      loads: 0,
    });
    expect(
      await p
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => a.paused),
    ).toBe(false);
  }
  expect(mediaLoads).toBe(1);
  expect(await friend.locator(".music-dock audio").getAttribute("src")).toBe(
    originalSource,
  );
  await page.getByRole("button", { name: "Pause shared music" }).click();
  await expect
    .poll(
      () =>
        friend
          .locator(".music-dock audio")
          .evaluate((a: HTMLAudioElement) => a.paused),
      { intervals: [50, 50, 100, 100], timeout: 900 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "Play shared music" }).click();
  await expect
    .poll(
      () =>
        friend
          .locator(".music-dock audio")
          .evaluate((a: HTMLAudioElement) => a.paused),
      { intervals: [50, 50, 100, 100], timeout: 900 },
    )
    .toBe(false);
  await context.close();
  expect(errors).toEqual([]);
});
test("Homepage feature strip has a rounded surface that matches dark mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  const strip = page.locator(".feature-strip");
  await expect(strip).toHaveCSS("border-top-left-radius", "24px");
  await expect(strip).toHaveCSS("background-color", "rgba(23, 45, 67, 0.85)");
  await strip.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "outputs/rounded-feature-strip-dark.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
