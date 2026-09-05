import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type TextStreamReader,
} from "livekit-client";
import {
  parseTranscriptionText,
  parseTranscriptJson,
  TRANSCRIPT_TOPIC,
  type TranscriptTurn,
} from "@osp/core";

export type LiveKitCreds = { url: string; token: string };

export type AgentCue = "connecting" | "listening" | "thinking" | "speaking";

export type LiveLine = {
  role: TranscriptTurn["role"];
  text: string;
  segmentId: string;
  final: boolean;
};

type TranscriptionHandler = {
  onCaption: (line: LiveLine) => void;
  onTape: (turns: TranscriptTurn[]) => void;
  onCue: (cue: AgentCue) => void;
  onRemoteHangup: () => void;
};

function roleFor(identity: string, localIdentity: string): TranscriptTurn["role"] {
  return identity === localIdentity || identity.startsWith("rep-") ? "seller" : "buyer";
}

function isFinalStream(attrs: Record<string, string>): boolean {
  return String(attrs["lk.transcription_final"] ?? "").toLowerCase() === "true";
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
  const segmentId = attrs["lk.segment_id"] || `${identity}:${reader.info.id}`;
  const role = roleFor(identity, localIdentity);
  const finalFromAttrs = isFinalStream(attrs);

  if (finalFromAttrs) {
    const text = parseTranscriptionText(await reader.readAll());
    if (!text) return;
    handlers.onCaption({ role, text, segmentId, final: true });
    return;
  }

  let raw = "";
  for await (const chunk of reader) {
    raw += chunk;
    const text = parseTranscriptionText(raw);
    if (text) handlers.onCaption({ role, text, segmentId, final: false });
  }
  const text = parseTranscriptionText(raw);
  if (text) handlers.onCaption({ role, text, segmentId, final: true });
}

async function consumeTape(reader: TextStreamReader, handlers: TranscriptionHandler) {
  const turns = parseTranscriptJson(await reader.readAll());
  if (turns.length) handlers.onTape(turns);
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
  room.registerTextStreamHandler(TRANSCRIPT_TOPIC, (reader) => {
    void consumeTape(reader, handlers).catch(() => undefined);
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

  let heardBuyer = room.remoteParticipants.size > 0;
  let hangupTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRemoteHangup = () => {
    if (!heardBuyer || hangupTimer) return;
    hangupTimer = setTimeout(() => handlers.onRemoteHangup(), 700);
  };
  room.on(RoomEvent.ParticipantConnected, () => {
    heardBuyer = true;
  });
  room.on(RoomEvent.ParticipantDisconnected, scheduleRemoteHangup);
  room.on(RoomEvent.Disconnected, scheduleRemoteHangup);

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
