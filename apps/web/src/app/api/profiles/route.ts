import { voiceMode } from "@osp/core";
import { loadPacks } from "@osp/core/registry";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { livekitConfigured } from "@/lib/livekit";

export async function GET() {
  try {
    const user = await requireUser();
    const packs = loadPacks().map(({ pack, profiles }) => ({
      ...pack,
      profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        organization: p.organization,
        summary: p.summary,
        repBrief: p.repBrief,
        opening: p.opening,
        voice: p.voice,
        personality: p.personality,
        attributes: p.attributes,
        vernacular: p.vernacular,
      })),
    }));
    return Response.json({
      user: { id: user.id, name: user.name },
      voice: voiceMode() === "voice" && livekitConfigured() ? "voice" : "mock",
      packs,
    });
  } catch (err) {
    return asError(err);
  }
}
