import test from "node:test";
import assert from "node:assert/strict";
import { emojiGroups } from "../lib/emojis.ts";
import { emojiMotion, emojiTokens, emojiOnly } from "../lib/emoji-motion.ts";
import { themes, themeIds, getTheme } from "../lib/themes.ts";
import {
  emojiExpression,
  EMOJI_EXPRESSION_DURATION,
} from "../lib/emoji-expressions.ts";

test("Every supported message emoji stays a single grapheme with a valid fallback motion", () => {
  const motions = [
    "heartbeat",
    "bounce",
    "spin",
    "float",
    "celebrate",
    "wiggle",
    "gleam",
  ];
  const emojis = emojiGroups.flatMap((group) => group.emojis);
  assert.ok(emojis.length >= 647);
  for (const emoji of emojis) {
    assert.deepEqual(
      emojiTokens(emoji),
      [{ emoji: true, value: emoji }],
      emoji,
    );
    assert.ok(motions.includes(emojiMotion(emoji)), emoji);
  }
});
test("Sent faces match the emotion and use a short performance", () => {
  assert.equal(emojiExpression("😭"), "sob");
  assert.equal(emojiExpression("😢"), "cry");
  assert.equal(emojiExpression("😂"), "laugh-tears");
  assert.equal(emojiExpression("🤣"), "laugh");
  assert.equal(emojiExpression("😴"), "sleep");
  assert.equal(emojiExpression("😍"), "love");
  assert.equal(emojiExpression("⚽"), null);
  assert.equal(emojiExpression("👨‍👩‍👧‍👦"), null);
  assert.ok(
    EMOJI_EXPRESSION_DURATION >= 1000 && EMOJI_EXPRESSION_DURATION <= 2000,
  );
});
test("Joined emoji, skin tones, flags and keycaps stay intact and text is preserved", () => {
  for (const emoji of ["👨‍👩‍👧‍👦", "👩🏽‍🚀", "🇮🇳", "1️⃣", "❤️‍🔥"]) {
    const value = `Hello ${emoji}! https://example.com`;
    assert.deepEqual(emojiTokens(emoji), [{ emoji: true, value: emoji }]);
    assert.equal(
      emojiTokens(value)
        .map((token) => token.value)
        .join(""),
      value,
    );
    assert.equal(emojiTokens(value).filter((token) => token.emoji).length, 1);
  }
  assert.equal(emojiOnly(" ❤️ ⚽ 👩🏽‍🚀 "), true);
  assert.equal(emojiOnly("❤️⚽👩🏽‍🚀👋"), false);
  assert.equal(emojiOnly("Hello ❤️"), false);
  assert.equal(emojiOnly("   "), false);
  assert.equal(emojiMotion("❤️"), "heartbeat");
  assert.equal(emojiMotion("⚽"), "spin");
  assert.equal(emojiMotion("🎉"), "celebrate");
  assert.equal(emojiMotion("😊"), "bounce");
});
test("Theme catalogue and server validation IDs agree, with a safe fallback", () => {
  assert.equal(themes.length, 10);
  assert.equal(new Set(themeIds).size, 10);
  assert.deepEqual(
    themes.map((theme) => theme.id),
    [...themeIds],
  );
  for (const id of ["love", "football", "cosmic", "arcade"])
    assert.equal(getTheme(id).id, id);
  assert.equal(getTheme("missing").id, "alpine");
});
