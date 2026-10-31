import test from "node:test";
import assert from "node:assert/strict";
import { musicPosition, musicTime, MUSIC_MIMES } from "../lib/music.ts";
test("Shared playback uses server time and clamps seeks and clock skew", () => {
  const state = { position: 12, playing: true, updatedAt: 10000 };
  assert.equal(musicPosition(state, 60, 12500), 14.5);
  assert.equal(musicPosition({ ...state, playing: false }, 60, 12500), 12);
  assert.equal(musicPosition(state, 13, 12500), 13);
  assert.equal(musicPosition(state, 60, 9000), 12);
  assert.equal(musicPosition({ ...state, position: -10 }, 60, 10000), 0);
});
test("Song times stay readable and accepted video formats are audio-capable containers", () => {
  assert.equal(musicTime(61.9), "1:01");
  assert.equal(musicTime(Infinity), "0:00");
  assert.equal(musicTime(-1), "0:00");
  assert.ok(MUSIC_MIMES.includes("audio/mpeg"));
  assert.ok(MUSIC_MIMES.includes("video/mp4"));
  assert.ok(!MUSIC_MIMES.includes("image/png"));
});
