import { requireUser } from "@/lib/auth";
import { asError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function bytesFromBase64(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const owned = await db().execute({
      sql: "SELECT id, status FROM calls WHERE id = ? AND user_id = ?",
      args: [id, user.id],
    });
    const row = owned.rows[0] as { status?: string } | undefined;
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    if (row.status !== "live" && row.status !== "ended") {
      throw new HttpError("Call is closed.", 409);
    }

    const body = (await req.json()) as { role?: string; mime?: string; base64?: string; at?: number; seq?: number };
    if (body.role !== "buyer" && body.role !== "seller") {
      throw new HttpError("role must be buyer or seller", 400);
    }
    if (!body.base64 || body.base64.length < 80) {
      return Response.json({ ok: true, skipped: true });
    }
    const mime = (body.mime || "audio/mpeg").slice(0, 80);
    const clipId = crypto.randomUUID();
    const seq = Number.isFinite(body.seq) ? Number(body.seq) : Date.now();
    const at = Number.isFinite(body.at) ? Number(body.at) : Date.now();
    const bytes = bytesFromBase64(body.base64.replace(/^data:[^,]+,/, ""));
    await db().execute({
      sql: `INSERT INTO call_clips (id, call_id, seq, role, mime, at, bytes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [clipId, id, seq, body.role, mime, at, bytes],
    });
    return Response.json({ id: clipId });
  } catch (err) {
    return asError(err);
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const call = await db().execute({
      sql: "SELECT id, user_id, status FROM calls WHERE id = ?",
      args: [id],
    });
    const row = call.rows[0] as { user_id?: string; status?: string } | undefined;
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    const owner = row.user_id === user.id;
    if (!owner && row.status === "live") return Response.json({ error: "Not found" }, { status: 404 });

    const clips = await db().execute({
      sql: "SELECT id, call_id, seq, role, mime, at FROM call_clips WHERE call_id = ? ORDER BY seq ASC, at ASC",
      args: [id],
    });
    return Response.json({
      clips: clips.rows.map((c) => ({
        id: String(c.id),
        seq: Number(c.seq),
        role: String(c.role),
        mime: String(c.mime),
        at: Number(c.at),
        url: `/api/calls/${id}/clips/${c.id}`,
      })),
    });
  } catch (err) {
    return asError(err);
  }
}
