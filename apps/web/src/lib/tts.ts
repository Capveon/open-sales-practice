import {
  loadGlobalSettings,
  resolveVoice,
  speakInstructions,
  type Personality,
  type Profile,
} from "@osp/core";
import { HttpError } from "./api";

export type SpokenLine = {
  mime: string;
  base64: string;
  provider: "elevenlabs" | "openai";
};

type SpeakOpts = {
  previousText?: string;
};

/** So CIP doesn't come out as "sip" on the phone. */
function forSpeech(text: string): string {
  return text
    .replace(/\bCIP\b/g, "C I P")
    .replace(/\bPACP\b/g, "P A C P")
    .replace(/\bSAIDI\b/g, "say-dee")
    .replace(/\bSSO\b/g, "S S O")
    .replace(/\bI&I\b/g, "I and I")
    .replace(/\bOMS\b/g, "O M S")
    .replace(/\bCCTV\b/g, "C C T V")
    .replace(/\bT&D\b/g, "T and D");
}

async function elevenLabsSpeak(
  profile: Profile,
  personality: Personality,
  text: string,
  opts: SpeakOpts,
): Promise<SpokenLine | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;
  const slot = resolveVoice(profile);
  const model = process.env.ELEVENLABS_MODEL?.trim() || "eleven_turbo_v2_5";
  const busy = personality.timePressure >= 0.7;
  const older = profile.cast.age === "older";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${slot.elevenLabsId}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: forSpeech(text),
        model_id: model,
        language_code: "en",
        apply_text_normalization: "auto",
        previous_text: opts.previousText ? forSpeech(opts.previousText).slice(-400) : undefined,
        voice_settings: {
          stability: personality.hostility >= 0.5 ? 0.52 : 0.35,
          similarity_boost: 0.82,
          style: personality.hostility >= 0.5 ? 0.08 : 0.22,
          use_speaker_boost: true,
          speed: older ? 0.94 : busy ? 1.08 : 1.0,
        },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 220)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 200) throw new Error("ElevenLabs returned empty audio");
  return { mime: "audio/mpeg", base64: buf.toString("base64"), provider: "elevenlabs" };
}

async function openAiSpeak(
  profile: Profile,
  personality: Personality,
  text: string,
): Promise<SpokenLine | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const slot = resolveVoice(profile);
  const model = loadGlobalSettings().ttsModel || "gpt-4o-mini-tts";
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice: slot.openai,
      input: forSpeech(text),
      instructions: speakInstructions(profile, personality),
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI TTS ${res.status}: ${detail.slice(0, 160)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { mime: "audio/mpeg", base64: buf.toString("base64"), provider: "openai" };
}

export async function synthesizeBuyerSpeech(
  profile: Profile,
  personality: Personality,
  text: string,
  opts: SpeakOpts = {},
): Promise<SpokenLine> {
  const trimmed = text.trim();
  if (!trimmed) throw new HttpError("Nothing to speak.", 400);

  const elevenErrs: string[] = [];
  try {
    const eleven = await elevenLabsSpeak(profile, personality, trimmed, opts);
    if (eleven) return eleven;
  } catch (err) {
    elevenErrs.push(err instanceof Error ? err.message : "ElevenLabs failed");
  }

  try {
    const openai = await openAiSpeak(profile, personality, trimmed);
    if (openai) return openai;
  } catch (err) {
    const oai = err instanceof Error ? err.message : "OpenAI TTS failed";
    throw new HttpError(
      `Could not speak the line. ${[...elevenErrs, oai].join(" · ")}`,
      503,
    );
  }

  throw new HttpError("No speech provider configured.", 503);
}

export function ttsProvider(): "elevenlabs" | "openai" | "missing" {
  if (process.env.ELEVENLABS_API_KEY?.trim()) return "elevenlabs";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return "missing";
}
