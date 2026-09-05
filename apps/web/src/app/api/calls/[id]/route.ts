import { loadGlobalSettings, type Profile } from "@osp/core";
import { getProfile } from "@osp/core/registry";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { db, type CallRow } from "@/lib/db";
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
    return Response.json({
      call: serializeCall(row, profileFor(row.profile_id)),
      mine,
      callMaxSeconds: loadGlobalSettings().callMaxSeconds,
    });
  } catch (err) {
    return asError(err);
  }
}
