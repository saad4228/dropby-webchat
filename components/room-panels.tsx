"use client";
import { useState } from "react";
import {
  X,
  Search,
  Users,
  Check,
  Link,
  ArrowUpRight,
  Copy,
  Crown,
  MoreHorizontal,
  Lock,
  Hash,
  Palette,
  Image,
  Pin,
  Settings,
  LogOut,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { Avatar } from "./brand";
import { RoomLogoPicker } from "./room-logo-picker";
import { RoomMark } from "./room-mark";
import { IMAGE_MIMES, MAX_IMAGE_BYTES } from "../lib/upload-limits";
import { api, Snapshot, Identity, themes, Message } from "../lib/client";
export type Appearance = {
  theme: string;
  accent: string;
  sent: string;
  received: string;
  opacity: number;
  blur: number;
  background: string;
};
export const defaultAppearance: Appearance = {
  theme: "",
  accent: "",
  sent: "",
  received: "",
  opacity: 85,
  blur: 16,
  background: "",
};
export default function RoomPanels({
  panel,
  onClose,
  snapshot,
  user,
  appearance,
  onAppearance,
  onRefresh,
  onError,
  onReply,
  onView,
  onLeave,
  onIdentity,
  demo,
  dark,
  onDark,
}: {
  panel: string;
  onClose: () => void;
  snapshot: Snapshot;
  user: Identity;
  appearance: Appearance;
  onAppearance: (a: Appearance) => void;
  onRefresh: () => void;
  onError: (s: string) => void;
  onReply: (m: Message) => void;
  onView: (m: Message) => void;
  onLeave: () => void;
  onIdentity: () => void;
  demo: boolean;
  dark: boolean;
  onDark: () => void;
}) {
  const [query, setQuery] = useState(""),
    [copied, setCopied] = useState(false),
    [memberMenu, setMemberMenu] = useState(""),
    [description, setDescription] = useState(snapshot.room.description),
    [locked, setLocked] = useState(snapshot.room.locked),
    [logo, setLogo] = useState(snapshot.room.logo || "✳"),
    [logoFile, setLogoFile] = useState<File | null>(null),
    [clearLogoImage, setClearLogoImage] = useState(false),
    [saving, setSaving] = useState(false),
    [reports, setReports] = useState<any[] | null>(null);
  const online = snapshot.members.filter((m) => m.online).length;
  const owner = snapshot.role === "owner";
  const mod = ["owner", "moderator"].includes(snapshot.role);
  const title: Record<string, string> = {
    members: "Your people",
    appearance: "Set the atmosphere",
    share: "A little invitation",
    search: "Find a moment",
    media: "Shared moments",
    pinned: "Worth keeping",
    settings: "Room details",
    more: "Make yourself at home",
  };
  async function moderate(id: string, action: string) {
    if (
      action === "ban" &&
      !confirm("Remove and ban this person from the room?")
    )
      return;
    try {
      await api(
        "rooms/" + snapshot.room.slug + "/members",
        { id, action },
        "PATCH",
      );
      setMemberMenu("");
      onRefresh();
    } catch (e: any) {
      onError(e.message);
    }
  }
  async function save() {
    if (demo) {
      onError("Create your own room to save shared settings.");
      return;
    }
    setSaving(true);
    try {
      await api(
        "rooms/" + snapshot.room.slug + "/settings",
        {
          description,
          locked,
          theme: appearance.theme || snapshot.room.theme,
          logo,
          clearLogoImage,
        },
        "PATCH",
      );
      if (logoFile) {
        const form = new FormData();
        form.append("file", logoFile);
        await api("rooms/" + snapshot.room.slug + "/logo", form);
        setLogoFile(null);
      }
      setClearLogoImage(false);
      onRefresh();
      onError("Room settings saved.");
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        location.origin + "/?room=" + encodeURIComponent(snapshot.room.slug),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError("Copy the link from the field below.");
    }
  }
  return (
    <>
      <button
        className="panel-scrim"
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside className={"room-panel " + panel} aria-label={title[panel]}>
        <header className="room-panel-heading">
          <div>
            <h3>{title[panel] || "Room"}</h3>
            <span>
              {panel === "members"
                ? `${online} online · ${snapshot.members.length} in this room`
                : panel === "appearance"
                  ? "A space that feels like you."
                  : snapshot.room.slug}
            </span>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={19} />
          </button>
        </header>
        {panel === "members" && (
          <>
            <div className="panel-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a person"
                aria-label="Find member"
              />
            </div>
            <div className="member-list">
              {snapshot.members
                .filter((m) =>
                  m.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((m) => (
                  <div className="member" key={m.id}>
                    <Avatar {...m} />
                    <div>
                      <strong>
                        {m.name} {m.id === user.id && <small>(you)</small>}{" "}
                        {m.role === "owner" && <Crown size={13} />}
                      </strong>
                      <span>
                        <i className={m.online ? "live-dot" : "offline-dot"} />
                        {m.inCall && m.online
                          ? "In a call"
                          : m.online
                            ? "Here with you"
                            : "Away"}
                        {m.muted ? " · muted" : ""}
                      </span>
                    </div>
                    {mod && m.id !== user.id && m.role !== "owner" && (
                      <button
                        className="icon-button"
                        aria-label={"Manage " + m.name}
                        onClick={() =>
                          setMemberMenu(memberMenu === m.id ? "" : m.id)
                        }
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    )}
                    {memberMenu === m.id && (
                      <div className="member-actions">
                        <button
                          onClick={() =>
                            moderate(m.id, m.muted ? "unmute" : "mute")
                          }
                        >
                          {m.muted ? "Allow messaging" : "Mute messaging"}
                        </button>
                        {owner && (
                          <button
                            onClick={() =>
                              moderate(
                                m.id,
                                m.role === "moderator" ? "member" : "moderator",
                              )
                            }
                          >
                            {m.role === "moderator"
                              ? "Remove moderator"
                              : "Make moderator"}
                          </button>
                        )}
                        <button
                          className="danger"
                          onClick={() => moderate(m.id, "ban")}
                        >
                          Remove & ban
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <button className="panel-invite" onClick={copy}>
              <Link size={16} />
              {copied ? "Invitation copied!" : "Copy an invitation link"}
              <ArrowUpRight size={15} />
            </button>
          </>
        )}
        {panel === "appearance" && (
          <>
            <div className="appearance-mode">
              <span>
                {dark ? <Moon size={17} /> : <Sun size={17} />}{" "}
                {dark ? "After dark" : "A little light"}
              </span>
              <button
                className="switch"
                role="switch"
                aria-checked={dark}
                aria-label="Dark mode"
                onClick={onDark}
              >
                <i />
              </button>
            </div>
            <span className="panel-label">PICK YOUR PLACE</span>
            <div className="theme-grid">
              {themes.map((t) => (
                <button
                  key={t.id}
                  className={
                    ((appearance.theme || snapshot.room.theme) === t.id
                      ? "selected "
                      : "") + "theme-tile"
                  }
                  onClick={() =>
                    onAppearance({
                      ...appearance,
                      theme: t.id,
                      accent: "",
                      sent: "",
                      received: "",
                      background: "",
                    })
                  }
                >
                  <div
                    style={{ background: t.color }}
                    className={"theme-thumb theme-" + t.id}
                  >
                    <span />
                    <i />
                    <b />
                    {(appearance.theme || snapshot.room.theme) === t.id && (
                      <Check size={16} />
                    )}
                  </div>
                  <strong>{t.name}</strong>
                  <small>{t.subtitle}</small>
                </button>
              ))}
            </div>
            <details className="custom-theme">
              <summary>
                Make it a little more you <Palette size={16} />
              </summary>
              <div className="custom-colors">
                {[
                  { key: "accent", label: "Accent", fallback: "#4b6bfa" },
                  { key: "sent", label: "Your messages", fallback: "#4b6bfa" },
                  { key: "received", label: "Incoming", fallback: "#ffffff" },
                ].map((c) => (
                  <label key={c.key}>
                    {c.label}
                    <input
                      type="color"
                      value={(appearance as any)[c.key] || c.fallback}
                      onChange={(e) =>
                        onAppearance({ ...appearance, [c.key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label>
                Surface opacity{" "}
                <input
                  type="range"
                  min="65"
                  max="100"
                  value={appearance.opacity}
                  onChange={(e) =>
                    onAppearance({
                      ...appearance,
                      opacity: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Softness{" "}
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={appearance.blur}
                  onChange={(e) =>
                    onAppearance({
                      ...appearance,
                      blur: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="wallpaper-label">
                Your own wallpaper
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!IMAGE_MIMES.includes(f.type)) {
                      onError("Choose a JPG, PNG or WebP wallpaper.");
                      return;
                    }
                    if (f.size > MAX_IMAGE_BYTES) {
                      onError("Wallpapers can be up to 7 MB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      onAppearance({
                        ...appearance,
                        background: String(reader.result),
                      });
                    reader.readAsDataURL(f);
                  }}
                  aria-label="Upload wallpaper (up to 7 MB)"
                />
                <small className="wallpaper-limit">
                  JPG, PNG or WebP · up to 7 MB
                </small>
              </label>
            </details>
            <button
              className="reset-appearance"
              onClick={() => onAppearance(defaultAppearance)}
            >
              Reset to the room’s appearance
            </button>
            <p className="panel-note">
              Just for you.{" "}
              {owner
                ? "Save in Room details to make a preset the room default."
                : "Your people keep their own atmosphere."}
            </p>
          </>
        )}
        {panel === "share" && (
          <div className="share-panel">
            <span className="share-illustration">
              <Link size={32} />
            </span>
            <h2>Better with your people.</h2>
            <p>
              A catch-up is just a link away.
              <br />
              Send this to someone you’d love to see.
            </p>
            <label className="input-label">
              Your room link
              <input
                value={
                  typeof location !== "undefined"
                    ? location.origin + "/?room=" + snapshot.room.slug
                    : ""
                }
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button className="primary full" onClick={copy}>
              {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
              {copied ? "Link copied" : "Copy room link"}
            </button>
            {snapshot.room.visibility === "private" && (
              <small>
                <Lock size={13} /> Share the room password separately.
              </small>
            )}
          </div>
        )}
        {["search", "pinned", "media"].includes(panel) && (
          <>
            <div className="panel-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  panel === "search"
                    ? "Search this conversation…"
                    : "Find something shared…"
                }
                aria-label="Search messages"
              />
            </div>
            <div
              className={panel === "media" ? "gallery-grid" : "search-results"}
            >
              {snapshot.messages
                .filter(
                  (m) =>
                    (panel !== "pinned" || m.pinned) &&
                    (panel !== "media" || m.attachmentId) &&
                    (m.text + " " + m.fileName + " " + m.name)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((m) =>
                  panel === "media" && m.fileMime?.startsWith("image/") ? (
                    <button key={m.id} onClick={() => onView(m)}>
                      <img
                        src={
                          m.attachmentId === "demo-stadium"
                            ? "/stadium.jpg"
                            : "/api/media/" + m.attachmentId
                        }
                        alt={m.fileName || "Shared image"}
                      />
                    </button>
                  ) : (
                    <button
                      key={m.id}
                      onClick={() => {
                        onReply(m);
                        onClose();
                        document
                          .getElementById("message-" + m.id)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                      }}
                    >
                      <Avatar
                        name={m.name}
                        avatar={m.avatar}
                        color={m.color}
                        small
                      />
                      <div>
                        <strong>{m.name}</strong>
                        <p>{m.text || m.fileName}</p>
                        <small>{new Date(m.created).toLocaleString()}</small>
                      </div>
                    </button>
                  ),
                )}
            </div>
            {!snapshot.messages.some((m) =>
              panel === "pinned"
                ? m.pinned
                : panel === "media"
                  ? m.attachmentId
                  : true,
            ) && (
              <div className="panel-empty">
                {panel === "pinned" ? <Pin size={30} /> : <Image size={30} />}
                <p>
                  {panel === "pinned"
                    ? "Keep the good stuff here."
                    : "Your shared moments live here."}
                </p>
                <small>
                  {panel === "pinned"
                    ? "Owners and moderators can pin a message."
                    : "Send a photo, a voice note, or a file to begin."}
                </small>
              </div>
            )}
            <p className="panel-note">
              Search covers loaded messages. Load earlier messages in the
              conversation for more.
            </p>
          </>
        )}
        {panel === "settings" && (
          <>
            <div className="room-detail-icon">
              <RoomMark room={snapshot.room} />
            </div>
            <h2 className="room-detail-name">{snapshot.room.slug}</h2>
            <p className="room-detail-type">
              {snapshot.room.visibility === "private"
                ? "Private, password protected"
                : "Public, accessible by name or link"}
            </p>
            {owner && (
              <RoomLogoPicker
                emoji={logo}
                file={logoFile}
                imageUrl={
                  !clearLogoImage && snapshot.room.logoImageId
                    ? "/api/rooms/" +
                      snapshot.room.slug +
                      "/logo?v=" +
                      snapshot.room.logoImageId
                    : undefined
                }
                onEmoji={(e) => {
                  setLogo(e);
                  setLogoFile(null);
                  setClearLogoImage(true);
                }}
                onFile={(f) => {
                  setLogoFile(f);
                  setClearLogoImage(false);
                }}
                onRemove={() => {
                  setLogoFile(null);
                  setClearLogoImage(true);
                }}
                onError={onError}
              />
            )}
            {owner ? (
              <label className="input-label room-description-editor">
                About this room
                <textarea
                  value={description}
                  maxLength={240}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A little space for…"
                />
              </label>
            ) : (
              <section className="room-description">
                <h4>About this room</h4>
                <p>
                  {snapshot.room.description ||
                    "A little space for good company."}
                </p>
              </section>
            )}
            <div className="settings-row">
              <div>
                <strong>Close the door</strong>
                <small>Pause new people joining</small>
              </div>
              <button
                role="switch"
                aria-label="Lock new room joins"
                aria-checked={locked}
                disabled={!owner}
                className="switch"
                onClick={() => setLocked(!locked)}
              >
                <i />
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Message history</strong>
                <small>Kept until deleted by author or moderator</small>
              </div>
              <Shield size={18} />
            </div>
            {owner && (
              <button className="primary full" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save room settings"}
              </button>
            )}
            {mod && (
              <>
                <button
                  className="panel-invite"
                  onClick={async () => {
                    try {
                      setReports(
                        (await api("rooms/" + snapshot.room.slug + "/reports"))
                          .reports,
                      );
                    } catch (e: any) {
                      onError(e.message);
                    }
                  }}
                >
                  <FlagIcon /> Review reports
                </button>
                {reports && (
                  <div className="reports">
                    {reports.length ? (
                      reports.map((r) => (
                        <div key={r.id}>
                          <strong>{r.name}</strong>
                          <p>{r.reason}</p>
                          <small>Message: {r.messageId}</small>
                        </div>
                      ))
                    ) : (
                      <p>No reports. Let’s keep it kind.</p>
                    )}
                  </div>
                )}
              </>
            )}
            <p className="panel-note">
              Guest identities stay on this browser for up to 30 days. Messages
              and files are stored on the server. This room is not end-to-end
              encrypted.
            </p>
          </>
        )}
        {panel === "more" && (
          <div className="room-options">
            {[
              ["search", "Find a message", Search],
              ["pinned", "Pinned messages", Pin],
              ["media", "Shared media", Image],
              ["settings", "Room details", Settings],
            ].map(([id, label, Icon]: any) => (
              <button key={id} onClick={() => onError("OPEN:" + id)}>
                <Icon size={19} />
                {label}
                <ArrowUpRight size={15} />
              </button>
            ))}
            <hr />
            {!demo &&
              (user.signedIn ? (
                <div className="account-saved">
                  <Shield size={16} />
                  <span>
                    Identity saved with ChatGPT
                    <small>Available when you sign in on another device.</small>
                  </span>
                </div>
              ) : (
                <a
                  className="save-identity"
                  href={
                    "/signin-with-chatgpt?return_to=" +
                    encodeURIComponent("/?room=" + snapshot.room.slug)
                  }
                  target="_top"
                >
                  <Shield size={19} />
                  <span>
                    Keep this identity
                    <small>Optional · save it with ChatGPT</small>
                  </span>
                  <ArrowUpRight size={15} />
                </a>
              ))}
            <button onClick={onIdentity}>
              <Users size={19} />
              Change your identity
              <ArrowUpRight size={15} />
            </button>
            {!demo && user.signedIn && (
              <a
                className="save-identity"
                href="/signout-with-chatgpt?return_to=/"
                target="_top"
              >
                <LogOut size={19} />
                Sign out of ChatGPT
                <ArrowUpRight size={15} />
              </a>
            )}
            <button className="danger" onClick={onLeave}>
              <LogOut size={19} />
              Leave this room
              <ArrowUpRight size={15} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
function FlagIcon() {
  return <Shield size={16} />;
}
