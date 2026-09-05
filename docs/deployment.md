# Deployment

Web is Next.js (Workers via OpenNext). Voice is LiveKit + an agent process.

## Keys

See [keys.md](keys.md). Bake `NEXT_PUBLIC_*` at **build** time. Put secrets in the host secret store.

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

Company buyers go in `profiles/private` on the machine that builds.

## Agent

From the repo root (Dockerfile context is the monorepo):

```bash
lk cloud auth
lk agent create --skip-sdk-check --region us-east
lk agent deploy --skip-sdk-check --region us-east
```

`OPENAI_API_KEY` is an agent secret. LiveKit injects URL/key/secret at runtime. Do not put those in the image. Bundle profiles into `packages/core/src/bundled-profiles.json` before deploy, then restore the committed empty file.
