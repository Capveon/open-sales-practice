import { DEFAULT_PERSONALITY, PersonalitySchema, type Personality } from "./schema";

export const STARTING_ELO = 1200;
export const ELO_K = 24;

/** 0–1 hardness from the same knobs as Easy / Typical / Hard-ass. */
export function buyerDifficulty(personality: Personality): number {
  return (
    0.3 * personality.hostility +
    0.25 * personality.skepticism +
    0.2 * (1 - personality.patience) +
    0.15 * personality.timePressure +
    0.1 * (1 - personality.warmth)
  );
}

/** Fixed bot rating. Easy sits near 1000, typical ~1300, hard-ass ~1760. */
export function buyerElo(personality: Personality = DEFAULT_PERSONALITY): number {
  return Math.round(800 + buyerDifficulty(personality) * 1200);
}

export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
}

/**
 * Map a 0–100 tape grade to a chess result.
 * 62 is a draw. Earning a next step is a win; a dead call is a loss.
 */
export function scoreToResult(overall: number): number {
  return 1 / (1 + 10 ** ((62 - overall) / 15));
}

export function playCall(
  playerElo: number,
  opponentElo: number,
  overall: number,
  k = ELO_K,
): { expected: number; result: number; delta: number; after: number; buyerElo: number } {
  const expected = expectedScore(playerElo, opponentElo);
  const result = scoreToResult(overall);
  const delta = Math.round(k * (result - expected));
  return { expected, result, delta, after: playerElo + delta, buyerElo: opponentElo };
}

export type EloGame = { overall: number; personality: Personality };

export function replayElo(games: EloGame[], start = STARTING_ELO): number {
  let rating = start;
  for (const game of games) {
    rating = playCall(rating, buyerElo(game.personality), game.overall).after;
  }
  return rating;
}

export function personalityFromUnknown(raw: unknown): Personality {
  const parsed = PersonalitySchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PERSONALITY;
}
