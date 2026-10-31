import { test, expect } from "@playwright/test";
import { themeAssets } from "../../lib/theme-assets";

function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const [r, g, blue] = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map((n) => {
        const c = Number(n) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return r * 0.2126 + g * 0.7152 + blue * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

for (const { theme, name, paired } of [
  { theme: "love", name: "Love letters", paired: true },
  { theme: "football", name: "Football night", paired: true },
  { theme: "arcade", name: "Retro arcade", paired: true },
  { theme: "cosmic", name: "Cosmic daydream", paired: true },
  { theme: "alpine", name: "Alpine escape", paired: false },
  { theme: "lavender", name: "Lavender haze", paired: false },
  { theme: "ocean", name: "Ocean blue", paired: false },
  { theme: "sunset", name: "Golden hour", paired: false },
  { theme: "forest", name: "Into the green", paired: false },
  { theme: "midnight", name: "After hours", paired: false },
]) {
  test(`${name} uses the supplied artwork in both modes with readable messages and compact controls`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    const homeMark = await page
      .locator(".brand-symbol")
      .first()
      .evaluate((el) => ({
        svg: el.querySelector("svg")!.outerHTML,
        color: getComputedStyle(el).color,
        transform: getComputedStyle(el).transform,
      }));
    await page.getByRole("button", { name: "Say something nice..." }).click();
    await page.getByRole("button", { name: "Change room appearance" }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .last()
      .click();
    expect(
      await page.locator(".rail-home .brand-symbol").evaluate((el) => ({
        svg: el.querySelector("svg")!.outerHTML,
        color: getComputedStyle(el).color,
        transform: getComputedStyle(el).transform,
      })),
    ).toEqual(homeMark);
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("A little love, a little more room.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();

    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark") {
        await page
          .getByRole("button", { name: "Change room appearance" })
          .click();
        await page.getByRole("switch", { name: "Dark mode" }).click();
        await page
          .getByRole("button", { name: "Close panel", exact: true })
          .last()
          .click();
      }
      const asset = paired ? `${theme}-${mode}` : theme;
      await expect(page.locator(".chat-scenery")).toHaveCSS(
        "background-image",
        new RegExp(`${asset}\\.[a-f0-9]+\\.webp`),
      );
      expect(
        await page.evaluate(async (asset) => {
          const image = new Image();
          image.src = asset;
          await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        }, themeAssets[asset]),
      ).toEqual([1536, 1024]);
      for (const selector of [
        ".message-row:not(.own) .message-bubble:not(.emoji-only)",
        ".own .message-bubble:not(.emoji-only)",
      ]) {
        const colors = await page
          .locator(selector)
          .last()
          .evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              ink: s.color,
              fills: s.backgroundImage.match(/rgba?\([^)]+\)/g) || [
                s.backgroundColor,
              ],
            };
          });
        for (const fill of colors.fills)
          expect(contrast(colors.ink, fill)).toBeGreaterThanOrEqual(4.5);
      }
      await page
        .getByRole("button", { name: "Open room music player" })
        .click();
      await expect(page.locator(".music-panel")).toBeVisible();
      const radioColors = await page.locator(".music-panel").evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          ink: style.color,
          surface: style.backgroundImage.match(/rgba?\([^)]+\)/)![0],
        };
      });
      expect(
        contrast(radioColors.ink, radioColors.surface),
      ).toBeGreaterThanOrEqual(4.5);
      await page.getByRole("button", { name: "Close music player" }).click();
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        const header = await page.locator(".room-header").boundingBox();
        expect(header!.height).toBeLessThanOrEqual(width <= 700 ? 58 : 64);
        for (const label of [
          "Start audio call",
          "Start video call",
          "Change room appearance",
          "More room options",
        ]) {
          const button = page.getByRole("button", { name: label, exact: true });
          await expect(button).toBeVisible();
          const box = await button.boundingBox();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      }
      await page.screenshot({
        path: `outputs/${theme}-tested-mobile-${mode}.png`,
        animations: "disabled",
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }

    // A personal wallpaper still takes priority over the built-in theme in both modes.
    const slug = `theme-wallpaper-${theme}-${Date.now()}`;
    expect(
      (
        await page.request.post("/api/session", {
          data: { name: "Theme tester", avatar: "x", color: "#4b6bfa" },
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
    await page.request.patch(`/api/rooms/${slug}/settings`, {
      data: { theme, description: "", locked: false },
    });
    await page.goto("/?room=" + slug);
    await page.getByRole("button", { name: "Change room appearance" }).click();
    await page.locator(".custom-theme summary").click();
    await page
      .getByLabel("Upload wallpaper (up to 8 MB)")
      .setInputFiles(`public/themes/${theme}${paired ? "-light" : ""}.png`);
    await expect(page.locator(".chat-scenery")).toHaveCSS(
      "background-image",
      /\/api\/media\//,
      { timeout: 20000 },
    );
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await expect(page.locator(".chat-scenery")).toHaveCSS(
      "background-image",
      /\/api\/media\//,
    );
    const wallpaperId = (await page
      .locator(".chat-app")
      .getAttribute("style"))!.match(/\/api\/media\/([a-f0-9-]+)/)![1];
    await page.request.delete(`/api/rooms/${slug}/uploads/${wallpaperId}`, {
      maxRetries: 2,
    });
    expect(errors).toEqual([]);
  });
}
