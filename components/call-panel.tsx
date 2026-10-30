"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Avatar } from "./brand";
import { Member, Identity } from "../lib/client";
import { useCall } from "../hooks/use-call";
function VideoStream({
  stream,
  muted = false,
}: {
  stream: MediaStream;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}
export default function CallPanel({
  call,
  user,
  members,
}: {
  call: ReturnType<typeof useCall>;
  user: Identity;
  members: Member[];
}) {
  const [expanded, setExpanded] = useState(false),
    [duration, setDuration] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setDuration(Math.floor((Date.now() - call.started) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [call.started]);
  return (
    <div className={"call-panel " + (expanded ? "expanded" : "")}>
      <header>
        <span className="call-pulse" />
        <div>
          <strong>Room call</strong>
          <small>
            {members.length} participant{members.length !== 1 ? "s" : ""} ·{" "}
            {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
          </small>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Minimize call" : "Expand call"}
        >
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </header>
      <div className="call-people">
        {call.local && call.camera ? (
          <div className="call-video">
            <VideoStream stream={call.local} muted />
            <small>You {call.muted && "· muted"}</small>
          </div>
        ) : (
          <div className="call-person">
            <Avatar {...user} />
            <span>You {call.muted && "· muted"}</span>
          </div>
        )}
        {members
          .filter((m) => m.id !== user.id)
          .map((m) => (
            <div className="call-video" key={m.id}>
              {call.streams[m.id] ? (
                <VideoStream stream={call.streams[m.id]} />
              ) : (
                <Avatar {...m} />
              )}
              <small>
                {m.name} · {call.statuses[m.id] || "connecting"}
              </small>
            </div>
          ))}
      </div>
      {members.length === 1 && (
        <p className="call-waiting">
          You’re here first. Others can join from the room.
        </p>
      )}
      <div className="call-controls">
        <button
          onClick={call.toggleMute}
          className={call.muted ? "off" : ""}
          aria-label={call.muted ? "Unmute microphone" : "Mute microphone"}
        >
          {call.muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          onClick={call.toggleCamera}
          className={!call.camera ? "off" : ""}
          aria-label={call.camera ? "Turn camera off" : "Turn camera on"}
        >
          {call.camera ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button
          onClick={call.shareScreen}
          className={call.sharing ? "active" : ""}
          aria-label="Share your screen"
        >
          <MonitorUp size={18} />
        </button>
        <button className="hangup" onClick={call.stop} aria-label="Leave call">
          <PhoneOff size={19} />
        </button>
      </div>
      {expanded && (
        <div className="call-device-pickers">
          {(["audioinput", "videoinput"] as const).map((kind) => (
            <label key={kind}>
              {kind === "audioinput" ? "Microphone" : "Camera"}
              <select
                aria-label={
                  kind === "audioinput" ? "Choose microphone" : "Choose camera"
                }
                onChange={(e) => call.switchDevice(kind, e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a device
                </option>
                {call.devices
                  .filter((d) => d.kind === kind)
                  .map((d, i) => (
                    <option value={d.deviceId} key={d.deviceId}>
                      {d.label ||
                        (kind === "audioinput" ? "Microphone " : "Camera ") +
                          (i + 1)}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <small className="call-limit">
        {call.provider === "livekit" ? "Group calls" : "Small-group calls"} · up
        to {call.limit} people
      </small>
    </div>
  );
}
