import type { Personality, Profile, VoiceCast } from "./schema";

export type VoiceSlot = {
  id: string;
  gender: VoiceCast["gender"];
  age: VoiceCast["age"];
  region: VoiceCast["region"];
  /** ElevenLabs premade voice id. Override with ELEVENLABS_VOICE_<ID>. */
  elevenLabsId: string;
  /** OpenAI TTS / Realtime voice. */
  openai: string;
};

/**
 * A small bank, not one clone per buyer. Profiles pick gender / age / region;
 * we map them onto these seats so two superintendents can share a throat.
 */
export const VOICE_BANK: readonly VoiceSlot[] = [
  { id: "male-young", gender: "male", age: "young", region: "general", elevenLabsId: "bIHbv24MWmeRgasZH58o", openai: "verse" },
  { id: "male-mid", gender: "male", age: "mid", region: "general", elevenLabsId: "iP95p4xoKVk53GoZ742B", openai: "ash" },
  { id: "male-mid-southwest", gender: "male", age: "mid", region: "southwest", elevenLabsId: "pNInz6obpgDQGcFmaJgB", openai: "ash" },
  { id: "male-mid-midwest", gender: "male", age: "mid", region: "midwest", elevenLabsId: "cjVigY5qzO86Huf0OWal", openai: "ash" },
  { id: "male-older", gender: "male", age: "older", region: "general", elevenLabsId: "pqHfZKP75CvOlQylNhV4", openai: "ballad" },
  { id: "female-young", gender: "female", age: "young", region: "general", elevenLabsId: "cgSgspJ2msm6clMCkdW9", openai: "marin" },
  { id: "female-mid", gender: "female", age: "mid", region: "general", elevenLabsId: "XrExE9yKIg1WjnnlVkGX", openai: "coral" },
  { id: "female-mid-southwest", gender: "female", age: "mid", region: "southwest", elevenLabsId: "hpp4J3VqNfWAUOO0d1Us", openai: "coral" },
  { id: "female-older", gender: "female", age: "older", region: "general", elevenLabsId: "pFZP5JQG7iQjIQuC4Bku", openai: "sage" },
];

function envOverride(slot: VoiceSlot): string {
  const key = `ELEVENLABS_VOICE_${slot.id.replace(/-/g, "_").toUpperCase()}`;
  return process.env[key]?.trim() || slot.elevenLabsId;
}

export function resolveVoice(profile: Profile): VoiceSlot & { elevenLabsId: string; openai: string } {
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
  const openai = profile.voice?.trim() || slot.openai;
  return { ...slot, elevenLabsId: envOverride(slot), openai };
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

/** Delivery notes for TTS. The model is the person, not a narrator. */
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
