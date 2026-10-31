import { test, expect } from "@playwright/test";
test("Desktop room navigation, focused conversation surfaces and compact mobile controls work across themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Say something nice..." }).click();
  const rail = page.getByRole("navigation", { name: "Room navigation" });
  await expect(rail).toBeVisible();
  for (const [label, title] of [
    ["Search messages", "Find a moment"],
    ["Shared files", "Shared moments"],
    ["Saved pins", "Worth keeping"],
    ["Room members", "Your people"],
  ]) {
    await rail.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("complementary", { name: title }),
    ).toBeVisible();
  }
  await rail.getByRole("button", { name: "Conversation", exact: true }).click();
  await expect(page.locator(".room-panel")).toHaveCount(0);
  await expect(page.locator(".conversation-toolbar .music-dock")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("A little more room to talk. 💙");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("A little more room to talk. 💙", { exact: true }),
  ).toBeVisible();
  for (const name of [
    "Love letters",
    "Football night",
    "Cosmic daydream",
    "Retro arcade",
  ]) {
    await page.getByRole("button", { name: "Change room appearance" }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .last()
      .click();
    await page.screenshot({
      path:
        "outputs/studio-" + name.replaceAll(" ", "-").toLowerCase() + ".png",
      animations: "disabled",
    });
  }
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const composer = await page.locator(".composer").boundingBox();
    expect(composer!.x).toBeGreaterThanOrEqual(0);
    expect(composer!.x + composer!.width).toBeLessThanOrEqual(width);
    if (width <= 700) await expect(rail).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Start audio call" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change room appearance" }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Change room appearance" }).click();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page
    .getByRole("button", { name: "Close panel", exact: true })
    .last()
    .click();
  await page.screenshot({
    path: "outputs/studio-final-mobile.png",
    animations: "disabled",
  });
});
