import { test, expect } from "@playwright/test";
test("People opt in to synchronized MP3 and video audio, with personal and shared controls", async ({
  page,
  browser,
}) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const slug = "radio-" + Date.now();
  const owner = await page.request.post("/api/session", {
    data: { name: "Radio Owner", avatar: "🌿", color: "#4b6bfa" },
  });
  expect(owner.ok()).toBeTruthy();
  expect(
    (
      await page.request.post("/api/rooms", {
        data: {
          slug,
          visibility: "public",
          description: "A shared soundtrack",
          password: "",
        },
      })
    ).status(),
  ).toBe(201);
  const context = await browser.newContext({
      baseURL: "http://localhost:5173",
    }),
    friend = await context.newPage();
  friend.on("pageerror", (e) => errors.push(e.message));
  expect(
    (
      await friend.request.post("/api/session", {
        data: { name: "Radio Friend", avatar: "🦊", color: "#4b6bfa" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await friend.request.post("/api/rooms/" + slug + "/join", { data: {} })
    ).ok(),
  ).toBeTruthy();
  await Promise.all([
    page.goto("/?room=" + slug),
    friend.goto("/?room=" + slug),
  ]);
  await expect(page.locator(".music-dock")).toBeVisible();
  await page.getByRole("button", { name: "Open room music player" }).click();
  await expect(
    page.getByRole("button", { name: "Add your first song" }),
  ).toBeEnabled();
  await page
    .getByLabel("Upload a music or video file")
    .setInputFiles("tests/fixtures/radio-tone.mp3");
  await expect(page.locator(".music-now h4")).toHaveText("radio-tone");
  await friend.getByRole("button", { name: "Open room music player" }).click();
  await expect(
    friend.getByRole("button", { name: "Listen together", exact: true }),
  ).toBeVisible();
  expect(
    await friend.locator(".music-dock audio").getAttribute("src"),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Listen together", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0),
    )
    .toBe(true);
  await friend.getByRole("button", { name: "Pass this song" }).click();
  expect(
    await friend.locator(".music-dock audio").getAttribute("src"),
  ).toBeNull();
  expect(
    await page
      .locator(".music-dock audio")
      .evaluate((a: HTMLAudioElement) => a.paused),
  ).toBe(false);
  await friend
    .getByRole("button", { name: "Listen together", exact: true })
    .click();
  await expect
    .poll(() =>
      friend
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 1),
    )
    .toBe(true);
  const times = await Promise.all(
    [page, friend].map((p) =>
      p
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => a.currentTime),
    ),
  );
  expect(Math.abs(times[0] - times[1])).toBeLessThan(1);
  await page.getByRole("button", { name: "Pause shared music" }).click();
  await expect
    .poll(() =>
      friend
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => a.paused),
    )
    .toBe(true);
  const seek = page.getByRole("slider", { name: "Seek shared song" });
  await seek.fill("14");
  await seek.press("ArrowRight");
  await expect
    .poll(() =>
      friend
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(13);
  await page.getByRole("button", { name: "Play shared music" }).click();
  await expect
    .poll(() =>
      friend
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => a.paused),
    )
    .toBe(false);
  await friend
    .locator(".music-panel")
    .getByRole("button", { name: "Mute music for me", exact: true })
    .click();
  expect(
    await friend
      .locator(".music-dock audio")
      .evaluate((a: HTMLAudioElement) => a.muted),
  ).toBe(true);
  expect(
    await page
      .locator(".music-dock audio")
      .evaluate((a: HTMLAudioElement) => a.muted),
  ).toBe(false);
  await friend.getByRole("slider", { name: "My music volume" }).fill("0.2");
  expect(
    await page
      .locator(".music-dock audio")
      .evaluate((a: HTMLAudioElement) => a.volume),
  ).toBe(0.45);
  await friend
    .getByRole("button", { name: "Request a different song" })
    .click();
  await expect(page.getByText("1 person wants a new song")).toBeVisible();
  await friend
    .getByLabel("Upload a music or video file")
    .setInputFiles("tests/fixtures/radio-video.mp4");
  await expect(friend.locator(".music-queue strong")).toHaveText("radio-video");
  await expect(page.locator(".music-queue strong")).toHaveText("radio-video");
  await page.screenshot({
    path: "outputs/music-desktop.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Skip shared song" }).click();
  await expect(friend.locator(".music-now h4")).toHaveText("radio-video");
  await expect(
    friend.getByRole("button", { name: "Listen together", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => friend.locator(".music-dock audio").getAttribute("src"))
    .toBeNull();
  await friend
    .getByRole("button", { name: "Listen together", exact: true })
    .click();
  await friend
    .locator(".music-panel")
    .getByRole("button", { name: "Unmute music for me", exact: true })
    .click();
  await expect
    .poll(() =>
      friend
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => !a.paused && a.duration > 35),
    )
    .toBe(true);
  expect(await friend.locator(".music-dock video").count()).toBe(0);
  await friend.setViewportSize({ width: 390, height: 844 });
  await friend.getByRole("button", { name: "Change room appearance" }).click();
  await friend.getByRole("button", { name: /Love letters/ }).click();
  await friend.getByRole("switch", { name: "Dark mode" }).click();
  await friend
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await friend.getByRole("button", { name: "Open room music player" }).click();
  await expect(friend.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(friend.locator(".music-panel")).toHaveCSS(
    "color",
    "rgb(255, 233, 244)",
  );
  expect(
    await friend.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await friend.screenshot({
    path: "outputs/music-mobile.png",
    animations: "disabled",
  });
  await friend.reload();
  await expect(friend.locator(".music-dock audio")).toHaveJSProperty(
    "volume",
    0.2,
  );
  await friend.getByRole("button", { name: "Open room music player" }).click();
  if (
    await friend
      .getByRole("button", { name: "Enable sound on this device" })
      .isVisible()
  )
    await friend
      .getByRole("button", { name: "Enable sound on this device" })
      .click();
  await expect
    .poll(() =>
      friend
        .locator(".music-dock audio")
        .evaluate((a: HTMLAudioElement) => !a.paused && a.duration > 35),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Close music player" }).click();
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("Still chatting with our soundtrack 🎵");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await friend.getByRole("button", { name: "Close music player" }).click();
  await expect(
    friend.getByText("Still chatting with our soundtrack 🎵", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to home" }).click();
  await context.close();
  expect(errors).toEqual([]);
});
