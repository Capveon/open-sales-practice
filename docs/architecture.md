# Architecture

```
browser  --WebRTC-->  LiveKit room  <--agent--  OpenAI Realtime
   |                       ^
   |                       | room metadata: profileId + personality
   +-- HTTP --> Next.js (Clerk, hangup, score, leaderboard)
                    |
                    +-- @osp/core (YAML profiles, prompts, rubric)
```

Voice mode is LiveKit + OpenAI Realtime. The browser publishes mic audio and subscribes to the buyer; live captions arrive on the `lk.transcription` text stream. Typed lines go to the agent on `lk.chat`.

Mock mode is the fallback when LiveKit keys are missing: one utterance at a time through Whisper and chat completions. Do not use it for the hosted practice product.

## Why LiveKit (not a raw websocket)

The YC-style practice tools are live voice with interruption. LiveKit Agents + OpenAI Realtime is the current low-latency path: WebRTC to the browser, Realtime API on the agent, barge-in handled for you. Pipecat is a fine alternative if you want Python pipelines; the profile layer here does not care.

## Extensibility

| Want | Where |
|---|---|
| New buyer | `profiles/packs/<pack>/*.yaml` |
| New motion (manufacturers, …) | new folder + `pack.yaml` |
| New personality knob | `PersonalitySchema` + sliders + prompt prose |
| New score dimension | global rubric in `scoring.ts` or `scoring.rubric` on the profile |
| New transport | keep `buildBuyerInstructions`; swap `apps/agent` |

## Data

SQLite locally (`DATABASE_URL=file:./data/osp.sqlite`). Postgres in production (`OSP_DB_SCHEMA=osp`). Tables: `users`, `calls`, `call_clips`.

Leaderboard only counts `status = scored`. Filter by rolling window (today / 3 / 7 / 14 / 30 days / all), pack, buyer, and minimum call count. Recent tapes link to the debrief (transcript, score, recording).
