#!/usr/bin/env node
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const example = join(root, ".env.example");
const dest = join(root, "apps/web/.env.local");
if (!existsSync(dest)) {
  copyFileSync(example, dest);
  console.log("wrote apps/web/.env.local from .env.example");
} else {
  console.log("apps/web/.env.local already exists");
}
console.log("next: fill Clerk, OpenAI, and LiveKit in apps/web/.env.local");
console.log("      then: pnpm db:migrate   # once");
console.log("            pnpm dev:agent    # terminal 1 — leave running");
console.log("            pnpm dev          # terminal 2 — http://localhost:3100");
