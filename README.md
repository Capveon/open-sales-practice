# Open Sales Practice

A real phone call against a buyer you wrote in YAML. They interrupt you, they hang up, and you get a score.

Not a chatbot with a microphone. LiveKit WebRTC + OpenAI Realtime. The tape is the source of truth. The leaderboard is Elo against the buyer, like a chess bot.

**[Live demo](https://practice.capveon.ai)** · MIT · Node 20, pnpm 9

You should have a working call on localhost in about ten minutes: pick Marcus, talk, get graded.

## What you get

| | |
|---|---|
| **YAML buyers** | New persona = new file. Opening, vernacular, hangup rules, extra rubric. |
| **Live call** | Browser mic → LiveKit room → buyer agent (`gpt-realtime`). They can end the call. |
| **Tape** | Captions plus the agent’s session history, merged into one transcript. |
| **Debrief** | Score 0–100, coaching notes, the whole conversation. |
| **Leaderboard** | Elo vs Easy / Typical / Hard-ass (~1000 / ~1300 / ~1760). Everyone starts at 1200. |

Three example seats ship in `profiles/packs/examples/` (Riley, Priya, Marcus). Put company buyers in `profiles/private` — gitignored.

## Requirements

You need **four accounts**. None of them are optional for a live call.

| Need | What it is for | Get it |
|---|---|---|
| **Node 20+** and **pnpm 9** | Run the repo | [nodejs.org](https://nodejs.org), `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| **Clerk** | Sign-in. Local = Development instance. Prod = Production instance. | [dashboard.clerk.com](https://dashboard.clerk.com) → create an application |
| **OpenAI** | The buyer’s voice (`gpt-realtime`) and the grade (`gpt-4.1-mini`) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **LiveKit Cloud** | The phone. WebRTC room + agent dispatch | [cloud.livekit.io](https://cloud.livekit.io) → create a **project** |

Realtime audio is billed by OpenAI. LiveKit Cloud has a free tier that is enough to try this.

### Clerk

1. Create an application. Use the **Development** keys on your laptop.
2. Paths this app already uses: `/sign-in`, `/sign-up`. Add `http://localhost:3100` as an allowed origin.
3. Copy **Publishable key** and **Secret key** into `.env.local`.

### OpenAI

1. Create an API key.
2. The key must be allowed to call **`gpt-realtime`** (the conversation) and **`gpt-4.1-mini`** (scoring). If Realtime is not enabled on the account, the room connects and the buyer never speaks.

### LiveKit Cloud

This is the piece people miss. The web app does **not** run the buyer. A separate **agent worker** joins the room when you dial.

1. Sign in at [cloud.livekit.io](https://cloud.livekit.io) and create a project.
2. **Settings → Keys.** Copy:
   - **WebSocket URL** (`wss://….livekit.cloud`) → `LIVEKIT_URL`
   - **API Key** → `LIVEKIT_API_KEY`
   - **API Secret** → `LIVEKIT_API_SECRET`
3. Same three values go on the web app **and** the agent (one `.env.local` is enough locally; the agent reads `apps/web/.env.local`).
4. Keep the agent process running while you call (`pnpm dev:agent` below). If it is not running, you get a quiet room.

The worker registers as `open-sales-practice`. Do not rename it unless you change `AGENT_NAME` in `packages/core/src/settings.ts`.

Production is the same project with `lk agent deploy` so you are not running the worker on a laptop. Details in [docs/deployment.md](docs/deployment.md).

## Run it

Two processes. Web is the handset. Agent is the buyer.

```bash
git clone https://github.com/Capveon/open-sales-practice.git
cd open-sales-practice
corepack enable
pnpm install
pnpm setup
```

`pnpm setup` copies `.env.example` → `apps/web/.env.local` if that file is missing. Fill every blank.

```bash
# terminal 1 — buyer worker (must stay up)
pnpm dev:agent

# terminal 2 — app
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100). Sign in, pick **Marcus Webb**, **Typical**, start the call, talk, wait until he hangs up, **Score the call**.

| Command | What it does |
|---|---|
| `pnpm setup` | Create `apps/web/.env.local` from the example |
| `pnpm db:migrate` | SQLite schema (default `DATABASE_URL=file:./data/osp.sqlite`) |
| `pnpm dev:agent` | LiveKit agent in `dev` (joins rooms from your Cloud project) |
| `pnpm dev` | Next.js on port **3100** |
| `pnpm dev:all` | Both (logs mixed; two terminals are easier) |
| `pnpm test` | Core tests (profiles, Elo, tape merge) |

`OPENAI_API_KEY` is required on **both** sides: the agent speaks, the web app grades on hangup.

## If the call is broken

| What you see | Likely cause |
|---|---|
| Roster error / “Server error” | `.env.local` missing, or Clerk keys wrong |
| Start call → 503 about LiveKit | `LIVEKIT_URL` / key / secret not set on the **web** app |
| Room connects, nobody talks | **Agent is not running**, or `OPENAI_API_KEY` missing on the agent, or the key cannot use `gpt-realtime` |
| Agent logs “unknown agent” / never joins | Agent and web are on **different LiveKit projects**, or `AGENT_NAME` does not match (`open-sales-practice`) |
| Hangup, no score | `OPENAI_API_KEY` missing on the **web** app (falls back to a heuristic; check debrief `method`) |
| Clerk loop on localhost | Development keys, and `http://localhost:3100` allowed in the Clerk app |

The agent must stay running for the whole call. `pnpm dev:agent` is not a one-shot.

## Add a buyer

```
profiles/packs/<pack-id>/pack.yaml
profiles/packs/<pack-id>/<buyer-id>.yaml
```

Minimal pack:

```yaml
id: my-motion
label: My motion
description: Who these people are.
```

Minimal buyer (see `profiles/packs/manufacturers/_template.yaml` and [docs/profiles.md](docs/profiles.md)):

```yaml
id: jane-ops
pack: my-motion
name: Jane Ortiz
title: Superintendent
organization: Mid-size water utility
summary: Owns CIP. Hates software pitches.
repBrief: Earn a follow-up on one job. Do not demo a platform.
opening: busy
personality:
  warmth: 0.4
  patience: 0.3
  skepticism: 0.7
  verbosity: 0.35
  hostility: 0.2
  timePressure: 0.75
vernacular: [CIP, work order, plant]
firstLine: "You've got a minute."
hangupRules:
  - If they pitch a platform, hang up.
```

Restart `pnpm dev` (and the agent, if it cached packs). Company-only YAML goes in `profiles/private/packs/…` — loaded automatically, not committed.

Sliders on the roster (Easy / Typical / Hard-ass) override `personality` for that dial and set the **bot Elo** the leaderboard uses.

## How a call is wired

```
browser  --WebRTC-->  LiveKit room  <--agent--  OpenAI Realtime
   |
   +-- HTTP --> Next.js (Clerk, hangup, score, leaderboard)
                    |
                    +-- YAML packs + prompts + rubric (@osp/core)
```

1. You start a call. Next mints a LiveKit token and asks LiveKit to dispatch agent `open-sales-practice` into the room, with the buyer id in metadata.
2. The agent process (laptop or `lk agent deploy`) joins, loads that YAML, speaks the first line.
3. Captions land on the handset. The agent also publishes `session.history` so scoring does not depend on catching every partial.
4. The buyer can hang up (`end_call`, room deleted). You **Score the call** — that is not hanging up a phone.

More in [docs/architecture.md](docs/architecture.md) and [docs/scoring.md](docs/scoring.md).

## Deploy

**Web** is Next.js on Node (`next start`, or the Docker image in `apps/web/Dockerfile`). SQLite is local-only; production wants Postgres (`DATABASE_URL`, schema `osp`, then `pnpm db:migrate`). Bake `NEXT_PUBLIC_*` at **build** time. Put `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, and the three LiveKit values in the host secret store.

**Agent** is a LiveKit Cloud worker, not a sidecar on the web box:

```bash
lk cloud auth
lk agent create --skip-sdk-check --region us-east
lk agent deploy --skip-sdk-check --region us-east
```

`--skip-sdk-check` is required: the repo root is a pnpm workspace, not `@livekit/agents`. Set `OPENAI_API_KEY` as an **agent secret** in LiveKit. LiveKit injects URL / key / secret at runtime — do not bake those into the image.

The deployed worker must still register as `open-sales-practice`.

Full checklist: [docs/deployment.md](docs/deployment.md). [docs/keys.md](docs/keys.md) is the env reference.

## Repo map

```
apps/web          Next.js — roster, handset, debrief, leaderboard, scoring
apps/agent        LiveKit agent — the buyer
packages/core     YAML load, prompts, Elo, tape merge
profiles/packs    Public personas
profiles/private  Gitignored overlay
```

## Docs

| | |
|---|---|
| [docs/keys.md](docs/keys.md) | Every env var |
| [docs/profiles.md](docs/profiles.md) | Pack + buyer YAML |
| [docs/architecture.md](docs/architecture.md) | Tape, hangup, data |
| [docs/scoring.md](docs/scoring.md) | Rubric and Elo |
| [docs/deployment.md](docs/deployment.md) | Node, Postgres, LiveKit Cloud agent |

## License

[MIT](LICENSE)
