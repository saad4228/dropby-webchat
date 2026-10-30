"use client";
import { useEffect, useRef, useState } from "react";
import { api, Member, Snapshot } from "../lib/client";
import type { Room, RemoteParticipant } from "livekit-client";
export function useCall(
  slug: string,
  userId: string,
  snapshot: Snapshot | null,
  refresh: () => void,
  onError: (s: string) => void,
) {
  const [active, setActive] = useState(false),
    [muted, setMuted] = useState(false),
    [camera, setCamera] = useState(false),
    [sharing, setSharing] = useState(false),
    [streams, setStreams] = useState<Record<string, MediaStream>>({}),
    [local, setLocal] = useState<MediaStream | null>(null),
    [started, setStarted] = useState(0),
    [provider, setProvider] = useState("peer"),
    [limit, setLimit] = useState(4),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [statuses, setStatuses] = useState<Record<string, string>>({});
  const peers = useRef<Record<string, RTCPeerConnection>>({}),
    sfu = useRef<Room | null>(null),
    startedServer = useRef(0),
    seen = useRef(new Set<string>()),
    localRef = useRef<MediaStream | null>(null),
    screen = useRef<MediaStream | null>(null),
    ice = useRef<RTCIceServer[]>([]),
    activeRef = useRef(false),
    working = useRef(false),
    pending = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const signal = async (id: string, data: unknown) =>
    api("rooms/" + slug + "/signals", {
      recipientId: id,
      data: JSON.stringify(data),
    });
  function peer(id: string) {
    if (peers.current[id]) return peers.current[id];
    const pc = new RTCPeerConnection({ iceServers: ice.current });
    peers.current[id] = pc;
    localRef.current
      ?.getTracks()
      .forEach((t) => pc.addTrack(t, localRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate)
        signal(id, {
          type: "candidate",
          candidate: e.candidate.toJSON(),
        }).catch(() => {});
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      setStreams((s) => ({ ...s, [id]: stream }));
    };
    pc.onconnectionstatechange = () => {
      setStatuses((s) => ({ ...s, [id]: pc.connectionState }));
      if (pc.connectionState === "failed")
        onError(
          "A call connection failed. Try leaving and joining again. Some networks need a TURN relay.",
        );
    };
    return pc;
  }
  function remoteParticipant(participant: RemoteParticipant) {
    const publications = [...participant.trackPublications.values()].filter(
      (p) => p.track && p.isSubscribed,
    );
    const video =
      publications.find((p) => p.source === "screen_share") ||
      publications.find((p) => p.kind === "video");
    const tracks = publications
      .filter((p) => p.kind === "audio")
      .map((p) => p.track!.mediaStreamTrack);
    if (video?.track) tracks.push(video.track.mediaStreamTrack);
    setStreams((s) => ({
      ...s,
      [participant.identity]: new MediaStream(tracks),
    }));
    setStatuses((s) => ({ ...s, [participant.identity]: "connected" }));
  }
  function updateLocalSfu() {
    if (!sfu.current) return;
    const tracks = [...sfu.current.localParticipant.trackPublications.values()]
      .filter((p) => p.track && p.source !== "screen_share")
      .map((p) => p.track!.mediaStreamTrack);
    localRef.current = new MediaStream(tracks);
    setLocal(new MediaStream(tracks));
  }
  async function start(video: boolean) {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError("Calls need a secure browser with microphone support.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video,
      });
      try {
        const result = await api("rooms/" + slug + "/call", { active: true });
        ice.current = result.iceServers;
        startedServer.current = result.startedAt;
        setProvider(result.provider);
        setLimit(result.limit);
        if (result.sfu) {
          const { Room, RoomEvent, Track } = await import("livekit-client");
          const room = new Room({ adaptiveStream: true, dynacast: true });
          sfu.current = room;
          room.on(RoomEvent.TrackSubscribed, (_t, _p, person) =>
            remoteParticipant(person),
          );
          room.on(RoomEvent.TrackUnsubscribed, (_t, _p, person) =>
            remoteParticipant(person),
          );
          room.on(RoomEvent.ParticipantDisconnected, (person) =>
            setStreams((s) => {
              const next = { ...s };
              delete next[person.identity];
              return next;
            }),
          );
          room.on(RoomEvent.Reconnecting, () =>
            onError("The call is reconnecting. Hold on a moment."),
          );
          room.on(RoomEvent.Disconnected, () => {
            if (activeRef.current) {
              onError("The call disconnected. You can join again.");
              stop();
            }
          });
          room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
            if (publication.source === Track.Source.ScreenShare)
              setSharing(false);
          });
          await room.connect(result.sfu.url, result.sfu.token);
          await Promise.all(
            stream.getTracks().map((track) =>
              room.localParticipant.publishTrack(track, {
                source:
                  track.kind === "audio"
                    ? Track.Source.Microphone
                    : Track.Source.Camera,
              }),
            ),
          );
        }
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        const room = sfu.current;
        sfu.current = null;
        await room?.disconnect();
        await api("rooms/" + slug + "/call", { active: false }).catch(() => {});
        throw e;
      }
      localRef.current = stream;
      setLocal(stream);
      setCamera(video);
      setMuted(false);
      seen.current.clear();
      activeRef.current = true;
      setActive(true);
      setStarted(Date.now());
      navigator.mediaDevices
        .enumerateDevices()
        .then(setDevices)
        .catch(() => {});
      refresh();
    } catch (e: any) {
      onError(
        e.name === "NotAllowedError"
          ? "Microphone or camera access was denied. Allow access in your browser and try again."
          : e.message || "Could not start this call.",
      );
    }
  }
  function stop() {
    activeRef.current = false;
    const room = sfu.current;
    sfu.current = null;
    room?.disconnect();
    Object.values(peers.current).forEach((pc) => pc.close());
    peers.current = {};
    localRef.current?.getTracks().forEach((t) => t.stop());
    screen.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocal(null);
    setStreams({});
    setActive(false);
    setSharing(false);
    setStatuses({});
    api("rooms/" + slug + "/call", { active: false })
      .then(refresh)
      .catch(() => {});
  }
  function toggleMute() {
    if (sfu.current) {
      sfu.current.localParticipant
        .setMicrophoneEnabled(muted)
        .then(() => {
          setMuted(!muted);
          updateLocalSfu();
        })
        .catch((e) => onError(e.message));
      return;
    }
    localRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = muted;
    });
    setMuted(!muted);
  }
  async function toggleCamera() {
    try {
      if (sfu.current) {
        await sfu.current.localParticipant.setCameraEnabled(!camera);
        setCamera(!camera);
        updateLocalSfu();
        return;
      }
      if (camera) {
        localRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
        setCamera(false);
        return;
      }
      const existing = localRef.current?.getVideoTracks()[0];
      if (existing) {
        existing.enabled = true;
        setCamera(true);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      localRef.current?.addTrack(track);
      setLocal(new MediaStream(localRef.current!.getTracks()));
      for (const [id, pc] of Object.entries(peers.current)) {
        pc.addTrack(track, localRef.current!);
        await pc.setLocalDescription(await pc.createOffer());
        await signal(id, { type: "offer", description: pc.localDescription });
      }
      setCamera(true);
    } catch (e: any) {
      onError(e.message || "Camera unavailable.");
    }
  }
  async function shareScreen() {
    if (sfu.current) {
      try {
        await sfu.current.localParticipant.setScreenShareEnabled(!sharing);
        setSharing(!sharing);
      } catch (e: any) {
        onError(e.message || "Screen sharing is unavailable.");
      }
      return;
    }
    if (sharing) {
      screen.current?.getTracks().forEach((t) => t.stop());
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      screen.current = stream;
      const track = stream.getVideoTracks()[0];
      for (const [id, pc] of Object.entries(peers.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
        else {
          pc.addTrack(track, stream);
          await pc.setLocalDescription(await pc.createOffer());
          await signal(id, { type: "offer", description: pc.localDescription });
        }
      }
      track.onended = () => {
        for (const pc of Object.values(peers.current)) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(localRef.current?.getVideoTracks()[0] || null);
        }
        setSharing(false);
        screen.current = null;
      };
      setSharing(true);
    } catch (e: any) {
      if (e.name !== "NotAllowedError")
        onError("Screen sharing is not available in this browser.");
    }
  }
  useEffect(() => {
    if (!active || !snapshot || working.current || sfu.current) return;
    working.current = true;
    const task = async () => {
      for (const s of snapshot.signals) {
        if (seen.current.has(s.id) || s.created < startedServer.current)
          continue;
        seen.current.add(s.id);
        try {
          const data = JSON.parse(s.data),
            pc = peer(s.senderId);
          if (data.type === "offer") {
            if (pc.signalingState === "have-local-offer") {
              if (userId < s.senderId) continue;
              await pc.setLocalDescription({ type: "rollback" });
            }
            await pc.setRemoteDescription(data.description);
            for (const c of pending.current[s.senderId] || [])
              await pc.addIceCandidate(c);
            pending.current[s.senderId] = [];
            await pc.setLocalDescription(await pc.createAnswer());
            await signal(s.senderId, {
              type: "answer",
              description: pc.localDescription,
            });
          } else if (
            data.type === "answer" &&
            pc.signalingState === "have-local-offer"
          ) {
            await pc.setRemoteDescription(data.description);
            for (const c of pending.current[s.senderId] || [])
              await pc.addIceCandidate(c);
            pending.current[s.senderId] = [];
          } else if (data.type === "candidate") {
            if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
            else (pending.current[s.senderId] ||= []).push(data.candidate);
          }
        } catch (e) {
          console.error("Call signaling failed", e);
        }
      }
      for (const m of snapshot.members.filter(
        (m) => m.online && m.inCall && m.id !== userId,
      )) {
        if (!peers.current[m.id] && userId < m.id) {
          try {
            const pc = peer(m.id);
            await pc.setLocalDescription(await pc.createOffer());
            await signal(m.id, {
              type: "offer",
              description: pc.localDescription,
            });
          } catch {
            onError("Could not connect to a participant.");
          }
        }
      }
      for (const [id, pc] of Object.entries(peers.current)) {
        if (
          !snapshot.members.some((m) => m.id === id && m.online && m.inCall)
        ) {
          pc.close();
          delete peers.current[id];
          setStreams((s) => {
            const next = { ...s };
            delete next[id];
            return next;
          });
        }
      }
    };
    task().finally(() => {
      working.current = false;
    });
  }, [snapshot, active, started, userId]);
  async function switchDevice(
    kind: "audioinput" | "videoinput",
    deviceId: string,
  ) {
    try {
      if (sfu.current) {
        await sfu.current.switchActiveDevice(kind, deviceId);
        updateLocalSfu();
        return;
      }
      const next = await navigator.mediaDevices.getUserMedia(
        kind === "audioinput"
          ? { audio: { deviceId: { exact: deviceId } } }
          : { video: { deviceId: { exact: deviceId } } },
      );
      const track = next.getTracks()[0],
        mediaKind = kind === "audioinput" ? "audio" : "video";
      track.enabled = kind === "audioinput" ? !muted : camera;
      const old = localRef.current
        ?.getTracks()
        .find((t) => t.kind === mediaKind);
      for (const [id, pc] of Object.entries(peers.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === mediaKind);
        if (sender) await sender.replaceTrack(track);
        else {
          pc.addTrack(track, localRef.current!);
          await pc.setLocalDescription(await pc.createOffer());
          await signal(id, { type: "offer", description: pc.localDescription });
        }
      }
      if (old) {
        localRef.current?.removeTrack(old);
        old.stop();
      }
      localRef.current?.addTrack(track);
      setLocal(new MediaStream(localRef.current!.getTracks()));
    } catch (e: any) {
      onError(e.message || "Could not switch devices.");
    }
  }
  useEffect(() => {
    const exit = () => {
      if (activeRef.current)
        navigator.sendBeacon(
          "/api/rooms/" + slug + "/call",
          new Blob([JSON.stringify({ active: false })], {
            type: "application/json",
          }),
        );
    };
    window.addEventListener("pagehide", exit);
    return () => {
      window.removeEventListener("pagehide", exit);
      Object.values(peers.current).forEach((pc) => pc.close());
      const room = sfu.current;
      sfu.current = null;
      room?.disconnect();
      localRef.current?.getTracks().forEach((t) => t.stop());
      screen.current?.getTracks().forEach((t) => t.stop());
      if (activeRef.current)
        api("rooms/" + slug + "/call", { active: false }).catch(() => {});
    };
  }, [slug]);
  return {
    provider,
    limit,
    devices,
    switchDevice,
    active,
    muted,
    camera,
    sharing,
    streams,
    local,
    started,
    statuses,
    start,
    stop,
    toggleMute,
    toggleCamera,
    shareScreen,
  };
}
