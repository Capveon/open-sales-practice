import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { PackSchema, ProfileSchema, type Pack, type Profile } from "./schema";

export interface LoadedPack {
  pack: Pack;
  dir: string;
  profiles: Profile[];
}

function walkForProfilesRoot(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "profiles", "packs");
    if (existsSync(candidate)) return join(dir, "profiles");
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function resolveProfilesRoot(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.OSP_PROFILES_DIR,
    join(process.cwd(), "profiles"),
    join(process.cwd(), "../../profiles"),
    join(process.cwd(), "../profiles"),
  ].filter((v): v is string => Boolean(v));

  for (const c of candidates) {
    const resolved = resolve(c);
    if (existsSync(join(resolved, "packs"))) return resolved;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const found = walkForProfilesRoot(here) ?? walkForProfilesRoot(process.cwd());
  if (!found) {
    throw new Error(
      "Could not find profiles/packs. Set OSP_PROFILES_DIR or run from the repo root.",
    );
  }
  return found;
}

/** Public packs plus optional private/extra roots (colon-separated OSP_EXTRA_PROFILES). */
export function resolveProfileRoots(explicit?: string): string[] {
  const primary = resolveProfilesRoot(explicit);
  const seen = new Set<string>([primary]);
  const roots = [primary];
  const add = (raw?: string) => {
    if (!raw) return;
    const resolved = resolve(raw);
    if (seen.has(resolved)) return;
    if (!existsSync(join(resolved, "packs"))) return;
    seen.add(resolved);
    roots.push(resolved);
  };
  add(join(primary, "private"));
  for (const piece of (process.env.OSP_EXTRA_PROFILES ?? "").split(":")) {
    add(piece.trim());
  }
  return roots;
}

function loadYamlFile(path: string): unknown {
  return parseYaml(readFileSync(path, "utf8"));
}

function loadPacksFromRoot(root: string): LoadedPack[] {
  const packsDir = join(root, "packs");
  if (!existsSync(packsDir)) return [];
  const packs: LoadedPack[] = [];
  for (const entry of readdirSync(packsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) {
      continue;
    }
    const dir = join(packsDir, entry.name);
    const packFile = join(dir, "pack.yaml");
    if (!existsSync(packFile)) continue;
    const pack = PackSchema.parse(loadYamlFile(packFile));
    const profiles: Profile[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      if (file === "pack.yaml" || file.startsWith("_")) continue;
      const parsed = ProfileSchema.parse(loadYamlFile(join(dir, file)));
      if (parsed.pack !== pack.id) {
        throw new Error(
          `Profile ${parsed.id} in ${file} has pack "${parsed.pack}" but folder pack is "${pack.id}"`,
        );
      }
      profiles.push(parsed);
    }
    profiles.sort((a, b) => a.name.localeCompare(b.name));
    packs.push({ pack, dir, profiles });
  }
  return packs;
}

export function loadPacks(root?: string): LoadedPack[] {
  const roots = root ? [resolveProfilesRoot(root)] : resolveProfileRoots();
  const byId = new Map<string, LoadedPack>();
  for (const r of roots) {
    for (const loaded of loadPacksFromRoot(r)) {
      const existing = byId.get(loaded.pack.id);
      if (!existing) {
        byId.set(loaded.pack.id, loaded);
        continue;
      }
      const profiles = [...existing.profiles];
      for (const p of loaded.profiles) {
        const i = profiles.findIndex((x) => x.id === p.id);
        if (i >= 0) profiles[i] = p;
        else profiles.push(p);
      }
      profiles.sort((a, b) => a.name.localeCompare(b.name));
      byId.set(loaded.pack.id, { ...existing, profiles });
    }
  }
  const packs = [...byId.values()];
  packs.sort((a, b) => {
    const filled = Number(b.profiles.length > 0) - Number(a.profiles.length > 0);
    if (filled !== 0) return filled;
    return a.pack.label.localeCompare(b.pack.label);
  });
  return packs;
}

export function loadAllProfiles(root?: string): Profile[] {
  return loadPacks(root).flatMap((p) => p.profiles);
}

export function getProfile(id: string, root?: string): Profile {
  const found = loadAllProfiles(root).find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile: ${id}`);
  return found;
}

export function listPackSummaries(root?: string) {
  return loadPacks(root).map(({ pack, profiles }) => ({
    ...pack,
    profileCount: profiles.length,
  }));
}
