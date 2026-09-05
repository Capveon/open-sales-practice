import { type Personality, type TranscriptTurn } from "@osp/core";
import { getProfile } from "@osp/core/registry";
import { db, type CallRow } from "@/lib/db";
import { scoreCall } from "@/lib/score";
import { serializeCall } from "@/lib/serialize-call";

const scoreJobs = new Map<string, Promise<CallRow>>();

async function loadOwnedCall(id: string, userId: string) {
  const result = await db().execute({
    sql: "SELECT * FROM calls WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return (result.rows[0] as unknown as CallRow | undefined) ?? null;
}

export async function hangupCall(
  id: string,
  userId: string,
  transcript?: TranscriptTurn[],
): Promise<CallRow> {
  const row = await loadOwnedCall(id, userId);
  if (!row) {
    const err = new Error("Not found") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  if (row.status === "scored") return row;

  const turns = Array.isArray(transcript) ? transcript : (JSON.parse(row.transcript_json) as TranscriptTurn[]);
  const ended_at = row.ended_at ?? Date.now();
  await db().execute({
    sql: `UPDATE calls
          SET status = CASE WHEN status = 'scored' THEN status ELSE 'ended' END,
              ended_at = ?,
              transcript_json = ?
          WHERE id = ? AND status != 'scored'`,
    args: [ended_at, JSON.stringify(turns), id],
  });
  return {
    ...row,
    status: "ended",
    ended_at,
    transcript_json: JSON.stringify(turns),
  };
}

async function runScore(id: string, userId: string): Promise<CallRow> {
  const row = await loadOwnedCall(id, userId);
  if (!row) {
    const err = new Error("Not found") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  if (row.status === "scored" && row.score_json) return row;

  const profile = getProfile(row.profile_id);
  const personality = JSON.parse(row.personality_json) as Personality;
  const turns = JSON.parse(row.transcript_json) as TranscriptTurn[];
  const score = await scoreCall(profile, turns, personality);
  const ended_at = row.ended_at ?? Date.now();

  await db().execute({
    sql: `UPDATE calls
          SET status = 'scored', ended_at = ?, score_json = ?, overall = ?
          WHERE id = ?`,
    args: [ended_at, JSON.stringify(score), score.overall, id],
  });

  return {
    ...row,
    status: "scored",
    ended_at,
    score_json: JSON.stringify(score),
    overall: score.overall,
  };
}

export function scoreEndedCall(id: string, userId: string): Promise<CallRow> {
  let job = scoreJobs.get(id);
  if (!job) {
    job = runScore(id, userId).finally(() => {
      scoreJobs.delete(id);
    });
    scoreJobs.set(id, job);
  }
  return job;
}

export function serializeOwnedCall(row: CallRow) {
  return serializeCall(row, getProfile(row.profile_id));
}
