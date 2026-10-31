import test from "node:test";
import assert from "node:assert/strict";
import {
  mediaLimit,
  validateMedia,
  mediaSignature,
  UPLOAD_LIMITS,
  MEDIA_CONFIG,
  safeFileName,
  normalizeMime,
} from "../lib/media-config.ts";
for (const [mime, purpose, key] of [
  ["image/png", "chat", "image"],
  ["video/mp4", "chat", "video"],
  ["audio/webm;codecs=opus", "voice", "voice"],
  ["application/pdf", "chat", "document"],
  ["image/webp", "avatar", "avatar"],
  ["image/gif", "wallpaper", "wallpaper"],
]) {
  test(`${key} size limits are shared and enforce their boundary`, () => {
    const limit = UPLOAD_LIMITS[key];
    assert.equal(mediaLimit(mime, purpose), limit);
    assert.equal(validateMedia({ type: mime, size: limit }, purpose), "");
    assert.match(
      validateMedia({ type: mime, size: limit + 1 }, purpose),
      /maximum/,
    );
  });
}
test("Type-specific purposes reject mismatched formats and zero-byte files", () => {
  assert.equal(mediaLimit("video/mp4", "avatar"), 0);
  assert.equal(mediaLimit("image/gif", "thumbnail"), 0);
  assert.equal(mediaLimit("application/javascript"), 0);
  assert.match(validateMedia({ type: "text/plain", size: 0 }), /empty/);
});
test("GIF signatures preserve animated-file support without treating GIF as a static thumbnail", () => {
  assert(mediaSignature(new TextEncoder().encode("GIF89a123456"), "image/gif"));
  assert.equal(
    mediaSignature(new TextEncoder().encode("GIFxxa"), "image/gif"),
    false,
  );
});
test("Metadata names cannot become storage paths or response-header injections", () => {
  assert.equal(safeFileName("../private\r\nfile.txt"), ".._private__file.txt");
  assert.equal(normalizeMime("audio/webm;codecs=opus"), "audio/webm");
  assert.equal(MEDIA_CONFIG.chunkSize, 6 * 1024 * 1024);
  assert.equal(UPLOAD_LIMITS.music, 15 * 1024 * 1024);
});

test("Binary size fields do not shift WebP and MP4 signature offsets", () => {
  const binarySize = [0xc2, 0x80, 0, 0];
  assert(
    mediaSignature(
      Uint8Array.from([
        ...Buffer.from("RIFF"),
        ...binarySize,
        ...Buffer.from("WEBP"),
      ]),
      "image/webp",
    ),
  );
  assert(
    mediaSignature(
      Uint8Array.from([...binarySize, ...Buffer.from("ftypisom")]),
      "video/mp4",
    ),
  );
});
