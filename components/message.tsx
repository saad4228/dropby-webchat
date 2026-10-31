"use client";
import { messageTime } from "../lib/format";
import { useEffect, useRef, useState } from "react";
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
  Play,
  Pause,
  Plus,
} from "lucide-react";
import { Avatar } from "./brand";
import { EmojiPicker } from "./emoji-picker";
import { Message as Msg, Identity, Snapshot } from "../lib/client";
import { EmojiText, EmojiGlyph } from "./animated-emoji";
import { emojiOnly } from "../lib/emoji-motion";
function VoicePlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null),
    [playing, setPlaying] = useState(false),
    [progress, setProgress] = useState(0),
    [duration, setDuration] = useState(0),
    [speed, setSpeed] = useState(1);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    fetch(src, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Audio unavailable");
        return r.arrayBuffer();
      })
      .then(async (bytes) => {
        const context = new OfflineAudioContext(1, 1, 48000);
        const decoded = await context.decodeAudioData(bytes);
        if (!live) return;
        setDuration(decoded.duration);
        const samples = decoded.getChannelData(0),
          step = Math.max(1, Math.floor(samples.length / 34));
        const values = Array.from({ length: 34 }, (_, i) => {
          let peak = 0;
          for (
            let j = i * step;
            j < Math.min(samples.length, (i + 1) * step);
            j += Math.max(1, Math.floor(step / 40))
          )
            peak = Math.max(peak, Math.abs(samples[j]));
          return peak;
        });
        const max = Math.max(0.01, ...values);
        setPeaks(values.map((v) => 6 + (v / max) * 22));
      })
      .catch(() => {});
    return () => {
      live = false;
      controller.abort();
    };
  }, [src]);
  return (
    <div className="voice-player">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={() =>
          Number.isFinite(ref.current!.duration) &&
          setDuration(ref.current!.duration)
        }
        onTimeUpdate={() => setProgress(ref.current!.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
      <button
        onClick={() => {
          if (playing) ref.current?.pause();
          else ref.current?.play().catch(() => setPlaying(false));
          setPlaying(!playing);
        }}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? (
          <Pause size={15} fill="currentColor" />
        ) : (
          <Play size={15} fill="currentColor" />
        )}
      </button>
      <div className="voice-wave">
        <div className="wave">
          {Array.from({ length: 34 }, (_, i) => (
            <i
              key={i}
              style={{
                height: peaks?.[i] || 8 + Math.abs(Math.sin(i * 2.4)) * 20,
                opacity: duration && i / 34 < progress / duration ? 1 : 0.35,
              }}
            />
          ))}
        </div>
        <input
          type="range"
          aria-label="Seek voice note"
          min={0}
          max={duration || 1}
          step={0.1}
          value={progress}
          onChange={(e) => {
            ref.current!.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
          }}
        />
      </div>
      <span>
        {Math.floor((playing ? progress : duration) / 60)}:
        {String(Math.floor((playing ? progress : duration) % 60)).padStart(
          2,
          "0",
        )}
      </span>
      <button
        className="speed"
        onClick={() => {
          const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
          setSpeed(next);
          ref.current!.playbackRate = next;
        }}
        aria-label="Change playback speed"
      >
        {speed}×
      </button>
    </div>
  );
}
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
                <img
                  src={
                    m.attachmentId === "demo-stadium"
                      ? "/stadium.jpg"
                      : "/api/media/" + m.attachmentId
                  }
                  alt={m.fileName || "Shared image"}
                  loading="lazy"
                />
              </button>
            ) : m.fileMime?.startsWith("video/") ? (
              <video
                src={
                  m.attachmentId === "demo-stadium"
                    ? "/stadium.jpg"
                    : "/api/media/" + m.attachmentId
                }
                controls
                playsInline
                preload="metadata"
              />
            ) : m.fileMime?.startsWith("audio/") ? (
              <VoicePlayer
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
                  <small>{((m.fileSize || 0) / 1024).toFixed(0)} KB</small>
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
