/** The same room-name normalization is used on the homepage and onboarding. */
export function normalizeRoomName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function messageTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Choose readable text for a member's custom accent or bubble color. */
export function contrastText(hex: string) {
  const color = parseInt(hex.slice(1), 16);
  const red = (color >> 16) & 255,
    green = (color >> 8) & 255,
    blue = color & 255;
  return red * 0.299 + green * 0.587 + blue * 0.114 > 160
    ? "#202737"
    : "#ffffff";
}
