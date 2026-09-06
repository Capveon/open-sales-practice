import {
  CallScoreSchema,
  type CallScore,
  type Personality,
  type Profile,
  type TranscriptTurn,
} from "./schema";
import { DEFAULT_PERSONALITY } from "./schema";

const GLOBAL_RUBRIC = [
  {
    id: "one-thing",
    label: "One job, not a product",
    description: "Sold a concrete job (rank, spec, next replacement) rather than a platform, AI, or demo.",
    weight: 2,
    penalizeHints: [
      "platform",
      "ai-powered",
      "artificial intelligence",
      "digital twin",
      "synergy",
      "single source of truth",
      "webinar",
      "45-minute",
      "45 min",
    ],
    rewardHints: ["rank", "replacement", "work order", "cip", "rebuild"],
  },
  {
    id: "discovery",
    label: "Concrete questions",
    description: "Asked about a real job (breaks onto CIP, outage onto rebuild) instead of 'what keeps you up at night'.",
    weight: 1.5,
    penalizeHints: ["keeps you up", "magic wand", "tech stack", "decision maker", "do you have budget"],
    rewardHints: ["how does", "when a", "who actually", "where does"],
  },
  {
    id: "listening",
    label: "Let them talk",
    description: "Did not steamroll. Used what they said (system name, who ranks, zone).",
    weight: 1.2,
    penalizeHints: [],
    rewardHints: [],
  },
  {
    id: "cta",
    label: "Small next step",
    description: "Asked for one zone/feeder/20 minutes/email, not a close or a tour.",
    weight: 1.2,
    rewardHints: ["twenty minutes", "20 minutes", "one zone", "one feeder", "email", "if it's not useful"],
    penalizeHints: ["pilot", "contract", "pricing starts", "put you on"],
  },
  {
    id: "vernacular",
    label: "Their nouns",
    description: "Used the profile's words (main, CIP, feeder) not pipeline/platform.",
    weight: 1.3,
    penalizeHints: ["pipeline", "leverage", "circle back", "touch base"],
    rewardHints: [],
  },
];

