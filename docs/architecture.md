# Architecture

```
browser  --WebRTC-->  LiveKit room  <--agent--  OpenAI Realtime
   |
   +-- HTTP --> Next.js (Clerk, hangup, score, leaderboard)
                    |
                    +-- @osp/core (YAML profiles, prompts, rubric)
```

Two processes. The browser publishes the mic and plays the buyer. The agent is an OpenAI Realtime session (`gpt-realtime`, semantic VAD) that LiveKit dispatches into the room by name **`open-sales-practice`**. Next.js never speaks.

Local: `pnpm dev` (web, :3100) + `pnpm dev:agent` (worker). Production web is Node (Capveon: ECS Fargate). Production agent is LiveKit Cloud (`lk agent deploy`).

## Tape

Two streams, merged by the web app:

1. Live captions on `lk.transcription`. Each utterance has a `lk.segment_id`. Interims update that segment in place; growing STT prefixes collapse into one turn.
2. The agent's `session.history`, published on `osp.transcript` whenever a conversation item is committed. Hangup and shutdown send the same snapshot so scoring does not depend on the browser catching every caption.

Hangup merges both sides into `calls.transcript_json`, then grades that tape when the seller scores.

## Call end

The buyer calls LiveKit's `end_call` tool (`deleteRoom: true`, ignored during the opening line). The room drop freezes the handset: a status line on the tape (`{name} ended the call`) and a **Score the call** button. The seller is not hanging up a phone — they score. Scoring POSTs `/api/calls/:id/end` and opens debrief.

## Extensibility

| Want | Where |
|---|---|
| New buyer | `profiles/packs/<pack>/*.yaml` |
| New motion | new folder + `pack.yaml` |
| New personality knob | `PersonalitySchema` + sliders + prompt prose |
| New score dimension | `scoring.ts` or `scoring.rubric` on the profile |

## Data

SQLite locally. Postgres in production (`OSP_DB_SCHEMA=osp`). Tables: `users`, `calls`, `call_clips`.
