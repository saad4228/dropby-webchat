"use client";
import { useEffect, useRef, useState } from "react";
import { AUDIO_TYPES } from "../lib/media-config";
import type { MediaHints } from "../lib/media-prepare";

export function useVoiceRecorder(
  demo: boolean,
  notify: (message: string) => void,
) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [hints, setHints] = useState<MediaHints>({});
  const levels = useRef<number[]>([]),
    audioContext = useRef<AudioContext | null>(null),
    analyser = useRef<AnalyserNode | null>(null),
    timing = useRef({ start: 0, pausedAt: 0, pausedFor: 0 });
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!recording || paused) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording, paused]);
  useEffect(() => {
    if (!recording || paused) return;
    const timer = setInterval(() => {
      if (!analyser.current) return;
      const values = new Float32Array(analyser.current.fftSize);
      analyser.current.getFloatTimeDomainData(values);
      levels.current.push(
        Math.sqrt(values.reduce((sum, n) => sum + n * n, 0) / values.length),
      );
    }, 100);
    return () => clearInterval(timer);
  }, [recording, paused]);
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      void audioContext.current?.close().catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (!preview) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  async function start() {
    if (demo) {
      notify("Create a real room to send voice notes.");
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("Voice recording is not supported in this browser.");
      const source = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = source;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        ...AUDIO_TYPES.filter((type) => type !== "audio/mpeg"),
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        source,
        mime
          ? { mimeType: mime, audioBitsPerSecond: 64000 }
          : { audioBitsPerSecond: 64000 },
      );
      recorder.current = rec;
      chunks.current = [];
      levels.current = [];
      timing.current = { start: performance.now(), pausedAt: 0, pausedFor: 0 };
      try {
        const context = new AudioContext();
        audioContext.current = context;
        analyser.current = context.createAnalyser();
        analyser.current.fftSize = 256;
        context.createMediaStreamSource(source).connect(analyser.current);
        void context.resume().catch(() => {});
      } catch {
        /* Recording still works if waveform analysis is unavailable. */
      }
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        if (chunks.current.length)
          setPreview(new Blob(chunks.current, { type: rec.mimeType }));
        const now = performance.now(),
          time = timing.current;
        const duration = Math.max(
          0,
          (now -
            time.start -
            time.pausedFor -
            (time.pausedAt ? now - time.pausedAt : 0)) /
            1000,
        );
        const max = levels.current.reduce(
            (peak, value) => Math.max(peak, value),
            0.001,
          ),
          step = Math.max(1, Math.ceil(levels.current.length / 34));
        const waveform = Array.from({ length: 34 }, (_, i) =>
          Math.min(
            1,
            Math.max(0, ...levels.current.slice(i * step, (i + 1) * step)) /
              max,
          ),
        );
        setHints({ duration, waveform });
        void audioContext.current?.close().catch(() => {});
        audioContext.current = null;
        analyser.current = null;
        source.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setPaused(false);
      };
      rec.start(250);
      setSeconds(0);
      setRecording(true);
    } catch (error: any) {
      notify(
        error.name === "NotAllowedError"
          ? "Allow microphone access to record a voice note."
          : error.message,
      );
    }
  }
  function cancel() {
    chunks.current = [];
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
    setPreview(null);
  }
  function togglePause() {
    if (paused) {
      recorder.current?.resume();
      timing.current.pausedFor += performance.now() - timing.current.pausedAt;
      timing.current.pausedAt = 0;
    } else {
      recorder.current?.pause();
      timing.current.pausedAt = performance.now();
    }
    setPaused(!paused);
  }
  return {
    recording,
    paused,
    seconds,
    preview,
    previewUrl,
    hints,
    start,
    cancel,
    togglePause,
    stop: () => recorder.current?.stop(),
    clearPreview: () => setPreview(null),
  };
}