function sellerText(turns: TranscriptTurn[]): string {
  return turns
    .filter((t) => t.role === "seller")
    .map((t) => t.text)
    .join("\n")
    .toLowerCase();
}

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function containsAny(hay: string, needles: string[]): number {
  return needles.reduce((n, needle) => {
    const q = needle.toLowerCase();
    if (!q) return n;
    if (q.length <= 3) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`);
      return re.test(hay) ? n + 1 : n;
    }
    return hay.includes(q) ? n + 1 : n;
  }, 0);
}

function usedTheirNouns(hay: string, profile: Profile): number {
  if (profile.vernacular.length === 0) return 0;
  return profile.vernacular.reduce(
    (n, word) => (hay.includes(word.toLowerCase()) ? n + 1 : n),
    0,
  );
}

function sellerTalkRatio(turns: TranscriptTurn[]): number {
  const seller = turns.filter((t) => t.role === "seller").reduce((n, t) => n + t.text.length, 0);
  const buyer = turns.filter((t) => t.role === "buyer").reduce((n, t) => n + t.text.length, 0);
  const total = seller + buyer;
  return total === 0 ? 1 : seller / total;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function heuristicScore(
  profile: Profile,
  turns: TranscriptTurn[],
  _personality: Personality = DEFAULT_PERSONALITY,
): CallScore {
  const hay = sellerText(turns);
  const sellerTurns = turns.filter((t) => t.role === "seller");
  const questions = countQuestions(hay);
  const ratio = sellerTalkRatio(turns);
  const nounHits = usedTheirNouns(hay, profile);
  const bannedHits = containsAny(hay, [
    ...GLOBAL_RUBRIC.flatMap((r) => r.penalizeHints),
    ...profile.bannedSellerPhrases,
  ]);

  const dimensions = [
    ...GLOBAL_RUBRIC,
    ...profile.scoring.rubric.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      weight: item.weight,
      penalizeHints: item.penalizeHints,
      rewardHints: item.rewardHints,
    })),
  ].map((item) => {
    let score = 6;
    const rewards = containsAny(hay, item.rewardHints);
    const penalties = containsAny(hay, item.penalizeHints);
    score += Math.min(3, rewards);
    score -= Math.min(5, penalties * 1.5);
    if (item.id === "discovery") {
      score += Math.min(2, questions);
      if (containsAny(hay, ["keeps you up", "magic wand"])) score -= 3;
    }
    if (item.id === "listening") {
      if (ratio > 0.75) score -= 3;
      if (ratio < 0.55) score += 1;
      const named = Object.values(profile.attributes)
        .filter((v): v is string => typeof v === "string")
        .some((v) => hay.includes(v.toLowerCase()));
      if (named) score += 1;
    }
    if (item.id === "vernacular") {
      score += Math.min(3, nounHits);
      if (hay.includes("pipeline") && profile.pack === "owner-operators") score -= 2;
    }
    if (item.id === "one-thing") {
      if (hay.includes("rank")) score += 1;
      if (hay.includes("install year") || hay.includes("year the pipe") || hay.includes("circuit age"))
        score += 1;
    }
    if (sellerTurns.length === 0) score = 0;
    return {
      id: item.id,
      label: item.label,
      score: clamp(Math.round(score * 10) / 10, 0, 10),
      notes: item.description,
      weight: item.weight,
    };
  });

  const weightSum = dimensions.reduce((n, d) => n + d.weight, 0);
  const overall = clamp(
    Math.round(
      (dimensions.reduce((n, d) => n + d.score * d.weight, 0) / (weightSum || 1)) * 10,
    ),
    0,
    100,
  );

  const coaching: string[] = [];
  if (bannedHits > 0) coaching.push("Drop platform / AI / demo language. Use their nouns.");
  if (questions < 1) coaching.push("Ask one concrete question about how work becomes capital.");
  if (ratio > 0.7) coaching.push("You talked past them. Hypothesis, then shut up.");
  if (nounHits === 0 && profile.vernacular.length) {
    coaching.push(`Use their words: ${profile.vernacular.slice(0, 6).join(", ")}.`);
  }
  if (overall >= 75) coaching.push("Small CTA next: one zone or one feeder, 20 minutes, then stop.");

  const outcome =
    overall >= 80
      ? "Likely next step"
      : overall >= 60
        ? "Conversation, no commitment"
        : overall >= 40
          ? "They stayed on, you didn't earn a hold"
          : "Dead call";

  return CallScoreSchema.parse({
    overall,
    dimensions: dimensions.map(({ weight: _w, ...rest }) => rest),
    outcome,
    coaching: coaching.slice(0, 4),
    method: "heuristic",
  });
}

export function scoringPrompt(profile: Profile, turns: TranscriptTurn[]): string {
  const transcript = turns
    .filter((t) => t.role === "seller" || t.role === "buyer")
    .map((t) => `${t.role === "seller" ? "SELLER" : "BUYER"}: ${t.text}`)
    .join("\n");
  return `You grade a cold sales call. The seller is practicing. The buyer was a simulated ${profile.title} named ${profile.name}.

Return JSON only:
{
  "overall": 0-100,
  "outcome": "short phrase",
  "dimensions": [{"id":"","label":"","score":0-10,"notes":"one sentence"}],
  "coaching": ["up to 4 bullets"],
  "betterLine": "one alternative line the seller should have said, or empty"
}

Rubric:
${[...GLOBAL_RUBRIC, ...profile.scoring.rubric]
  .map((r) => `- ${r.id} (${r.label}): ${r.description}`)
  .join("\n")}

Be harsh but specific. Do not reward sounding like SaaS. Reward their nouns, a testable hypothesis, one concrete question, a small CTA.

Transcript:
${transcript || "(empty)"}
`;
}
