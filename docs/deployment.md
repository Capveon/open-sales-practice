# Deployment

Web is Next.js on Node (Capveon: ECS Fargate behind the same ALB as `app.capveon.ai`). Voice is LiveKit + an agent process.

## Keys

See [keys.md](keys.md). Bake `NEXT_PUBLIC_*` at **build** time. Put secrets in the host secret store. Scoring runs on the web host, so `OPENAI_API_KEY` must be there as well as on the agent.

## Database

```bash
DATABASE_URL=postgres://... DATABASE_ADMIN_URL=postgres://... pnpm db:migrate
```

`OSP_DB_SCHEMA` defaults to `osp`. Grant the runtime role `SELECT, INSERT, UPDATE, DELETE` on that schema after migrate.

## Capveon production (AWS)

Same account and cluster as the monorepo (`capveon-prod`). Terraform in `../monorepo/infra/terraform` owns the `practice` ECR repo, ECS service, ALB host rule, and ACM cert. Secrets live in `capveon/prod/app/practice` (not the operator-glass bundle — different Clerk app).

Build on a machine that has `profiles/private`, then roll:

```bash
# once: populate the secret, then
chmod +x scripts/deploy-aws.sh
AWS_PROFILE=capveon ./scripts/deploy-aws.sh
```

`practice.capveon.ai` is a Cloudflare CNAME to the Capveon ALB, proxied, SSL Full (strict) — same as `app.capveon.ai`.

Company buyers go in `profiles/private` on the machine that builds. `write-bundle.ts` snapshots packs into `packages/core/src/bundled-profiles.json` inside the image. Restore the committed empty `[]` file if you ran the script on the host. Never commit a bundle that includes private YAML.

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
