# Agent notes

pnpm workspace: `packages/core`, `apps/web`, `apps/agent`.

- Personas: `profiles/packs/**/*.yaml`. Loader is `loadPacks()` in `packages/core/src/registry.ts`.
- Prompts: `buildBuyerInstructions`. Scoring: `heuristicScore` plus OpenAI in `apps/web/src/lib/score.ts`.
- Calls are LiveKit + OpenAI Realtime.
- Company seats go in `profiles/private`. Example pack is `examples`.
- Theme tokens: `apps/web/src/styles/tokens.css`.
- Auth is Clerk.
