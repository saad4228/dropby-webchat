export const themeIds = [
  "alpine",
  "lavender",
  "ocean",
  "sunset",
  "forest",
  "midnight",
  "love",
  "football",
  "cosmic",
  "arcade",
] as const;
export type ThemeId = (typeof themeIds)[number];
export const themes: [
  {
    id: ThemeId;
    name: string;
    color: string;
    subtitle: string;
    icon: string;
    eyebrow: string;
  },
  ...{
    id: ThemeId;
    name: string;
    color: string;
    subtitle: string;
    icon: string;
    eyebrow: string;
  }[],
] = [
  {
    id: "alpine",
    name: "Alpine escape",
    color: "#b7cee4",
    subtitle: "A breath of fresh air",
    icon: "🏔️",
    eyebrow: "A LITTLE SPACE FOR YOUR PEOPLE",
  },
  {
    id: "lavender",
    name: "Lavender haze",
    color: "#c8b8e5",
    subtitle: "Soft, slow evenings",
    icon: "🪻",
    eyebrow: "SLOW EVENINGS. GOOD COMPANY.",
  },
  {
    id: "ocean",
    name: "Ocean blue",
    color: "#9dceda",
    subtitle: "Go with the flow",
    icon: "🌊",
    eyebrow: "A LITTLE CLOSER, COAST TO COAST",
  },
  {
    id: "sunset",
    name: "Golden hour",
    color: "#edbd9b",
    subtitle: "Stay a little longer",
    icon: "🌅",
    eyebrow: "THE BEST PART OF THE DAY",
  },
  {
    id: "forest",
    name: "Into the green",
    color: "#a2b9a6",
    subtitle: "Find your quiet",
    icon: "🌿",
    eyebrow: "FIND YOUR LITTLE CLEARING",
  },
  {
    id: "midnight",
    name: "After hours",
    color: "#333b61",
    subtitle: "For the night owls",
    icon: "🌙",
    eyebrow: "SOME CONVERSATIONS KEEP YOU UP",
  },
  {
    id: "love",
    name: "Love letters",
    color: "#f1abc9",
    subtitle: "A little more heart",
    icon: "💗",
    eyebrow: "SAY IT WITH A LITTLE LOVE",
  },
  {
    id: "football",
    name: "Football night",
    color: "#204f45",
    subtitle: "Your match-day clubhouse",
    icon: "⚽",
    eyebrow: "THE MATCH IS BETTER TOGETHER",
  },
  {
    id: "cosmic",
    name: "Cosmic daydream",
    color: "#4c4389",
    subtitle: "Your people, your universe",
    icon: "🪐",
    eyebrow: "A LITTLE WORLD OF YOUR OWN",
  },
  {
    id: "arcade",
    name: "Retro arcade",
    color: "#243f50",
    subtitle: "Good company. Bonus points.",
    icon: "👾",
    eyebrow: "GOOD COMPANY. BONUS POINTS.",
  },
];
export function getTheme(id: string) {
  return themes.find((t) => t.id === id) || themes[0];
}
