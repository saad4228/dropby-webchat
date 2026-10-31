"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Music2,
  Plus,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Headphones,
  Check,
  RefreshCw,
  Trash2,
  ChevronDown,
  Disc3,
  LoaderCircle,
} from "lucide-react";
import { api } from "../lib/client";
import {
  MUSIC_ACCEPT,
  MUSIC_MIMES,
  musicPosition,
  musicTime,
  type MusicSnapshot,
  type MusicPlaybackUpdate,
} from "../lib/music";
import { playbackCorrection, musicClockOffset } from "../lib/music-sync";
import { MAX_FILE_BYTES } from "../lib/upload-limits";

async function fileDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const probe = document.createElement("audio"),
      url = URL.createObjectURL(file);
    const cleanup = () => {
      clearTimeout(timer);
      probe.onloadedmetadata = null;
      probe.onseeked = null;
      probe.onerror = null;
      probe.removeAttribute("src");
      probe.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "This file could not be read. Try an MP3 or an MP4 with audio.",
        ),
      );
    }, 15000);
    probe.onloadedmetadata = () => {
      if (!Number.isFinite(probe.duration)) {
        probe.onseeked = () => {
          const duration = probe.duration;
          cleanup();
          Number.isFinite(duration) && duration >= 0.5 && duration <= 7200
            ? resolve(duration)
            : reject(
                new Error(
                  "This file has no readable duration. Try an MP3 or MP4.",
                ),
              );
        };
        probe.currentTime = 1e10;
        return;
      }
      const duration = probe.duration;
      cleanup();
      Number.isFinite(duration) && duration >= 0.5 && duration <= 7200
        ? resolve(duration)
        : reject(
            new Error(
              "Choose a song between half a second and two hours long.",
            ),
          );
    };
    probe.onerror = () => {
      cleanup();
      reject(
        new Error(
          "Your browser cannot play this file. Try an MP3, M4A or MP4 with audio.",
        ),
      );
    };
    probe.preload = "metadata";
    probe.src = url;
  });
}
export default function RoomMusic({
  slug,
  userId,
  role,
  restricted,
  demo,
  onCreate,
}: {
  slug: string;
  userId: string;
  role: string;
  restricted: boolean;
  demo: boolean;
  onCreate: () => void;
}) {
  const [data, setData] = useState<MusicSnapshot | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(""),
    [volume, setVolume] = useState(0.45),
    [muted, setMuted] = useState(false),
    [blocked, setBlocked] = useState(false),
    [position, setPosition] = useState(0),
    [seek, setSeek] = useState<number | null>(null),
    [ready, setReady] = useState(false),
    [preparing, setPreparing] = useState(false),
    [audioLoadAttempt, setAudioLoadAttempt] = useState(0);
  const audio = useRef<HTMLAudioElement>(null),
    root = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    toggle = useRef<HTMLButtonElement>(null),
    clock = useRef(0),
    requestSeq = useRef(0),
    latestSeq = useRef(0),
    latestFullSeq = useRef(0),
    active = useRef(true),
    localDecision = useRef(""),
    dataRef = useRef(data),
    acceptedRef = useRef(accepted),
    blockedRef = useRef(blocked),
    offsetReady = useRef(false),
    polling = useRef(false),
    pollError = useRef(""),
    fastPolling = useRef(false),
    preparedTrack = useRef(""),
    appliedRevision = useRef(""),
    lastHardSeek = useRef(-Infinity),
    playPending = useRef(false),
    startProbe = useRef<{ trackId: string; baseline: number } | null>(null),
    scrubbing = useRef(false),
    previewPosition = useRef<number | null>(null),
    seekGeneration = useRef(0),
    seekInFlight = useRef(false),
    queuedSeek = useRef<{
      position: number;
      trackId: string;
      at: number;
      generation: number;
    } | null>(null),
    localSeek = useRef<{
      position: number;
      trackId: string;
      at: number;
      generation: number;
      playing: boolean;
    } | null>(null);
  dataRef.current = data;
  acceptedRef.current = accepted;
  blockedRef.current = blocked;
  const canControl =
    !!data &&
    (data.state.controllerId === userId ||
      role === "owner" ||
      role === "moderator") &&
    !restricted;
  // Accept ordered snapshots and estimate the difference between server and browser clocks.
  const receive = useCallback(
    (
      next: MusicSnapshot | MusicPlaybackUpdate,
      started: number,
      seq: number,
    ) => {
      if (
        !active.current ||
        next.state.revision < (dataRef.current?.state.revision ?? 0)
      )
        return;
      if (
        !("queue" in next) &&
        seq < latestSeq.current &&
        next.state.revision === (dataRef.current?.state.revision ?? 0)
      )
        return;
      if ("queue" in next) {
        if (
          seq < latestFullSeq.current &&
          next.state.revision === (dataRef.current?.state.revision ?? 0)
        )
          return;
        latestFullSeq.current = Math.max(latestFullSeq.current, seq);
      }
      latestSeq.current = Math.max(latestSeq.current, seq);
      const estimate = musicClockOffset(
        started,
        Date.now(),
        next.serverReceivedAt,
        next.serverNow,
      );
      clock.current = offsetReady.current
        ? clock.current * 0.7 + estimate * 0.3
        : estimate;
      offsetReady.current = true;
      const merged =
        "queue" in next
          ? next
          : dataRef.current
            ? {
                ...dataRef.current,
                state: next.state,
                serverNow: next.serverNow,
              }
            : null;
      if (!merged) return;
      dataRef.current = merged;
      setData(merged);
      setReady(true);
      if (
        !localDecision.current &&
        merged.ownChoice?.trackId === merged.current?.id &&
        merged.ownChoice?.response === "accepted"
      )
        setAccepted(merged.current!.id);
      if (localDecision.current && localDecision.current !== merged.current?.id)
        localDecision.current = "";
    },
    [],
  );
  // Queue details refresh slowly; the separate playhead poll runs more frequently.
  const refresh = useCallback(async () => {
    if (demo || polling.current) return;
    polling.current = true;
    const seq = ++requestSeq.current,
      started = Date.now();
    try {
      receive(await api("rooms/" + slug + "/music"), started, seq);
      if (pollError.current) {
        const previous = pollError.current;
        setError((value) => (value === previous ? "" : value));
        pollError.current = "";
      }
    } catch (e: any) {
      if (active.current) {
        setReady(true);
        pollError.current = e.message;
        setError(e.message);
        if (e.status === 401 || e.status === 403) {
          acceptedRef.current = "";
          setAccepted("");
          audio.current?.pause();
          audio.current?.removeAttribute("src");
          audio.current?.load();
        }
      }
    } finally {
      polling.current = false;
    }
  }, [slug, demo, receive]);
  useEffect(() => {
    const update = async () => {
      const d = dataRef.current;
      if (demo || !d?.current || fastPolling.current) return;
      fastPolling.current = true;
      const started = Date.now(),
        seq = ++requestSeq.current;
      try {
        receive(
          await api(
            "rooms/" + slug + "/music?playback=1&revision=" + d.state.revision,
          ),
          started,
          seq,
        );
      } catch (e: any) {
        if (e.status === 401 || e.status === 403) refresh();
      } finally {
        fastPolling.current = false;
      }
    };
    const timer = setInterval(update, 350);
    return () => clearInterval(timer);
  }, [slug, demo, receive, refresh]);
  useEffect(() => {
    active.current = true;
    const player = audio.current;
    try {
      const prefs = JSON.parse(
        localStorage.getItem("dropby-music-volume") || "{}",
      );
      if (typeof prefs.volume === "number")
        setVolume(Math.max(0, Math.min(1, prefs.volume)));
      setMuted(!!prefs.muted);
    } catch {}
    refresh();
    const timer = setInterval(refresh, 2000);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", refresh);
    return () => {
      active.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", refresh);
      player?.pause();
      player?.removeAttribute("src");
      player?.load();
    };
  }, [refresh]);
  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
    try {
      localStorage.setItem(
        "dropby-music-volume",
        JSON.stringify({ volume, muted }),
      );
    } catch {}
  }, [volume, muted]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  // Keep the local audio near the shared playhead without repeatedly interrupting buffering.
  const sync = useCallback(() => {
    const d = dataRef.current,
      a = audio.current;
    if (!d || !a) return;
    const intent =
      localSeek.current?.trackId === d.current?.id ? localSeek.current : null;
    const state = intent
      ? {
          ...d.state,
          position: intent.position,
          updatedAt: intent.at,
          playing: intent.playing,
        }
      : d.state;
    const target = d.current
      ? musicPosition(state, d.current.duration, Date.now() + clock.current)
      : 0;
    setPosition(
      scrubbing.current && previewPosition.current !== null
        ? previewPosition.current
        : target,
    );
    if (!d.current || acceptedRef.current !== d.current.id) {
      a.pause();
      if (a.getAttribute("src")) {
        a.removeAttribute("src");
        a.load();
      }
      return;
    }
    if (preparedTrack.current !== d.current.id || !a.getAttribute("src"))
      return;
    if (!scrubbing.current && !intent) {
      const drift = target - a.currentTime;
      const revision = d.current.id + ":" + d.state.revision;
      const correction = playbackCorrection({
        drift,
        revisionChanged: appliedRevision.current !== revision,
        seeking: a.seeking,
        readyState: a.readyState,
        sinceSeek: performance.now() - lastHardSeek.current,
      });
      if (correction.seek) {
        try {
          a.currentTime = target;
          if (startProbe.current?.trackId === d.current.id)
            startProbe.current.baseline = target;
          lastHardSeek.current = performance.now();
        } catch {}
      }
      if ((a.readyState >= 3 && !a.seeking) || correction.seek)
        appliedRevision.current = revision;
      if (a.playbackRate !== correction.rate) a.playbackRate = correction.rate;
    }
    if (
      startProbe.current?.trackId === d.current.id &&
      !a.paused &&
      !a.seeking &&
      a.currentTime > startProbe.current.baseline + 0.04
    ) {
      startProbe.current = null;
      setPreparing(false);
      if (
        !intent &&
        !scrubbing.current &&
        Math.abs(target - a.currentTime) > 0.12
      ) {
        a.currentTime = target;
        lastHardSeek.current = performance.now();
        appliedRevision.current = d.current.id + ":" + d.state.revision;
      }
    }
    if (state.playing && target < d.current.duration) {
      if (
        a.paused &&
        a.readyState >= 3 &&
        !blockedRef.current &&
        !playPending.current
      ) {
        playPending.current = true;
        a.play()
          .catch((e) => {
            if (
              e.name !== "AbortError" &&
              active.current &&
              dataRef.current?.current?.id === d.current?.id &&
              dataRef.current?.state.playing
            ) {
              blockedRef.current = true;
              setBlocked(true);
            }
          })
          .finally(() => {
            playPending.current = false;
          });
      }
    } else {
      a.pause();
      a.playbackRate = 1;
      if (startProbe.current) setPreparing(false);
    }
  }, []);
  useEffect(() => {
    sync();
    const timer = setInterval(sync, 200);
    return () => clearInterval(timer);
  }, [sync, data, accepted]);
  useEffect(() => {
    const current = data?.current,
      a = audio.current;
    if (!current || accepted !== current.id || !a) return;
    const controller = new AbortController();
    let objectUrl = "";
    preparedTrack.current = "";
    appliedRevision.current = "";
    startProbe.current = { trackId: current.id, baseline: 0 };
    playPending.current = false;
    a.pause();
    a.removeAttribute("src");
    a.load();
    setPreparing(true);
    fetch("/api/media/" + current.attachmentId, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 403
              ? "Your access to this song ended."
              : "Could not prepare this song. Tap Enable sound to retry.",
          );
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted || !active.current) return;
        objectUrl = URL.createObjectURL(blob);
        preparedTrack.current = current.id;
        a.src = objectUrl;
        a.load();
        if (!dataRef.current?.state.playing) setPreparing(false);
      })
      .catch((e) => {
        if (
          e.name !== "AbortError" &&
          !controller.signal.aborted &&
          active.current
        ) {
          setPreparing(false);
          blockedRef.current = true;
          setBlocked(true);
          setError(e.message);
        }
      });
    return () => {
      controller.abort();
      if (objectUrl && a.getAttribute("src") === objectUrl) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      preparedTrack.current = "";
    };
  }, [data?.current?.attachmentId, accepted, audioLoadAttempt]);
  useEffect(() => {
    setBlocked(false);
    blockedRef.current = false;
    setSeek(null);
    setError("");
  }, [data?.current?.id]);
  // Shared commands go through the server, which owns permissions and revision numbers.
  async function command(body: Record<string, unknown>) {
    const seq = ++requestSeq.current,
      started = Date.now();
    const next = await api("rooms/" + slug + "/music", body);
    receive(next, started, seq);
    return next as MusicSnapshot & { addedId?: string };
  }
  async function control(action: string, extra: Record<string, unknown> = {}) {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      await command({ action, revision: data.state.revision, ...extra });
    } catch (e: any) {
      setError(e.message);
      refresh();
    } finally {
      setBusy(false);
      setSeek(null);
    }
  }
  // Preview a seek immediately; commitSeek reconciles the latest choice with the server.
  function previewSeek(value: number) {
    previewPosition.current = value;
    setSeek(value);
    setPosition(value);
    const a = audio.current;
    if (
      a &&
      a.readyState >= 1 &&
      acceptedRef.current === dataRef.current?.current?.id
    ) {
      a.currentTime = value;
      a.playbackRate = 1;
      lastHardSeek.current = performance.now();
    }
  }
  async function commitSeek(value: number) {
    const d = dataRef.current;
    if (!d?.current || !canControl) return;
    scrubbing.current = false;
    previewPosition.current = null;
    const generation = ++seekGeneration.current,
      at = Date.now() + clock.current;
    const job = { position: value, trackId: d.current.id, at, generation };
    localSeek.current = { ...job, playing: d.state.playing };
    queuedSeek.current = job;
    setSeek(null);
    setPosition(value);
    if (seekInFlight.current) return;
    seekInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      while (queuedSeek.current && active.current) {
        const next = queuedSeek.current;
        queuedSeek.current = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          const latest = dataRef.current;
          if (latest?.current?.id !== next.trackId) break;
          try {
            await command({
              action: "seek",
              position: next.position,
              trackId: next.trackId,
              at: next.at,
              revision: latest.state.revision,
            });
            break;
          } catch (e: any) {
            if (e.status === 409 && attempt === 0) {
              const started = Date.now(),
                seq = ++requestSeq.current;
              receive(await api("rooms/" + slug + "/music"), started, seq);
              continue;
            }
            throw e;
          }
        }
        if (localSeek.current?.generation === next.generation)
          localSeek.current = null;
      }
    } catch (e: any) {
      queuedSeek.current = null;
      localSeek.current = null;
      appliedRevision.current = "";
      setError(e.message);
      refresh();
    } finally {
      seekInFlight.current = false;
      setBusy(false);
      setSeek(null);
      sync();
    }
  }
  async function choose(
    response: "accepted" | "declined",
    changeRequested = false,
  ) {
    const current = data?.current;
    if (!current || busy) return;
    localDecision.current = current.id;
    if (response === "accepted") {
      setAccepted(current.id);
      acceptedRef.current = current.id;
      setBlocked(false);
      blockedRef.current = false;
    } else {
      setAccepted("");
      acceptedRef.current = "";
      audio.current?.pause();
    }
    setBusy(true);
    setError("");
    try {
      await command({
        action: "choice",
        trackId: current.id,
        response,
        changeRequested,
      });
    } catch (e: any) {
      setError(e.message);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File) {
    if (uploading) return;
    setUploading(true);
    setError("");
    try {
      if (!MUSIC_MIMES.includes(f.type))
        throw new Error("Choose an MP3, M4A, OGG, MP4 or WebM file.");
      if (f.size > MAX_FILE_BYTES)
        throw new Error("Songs and videos can be up to 15 MB.");
      const duration = await fileDuration(f),
        form = new FormData();
      form.append("file", f);
      const { attachment } = await api("rooms/" + slug + "/upload", form);
      await command({
        action: "queue",
        attachmentId: attachment.id,
        title:
          f.name.replace(/\.[^.]+$/, "").slice(0, 120) || "A little soundtrack",
        duration,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }
  function enableAudio() {
    blockedRef.current = false;
    setBlocked(false);
    if (!audio.current?.getAttribute("src")) {
      setAudioLoadAttempt((v) => v + 1);
      return;
    }
    audio.current
      ?.play()
      .then(sync)
      .catch(() => {
        blockedRef.current = true;
        setBlocked(true);
        setError(
          "Your browser paused audio. Tap Enable sound again to resume.",
        );
      });
  }
  const current = data?.current,
    joined = current?.id === accepted,
    choice = data?.ownChoice?.trackId === current?.id ? data?.ownChoice : null,
    listeners = data?.choices.filter((c) => c.response === "accepted") || [],
    requests = data?.choices.filter((c) => c.changeRequested) || [];
  const status = demo
    ? "A little soundtrack for your people"
    : current
      ? joined
        ? blocked
          ? "Tap to enable sound"
          : preparing
            ? "Preparing your audio…"
            : data?.state.playing
              ? "Listening together"
              : "Paused together"
        : choice?.response === "declined"
          ? "You passed this song"
          : "A song is waiting for you"
      : "Your people. The same soundtrack.";
  return (
    <div
      className={
        "music-dock " +
        (current ? "has-track " : "") +
        (joined && data?.state.playing && !muted && !blocked
          ? "is-listening "
          : "") +
        (open ? "is-open" : "")
      }
      ref={root}
    >
      <audio
        ref={audio}
        preload="auto"
        aria-label="Room music audio"
        onLoadedMetadata={sync}
        onCanPlay={sync}
        onError={() => {
          if (audio.current?.getAttribute("src")) {
            setPreparing(false);
            blockedRef.current = true;
            setBlocked(true);
            setError(
              "This file has no playable audio in your browser. Pass it or ask for another song.",
            );
          }
        }}
      />
      <button
        className="music-summary"
        ref={toggle}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open room music player"
        aria-expanded={open}
      >
        <span className="music-record" aria-hidden="true">
          <Disc3 size={21} />
          <i />
        </span>
        <span>
          <strong>
            {current?.title || "Room radio"}
            {current && (
              <span className="music-equalizer" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
          </strong>
          <small>{status}</small>
        </span>
        <ChevronDown size={13} />
      </button>
      {current && !joined && (
        <button
          className="music-join-mini"
          disabled={busy}
          onClick={() => choose("accepted")}
        >
          <Headphones size={13} />
          Listen
        </button>
      )}
      {joined && (
        <button
          className="music-icon"
          onClick={() => (blocked ? enableAudio() : setMuted((v) => !v))}
          aria-label={
            blocked
              ? "Enable music sound"
              : muted
                ? "Unmute music for me"
                : "Mute music for me"
          }
        >
          {muted || blocked ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
      <button
        className="music-icon music-add-mini"
        onClick={() => {
          setOpen(true);
          if (!demo) file.current?.click();
        }}
        aria-label="Add a song"
      >
        <Plus size={17} />
      </button>
      {open && (
        <section className="music-panel" aria-label="Room music player">
          <header>
            <div>
              <span className="music-eyebrow">A LITTLE SOUNDTRACK</span>
              <h3>
                <Music2 size={16} />
                Listen a little closer.
              </h3>
            </div>
            <button
              className="music-icon"
              aria-label="Close music player"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          </header>
          {demo ? (
            <div className="music-empty">
              <span className="music-empty-record">
                <Disc3 size={35} />
              </span>
              <h4>Good company. Good music.</h4>
              <p>
                Add songs, take turns, and listen together.
                <br />
                Create a real room to share a soundtrack.
              </p>
              <button className="music-primary" onClick={onCreate}>
                Make a room <Plus size={14} />
              </button>
            </div>
          ) : (
            <>
              {current ? (
                <>
                  <div className="music-now">
                    <span className="music-cover" aria-hidden="true">
                      <Music2 size={26} />
                      <i>♪</i>
                    </span>
                    <div>
                      <span className="music-eyebrow">
                        {data?.state.playing
                          ? "ON THE TURNTABLE"
                          : "TAKING A BREATHER"}
                      </span>
                      <h4>{current.title}</h4>
                      <p>
                        Added by {current.addedByName}
                        {current.mime.startsWith("video/")
                          ? " · Video, audio only"
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="music-timeline">
                    <input
                      type="range"
                      min={0}
                      max={current.duration}
                      step={0.1}
                      value={seek ?? position}
                      aria-label="Seek shared song"
                      style={
                        {
                          "--fill":
                            ((seek ?? position) / current.duration) * 100 + "%",
                        } as React.CSSProperties
                      }
                      disabled={!canControl || (busy && !seekInFlight.current)}
                      onPointerDown={(e) => {
                        scrubbing.current = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onChange={(e) => previewSeek(Number(e.target.value))}
                      onPointerUp={(e) =>
                        commitSeek(Number(e.currentTarget.value))
                      }
                      onPointerCancel={() => {
                        scrubbing.current = false;
                        previewPosition.current = null;
                        setSeek(null);
                        appliedRevision.current = "";
                        sync();
                      }}
                      onBlur={() => {
                        if (previewPosition.current !== null)
                          commitSeek(previewPosition.current);
                      }}
                      onKeyUp={(e) => {
                        if (
                          [
                            "ArrowLeft",
                            "ArrowRight",
                            "Home",
                            "End",
                            "PageUp",
                            "PageDown",
                          ].includes(e.key)
                        )
                          commitSeek(Number(e.currentTarget.value));
                      }}
                    />
                    <div>
                      <time>{musicTime(seek ?? position)}</time>
                      <time>{musicTime(current.duration)}</time>
                    </div>
                  </div>
                  {joined && preparing && (
                    <p className="music-uploading" role="status">
                      <LoaderCircle size={14} className="spin" />
                      Preparing audio for smooth playback…
                    </p>
                  )}
                  {!joined ? (
                    <div className="music-invitation">
                      <p>
                        {choice?.response === "declined"
                          ? "No pressure. You can join whenever you like."
                          : "Join at the same moment as your people."}
                      </p>
                      <div>
                        <button
                          className="music-primary"
                          onClick={() => choose("accepted")}
                          disabled={busy}
                        >
                          <Headphones size={15} />
                          Listen together
                        </button>
                        <button
                          className="music-secondary"
                          onClick={() => choose("declined")}
                          disabled={busy}
                        >
                          {choice?.response === "declined" ? (
                            <>
                              <Check size={13} />
                              Passed
                            </>
                          ) : (
                            "Pass this song"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="music-listening">
                      <span>
                        <i className="live-dot" />{" "}
                        {blocked
                          ? "Ready when you are"
                          : muted || volume === 0
                            ? "Quiet on your side"
                            : "You’re tuned in"}
                      </span>
                      <button
                        className="music-text-button"
                        disabled={busy}
                        onClick={() => choose("declined")}
                      >
                        Leave this song
                      </button>
                    </div>
                  )}
                  {joined && blocked && (
                    <button className="music-enable" onClick={enableAudio}>
                      <Volume2 size={15} />
                      Enable sound on this device
                    </button>
                  )}
                  <div className="music-transport">
                    {canControl ? (
                      <>
                        <button
                          className="music-play"
                          disabled={busy}
                          aria-label={
                            data?.state.playing
                              ? "Pause shared music"
                              : "Play shared music"
                          }
                          onClick={() =>
                            control(data?.state.playing ? "pause" : "play")
                          }
                        >
                          {data?.state.playing ? (
                            <Pause size={19} fill="currentColor" />
                          ) : (
                            <Play size={19} fill="currentColor" />
                          )}
                        </button>
                        <button
                          className="music-icon"
                          disabled={busy}
                          aria-label="Skip shared song"
                          onClick={() => control("next")}
                        >
                          <SkipForward size={18} />
                        </button>
                        <span className="music-dj">
                          {data?.state.controllerId === userId
                            ? "You’re the DJ"
                            : "Room moderator controls"}
                        </span>
                      </>
                    ) : (
                      <span className="music-dj">
                        {data?.state.controllerName || "Your room"} is the DJ
                      </span>
                    )}
                    <button
                      className="music-text-button music-request"
                      disabled={busy || restricted || !!choice?.changeRequested}
                      onClick={() =>
                        choose(joined ? "accepted" : "declined", true)
                      }
                      aria-label="Request a different song"
                    >
                      <RefreshCw size={12} />
                      {choice?.changeRequested
                        ? "Request sent"
                        : "Change the vibe?"}
                    </button>
                  </div>
                  <div className="music-personal">
                    <button
                      className="music-icon"
                      aria-label={
                        muted ? "Unmute music for me" : "Mute music for me"
                      }
                      onClick={() => setMuted((v) => !v)}
                    >
                      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range"
                      aria-label="My music volume"
                      style={
                        { "--fill": volume * 100 + "%" } as React.CSSProperties
                      }
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                    />
                    <span>Just for you</span>
                  </div>
                  <div className="music-company">
                    <span>
                      <Headphones size={12} />
                      {listeners.length} joined
                    </span>
                    {requests.length > 0 && (
                      <span
                        className="music-requests"
                        title={requests.map((c) => c.name).join(", ")}
                      >
                        {requests.length}{" "}
                        {requests.length === 1 ? "person wants" : "people want"}{" "}
                        a new song
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="music-empty">
                  <span className="music-empty-record">
                    <Disc3 size={35} />
                  </span>
                  <h4>A little room for a soundtrack.</h4>
                  <p>
                    Add a favourite and let your people join in.
                    <br />
                    Everyone chooses what they listen to.
                  </p>
                </div>
              )}
              <div className="music-queue-heading">
                <h4>
                  Up next <span>{data?.queue.length || 0}/20</span>
                </h4>
                <button
                  className="music-text-button"
                  disabled={uploading || restricted || !ready}
                  onClick={() => file.current?.click()}
                >
                  <Plus size={13} />
                  {uploading ? "Adding…" : "Add a song"}
                </button>
              </div>
              {!!data?.queue.length && (
                <ol className="music-queue">
                  {data.queue.map((track, i) => (
                    <li key={track.id}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{track.title}</strong>
                        <small>
                          {track.addedByName} · {musicTime(track.duration)}
                          {track.mime.startsWith("video/")
                            ? " · Audio only"
                            : ""}
                        </small>
                      </div>
                      {(track.addedBy === userId ||
                        role === "owner" ||
                        role === "moderator") && (
                        <button
                          className="music-icon"
                          disabled={busy}
                          aria-label={"Remove " + track.title + " from queue"}
                          onClick={() =>
                            control("remove", { trackId: track.id })
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {!current && !!data?.queue.length && canControl && (
                <button
                  className="music-primary music-start-queue"
                  onClick={() => control("next")}
                  disabled={busy}
                >
                  <Play size={14} />
                  Start the next song
                </button>
              )}
              {!current &&
                !!data?.queue.length &&
                !canControl &&
                (!data.state.controllerOnline ||
                  role === "owner" ||
                  role === "moderator") && (
                  <button
                    className="music-text-button"
                    onClick={() => control("claim")}
                    disabled={busy}
                  >
                    Take the DJ seat
                  </button>
                )}
              {uploading && (
                <p className="music-uploading" role="status">
                  <LoaderCircle size={14} className="spin" />
                  Adding your soundtrack…
                </p>
              )}
              {!current && !data?.queue.length && (
                <button
                  className="music-upload-button"
                  disabled={uploading || restricted || !ready}
                  onClick={() => file.current?.click()}
                >
                  <Plus size={16} />
                  Add your first song
                </button>
              )}
              <p className="music-footnote">
                MP3, M4A, OGG, MP4 or WebM · up to 15 MB.
                <br />
                Videos play as audio. New songs always ask before joining.
              </p>
              {current && (
                <div className="music-session-actions">
                  {!canControl &&
                    !data?.state.controllerOnline &&
                    !restricted && (
                      <button
                        className="music-text-button"
                        onClick={() => control("claim")}
                        disabled={busy}
                      >
                        DJ stepped away · Take the seat
                      </button>
                    )}
                  {canControl && (
                    <button
                      className="music-text-button"
                      onClick={() => control("stop")}
                      disabled={busy}
                    >
                      End listening session
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {error && (
            <p className="music-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {!demo && (
        <input
          ref={file}
          hidden
          className="music-file-input"
          type="file"
          accept={MUSIC_ACCEPT}
          aria-label="Upload a music or video file"
          disabled={uploading || restricted}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setOpen(true);
              upload(f);
            }
          }}
        />
      )}
    </div>
  );
}
