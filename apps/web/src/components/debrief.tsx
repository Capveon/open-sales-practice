"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CallScore, TranscriptTurn } from "@osp/core";

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

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const loaded = await fetch(`/api/calls/${id}`);
      const json = await loaded.json();
      if (!loaded.ok) throw new Error(json.error ?? "Missing");
      if (!alive) return;
      setCall(json.call);
      setMine(json.mine !== false);
      const clipRes = await fetch(`/api/calls/${id}/clips`);
      if (clipRes.ok) {
        const clipJson = await clipRes.json();
        if (alive) setClips(clipJson.clips ?? []);
      }
      if (json.call?.score) {
        setScoring(false);
        return;
      }
      if (json.mine === false) {
        setScoring(false);
        return;
      }
      setScoring(true);
      const scored = await fetch(`/api/calls/${id}/score`, { method: "POST" });
      const scoredJson = await scored.json();
      if (!alive) return;
      if (!scored.ok) throw new Error(scoredJson.error ?? "Could not score the tape.");
      setCall(scoredJson.call);
      setScoring(false);
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
        <div className="transcript" style={{ maxHeight: 480 }}>
          {call.transcript.length === 0 ? (
            <p className="t-meta">No lines captured.</p>
          ) : (
            call.transcript.map((t, i) => {
              const clip =
                t.role === "buyer" ? byRole.buyer[buyerI++] : byRole.seller[sellerI++];
              return (
                <div key={`${t.at}-${i}`} className="bubble" data-role={t.role}>
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
