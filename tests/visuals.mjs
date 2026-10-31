// Record before a refactor, then check afterward on the same browser and machine.
// Screenshots stay in ignored outputs/, not the published application.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const recording = process.argv.includes("--record");
const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
const directory = path.resolve("outputs/visual-baseline");
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const differences = [];
let captures = 0;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 950 },
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent =
          "*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }";
        document.head.append(style);
      });
    });
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    async function capture(name, fullPage = false) {
      await page.mouse.move(0, 0);
      // Let React effects and the modal's autofocus finish before comparing pixels.
      await page.waitForTimeout(150);
      await page.evaluate(async () => {
        await document.fonts.ready;
        const scenery = document.querySelector(".chat-scenery");
        const urls = scenery
          ? [
              ...getComputedStyle(scenery).backgroundImage.matchAll(
                /url\("?([^"\)]+)"?\)/g,
              ),
            ]
          : [];
        await Promise.all(
          urls.map(async ([, src]) => {
            const image = new Image();
            image.src = src;
            await image.decode();
          }),
        );
      });
      const file = path.join(directory, `${width}-${name}.png`);
      const image = await page.screenshot({ fullPage, animations: "disabled" });
      if (recording) writeFileSync(file, image);
      else {
        const expected = await sharp(readFileSync(file))
          .raw()
          .toBuffer({ resolveWithObject: true });
        const actual = await sharp(image)
          .raw()
          .toBuffer({ resolveWithObject: true });
        // Chromium occasionally rounds a color channel by one level. Anything
        // larger, including a single moved pixel, fails the comparison.
        const changed =
          JSON.stringify(actual.info) !== JSON.stringify(expected.info) ||
          actual.data.some(
            (value, i) => Math.abs(value - expected.data[i]) > 1,
          );
        if (changed) {
          differences.push(`${width}-${name}`);
          writeFileSync(file.replace(".png", ".actual.png"), image);
        }
      }
      captures++;
    }
    const button = (name) => page.getByRole("button", { name, exact: true });
    const closePanel = () => button("Close panel").last().click();
    async function toggleRoomMode() {
      const next =
        (await page.locator("html").getAttribute("data-mode")) === "dark"
          ? "light"
          : "dark";
      await button("Change room appearance").click();
      await page.getByRole("switch", { name: "Dark mode" }).click();
      await closePanel();
      await page.waitForFunction(
        (mode) => document.documentElement.dataset.mode === mode,
        next,
      );
    }
    await page.goto(origin);
    await page.waitForSelector('html[data-ready="true"]');
    await capture("home-light", true);
    await button("Switch to dark mode").click();
    await capture("home-dark", true);
    await button("Switch to light mode").click();
    await button("Create a room").click();
    await capture("create-room");
    await page.getByPlaceholder("weekend-plans").fill("visual-room");
    await button("Make it yours").click();
    await page
      .getByPlaceholder("What should we call you?")
      .fill("Visual Guest");
    await capture("identity");
    await button("Looks like me").click();
    await capture("ready-to-create");
    await button("Close dialog").click();
    await page
      .getByRole("link", { name: "About Mohammad Saad, creator of DropBy" })
      .click();
    await page.waitForSelector('html[data-ready="true"]');
    await capture("creator-light", true);
    await button("Switch to dark mode").click();
    await capture("creator-dark", true);
    await page
      .getByRole("link", { name: "Back to DropBy", exact: true })
      .first()
      .click();
    await page.waitForSelector('html[data-ready="true"]');
    await button("Switch to light mode").click();
    await button("Say something nice...").click();
    for (const name of [
      "Alpine escape",
      "Lavender haze",
      "Ocean blue",
      "Golden hour",
      "Into the green",
      "After hours",
      "Love letters",
      "Football night",
      "Cosmic daydream",
      "Retro arcade",
    ]) {
      await button("Change room appearance").click();
      await page.getByRole("button", { name: new RegExp(name) }).click();
      await closePanel();
      await capture(`${name}-light`);
      await toggleRoomMode();
      await capture(`${name}-dark`);
      await toggleRoomMode();
    }
    for (const mode of ["light", "dark"]) {
      if (mode === "dark") await toggleRoomMode();
      await button("Change room appearance").click();
      await capture(`appearance-${mode}`);
      await closePanel();
      await page.locator(".room-title").click();
      await capture(`room-details-${mode}`);
      await closePanel();
      await button("Show room members").click();
      await capture(`members-${mode}`);
      await closePanel();
      await button("More room options").click();
      await capture(`room-options-${mode}`);
      await button("Delete all my messages").click();
      await capture(`delete-confirmation-${mode}`);
      await button("Keep my messages").click();
      await closePanel();
      await button("Choose an emoji").click();
      await capture(`emoji-picker-${mode}`);
      await button("Choose an emoji").click();
      await button("Open room music player").click();
      await capture(`room-radio-${mode}`);
      await button("Close music player").click();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
if (differences.length)
  throw new Error(
    `Visual changes in ${differences.length}/${captures} captures: ${differences.join(", ")}`,
  );
console.log(
  `${recording ? "Recorded" : "Matched"} ${captures} visual captures.`,
);
