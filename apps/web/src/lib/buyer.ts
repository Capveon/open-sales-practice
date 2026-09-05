import {
  buildBuyerInstructions,
  type Personality,
  type Profile,
  type TranscriptTurn,
} from "@osp/core";
import { HttpError } from "./api";

export async function nextBuyerLine(
  profile: Profile,
  personality: Personality,
  turns: TranscriptTurn[],
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new HttpError(
      "Set OPENAI_API_KEY. Buyers are live — they are not a script of canned lines.",
      503,
    );
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildBuyerInstructions(profile, personality) },
  ];
  if (turns.length === 0) {
    messages.push({
      role: "user",
      content:
        "(The phone just connected. They have not spoken yet, or just said hello. Say only the first thing you would say out loud. One or two short sentences. Do not use a stock opener.)",
    });
  } else {
    for (const turn of turns) {
      messages.push({
        role: turn.role === "seller" ? "user" : "assistant",
        content: turn.text,
      });
    }
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_BUYER_MODEL ?? process.env.OPENAI_SCORE_MODEL ?? "gpt-4.1-mini",
      temperature: 0.85,
      max_tokens: 140,
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(
      `Buyer model failed (${res.status}). ${detail.slice(0, 180) || "Check OPENAI_API_KEY."}`,
      502,
    );
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new HttpError("Buyer model returned an empty line.", 502);
  return text.replace(/^["“]|["”]$/g, "");
}
