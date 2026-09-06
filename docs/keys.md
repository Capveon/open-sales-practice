# Keys

One file locally: `apps/web/.env.local`. `pnpm setup` copies [`.env.example`](../.env.example) there if it is missing. The agent also loads that path, then `apps/agent/.env.local` if you need overrides. Do not commit either file.

| Variable | Where | What |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Web, **build time** | Clerk publishable key. Development instance on the laptop, Production instance in prod. |
| `CLERK_SECRET_KEY` | Web, runtime | Matching secret. |
| `OPENAI_API_KEY` | Web **and** agent | Buyer voice (`gpt-realtime`) on the agent. Grade (`gpt-4.1-mini`) on the web host at hangup. |
| `LIVEKIT_URL` | Web (and local agent) | `wss://<project>.livekit.cloud` from LiveKit Cloud → Settings → Keys. |
| `LIVEKIT_API_KEY` | Web (and local agent) | Same page. |
| `LIVEKIT_API_SECRET` | Web (and local agent) | Same page. |
| `DATABASE_URL` | Web | Default `file:./data/osp.sqlite`. Prod: `postgres://…`. |
| `DATABASE_ADMIN_URL` | Migrate only | Owner URL if the runtime role cannot `CREATE`. |
| `OSP_DB_SCHEMA` | Web, Postgres | Default `osp`. |
| `OSP_PROFILES_DIR` | Optional | Extra profiles root. `profiles/private` loads by itself. |
| `OSP_EXTRA_PROFILES` | Optional | More roots, `:`-separated. Later roots win on id. |
| `OSP_SKIP_MIGRATE` | Prod | `1` if you migrate out of band. |
| `OSP_ALLOWED_EMAIL_DOMAIN` | Optional | Restrict sign-in to `@that.domain`. |

`NEXT_PUBLIC_*` is inlined at `next build`. Changing Clerk’s publishable key in a secret store does nothing until you rebuild.

## Clerk

[dashboard.clerk.com](https://dashboard.clerk.com) — new application.

- Laptop: **Development** keys.
- Production: a **Production** instance, allowed origins = your public origin.

Routes already in the app: `/sign-in`, `/sign-up`. Local origin: `http://localhost:3100`.

## OpenAI

[platform.openai.com/api-keys](https://platform.openai.com/api-keys).

The same key (or two keys, if you split them) must reach:

1. The **agent** — Realtime session, model `gpt-realtime`.
2. The **web** process — hangup grade, model `gpt-4.1-mini`.

If Realtime is not enabled, the LiveKit room comes up and the buyer never speaks. If the web key is missing, scoring falls back to the heuristic (`method: heuristic` on the debrief).

## LiveKit Cloud

[cloud.livekit.io](https://cloud.livekit.io) — one **project**.

Settings → Keys gives `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Put those on the web app. Locally the agent reads the same `.env.local`. On LiveKit Cloud Agents, LiveKit injects URL/key/secret; you only set `OPENAI_API_KEY` as an agent secret.

The worker name is `open-sales-practice` (`AGENT_NAME` in `packages/core/src/settings.ts`). Web dispatch and the running worker must use that same name, on the **same** project.

Local: `pnpm dev:agent` and leave it running. Prod: `lk agent deploy --skip-sdk-check` from the repo root (see [deployment.md](deployment.md)).
