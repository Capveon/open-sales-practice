import { describe, expect, it } from "vitest";
import { ProfileSchema } from "../schema";
import { resolveVoice } from "../voices";

function person(cast: { gender: "male" | "female"; age: "young" | "mid" | "older"; region?: string }) {
  return ProfileSchema.parse({
    id: "v-test",
    pack: "owner-operators",
    name: "Test",
    title: "Super",
    organization: "City",
    summary: "s",
    repBrief: "r",
    cast,
  });
}

describe("voice bank", () => {
  it("seats a southwest mid male on the southwest slot", () => {
    const slot = resolveVoice(person({ gender: "male", age: "mid", region: "southwest" }));
    expect(slot.id).toBe("male-mid-southwest");
    expect(slot.openai).toBe("ash");
  });

  it("seats an older midwest man on the older male slot", () => {
    const slot = resolveVoice(person({ gender: "male", age: "older", region: "midwest" }));
    expect(slot.gender).toBe("male");
    expect(slot.age).toBe("older");
  });

  it("keeps an OpenAI voice override", () => {
    const profile = ProfileSchema.parse({
      id: "v-test",
      pack: "x",
      name: "n",
      title: "t",
      organization: "o",
      summary: "s",
      repBrief: "r",
      voice: "coral",
      cast: { gender: "female", age: "mid" },
    });
    expect(resolveVoice(profile).openai).toBe("coral");
  });
});
