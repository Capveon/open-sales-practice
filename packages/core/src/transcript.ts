import { type TranscriptTurn } from "./schema";

export type TapeLine = TranscriptTurn & {
  segmentId?: string;
  live?: boolean;
};

export function speechKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function turnKey(turn: TranscriptTurn): string {
  return `${turn.role}:${speechKey(turn.text) || turn.text.trim().toLowerCase()}`;
}

function isPrefixGrowth(prev: string, next: string): boolean {
  const a = speechKey(prev);
  const b = speechKey(next);
  if (!a || !b) return false;
  if (a === b) return true;
  return (
    b.startsWith(`${a} `) ||
    a.startsWith(`${b} `) ||
    b.startsWith(a) ||
    a.startsWith(b) ||
    a.endsWith(` ${b}`) ||
    b.endsWith(` ${a}`)
  );
}

function preferText(prev: string, next: string): string {
  return speechKey(next).length >= speechKey(prev).length ? next : prev;
}

export function parseTranscriptJson(raw: string | null | undefined): TranscriptTurn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TranscriptTurn => {
      if (!item || typeof item !== "object") return false;
      const row = item as TranscriptTurn;
      return (row.role === "seller" || row.role === "buyer" || row.role === "status") && typeof row.text === "string";
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

function replaceAt(turns: TapeLine[], index: number, incoming: TapeLine, text: string): TapeLine[] {
  const prev = turns[index]!;
  const copy = turns.slice();
  copy[index] = {
    ...prev,
    ...incoming,
    text,
    at: prev.at || incoming.at,
    segmentId: incoming.segmentId || prev.segmentId,
    live: incoming.live ?? false,
  };
  return copy;
}

export function upsertSegment(turns: TapeLine[], next: TapeLine): TapeLine[] {
  const text = next.text.trim();
  if (!text) return turns;
  const incoming = { ...next, text };

  if (incoming.segmentId) {
    const index = turns.findIndex((turn) => turn.segmentId === incoming.segmentId);
    if (index >= 0) return replaceAt(turns, index, incoming, incoming.text);
  }

  if (incoming.role !== "status") {
    let start = turns.length;
    while (start > 0 && turns[start - 1]?.role === incoming.role) start -= 1;
    if (start < turns.length) {
      const run = turns.slice(start);
      const joined = run.map((turn) => turn.text).join(" ");
      const joinedKey = speechKey(joined);
      const nextKey = speechKey(incoming.text);
      const last = run[run.length - 1]!;
      const related =
        !!joinedKey &&
        !!nextKey &&
        (nextKey === joinedKey ||
          nextKey.startsWith(`${joinedKey} `) ||
          joinedKey.startsWith(`${nextKey} `) ||
          isPrefixGrowth(last.text, incoming.text) ||
          isPrefixGrowth(joined, incoming.text));
      if (related) {
        const chosen = nextKey.length >= joinedKey.length ? incoming.text : preferText(joined, incoming.text);
        return [
          ...turns.slice(0, start),
          {
            ...incoming,
            text: chosen,
            at: run[0]!.at,
            segmentId: incoming.segmentId || run[0]?.segmentId,
            live: incoming.live ?? false,
          },
        ];
      }
    }
  }

  const last = turns[turns.length - 1];
  if (last && last.role === incoming.role && last.text === incoming.text) return turns;
  return [...turns, incoming];
}

export function commitLiveLines(turns: TapeLine[]): TranscriptTurn[] {
  return turns
    .map((turn) => ({ role: turn.role, text: turn.text.trim(), at: turn.at }))
    .filter((turn) => turn.text);
}

export function mergeTranscripts(...lists: TranscriptTurn[][]): TranscriptTurn[] {
  const combined = lists.flat().filter((turn) => turn.text.trim());
  combined.sort((a, b) => a.at - b.at || a.text.length - b.text.length);
  let out: TapeLine[] = [];
  const seen = new Set<string>();
  for (const turn of combined) {
    const key = turnKey(turn);
    if (seen.has(key)) continue;
    seen.add(key);
    out = upsertSegment(out, { ...turn, text: turn.text.trim() });
  }
  return commitLiveLines(out);
}
