"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import {
  commitLiveLines,
  mergeTranscripts,
  upsertSegment,
  type TapeLine,
  type TranscriptTurn,
} from "@osp/core";
import {
  connectVoiceRoom,
  sendChatToAgent,
  type AgentCue,
  type LiveKitCreds,
} from "@/lib/voice-room";

type CallPayload = {
  id: string;
  status: string;
  startedAt: number;
  transcript: TranscriptTurn[];
  profile: {
    name: string;
    title: string;
    organization: string;
    repBrief: string;
    vernacular: string[];
  };
};

type Phase = "connecting" | "speaking" | "listening" | "thinking" | "muted" | "hanging";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CallSession({ id }: { id: string }) {
  const router = useRouter();
  const [call, setCall] = useState<CallPayload | null>(null);
  const [maxSeconds, setMaxSeconds] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState("");
  const [tape, setTape] = useState<TapeLine[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const hungRef = useRef(false);
  const mutedRef = useRef(false);
  const hangupRef = useRef<() => void>(() => undefined);
  const tapeRef = useRef<TapeLine[]>([]);
  const agentTapeRef = useRef<TranscriptTurn[]>([]);

  const setCallPhase = (next: Phase) => setPhase(next);

  const persistTranscript = useCallback(
    (turns: TranscriptTurn[]) => {
      void fetch(`/api/calls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: turns }),
      }).catch(() => undefined);
    },
    [id],
  );

  const replaceTape = useCallback(
    (next: TapeLine[]) => {
      tapeRef.current = next;
      setTape(next);
      persistTranscript(mergeTranscripts(commitLiveLines(next), agentTapeRef.current));
    },
    [persistTranscript],
  );

  const sendTyped = useCallback(async () => {
    const text = draft.trim();
    if (!text || hungRef.current || !roomRef.current) return;
    setDraft("");
    replaceTape(
      upsertSegment(tapeRef.current, {
        role: "seller",
        text,
        at: Date.now(),
        segmentId: `typed-${Date.now()}`,
        live: false,
      }),
    );
    await sendChatToAgent(roomRef.current, text);
  }, [draft, replaceTape]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    const run = async () => {
      const loaded = await fetch(`/api/calls/${id}`, { signal: ac.signal });
      const json = await loaded.json();
      if (!loaded.ok) throw new Error(json.error ?? "Missing call");
      if (!alive) return;
      if (typeof json.callMaxSeconds === "number") setMaxSeconds(json.callMaxSeconds);
      const c = json.call as CallPayload;
      setCall(c);
      const seeded = (c.transcript ?? []).map((turn, index) => ({
        ...turn,
        segmentId: `seed-${index}`,
        live: false,
      }));
      tapeRef.current = seeded;
      setTape(seeded);
      if (c.status !== "live") {
        router.replace(`/call/${id}/debrief`);
        return;
      }
      const stored = sessionStorage.getItem(`osp:livekit:${id}`);
      const fromStore = stored ? (JSON.parse(stored) as LiveKitCreds | null) : null;
      const lk = (json.livekit as LiveKitCreds | null) ?? fromStore;
      if (!lk?.url || !lk.token) {
        throw new Error("LiveKit is not configured.");
      }
      sessionStorage.setItem(`osp:livekit:${id}`, JSON.stringify(lk));
      const room = await connectVoiceRoom(lk, {
        onCaption: (line) => {
          if (hungRef.current) return;
          replaceTape(
            upsertSegment(tapeRef.current, {
              role: line.role,
              text: line.text,
              at: Date.now(),
              segmentId: line.segmentId,
              live: !line.final,
            }),
          );
        },
        onTape: (turns) => {
          agentTapeRef.current = mergeTranscripts(agentTapeRef.current, turns);
          persistTranscript(mergeTranscripts(commitLiveLines(tapeRef.current), agentTapeRef.current));
        },
        onCue: (cue: AgentCue) => {
          if (hungRef.current || mutedRef.current) return;
          if (cue === "speaking") setCallPhase("speaking");
          else if (cue === "thinking") setCallPhase("thinking");
          else setCallPhase("listening");
        },
        onRemoteHangup: () => {
          hangupRef.current();
        },
      });
      if (!alive) {
        room.disconnect();
        return;
      }
      roomRef.current = room;
      setCallPhase("listening");
    };

    void run().catch((e: Error) => {
      if (!alive || e.name === "AbortError") return;
      setError(e.message);
    });

    return () => {
      alive = false;
      ac.abort();
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [id, persistTranscript, replaceTape, router]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [tape]);

  useEffect(() => {
    if (!call?.startedAt) return;
    const tick = () => setElapsed(Date.now() - call.startedAt);
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [call?.startedAt]);

  const hangup = useCallback(async () => {
    if (hungRef.current) return;
    hungRef.current = true;
    setCallPhase("hanging");
    const turns = mergeTranscripts(commitLiveLines(tapeRef.current), agentTapeRef.current);
    roomRef.current?.disconnect();
    roomRef.current = null;
    try {
      const res = await fetch(`/api/calls/${id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: turns }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        hungRef.current = false;
        setError(typeof json.error === "string" ? json.error : "Could not hang up.");
        setCallPhase("listening");
        return;
      }
      router.replace(`/call/${id}/debrief`);
    } catch (err) {
      hungRef.current = false;
      setError(err instanceof Error ? err.message : "Could not hang up.");
      setCallPhase("listening");
    }
  }, [id, router]);

  hangupRef.current = () => {
    void hangup();
  };

  useEffect(() => {
    if (!call) return;
    if (elapsed / 1000 < maxSeconds) return;
    void hangup();
  }, [call, elapsed, hangup, maxSeconds]);

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!next);
    }
    setCallPhase(next ? "muted" : "listening");
  };

  if (error && !call) {
    return (
      <main className="phone">
        <p className="phone__error">{error}</p>
      </main>
    );
  }
  if (!call) {
    return (
      <main className="phone">
        <p className="t-eyebrow">Connecting</p>
        <p className="phone__timer">00:00</p>
      </main>
    );
  }

  const cue =
    phase === "connecting"
      ? "Calling…"
      : phase === "speaking"
        ? "Speaking"
        : phase === "listening"
          ? "Listening"
          : phase === "thinking"
            ? "Thinking"
            : phase === "muted"
              ? "Muted"
              : "Hanging up";
  const buyerName = call.profile.name.split(" ")[0] ?? call.profile.name;

  return (
    <main className="phone">
      <header className="phone__status">
        <span className="status-dot" data-off={call.status !== "live" || phase === "hanging"} />
        <span className="t-eyebrow">{cue}</span>
        <span className="phone__timer">{clock(elapsed)}</span>
      </header>

      <section className="phone__face">
        <div className="phone__avatar" aria-hidden>
          {initials(call.profile.name)}
        </div>
        <h1 className="phone__name">{call.profile.name}</h1>
        <p className="phone__meta">
          {call.profile.title}
          <span> · </span>
          {call.profile.organization}
        </p>
        {error ? <p className="phone__error">{error}</p> : null}
      </section>

      <section className="phone__tape" ref={scroller} aria-label="Live transcript">
        {tape.length === 0 ? (
          <p className="phone__line phone__line--empty">Waiting for the first line…</p>
        ) : (
          tape.map((t, i) => (
            <p
              key={t.segmentId ?? `${t.at}-${i}`}
              className="phone__line"
              data-role={t.role}
              data-live={t.live ? "true" : undefined}
            >
              <span className="phone__who">{t.role === "buyer" ? buyerName : "You"}</span>
              {t.text}
            </p>
          ))
        )}
      </section>

      <footer className="phone__dock">
        <form
          className="call-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void sendTyped();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type if you need to"
            aria-label="Send a line"
            disabled={phase === "hanging"}
            autoComplete="off"
          />
        </form>
        <button
          type="button"
          className="phone-btn"
          data-on={muted}
          onClick={() => void toggleMute()}
          aria-pressed={muted}
          disabled={phase === "hanging"}
        >
          <span className="t-eyebrow">{muted ? "Unmute" : "Mute"}</span>
        </button>
        <button
          type="button"
          className="phone-btn phone-btn--hang"
          onClick={() => void hangup()}
          disabled={phase === "hanging"}
          aria-busy={phase === "hanging"}
        >
          <span className="t-eyebrow">{phase === "hanging" ? "Hanging up…" : "Hang up"}</span>
        </button>
      </footer>
    </main>
  );
}
