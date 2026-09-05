# Open Sales Practice

Voice sales-call practice. Drop in a buyer YAML, talk to them, get a score, climb a leaderboard.

Same shape as the "talk to the partner" sims: a live conversation against a persona, then a graded tape. The repo is not tied to one company. Example buyers ship in `profiles/packs/examples`. Your motion goes in your own pack, or a private overlay.

## Quick start

```bash
pnpm install
node scripts/setup.mjs
# put OPENAI_API_KEY in apps/web/.env.local
# ELEVENLABS_API_KEY is optional and sounds better
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100). Pick **Riley Grant**, start a call, talk, hang up.

You need Node 20+ and pnpm 9.

## What you get

| Piece | Why it exists |
|---|---|
| YAML buyers | New persona = new file. No dashboard. |
| In-browser phone | Mock mode. You talk, an LLM buyer talks back, ElevenLabs (or OpenAI TTS) speaks. |
| LiveKit path | Optional. Real-time voice when you set `OSP_VOICE_MODE=voice`. |
| Debrief | Score, transcript, and the recording if clips were saved. |
| Leaderboard | Filter by window, pack, buyer. Click a recent tape to open it. |

Clerk is optional. `OSP_AUTH=none` is the local default.

## Profiles

```
profiles/packs/<pack-id>/pack.yaml
profiles/packs/<pack-id>/*.yaml
```

`profiles/private` is loaded automatically if it exists, and is gitignored. Keep company-specific seats there. `OSP_EXTRA_PROFILES` is a colon-separated list of extra roots if you want them somewhere else.

Read [docs/profiles.md](docs/profiles.md) before adding people.

## Database

Local default is SQLite (`DATABASE_URL=file:./data/osp.sqlite`). Schema is created on first request, or run:

```bash
pnpm db:migrate
```

Hosted Postgres (Supabase included) uses the same tables under schema `osp`:

```
DATABASE_URL=postgres://USER:PASS@HOST:5432/postgres?sslmode=require
DATABASE_ADMIN_URL=postgres://OWNER:PASS@HOST:5432/postgres?sslmode=require
OSP_DB_SCHEMA=osp
```

`DATABASE_ADMIN_URL` is only for migrate (create schema / grants). The app uses `DATABASE_URL`. If you skip admin, the app user needs `CREATE` on the database.

Audio clips sit in `call_clips`. Keep the blob small; this is practice audio, not a media CDN.

## Deploy

The web app is a Next.js server, not a static site. See [docs/deployment.md](docs/deployment.md).

Never commit `.env.local`. Keys live in the host's secret store.

## License

MIT. See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to send a pack or a patch.
