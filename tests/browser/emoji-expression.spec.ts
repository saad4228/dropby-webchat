import { test, expect } from "@playwright/test";
test("Picker is still; sent crying and laughing faces perform briefly and preserve message text", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Say something nice..." }).click();
  await page.getByRole("button", { name: "Choose an emoji" }).click();
  const picker = page.getByRole("dialog", { name: "Emoji picker" }),
    cry = picker.getByRole("button", { name: "Insert 😭", exact: true });
  await cry.hover();
  await cry.focus();
  expect(
    await cry.evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await cry.click();
  await picker.getByRole("button", { name: "Insert 😂", exact: true }).click();
  await expect(picker).toBeVisible();
  expect(await page.locator(".sent-emoji-art,.emoji-burst").count()).toBe(0);
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveValue(
    "😭😂",
  );
  await picker.getByRole("button", { name: "Close emoji picker" }).click();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const message = page.locator(".message-bubble.emoji-only").last(),
    sob = message.locator('[data-expression="sob"]'),
    laugh = message.locator('[data-expression="laugh-tears"]');
  await expect(sob).toBeVisible();
  await expect(laugh).toBeVisible();
  expect(await message.locator("p").textContent()).toBe("😭😂");
  expect(await sob.locator(".tear-stream").count()).toBe(2);
  const frameA = await sob
    .locator(".tear-ripple")
    .evaluate((el) => getComputedStyle(el).strokeDashoffset);
  const mouthA = await laugh
    .locator(".face-mouth")
    .evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(140);
  expect(
    await sob
      .locator(".tear-ripple")
      .evaluate((el) => getComputedStyle(el).strokeDashoffset),
  ).not.toBe(frameA);
  expect(
    await laugh
      .locator(".face-mouth")
      .evaluate((el) => getComputedStyle(el).transform),
  ).not.toBe(mouthA);
  await message.screenshot({ path: "outputs/sent-emoji-expressions.png" });
  await expect(message.locator(".sent-emoji-art")).toHaveCount(0, {
    timeout: 2500,
  });
  await expect(
    message.getByRole("button", { name: "Animate 😭", exact: true }),
  ).not.toHaveAttribute("data-expressing", "true");
  await message
    .getByRole("button", { name: "Animate 😭", exact: true })
    .hover();
  expect(await message.locator(".sent-emoji-art").count()).toBe(0);
  await message
    .getByRole("button", { name: "Animate 😭", exact: true })
    .click();
  await expect(sob).toBeVisible();
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.getByRole("switch", { name: "Room animations" }).click();
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await expect(message.locator(".sent-emoji-art")).toHaveCount(0);
  await message
    .getByRole("button", { name: "Animate 😭", exact: true })
    .click();
  await expect(message.locator(".sent-emoji-art")).toHaveCount(0);
  expect(await message.locator("p").textContent()).toBe("😭😂");
});
test("Newly received emoji animates on the other browser, including mobile dark mode", async ({
  page,
  browser,
}) => {
  const slug = "emoji-" + Date.now(),
    owner = await page.request.post("/api/session", {
      data: { name: "Emoji Sender", avatar: "🌿", color: "#4b6bfa" },
    });
  expect(owner.ok()).toBeTruthy();
  expect(
    (
      await page.request.post("/api/rooms", {
        data: {
          slug,
          visibility: "public",
          description: "Expression test",
          password: "",
        },
      })
    ).status(),
  ).toBe(201);
  const context = await browser.newContext({
      baseURL: "http://localhost:5173",
      viewport: { width: 390, height: 844 },
    }),
    friend = await context.newPage();
  expect(
    (
      await friend.request.post("/api/session", {
        data: { name: "Emoji Receiver", avatar: "🦊", color: "#4b6bfa" },
      })
    ).ok(),
  ).toBeTruthy();
  await friend.request.post("/api/rooms/" + slug + "/join", { data: {} });
  await friend.addInitScript(() => localStorage.setItem("dropby-dark", "true"));
  await Promise.all([
    page.goto("/?room=" + slug),
    friend.goto("/?room=" + slug),
  ]);
  await expect(
    friend.getByRole("textbox", { name: "Your message" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Your message" }).fill("😭😂");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const incoming = friend.locator(".message-bubble.emoji-only").last();
  await expect(incoming.locator('[data-expression="sob"]')).toBeVisible();
  await expect(
    incoming.locator('[data-expression="laugh-tears"]'),
  ).toBeVisible();
  await incoming.screenshot({ path: "outputs/received-emoji-mobile-dark.png" });
  await expect(incoming.locator(".sent-emoji-art")).toHaveCount(0, {
    timeout: 2500,
  });
  await friend.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("textbox", { name: "Your message" }).fill("😢");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(friend.getByText("😢", { exact: true })).toBeVisible();
  expect(await friend.locator(".sent-emoji-art").count()).toBe(0);
  expect(
    await friend.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await context.close();
});
