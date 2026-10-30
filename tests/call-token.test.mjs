import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { callConfig } from "../lib/call-token.ts";
const vars = {
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "test-secret",
};
test("Unconfigured SFU uses native WebRTC", async () =>
  assert.equal(
    await callConfig({}, "room", { id: "member", name: "Guest" }),
    null,
  ));
test("Incomplete SFU setup fails explicitly", async () =>
  assert.rejects(
    () =>
      callConfig({ LIVEKIT_URL: vars.LIVEKIT_URL }, "room", {
        id: "member",
        name: "Guest",
      }),
    { status: 503 },
  ));
test("Room join tokens are signed and scoped to one identity and room", async () => {
  const result = await callConfig(vars, "room-123", {
    id: "user-123",
    name: "A guest",
  });
  const [header, payload, signature] = result.token.split(".");
  assert.equal(
    signature,
    createHmac("sha256", vars.LIVEKIT_API_SECRET)
      .update(header + "." + payload)
      .digest("base64url"),
  );
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(decoded.sub, "user-123");
  assert.equal(decoded.video.room, "dropby-room-123");
  assert.equal(decoded.video.roomJoin, true);
  assert.equal(decoded.video.roomAdmin, undefined);
  assert.equal(decoded.video.canPublish, true);
  assert.equal(decoded.exp - decoded.nbf, 610);
  assert.ok(!payload.includes(vars.LIVEKIT_API_SECRET));
});
test("Call capacities are bounded", async () => {
  assert.equal(
    (
      await callConfig({ ...vars, CALL_MEMBER_LIMIT: "1000" }, "room", {
        id: "u",
        name: "A",
      })
    ).limit,
    100,
  );
  assert.equal(
    (
      await callConfig({ ...vars, CALL_MEMBER_LIMIT: "1" }, "room", {
        id: "u",
        name: "A",
      })
    ).limit,
    4,
  );
});
