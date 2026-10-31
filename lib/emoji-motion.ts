export type EmojiMotion =
  "heartbeat" | "bounce" | "spin" | "float" | "celebrate" | "wiggle" | "gleam";
export function emojiMotion(emoji: string): EmojiMotion {
  emoji = emoji.replace(/\uFE0F/g, "");
  if (/[❤💖💕💞💓💗💘💝💟💔❣🩷🩵🩶💙💛💚💜🧡🤍🖤🤎]/u.test(emoji))
    return "heartbeat";
  if (/[⚽🏀🏈⚾🥎🎾🏐🏉🎱🏓🏸🥏🪐🌍🌎🌏🌀⚙️]/u.test(emoji)) return "spin";
  if (/[🎉🎊🥳👏🙌🎆🎇🪩🎈🎁🏆🥇]/u.test(emoji)) return "celebrate";
  if (/[✨⭐🌟💫💎🔮🧿💡🔥⚡☀️]/u.test(emoji)) return "gleam";
  if (/[🦋🕊️🐦🌿🍃🌸🌺🌻🌷🍀☁️🌙🌈🌊🎐🫧]/u.test(emoji)) return "float";
  if (/[🍕🍔🍟🌮🍿🍩🍪☕🍵🍰🧁🥑🍒🍓🍉🐱🐶🦊🐼🐻]/u.test(emoji))
    return "wiggle";
  return "bounce";
}
const emojiPattern =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u;
export type EmojiToken = { emoji: boolean; value: string };
export function emojiTokens(text: string): EmojiToken[] {
  if (typeof Intl.Segmenter === "undefined")
    return [{ emoji: false, value: text }];
  const result: EmojiToken[] = [];
  for (const { segment } of new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(text)) {
    const isEmoji = emojiPattern.test(segment),
      last = result[result.length - 1];
    if (!isEmoji && last && !last.emoji) last.value += segment;
    else result.push({ emoji: isEmoji, value: segment });
  }
  return result;
}
export function emojiOnly(text: string) {
  const tokens = emojiTokens(text).filter((t) => t.value.trim());
  return (
    tokens.length > 0 && tokens.length <= 3 && tokens.every((t) => t.emoji)
  );
}
