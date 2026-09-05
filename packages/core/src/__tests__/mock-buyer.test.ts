import { describe, expect, it } from "vitest";
import { mockBuyerReply } from "../mock-buyer";
import { mergePersonality } from "../prompt";
import { ProfileSchema } from "../schema";

const profile = ProfileSchema.parse({
  id: "unit-caleb",
  pack: "owner-operators",
  name: "Caleb",
  title: "Super",
  organization: "City",
  summary: "s",
  repBrief: "r",
  firstLine: "Yeah.",
  attributes: { zone: "east", rankerName: "Maria", ownsCapital: "false" },
});

describe("mock buyer", () => {
  it("opens with firstLine", () => {
    const p = mergePersonality();
    expect(mockBuyerReply(profile, p, [])).toBe("Yeah.");
  });

  it("names the CIP gap", () => {
    const reply = mockBuyerReply(profile, mergePersonality(), [
      { role: "buyer", text: "Yeah.", at: 1 },
      {
        role: "seller",
        text: "When a main breaks three times, how does that get onto next year's CIP?",
        at: 2,
      },
    ]);
    expect(reply.toLowerCase()).toMatch(/email/);
  });
});
