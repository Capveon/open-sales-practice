import { GlobalSettingsSchema, type GlobalSettings } from "./schema";

export function loadGlobalSettings(env: NodeJS.ProcessEnv = process.env): GlobalSettings {
  return GlobalSettingsSchema.parse({
    appName: env.OSP_APP_NAME,
    callMaxSeconds: env.OSP_CALL_MAX_SECONDS ? Number(env.OSP_CALL_MAX_SECONDS) : undefined,
    scoreModel: env.OPENAI_SCORE_MODEL,
    realtimeModel: env.OPENAI_REALTIME_MODEL,
    defaultVoice: env.OSP_DEFAULT_VOICE,
    ttsModel: env.OPENAI_TTS_MODEL,
  });
}

export function voiceMode(env: NodeJS.ProcessEnv = process.env): "mock" | "voice" {
  return env.OSP_VOICE_MODE === "voice" ? "voice" : "mock";
}

export function authMode(env: NodeJS.ProcessEnv = process.env): "none" | "clerk" {
  if (env.OSP_AUTH === "clerk") return "clerk";
  if (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() && env.OSP_AUTH !== "none") return "clerk";
  return "none";
}
