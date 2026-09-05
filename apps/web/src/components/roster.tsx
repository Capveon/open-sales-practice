"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PERSONALITY_FIELDS } from "@/lib/personality";
import type { Personality } from "@osp/core";

type ProfileCard = {
  id: string;
  name: string;
  title: string;
  organization: string;
  summary: string;
  repBrief: string;
  opening: string;
  personality: Personality;
  vernacular: string[];
};

type Pack = {
  id: string;
  label: string;
  description: string;
  profiles: ProfileCard[];
};

export function Roster() {
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProfileCard | null>(null);
  const [personality, setPersonality] = useState<Personality | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch("/api/profiles")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load");
        setPacks(json.packs);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const open = (p: ProfileCard) => {
    setSelected(p);
    setPersonality({ ...p.personality });
  };

  const start = async () => {
    if (!selected || !personality) return;
    setStarting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setStarting(false);
      setError("Microphone permission is required to take the call.");
      return;
    }
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: selected.id, personality }),
    });
    const json = await res.json();
    setStarting(false);
    if (!res.ok) {
      setError(json.error ?? "Could not start call");
      return;
    }
    sessionStorage.setItem(`osp:livekit:${json.call.id}`, JSON.stringify(json.livekit));
    router.push(`/call/${json.call.id}`);
  };

  const preset = useMemo(
    () =>
      [
        { id: "easy", label: "Easy", patch: { hostility: 0.05, skepticism: 0.3, patience: 0.8, timePressure: 0.25 } },
        { id: "typical", label: "Typical", patch: {} },
        { id: "hard", label: "Hard-ass", patch: { hostility: 0.75, skepticism: 0.85, patience: 0.2, timePressure: 0.8, warmth: 0.2 } },
      ] as const,
    [],
  );

  if (error && packs.length === 0) {
    return (
      <main className="page">
        <p className="t-copy">{error}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="t-eyebrow">Roster</p>
          <h1 className="t-page-title">Practice a live call</h1>
          <p className="lede">
            Pick a buyer. Tweak how hard they are. Same job every time: earn a next step without
            pitching a product.
          </p>
        </div>
      </div>
      {error ? <p className="t-meta" style={{ color: "var(--risk)", marginBottom: 16 }}>{error}</p> : null}

      {packs.map((pack) => (
        <section key={pack.id} className="pack">
          <div className="pack-head">
            <h2 className="t-subsection">{pack.label}</h2>
            <p className="t-meta">{pack.description}</p>
          </div>
          {pack.profiles.length === 0 ? (
            <p className="empty-pack t-copy">
              Empty pack. Add a YAML file under <span className="t-mono">profiles/packs/{pack.id}/</span>
            </p>
          ) : (
            <div className="grid">
              {pack.profiles.map((p) => (
                <button key={p.id} type="button" className="card" onClick={() => open(p)}>
                  <span className="t-eyebrow">{p.opening}</span>
                  <strong className="t-subsection">{p.name}</strong>
                  <span className="org">
                    {p.title} · {p.organization}
                  </span>
                  <span className="summary t-copy">{p.summary}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ))}

      {selected && personality ? (
        <div className="drawer-scrim" onClick={() => setSelected(null)} role="presentation">
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <p className="t-eyebrow">{selected.opening}</p>
            <h2 className="t-section">{selected.name}</h2>
            <p className="t-meta">
              {selected.title} · {selected.organization}
            </p>
            <p className="brief">{selected.repBrief}</p>
            <div className="chips">
              {selected.vernacular.slice(0, 8).map((v) => (
                <span key={v} className="chip">
                  {v}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {preset.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setPersonality({ ...selected.personality, ...p.patch })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {PERSONALITY_FIELDS.map((f) => (
              <label key={f.key} className="slider-row">
                <span>{f.label}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={personality[f.key]}
                  onChange={(e) =>
                    setPersonality({ ...personality, [f.key]: Number(e.target.value) })
                  }
                  aria-label={f.hint}
                />
                <span className="val">{personality[f.key].toFixed(2)}</span>
              </label>
            ))}
            <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-quiet" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={start} disabled={starting}>
                {starting ? "Dialing…" : "Start call"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
