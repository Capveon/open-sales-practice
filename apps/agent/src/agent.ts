import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  getJobContext,
  llm,
  voice,
} from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import {
  buildBuyerInstructions,
  mergePersonality,
  resolveVoice,
  speakInstructions,
  AGENT_NAME,
  REALTIME_MODEL,
  type Personality,
} from "@osp/core";
import { getProfile } from "@osp/core/registry";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: "../../.env.local" });

type RoomMeta = {
  callId?: string;
  profileId?: string;
  personality?: Partial<Personality>;
};

function parseMeta(raw: string | undefined): RoomMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RoomMeta;
  } catch {
    return {};
  }
}

function metaFrom(ctx: JobContext): RoomMeta {
  const job = parseMeta(ctx.job.metadata);
  const assigned = parseMeta(ctx.job.room?.metadata);
  const room = parseMeta(ctx.room.metadata);
  return { ...assigned, ...room, ...job };
}

const hangUp = llm.tool({
  description:
    "End the phone call. Use this when you are done talking: you said you have to go, they ignored a no, they kept pitching, or the call is over. Say a short closer first, then call this.",
  execute: async (_args, { ctx }) => {
    await ctx.waitForPlayout().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await getJobContext().deleteRoom();
    } catch {
      await ctx.session.shutdown();
    }
    return "hung up";
  },
});

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const meta = metaFrom(ctx);
    const profileId = meta.profileId;
    if (!profileId) {
      throw new Error("Job is missing profileId in metadata");
    }
    const profile = getProfile(profileId);
    const personality = mergePersonality(profile.personality, meta.personality);
    const instructions = `${speakInstructions(profile, personality)}\n\n${buildBuyerInstructions(profile, personality)}`;
    const voiceName = profile.voice || resolveVoice(profile).openai;

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: voiceName,
        model: REALTIME_MODEL,
        turnDetection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      }),
    });

    await session.start({
      agent: voice.Agent.create({
        instructions,
        tools: { hang_up: hangUp },
      }),
      room: ctx.room,
      inputOptions: {
        textEnabled: true,
      },
      outputOptions: {
        transcriptionEnabled: true,
        syncTranscription: true,
      },
    });

    await session.generateReply({
      instructions:
        "The phone just connected. Give your first line only. Stay in character. Do not greet like an assistant.",
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: AGENT_NAME,
  }),
);
