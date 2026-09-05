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
          { role: "nope", text: "drop", at: 2 },
        ]),
      ),
    ).toEqual([{ role: "buyer", text: "Yeah", at: 1 }]);
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

  it("appends a new utterance", () => {
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
});
