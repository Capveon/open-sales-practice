import {
  CallScoreSchema,
  SCORE_MODEL,
  heuristicScore,
  scoringPrompt,
  type CallScore,
  type Personality,
  type Profile,
  type TranscriptTurn,
} from "@osp/core";

export async function scoreCall(
  profile: Profile,
  turns: TranscriptTurn[],
  personality: Personality,
): Promise<CallScore> {
  const fallback = heuristicScore(profile, turns, personality);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || turns.length === 0) return fallback;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SCORE_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You grade sales-call practice. JSON only. Be specific and slightly harsh.",
          },
          { role: "user", content: scoringPrompt(profile, turns) },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return CallScoreSchema.parse({
      ...(parsed as object),
      method: "llm",
    });
  } catch {
    return fallback;
  }
}
