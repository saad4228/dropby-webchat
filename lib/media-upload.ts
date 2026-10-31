import * as tus from "tus-js-client";
import { api, parseApiResponse } from "./client";
import { MEDIA_CONFIG, type MediaPurpose } from "./media-config";
import { prepareMedia, type MediaHints } from "./media-prepare";

export type UploadedMedia = {
  id: string;
  name: string;
  mime: string;
  size: number;
  thumbnailId?: string;
  duration?: number;
  waveform?: number[];
};
export type TransferState = {
  phase: "idle" | "preparing" | "uploading" | "paused" | "error" | "done";
  name: string;
  progress: number;
  size: number;
  originalSize: number;
  resumable: boolean;
  error?: string;
};
export class MediaUpload {
  private transfer?: tus.Upload;
  private xhr?: XMLHttpRequest;
  private child?: MediaUpload;
  private cancelled = false;
  private endpoint = "";
  private leaseId = "";
  private rejectTransfer?: (error: Error) => void;
  private state: TransferState;
  private key: string;
  constructor(
    private slug: string,
    private ownerId: string,
    private file: File,
    private purpose: MediaPurpose = "chat",
    private update: (state: TransferState) => void = () => {},
    private hints: MediaHints = {},
    private parentId?: string,
  ) {
    this.key = `dropby-upload:${slug}:${ownerId}:${purpose}`;
    this.state = {
      phase: "preparing",
      name: file.name,
      progress: 0,
      size: file.size,
      originalSize: file.size,
      resumable: file.size > MEDIA_CONFIG.resumableAbove,
    };
  }
  private emit(next: Partial<TransferState>) {
    this.state = { ...this.state, ...next };
    this.update(this.state);
  }
  async run(): Promise<UploadedMedia> {
    this.cancelled = false;
    this.emit({ phase: "preparing", error: undefined });
    try {
      const prepared = await prepareMedia(this.file, this.purpose, this.hints),
        file = prepared.file;
      if (this.cancelled) throw new Error("Upload cancelled.");
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      let previous: { id: string; hash: string; expires: number } | null = null;
      try {
        previous = JSON.parse(localStorage.getItem(this.key) || "null");
      } catch {}
      this.leaseId =
        previous?.hash === hash && previous.expires > Date.now()
          ? previous.id
          : this.leaseId || crypto.randomUUID();
      // Persist the request ID before contacting the Worker: a lost reservation
      // response must not reserve the same file twice when the user retries.
      try {
        localStorage.setItem(
          this.key,
          JSON.stringify({
            id: this.leaseId,
            hash,
            expires: Date.now() + MEDIA_CONFIG.reservationHours * 3600000,
            name: this.file.name,
            size: file.size,
          }),
        );
      } catch {}
      const lease = await api(`rooms/${this.slug}/uploads`, {
        id: this.leaseId,
        name: file.name,
        mime: file.type,
        size: file.size,
        purpose: this.purpose,
        parentId: this.parentId,
        ...prepared.hints,
      });
      this.endpoint = lease.endpoint;
      if (this.cancelled) {
        await api(
          this.endpoint.replace("/api/", ""),
          undefined,
          "DELETE",
        ).catch(() => {});
        throw new Error("Upload cancelled.");
      }
      try {
        localStorage.setItem(
          this.key,
          JSON.stringify({
            id: this.leaseId,
            hash,
            expires: lease.expires,
            name: this.file.name,
            size: file.size,
          }),
        );
      } catch {}
      this.emit({
        phase: "uploading",
        size: file.size,
        originalSize: prepared.originalSize,
        resumable: lease.resumable,
      });
      if (!lease.attachment) {
        if (lease.resumable) await this.resumable(file, hash);
        else await this.small(file);
      }
      if (this.cancelled) throw new Error("Upload cancelled.");
      // Re-run idempotent finalization on recovery: a prior request may have
      // verified the bytes but lost its response before publishing a setting.
      const result = await api(
        this.endpoint.replace("/api/", "") + "/complete",
        {},
      );
      const attachment: UploadedMedia = result.attachment;
      if (prepared.thumbnail) {
        this.emit({ phase: "preparing", resumable: false, progress: 99 });
        this.child = new MediaUpload(
          this.slug,
          this.ownerId,
          prepared.thumbnail,
          "thumbnail",
          () => {},
          {},
          attachment.id,
        );
        try {
          const thumb = await this.child.run();
          attachment.thumbnailId = thumb.id;
        } catch {
          /* The full image/video remains available if a preview cannot be stored. */
        }
      }
      if (this.cancelled) throw new Error("Upload cancelled.");
      try {
        localStorage.removeItem(this.key);
      } catch {}
      this.emit({ phase: "done", progress: 100 });
      return attachment;
    } catch (error: any) {
      if (error.status === 409) {
        this.leaseId = "";
        try {
          localStorage.removeItem(this.key);
        } catch {}
      }
      if (!this.cancelled)
        this.emit({
          phase: "error",
          error:
            error.message || "The upload was interrupted. Retry to continue.",
        });
      throw error;
    }
  }
  private resumable(file: File, hash: string) {
    return new Promise<void>((resolve, reject) => {
      this.rejectTransfer = reject;
      this.transfer = new tus.Upload(file, {
        endpoint: this.endpoint + "/tus",
        chunkSize: MEDIA_CONFIG.chunkSize,
        uploadDataDuringCreation: false,
        retryDelays: [0, 1500, 3000, 6000, 12000],
        removeFingerprintOnSuccess: true,
        fingerprint: async () =>
          `dropby:${this.slug}:${this.ownerId}:${this.leaseId}:${hash}`,
        onProgress: (sent, total) =>
          this.emit({
            progress: Math.min(99, Math.round((sent / total) * 100)),
          }),
        onError: (error) => {
          let message =
            "Your connection was interrupted. Retry to resume this file from its saved position.";
          const response = "originalResponse" in error ? error.originalResponse : null;
          if (response && response.getStatus() >= 400) {
            try {
              parseApiResponse(response.getBody(), response.getStatus());
            } catch (failure: any) {
              message = failure.message;
            }
          }
          reject(new Error(message));
        },
        onSuccess: () => resolve(),
      });
      this.transfer
        .findPreviousUploads()
        .then((previous) => {
          if (previous.length)
            this.transfer!.resumeFromPreviousUpload(previous[0]);
          if (!this.cancelled) this.transfer!.start();
        })
        .catch(reject);
    });
  }
  private small(file: File) {
    return new Promise<void>((resolve, reject) => {
      this.rejectTransfer = reject;
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;
      xhr.open("POST", this.endpoint + "/content");
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          this.emit({
            progress: Math.min(
              99,
              Math.round((event.loaded / event.total) * 100),
            ),
          });
      };
      xhr.onload = () => {
        try {
          parseApiResponse(xhr.responseText, xhr.status);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      xhr.onerror = () =>
        reject(new Error("The connection was interrupted. Retry this upload."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.send(file);
    });
  }
  pause() {
    if (this.child) {
      this.child.pause();
      return;
    }
    if (this.transfer) {
      void this.transfer.abort(false);
      this.emit({ phase: "paused" });
    }
  }
  resume() {
    if (this.child) {
      this.child.resume();
      return;
    }
    if (this.transfer) {
      this.emit({ phase: "uploading" });
      this.transfer.start();
    }
  }
  async cancel() {
    this.cancelled = true;
    this.rejectTransfer?.(new Error("Upload cancelled."));
    this.xhr?.abort();
    try {
      localStorage.removeItem(this.key);
    } catch {}
    this.emit({ phase: "idle" });
    await Promise.allSettled([
      this.child?.cancel(),
      this.transfer?.abort(false),
      this.endpoint
        ? api(this.endpoint.replace("/api/", ""), undefined, "DELETE")
        : undefined,
    ]);
  }
  suspend() {
    if (["done", "idle"].includes(this.state.phase)) return;
    this.pause();
    this.xhr?.abort();
  }
}
export async function uploadMedia(
  slug: string,
  ownerId: string,
  file: File,
  purpose: MediaPurpose = "chat",
  update: (state: TransferState) => void = () => {},
  hints: MediaHints = {},
) {
  return new MediaUpload(slug, ownerId, file, purpose, update, hints).run();
}
