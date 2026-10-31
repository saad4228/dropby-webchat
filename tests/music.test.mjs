import test from "node:test";
import assert from "node:assert/strict";
import { musicPosition, musicTime, MUSIC_MIMES } from "../lib/music.ts";
import { playbackCorrection, musicClockOffset } from "../lib/music-sync.ts";
test("Shared playback uses server time and clamps seeks and clock skew", () => {
  const state = { position: 12, playing: true, updatedAt: 10000 };
  assert.equal(musicPosition(state, 60, 12500), 14.5);
  assert.equal(musicPosition({ ...state, playing: false }, 60, 12500), 12);
  assert.equal(musicPosition(state, 13, 12500), 13);
  assert.equal(musicPosition(state, 60, 9000), 12);
  assert.equal(musicPosition({ ...state, position: -10 }, 60, 10000), 0);
});
test("Clock estimation excludes slow server processing instead of treating it as network delay", () => {
  assert.equal(musicClockOffset(1000, 1840, 1020, 1820), 0);
  assert.equal(musicClockOffset(1000, 1840, 6020, 6820), 5000);
  assert.equal(musicClockOffset(1000, 1040, undefined, 1020), 0);
});
test("Sync never repeatedly seeks a buffering decoder and uses small rate corrections while playing", () => {
  const sample = {
    drift: 5,
    revisionChanged: false,
    seeking: false,
    readyState: 2,
    sinceSeek: 9000,
  };
  assert.equal(playbackCorrection(sample).seek, false);
  assert.equal(
    playbackCorrection({ ...sample, readyState: 4, seeking: true }).seek,
    false,
  );
  assert.equal(
    playbackCorrection({ ...sample, readyState: 4, sinceSeek: 500 }).seek,
    false,
  );
  assert.equal(playbackCorrection({ ...sample, readyState: 4 }).seek, true);
  assert.equal(
    playbackCorrection({
      ...sample,
      readyState: 4,
      revisionChanged: true,
      sinceSeek: 0,
    }).seek,
    true,
  );
  assert.equal(
    playbackCorrection({ ...sample, readyState: 1, revisionChanged: true })
      .seek,
    false,
  );
  assert.equal(
    playbackCorrection({ ...sample, readyState: 4, drift: 0.3 }).rate,
    1.025,
  );
  assert.equal(
    playbackCorrection({ ...sample, readyState: 4, drift: -0.3 }).rate,
    0.975,
  );
});
test("Song times stay readable and accepted video formats are audio-capable containers", () => {
  assert.equal(musicTime(61.9), "1:01");
  assert.equal(musicTime(Infinity), "0:00");
  assert.equal(musicTime(-1), "0:00");
  assert.ok(MUSIC_MIMES.includes("audio/mpeg"));
  assert.ok(MUSIC_MIMES.includes("video/mp4"));
  assert.ok(!MUSIC_MIMES.includes("image/png"));
});
