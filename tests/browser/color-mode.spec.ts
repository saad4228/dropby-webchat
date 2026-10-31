import { test, expect, type Page } from "@playwright/test";

async function trackPaint(page: Page, dark: boolean) {
  await page.addInitScript((dark) => {
    if (localStorage.getItem("dropby-dark") === null)
      localStorage.setItem("dropby-dark", String(dark));
    const state = window as typeof window & { paintedModes: string[] };
    state.paintedModes = [];
    function record() {
      if (document.body?.firstElementChild)
        state.paintedModes.push(
          document.documentElement.dataset.mode || "unset",
        );
      requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  }, dark);
}
async function expectOnlyPaintedMode(page: Page, mode: string) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const modes = await page.evaluate(
    () => (window as typeof window & { paintedModes: string[] }).paintedModes,
  );
  expect(modes.length).toBeGreaterThan(0);
  expect([...new Set(modes)]).toEqual([mode]);
}

for (const dark of [true, false]) {
  for (const route of ["/", "/about"]) {
    test(`Saved ${dark ? "dark" : "light"} mode paints before hydration on ${route}`, async ({
      page,
    }) => {
      await trackPaint(page, dark);
      // Hold back the application bundle to expose the first server-rendered paint.
      await page.route("**/*", (route) =>
        route.request().resourceType() === "script"
          ? route.abort()
          : route.continue(),
      );
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const mode = dark ? "dark" : "light";
      await expect(page.locator("html")).toHaveAttribute("data-mode", mode);
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-ready",
        "true",
      );
      await expect(page.locator("html")).toHaveCSS("color-scheme", mode);
      await expectOnlyPaintedMode(page, mode);
    });
  }
}

test("Refresh and creator navigation retain dark mode without hydration resetting it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|didn't match/i.test(message.text())
    )
      errors.push(message.text());
  });
  await trackPaint(page, true);
  await page.goto("/");
  for (let i = 0; i < 2; i++) {
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    await expect(
      page.getByRole("button", { name: "Switch to light mode" }),
    ).toBeVisible();
    await expectOnlyPaintedMode(page, "dark");
    await page.reload();
  }
  await page
    .getByRole("link", { name: "About Mohammad Saad, creator of DropBy" })
    .click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expectOnlyPaintedMode(page, "dark");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
  await expectOnlyPaintedMode(page, "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
  await page.getByRole("link", { name: "Back to DropBy", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expectOnlyPaintedMode(page, "light");
  expect(await page.evaluate(() => localStorage.getItem("dropby-dark"))).toBe(
    "false",
  );
  expect(errors).toEqual([]);
});

test("Unavailable browser storage does not break theme switching", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/about");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await expect(
    page.getByRole("button", { name: "Switch to dark mode" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
});
