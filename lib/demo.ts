import type { Identity, Message, Snapshot } from "./client";

// This is preview data only. Real rooms get their messages from /api/rooms/:slug.
const time = Date.now() - 8 * 60000;
const aarav: Identity = {
  id: "aarav",
  name: "Aarav",
  avatar: "👨🏻",
  color: "#bf9f89",
};
const zoya: Identity = {
  id: "zoya",
  name: "Zoya",
  avatar: "👩🏽",
  color: "#d3b59b",
};
const manav: Identity = {
  id: "manav",
  name: "Manav",
  avatar: "👨🏽‍🦱",
  color: "#a6b7cc",
};

function message(
  id: string,
  author: Identity,
  text: string,
  offset = 0,
  attachment: Partial<Message> = {},
): Message {
  return {
    id,
    senderId: author.id,
    name: author.name,
    avatar: author.avatar,
    color: author.color,
    text,
    created: time + offset,
    ...attachment,
  };
}

export function demoSnapshot(user: Identity): Snapshot {
  return {
    room: {
      id: "demo",
      slug: "football-night",
      description:
        "The match is better together. Bring your snacks and your predictions. ⚽",
      visibility: "public",
      owner: "aarav",
      theme: "alpine",
      locked: false,
      logo: "⚽",
    },
    role: "member",
    members: [aarav, zoya, user, manav].map((person, index) => ({
      ...person,
      role: index === 0 ? "owner" : "member",
      online: true,
      typingUntil: 0,
      inCall: 0,
      muted: 0,
    })),
    messages: [
      message("d1", aarav, "Match starts in 10 minutes! 🔥"),
      message("d2", aarav, "Who else is watching?", 2000),
      message("d3", user, "Let’s go! Snacks are ready 🍿", 60000),
      message("d4", zoya, "Best seat in the house. ⚽", 100000, {
        attachmentId: "demo-stadium",
        fileName: "Match night.jpg",
        fileMime: "image/jpeg",
      }),
      message(
        "d5",
        manav,
        "I’m calling it. 2–1 tonight. What’s your prediction?",
        180000,
      ),
      message("d6", user, "Can’t wait for kickoff! ⚽", 240000),
    ],
    reactions: [
      { messageId: "d1", sessionId: "zoya", emoji: "🔥", name: "Zoya" },
      { messageId: "d1", sessionId: "manav", emoji: "❤️", name: "Manav" },
      { messageId: "d5", sessionId: "aarav", emoji: "👀", name: "Aarav" },
    ],
    signals: [],
    hasMore: false,
  };
}
