# Deployment

Web is Next.js (Workers via OpenNext). Voice is LiveKit + an agent process.

## Keys

See [keys.md](keys.md). Bake `NEXT_PUBLIC_*` at **build** time. Put secrets in the host secret store. Scoring runs on the web host, so `OPENAI_API_KEY` must be there as well as on the agent.

## Database

```bash
DATABASE_URL=postgres://... DATABASE_ADMIN_URL=postgres://... pnpm db:migrate
```

`OSP_DB_SCHEMA` defaults to `osp`. Grant the runtime role `SELECT, INSERT, UPDATE, DELETE` on that schema after migrate.

## Cloudflare

From `apps/web`:

```bash
pnpm cf:build
pnpm cf:deploy
```

Bind Hyperdrive for Postgres (session pooler, caching off). Branding `NEXT_PUBLIC_*` at build time.

Company buyers go in `profiles/private` on the machine that builds. `write-bundle.ts` snapshots packs into `packages/core/src/bundled-profiles.json` for the Worker and the agent image. Restore the committed empty `[]` file after deploy. Never commit a bundle that includes private YAML.

## Agent

From the repo root (Dockerfile context is the monorepo):

```bash
lk cloud auth
lk agent create --skip-sdk-check --region us-east
lk agent deploy --skip-sdk-check --region us-east
```

`--skip-sdk-check` is required because the root `package.json` is the workspace, not `@livekit/agents`. Keep `tsx` on PATH in the image (do not `pnpm prune --prod`).

`OPENAI_API_KEY` is an agent secret. LiveKit injects URL/key/secret at runtime. Do not put those in the image. Bundle profiles before deploy, then restore the committed empty file.

The worker registers as `open-sales-practice`. The web app dispatches that name into each room.
