"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Hash,
  Headphones,
  Image,
  Link,
  Lock,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pause,
  Phone,
  Pin,
  Play,
  Plus,
  Search,
  Send,
  Smile,
  Square,
  Sun,
  Moon,
  Trash2,
  Users,
  Video,
  X,
  WifiOff,
  LoaderCircle,
  Volume2,
} from "lucide-react";
import {
  api,
  parseApiResponse,
  Identity,
  Snapshot,
  Message as Msg,
  colors,
} from "../lib/client";
import { loadAppearance, saveAppearance } from "../lib/appearance-store";
import { EmojiPicker } from "./emoji-picker";
import { RoomMark } from "./room-mark";
import { Brand, Avatar } from "./brand";
import Message from "./message";
import RoomPanels, { Appearance, defaultAppearance } from "./room-panels";
import CallPanel from "./call-panel";
import { useCall } from "../hooks/use-call";
import { Modal } from "./modal";
import { getTheme } from "../lib/themes";
import { EmojiEffects } from "./animated-emoji";
import { ThemeScene } from "./theme-scene";
import RoomMusic from "./room-music";
const time = Date.now() - 8 * 60000;
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
    members: [
      {
        id: "aarav",
        name: "Aarav",
        avatar: "👨🏻",
        color: "#bf9f89",
        role: "owner",
        online: true,
        typingUntil: 0,
        inCall: 0,
        muted: 0,
      },
      {
        id: "zoya",
        name: "Zoya",
        avatar: "👩🏽",
        color: "#d3b59b",
        role: "member",
        online: true,
        typingUntil: 0,
        inCall: 0,
        muted: 0,
      },
      {
        ...user,
        role: "member",
        online: true,
        typingUntil: 0,
        inCall: 0,
        muted: 0,
      },
      {
        id: "manav",
        name: "Manav",
        avatar: "👨🏽‍🦱",
        color: "#a6b7cc",
        role: "member",
        online: true,
        typingUntil: 0,
        inCall: 0,
        muted: 0,
      },
    ],
    messages: [
      {
        id: "d1",
        senderId: "aarav",
        name: "Aarav",
        avatar: "👨🏻",
        color: "#bf9f89",
        text: "Match starts in 10 minutes! 🔥",
        created: time,
      },
      {
        id: "d2",
        senderId: "aarav",
        name: "Aarav",
        avatar: "👨🏻",
        color: "#bf9f89",
        text: "Who else is watching?",
        created: time + 2000,
      },
      {
        id: "d3",
        senderId: user.id,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
        text: "Let’s go! Snacks are ready 🍿",
        created: time + 60000,
      },
      {
        id: "d4",
        senderId: "zoya",
        name: "Zoya",
        avatar: "👩🏽",
        color: "#d3b59b",
        text: "Best seat in the house. ⚽",
        attachmentId: "demo-stadium",
        fileName: "Match night.jpg",
        fileMime: "image/jpeg",
        created: time + 100000,
      },
      {
        id: "d5",
        senderId: "manav",
        name: "Manav",
        avatar: "👨🏽‍🦱",
        color: "#a6b7cc",
        text: "I’m calling it. 2–1 tonight. What’s your prediction?",
        created: time + 180000,
      },
      {
        id: "d6",
        senderId: user.id,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
        text: "Can’t wait for kickoff! ⚽",
        created: time + 240000,
      },
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
export default function Chat({
  slug,
  user,
  dark,
  onDark,
  onLeave,
  onIdentity,
  demo = false,
  onCreate,
}: {
  slug: string;
  user: Identity;
  dark: boolean;
  onDark: () => void;
  onLeave: () => void;
  onIdentity: () => void;
  demo?: boolean;
  onCreate: () => void;
}) {
  const [data, setData] = useState<Snapshot | null>(
      demo ? demoSnapshot(user) : null,
    ),
    [panel, setPanel] = useState(""),
    [text, setText] = useState(""),
    [reply, setReply] = useState<Msg | null>(null),
    [edit, setEdit] = useState<Msg | null>(null),
    [error, setError] = useState(""),
    [offline, setOffline] = useState(false),
    [restricted, setRestricted] = useState(false),
    [sending, setSending] = useState(false),
    [pending, setPending] = useState<{
      id: string;
      text: string;
      replyId?: string;
      attachmentId?: string;
    } | null>(null),
    [upload, setUpload] = useState<{
      id: string;
      name: string;
      mime: string;
      size: number;
    } | null>(null),
    [uploadProgress, setUploadProgress] = useState(-1),
    [emoji, setEmoji] = useState(false),
    [viewer, setViewer] = useState<Msg | null>(null),
    [appearance, setAppearance] = useState<Appearance>(defaultAppearance),
    [wallpaperUrl, setWallpaperUrl] = useState(""),
    [recording, setRecording] = useState(false),
    [paused, setPaused] = useState(false),
    [recordSeconds, setRecordSeconds] = useState(0),
    [recordPreview, setRecordPreview] = useState<Blob | null>(null),
    [recordUrl, setRecordUrl] = useState(""),
    [older, setOlder] = useState<Msg[]>([]),
    [olderBusy, setOlderBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null),
    bottom = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    recorder = useRef<MediaRecorder | null>(null),
    chunks = useRef<Blob[]>([]),
    recordStream = useRef<MediaStream | null>(null),
    lastTyping = useRef(0),
    fetching = useRef(false),
    uploadRequest = useRef<XMLHttpRequest | null>(null),
    initialScroll = useRef(true),
    nearBottom = useRef(true),
    firstLoad = useRef(true);
  const activeCall = useRef(false);
  const appearanceTouched = useRef(false);
  const notify = useCallback((message: string) => {
    if (message.startsWith("OPEN:")) setPanel(message.slice(5));
    else setError(message);
  }, []);
  const refresh = useCallback(async () => {
    if (demo || fetching.current) return;
    fetching.current = true;
    try {
      const s = await api("rooms/" + slug);
      setData(s);
      setOffline(false);
      setRestricted(false);
      firstLoad.current = false;
    } catch (e: any) {
      setOffline(true);
      if (e.status === 401 || e.status === 403) {
        setRestricted(true);
        setData(null);
      }
      if (firstLoad.current || e.status === 401 || e.status === 403)
        setError(e.message);
    } finally {
      fetching.current = false;
    }
  }, [slug, demo]);
  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible" || activeCall.current)
        refresh();
    }, 1500);
    const online = () => refresh();
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", online);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", online);
    };
  }, [refresh]);
  useEffect(() => {
    let live = true;
    appearanceTouched.current = false;
    loadAppearance(slug).then((saved) => {
      if (live && !appearanceTouched.current)
        setAppearance({ ...defaultAppearance, ...saved });
    });
    return () => {
      live = false;
    };
  }, [slug]);
  function changeAppearance(a: Appearance) {
    appearanceTouched.current = true;
    setAppearance(a);
    saveAppearance(slug, a).catch(() =>
      notify(
        "Your browser could not save this appearance. It is applied for this visit.",
      ),
    );
  }
  useEffect(() => {
    let live = true,
      url = "";
    if (!appearance.background) {
      setWallpaperUrl("");
      return;
    }
    if (!appearance.background.startsWith("data:image/")) {
      setWallpaperUrl(appearance.background);
      return;
    }
    // CSS custom properties reject multi-megabyte data URLs. Render a short
    // object URL while retaining the original image in IndexedDB.
    fetch(appearance.background)
      .then((r) => r.blob())
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setWallpaperUrl(url);
      })
      .catch(() =>
        notify("This wallpaper could not be opened. Choose another image."),
      );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [appearance.background, notify]);
  useEffect(() => {
    if (initialScroll.current || nearBottom.current) {
      bottom.current?.scrollIntoView({
        behavior: initialScroll.current ? "instant" : "smooth",
      });
      initialScroll.current = false;
    }
  }, [data?.messages.length]);
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(""), 6500);
    return () => clearTimeout(id);
  }, [error]);
  useEffect(() => {
    if (!recording || paused) return;
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording, paused]);
  useEffect(
    () => () => {
      recorder.current?.state === "recording" && recorder.current.stop();
      recordStream.current?.getTracks().forEach((t) => t.stop());
      uploadRequest.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!recordPreview) {
      setRecordUrl("");
      return;
    }
    const url = URL.createObjectURL(recordPreview);
    setRecordUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordPreview]);
  const call = useCall(slug, user.id, demo ? null : data, refresh, notify);
  activeCall.current = call.active;
  useEffect(() => {
    if (restricted && call.active) call.stop();
  }, [restricted, call.active]);
  const allMessages = [...older, ...(data?.messages || [])].filter(
    (m, i, a) => a.findIndex((x) => x.id === m.id) === i,
  );
  const fullData = data ? { ...data, messages: allMessages } : null;
  const images = allMessages.filter((m) => m.fileMime?.startsWith("image/"));
  const viewerIndex = images.findIndex((m) => m.id === viewer?.id);
  function moveViewer(delta: number) {
    const next = images[viewerIndex + delta];
    if (next) setViewer(next);
  }
  useEffect(() => {
    if (!viewer) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") moveViewer(-1);
      if (e.key === "ArrowRight") moveViewer(1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [viewer?.id, images.length]);
  async function send(retry = false) {
    const body =
      retry && pending
        ? pending
        : {
            id: crypto.randomUUID(),
            text: text.trim(),
            replyId: reply?.id,
            attachmentId: upload?.id,
          };
    if (!body.text && !body.attachmentId) return;
    setSending(true);
    setPending(body);
    try {
      if (edit && !retry) {
        if (demo)
          setData((s) =>
            s
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === edit.id
                      ? { ...m, text: body.text, edited: Date.now() }
                      : m,
                  ),
                }
              : s,
          );
        else
          await api(
            "rooms/" + slug + "/messages/" + edit.id,
            { text: body.text },
            "PATCH",
          );
      } else if (demo)
        setData((s) =>
          s
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    ...body,
                    senderId: user.id,
                    name: user.name,
                    avatar: user.avatar,
                    color: user.color,
                    created: Date.now(),
                  },
                ],
              }
            : s,
        );
      else await api("rooms/" + slug + "/messages", body);
      setText("");
      setReply(null);
      setEdit(null);
      setUpload(null);
      setPending(null);
      nearBottom.current = true;
      await refresh();
      input.current?.focus();
    } catch (e: any) {
      notify(e.message + " Your message is ready to retry.");
    } finally {
      setSending(false);
    }
  }
  async function action(action: string, m: Msg, value?: string) {
    if (action === "reply") {
      setReply(m);
      setEdit(null);
      input.current?.focus();
      return;
    }
    if (action === "edit") {
      setEdit(m);
      setReply(null);
      setText(m.text);
      input.current?.focus();
      return;
    }
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(m.text);
        notify("Message copied.");
      } catch {
        notify("Your browser could not copy this message.");
      }
      return;
    }
    if (action === "delete" && !confirm("Delete this message for everyone?"))
      return;
    const reason =
      action === "report"
        ? prompt("What would you like the moderators to know?")
        : "";
    if (action === "report" && !reason) return;
    try {
      if (demo) {
        if (action === "reaction")
          setData((s) => {
            if (!s) return s;
            const has = s.reactions.some(
              (r) =>
                r.messageId === m.id &&
                r.sessionId === user.id &&
                r.emoji === value,
            );
            return {
              ...s,
              reactions: has
                ? s.reactions.filter(
                    (r) =>
                      !(
                        r.messageId === m.id &&
                        r.sessionId === user.id &&
                        r.emoji === value
                      ),
                  )
                : [
                    ...s.reactions,
                    {
                      messageId: m.id,
                      sessionId: user.id,
                      emoji: value!,
                      name: user.name,
                    },
                  ],
            };
          });
        else if (action === "delete")
          setData((s) =>
            s ? { ...s, messages: s.messages.filter((a) => a.id !== m.id) } : s,
          );
        else notify("Create your own room to use moderation tools.");
        return;
      }
      const path = "rooms/" + slug + "/messages/" + m.id;
      if (action === "reaction")
        await api(path + "/reaction", { emoji: value });
      else if (action === "delete") {
        await api(path, undefined, "DELETE");
        setOlder((a) => a.filter((x) => x.id !== m.id));
      } else if (action === "pin") await api(path + "/pin", {});
      else if (action === "report") {
        await api(path + "/report", { reason });
        notify("Report sent to the room moderators.");
      }
      await refresh();
    } catch (e: any) {
      notify(e.message);
    }
  }
  function uploadFile(file: File) {
    if (demo) {
      notify("Create a real room to share and save files.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      notify("Choose a file under 15 MB.");
      return;
    }
    setUploadProgress(0);
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    uploadRequest.current = xhr;
    xhr.open("POST", "/api/rooms/" + slug + "/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploadProgress(-1);
      try {
        const result = parseApiResponse(xhr.responseText, xhr.status);
        setUpload(result.attachment);
        input.current?.focus();
      } catch (e: any) {
        notify(e.message || "The upload did not finish. Try again.");
      }
    };
    xhr.onerror = () => {
      setUploadProgress(-1);
      notify("Upload interrupted. Choose your file to try again.");
    };
    xhr.onabort = () => setUploadProgress(-1);
    xhr.send(form);
  }
  async function startRecording() {
    if (demo) {
      notify("Create a real room to send voice notes.");
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("Voice recording is not supported in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStream.current = stream;
      const mime = ["audio/webm", "audio/ogg", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        if (chunks.current.length)
          setRecordPreview(new Blob(chunks.current, { type: rec.mimeType }));
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setPaused(false);
      };
      rec.start(250);
      setRecordSeconds(0);
      setRecording(true);
    } catch (e: any) {
      notify(
        e.name === "NotAllowedError"
          ? "Allow microphone access to record a voice note."
          : e.message,
      );
    }
  }
  function cancelRecording() {
    chunks.current = [];
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    recordStream.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setRecordPreview(null);
  }
  const togglePanel = (s: string) => setPanel(panel === s ? "" : s);
  const beginCall = (video: boolean) => {
    if (demo) {
      notify("Create your own room to start a real call.");
      return;
    }
    call.start(video);
  };
  async function leave() {
    if (call.active) call.stop();
    if (!demo) await api("rooms/" + slug + "/leave", {}).catch(() => {});
    onLeave();
  }
  async function loadOlder() {
    if (!data || olderBusy) return;
    setOlderBusy(true);
    try {
      const s = await api(
        "rooms/" + slug + "?before=" + allMessages[0].created,
      );
      setOlder((a) => [...s.messages, ...a]);
      if (!s.hasMore) setData((d) => (d ? { ...d, hasMore: false } : d));
    } catch (e: any) {
      notify(e.message);
    } finally {
      setOlderBusy(false);
    }
  }
  const theme = appearance.theme || data?.room.theme || "alpine";
  const themeInfo = getTheme(theme);
  const custom: React.CSSProperties & Record<string, any> = {
    "--glass-opacity": appearance.opacity / 100,
    "--glass-blur": appearance.blur + "px",
  };
  if (appearance.accent) {
    custom["--accent"] = appearance.accent;
    custom["--accent-ink"] = contrast(appearance.accent);
  }
  if (appearance.sent) {
    custom["--sent"] = appearance.sent;
    custom["--sent-text"] = contrast(appearance.sent);
  }
  if (appearance.received) {
    custom["--received"] = appearance.received;
    custom["--received-text"] = contrast(appearance.received);
  }
  if (wallpaperUrl) custom["--custom-wallpaper"] = `url("${wallpaperUrl}")`;
  return (
    <div
      className={
        "chat-app theme-" +
        theme +
        (appearance.animations ? " motion-on" : " motion-off")
      }
      style={custom}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="chat-scenery" />
      <ThemeScene theme={theme} />
      <EmojiEffects enabled={appearance.animations} />
      <header className="room-header">
        <button className="room-home" aria-label="Back to home" onClick={leave}>
          {data ? (
            <RoomMark room={data.room} />
          ) : (
            <MessageCircle fill="currentColor" size={27} strokeWidth={0} />
          )}
        </button>
        <button className="room-title" onClick={() => togglePanel("settings")}>
          <strong>
            {slug}
            <ChevronDown size={15} />
          </strong>
          <span>
            {demo ? (
              <>
                <i className="demo-status" /> Interactive demo
              </>
            ) : (
              <>
                <i className={offline ? "offline-dot" : "live-dot"} />
                {offline
                  ? "Reconnecting…"
                  : `${data?.members.filter((m) => m.online).length || 1} here with you`}
              </>
            )}
          </span>
        </button>
        <div className="header-room-tag">
          <span aria-hidden="true">{themeInfo.icon}</span>
          {themeInfo.name}
        </div>
        <div className="room-header-actions">
          <button
            className="icon-button"
            onClick={() => beginCall(false)}
            aria-label="Start audio call"
          >
            <Phone size={20} />
          </button>
          <button
            className="icon-button"
            onClick={() => beginCall(true)}
            aria-label="Start video call"
          >
            <Video size={21} />
          </button>
          <span className="header-divider" />
          <button
            className={"icon-button " + (panel === "members" ? "selected" : "")}
            onClick={() => togglePanel("members")}
            aria-label="Show room members"
          >
            <Users size={21} />
          </button>
          <button
            className={
              "icon-button " + (panel === "appearance" ? "selected" : "")
            }
            onClick={() => togglePanel("appearance")}
            aria-label="Change room appearance"
          >
            <Sun size={21} />
          </button>
          <button
            className="icon-button share-header"
            onClick={() => togglePanel("share")}
            aria-label="Invite your people"
          >
            <Link size={20} />
          </button>
          <button
            className={"icon-button " + (panel === "more" ? "selected" : "")}
            onClick={() => togglePanel("more")}
            aria-label="More room options"
          >
            <MoreHorizontal size={22} />
          </button>
        </div>
      </header>
      <RoomMusic
        slug={slug}
        userId={user.id}
        role={data?.role || "member"}
        restricted={
          restricted || !!data?.members.find((m) => m.id === user.id)?.muted
        }
        demo={demo}
        onCreate={onCreate}
      />
      {demo && (
        <div className="demo-banner">
          <span>
            Just exploring? You’re in a demo room. Say hello and try a reaction.
          </span>
          <button onClick={onCreate}>
            Make a real room <ArrowUpRightIcon />
          </button>
        </div>
      )}
      <main className="conversation-shell">
        <div
          className="conversation-scroll"
          ref={scroller}
          onScroll={() => {
            const el = scroller.current;
            if (el)
              nearBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 140;
          }}
        >
          {!data ? (
            <div className="room-loading">
              {restricted ? (
                <Lock size={27} />
              ) : (
                <LoaderCircle className="spin" size={27} />
              )}
              <h3>
                {restricted
                  ? "Your access to this room has ended."
                  : offline
                    ? "Let’s reconnect."
                    : "Finding your people…"}
              </h3>
              <p>
                {restricted
                  ? "You can return home and join another conversation."
                  : offline
                    ? "Check your connection, then try again."
                    : "Make yourself comfortable."}
              </p>
              {restricted ? (
                <button className="primary" onClick={onLeave}>
                  Back to home
                </button>
              ) : (
                offline && (
                  <button className="primary" onClick={refresh}>
                    Try again
                  </button>
                )
              )}
            </div>
          ) : (
            <>
              <div className="room-welcome">
                <span className="room-welcome-icon">
                  <RoomMark room={data.room} />
                </span>
                <span className="section-label">
                  {demo ? "MATCH NIGHT. GOOD COMPANY." : themeInfo.eyebrow}
                </span>
                <h2>
                  {demo
                    ? "The match is better together."
                    : `Welcome to ${slug}.`}
                </h2>
                <p>
                  {data.room.description ||
                    "No big agenda. Just a good place to be together."}
                </p>
                <button onClick={() => setPanel("share")}>
                  <Link size={13} /> Invite your people <ArrowRight size={13} />
                </button>
              </div>
              <div className="chat-date">
                <span>
                  {new Date().toLocaleDateString([], {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <Lock size={10} /> A shared space. Keep it kind.
              </div>
              {data.hasMore && (
                <button
                  className="load-earlier"
                  onClick={loadOlder}
                  disabled={olderBusy}
                >
                  {olderBusy ? "Loading…" : "A little further back"}
                </button>
              )}
              {!allMessages.length && (
                <div className="empty-room">
                  <div>
                    <MessageCircle size={25} />
                    <span>👋</span>
                  </div>
                  <h3>A good conversation starts with hello.</h3>
                  <p>
                    It’s a little quiet here. Be the first to say something.
                  </p>
                  <div className="hello-suggestions">
                    {[
                      "Hey everyone! 👋",
                      "What’s the plan?",
                      "Glad you’re here. ✨",
                    ].map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setText(t);
                          input.current?.focus();
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="message-list">
                {allMessages.map((m, i) => (
                  <Message
                    key={m.id}
                    message={m}
                    user={user}
                    snapshot={fullData!}
                    grouped={
                      i > 0 &&
                      allMessages[i - 1].senderId === m.senderId &&
                      m.created - allMessages[i - 1].created < 180000
                    }
                    onAction={action}
                    onView={setViewer}
                  />
                ))}
              </div>
              <div className="typing-indicator">
                {data.members
                  .filter((m) => m.id !== user.id && m.typingUntil > Date.now())
                  .map((m) => m.name)
                  .join(", ")}
                {data.members.some(
                  (m) => m.id !== user.id && m.typingUntil > Date.now(),
                ) && (
                  <span>
                    {" "}
                    is typing <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              <div ref={bottom} />
            </>
          )}
        </div>
        <div className="composer-area">
          {data?.members.some((m) => m.inCall && m.online) && !call.active && (
            <div className="incoming-call">
              <span className="call-pulse" />
              <span>Your people are in a call.</span>
              <button onClick={() => beginCall(false)}>
                Join them <ArrowRight size={14} />
              </button>
            </div>
          )}
          {pending && !sending && (
            <div className="pending-message">
              <WifiOff size={15} />
              <span>Your message hasn’t been saved yet.</span>
              <button onClick={() => send(true)}>Try again</button>
              <button
                onClick={() => setPending(null)}
                aria-label="Dismiss retry"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {(reply || edit) && (
            <div className="composer-context">
              <span>
                <strong>
                  {edit ? "Editing your message" : "Replying to " + reply?.name}
                </strong>
                <small>
                  {(edit || reply)?.text || (edit || reply)?.fileName}
                </small>
              </span>
              <button
                onClick={() => {
                  setReply(null);
                  setEdit(null);
                  if (edit) setText("");
                }}
                aria-label="Cancel reply or edit"
              >
                <X size={17} />
              </button>
            </div>
          )}
          {(upload || uploadProgress >= 0) && (
            <div className="composer-context">
              <Image size={20} />
              <span>
                <strong>
                  {uploadProgress >= 0
                    ? "Uploading your moment… " + uploadProgress + "%"
                    : upload?.name}
                </strong>
                <small>
                  {uploadProgress >= 0
                    ? "A little patience. Almost there."
                    : "Ready to send"}
                </small>
              </span>
              <button
                onClick={() => {
                  uploadRequest.current?.abort();
                  setUpload(null);
                }}
                aria-label="Remove attachment"
              >
                <X size={17} />
              </button>
            </div>
          )}
          {recordPreview && (
            <div className="record-preview">
              <button
                aria-label="Discard voice note"
                onClick={() => setRecordPreview(null)}
              >
                <Trash2 size={18} />
              </button>
              <audio controls src={recordUrl} />
              <button
                className="text-link"
                onClick={() => {
                  const type = recordPreview.type.split(";")[0];
                  uploadFile(
                    new File(
                      [recordPreview],
                      "voice-note." +
                        (type.includes("mp4")
                          ? "m4a"
                          : type.includes("ogg")
                            ? "ogg"
                            : "webm"),
                      { type },
                    ),
                  );
                  setRecordPreview(null);
                }}
              >
                Attach note <ArrowRight size={15} />
              </button>
            </div>
          )}
          {recording ? (
            <div className="recording-bar">
              <button aria-label="Cancel recording" onClick={cancelRecording}>
                <Trash2 size={19} />
              </button>
              <i className="record-dot" />
              <strong>
                {paused ? "Paused" : "Recording"}{" "}
                {Math.floor(recordSeconds / 60)}:
                {String(recordSeconds % 60).padStart(2, "0")}
              </strong>
              <span className="record-wave">
                {Array.from({ length: 22 }, (_, i) => (
                  <i
                    key={i}
                    style={{ height: 6 + Math.abs(Math.sin(i * 2)) * 22 }}
                  />
                ))}
              </span>
              <button
                onClick={() => {
                  if (paused) recorder.current?.resume();
                  else recorder.current?.pause();
                  setPaused(!paused);
                }}
                aria-label={paused ? "Resume recording" : "Pause recording"}
              >
                {paused ? <Play size={18} /> : <Pause size={18} />}
              </button>
              <button
                className="stop-record"
                onClick={() => recorder.current?.stop()}
                aria-label="Stop and preview recording"
              >
                <Square size={17} fill="currentColor" />
              </button>
            </div>
          ) : (
            <div className="composer">
              <button
                className="attach-button"
                aria-label="Attach a photo, video or file"
                onClick={() => fileInput.current?.click()}
              >
                <Plus size={23} />
              </button>
              <div className="composer-input">
                <textarea
                  ref={input}
                  rows={1}
                  maxLength={6000}
                  placeholder="A thought, a hello, a little something…"
                  aria-label="Your message"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 140) + "px";
                    if (!demo && Date.now() - lastTyping.current > 2500) {
                      lastTyping.current = Date.now();
                      api("rooms/" + slug + "/typing", {}).catch(() => {});
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  onPaste={(e) => {
                    const f = e.clipboardData.files[0];
                    if (f) {
                      e.preventDefault();
                      uploadFile(f);
                    }
                  }}
                />
                <button
                  className={
                    "icon-button emoji-toggle " + (emoji ? "selected" : "")
                  }
                  onClick={() => setEmoji(!emoji)}
                  aria-label="Choose an emoji"
                >
                  <Smile size={21} />
                </button>
                <button
                  className="icon-button image-toggle"
                  onClick={() => fileInput.current?.click()}
                  aria-label="Share an image"
                >
                  <Image size={20} />
                </button>
                <button
                  className="icon-button"
                  onClick={startRecording}
                  aria-label="Record a voice note"
                >
                  <Mic size={21} />
                </button>
              </div>
              <button
                className="send-button"
                onClick={() => send()}
                disabled={sending || (!text.trim() && !upload)}
                aria-label={edit ? "Save message edit" : "Send message"}
              >
                {sending ? (
                  <LoaderCircle size={22} className="spin" />
                ) : edit ? (
                  <Check size={23} />
                ) : (
                  <ArrowRight size={24} />
                )}
              </button>
            </div>
          )}
          {emoji && (
            <EmojiPicker
              onClose={() => setEmoji(false)}
              onSelect={(e) => {
                setText((t) => t + e);
              }}
            />
          )}
          <div className="composer-hint">
            <span>
              <span className="live-dot" />{" "}
              {demo
                ? "Demo · try it out"
                : "A little closer, wherever you are."}
            </span>
            <span>
              Enter to send <i>·</i> Shift + Enter for a new line
            </span>
          </div>
        </div>
      </main>
      <input
        ref={fileInput}
        type="file"
        aria-label="Upload a chat attachment"
        hidden
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/*,application/pdf,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          e.target.value = "";
        }}
      />
      {panel && data && (
        <RoomPanels
          key={panel}
          panel={panel}
          onClose={() => setPanel("")}
          snapshot={fullData!}
          user={user}
          appearance={appearance}
          onAppearance={changeAppearance}
          onRefresh={refresh}
          onError={notify}
          onReply={(m) => {
            document
              .getElementById("message-" + m.id)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onView={setViewer}
          onLeave={leave}
          onIdentity={onIdentity}
          demo={demo}
          dark={dark}
          onDark={onDark}
        />
      )}
      {call.active && (
        <CallPanel
          call={call}
          user={user}
          members={data?.members.filter((m) => m.online && m.inCall) || []}
        />
      )}
      {viewer && (
        <Modal className="media-viewer" onClose={() => setViewer(null)}>
          {images.length > 1 && (
            <nav className="viewer-navigation">
              <button
                onClick={() => moveViewer(-1)}
                disabled={viewerIndex <= 0}
                aria-label="Previous image"
              >
                <ArrowLeft size={22} />
              </button>
              <button
                onClick={() => moveViewer(1)}
                disabled={viewerIndex >= images.length - 1}
                aria-label="Next image"
              >
                <ArrowRight size={22} />
              </button>
            </nav>
          )}
          <img
            src={
              viewer.attachmentId === "demo-stadium"
                ? "/stadium.jpg"
                : "/api/media/" + viewer.attachmentId
            }
            alt={viewer.fileName || "Shared image"}
          />
          <div>
            <span>
              {viewer.fileName}
              <small>Shared by {viewer.name}</small>
              {images.length > 1 && (
                <small>
                  {viewerIndex + 1} of {images.length} · use the arrow keys to
                  explore
                </small>
              )}
            </span>
            <a
              href={
                viewer.attachmentId === "demo-stadium"
                  ? "/stadium.jpg"
                  : "/api/media/" + viewer.attachmentId
              }
              download={viewer.fileName}
            >
              Download <ArrowRight size={16} />
            </a>
          </div>
        </Modal>
      )}
      {error && (
        <div className="toast" role="status">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={14} style={{ transform: "rotate(-35deg)" }} />;
}
function contrast(hex: string) {
  const n = parseInt(hex.slice(1), 16),
    r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#202737" : "#ffffff";
}
