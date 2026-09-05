import { PersonalitySchema, type Personality } from "@osp/core";

export const PERSONALITY_FIELDS: { key: keyof Personality; label: string; hint: string }[] = [
  { key: "warmth", label: "Warmth", hint: "Cool → friendly" },
  { key: "patience", label: "Patience", hint: "Cuts you off → hears you out" },
  { key: "skepticism", label: "Skepticism", hint: "Gives you a chance → assumes a pitch" },
  { key: "verbosity", label: "Talk", hint: "Clipped → stories" },
  { key: "hostility", label: "Hard-ass", hint: "Civil → will hang up" },
  { key: "timePressure", label: "Clock", hint: "Has a minute → almost none" },
];

export function parsePersonality(input: unknown): Personality {
  return PersonalitySchema.parse(input ?? {});
}
