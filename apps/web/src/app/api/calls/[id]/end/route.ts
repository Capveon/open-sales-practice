import { after } from "next/server";
import { type TranscriptTurn } from "@osp/core";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { hangupCall, scoreEndedCall, serializeOwnedCall } from "@/lib/finish-call";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { transcript?: TranscriptTurn[] };
    const row = await hangupCall(id, user.id, body.transcript);
    after(() => {
      void scoreEndedCall(id, user.id);
    });
    return Response.json({ call: serializeOwnedCall(row) });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return Response.json({ error: "Not found" }, { status: 404 });
    return asError(err);
  }
}
