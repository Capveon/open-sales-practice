"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { openMic, similarUtterance, startUtteranceLoop, type MicHandle } from "@/lib/mic";
import {
  attachPlayer,
  getPlaybackContext,
  isPlaybackCancelled,
  playMpeg,
  stopPlayback,
  unlockPlayback,
} from "@/lib/playback";
import type { TranscriptTurn } from "@osp/core";

type CallPayload = {
  id: string;
  status: string;
  voiceMode: string;
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

type Phase = "connecting" | "speaking" | "listening" | "thinking" | "muted" | "live" | "hanging";

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

function lastBuyerText(turns: TranscriptTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn?.role === "buyer") return turn.text;
  }
  return "";
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      return;
    }
    const t = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(t);
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      },
      { once: true },
    );
  });
}

export function CallSession({ id }: { id: string }) {
  const router = useRouter();
  const [call, setCall] = useState<CallPayload | null>(null);
  const [maxSeconds, setMaxSeconds] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const micRef = useRef<MicHandle | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const mutedRef = useRef(false);
  const hungRef = useRef(false);
  const busyRef = useRef(false);
  const phaseRef = useRef<Phase>("connecting");
  const mockRef = useRef(false);
  const lastBuyerRef = useRef("");
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const clipSeq = useRef(0);
  const applyCallRef = useRef<(next: CallPayload) => void>(() => {});
  const playBuyerRef = useRef<(line: { text: string; audio?: { mime: string; base64: string } | null }) => Promise<void>>(
    async () => {},
  );

  const setCallPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const applyCall = useCallback((next: CallPayload) => {
    setCall(next);
    transcriptRef.current = next.transcript ?? [];
    lastBuyerRef.current = lastBuyerText(next.transcript ?? []);
  }, []);
  applyCallRef.current = applyCall;

  const canListen = useCallback(() => {
    return (
      mockRef.current &&
      !hungRef.current &&
      !mutedRef.current &&
      !busyRef.current &&
      phaseRef.current === "listening"
    );
  }, []);

  const goListen = useCallback(() => {
    if (hungRef.current) return;
    if (mutedRef.current) {
      setCallPhase("muted");
      micRef.current?.setEarpiece(true);
      return;
    }
    micRef.current?.setEarpiece(false);
    setCallPhase("listening");
  }, []);

  const saveClip = useCallback(
    (role: "buyer" | "seller", mime: string, base64: string) => {
      if (!base64) return;
      const seq = clipSeq.current++;
      void fetch(`/api/calls/${id}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, mime, base64, seq, at: Date.now() }),
      }).catch(() => undefined);
    },
    [id],
  );

  const playBuyer = useCallback(
    async (line: { text: string; audio?: { mime: string; base64: string } | null }) => {
      if (hungRef.current) return;
      lastBuyerRef.current = line.text;
      setCallPhase("speaking");
      micRef.current?.setEarpiece(true);
      try {
        if (line.audio?.base64) {
          saveClip("buyer", line.audio.mime || "audio/mpeg", line.audio.base64);
          await playMpeg(line.audio.base64, line.audio.mime);
        } else {
          setError(
            "You should hear them. Add ELEVENLABS_API_KEY (or OPENAI_API_KEY) so this is a real voice, not a robot.",
          );
        }
        await sleep(750);
      } catch (err) {
        if (isPlaybackCancelled(err)) return;
        setError(err instanceof Error ? err.message : "Buyer audio failed to play.");
        await sleep(280);
      }
      if (hungRef.current || phaseRef.current !== "speaking") return;
      goListen();
    },
    [goListen, saveClip],
  );
  playBuyerRef.current = playBuyer;

  const sendUtterance = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current || hungRef.current) return;
      if (similarUtterance(trimmed, lastBuyerRef.current)) return;
      busyRef.current = true;
      setInterim("");
      setCallPhase("thinking");
      micRef.current?.setEarpiece(true);
      try {
        const res = await fetch(`/api/calls/${id}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Turn failed");
          busyRef.current = false;
          if (!hungRef.current) goListen();
          return;
        }
        applyCallRef.current(json.call);
        if (json.voiceError) setError(json.voiceError);
        busyRef.current = false;
        if (json.reply) await playBuyerRef.current({ text: json.reply, audio: json.audio });
        else if (!hungRef.current) goListen();
      } catch (err) {
        busyRef.current = false;
        if (!hungRef.current) {
          setError(err instanceof Error ? err.message : "Turn failed");
          goListen();
        }
      }
    },
    [goListen, id],
  );

  const onUtterance = useCallback(
    async (blob: Blob) => {
      if (!canListen() || hungRef.current || busyRef.current) return;
      setInterim("…");
      setCallPhase("thinking");
      micRef.current?.setEarpiece(true);
      try {
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
        saveClip("seller", blob.type || "audio/webm", btoa(binary));
        const form = new FormData();
        const name = blob.type.includes("mp4") ? "utterance.m4a" : "utterance.webm";
        form.append("file", blob, name);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not hear that.");
        const text = String(json.text ?? "").trim();
        if (!text || similarUtterance(text, lastBuyerRef.current)) {
          if (!hungRef.current) goListen();
          return;
        }
        setInterim(text);
        await sendUtterance(text);
      } catch (err) {
        if (!hungRef.current) {
          setError(err instanceof Error ? err.message : "Could not hear that.");
          goListen();
        }
      }
    },
    [canListen, goListen, saveClip, sendUtterance],
  );

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    const teardownMic = () => {
      stopLoopRef.current?.();
      stopLoopRef.current = null;
      micRef.current?.stop();
      micRef.current = null;
    };

    const run = async () => {
      const loaded = await fetch(`/api/calls/${id}`, { signal: ac.signal });
      const json = await loaded.json();
      if (!loaded.ok) throw new Error(json.error ?? "Missing call");
      if (!alive) return;
      if (typeof json.callMaxSeconds === "number") setMaxSeconds(json.callMaxSeconds);
      const c = json.call as CallPayload;
      applyCall(c);
      if (c.status !== "live") {
        router.replace(`/call/${id}/debrief`);
        return;
      }
      mockRef.current = c.voiceMode !== "voice";
      if (c.voiceMode === "voice") {
        const raw = sessionStorage.getItem(`osp:livekit:${id}`);
        const lk = raw ? (JSON.parse(raw) as { url: string; token: string } | null) : null;
        if (lk?.url && lk.token) {
          const room = new Room();
          roomRef.current = room;
          await room.connect(lk.url, lk.token);
          if (!alive) {
            room.disconnect();
            return;
          }
          await room.localParticipant.setMicrophoneEnabled(true);
          const attach = (track: Track) => {
            if (track.kind !== Track.Kind.Audio) return;
            const el = track.attach();
            el.autoplay = true;
            document.body.appendChild(el);
          };
          room.remoteParticipants.forEach((p) => {
            p.audioTrackPublications.forEach((pub) => {
              if (pub.track) attach(pub.track);
            });
          });
          room.on(RoomEvent.TrackSubscribed, (track) => attach(track));
          room.on(RoomEvent.TranscriptionReceived, (segments) => {
            const text = segments.map((s) => s.text).join(" ").trim();
            if (!text) return;
            setCall((cur) => {
              if (!cur) return cur;
              const last = cur.transcript[cur.transcript.length - 1];
              const role: TranscriptTurn["role"] = last?.role === "seller" ? "seller" : "buyer";
              const turn: TranscriptTurn = { role, text, at: Date.now() };
              const next: CallPayload = { ...cur, transcript: [...cur.transcript, turn] };
              transcriptRef.current = next.transcript;
              lastBuyerRef.current = lastBuyerText(next.transcript);
              return next;
            });
          });
          setCallPhase("live");
        }
        return;
      }

      await unlockPlayback();
      if (!alive) return;
      const mic = await openMic();
      if (!alive) {
        mic.stop();
        return;
      }
      micRef.current = mic;
      mic.setEarpiece(true);
      const ctx = getPlaybackContext();
      if (ctx.state === "suspended") await ctx.resume();
      stopLoopRef.current = startUtteranceLoop({
        stream: mic.stream,
        context: ctx,
        shouldListen: canListen,
        onUtterance: (blob) => {
          void onUtterance(blob);
        },
      });

      const boot = await fetch(`/api/calls/${id}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bootstrap: true }),
        signal: ac.signal,
      });
      const bootJson = await boot.json();
      if (!alive) return;
      if (!boot.ok) {
        setError(bootJson.error ?? "Could not reach the buyer.");
        return;
      }
      applyCall(bootJson.call);
      if (bootJson.voiceError) setError(bootJson.voiceError);
      if (bootJson.reply) await playBuyer({ text: bootJson.reply, audio: bootJson.audio });
      else goListen();
    };

    void run().catch((e: Error) => {
      if (!alive || e.name === "AbortError") return;
      setError(e.message);
    });

    return () => {
      alive = false;
      ac.abort();
      stopPlayback();
      teardownMic();
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [applyCall, canListen, goListen, id, onUtterance, playBuyer, router]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [call?.transcript.length, interim]);

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
    setInterim("");
    stopPlayback();
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    roomRef.current?.disconnect();
    try {
      const res = await fetch(`/api/calls/${id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptRef.current }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        hungRef.current = false;
        setError(typeof json.error === "string" ? json.error : "Could not hang up.");
        setCallPhase("live");
        return;
      }
      router.replace(`/call/${id}/debrief`);
    } catch (err) {
      hungRef.current = false;
      setError(err instanceof Error ? err.message : "Could not hang up.");
      setCallPhase("live");
    }
  }, [id, router]);

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
    if (next) {
      setInterim("");
      setCallPhase("muted");
      micRef.current?.setEarpiece(true);
    } else if (mockRef.current && phaseRef.current !== "speaking" && phaseRef.current !== "thinking") {
      goListen();
    } else if (!mockRef.current) {
      setCallPhase("live");
    }
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
        <audio
          ref={(node) => attachPlayer(node)}
          className="phone__speaker"
          playsInline
          autoPlay={false}
        />
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
              : phase === "hanging"
                ? "Hanging up"
                : "Live";

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
        {call.transcript.length === 0 && !interim ? (
          <p className="phone__line phone__line--empty">Waiting for the first line…</p>
        ) : null}
        {call.transcript.map((t, i) => (
          <p key={`${t.at}-${i}`} className="phone__line" data-role={t.role}>
            <span className="phone__who">{t.role === "buyer" ? call.profile.name.split(" ")[0] : "You"}</span>
            {t.text}
          </p>
        ))}
        {interim ? (
          <p className="phone__line" data-role="seller" data-live="true">
            <span className="phone__who">You</span>
            {interim}
          </p>
        ) : null}
      </section>

      <footer className="phone__dock">
        <audio
          ref={(node) => attachPlayer(node)}
          className="phone__speaker"
          playsInline
          autoPlay={false}
        />
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
