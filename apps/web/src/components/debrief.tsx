"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CallScore, TranscriptTurn } from "@osp/core";
import { readJson } from "@/lib/http";

type Payload = {
  id: string;
  status: string;
  overall: number | null;
  score: CallScore | null;
  transcript: TranscriptTurn[];
  profile: { name: string; title: string };
};

type Clip = {
  id: string;
  seq: number;
  role: string;
  mime: string;
  at: number;
  url: string;
};

export function Debrief({ id }: { id: string }) {
  const [call, setCall] = useState<Payload | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [mine, setMine] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(true);
  const [scoreError, setScoreError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let attempts = 0;

    const loadClips = async () => {
      const clipRes = await fetch(`/api/calls/${id}/clips`);
      if (!clipRes.ok) return;
      const clipJson = await readJson<{ clips?: Clip[] }>(clipRes);
      if (alive) setClips(clipJson.clips ?? []);
    };

    const load = async () => {
      const loaded = await fetch(`/api/calls/${id}`);
      const json = await readJson<{
        error?: string;
        call?: Payload;
        mine?: boolean;
      }>(loaded);
      if (!loaded.ok) throw new Error(json.error ?? "Missing");
      if (!alive) return;
      setCall(json.call);
      setMine(json.mine !== false);
      void loadClips();
      if (json.call?.score) {
        setScoring(false);
        setScoreError(null);
        return;
      }
      if (json.mine === false) {
        setScoring(false);
        return;
      }
      setScoring(true);
      const scored = await fetch(`/api/calls/${id}/score`, { method: "POST" });
      const scoredJson = await readJson<{ call?: Payload }>(scored).catch(() => ({} as { call?: Payload }));
      if (!alive) return;
      if (scored.ok && scoredJson.call) {
        setCall(scoredJson.call);
        setScoring(false);
        setScoreError(null);
        return;
      }
      attempts += 1;
      if (attempts < 8) {
        window.setTimeout(() => {
          void load().catch((e: Error) => {
            if (alive) setScoreError(e.message);
          });
        }, 1000);
        return;
      }
      setScoring(false);
      setScoreError(
        typeof scoredJson.error === "string" ? scoredJson.error : "Could not score the tape.",
      );
    };

    void load().catch((e: Error) => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const byRole = useMemo(() => {
    const buyer = clips.filter((c) => c.role === "buyer");
    const seller = clips.filter((c) => c.role === "seller");
    return { buyer, seller };
  }, [clips]);

  if (error) return <main className="page"><p>{error}</p></main>;
  if (!call) {
    return (
      <main className="page">
        <p className="t-eyebrow">Debrief</p>
        <h1 className="t-page-title">Call ended</h1>
        <p className="t-meta">Pulling the tape.</p>
      </main>
    );
  }

  const score = call.score;
  let buyerI = 0;
  let sellerI = 0;

  return (
    <main className="page">
      <p className="t-eyebrow">Debrief · {call.profile.name}</p>
      <div className="score-hero">
        <div className="score-num">{scoring && !score ? "—" : (call.overall ?? "—")}</div>
        <div>
          <h1 className="t-page-title">
            {scoring && !score ? "Scoring the tape" : (score?.outcome ?? "No score")}
          </h1>
          <p className="t-meta">
            {scoring && !score
              ? "Grade lands in a few seconds."
              : scoreError
                ? scoreError
                : score?.eloAfter != null
                  ? `${score.eloDelta != null && score.eloDelta > 0 ? "+" : ""}${score.eloDelta ?? 0} Elo · now ${score.eloAfter} vs ${score.buyerElo} bot`
                  : score?.method === "llm"
                  ? "Model grade"
                  : score
                    ? "Heuristic grade"
                    : mine
                      ? "Not scored"
                      : "Waiting on a score"}
          </p>
        </div>
      </div>
      {score?.dimensions.map((d) => (
        <div key={d.id} className="dim">
          <span className="t-label">{d.label}</span>
          <div className="bar" aria-hidden>
            <span style={{ width: `${d.score * 10}%` }} />
          </div>
          <span className="num t-meta">{d.score.toFixed(1)}</span>
        </div>
      ))}
      {score?.coaching?.length ? (
        <div className="coaching">
          <p className="t-eyebrow">Do next time</p>
          <ul>
            {score.coaching.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {score.betterLine ? <p className="brief" style={{ marginTop: 12 }}>{score.betterLine}</p> : null}
        </div>
      ) : null}
      <div className="coaching">
        <p className="t-eyebrow">Tape</p>
        <div className="transcript">
          {call.transcript.length === 0 ? (
            <p className="t-meta">No lines captured.</p>
          ) : (
            call.transcript.map((t, i) => {
              if (t.role === "status") {
                return (
                  <p key={`${t.at}-${i}`} className="tape-status">
                    {t.text}
                  </p>
                );
              }
              const clip =
                t.role === "buyer" ? byRole.buyer[buyerI++] : byRole.seller[sellerI++];
              return (
                <div key={`${t.at}-${i}`} className="bubble" data-role={t.role}>
                  <p className="bubble__who">{t.role === "buyer" ? call.profile.name.split(" ")[0] : "You"}</p>
                  <p style={{ margin: 0 }}>{t.text}</p>
                  {clip ? (
                    <audio className="tape-audio" controls preload="none" src={clip.url}>
                      <track kind="captions" />
                    </audio>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
        <Link href="/" className="btn btn-primary">
          Next call
        </Link>
        <Link href="/leaderboard" className="btn btn-secondary">
          Leaderboard
        </Link>
      </div>
    </main>
  );
}
