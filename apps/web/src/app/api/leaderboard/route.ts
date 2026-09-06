import { buyerElo, personalityFromUnknown, replayElo } from "@osp/core";
import { loadPacks } from "@osp/core/registry";
import { requireUser } from "@/lib/auth";
import { asError } from "@/lib/api";
import { db } from "@/lib/db";

const RANGES = new Set(["today", "3d", "7d", "14d", "30d", "all"]);
const SORTS = new Set(["elo", "avg", "calls", "best", "recent"]);

function sinceMs(range: string): number | null {
  if (range === "all" || !RANGES.has(range)) return null;
  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  const days = Number(range.replace("d", ""));
  return Date.now() - days * 86_400_000;
}

function profileLookup() {
  const map = new Map<string, { name: string; pack: string; packLabel: string; title: string }>();
  for (const { pack, profiles } of loadPacks()) {
    for (const p of profiles) {
      map.set(p.id, { name: p.name, pack: pack.id, packLabel: pack.label, title: p.title });
    }
  }
  return map;
}

function readJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const range = RANGES.has(url.searchParams.get("range") ?? "") ? (url.searchParams.get("range") as string) : "7d";
    const sort = SORTS.has(url.searchParams.get("sort") ?? "") ? (url.searchParams.get("sort") as string) : "elo";
    const minCalls = Math.max(1, Math.min(20, Number(url.searchParams.get("minCalls") ?? 1) || 1));
    const pack = url.searchParams.get("pack")?.trim() || "";
    const profileId = url.searchParams.get("profile")?.trim() || "";
    const q = url.searchParams.get("q")?.trim().toLowerCase() || "";

    const lookup = profileLookup();
    let allowedIds: string[] | null = null;
    if (profileId && lookup.has(profileId)) {
      allowedIds = [profileId];
    } else if (pack) {
      allowedIds = [...lookup.entries()].filter(([, m]) => m.pack === pack).map(([id]) => id);
    }

    const since = sinceMs(range);
    const where: string[] = ["c.status = 'scored'", "c.overall IS NOT NULL"];
    const args: Array<string | number> = [];
    if (since != null) {
      where.push("c.started_at >= ?");
      args.push(since);
    }
    if (allowedIds) {
      if (allowedIds.length === 0) {
        return Response.json({
          range,
          sort,
          minCalls,
          pack,
          profile: profileId,
          q,
          rows: [],
          tapes: [],
          filters: filtersPayload(lookup),
        });
      }
      where.push(`c.profile_id IN (${allowedIds.map(() => "?").join(",")})`);
      args.push(...allowedIds);
    }
    const whereSql = where.join(" AND ");

    const games = await db().execute({
      sql: `SELECT u.id, u.name, c.overall, c.personality_json, c.profile_id,
                   COALESCE(c.ended_at, c.started_at) AS at
            FROM calls c
            INNER JOIN users u ON u.id = c.user_id
            WHERE ${whereSql}
            ORDER BY COALESCE(c.ended_at, c.started_at) ASC, c.id ASC`,
      args,
    });

    type Bucket = {
      userId: string;
      name: string;
      games: { overall: number; personality: ReturnType<typeof personalityFromUnknown> }[];
      lastAt: number;
      lastProfile: string | null;
    };
    const byUser = new Map<string, Bucket>();
    for (const row of games.rows) {
      const userId = String(row.id);
      let bucket = byUser.get(userId);
      if (!bucket) {
        bucket = { userId, name: String(row.name), games: [], lastAt: 0, lastProfile: null };
        byUser.set(userId, bucket);
      }
      const overall = Number(row.overall);
      bucket.games.push({
        overall,
        personality: personalityFromUnknown(readJson(row.personality_json)),
      });
      const at = Number(row.at ?? 0);
      bucket.lastAt = at;
      bucket.lastProfile = row.profile_id == null ? null : String(row.profile_id);
    }

    type Standing = {
      userId: string;
      name: string;
      calls: number;
      elo: number;
      avgScore: number | null;
      bestScore: number | null;
      lastAt: number;
      lastBuyer: string | null;
    };

    let rows: Standing[] = [...byUser.values()]
      .filter((bucket) => bucket.games.length >= minCalls)
      .map((bucket) => {
        const scores = bucket.games.map((g) => g.overall);
        const lastProfile = bucket.lastProfile;
        return {
          userId: bucket.userId,
          name: bucket.name,
          calls: bucket.games.length,
          elo: replayElo(bucket.games),
          avgScore: Math.round((scores.reduce((n, s) => n + s, 0) / scores.length) * 10) / 10,
          bestScore: Math.round(Math.max(...scores) * 10) / 10,
          lastAt: bucket.lastAt,
          lastBuyer: lastProfile ? (lookup.get(lastProfile)?.name ?? lastProfile) : null,
        };
      });
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));

    const order = (a: Standing, b: Standing) => {
      if (sort === "calls") return b.calls - a.calls || b.elo - a.elo;
      if (sort === "best") return (b.bestScore ?? 0) - (a.bestScore ?? 0) || b.elo - a.elo;
      if (sort === "recent") return b.lastAt - a.lastAt;
      if (sort === "avg") return (b.avgScore ?? 0) - (a.avgScore ?? 0) || b.elo - a.elo;
      return b.elo - a.elo || b.calls - a.calls;
    };
    rows.sort(order);

    const tapes = await db().execute({
      sql: `SELECT c.id, u.name AS rep, c.profile_id, c.overall, c.personality_json,
                   COALESCE(c.ended_at, c.started_at) AS at
            FROM calls c
            INNER JOIN users u ON u.id = c.user_id
            WHERE ${whereSql}
            ORDER BY COALESCE(c.ended_at, c.started_at) DESC
            LIMIT 40`,
      args,
    });

    return Response.json({
      range,
      sort,
      minCalls,
      pack,
      profile: profileId,
      q,
      rows: rows.map((r, i) => ({ rank: i + 1, ...r })),
      tapes: tapes.rows
        .filter((row) => !q || String(row.rep).toLowerCase().includes(q))
        .map((row) => {
          const pid = String(row.profile_id);
          const meta = lookup.get(pid);
          return {
            id: String(row.id),
            rep: String(row.rep),
            profileId: pid,
            buyer: meta?.name ?? pid,
            pack: meta?.packLabel ?? "",
            score: Number(row.overall),
            buyerElo: buyerElo(personalityFromUnknown(readJson(row.personality_json))),
            at: Number(row.at),
          };
        }),
      filters: filtersPayload(lookup),
    });
  } catch (err) {
    return asError(err);
  }
}

function filtersPayload(lookup: Map<string, { name: string; pack: string; packLabel: string; title: string }>) {
  const packs = new Map<string, { id: string; label: string }>();
  const profiles: { id: string; name: string; pack: string }[] = [];
  for (const [id, m] of lookup) {
    packs.set(m.pack, { id: m.pack, label: m.packLabel });
    profiles.push({ id, name: m.name, pack: m.pack });
  }
  return {
    packs: [...packs.values()].sort((a, b) => a.label.localeCompare(b.label)),
    profiles: profiles.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
