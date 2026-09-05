# Scoring

Every hang-up writes `calls.overall` (0–100) and a JSON blob:

- `dimensions[]` — 0–10 each
- `outcome` — short phrase
- `coaching[]` — up to four next-time notes
- `method` — `heuristic` or `llm`

Global dimensions (always on): one job not a product, concrete questions, listening, small CTA, their nouns.

Profile YAML can add more under `scoring.rubric`.

The web app grades the transcript with OpenAI. On failure it falls back to the heuristic.

Leaderboard: `/leaderboard?range=today|3d|7d|14d|30d|all&sort=avg|calls|best|recent&minCalls=1&pack=&profile=&q=`. Only scored calls in the window count. Average is the arithmetic mean of `overall`. Recent tapes are the last 40 scored calls under the same filters.
