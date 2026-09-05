import { loadGlobalSettings, type Profile, type TranscriptTurn } from "@osp/core";
import { getProfile } from "@osp/core/registry";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { db, type CallRow } from "@/lib/db";
import { livekitConfigured, mintRoomToken } from "@/lib/livekit";
import { serializeCall } from "@/lib/serialize-call";

function profileFor(id: string): Profile {
  try {
    return getProfile(id);
  } catch {
    return {
      id,
      pack: "unknown",
      name: id,
      title: "",
      organization: "",
      summary: "",
      repBrief: "",
      cast: { gender: "male", age: "mid", region: "general" },
      opening: "engaged",
      personality: {
        warmth: 0.45,
        patience: 0.5,
        skepticism: 0.55,
        verbosity: 0.4,
        hostility: 0.15,
        timePressure: 0.45,
      },
      attributes: {},
      vernacular: [],
      bannedSellerPhrases: [],
      facts: [],
      hangupRules: [],
      scoring: { rubric: [] },
    };
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const result = await db().execute({
      sql: "SELECT * FROM calls WHERE id = ?",
      args: [id],
    });
    const row = result.rows[0] as unknown as CallRow | undefined;
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    const mine = row.user_id === user.id;
    if (row.status === "live" && !mine) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    let livekit: { url: string; token: string } | null = null;
    if (mine && row.status === "live" && row.voice_mode === "voice" && livekitConfigured() && row.room_name) {
      livekit = await mintRoomToken({
        room: row.room_name,
        identity: `rep-${user.id.slice(0, 8)}`,
        metadata: JSON.stringify({
          callId: row.id,
          profileId: row.profile_id,
          personality: JSON.parse(row.personality_json),
          userId: user.id,
        }),
      });
    }

    return Response.json({
      call: serializeCall(row, profileFor(row.profile_id)),
      mine,
      callMaxSeconds: loadGlobalSettings().callMaxSeconds,
      livekit,
    });
  } catch (err) {
    return asError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as { transcript?: TranscriptTurn[] };
    if (!Array.isArray(body.transcript)) {
      return Response.json({ error: "transcript required" }, { status: 400 });
    }
    const result = await db().execute({
      sql: "SELECT user_id, status FROM calls WHERE id = ?",
      args: [id],
    });
    const row = result.rows[0] as { user_id: string; status: string } | undefined;
    if (!row || row.user_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });
    if (row.status !== "live") return Response.json({ error: "Call is not live" }, { status: 409 });
    await db().execute({
      sql: "UPDATE calls SET transcript_json = ? WHERE id = ? AND status = 'live'",
      args: [JSON.stringify(body.transcript), id],
    });
    return Response.json({ ok: true });
  } catch (err) {
    return asError(err);
  }
}
