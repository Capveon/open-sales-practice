# Keys

Practice needs **OpenAI** for the buyer. Real-time voice is **LiveKit + OpenAI Realtime**. Mock mode (Whisper + chat + ElevenLabs) is only the fallback when LiveKit is unset.

Copy `.env.example` to `apps/web/.env.local`. Do not commit that file.

## Clerk

Required. Dedicated Clerk app. Development instance on your laptop, Production instance on the host.

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
OSP_ALLOWED_EMAIL_DOMAIN=yourcompany.com
```

Point Clerk allowed origins at the deploy host.

## OpenAI

| Key | Used for |
|---|---|
| `OPENAI_API_KEY` | Buyer lines, Whisper, optional scoring, TTS fallback, LiveKit Realtime |

Buyer model: `OPENAI_BUYER_MODEL` (default `gpt-4.1-mini`). Score: `OPENAI_SCORE_MODEL`. STT: `OPENAI_STT_MODEL` (default `whisper-1`).

## ElevenLabs

| Key | Used for |
|---|---|
| `ELEVENLABS_API_KEY` | Spoken buyer |

Profiles declare `cast.gender`, `cast.age`, `cast.region`. Seats live in `packages/core/src/voices.ts`. Override a seat with `ELEVENLABS_VOICE_MALE_MID_SOUTHWEST=…`.

## LiveKit

Required for `OSP_VOICE_MODE=voice`. See [deployment.md](deployment.md).

```
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
OSP_VOICE_MODE=voice
```

## Database

See the Database section in the README. SQLite locally. Postgres in prod. Schema `osp` on Postgres.
