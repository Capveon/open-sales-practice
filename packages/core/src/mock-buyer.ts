import type { Personality, Profile, TranscriptTurn } from "./schema";

function lastSeller(turns: TranscriptTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn?.role === "seller") return turn.text.toLowerCase();
  }
  return "";
}

function buyerCount(turns: TranscriptTurn[]): number {
  return turns.filter((t) => t.role === "buyer").length;
}

/** Deterministic in-character replies so practice works with no model keys. */
export function mockBuyerReply(
  profile: Profile,
  personality: Personality,
  turns: TranscriptTurn[],
): string {
  const n = buyerCount(turns);
  if (n === 0) return profile.firstLine ?? "Yeah.";

  const last = lastSeller(turns);
  const hard = personality.hostility >= 0.5;
  const busy = personality.timePressure >= 0.7 || profile.opening === "busy";

  if (/\b(platform|digital twin|webinar|ai-powered|artificial intelligence)\b/.test(last)) {
    return hard
      ? "I'm gonna stop you. We don't need a platform. Don't call back."
      : "We already have systems. What is this actually about?";
  }
  if (/what keeps you up|magic wand|decision maker|do you have budget/.test(last)) {
    return "That's not a useful question. I have work.";
  }
  if (/how did you get/.test(last) || profile.opening === "hostile") {
    if (n === 1 && /public|list|ops/.test(last)) return "Fine. Make it fast.";
  }
  if (/cityworks|hexagon|gis|maximo|oms|lucity/.test(last) && /rank|replace/.test(last)) {
    return profile.attributes.ownsCapital === "true"
      ? "That's me and a spreadsheet. Year laid, what broke, what I can get past council."
      : "That's planning. We just close the work orders.";
  }
  if (/three times|breaks three|onto (the )?cip|next year's cip/.test(last)) {
    return "Somebody emails somebody. Or it doesn't.";
  }
  if (/outage year|rebuild list|circuit age/.test(last)) {
    return "It doesn't, automatically. SAIDI gets discussed upstairs. The feeder is still in the queue by age.";
  }
  if (/pacp|condition/.test(last)) {
    return "The scores are in the CCTV software. The CIP is still a workshop. Consent-order work ate the year.";
  }
  if (/who (actually )?(ranks|should i talk)|talk to engineering|planning/.test(last)) {
    const name = String(profile.attributes.rankerName ?? "engineering");
    return profile.attributes.ownsCapital === "true"
      ? "You're talking to them. Don't send me to a meeting I already sit in."
      : `That's ${name}. You can say we spoke. I'm not introducing you.`;
  }
  if (/twenty minutes|20 minutes|one zone|one feeder|one basin/.test(last)) {
    if (hard && busy) return "I'm not doing a meeting. Email. Don't call the director.";
    if (profile.attributes.zone) return `Yeah. ${profile.attributes.zone} is the one. Send a hold.`;
    if (profile.attributes.feeder) return `Feeder ${profile.attributes.feeder}. Email is fine.`;
    if (profile.attributes.basin) return `${profile.attributes.basin} basin. Email me.`;
    return "Email me. I'll look.";
  }
  if (/send.*email|I'll send/.test(last)) {
    return busy ? "Yep." : "Alright.";
  }
  if (n >= 6 && hard) return "I gotta go.";
  if (busy && n >= 3) return "Look, send me an email.";

  if (profile.opening === "wrong-book" && n === 1) {
    return last.includes("electric") || last.includes("feeder")
      ? "Rebuilds are mostly by circuit age. The one that actually outages is a different conversation."
      : "That's not my book. I do electric.";
  }

  return personality.verbosity > 0.6
    ? "Kind of. Depends who's asking. What do you actually want?"
    : "Okay. And?";
}
