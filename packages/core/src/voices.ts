import type { Personality, Profile, VoiceCast } from "./schema";

export type VoiceSlot = {
  id: string;
  gender: VoiceCast["gender"];
  age: VoiceCast["age"];
  region: VoiceCast["region"];
  openai: string;
};

export const VOICE_BANK: readonly VoiceSlot[] = [
  { id: "male-young", gender: "male", age: "young", region: "general", openai: "verse" },
  { id: "male-mid", gender: "male", age: "mid", region: "general", openai: "ash" },
  { id: "male-mid-southwest", gender: "male", age: "mid", region: "southwest", openai: "ash" },
  { id: "male-mid-midwest", gender: "male", age: "mid", region: "midwest", openai: "ash" },
  { id: "male-older", gender: "male", age: "older", region: "general", openai: "ballad" },
  { id: "female-young", gender: "female", age: "young", region: "general", openai: "marin" },
  { id: "female-mid", gender: "female", age: "mid", region: "general", openai: "coral" },
  { id: "female-mid-southwest", gender: "female", age: "mid", region: "southwest", openai: "coral" },
  { id: "female-older", gender: "female", age: "older", region: "general", openai: "sage" },
];

export function resolveVoice(profile: Profile): VoiceSlot {
  const cast = profile.cast;
  const scored = VOICE_BANK.map((slot) => {
    let score = 0;
    if (slot.gender === cast.gender) score += 8;
    if (slot.age === cast.age) score += 4;
    if (slot.region === cast.region) score += 2;
    else if (slot.region === "general") score += 1;
    return { slot, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const slot = scored[0]?.slot ?? VOICE_BANK[2]!;
  return { ...slot, openai: profile.voice?.trim() || slot.openai };
}

function agePhrase(age: VoiceCast["age"]): string {
  if (age === "young") return "early 30s";
  if (age === "older") return "late 50s to early 60s";
  return "mid-40s";
}

function regionPhrase(region: VoiceCast["region"]): string {
  if (region === "southwest") return "US Southwest, a little dry and flat, not a cartoon drawl";
  if (region === "south") return "US South, light, not theatrical";
  if (region === "midwest") return "US Midwest, plain";
  if (region === "west") return "US West, unhurried";
  return "general American";
}

export function speakInstructions(profile: Profile, personality: Personality): string {
  const cast = profile.cast;
  const clipped = personality.verbosity < 0.35 || personality.timePressure > 0.7;
  const hard = personality.hostility >= 0.5;
  return [
    `Phone call, not a podcast. You are ${profile.name}, ${profile.title} at ${profile.organization}.`,
    `${cast.gender === "female" ? "Woman" : "Man"}, about ${agePhrase(cast.age)}, ${regionPhrase(cast.region)}.`,
    "This is a cell phone or a cheap office handset. Close-mic, a little room noise in the tone is fine.",
    "You are the person who picked up, not an assistant, not customer service, not a narrator.",
    "Do not smile through it. Do not announce emotion.",
    hard ? "Firm, short, a little cold. Can hang up." : "Professional and slightly impatient. At work.",
    clipped ? "Short sentences. Almost clipped." : "Normal conversational pace, still a phone, not a speech.",
    "No music, no stage accent, no AI sheen.",
  ].join(" ");
}
