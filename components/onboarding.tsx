"use client";
import { MediaUpload, type TransferState } from "../lib/media-upload";
import { UploadProgress } from "./upload-progress";
import { ProfilePhotoPicker } from "./profile-photo-picker";
import { normalizeRoomName } from "../lib/format";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Hash,
  Lock,
  MicOff,
  VideoOff,
  Zap,
  Globe,
  Plus,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { api, avatars, colors, Identity } from "../lib/client";
import { Avatar } from "./brand";
import { RoomLogoPicker } from "./room-logo-picker";
import { emojiGroups } from "../lib/emojis";
import { Modal } from "./modal";
export default function Onboarding({
  slug: initial,
  create: initialCreate,
  user,
  onClose,
  onJoined,
}: {
  slug: string;
  create: boolean;
  user: Identity | null;
  onClose: () => void;
  onJoined: (slug: string, user: Identity) => void;
}) {
  const [create, setCreate] = useState(initialCreate),
    [step, setStep] = useState(initialCreate ? 0 : 1),
    [slug, setSlug] = useState(initial),
    [name, setName] = useState(user?.name || ""),
    [avatar, setAvatar] = useState(
      (user?.avatar?.startsWith("media:") ? "" : user?.avatar) || "🏔️",
    ),
    [color, setColor] = useState(user?.color || colors[0]),
    [tab, setTab] = useState("Avatars"),
    [visibility, setVisibility] = useState("public"),
    [password, setPassword] = useState(""),
    [description, setDescription] = useState(""),
    [logo, setLogo] = useState("✳"),
    [logoFile, setLogoFile] = useState<File | null>(null),
    [avatarFile, setAvatarFile] = useState<File | null>(null),
    [clearAvatarImage, setClearAvatarImage] = useState(false),
    [createdSlug, setCreatedSlug] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [missing, setMissing] = useState(false);
  const [transfer, setTransfer] = useState<TransferState | null>(null);
  const uploadTask = useRef<MediaUpload | null>(null);
  useEffect(() => () => uploadTask.current?.suspend(), []);
  async function upload(
    file: File,
    purpose: "logo" | "avatar",
    ownerId: string,
  ) {
    const task = new MediaUpload(
      normalizeRoomName(slug),
      ownerId,
      file,
      purpose,
      setTransfer,
    );
    uploadTask.current = task;
    return task.run();
  }
  const identity = () => ({
    name: name.trim() || "Guest " + Math.floor(1000 + Math.random() * 9000),
    avatar: tab === "Initials" ? "" : avatar,
    color,
    clearAvatarImage,
  });
  async function join(quick = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api(
        "session",
        quick
          ? {
              name:
                user?.name ||
                "Guest " + Math.floor(1000 + Math.random() * 9000),
              avatar:
                (user?.avatar?.startsWith("media:") ? "" : user?.avatar) ||
                "🌿",
              color: user?.color || colors[0],
            }
          : identity(),
      );
      const normalized = normalizeRoomName(slug);
      if (create) {
        if (createdSlug !== normalized) {
          await api("rooms", {
            slug: normalized,
            description,
            visibility,
            password,
            logo,
          });
          setCreatedSlug(normalized);
        }
        if (logoFile) {
          await upload(logoFile, "logo", result.user.id);
        }
      } else await api("rooms/" + slug + "/join", { password });
      if (avatarFile) {
        const photo = await upload(avatarFile, "avatar", result.user.id);
        result.user.avatar = "media:" + photo.id;
      }
      onJoined(normalizeRoomName(slug), result.user);
    } catch (e: any) {
      setError(e.message);
      setMissing(e.status === 404);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={() => {
        void uploadTask.current?.cancel();
        onClose();
      }}
      className="onboarding"
    >
      <div className="onboarding-cover">
        <span className="onboarding-emblem" aria-hidden="true">
          {step === 0 ? (
            <MessageCircle size={29} />
          ) : step === 1 ? (
            <UserRound size={29} />
          ) : (
            <Check size={29} />
          )}
        </span>
      </div>
      <div className="step-dots">
        {[0, 1, 2].map((n) => (
          <i key={n} className={n <= step ? "active" : ""} />
        ))}
      </div>
      {step > 0 && (
        <button
          className="onboard-back"
          onClick={() => {
            setStep(step - 1);
            setError("");
          }}
          aria-label="Previous step"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      {step === 0 ? (
        <>
          <span className="section-label">MAKE ROOM FOR YOUR PEOPLE</span>
          <h2>A new little corner.</h2>
          <p>Good things start with a name.</p>
          <RoomLogoPicker
            emoji={logo}
            file={logoFile}
            onEmoji={(e) => {
              setLogo(e);
              setLogoFile(null);
            }}
            onFile={setLogoFile}
            onError={setError}
            onRemove={() => setLogoFile(null)}
          />
          <label className="input-label">
            Room name
            <div className="input-with-icon">
              <Hash size={18} />
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="weekend-plans"
                maxLength={48}
              />
            </div>
          </label>
          <label className="input-label">
            A little about this room <span>(optional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What brings you together?"
              maxLength={240}
            />
          </label>
          <div className="visibility-choice">
            <button
              className={visibility === "public" ? "selected" : ""}
              onClick={() => setVisibility("public")}
            >
              <Globe size={19} />
              <strong>Public</strong>
              <small>Anyone with the link</small>
            </button>
            <button
              className={visibility === "private" ? "selected" : ""}
              onClick={() => setVisibility("private")}
            >
              <Lock size={19} />
              <strong>Private</strong>
              <small>A password to get in</small>
            </button>
          </div>
          {visibility === "private" && (
            <label className="input-label">
              Room password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="At least 8 characters"
              />
            </label>
          )}
          <button
            className="primary full"
            onClick={() => {
              if (
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeRoomName(slug)) ||
                slug.length < 3 ||
                slug.length > 48
              ) {
                setError("Use 3–48 letters, numbers or single hyphens.");
                return;
              }
              if (visibility === "private" && password.length < 8) {
                setError("Use a password with at least 8 characters.");
                return;
              }
              setError("");
              setStep(1);
            }}
          >
            Make it yours <ArrowRight size={17} />
          </button>
        </>
      ) : step === 1 ? (
        <>
          <span className="section-label">A FACE TO THE HELLO</span>
          <h2>Come as you are.</h2>
          <p>
            Pick a name and a little personality.
            <br />
            You can always change these later.
          </p>
          <label className="input-label">
            Your display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              maxLength={20}
            />
            <small className="count">{name.length}/20</small>
          </label>
          <ProfilePhotoPicker
            file={avatarFile}
            imageUrl={
              !clearAvatarImage && user?.avatar?.startsWith("media:")
                ? "/api/media/" + user.avatar.slice(6)
                : undefined
            }
            onRemove={() => {
              setClearAvatarImage(true);
              setAvatarFile(null);
            }}
            onFile={(file) => {
              setAvatarFile(file);
              if (file) setClearAvatarImage(false);
            }}
            onError={setError}
          />
          <div className="segmented">
            {["Avatars", "Emoji", "Initials"].map((t) => (
              <button
                className={tab === t ? "selected" : ""}
                onClick={() => {
                  setTab(t);
                  if (t === "Initials") {
                    setClearAvatarImage(true);
                    setAvatarFile(null);
                  }
                }}
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Initials" ? (
            <div className="initials-preview">
              <Avatar name={name || "You"} color={color} />
            </div>
          ) : (
            <div className="avatar-grid">
              {(tab === "Emoji"
                ? [
                    ...emojiGroups[0].emojis.slice(0, 40),
                    ...emojiGroups[2].emojis.slice(0, 24),
                  ]
                : avatars
              ).map((a) => (
                <button
                  key={a}
                  className={avatar === a ? "selected" : ""}
                  onClick={() => {
                    setAvatar(a);
                    setClearAvatarImage(true);
                    setAvatarFile(null);
                  }}
                  style={{ background: color + "18" }}
                  aria-label={"Choose " + a}
                >
                  {a}
                  {avatar === a && (
                    <i>
                      <Check size={10} />
                    </i>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="color-options">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={color === c ? "selected" : ""}
                style={{ background: c }}
                aria-label={"Choose color " + c}
              >
                {color === c && <Check size={15} />}
              </button>
            ))}
          </div>
          <button
            className="primary full"
            onClick={() => {
              setError("");
              setStep(2);
            }}
          >
            Looks like me <ArrowRight size={17} />
          </button>
          {!create && (
            <button
              className="quick-join"
              onClick={() => join(true)}
              disabled={busy}
            >
              <Zap size={14} />{" "}
              {busy ? "Joining…" : "Skip the details. Quick Join."}
            </button>
          )}
        </>
      ) : (
        <>
          <span className="section-label">YOU’RE RIGHT WHERE YOU BELONG</span>
          <h2>Make yourself at home.</h2>
          <p>Here’s how you’ll show up.</p>
          <div className="identity-preview">
            <Avatar {...identity()} />
            <div>
              <strong>
                {name || "You"} <small>Just now</small>
              </strong>
              <p>Hey everyone! 👋</p>
            </div>
          </div>
          <div className="prejoin-room">
            <span>
              {visibility === "private" ? (
                <Lock size={18} />
              ) : (
                <Hash size={18} />
              )}
            </span>
            <div>
              <strong>{slug || "your-room"}</strong>
              <small>
                {create
                  ? visibility === "private"
                    ? "Your private space"
                    : "A fresh start"
                  : "Ready when you are"}
              </small>
            </div>
            <Check size={18} />
          </div>
          {!create && (
            <label className="input-label">
              Room password <span>(for private rooms)</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for public rooms"
                onKeyDown={(e) => {
                  if (e.key === "Enter") join();
                }}
              />
            </label>
          )}
          <div className="prejoin-devices">
            <span>
              <MicOff size={17} /> Microphone off
            </span>
            <span>
              <VideoOff size={17} /> Camera off
            </span>
          </div>
          <button
            className="primary full"
            onClick={() => join()}
            disabled={busy}
          >
            {busy
              ? "Finding your space…"
              : create
                ? "Create & enter room"
                : "Let’s drop in"}{" "}
            <ArrowRight size={17} />
          </button>
          <small className="privacy-note">
            No device permissions until you start a call.
          </small>
        </>
      )}
      {transfer && !["done", "idle"].includes(transfer.phase) && (
        <UploadProgress
          state={transfer}
          onPause={() => uploadTask.current?.pause()}
          onResume={() => uploadTask.current?.resume()}
          onRetry={() => void join()}
          onCancel={() => {
            void uploadTask.current?.cancel();
            setTransfer(null);
          }}
        />
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
          {missing && (
            <button
              onClick={() => {
                setCreate(true);
                setStep(0);
                setError("");
                setMissing(false);
              }}
            >
              <Plus size={14} /> Create this room instead
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
