import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  type JobContext,
  ServerOptions,
  beta,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import {
  buildBuyerInstructions,
  mergePersonality,
  mergeTranscripts,
  parseTranscriptionText,
  resolveVoice,
  speakInstructions,
  AGENT_NAME,
  REALTIME_MODEL,
  TRANSCRIPT_TOPIC,
  type Personality,
  type TranscriptTurn,
} from "@osp/core";
import { getProfile } from "@osp/core/registry";

dotenv.config({ path: "../web/.env.local" });
dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: ".env.local" });

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

function epochMs(value: number): number {
  return value > 1e12 ? value : Math.floor(value * 1000);
}

function turnsFromHistory(history: llm.ChatContext): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const item of history.items) {
    if (item.type !== "message") continue;
    if (item.role !== "user" && item.role !== "assistant") continue;
    const text = parseTranscriptionText(item.textContent ?? "");
    if (!text) continue;
    turns.push({
      role: item.role === "user" ? "seller" : "buyer",
      text,
      at: epochMs(item.createdAt),
    });
  }
  return turns;
}

async function publishTape(ctx: JobContext, turns: TranscriptTurn[]) {
  const tape = mergeTranscripts(turns);
  const participant = ctx.room.localParticipant;
  if (!tape.length || !participant) return;
  try {
    await participant.sendText(JSON.stringify(tape), {
      topic: TRANSCRIPT_TOPIC,
    });
  } catch {
    // Room may already be closing.
  }
}

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

    const publish = () => publishTape(ctx, turnsFromHistory(session.history));

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, () => {
      void publish();
    });
    session.on(voice.AgentSessionEventTypes.Close, () => {
      void publish();
    });

    ctx.addShutdownCallback(async () => {
      await publish();
    });

    await session.start({
      agent: voice.Agent.create({
        instructions,
        tools: [
          beta.createEndCallTool({
            deleteRoom: true,
            ignoreOnEnter: true,
            extraDescription:
              "You are the buyer on a cold sales call. End the phone after a short closer when you are done, they ignored a no, they kept pitching, or they wasted the minute.",
            onToolCalled: async () => {
              await publish();
            },
          }),
        ],
      }),
      room: ctx.room,
      inputOptions: {
        textEnabled: true,
        closeOnDisconnect: true,
      },
      outputOptions: {
        transcriptionEnabled: true,
        // Full captions for the tape/score, not karaoke-synced fragments.
        syncTranscription: false,
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
