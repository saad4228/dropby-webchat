"use client";
import { useEffect, useRef, useState } from "react";
import {
  MediaUpload,
  type TransferState,
  type UploadedMedia,
} from "../lib/media-upload";
import type { MediaPurpose } from "../lib/media-config";
import type { MediaHints } from "../lib/media-prepare";
export function useMediaUpload(
  slug: string,
  ownerId: string,
  onComplete: (file: UploadedMedia) => void,
  onError: (message: string) => void,
  recoveryPurpose: MediaPurpose = "chat",
) {
  const [state, setState] = useState<TransferState | null>(null),
    [recoverable, setRecoverable] = useState("");
  const task = useRef<MediaUpload | null>(null),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    try {
      const saved = JSON.parse(
        localStorage.getItem(
          `dropby-upload:${slug}:${ownerId}:${recoveryPurpose}`,
        ) || "null",
      );
      if (saved?.expires > Date.now()) setRecoverable(saved.name);
    } catch {}
    return () => {
      live.current = false;
      task.current?.suspend();
    };
  }, [slug, ownerId, recoveryPurpose]);
  async function start(
    file: File,
    purpose: MediaPurpose = "chat",
    hints: MediaHints = {},
  ) {
    if (task.current && state?.phase !== "done" && state?.phase !== "error")
      await task.current.cancel();
    const next = new MediaUpload(
      slug,
      ownerId,
      file,
      purpose,
      (s) => {
        if (live.current) setState(s);
      },
      hints,
    );
    task.current = next;
    setRecoverable("");
    try {
      const uploaded = await next.run();
      if (live.current && task.current === next) onComplete(uploaded);
    } catch (error: any) {
      if (
        live.current &&
        task.current === next &&
        error.message !== "Upload cancelled."
      )
        onError(error.message);
    }
  }
  async function retry() {
    if (!task.current) return;
    try {
      const result = await task.current.run();
      if (live.current) onComplete(result);
    } catch (error: any) {
      if (live.current) onError(error.message);
    }
  }
  return {
    state,
    recoverable,
    start,
    retry,
    pause: () => task.current?.pause(),
    resume: () => task.current?.resume(),
    cancel: async () => {
      const cancelled = task.current;
      task.current = null;
      setState(null);
      setRecoverable("");
      await cancelled?.cancel();
    },
  };
}
