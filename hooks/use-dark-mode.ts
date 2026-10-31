"use client";
import { useSyncExternalStore } from "react";

const changeEvent = "dropby-color-mode";
const snapshot = () => document.documentElement.dataset.mode === "dark";
function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  return () => window.removeEventListener(changeEvent, notify);
}
function setDark(value: boolean | ((current: boolean) => boolean)) {
  const dark = typeof value === "function" ? value(snapshot()) : value;
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem("dropby-dark", String(dark));
  } catch {}
  window.dispatchEvent(new Event(changeEvent));
}

export function useDarkMode() {
  // The head script sets the DOM before paint. Hydration reads that value
  // without an initial effect overwriting it with the server's light default.
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  return [dark, setDark] as const;
}
