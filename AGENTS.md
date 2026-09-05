# Agent notes

This repo is a small pnpm workspace: `packages/core`, `apps/web`, `apps/agent`.

- Buyer personas live in `profiles/packs/**/*.yaml`. Registering a profile is adding a file. The loader is `loadPacks()` in `packages/core/src/registry.ts`.
- Prompts are built in `buildBuyerInstructions`. Scoring is `heuristicScore` plus optional OpenAI in `apps/web/src/lib/score.ts`.
- Mock calls never need LiveKit. Voice calls need `OSP_VOICE_MODE=voice` and the agent process.
- Do not couple this app to a specific vendor brand. Example pack is `examples`. Company seats go in `profiles/private`.
- Theme tokens live in `apps/web/src/styles/tokens.css` (cold laboratory bench). Don’t introduce a second palette.
- Auth is Clerk. Local uses the Development instance. Production uses the Production instance.
