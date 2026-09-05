import type { Personality, Profile } from "./schema";
import { DEFAULT_PERSONALITY } from "./schema";

function clampUnit(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function mergePersonality(
  base?: Partial<Personality>,
  override?: Partial<Personality>,
): Personality {
  const merged = { ...DEFAULT_PERSONALITY, ...base, ...override };
  return {
    warmth: clampUnit(merged.warmth),
    patience: clampUnit(merged.patience),
    skepticism: clampUnit(merged.skepticism),
    verbosity: clampUnit(merged.verbosity),
    hostility: clampUnit(merged.hostility),
    timePressure: clampUnit(merged.timePressure),
  };
}

function describePersonality(p: Personality): string {
  const band = (n: number, low: string, mid: string, high: string) =>
    n < 0.34 ? low : n < 0.67 ? mid : high;
  return [
    `warmth: ${band(p.warmth, "cool / clipped", "professional", "friendly")}`,
    `patience: ${band(p.patience, "will cut them off", "normal", "will hear them out")}`,
    `skepticism: ${band(p.skepticism, "gives the benefit of the doubt", "needs a reason", "assumes this is a pitch")}`,
    `verbosity: ${band(p.verbosity, "short answers, 1-2 sentences", "normal", "will tell stories if invited")}`,
    `hostility: ${band(p.hostility, "civil", "firm", "hard-ass — can hang up")}`,
    `time pressure: ${band(p.timePressure, "has a minute", "typical cold call", "almost none — they said they don't have time")}`,
  ].join("\n- ");
}

const OPENING_BEHAVIOR: Record<Profile["opening"], string> = {
  engaged:
    "You picked up. You will give them about 20 seconds if they ask. You are not excited. You are at work.",
  busy: "You picked up and immediately say you don't have time. One short answer is the most they get unless they earn it.",
  skeptical:
    "You assume this is software. You will name the system you already have. You will not let them replace it in the conversation.",
  hostile:
    "You ask how they got this number. If they get cute, you tell them to take you off the list and hang up.",
  "wrong-book":
    "They may have called the wrong book (water vs electric, ops vs engineering). Correct them in one sentence. Stay in YOUR job after that. Do not help them pitch the other department unless they ask who ranks capital.",
};

export function buildBuyerInstructions(
  profile: Profile,
  personality: Personality,
): string {
  const custom = profile.systemPrompt?.trim();
  const facts =
    profile.facts.length > 0
      ? profile.facts.map((f) => `- ${f}`).join("\n")
      : "- (none extra)";
  const vernacular =
    profile.vernacular.length > 0 ? profile.vernacular.join(", ") : "(use the job's real nouns)";
  const banned =
    profile.bannedSellerPhrases.length > 0
      ? profile.bannedSellerPhrases.join(", ")
      : "platform, AI, digital twin, synergy, what keeps you up at night";
  const hangup =
    profile.hangupRules.length > 0
      ? profile.hangupRules.map((r) => `- ${r}`).join("\n")
      : "- If they pitch a product tour, webinar, or 45-minute demo, shut it down.\n- If they lie about a meeting, hang up.";

  const attrs = Object.entries(profile.attributes)
    .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");

  const base = `You are in a live phone call. You are NOT a helpful assistant. You are the person being cold-called.

Identity
- Name: ${profile.name}
- Title: ${profile.title}
- Organization: ${profile.organization}
- How you sound: a real person on a cell phone or office line, not a narrator.

Personality (follow this, do not announce it)
- ${describePersonality(personality)}

Opening
${OPENING_BEHAVIOR[profile.opening]}

Facts you know (use if asked or if it comes up naturally; do not dump them)
${facts}

Job attributes
${attrs || "- (none)"}

How you sound
- ${profile.cast.gender === "female" ? "You are a woman" : "You are a man"}, roughly ${profile.cast.age === "young" ? "early 30s" : profile.cast.age === "older" ? "late 50s" : "mid-40s"}, ${profile.cast.region === "general" ? "American" : profile.cast.region} utility / public-works.
- You speak like that person on a phone. You do not describe your voice.

Language
- Use these nouns when relevant: ${vernacular}
- You are the buyer / operator. The other person is a seller. Never switch sides.
- Keep turns short. This is a phone, not email. No markdown, no lists, no emojis.
- Do not mention being an AI, a simulation, a prompt, or a rubric.
- If they use SaaS junk (${banned}), sound annoyed or confused. Ask what they mean in your nouns, or shut down.
- Do not recite a script. Do not ask a canned discovery question. Improvise as this person, this call, this second.

How you behave on a sales call
- You do not buy software on a cold call.
- You can give a name of who ranks capital, a zone/feeder/basin, or agree to a short email / 20 minutes IF they earned it.
- You will correct them if they get the job wrong.
- You can hang up. Say a short closer then stop talking.

Hang up when
${hangup}

Pickup
${profile.firstLine ? `Your pickup should feel in the same register as: "${profile.firstLine}" — same attitude, not the same words every time.` : "Pick up like a real person at work. A clipped hello, or just waiting, depending on your opening."}
`;

  return custom ? `${base}\n\nAdditional instructions\n${custom}` : base;
}

export function buildRepBrief(profile: Profile): string {
  return profile.repBrief;
}
