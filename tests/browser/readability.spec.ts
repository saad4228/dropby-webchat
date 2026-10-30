import { test, expect } from "@playwright/test";
function contrast(a: string, b: string) {
  const luminance = (s: string) => {
    const [r, g, bl] = s
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map((n) => {
        const c = Number(n) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("Browser autofill respects both appearances and secondary copy remains readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page
    .getByRole("textbox", { name: "Room name", exact: true })
    .fill("pasted-room-name");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "#room-name",
  });
  await cdp.send("CSS.forcePseudoState", {
    nodeId,
    forcedPseudoClasses: ["autofill"],
  });
  for (const mode of ["light", "dark"]) {
    if (mode === "dark")
      await page.getByRole("button", { name: "Switch to dark mode" }).click();
    const input = await page.locator("#room-name").evaluate((el) => ({
      active: el.matches(":autofill"),
      shadow: getComputedStyle(el).boxShadow,
      ink: getComputedStyle(el).webkitTextFillColor,
    }));
    expect(input.active).toBe(true);
    expect(input.shadow).toContain("1000px inset");
    expect(input.shadow).toContain(
      mode === "dark" ? "52, 67, 92" : "243, 246, 252",
    );
    expect(
      contrast(
        input.ink,
        mode === "dark" ? "rgb(52,67,92)" : "rgb(243,246,252)",
      ),
    ).toBeGreaterThan(4.5);
    for (const selector of [
      ".hero-description",
      ".hero-assurances",
      ".feature-strip p",
      ".create-line",
    ]) {
      const color = await page
        .locator(selector)
        .first()
        .evaluate((el) => getComputedStyle(el).color);
      expect(
        contrast(color, mode === "dark" ? "rgb(58,72,94)" : "rgb(220,228,239)"),
      ).toBeGreaterThan(4.5);
    }
    await page.screenshot({
      path: "outputs/autofill-" + mode + ".png",
      animations: "disabled",
    });
  }
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
  await expect(
    page.getByRole("textbox", { name: "Room name", exact: true }),
  ).toHaveValue("pasted-room-name");
});
test("The top navigation Join action opens a focused, validated room flow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Join a room", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Join a room." }),
  ).toBeVisible();
  const name = dialog.getByRole("textbox", { name: "Room to join" });
  await expect(name).toBeFocused();
  await name.fill("a");
  await dialog.getByRole("button", { name: "Continue to room" }).click();
  await expect(dialog.getByRole("alert")).toContainText("3–48");
  await name.fill("Friday Friends");
  await name.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Come as you are." }),
  ).toBeVisible();
});
for (const width of [1440, 390])
  test(
    "Multiple emoji taps keep the picker open at width " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
      await page.getByRole("button", { name: "Say something nice..." }).click();
      const input = page.getByRole("textbox", { name: "Your message" });
      await input.fill("Hello ");
      await page.getByRole("button", { name: "Choose an emoji" }).click();
      const picker = page.getByRole("dialog", { name: "Emoji picker" });
      await picker
        .getByRole("button", { name: "Insert 😊", exact: true })
        .click();
      await picker
        .getByRole("button", { name: "Insert 😊", exact: true })
        .click();
      await picker
        .getByRole("button", { name: "Play & places", exact: true })
        .click();
      await picker
        .getByRole("button", { name: "Insert ⚽", exact: true })
        .click();
      await picker
        .getByRole("button", { name: "Food & drinks", exact: true })
        .click();
      await picker
        .getByRole("button", { name: "Insert 🍕", exact: true })
        .click();
      await expect(picker).toBeVisible();
      await expect(input).toHaveValue("Hello 😊😊⚽🍕");
      await picker.getByRole("button", { name: "Close emoji picker" }).click();
      await expect(picker).toHaveCount(0);
      await expect(input).toHaveValue("Hello 😊😊⚽🍕");
      await page.getByRole("button", { name: "Choose an emoji" }).click();
      await page.keyboard.press("Escape");
      await expect(picker).toHaveCount(0);
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(
        page.getByText("Hello 😊😊⚽🍕", { exact: true }),
      ).toBeVisible();
      if (width === 1440) {
        await page
          .getByText("Hello 😊😊⚽🍕", { exact: true })
          .click({ button: "right" });
        await page
          .getByRole("button", { name: "More reaction emojis" })
          .click();
        const reactions = page.getByRole("dialog", { name: "Emoji picker" });
        await reactions
          .getByRole("button", { name: "Insert 😊", exact: true })
          .click();
        await reactions
          .getByRole("button", { name: "Insert 😂", exact: true })
          .click();
        await expect(reactions).toBeVisible();
        await reactions
          .getByRole("button", { name: "Close emoji picker" })
          .click();
        await expect(
          page
            .locator(".message-reactions")
            .getByRole("button", { name: "😊 1", exact: true }),
        ).toBeVisible();
        await expect(
          page
            .locator(".message-reactions")
            .getByRole("button", { name: "😂 1", exact: true }),
        ).toBeVisible();
      }
    },
  );
test("Room reports use readable theme colours and the action works", async ({
  page,
}) => {
  // Reuse the portable starter's signed-in test account. This avoids exhausting
  // the deliberately limited anonymous-session budget during repeated UI runs.
  await page.request.get("/signin-with-chatgpt?return_to=/", {
    maxRedirects: 0,
  });
  const saved = await (await page.request.get("/api/session")).json();
  if (!saved.user) {
    const identity = await page.request.post("/api/session", {
      data: { name: "Report Owner", avatar: "🌿", color: "#4b6bfa" },
    });
    expect(identity.ok(), await identity.text()).toBe(true);
  }
  const slug = "readability-" + Date.now();
  expect(
    (
      await page.request.post("/api/rooms", {
        data: { slug, visibility: "public", description: "A readable room" },
      })
    ).ok(),
  ).toBe(true);
  for (const mode of ["light", "dark"]) {
    await page.goto("/?room=" + slug);
    await expect(page.locator(".room-title")).toBeVisible();
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
    await page.locator(".room-title").click();
    const reports = page.getByRole("button", { name: "Review reports" });
    await reports.scrollIntoViewIfNeeded();
    const colors = await reports.evaluate((el) => ({
      ink: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
      svgMargin: getComputedStyle(el.querySelector("svg")!).marginLeft,
    }));
    expect(contrast(colors.ink, colors.background)).toBeGreaterThan(4.5);
    expect(colors.svgMargin).toBe("0px");
    await reports.click();
    await expect(
      page.getByText("No reports. Let’s keep it kind."),
    ).toBeVisible();
    await page.screenshot({
      path: "outputs/room-reports-" + mode + ".png",
      animations: "disabled",
    });
  }
});
