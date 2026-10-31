import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  IMAGE_TYPES,
  formatBytes,
  UPLOAD_LIMITS,
  validateMedia,
} from "../lib/media-config";
export function ProfilePhotoPicker({
  file,
  onFile,
  onError,
  imageUrl,
  onRemove,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  onError: (message: string) => void;
  imageUrl?: string;
  onRemove?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="profile-photo-picker">
      <input
        hidden
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        aria-label="Upload profile photo"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (!selected) return;
          const error = validateMedia(selected, "avatar");
          if (error) {
            onError(error);
            return;
          }
          onFile(selected);
        }}
      />
      <button type="button" onClick={() => input.current?.click()}>
        {preview || imageUrl ? (
          <img
            className="profile-photo-preview"
            src={preview || imageUrl}
            alt="Selected profile photo"
          />
        ) : (
          <ImagePlus size={17} />
        )}
        <span>
          {file
            ? file.name
            : imageUrl
              ? "Change profile photo"
              : "Use a profile photo"}
          <small>Optional · up to {formatBytes(UPLOAD_LIMITS.avatar)}</small>
        </span>
      </button>
      {(file || imageUrl) && (
        <button
          type="button"
          onClick={() => (file ? onFile(null) : onRemove?.())}
          aria-label="Remove selected profile photo"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
