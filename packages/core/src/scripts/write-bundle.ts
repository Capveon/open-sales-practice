import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPacks } from "../registry";

const here = dirname(fileURLToPath(import.meta.url));
const packs = loadPacks().map(({ pack, profiles }) => ({ pack, profiles }));
writeFileSync(join(here, "../bundled-profiles.json"), `${JSON.stringify(packs, null, 2)}\n`);
console.log(`bundled ${packs.reduce((n, p) => n + p.profiles.length, 0)} profiles in ${packs.length} packs`);
