"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/client";
import {
  defaultAppearance,
  loadAppearance,
  saveAppearance,
  type Appearance,
} from "../lib/appearance-store";

export function useAppearance(slug: string, notify: (message: string) => void) {
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const touched = useRef(false);

  useEffect(() => {
    let live = true;
    touched.current = false;
    loadAppearance(slug).then((saved) => {
      if (live && !touched.current)
        setAppearance({ ...defaultAppearance, ...saved });
    });
    return () => {
      live = false;
    };
  }, [slug]);

  function changeAppearance(next: Appearance) {
    touched.current = true;
    setAppearance(next);
    saveAppearance(slug, next)
      .then(async () => {
        if (
          appearance.background.startsWith("/api/media/") &&
          appearance.background !== next.background
        )
          await api(
            `rooms/${slug}/uploads/${appearance.background.split("/").at(-1)}`,
            undefined,
            "DELETE",
          );
      })
      .catch(() =>
        notify(
          "Your browser could not save this appearance. It is applied for this visit.",
        ),
      );
  }

  useEffect(() => {
    let live = true,
      url = "";
    if (!appearance.background) {
      setWallpaperUrl("");
      return;
    }
    if (!appearance.background.startsWith("data:image/")) {
      setWallpaperUrl(appearance.background);
      return;
    }
    // Large data URLs exceed CSS limits; a temporary Blob URL renders the same image.
    fetch(appearance.background)
      .then((response) => response.blob())
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setWallpaperUrl(url);
      })
      .catch(() =>
        notify("This wallpaper could not be opened. Choose another image."),
      );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [appearance.background, notify]);

  return { appearance, wallpaperUrl, changeAppearance };
}
