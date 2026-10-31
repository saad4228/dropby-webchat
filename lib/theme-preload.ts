import { themeAssets } from "./theme-assets";

// Warm only the active or intended wallpaper, never all full-size themes at once.
export function preloadTheme(theme: string) {
  const mode = document.documentElement.dataset.mode || "light";
  const href = themeAssets[`${theme}-${mode}`] || themeAssets[theme];
  if (
    typeof href !== "string" ||
    document.querySelector(`link[rel="preload"][href="${href}"]`)
  )
    return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  document.head.appendChild(link);
}
