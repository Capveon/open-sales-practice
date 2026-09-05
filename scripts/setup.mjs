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
console.log("next: set OPENAI_API_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, and CLERK_SECRET_KEY in apps/web/.env.local, then pnpm install && pnpm dev");
