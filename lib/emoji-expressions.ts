export type EmojiExpression =
  | "smile"
  | "laugh"
  | "laugh-tears"
  | "cry"
  | "sob"
  | "tear-smile"
  | "love"
  | "kiss"
  | "wink"
  | "cool"
  | "angry"
  | "sad"
  | "surprise"
  | "worry"
  | "sleep"
  | "tongue"
  | "party"
  | "shy"
  | "think"
  | "neutral"
  | "shush"
  | "zip"
  | "sick"
  | "cold"
  | "hot";
const expressions: [EmojiExpression, string][] = [
  ["smile", "😀 😃 😄 😁 😊 🙂 ☺️ 🤗"],
  ["laugh", "😆 🤣"],
  ["laugh-tears", "😂"],
  ["cry", "😢"],
  ["sob", "😭"],
  ["tear-smile", "🥲 🥹"],
  ["love", "😍 🥰 🤩"],
  ["kiss", "😘 😗 😙 😚"],
  ["wink", "😉"],
  ["cool", "😎 🤓 🧐"],
  ["angry", "😠 😡 🤬 😤"],
  ["sad", "😞 😔 😟 🙁 ☹️ 😣 😖"],
  ["surprise", "😮 😯 😲 😳 😱 😦 😧 🤯"],
  ["worry", "😥 😰 😨 😓 😅 😬"],
  ["sleep", "😴 😪 🥱"],
  ["tongue", "😛 😝 😜 🤪 😋"],
  ["party", "🥳"],
  ["shy", "🤭 🫢 🫣"],
  ["think", "🤔 🤨"],
  ["neutral", "😐 😑 😶 😏 🙄 🫤"],
  ["shush", "🤫"],
  ["zip", "🤐"],
  ["sick", "🤢 🤮 🤒 🤕 😷"],
  ["cold", "🥶"],
  ["hot", "🥵"],
];
const expressionMap = new Map(
  expressions.flatMap(([kind, emojis]) =>
    emojis
      .split(" ")
      .map((emoji) => [emoji.replace(/\uFE0F/g, ""), kind] as const),
  ),
);
export function emojiExpression(emoji: string): EmojiExpression | null {
  return expressionMap.get(emoji.replace(/\uFE0F/g, "")) || null;
}
export const EMOJI_EXPRESSION_DURATION = 1800;
