"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download } from "lucide-react";
function useNearby() {
  const ref = useRef<HTMLSpanElement>(null),
    [near, setNear] = useState(false);
  useEffect(() => {
    if (!window.IntersectionObserver) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, near };
}
export function MediaImage({ src, alt }: { src: string; alt: string }) {
  const { ref, near } = useNearby();
  return (
    <span ref={ref} className="lazy-image">
      {near ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <span className="media-placeholder" aria-label={alt} />
      )}
    </span>
  );
}
export function MediaVideo({
  src,
  poster,
  name,
}: {
  src: string;
  poster?: string;
  name: string;
}) {
  const { ref, near } = useNearby(),
    video = useRef<HTMLVideoElement>(null),
    [active, setActive] = useState(false),
    [error, setError] = useState("");
  return (
    <span ref={ref} className="lazy-video">
      <video
        ref={video}
        preload="none"
        playsInline
        controls={active}
        poster={near ? poster : undefined}
        onError={() => setError("This video cannot play in this browser.")}
      />
      {!active && (
        <button
          className="video-play"
          aria-label={"Play video: " + name}
          onClick={() => {
            setActive(true);
            if (video.current) {
              video.current.src = src;
              void video.current
                .play()
                .catch(() =>
                  setError("Tap the video’s Play control to begin."),
                );
            }
          }}
        >
          <Play size={25} fill="currentColor" />
          <span>Play video</span>
        </button>
      )}
      {error && (
        <small className="media-play-error">
          {error}{" "}
          <a href={src} download={name}>
            Download
          </a>
        </small>
      )}
    </span>
  );
}
export function VoicePlayer({
  src,
  duration: initial = 0,
  waveform,
}: {
  src: string;
  duration?: number;
  waveform?: string | number[];
}) {
  const audio = useRef<HTMLAudioElement>(null),
    url = useRef(""),
    pending = useRef<Promise<void> | null>(null),
    controller = useRef<AbortController | null>(null);
  const [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [duration, setDuration] = useState(initial),
    [speed, setSpeed] = useState(1),
    [error, setError] = useState("");
  let peaks: number[] = [];
  try {
    peaks =
      typeof waveform === "string" ? JSON.parse(waveform) : waveform || [];
  } catch {}
  useEffect(
    () => () => {
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [src],
  );
  async function prepare() {
    if (url.current) return;
    if (pending.current) return pending.current;
    controller.current = new AbortController();
    pending.current = (async () => {
      const response = await fetch(src, { signal: controller.current!.signal });
      if (!response.ok) throw new Error("Audio is unavailable.");
      const blob = await response.blob();
      url.current = URL.createObjectURL(blob);
      if (audio.current) audio.current.src = url.current;
    })();
    try {
      await pending.current;
    } finally {
      pending.current = null;
    }
  }
  return (
    <div className="voice-player">
      <audio
        ref={audio}
        preload="none"
        onLoadedMetadata={() => {
          if (Number.isFinite(audio.current!.duration))
            setDuration(audio.current!.duration);
        }}
        onTimeUpdate={() => setProgress(audio.current!.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
      <button
        disabled={busy}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        onClick={async () => {
          if (playing) {
            audio.current?.pause();
            setPlaying(false);
            return;
          }
          setBusy(true);
          setError("");
          try {
            await prepare();
            await audio.current?.play();
            setPlaying(true);
          } catch (e: any) {
            setError(
              e.name === "NotAllowedError"
                ? "Tap Play again to enable audio."
                : "Audio could not play. You can download it instead.",
            );
          } finally {
            setBusy(false);
          }
        }}
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
                height: peaks.length
                  ? 6 +
                    (peaks[
                      Math.min(
                        peaks.length - 1,
                        Math.floor((i / 34) * peaks.length),
                      )
                    ] || 0) *
                      22
                  : 8,
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
          disabled={!url.current}
          onChange={(e) => {
            audio.current!.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
          }}
        />
      </div>
      <span>
        {duration
          ? `${Math.floor((playing ? progress : duration) / 60)}:${String(Math.floor((playing ? progress : duration) % 60)).padStart(2, "0")}`
          : "Audio"}
      </span>
      <button
        className="speed"
        aria-label="Change playback speed"
        onClick={() => {
          const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
          setSpeed(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
      >
        {speed}×
      </button>
      {error && (
        <a href={src} className="voice-error" download aria-label={error}>
          <Download size={15} />
        </a>
      )}
    </div>
  );
}
