import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { hangupCall, scoreEndedCall, serializeOwnedCall } from "@/lib/finish-call";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await hangupCall(id, user.id);
    const row = await scoreEndedCall(id, user.id);
    return Response.json({ call: serializeOwnedCall(row) });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return Response.json({ error: "Not found" }, { status: 404 });
    return asError(err);
  }
}
