import { formatBytes, validateMedia } from "../lib/media-config";
("use client");
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { IMAGE_MIMES, MAX_IMAGE_BYTES } from "../lib/upload-limits";
export function RoomLogoPicker({
  emoji,
  file,
  imageUrl,
  onEmoji,
  onFile,
  onError,
  onRemove,
}: {
  emoji: string;
  file: File | null;
  imageUrl?: string;
  onEmoji: (e: string) => void;
  onFile: (f: File) => void;
  onError: (s: string) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null),
    [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = preview || imageUrl;
  return (
    <div className="room-logo-picker">
      <span className="input-label">
        Room logo <span>(optional)</span>
      </span>
      <div className="room-logo-selection">
        <div className="room-logo-preview">
          {src ? <img src={src} alt="Selected room logo" /> : emoji}
        </div>
        <div>
          <button
            type="button"
            className="upload-room-logo"
            onClick={() => ref.current?.click()}
          >
            <ImagePlus size={15} />
            {src ? "Change room image" : "Upload room image"}
          </button>
          <small>
            JPG, PNG, WebP or GIF ? up to {formatBytes(MAX_IMAGE_BYTES)}
          </small>
        </div>
        {src && (
          <button
            className="remove-room-logo"
            onClick={onRemove}
            aria-label="Remove room image"
          >
            <X size={15} />
          </button>
        )}
      </div>
      <div className="room-logo-options">
        {[
          "✳",
          "💬",
          "⚽",
          "🎮",
          "☕",
          "🌿",
          "🎵",
          "🚀",
          "🐾",
          "🌈",
          "📚",
          "✨",
        ].map((e) => (
          <button
            key={e}
            type="button"
            aria-label={"Room logo " + e}
            className={!src && emoji === e ? "selected" : ""}
            onClick={() => onEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        ref={ref}
        type="file"
        hidden
        accept={IMAGE_MIMES.join(",")}
        aria-label="Upload room logo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!IMAGE_MIMES.includes(f.type)) {
            onError("Choose a JPG, PNG or WebP image.");
            return;
          }
          if (f.size > MAX_IMAGE_BYTES) {
            onError(validateMedia(f, "logo"));
            return;
          }
          onFile(f);
        }}
      />
    </div>
  );
}
