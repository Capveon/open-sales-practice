import type { Personality, Profile, TranscriptTurn } from "@osp/core";
import type { CallRow } from "./db";

export function serializeCall(row: CallRow, profile: Profile) {
  return {
    id: row.id,
    profileId: row.profile_id,
    personality: JSON.parse(row.personality_json) as Personality,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    transcript: JSON.parse(row.transcript_json) as TranscriptTurn[],
    score: row.score_json ? JSON.parse(row.score_json) : null,
    overall: row.overall,
    profile: {
      name: profile.name,
      title: profile.title,
      organization: profile.organization,
      repBrief: profile.repBrief,
      vernacular: profile.vernacular,
    },
  };
}
