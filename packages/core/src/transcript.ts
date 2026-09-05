import { type TranscriptTurn } from "./schema";

export type TapeLine = TranscriptTurn & {
  segmentId?: string;
  live?: boolean;
};

function turnKey(turn: TranscriptTurn): string {
  return `${turn.role}:${turn.text.trim().toLowerCase()}`;
}

export function parseTranscriptJson(raw: string | null | undefined): TranscriptTurn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TranscriptTurn => {
      if (!item || typeof item !== "object") return false;
      const row = item as TranscriptTurn;
      return (row.role === "seller" || row.role === "buyer") && typeof row.text === "string";
    });
  } catch {
    return [];
  }
}

/** LiveKit jsonFormat chunks, or a plain caption. */
export function parseTranscriptionText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
  try {
    const parts: string[] = [];
    for (const line of trimmed.split("\n")) {
      const chunk = line.trim();
      if (!chunk) continue;
      const parsed = JSON.parse(chunk) as unknown;
      if (typeof parsed === "string") {
        parts.push(parsed);
        continue;
      }
      if (parsed && typeof parsed === "object" && "text" in parsed) {
        const text = (parsed as { text?: unknown }).text;
        if (typeof text === "string") parts.push(text);
      }
    }
    return parts.join("").trim() || trimmed;
  } catch {
    return trimmed;
  }
}

export function upsertSegment(turns: TapeLine[], next: TapeLine): TapeLine[] {
  const text = next.text.trim();
  if (!text) return turns;
  const incoming = { ...next, text };
  if (incoming.segmentId) {
    const index = turns.findIndex((turn) => turn.segmentId === incoming.segmentId);
    if (index >= 0) {
      const copy = turns.slice();
      const prev = copy[index]!;
      copy[index] = {
        ...prev,
        ...incoming,
        at: prev.at || incoming.at,
        live: incoming.live ?? false,
        text: incoming.text,
      };
      return copy;
    }
  }
  const last = turns[turns.length - 1];
  if (last && last.role === incoming.role && last.text === incoming.text) {
    if (incoming.segmentId && !last.segmentId) {
      const copy = turns.slice();
      copy[copy.length - 1] = { ...last, segmentId: incoming.segmentId, live: incoming.live };
      return copy;
    }
    return turns;
  }
  return [...turns, incoming];
}

export function commitLiveLines(turns: TapeLine[]): TranscriptTurn[] {
  return turns
    .map((turn) => ({ role: turn.role, text: turn.text.trim(), at: turn.at }))
    .filter((turn) => turn.text);
}

export function mergeTranscripts(...lists: TranscriptTurn[][]): TranscriptTurn[] {
  const combined = lists.flat().filter((turn) => turn.text.trim());
  combined.sort((a, b) => a.at - b.at);
  const out: TranscriptTurn[] = [];
  const seen = new Set<string>();
  for (const turn of combined) {
    const key = turnKey(turn);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ role: turn.role, text: turn.text.trim(), at: turn.at });
  }
  return out;
}
