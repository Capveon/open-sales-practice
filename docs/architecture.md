# Architecture

```
browser  --WebRTC-->  LiveKit room  <--agent--  OpenAI Realtime
   |
   +-- HTTP --> Next.js (Clerk, hangup, score, leaderboard)
                    |
                    +-- @osp/core (YAML profiles, prompts, rubric)
```

The browser publishes the mic and plays the buyer. Live captions arrive on `lk.transcription`. Typed lines go on `lk.chat`.

## Extensibility

| Want | Where |
|---|---|
| New buyer | `profiles/packs/<pack>/*.yaml` |
| New motion | new folder + `pack.yaml` |
| New personality knob | `PersonalitySchema` + sliders + prompt prose |
| New score dimension | `scoring.ts` or `scoring.rubric` on the profile |

## Data

SQLite locally. Postgres in production (`OSP_DB_SCHEMA=osp`). Tables: `users`, `calls`, `call_clips`.
