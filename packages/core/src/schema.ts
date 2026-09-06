import { z } from "zod";

/** 0 = none, 1 = max. All personality knobs are this scale so UI sliders stay uniform. */
const unit = z.number().min(0).max(1);

export const PersonalitySchema = z.object({
  warmth: unit.default(0.45),
  patience: unit.default(0.5),
  skepticism: unit.default(0.55),
  verbosity: unit.default(0.4),
  hostility: unit.default(0.15),
  timePressure: unit.default(0.45),
});

export type Personality = z.infer<typeof PersonalitySchema>;

export const DEFAULT_PERSONALITY: Personality = PersonalitySchema.parse({});

export const RubricItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  weight: z.number().positive().default(1),
  /** Extra keywords that help the heuristic scorer. */
  rewardHints: z.array(z.string()).default([]),
  penalizeHints: z.array(z.string()).default([]),
});

export type RubricItem = z.infer<typeof RubricItemSchema>;

export const OpeningSchema = z.enum([
  "engaged",
  "busy",
  "skeptical",
  "hostile",
  "wrong-book",
]);

export type Opening = z.infer<typeof OpeningSchema>;

export const VoiceCastSchema = z.object({
  gender: z.enum(["male", "female"]).default("male"),
  age: z.enum(["young", "mid", "older"]).default("mid"),
  region: z.enum(["southwest", "south", "midwest", "west", "general"]).default("general"),
});

export type VoiceCast = z.infer<typeof VoiceCastSchema>;

export const ProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  pack: z.string(),
  name: z.string(),
  title: z.string(),
  organization: z.string(),
  summary: z.string(),
  /** Shown to the seller before they dial. Not read by the buyer. */
  repBrief: z.string(),
  /** Gender / age / region. Mapped onto a shared voice bank — not a unique clone per person. */
  cast: VoiceCastSchema.default({}),
  /** Optional OpenAI Realtime / TTS voice override (`ash`, `coral`, …). */
  voice: z.string().optional(),
  opening: OpeningSchema.default("engaged"),
  personality: PersonalitySchema.default({}),
  attributes: z.record(z.string(), z.unknown()).default({}),
  vernacular: z.array(z.string()).default([]),
  bannedSellerPhrases: z.array(z.string()).default([]),
  facts: z.array(z.string()).default([]),
  hangupRules: z.array(z.string()).default([]),
  firstLine: z.string().optional(),
  systemPrompt: z.string().optional(),
  scoring: z
    .object({
      rubric: z.array(RubricItemSchema).default([]),
    })
    .default({ rubric: [] }),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const PackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  description: z.string(),
});

export type Pack = z.infer<typeof PackSchema>;

export const TranscriptTurnSchema = z.object({
  role: z.enum(["seller", "buyer", "status"]),
  text: z.string(),
  at: z.number(),
});

export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const DimensionScoreSchema = z.object({
  id: z.string(),
  label: z.string(),
  score: z.number().min(0).max(10),
  notes: z.string(),
});

export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const CallScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  dimensions: z.array(DimensionScoreSchema),
  outcome: z.string(),
  coaching: z.array(z.string()),
  betterLine: z.string().optional(),
  method: z.enum(["heuristic", "llm"]),
  buyerElo: z.number().optional(),
  eloDelta: z.number().optional(),
  eloAfter: z.number().optional(),
});

export type CallScore = z.infer<typeof CallScoreSchema>;
