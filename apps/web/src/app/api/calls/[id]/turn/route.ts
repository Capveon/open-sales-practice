import { type Personality, type TranscriptTurn } from "@osp/core";
import { getProfile } from "@osp/core/registry";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { nextBuyerLine } from "@/lib/buyer";
import { db, type CallRow } from "@/lib/db";
import { serializeCall } from "@/lib/serialize-call";
import { similarUtterance } from "@/lib/text";
import { synthesizeBuyerSpeech, type SpokenLine } from "@/lib/tts";

export const runtime = "nodejs";

type TurnOk = {
  call: ReturnType<typeof serializeCall>;
  reply: string | null;
  audio: SpokenLine | null;
  voiceError: string | null;
};

const chain = new Map<string, Promise<unknown>>();
const bootstrapOnce = new Map<string, Promise<TurnOk>>();

function enqueue<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = chain.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  chain.set(
    id,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

async function loadLiveCall(id: string, userId: string) {
  const result = await db().execute({
    sql: "SELECT * FROM calls WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  const row = result.rows[0] as unknown as CallRow | undefined;
  if (!row) return null;
  if (row.status !== "live") return { row, over: true as const };
  return { row, over: false as const };
}

async function speakLine(
  row: CallRow,
  profile: ReturnType<typeof getProfile>,
  personality: Personality,
  turns: TranscriptTurn[],
  reply: string,
): Promise<TurnOk> {
  let audio: SpokenLine | null = null;
  let voiceError: string | null = null;
  try {
    audio = await synthesizeBuyerSpeech(profile, personality, reply, {
      previousText: turns
        .slice(-4)
        .map((t) => t.text)
        .join(" "),
    });
  } catch (err) {
    voiceError = err instanceof Error ? err.message : "Could not speak the line.";
  }
  return {
    call: serializeCall({ ...row, transcript_json: JSON.stringify(turns) }, profile),
    reply,
    audio,
    voiceError,
  };
}

async function runTurn(id: string, userId: string, body: { text?: string; bootstrap?: boolean }): Promise<TurnOk> {
  const loaded = await loadLiveCall(id, userId);
  if (!loaded) {
    const err = new Error("Not found") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  if (loaded.over) {
    const err = new Error("Call is over") as Error & { status: number };
    err.status = 409;
    throw err;
  }

  const row = loaded.row;
  const profile = getProfile(row.profile_id);
  const personality = JSON.parse(row.personality_json) as Personality;
  const turns = JSON.parse(row.transcript_json) as TranscriptTurn[];

  if (body.bootstrap) {
    const existing = turns.find((t) => t.role === "buyer");
    if (existing) {
      return speakLine(row, profile, personality, turns, existing.text);
    }
  } else {
    const text = body.text?.trim();
    if (!text) {
      const err = new Error("text required") as Error & { status: number };
      err.status = 400;
      throw err;
    }
    const lastBuyer = [...turns].reverse().find((t) => t.role === "buyer");
    if (lastBuyer && similarUtterance(text, lastBuyer.text)) {
      return {
        call: serializeCall(row, profile),
        reply: null,
        audio: null,
        voiceError: null,
      };
    }
    turns.push({ role: "seller", text, at: Date.now() });
  }

  const reply = await nextBuyerLine(profile, personality, turns);
  turns.push({ role: "buyer", text: reply, at: Date.now() });
  await db().execute({
    sql: "UPDATE calls SET transcript_json = ? WHERE id = ?",
    args: [JSON.stringify(turns), id],
  });
  return speakLine(row, profile, personality, turns, reply);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as { text?: string; bootstrap?: boolean };

    if (body.bootstrap) {
      let job = bootstrapOnce.get(id);
      if (!job) {
        job = enqueue(id, () => runTurn(id, user.id, body));
        bootstrapOnce.set(id, job);
        void job.finally(() => {
          setTimeout(() => bootstrapOnce.delete(id), 1500);
        });
      }
      const payload = await job;
      return Response.json(payload);
    }

    const payload = await enqueue(id, () => runTurn(id, user.id, body));
    return Response.json(payload);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404 || status === 409 || status === 400) {
      return Response.json({ error: (err as Error).message }, { status });
    }
    return asError(err);
  }
}
