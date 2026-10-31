// Edit these defaults once, then rebuild. Both browser and Worker use this file.
export const MiB = 1024 * 1024;
export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
];
export const DOCUMENT_TYPES = ["application/pdf", "text/plain"];
export const UPLOAD_LIMITS = {
  image: 8 * MiB,
  video: 30 * MiB,
  voice: 10 * MiB,
  document: 15 * MiB,
  avatar: 3 * MiB,
  wallpaper: 8 * MiB,
  logo: 8 * MiB,
  music: 15 * MiB,
  thumbnail: 384 * 1024,
};
export type MediaPurpose =
  "chat" | "voice" | "music" | "avatar" | "wallpaper" | "logo" | "thumbnail";
export const MEDIA_CONFIG = {
  bucket: "dropby-media",
  resumableAbove: 6 * MiB,
  chunkSize: 6 * MiB,
  imageMaxDimension: 2560,
  imageQuality: 0.9,
  previewDimension: 640,
  previewQuality: 0.82,
  reservationHours: 24,
  orphanHours: 48,
  storageBudget: 1_000_000_000,
  warningPercentages: [70, 85, 95],
  signedReadSeconds: 60,
};
export function normalizeMime(mime: string) {
  return mime.split(";")[0].trim().toLowerCase();
}
export function mediaLimit(mime: string, purpose: MediaPurpose = "chat") {
  mime = normalizeMime(mime);
  if (["avatar", "wallpaper", "logo", "thumbnail"].includes(purpose)) {
    if (
      !IMAGE_TYPES.includes(mime) ||
      (purpose === "thumbnail" && mime === "image/gif")
    )
      return 0;
    return UPLOAD_LIMITS[
      purpose as "avatar" | "wallpaper" | "logo" | "thumbnail"
    ];
  }
  if (purpose === "voice")
    return AUDIO_TYPES.includes(mime) ? UPLOAD_LIMITS.voice : 0;
  if (purpose === "music")
    return VIDEO_TYPES.includes(mime)
      ? UPLOAD_LIMITS.video
      : AUDIO_TYPES.includes(mime)
        ? UPLOAD_LIMITS.music
        : 0;
  return IMAGE_TYPES.includes(mime)
    ? UPLOAD_LIMITS.image
    : VIDEO_TYPES.includes(mime)
      ? UPLOAD_LIMITS.video
      : AUDIO_TYPES.includes(mime)
        ? UPLOAD_LIMITS.voice
        : DOCUMENT_TYPES.includes(mime)
          ? UPLOAD_LIMITS.document
          : 0;
}
export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 KB";
  return bytes >= MiB
    ? `${Number((bytes / MiB).toFixed(1))} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
export function validateMedia(
  file: { size: number; type: string },
  purpose: MediaPurpose = "chat",
) {
  const max = mediaLimit(file.type, purpose);
  if (!max)
    return "This format is not supported. Choose an image, MP4/WebM video, supported audio, PDF or text file.";
  if (!file.size) return "This file is empty. Choose another file.";
  if (file.size > max)
    return `This ${purpose === "chat" ? "file" : purpose} is too large. The maximum is ${formatBytes(max)}.`;
  return "";
}
export function mediaSignature(bytes: Uint8Array, mime: string) {
  // Container sizes are binary bytes. UTF-8 decoding can merge them and shift
  // the fixed WEBP/ftyp offsets, incorrectly rejecting valid uploads.
  const ascii = String.fromCharCode(...bytes.subarray(0, 12));
  mime = normalizeMime(mime);
  if (mime === "image/png")
    return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/gif")
    return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  if (mime === "image/webp")
    return ascii.startsWith("RIFF") && ascii.slice(8) === "WEBP";
  if (mime.endsWith("/webm"))
    return bytes.slice(0, 4).join(",") === "26,69,223,163";
  if (mime.endsWith("/mp4")) return ascii.slice(4, 8) === "ftyp";
  if (mime === "audio/ogg") return ascii.startsWith("OggS");
  if (mime === "audio/mpeg")
    return (
      ascii.startsWith("ID3") || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  if (mime === "application/pdf") return ascii.startsWith("%PDF-");
  return mime === "text/plain" && !bytes.includes(0);
}
export function safeFileName(name: string) {
  return (
    name
      .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
      .slice(0, 160)
      .trim() || "Shared file"
  );
}
