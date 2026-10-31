"use client";
import { useEffect, useRef, useState } from "react";

export function useVoiceRecorder(
  demo: boolean,
  notify: (message: string) => void,
) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!recording || paused) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording, paused]);
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
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
      const mime = ["audio/webm", "audio/ogg", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const rec = new MediaRecorder(
        source,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        if (chunks.current.length)
          setPreview(new Blob(chunks.current, { type: rec.mimeType }));
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
    if (paused) recorder.current?.resume();
    else recorder.current?.pause();
    setPaused(!paused);
  }
  return {
    recording,
    paused,
    seconds,
    preview,
    previewUrl,
    start,
    cancel,
    togglePause,
    stop: () => recorder.current?.stop(),
    clearPreview: () => setPreview(null),
  };
}
