import { mergePersonality, type TranscriptTurn } from "@osp/core";
import { getProfile } from "@osp/core/registry";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { db } from "@/lib/db";
import { mintRoomToken } from "@/lib/livekit";
import { parsePersonality } from "@/lib/personality";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { profileId?: string; personality?: unknown };
    if (!body.profileId) {
      return Response.json({ error: "profileId required" }, { status: 400 });
    }
    const profile = getProfile(body.profileId);
    const personality = mergePersonality(profile.personality, parsePersonality(body.personality));

    const id = crypto.randomUUID();
    const started_at = Date.now();
    const room_name = `osp-${id.slice(0, 8)}`;
    const transcript: TranscriptTurn[] = [];
    const metadata = JSON.stringify({
      callId: id,
      profileId: profile.id,
      personality,
      userId: user.id,
    });
    const livekit = await mintRoomToken({
      room: room_name,
      identity: `rep-${user.id.slice(0, 8)}`,
      metadata,
    });

    await db().execute({
      sql: `INSERT INTO calls (id, user_id, profile_id, personality_json, status, started_at, transcript_json, credits_spent, voice_mode, room_name)
            VALUES (?, ?, ?, ?, 'live', ?, '[]', 0, 'voice', ?)`,
      args: [id, user.id, profile.id, JSON.stringify(personality), started_at, room_name],
    });

    return Response.json({
      call: {
        id,
        profileId: profile.id,
        personality,
        startedAt: started_at,
        transcript,
        profile: {
          name: profile.name,
          title: profile.title,
          organization: profile.organization,
          repBrief: profile.repBrief,
          vernacular: profile.vernacular,
        },
      },
      livekit,
    });
  } catch (err) {
    return asError(err);
  }
}
