import { describe, expect, it } from "vitest";
import { DEFAULT_PERSONALITY } from "../schema";
import { mergePersonality } from "../prompt";
import { buyerElo, playCall, replayElo, scoreToResult, STARTING_ELO } from "../elo";

const easy = mergePersonality(DEFAULT_PERSONALITY, {
  hostility: 0.05,
  skepticism: 0.3,
  patience: 0.8,
  timePressure: 0.25,
});
const typical = DEFAULT_PERSONALITY;
const hard = mergePersonality(DEFAULT_PERSONALITY, {
  hostility: 0.75,
  skepticism: 0.85,
  patience: 0.2,
  timePressure: 0.8,
  warmth: 0.2,
});

describe("buyer Elo", () => {
  it("rates hard-ass higher than typical, typical higher than easy", () => {
    expect(buyerElo(easy)).toBeLessThan(buyerElo(typical));
    expect(buyerElo(typical)).toBeLessThan(buyerElo(hard));
    expect(buyerElo(easy)).toBeGreaterThan(900);
    expect(buyerElo(hard)).toBeGreaterThan(1600);
  });
});

describe("call as a chess game", () => {
  it("pays more for an 80 against a hard bot than an easy one", () => {
    const vsEasy = playCall(STARTING_ELO, buyerElo(easy), 80);
    const vsHard = playCall(STARTING_ELO, buyerElo(hard), 80);
    expect(vsHard.delta).toBeGreaterThan(vsEasy.delta);
    expect(vsHard.delta).toBeGreaterThan(10);
  });

  it("punishes a dead call against an easy bot more than against a hard-ass", () => {
    const vsEasy = playCall(STARTING_ELO, buyerElo(easy), 28);
    const vsHard = playCall(STARTING_ELO, buyerElo(hard), 28);
    expect(vsEasy.delta).toBeLessThan(vsHard.delta);
    expect(vsEasy.delta).toBeLessThan(-8);
  });

  it("does not let one crushed easy call outrank honest hard-ass work", () => {
    const luckyEasy = replayElo([{ overall: 96, personality: easy }]);
    const hardWork = replayElo([
      { overall: 71, personality: hard },
      { overall: 68, personality: hard },
      { overall: 74, personality: hard },
    ]);
    expect(hardWork).toBeGreaterThan(luckyEasy);
  });

  it("treats ~62 as a draw", () => {
    expect(scoreToResult(62)).toBeCloseTo(0.5, 2);
    expect(scoreToResult(85)).toBeGreaterThan(0.85);
    expect(scoreToResult(30)).toBeLessThan(0.1);
  });
});
