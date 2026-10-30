export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
export function imageSignatureMatches(bytes: Uint8Array, mime: string) {
  const head = Array.from(bytes.slice(0, 12));
  if (mime === "image/png")
    return head.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (mime === "image/jpeg")
    return head[0] === 255 && head[1] === 216 && head[2] === 255;
  if (mime === "image/webp") {
    const text = new TextDecoder().decode(bytes.slice(0, 12));
    return text.startsWith("RIFF") && text.slice(8) === "WEBP";
  }
  return false;
}
