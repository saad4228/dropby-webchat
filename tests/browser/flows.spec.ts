import { test, expect } from "@playwright/test";
test("Homepage, onboarding, live conversation and appearance", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect(
    page.getByRole("heading", {
      name: "Good conversations. Just a link away.",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "outputs/home-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Create a new room", exact: true })
    .click();
  await page.getByPlaceholder("weekend-plans").fill("browser-" + Date.now());
  const slug = await page.getByPlaceholder("weekend-plans").inputValue();
  await page.getByRole("button", { name: "Make it yours" }).click();
  await page.getByPlaceholder("What should we call you?").fill("Browser Owner");
  await page.getByRole("button", { name: "Choose 🦊", exact: true }).click();
  await page.getByRole("button", { name: "Looks like me" }).click();
  await page.getByRole("button", { name: "Create & enter room" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to " + slug + "." }),
  ).toBeVisible();
  await expect(
    page.getByText("A good conversation starts with hello."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("Hello from the first browser!");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Hello from the first browser!", { exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  const friend = await context.newPage();
  await friend.goto("/?room=" + slug);
  await friend
    .getByPlaceholder("What should we call you?")
    .fill("Browser Friend");
  await friend.getByRole("button", { name: "Looks like me" }).click();
  await friend.getByRole("button", { name: "Let’s drop in" }).click();
  await expect(
    friend.getByText("Hello from the first browser!", { exact: true }),
  ).toBeVisible();
  await friend
    .getByRole("textbox", { name: "Your message" })
    .fill("And hello back from browser two!");
  await friend
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(
    page.getByText("And hello back from browser two!", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Hello from the first browser!", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Upload a chat attachment")
    .setInputFiles("public/stadium.jpg");
  await expect(page.getByText("Ready to send", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("A shared stadium");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(friend.getByRole("img", { name: "stadium.jpg" })).toBeVisible();
  await page.getByRole("img", { name: "stadium.jpg" }).click();
  await expect(
    page.getByRole("dialog").getByRole("img", { name: "stadium.jpg" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Record a voice note" }).click();
  await expect(
    page.getByRole("button", { name: "Stop and preview recording" }),
  ).toBeVisible();
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "Pause recording" }).click();
  await page.getByRole("button", { name: "Resume recording" }).click();
  await page
    .getByRole("button", { name: "Stop and preview recording" })
    .click();
  await page.getByRole("button", { name: "Attach note" }).click();
  await expect(page.getByText("Ready to send", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(friend.locator(".voice-player audio")).toHaveCount(1);
  await friend
    .getByText("Hello from the first browser!", { exact: true })
    .click({ button: "right" });
  await friend.getByRole("button", { name: "React ❤️", exact: true }).click();
  await expect(
    page
      .locator(".message-reactions")
      .getByRole("button", { name: "❤️ 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.getByRole("button", { name: /Lavender haze/ }).click();
  await expect(page.locator(".chat-app")).toHaveClass(/theme-lavender/);
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Show room members" }).click();
  await expect(
    page
      .getByRole("complementary", { name: "Your people" })
      .getByText("Browser Friend", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "outputs/chat-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Start audio call" }).click();
  await expect(page.getByText("Room call", { exact: true })).toBeVisible();
  await expect(friend.getByText("Your people are in a call.")).toBeVisible();
  await friend.getByRole("button", { name: "Join them" }).click();
  await expect
    .poll(async () => page.locator(".call-video small").allTextContents(), {
      timeout: 20000,
    })
    .toContain("Browser Friend · connected");
  await page.getByRole("button", { name: "Leave call", exact: true }).click();
  await friend.getByRole("button", { name: "Leave call", exact: true }).click();
  await context.close();
  expect(errors).toEqual([]);
});
test("Mobile navigation, demo and dark appearance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect(
    page.getByRole("heading", {
      name: "Good conversations. Just a link away.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    await page.locator("h1").evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: "outputs/home-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Say something nice..." }).click();
  await expect(page.getByText("Interactive demo")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("Hello from a little screen 👋");
  await page.getByRole("textbox", { name: "Your message" }).press("Enter");
  await expect(
    page.getByText("Hello from a little screen 👋", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "outputs/chat-mobile-dark.png",
    fullPage: true,
  });
});
