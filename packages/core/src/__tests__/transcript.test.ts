import { describe, expect, it } from "vitest";
import {
  commitLiveLines,
  mergeTranscripts,
  parseTranscriptionText,
  parseTranscriptJson,
  upsertSegment,
} from "../transcript";

describe("transcription parsing", () => {
  it("keeps plain captions", () => {
    expect(parseTranscriptionText("  Hello there.  ")).toBe("Hello there.");
  });

  it("joins LiveKit jsonFormat chunks", () => {
    expect(
      parseTranscriptionText('{"text":"Hello "}\n{"text":"there.","start_time":0.1}\n'),
    ).toBe("Hello there.");
  });

  it("reads stored tape json", () => {
    expect(parseTranscriptJson("not json")).toEqual([]);
    expect(
      parseTranscriptJson(
        JSON.stringify([
          { role: "buyer", text: "Yeah", at: 1 },
          { role: "status", text: "Caleb ended the call", at: 3 },
          { role: "nope", text: "drop", at: 2 },
        ]),
      ),
    ).toEqual([
      { role: "buyer", text: "Yeah", at: 1 },
      { role: "status", text: "Caleb ended the call", at: 3 },
    ]);
  });
});

describe("segment upsert", () => {
  it("replaces the same segment instead of dropping later words", () => {
    const first = upsertSegment([], {
      role: "buyer",
      text: "Yeah",
      at: 1,
      segmentId: "sg-1",
      live: true,
    });
    const next = upsertSegment(first, {
      role: "buyer",
      text: "Yeah, go ahead.",
      at: 2,
      segmentId: "sg-1",
      live: false,
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.text).toBe("Yeah, go ahead.");
    expect(next[0]?.live).toBe(false);
  });

  it("keeps a new speaker on their own line", () => {
    const first = upsertSegment([], {
      role: "buyer",
      text: "Yeah",
      at: 1,
      segmentId: "sg-1",
    });
    const next = upsertSegment(first, {
      role: "seller",
      text: "When a main breaks, who ranks CIP?",
      at: 2,
      segmentId: "sg-2",
    });
    expect(commitLiveLines(next).map((t) => t.role)).toEqual(["buyer", "seller"]);
  });

  it("collapses growing STT partials into one line", () => {
    const tape = [
      { role: "seller" as const, text: "Hey", at: 1, segmentId: "a" },
      { role: "seller" as const, text: "Hey Marcus, how", at: 2, segmentId: "b" },
      { role: "seller" as const, text: "Hey Marcus, how's your day going?", at: 3, segmentId: "c" },
    ].reduce((turns, line) => upsertSegment(turns, line), [] as ReturnType<typeof upsertSegment>);
    expect(commitLiveLines(tape).map((t) => t.text)).toEqual(["Hey Marcus, how's your day going?"]);
  });

  it("collapses a split opening plus the combined replay", () => {
    const tape = [
      { role: "buyer" as const, text: "Marcus", at: 1, segmentId: "1" },
      { role: "buyer" as const, text: "Make it quick.", at: 2, segmentId: "2" },
      { role: "buyer" as const, text: "Marcus. Make it quick.", at: 3, segmentId: "3" },
    ].reduce((turns, line) => upsertSegment(turns, line), [] as ReturnType<typeof upsertSegment>);
    expect(commitLiveLines(tape).map((t) => t.text)).toEqual(["Marcus. Make it quick."]);
  });
});

describe("mergeTranscripts", () => {
  it("keeps the full tape when one side only has the latest line", () => {
    const live = [
      { role: "buyer" as const, text: "This is Caleb.", at: 1 },
      { role: "seller" as const, text: "Who ranks the CIP?", at: 2 },
    ];
    const latestOnly = [{ role: "seller" as const, text: "Who ranks the CIP?", at: 2 }];
    expect(mergeTranscripts(latestOnly, live)).toHaveLength(2);
  });

  it("rebuilds the Marcus call as three turns", () => {
    const merged = mergeTranscripts([
      { role: "buyer", text: "Marcus", at: 1 },
      { role: "buyer", text: "Make it quick.", at: 2 },
      { role: "buyer", text: "Marcus", at: 3 },
      { role: "buyer", text: "Make it quick", at: 4 },
      { role: "buyer", text: "Marcus. Make it quick.", at: 5 },
      { role: "seller", text: "Hey", at: 6 },
      { role: "seller", text: "Hey Marcus, how", at: 7 },
      { role: "seller", text: "Hey Marcus, how's your day going?", at: 8 },
      { role: "buyer", text: "Don't have time for that. What do you need?", at: 9 },
    ]);
    expect(merged.map((t) => `${t.role}:${t.text}`)).toEqual([
      "buyer:Marcus. Make it quick.",
      "seller:Hey Marcus, how's your day going?",
      "buyer:Don't have time for that. What do you need?",
    ]);
  });

  it("does not keep STT prefixes after merge", () => {
    const merged = mergeTranscripts(
      [
        { role: "seller", text: "Hey", at: 1 },
        { role: "seller", text: "Hey Marcus, how", at: 2 },
      ],
      [{ role: "seller", text: "Hey Marcus, how's your day going?", at: 3 }],
    );
    expect(merged.map((t) => t.text)).toEqual(["Hey Marcus, how's your day going?"]);
  });
});
