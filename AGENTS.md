# Agent notes

pnpm workspace: `packages/core`, `apps/web`, `apps/agent`.

- Personas: `profiles/packs/**/*.yaml`. Loader is `loadPacks()` in `packages/core/src/registry.ts`.
- Prompts: `buildBuyerInstructions`. Buyer hangup is LiveKit `end_call` (`deleteRoom`).
- Scoring: `heuristicScore` plus OpenAI in `apps/web/src/lib/score.ts`, on the hangup request, from the merged tape (`lk.transcription` + `osp.transcript`).
- Calls are LiveKit + OpenAI Realtime (`semantic_vad`, captions unsynced so the tape is complete sentences).
- Company seats go in `profiles/private`. Example pack is `examples`.
- Theme tokens: `apps/web/src/styles/tokens.css`.
- Auth is Clerk.
