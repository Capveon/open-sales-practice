# Open Sales Practice

Voice sales-call practice. Drop in a buyer YAML, talk to them, get a score, climb a leaderboard.

```bash
pnpm install
node scripts/setup.mjs
# fill apps/web/.env.local
pnpm --filter @osp/agent dev
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100). Pick a buyer, start a call, talk, hang up.

You need Node 20+, pnpm 9, Clerk, OpenAI, and LiveKit.

## What you get

| Piece | Why it exists |
|---|---|
| YAML buyers | New persona = new file. |
| Live phone | LiveKit WebRTC + OpenAI Realtime. Captions as you speak. |
| Agent | `apps/agent`. Deploy with `lk agent deploy`. |
| Debrief | Score and transcript. |
| Leaderboard | Filter tapes. Click one to open it. |

Clerk is required. Local uses a Development instance. Production uses Production.

## Profiles

```
profiles/packs/<pack-id>/pack.yaml
profiles/packs/<pack-id>/*.yaml
```

`profiles/private` is loaded if it exists, and is gitignored. `OSP_EXTRA_PROFILES` is extra roots, colon-separated.

See [docs/profiles.md](docs/profiles.md).

## Database

Local default is SQLite (`DATABASE_URL=file:./data/osp.sqlite`):

```bash
pnpm db:migrate
```

Postgres uses schema `osp`. See [docs/deployment.md](docs/deployment.md).

## License

MIT.
