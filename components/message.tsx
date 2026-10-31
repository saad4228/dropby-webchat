"use client";
import { MediaImage, MediaVideo, VoicePlayer } from "./media-content";
import { formatBytes } from "../lib/media-config";
import { messageTime } from "../lib/format";
import { useRef, useState } from "react";
import {
  CheckCheck,
  MoreHorizontal,
  Reply,
  Copy,
  Pin,
  Pencil,
  Trash2,
  Flag,
  Download,
  FileText,
  Plus,
} from "lucide-react";
import { Avatar } from "./brand";
import { EmojiPicker } from "./emoji-picker";
import { Message as Msg, Identity, Snapshot } from "../lib/client";
import { EmojiText, EmojiGlyph } from "./animated-emoji";
import { emojiOnly } from "../lib/emoji-motion";
export default function Message({
  message: m,
  user,
  snapshot,
  grouped,
  onAction,
  onView,
}: {
  message: Msg;
  user: Identity;
  snapshot: Snapshot;
  grouped: boolean;
  onAction: (action: string, message: Msg, value?: string) => void;
  onView: (m: Msg) => void;
}) {
  const own = m.senderId === user.id,
    [menu, setMenu] = useState(false),
    [react, setReact] = useState(false);
  const largeEmoji = !m.attachmentId && emojiOnly(m.text);
  const reply = snapshot.messages.find((a) => a.id === m.replyId);
  const reactions = snapshot.reactions.filter((r) => r.messageId === m.id);
  const emojis = [...new Set(reactions.map((r) => r.emoji))];
  let longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <article
      id={"message-" + m.id}
      className={
        "message-row " + (own ? "own " : "") + (grouped ? "grouped" : "")
      }
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu(!menu);
      }}
      onTouchStart={() => {
        longPress.current = setTimeout(() => setMenu(true), 650);
      }}
      onTouchEnd={() => {
        if (longPress.current) clearTimeout(longPress.current);
      }}
      onTouchMove={() => {
        if (longPress.current) clearTimeout(longPress.current);
      }}
    >
      {!grouped && <Avatar name={m.name} avatar={m.avatar} color={m.color} />}
      <div className="message-content">
        {!grouped && !own && (
          <div className="message-byline">
            <strong>{m.name}</strong>
            <time>{messageTime(m.created)}</time>
            {!!m.pinned && <Pin size={12} />}
          </div>
        )}
        <div
          className={
            "message-bubble " +
            (m.attachmentId ? "with-media" : "") +
            (largeEmoji ? " emoji-only" : "")
          }
          onDoubleClick={() => onAction("reaction", m, "❤️")}
        >
          {m.replyId && (
            <button
              className="reply-preview"
              onClick={() =>
                document
                  .getElementById("message-" + m.replyId)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              <strong>{reply?.name || "Original message"}</strong>
              <span>
                {reply?.text || reply?.fileName || "Message unavailable"}
              </span>
            </button>
          )}
          {m.attachmentId &&
            (m.fileMime?.startsWith("image/") ? (
              <button className="image-message" onClick={() => onView(m)}>
                <MediaImage
                  src={
                    m.attachmentId === "demo-stadium"
                      ? "/stadium.jpg"
                      : "/api/media/" + (m.thumbnailId || m.attachmentId)
                  }
                  alt={m.fileName || "Shared image"}
                />
              </button>
            ) : m.fileMime?.startsWith("video/") ? (
              <MediaVideo
                src={"/api/media/" + m.attachmentId}
                poster={
                  m.thumbnailId ? "/api/media/" + m.thumbnailId : undefined
                }
                name={m.fileName || "Shared video"}
              />
            ) : m.fileMime?.startsWith("audio/") ? (
              <VoicePlayer
                duration={m.duration || 0}
                waveform={m.waveform}
                src={
                  m.attachmentId === "demo-stadium"
                    ? "/stadium.jpg"
                    : "/api/media/" + m.attachmentId
                }
              />
            ) : (
              <a
                className="file-message"
                href={"/api/media/" + m.attachmentId}
                download={m.fileName}
              >
                <FileText size={26} />
                <span>
                  <strong>{m.fileName}</strong>
                  <small>
                    {m.fileMime === "application/pdf"
                      ? "PDF"
                      : m.fileMime === "text/plain"
                        ? "Text document"
                        : "Document"}{" "}
                    · {formatBytes(m.fileSize || 0)}
                  </small>
                </span>
                <Download size={18} />
              </a>
            ))}
          {m.text && (
            <p>
              {m.text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                /^https?:\/\//.test(part) ? (
                  <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {part}
                  </a>
                ) : (
                  <EmojiText
                    key={i}
                    text={part}
                    large={largeEmoji}
                    animateOnMount={Date.now() - m.created < 10000}
                  />
                ),
              )}
            </p>
          )}
          {m.edited && <small className="edited-label">edited</small>}
        </div>
        {emojis.length > 0 && (
          <div className="message-reactions">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                className={
                  reactions.some(
                    (r) => r.emoji === emoji && r.sessionId === user.id,
                  )
                    ? "mine"
                    : ""
                }
                onClick={() => onAction("reaction", m, emoji)}
                title={reactions
                  .filter((r) => r.emoji === emoji)
                  .map((r) => r.name)
                  .join(", ")}
              >
                <EmojiGlyph emoji={emoji} />{" "}
                <span>{reactions.filter((r) => r.emoji === emoji).length}</span>
              </button>
            ))}
            <button onClick={() => setReact(!react)} aria-label="Add reaction">
              <Plus size={13} />
            </button>
          </div>
        )}
        {own && (
          <div className="message-receipt">
            <time>{messageTime(m.created)}</time>
            <CheckCheck size={15} aria-label="Saved to room" />
          </div>
        )}
      </div>
      <button
        className="message-menu-trigger"
        aria-label="Message actions"
        onClick={() => setMenu(!menu)}
      >
        <MoreHorizontal size={18} />
      </button>
      {(menu || react) && (
        <>
          <button
            className="popover-dismiss"
            aria-label="Close message actions"
            onClick={() => {
              setMenu(false);
              setReact(false);
            }}
          />
          <div className={"message-menu " + (react ? "all-reactions" : "")}>
            {react ? (
              <EmojiPicker
                onClose={() => setReact(false)}
                onSelect={(e) => {
                  onAction("reaction", m, e);
                  setMenu(false);
                }}
              />
            ) : (
              <div className="reaction-picker">
                {["❤️", "🔥", "👍", "😂", "😍", "🎉", "⚽", "👀"].map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      onAction("reaction", m, e);
                      setMenu(false);
                      setReact(false);
                    }}
                    aria-label={"React " + e}
                  >
                    {e}
                  </button>
                ))}
                <button
                  aria-label="More reaction emojis"
                  onClick={() => {
                    setMenu(false);
                    setReact(true);
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>
            )}
            {menu && (
              <>
                {[
                  ["reply", "Reply", Reply],
                  ["copy", "Copy text", Copy],
                  ...(["owner", "moderator"].includes(snapshot.role)
                    ? [["pin", m.pinned ? "Unpin message" : "Pin message", Pin]]
                    : []),
                  ...(own ? [["edit", "Edit message", Pencil]] : []),
                  ...(own || ["owner", "moderator"].includes(snapshot.role)
                    ? [["delete", "Delete message", Trash2]]
                    : []),
                  ...(!own ? [["report", "Report message", Flag]] : []),
                ].map(([id, label, Icon]: any) => (
                  <button
                    key={id}
                    onClick={() => {
                      onAction(id, m);
                      setMenu(false);
                    }}
                    className={id === "delete" ? "danger" : ""}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
}
