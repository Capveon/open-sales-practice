import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { authMode, loadGlobalSettings, voiceMode } from "@osp/core";
import { livekitConfigured } from "@/lib/livekit";
import { ttsProvider } from "@/lib/tts";

export async function GET() {
  try {
    const user = await requireUser();
    const settings = loadGlobalSettings();
    return Response.json({
      user: { id: user.id, name: user.name, email: user.email },
      settings: {
        appName: settings.appName,
        callMaxSeconds: settings.callMaxSeconds,
        auth: authMode(),
        voice: voiceMode() === "voice" && livekitConfigured() ? "voice" : "mock",
        buyer: process.env.OPENAI_API_KEY?.trim() ? "llm" : "missing",
        tts: ttsProvider(),
      },
    });
  } catch (err) {
    return asError(err);
  }
}
