import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPacks, getProfile } from "../registry";
import { buildBuyerInstructions, mergePersonality } from "../prompt";
import { heuristicScore } from "../scoring";
import { ProfileSchema } from "../schema";

function seedProfiles() {
  const root = mkdtempSync(join(tmpdir(), "osp-profiles-"));
  const packDir = join(root, "packs", "owner-operators");
  const { mkdirSync } = require("node:fs") as typeof import("node:fs");
  mkdirSync(packDir, { recursive: true });
  writeFileSync(
    join(packDir, "pack.yaml"),
    `id: owner-operators\nlabel: Owner / operators\ndescription: Test pack\n`,
  );
  writeFileSync(
    join(packDir, "caleb.yaml"),
    `id: caleb-test
pack: owner-operators
name: Caleb
title: Water ops superintendent
organization: Test Water
summary: Test
repBrief: Rank pipe off breaks.
voice: ash
opening: engaged
vernacular: [CIP, main, Cityworks]
facts:
  - Engineering ranks the CIP.
bannedSellerPhrases: [platform]
personality:
  hostility: 0.2
`,
  );
  return root;
}

describe("profile registry", () => {
  it("loads a pack from yaml", () => {
    const root = seedProfiles();
    const packs = loadPacks(root);
    expect(packs).toHaveLength(1);
    expect(packs[0]?.profiles[0]?.id).toBe("caleb-test");
    expect(getProfile("caleb-test", root).title).toMatch(/superintendent/i);
  });

  it("rejects a bad id", () => {
    expect(() =>
      ProfileSchema.parse({
        id: "Caleb Test",
        pack: "x",
        name: "x",
        title: "x",
        organization: "x",
        summary: "x",
        repBrief: "x",
      }),
    ).toThrow();
  });
});

describe("prompts", () => {
  it("merges personality overrides", () => {
    const p = mergePersonality({}, { hostility: 0.9 });
    expect(p.hostility).toBe(0.9);
    expect(p.warmth).toBeGreaterThan(0);
  });

  it("builds buyer instructions with vernacular", () => {
    const root = seedProfiles();
    const profile = getProfile("caleb-test", root);
    const text = buildBuyerInstructions(profile, mergePersonality(profile.personality));
    expect(text).toContain("Caleb");
    expect(text).toContain("Cityworks");
    expect(text).toContain("end_call");
    expect(text).not.toMatch(/I am a helpful assistant/i);
  });
});

describe("heuristic scoring", () => {
  it("rewards ranking language and punishes platform talk", () => {
    const root = seedProfiles();
    const profile = getProfile("caleb-test", root);
    const bad = heuristicScore(profile, [
      { role: "seller", text: "Let me show you our AI platform and digital twin.", at: 1 },
      { role: "buyer", text: "We have Cityworks.", at: 2 },
    ]);
    const good = heuristicScore(profile, [
      {
        role: "seller",
        text: "We work with water utilities on how they rank pipe replacement. When a main breaks three times, how does that get on next year's CIP? One zone, twenty minutes.",
        at: 1,
      },
      { role: "buyer", text: "Somebody emails somebody.", at: 2 },
    ]);
    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(bad.method).toBe("heuristic");
  });
});
