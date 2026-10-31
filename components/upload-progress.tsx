import { Pause, Play, RotateCcw, X, FileUp, Check } from "lucide-react";
import { formatBytes } from "../lib/media-config";
import type { TransferState } from "../lib/media-upload";
export function UploadProgress({
  state,
  onPause,
  onResume,
  onRetry,
  onCancel,
}: {
  state: TransferState;
  onPause?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onCancel: () => void;
}) {
  if (state.phase === "idle") return null;
  return (
    <div className="smart-upload" aria-live="polite">
      <span className="smart-upload-icon">
        {state.phase === "done" ? <Check size={19} /> : <FileUp size={19} />}
      </span>
      <div className="smart-upload-copy">
        <strong>{state.name}</strong>
        <small>
          {state.phase === "preparing"
            ? "Preparing a beautiful, lighter preview…"
            : state.phase === "paused"
              ? "Paused · your progress is saved"
              : state.phase === "error"
                ? state.error
                : state.phase === "done"
                  ? "Ready to send"
                  : `Uploading · ${state.progress}%`}{" "}
          · {formatBytes(state.size)}
          {state.originalSize > state.size
            ? ` · optimized from ${formatBytes(state.originalSize)}`
            : ""}
        </small>
        {!["done", "error"].includes(state.phase) && (
          <progress
            aria-label="Upload progress"
            max={100}
            value={state.progress}
          />
        )}
      </div>
      <div className="smart-upload-actions">
        {state.resumable && state.phase === "uploading" && onPause && (
          <button onClick={onPause} aria-label="Pause upload">
            <Pause size={17} />
          </button>
        )}
        {state.phase === "paused" && onResume && (
          <button onClick={onResume} aria-label="Resume upload">
            <Play size={17} />
          </button>
        )}
        {state.phase === "error" && onRetry && (
          <button onClick={onRetry} aria-label="Retry upload">
            <RotateCcw size={17} />
          </button>
        )}
        <button onClick={onCancel} aria-label="Cancel upload">
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
