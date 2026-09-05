# Deployment

Web is Next.js. It needs a Node server (or a Workers adapter) and a database.

## What to set

Minimum for the in-browser phone:

- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY` (optional, better voice)
- `OSP_AUTH=none` or Clerk keys with `OSP_AUTH=clerk`
- `DATABASE_URL` (SQLite file, Turso/libsql, or Postgres)

Do not put keys in git. Use the host secret store.

## Database

SQLite is fine for a single box. Postgres is what you want once more than one process writes.

Schema name is `OSP_DB_SCHEMA` (default `osp` on Postgres). Tables: `users`, `calls`, `call_clips`.

```bash
DATABASE_URL=postgres://... DATABASE_ADMIN_URL=postgres://... pnpm db:migrate
```

On a shared Postgres box, keep `OSP_DB_SCHEMA=osp` so practice tables stay out of everyone else's schema. Grant the runtime role `SELECT, INSERT, UPDATE, DELETE` on that schema after migrate. The owner URL is only for `pnpm db:migrate`.

## Cloudflare

`apps/web` can ship as a Worker via OpenNext. From `apps/web`:

```bash
pnpm cf:build
pnpm cf:deploy
```

Set secrets with `wrangler secret put OPENAI_API_KEY` (and the rest). Bind a custom domain in the Cloudflare dashboard (`practice.example.com`).

Postgres on Workers: bind Hyperdrive (`HYPERDRIVE`) or set `DATABASE_URL` as a Worker secret. Hyperdrive should point at the Postgres **session** pooler (port 5432 on Supabase), not the transaction pooler. Caching should be off (`--caching-disabled`) because call rows change constantly.

```bash
wrangler hyperdrive create osp-prod --caching-disabled --connection-string="$DATABASE_URL"
```

Put the printed id into a private `apps/web/wrangler.capveon.jsonc` (gitignored) and deploy with `opennextjs-cloudflare deploy -c wrangler.capveon.jsonc`. If the Worker still cannot reach the DB, run the Next server on Fly/Railway and CNAME the hostname through Cloudflare instead.

Brand `NEXT_PUBLIC_*` at **build** time. Wrangler `vars` only cover runtime names like `OSP_APP_NAME`.

## Branding for a private deploy

```
OSP_APP_NAME=Your Co
NEXT_PUBLIC_OSP_APP_NAME=Your Co
NEXT_PUBLIC_OSP_PRODUCT=Practice
NEXT_PUBLIC_OSP_TAGLINE=...
NEXT_PUBLIC_OSP_MARK=arch
```

`arch` turns on the optional mark component. Leave it unset for the default square.

Company buyers go in `profiles/private` on the machine that builds, or `OSP_EXTRA_PROFILES`. They are not in the public repo.

## Clerk

Dedicated Clerk application. Allowlist the company domain. Set `OSP_ALLOWED_EMAIL_DOMAIN` as a second check.

## LiveKit

Only if `OSP_VOICE_MODE=voice`. Run `apps/agent` as a second process. Mock mode does not need it.
