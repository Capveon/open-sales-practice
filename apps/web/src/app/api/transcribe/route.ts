import { asError, HttpError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new HttpError("Set OPENAI_API_KEY to transcribe the call.", 503);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size < 400) {
      return Response.json({ text: "" });
    }
    const filename =
      (file instanceof File && file.name) ||
      (file.type.includes("mp4") ? "utterance.m4a" : "utterance.webm");

    const body = new FormData();
    body.append("file", file, filename);
    body.append("model", process.env.OPENAI_STT_MODEL?.trim() || "whisper-1");
    body.append(
      "prompt",
      "Phone call. North American municipal utilities. Terms: CIP, PACP, Cityworks, feeder, SAIDI, Maximo, OMS, basin, work order.",
    );
    body.append("language", "en");

    let res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body,
    });
    if (!res.ok) {
      const retry = new FormData();
      retry.append("file", file, filename);
      retry.append("model", "whisper-1");
      retry.append("language", "en");
      res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: retry,
      });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new HttpError(`Transcribe failed (${res.status}). ${detail.slice(0, 160)}`, 502);
    }
    const json = (await res.json()) as { text?: string };
    return Response.json({ text: (json.text ?? "").trim() });
  } catch (err) {
    return asError(err);
  }
}
