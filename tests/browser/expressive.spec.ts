import { test, expect } from "@playwright/test";

test("Creator navigation, contact links and readable creation mark work on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    await expect(
      page.getByRole("button", { name: "Join a room", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create a room", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "A new little corner." }),
    ).toBeVisible();
    await expect(page.locator(".onboarding-emblem svg")).toBeVisible();
    const mark = await page.locator(".onboarding-emblem").evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));
    expect(mark.background).not.toBe(mark.color);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page
      .getByRole("link", { name: "About Mohammad Saad, creator of DropBy" })
      .click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(
      page.getByRole("heading", { name: "Mohammad Saad", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".creator-bio")).toContainText(
      "Hey, I'm Saad — a developer",
    );
    await expect(page.locator(".creator-monogram img")).toHaveAttribute(
      "src",
      "/saad-profile.jpg",
    );
    expect(
      await page
        .locator(".creator-monogram img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Saad on Instagram" }),
    ).toHaveAttribute("href", "https://www.instagram.com/saad._.4228/");
    await expect(
      page.getByRole("link", { name: "Saad on LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/in/saad4228/");
    await expect(
      page.getByRole("link", { name: "saadhussain.agr@gmail.com" }),
    ).toHaveAttribute("href", "mailto:saadhussain.agr@gmail.com");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `outputs/creator-${width}-light.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
    await expect(page.locator(".creator-socials>a").first()).toHaveCSS(
      "background-color",
      "rgb(42, 65, 88)",
    );
    await page.screenshot({
      path: `outputs/creator-${width}-dark.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Back to DropBy", exact: true })
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    await page
      .getByRole("button", { name: "Create a room", exact: true })
      .click();
    await expect(page.locator(".onboarding-emblem")).toHaveCSS(
      "background-color",
      "rgb(38, 60, 94)",
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("button", { name: "Contact", exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("link", { name: "saadhussain.agr@gmail.com" }),
    ).toHaveAttribute("href", "mailto:saadhussain.agr@gmail.com");
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("button", { name: "Switch to light mode" }).click();
  }
  expect(errors).toEqual([]);
});

test("New room themes change the design, persist and keep emoji effects optional", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Say something nice..." }).click();
  const input = page.getByRole("textbox", { name: "Your message" });
  await input.fill("❤️ ⚽ 👩🏽‍🚀");
  await input.press("Enter");
  const standalone = page.locator(".message-bubble.emoji-only").last();
  await expect(standalone.locator(".animated-emoji")).toHaveCount(3);
  expect(
    parseFloat(
      await standalone
        .locator(".animated-emoji")
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
    ),
  ).toBeGreaterThan(40);
  await standalone
    .getByRole("button", { name: "Animate ❤️", exact: true })
    .click();
  await expect(page.locator(".emoji-burst")).toHaveCount(1);
  expect(
    await standalone
      .locator(".emoji-glyph")
      .first()
      .evaluate((el) => el.getAnimations().length),
  ).toBeGreaterThan(0);
  await input.fill(
    "A mixed message 😊 with a link https://example.com and family 👨‍👩‍👧‍👦",
  );
  await input.press("Enter");
  await expect(
    page.getByRole("link", { name: "https://example.com" }),
  ).toHaveAttribute("href", "https://example.com");
  await expect(
    page.getByRole("button", { name: "Animate 👨‍👩‍👧‍👦", exact: true }),
  ).toBeVisible();
  const designs: string[] = [];
  for (const [id, name] of [
    ["love", "Love letters"],
    ["football", "Football night"],
    ["cosmic", "Cosmic daydream"],
    ["arcade", "Retro arcade"],
  ]) {
    await page.getByRole("button", { name: "Change room appearance" }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .last()
      .click();
    await expect(page.locator(".chat-app")).toHaveClass(
      new RegExp("theme-" + id),
    );
    await expect(page.locator('[data-scene="' + id + '"]')).toBeVisible();
    designs.push(
      await page
        .locator(".own .message-bubble:not(.emoji-only)")
        .last()
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return `${s.backgroundImage} ${s.backgroundColor} ${s.borderRadius}`;
        }),
    );
    await page.screenshot({
      path: `outputs/theme-${id}.png`,
      animations: "disabled",
    });
  }
  expect(new Set(designs).size).toBe(4);
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.getByRole("switch", { name: "Room animations" }).click();
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await expect(page.locator(".chat-app")).toHaveClass(/motion-off/);
  await standalone
    .getByRole("button", { name: "Animate ⚽", exact: true })
    .click();
  await expect(page.locator(".emoji-burst")).toHaveCount(0);
  expect(
    await standalone
      .locator(".emoji-glyph")
      .nth(1)
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Say something nice..." }).click();
  await expect(page.locator(".chat-app")).toHaveClass(
    /theme-arcade.*motion-off/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.getByRole("button", { name: /Love letters/ }).click();
  await page.getByRole("switch", { name: "Room animations" }).click();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await input.fill("Love this little space 💗");
  await input.press("Enter");
  await expect(
    page.getByText("Love this little space 💗", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "outputs/theme-love-mobile-dark.png",
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("System reduced-motion preference stops ambient and emoji animations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Say something nice..." }).click();
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.getByRole("button", { name: /Love letters/ }).click();
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  const input = page.getByRole("textbox", { name: "Your message" });
  await input.fill("💗");
  await input.press("Enter");
  await page
    .locator(".emoji-only")
    .getByRole("button", { name: "Animate 💗", exact: true })
    .click();
  await expect(page.locator(".emoji-burst")).toHaveCount(0);
  expect(
    await page
      .locator(".emoji-only .emoji-glyph")
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  expect(
    await page
      .locator(".ambient-heart")
      .first()
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
});
