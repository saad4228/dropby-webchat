import { test } from "node:test";
import assert from "node:assert/strict";
import { parseApiResponse } from "../lib/client.ts";
import {
  MAX_IMAGE_BYTES,
  imageSignatureMatches,
} from "../lib/upload-limits.ts";
test("Plain-text 413 produces an upload error rather than a JSON parse exception", () => {
  assert.throws(
    () => parseApiResponse("Payload Too Large", 413),
    (e) =>
      e.status === 413 &&
      e.message.includes("supported size") &&
      !e.message.includes("Unexpected token"),
  );
});
test("HTML and empty upstream failures are handled without JSON exceptions", () => {
  assert.throws(
    () => parseApiResponse("<html>Bad Gateway</html>", 502),
    /server could not finish/,
  );
  assert.throws(() => parseApiResponse("", 503), /could not be completed/);
});
test("JSON application errors and successful responses retain their data", () => {
  assert.throws(
    () => parseApiResponse('{"error":"Choose a file under 15 MB."}', 413),
    /Choose a file/,
  );
  assert.deepEqual(parseApiResponse('{"ok":true}', 201), { ok: true });
});
test("Wallpaper and room-image file limit is 8 MiB", () =>
  assert.equal(MAX_IMAGE_BYTES, 8 * 1024 * 1024));
test("Room logos reject spoofed image content", () => {
  assert.equal(
    imageSignatureMatches(
      new TextEncoder().encode("<html>bad</html>"),
      "image/png",
    ),
    false,
  );
  assert.equal(
    imageSignatureMatches(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
    true,
  );
});
