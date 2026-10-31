import { test, expect } from "@playwright/test";

for (const dark of [false, true]) {
  test(`Cold ${dark ? "dark" : "light"} themes show artwork even while wallpaper downloads are unavailable`, async ({
    page,
  }) => {
    await page.addInitScript(
      (dark) => localStorage.setItem("dropby-dark", String(dark)),
      dark,
    );
    const downloads: string[] = [];
    await page.route("**/themes/**", (route) => {
      downloads.push(new URL(route.request().url()).pathname);
      return route.abort();
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: "Say something nice..." }).click();
    await expect(page.locator(".chat-scenery")).toHaveCSS(
      "background-image",
      /data:image\/webp;base64/,
    );
    await page.getByRole("button", { name: "Change room appearance" }).click();
    const thumbnails = page.locator(".theme-thumb");
    await expect(thumbnails).toHaveCount(10);
    // Every gallery image lives inside the stylesheet, with no per-tile requests.
    for (const thumbnail of await thumbnails.all()) {
      const source = await thumbnail.evaluate(
        (element) => getComputedStyle(element, "::before").backgroundImage,
      );
      expect(source).toMatch(/^url\("data:image\/webp;base64,/);
      expect(
        await page.evaluate(async (source) => {
          const image = new Image();
          image.src = source.slice(5, -2);
          await image.decode();
          return image.naturalWidth;
        }, source),
      ).toBe(192);
    }
    await page.getByRole("button", { name: /Love letters/ }).click();
    await expect(page.locator(".chat-app")).toHaveClass(/theme-love/);
    await expect(page.locator(".chat-scenery")).toHaveCSS(
      "background-image",
      new RegExp(`love-${dark ? "dark" : "light"}\\.[a-f0-9]+\\.webp`),
    );
    await expect(page.locator(".chat-scenery")).toHaveCSS(
      "background-image",
      /data:image\/webp;base64/,
    );
    await page.screenshot({
      path: `outputs/theme-preview-${dark ? "dark" : "light"}.png`,
    });
    expect(downloads.every((url) => url.endsWith(".webp"))).toBe(true);
    expect(new Set(downloads).size).toBeLessThanOrEqual(3);
  });
}

for (const entry of ["shared", "personal", "new guest"]) {
  test(`First room paint uses the correct theme for ${entry} without waiting for wallpaper storage`, async ({
    page,
  }) => {
    const personal = entry === "personal";
    const slug = `first-theme-${personal}-${Date.now()}`;
    expect(
      (
        await page.request.post("/api/session", {
          data: { name: "Theme reader", avatar: "x", color: "#4b6bfa" },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post("/api/rooms", {
          data: { slug, visibility: "public" },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await page.request.patch(`/api/rooms/${slug}/settings`, {
          data: { theme: "football", description: "", locked: false },
        })
      ).ok(),
    ).toBe(true);
    await page.addInitScript(
      ({ slug, personal }) => {
        if (personal)
          localStorage.setItem(
            "dropby-appearance:" + slug,
            JSON.stringify({ theme: "cosmic" }),
          );
        // A stalled wallpaper database must not delay the small, synchronous preferences.
        Object.defineProperty(indexedDB, "open", { value: () => ({}) });
        const state = window as typeof window & { roomPaints: string[] };
        state.roomPaints = [];
        function record() {
          const room = document.querySelector(".chat-app");
          if (room)
            state.roomPaints.push(room.className.match(/theme-\S+/)![0]);
          requestAnimationFrame(record);
        }
        requestAnimationFrame(record);
      },
      { slug, personal },
    );
    if (entry === "new guest") await page.context().clearCookies();
    await page.goto("/?room=" + slug);
    if (entry === "new guest") {
      await page
        .getByPlaceholder("What should we call you?")
        .fill("New theme guest");
      await page.getByRole("button", { name: "Looks like me" }).click();
      await page.getByRole("button", { name: "Let’s drop in" }).click();
    }
    const expected = `theme-${personal ? "cosmic" : "football"}`;
    await expect(page.locator(".chat-app")).toHaveClass(new RegExp(expected));
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { roomPaints: string[] }).roomPaints
              .length,
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => [
        ...new Set(
          (window as typeof window & { roomPaints: string[] }).roomPaints,
        ),
      ]),
    ).toEqual([expected]);
  });
}
