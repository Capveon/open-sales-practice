"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Range = "today" | "3d" | "7d" | "14d" | "30d" | "all";
type Sort = "elo" | "avg" | "calls" | "best" | "recent";

type Row = {
  rank: number;
  name: string;
  calls: number;
  elo: number;
  avgScore: number | null;
  bestScore: number | null;
  lastAt: number;
  lastBuyer: string | null;
};

type Tape = {
  id: string;
  rep: string;
  buyer: string;
  pack: string;
  score: number;
  buyerElo?: number;
  at: number;
};

type Filters = {
  packs: { id: string; label: string }[];
  profiles: { id: string; name: string; pack: string }[];
};

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "3d", label: "3 days" },
  { id: "7d", label: "7 days" },
  { id: "14d", label: "14 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "elo", label: "Elo" },
  { id: "avg", label: "Avg score" },
  { id: "calls", label: "Calls" },
  { id: "best", label: "Best" },
  { id: "recent", label: "Recent" },
];

function relTime(at: number) {
  if (!at) return "—";
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function Leaderboard() {
  const [range, setRange] = useState<Range>("7d");
  const [sort, setSort] = useState<Sort>("elo");
  const [minCalls, setMinCalls] = useState(1);
  const [pack, setPack] = useState("");
  const [profile, setProfile] = useState("");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [tapes, setTapes] = useState<Tape[]>([]);
  const [filters, setFilters] = useState<Filters>({ packs: [], profiles: [] });

  useEffect(() => {
    const t = setTimeout(() => setQ(qDraft.trim()), 200);
    return () => clearTimeout(t);
  }, [qDraft]);

  const load = useCallback(() => {
    const params = new URLSearchParams({
      range,
      sort,
      minCalls: String(minCalls),
    });
    if (pack) params.set("pack", pack);
    if (profile) params.set("profile", profile);
    if (q) params.set("q", q);
    fetch(`/api/leaderboard?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setRows(json.rows ?? []);
        setTapes(json.tapes ?? []);
        if (json.filters) setFilters(json.filters);
      });
  }, [range, sort, minCalls, pack, profile, q]);

  useEffect(() => {
    load();
  }, [load]);

  const buyers = useMemo(
    () => (pack ? filters.profiles.filter((p) => p.pack === pack) : filters.profiles),
    [filters.profiles, pack],
  );

  const headerBtn = (id: Sort, label: string) => (
    <button
      type="button"
      className="board-th"
      data-on={sort === id}
      onClick={() => setSort(id)}
    >
      {label}
    </button>
  );

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="t-eyebrow">Standings</p>
          <h1 className="t-page-title">Leaderboard</h1>
          <p className="lede">
            Rated like a chess ladder. Each buyer is a bot with a fixed Elo from how hard they are.
            A good tape against a hard-ass moves you more than the same tape against an easy one —
            and one lucky call cannot sit on top of the board.
          </p>
        </div>
      </div>

      <div className="board-bar">
        <div className="board-seg" role="group" aria-label="Time window">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={range === r.id ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="board-seg" role="group" aria-label="Sort">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={sort === s.id ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="board-fields">
          <label className="board-field">
            <span className="t-eyebrow">Motion</span>
            <select
              value={pack}
              onChange={(e) => {
                setPack(e.target.value);
                setProfile("");
              }}
            >
              <option value="">All packs</option>
              {filters.packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="board-field">
            <span className="t-eyebrow">Buyer</span>
            <select value={profile} onChange={(e) => setProfile(e.target.value)}>
              <option value="">All buyers</option>
              {buyers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="board-field">
            <span className="t-eyebrow">Min calls</span>
            <select value={minCalls} onChange={(e) => setMinCalls(Number(e.target.value))}>
              <option value={1}>1+</option>
              <option value={3}>3+</option>
              <option value={5}>5+</option>
              <option value={10}>10+</option>
            </select>
          </label>
          <label className="board-field board-field--grow">
            <span className="t-eyebrow">Rep</span>
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search names"
              aria-label="Search reps"
            />
          </label>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Rep</th>
            <th>{headerBtn("elo", "Elo")}</th>
            <th>{headerBtn("calls", "Calls")}</th>
            <th>{headerBtn("avg", "Avg")}</th>
            <th>{headerBtn("best", "Best")}</th>
            <th>Last buyer</th>
            <th>{headerBtn("recent", "Last call")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="t-meta">
                No scored calls in this window.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={`${r.rank}-${r.name}`}>
                <td className="num">{r.rank}</td>
                <td>{r.name}</td>
                <td className="num">{r.elo}</td>
                <td className="num">{r.calls}</td>
                <td className="num">{r.avgScore ?? "—"}</td>
                <td className="num">{r.bestScore ?? "—"}</td>
                <td>{r.lastBuyer ?? "—"}</td>
                <td className="t-meta">{relTime(r.lastAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <section className="pack" style={{ marginTop: 56 }}>
        <div className="pack-head">
          <h2 className="t-subsection">Recent tapes</h2>
          <p className="t-meta">Click a tape for transcript, recording, and score.</p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Rep</th>
              <th>Buyer</th>
              <th>Motion</th>
              <th>Bot Elo</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {tapes.length === 0 ? (
              <tr>
                <td colSpan={6} className="t-meta">
                  No tapes yet.
                </td>
              </tr>
            ) : (
              tapes.map((t) => (
                <tr key={t.id}>
                  <td className="t-meta">{relTime(t.at)}</td>
                  <td>{t.rep}</td>
                  <td>
                    <Link href={`/call/${t.id}/debrief`}>{t.buyer}</Link>
                  </td>
                  <td className="t-meta">{t.pack || "—"}</td>
                  <td className="num">{t.buyerElo ?? "—"}</td>
                  <td className="num">
                    <Link href={`/call/${t.id}/debrief`}>{t.score}</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
