export type MusicTrack = {
  id: string;
  attachmentId: string;
  title: string;
  duration: number;
  addedBy: string;
  addedByName: string;
  mime: string;
};
export type MusicState = {
  trackId: string | null;
  controllerId: string | null;
  controllerName: string | null;
  controllerOnline: boolean;
  position: number;
  playing: boolean;
  updatedAt: number;
  revision: number;
};
export type MusicSnapshot = {
  state: MusicState;
  current: MusicTrack | null;
  queue: MusicTrack[];
  choices: {
    sessionId: string;
    name: string;
    response: string;
    changeRequested: boolean;
  }[];
  ownChoice: {
    trackId: string;
    response: string;
    changeRequested: boolean;
  } | null;
  serverNow: number;
};
export const MUSIC_MIMES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/webm",
];
export const MUSIC_ACCEPT =
  ".mp3,.m4a,.mp4,.webm,.ogg,audio/mpeg,audio/mp4,audio/webm,audio/ogg,video/mp4,video/webm";
export function musicPosition(
  state: Pick<MusicState, "position" | "playing" | "updatedAt">,
  duration: number,
  serverNow: number,
) {
  return Math.max(
    0,
    Math.min(
      duration,
      state.position +
        (state.playing ? Math.max(0, serverNow - state.updatedAt) / 1000 : 0),
    ),
  );
}
export function musicTime(seconds: number) {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
}
