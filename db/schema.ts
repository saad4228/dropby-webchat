import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const sessions = sqliteTable("sessions", {
  id: text().primaryKey(),
  tokenHash: text().notNull().unique(),
  name: text().notNull(),
  avatar: text().notNull(),
  color: text().notNull(),
  expires: integer().notNull(),
  accountId: text().unique(),
  avatarImageId: text(),
});
export const rooms = sqliteTable("rooms", {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  description: text().notNull().default(""),
  visibility: text().notNull(),
  passwordHash: text(),
  owner: text().notNull(),
  theme: text().notNull().default("alpine"),
  logo: text().notNull().default("✳"),
  logoImageId: text(),
  locked: integer().notNull().default(0),
  created: integer().notNull(),
});
export const memberships = sqliteTable(
  "memberships",
  {
    roomId: text().notNull(),
    sessionId: text().notNull(),
    role: text().notNull().default("member"),
    banned: integer().notNull().default(0),
    muted: integer().notNull().default(0),
    lastSeen: integer().notNull(),
    typingUntil: integer().notNull().default(0),
    inCall: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.sessionId] })],
);
export const messages = sqliteTable(
  "messages",
  {
    id: text().primaryKey(),
    roomId: text().notNull(),
    senderId: text().notNull(),
    text: text().notNull(),
    replyId: text(),
    attachmentId: text(),
    created: integer().notNull(),
    edited: integer(),
    deleted: integer().notNull().default(0),
    pinned: integer().notNull().default(0),
  },
  (t) => [index("message_room_created").on(t.roomId, t.created)],
);
export const revisions = sqliteTable("revisions", {
  id: text().primaryKey(),
  messageId: text().notNull(),
  text: text().notNull(),
  created: integer().notNull(),
});
export const attachments = sqliteTable("attachments", {
  id: text().primaryKey(),
  roomId: text().notNull(),
  senderId: text().notNull(),
  name: text().notNull(),
  mime: text().notNull(),
  size: integer().notNull(),
  created: integer().notNull(),
  provider: text().notNull().default("supabase"),
  storagePath: text(),
  purpose: text().notNull().default("chat"),
  state: text().notNull().default("attached"),
  expectedSize: integer().notNull().default(0),
  expires: integer(),
  thumbnailId: text(),
  parentId: text(),
  duration: real(),
  waveform: text(),
  deletedAt: integer(),
  resumableUrl: text(),
});
export const mediaAlerts = sqliteTable("media_alerts", {
  id: text().primaryKey(),
  threshold: integer().notNull(),
  used: integer().notNull(),
  created: integer().notNull(),
  acknowledged: integer().notNull().default(0),
});
export const reactions = sqliteTable(
  "reactions",
  {
    messageId: text().notNull(),
    sessionId: text().notNull(),
    emoji: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.sessionId, t.emoji] })],
);
export const reports = sqliteTable("reports", {
  id: text().primaryKey(),
  roomId: text().notNull(),
  messageId: text().notNull(),
  reporterId: text().notNull(),
  reason: text().notNull(),
  created: integer().notNull(),
});
export const signals = sqliteTable(
  "signals",
  {
    id: text().primaryKey(),
    roomId: text().notNull(),
    senderId: text().notNull(),
    recipientId: text().notNull(),
    data: text().notNull(),
    created: integer().notNull(),
  },
  (t) => [index("signals_recipient").on(t.recipientId, t.created)],
);
export const rateLimits = sqliteTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  expires: integer().notNull(),
});
export const musicStates = sqliteTable("music_states", {
  roomId: text().primaryKey(),
  trackId: text(),
  controllerId: text(),
  position: real().notNull().default(0),
  playing: integer().notNull().default(0),
  updatedAt: integer().notNull(),
  revision: integer().notNull().default(0),
});
export const musicTracks = sqliteTable(
  "music_tracks",
  {
    id: text().primaryKey(),
    roomId: text().notNull(),
    attachmentId: text().notNull().unique(),
    title: text().notNull(),
    duration: real().notNull(),
    addedBy: text().notNull(),
    created: integer().notNull(),
    played: integer().notNull().default(0),
  },
  (t) => [index("music_queue").on(t.roomId, t.played, t.created)],
);
export const musicChoices = sqliteTable(
  "music_choices",
  {
    roomId: text().notNull(),
    sessionId: text().notNull(),
    trackId: text().notNull(),
    response: text().notNull(),
    changeRequested: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.sessionId] })],
);
