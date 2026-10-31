import {
  IMAGE_TYPES,
  MEDIA_CONFIG,
  normalizeMime,
  validateMedia,
  type MediaPurpose,
} from "./media-config";
export type MediaHints = { duration?: number; waveform?: number[] };
export type PreparedMedia = {
  file: File;
  thumbnail?: File;
  hints: MediaHints;
  originalSize: number;
};
const canvasBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
function canvasFor(
  source: CanvasImageSource,
  width: number,
  height: number,
  limit: number,
) {
  const scale = Math.min(1, limit / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function videoPreview(file: File) {
  const video = document.createElement("video"),
    url = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Preview unavailable")),
        8000,
      );
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Preview unavailable"));
      };
      video.src = url;
    });
    const canvas = canvasFor(
      video,
      video.videoWidth,
      video.videoHeight,
      MEDIA_CONFIG.previewDimension,
    );
    const blob = await canvasBlob(canvas, MEDIA_CONFIG.previewQuality);
    return {
      thumbnail: blob
        ? new File([blob], "video-preview.webp", { type: "image/webp" })
        : undefined,
      duration: Number.isFinite(video.duration) ? video.duration : undefined,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
export async function prepareMedia(
  file: File,
  purpose: MediaPurpose = "chat",
  hints: MediaHints = {},
): Promise<PreparedMedia> {
  const invalid = validateMedia(file, purpose);
  if (invalid) throw new Error(invalid);
  const result: PreparedMedia = { file, hints, originalSize: file.size },
    mime = normalizeMime(file.type);
  // Keep the original GIF bytes: a canvas conversion would flatten its animation.
  if (mime === "image/gif" || purpose === "thumbnail") return result;
  if (IMAGE_TYPES.includes(mime)) {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = canvasFor(
        bitmap,
        bitmap.width,
        bitmap.height,
        MEDIA_CONFIG.imageMaxDimension,
      );
      if (file.size > 300 * 1024 || canvas.width < bitmap.width) {
        const blob = await canvasBlob(
          canvas,
          mime === "image/png" ? 0.94 : MEDIA_CONFIG.imageQuality,
        );
        if (blob && blob.size < file.size * 0.93)
          result.file = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, "") + ".webp",
            { type: "image/webp" },
          );
      }
      if (
        purpose === "chat" &&
        Math.max(bitmap.width, bitmap.height) > MEDIA_CONFIG.previewDimension
      ) {
        const thumb = await canvasBlob(
          canvasFor(
            bitmap,
            bitmap.width,
            bitmap.height,
            MEDIA_CONFIG.previewDimension,
          ),
          MEDIA_CONFIG.previewQuality,
        );
        if (thumb && thumb.size < result.file.size * 0.65)
          result.thumbnail = new File([thumb], "image-preview.webp", {
            type: "image/webp",
          });
      }
    } catch {
      /* Unsupported decoders still upload the validated original. */
    } finally {
      bitmap?.close();
    }
  } else if (mime.startsWith("video/") && purpose === "chat") {
    try {
      const preview = await videoPreview(file);
      result.thumbnail = preview.thumbnail;
      result.hints = { ...hints, duration: preview.duration };
    } catch {
      /* A missing poster never prevents sharing a supported video. */
    }
  }
  return result;
}
