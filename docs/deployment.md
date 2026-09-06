# Deployment

Two runtimes: **Next.js on Node** (handset, Clerk, score) and a **LiveKit agent process** (the buyer). They share a LiveKit Cloud project. They do not have to share a machine.

## Web

`apps/web` is a normal Next app (`next build` / `next start`, port 3000 in the Docker image, 3100 in `pnpm dev`).

Bake `NEXT_PUBLIC_*` at **build** time. Runtime secrets:

- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY` (grading)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `DATABASE_URL`

Image: `apps/web/Dockerfile` (linux/arm64 standalone). It snapshots YAML via `write-bundle.ts` so production does not need the `profiles/` tree on disk. Never commit a non-empty `packages/core/src/bundled-profiles.json` if it contains private packs — restore `[]` after a local bundle.

Health: `GET /api/health` (no auth). Point a load balancer there.

## Database

Local: SQLite, `DATABASE_URL=file:./data/osp.sqlite`, then `pnpm db:migrate`.

Postgres:

```bash
DATABASE_URL=postgres://... DATABASE_ADMIN_URL=postgres://... pnpm db:migrate
```

Schema defaults to `osp` (`OSP_DB_SCHEMA`). After migrate, grant the runtime role `SELECT, INSERT, UPDATE, DELETE` on that schema. Set `OSP_SKIP_MIGRATE=1` on the running app if CI/CD already migrated.

## Agent

From the **repo root**. Dockerfile context is this repo (`Dockerfile` at the root is the agent). `--skip-sdk-check` is required because root `package.json` is the workspace, not `@livekit/agents`.

```bash
lk cloud auth
lk agent create --skip-sdk-check --region us-east
lk agent deploy --skip-sdk-check --region us-east
```

Keep `tsx` on PATH in the image (do not `pnpm prune --prod`).

`OPENAI_API_KEY` is an **agent secret** in LiveKit. LiveKit injects URL/key/secret at runtime. Do not put those in the image.

Bundle private YAML before deploy if the agent should speak those buyers, then restore the committed empty bundle file.

The worker must register as `open-sales-practice`. The web app dispatches that name into each room.

## Capveon production

Same AWS account and cluster as the product monorepo (`capveon-prod`). Terraform there owns ECR `practice`, the ECS service, the ALB host rule, and the ACM cert. Secrets: `capveon/prod/app/practice` (not the operator-glass bundle — different Clerk app).

Build on a machine that has `profiles/private`:

```bash
AWS_PROFILE=capveon ./scripts/deploy-aws.sh
```

`practice.capveon.ai` is a Cloudflare CNAME to that ALB, proxied, SSL Full (strict).
