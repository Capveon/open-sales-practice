import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type TextStreamReader,
} from "livekit-client";
import type { TranscriptTurn } from "@osp/core";

export type LiveKitCreds = { url: string; token: string };

export type AgentCue = "connecting" | "listening" | "thinking" | "speaking";

export type LiveLine = {
  role: TranscriptTurn["role"];
  text: string;
  segmentId: string;
};

type TranscriptionHandler = {
  onInterim: (line: LiveLine) => void;
  onFinal: (turn: TranscriptTurn, segmentId: string) => void;
  onCue: (cue: AgentCue) => void;
};

function roleFor(identity: string, localIdentity: string): TranscriptTurn["role"] {
  return identity === localIdentity || identity.startsWith("rep-") ? "seller" : "buyer";
}

function attachRemoteAudio(track: RemoteTrack | Track) {
  if (track.kind !== Track.Kind.Audio) return;
  const el = track.attach() as HTMLAudioElement;
  el.autoplay = true;
  el.setAttribute("playsinline", "true");
  el.style.display = "none";
  document.body.appendChild(el);
}

function cueFromAttributes(attrs: Record<string, string>): AgentCue | null {
  const raw = attrs["lk.agent.state"] || attrs["lk.agent_state"];
  if (raw === "speaking") return "speaking";
  if (raw === "thinking") return "thinking";
  if (raw === "listening" || raw === "listening_idle") return "listening";
  return null;
}

async function consumeTranscription(
  reader: TextStreamReader,
  identity: string,
  localIdentity: string,
  handlers: TranscriptionHandler,
) {
  const attrs = reader.info.attributes ?? {};
  const isFinal = attrs["lk.transcription_final"] === "true";
  const segmentId = attrs["lk.segment_id"] || reader.info.id;
  const role = roleFor(identity, localIdentity);

  if (isFinal) {
    const text = (await reader.readAll()).trim();
    if (!text) return;
    handlers.onFinal({ role, text, at: Date.now() }, segmentId);
    return;
  }

  let text = "";
  for await (const chunk of reader) {
    text += chunk;
    const next = text.trim();
    if (next) handlers.onInterim({ role, text: next, segmentId });
  }
}

export async function connectVoiceRoom(
  creds: LiveKitCreds,
  handlers: TranscriptionHandler,
): Promise<Room> {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });

  room.registerTextStreamHandler("lk.transcription", (reader, participant) => {
    const identity = participant.identity || "";
    void consumeTranscription(reader, identity, room.localParticipant.identity, handlers).catch(
      () => undefined,
    );
  });

  room.on(RoomEvent.TrackSubscribed, (track) => {
    attachRemoteAudio(track);
  });
  room.on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
    const cue = cueFromAttributes(participant.attributes);
    if (cue) handlers.onCue(cue);
  });
  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    const local = room.localParticipant.identity;
    const other = speakers.find((s) => s.identity !== local);
    if (other) handlers.onCue("speaking");
  });

  await room.connect(creds.url, creds.token, { autoSubscribe: true });
  await room.startAudio().catch(() => undefined);
  await room.localParticipant.setMicrophoneEnabled(true);

  room.remoteParticipants.forEach((p) => {
    const cue = cueFromAttributes(p.attributes);
    if (cue) handlers.onCue(cue);
    p.audioTrackPublications.forEach((pub) => {
      if (pub.track) attachRemoteAudio(pub.track);
    });
  });

  return room;
}

export async function sendChatToAgent(room: Room, text: string) {
  await room.localParticipant.sendText(text, { topic: "lk.chat" });
}
