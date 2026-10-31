export function parseApiResponse(text: string, status: number) {
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const message =
      status === 413
        ? "This upload exceeds the supported size for its file type. Choose a smaller file and try again."
        : status === 429
          ? "A little too fast. Please wait a moment."
          : status >= 500
            ? "The server could not finish this request. Please try again."
            : "The server returned an unexpected response. Please try again.";
    throw Object.assign(new Error(message), { status });
  }
  if (status >= 400)
    throw Object.assign(
      new Error(
        typeof data.error === "string"
          ? data.error
          : "This request could not be completed. Please try again.",
      ),
      { status },
    );
  return data;
}
export async function api(path: string, body?: unknown, method?: string) {
  const res = await fetch("/api/" + path, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers:
      body instanceof FormData
        ? {}
        : body
          ? { "Content-Type": "application/json" }
          : {},
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return parseApiResponse(await res.text(), res.status);
}
export type Identity = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  signedIn?: boolean;
};
export type Member = Identity & {
  role: string;
  online: boolean;
  typingUntil: number;
  inCall: number;
  muted: number;
};
export type Message = {
  id: string;
  senderId: string;
  name: string;
  avatar: string;
  color: string;
  text: string;
  created: number;
  edited?: number;
  replyId?: string;
  attachmentId?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
  thumbnailId?: string;
  duration?: number;
  waveform?: string | number[];
  pinned?: number;
};
export type Room = {
  id: string;
  slug: string;
  description: string;
  visibility: string;
  theme: string;
  owner: string;
  locked: boolean;
  logo?: string;
  logoImageId?: string | null;
};
export type Snapshot = {
  room: Room;
  role: string;
  mediaAdmin?: boolean;
  mediaWarningCount?: number;
  messages: Message[];
  members: Member[];
  reactions: {
    messageId: string;
    sessionId: string;
    emoji: string;
    name: string;
  }[];
  signals: any[];
  hasMore: boolean;
  deletedMessageIds?: string[];
  historyReset?: boolean;
  deletedVersion?: number;
};
export const avatars = [
  "🏔️",
  "🦊",
  "🐻",
  "🌿",
  "🪐",
  "🌊",
  "⚽",
  "🎮",
  "🌻",
  "👩‍🚀",
  "🐱",
  "🦋",
  "🌙",
  "🐼",
  "🍄",
  "🪁",
];
export const colors = [
  "#4b6bfa",
  "#a27af5",
  "#ee8cb7",
  "#f2a679",
  "#e5be67",
  "#7cb396",
  "#62bcbc",
];
