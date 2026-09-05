import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; clipId: string }> }) {
  try {
    const user = await requireUser();
    const { id, clipId } = await ctx.params;
    const call = await db().execute({
      sql: "SELECT user_id, status FROM calls WHERE id = ?",
      args: [id],
    });
    const row = call.rows[0] as { user_id?: string; status?: string } | undefined;
    if (!row) return new Response("Not found", { status: 404 });
    if (row.user_id !== user.id && row.status === "live") return new Response("Not found", { status: 404 });

    const clip = await db().execute({
      sql: "SELECT mime, bytes FROM call_clips WHERE id = ? AND call_id = ?",
      args: [clipId, id],
    });
    const file = clip.rows[0] as { mime?: string; bytes?: unknown } | undefined;
    if (!file) return new Response("Not found", { status: 404 });
    const raw = file.bytes;
    const bytes =
      raw instanceof Uint8Array
        ? raw
        : Buffer.isBuffer(raw)
          ? raw
          : typeof raw === "string"
            ? Buffer.from(raw, "base64")
            : raw instanceof ArrayBuffer
              ? Buffer.from(raw)
              : null;
    if (!bytes) return new Response("Empty clip", { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": String(file.mime || "audio/mpeg"),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return asError(err);
  }
}
