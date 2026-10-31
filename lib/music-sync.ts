export function playbackCorrection({
  drift,
  revisionChanged,
  seeking,
  readyState,
  sinceSeek,
}: {
  drift: number;
  revisionChanged: boolean;
  seeking: boolean;
  readyState: number;
  sinceSeek: number;
}) {
  // Apply explicit commands once; normal buffering must never become a repeated seek loop.
  if (revisionChanged && !seeking && readyState >= 3)
    return { seek: Math.abs(drift) > 0.12, rate: 1 };
  if (seeking || readyState < 3) return { seek: false, rate: 1 };
  if (Math.abs(drift) > 2 && sinceSeek > 5000) return { seek: true, rate: 1 };
  return {
    seek: false,
    rate: Math.abs(drift) > 0.15 ? (drift > 0 ? 1.025 : 0.975) : 1,
  };
}
export function musicClockOffset(
  clientSent: number,
  clientReceived: number,
  serverReceived: number | undefined,
  serverSent: number,
) {
  return serverReceived === undefined
    ? serverSent - (clientSent + clientReceived) / 2
    : (serverReceived - clientSent + (serverSent - clientReceived)) / 2;
}
