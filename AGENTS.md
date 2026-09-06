# Agent notes

Setup for humans: [README.md](README.md). pnpm workspace: `packages/core`, `apps/web`, `apps/agent`.

- Personas: `profiles/packs/**/*.yaml`. Loader is `loadPacks()` in `packages/core/src/registry.ts`.
- Prompts: `buildBuyerInstructions`. Buyer hangup is LiveKit `end_call` (`deleteRoom`). The handset shows a status line and a Score button; it does not hang up for the seller.
- Scoring: `heuristicScore` plus OpenAI in `apps/web/src/lib/score.ts`. Leaderboard default is Elo (`packages/core/src/elo.ts`) against the buyer's bot rating.
- Calls are LiveKit + OpenAI Realtime (`semantic_vad`, captions unsynced so the tape is complete sentences).
- Company seats go in `profiles/private`. Example pack is `examples`.
- Theme tokens: `apps/web/src/styles/tokens.css`.
- Auth is Clerk.
