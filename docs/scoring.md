# Scoring

Every hang-up writes `calls.overall` (0–100) and a JSON blob:

- `dimensions[]` — 0–10 each
- `outcome` — short phrase
- `coaching[]` — up to four next-time notes
- `method` — `heuristic` or `llm`

Global dimensions (always on): one job not a product, concrete questions, listening, small CTA, their nouns.

Profile YAML can add more under `scoring.rubric`.

The hangup route grades the **full merged tape** (browser captions + agent `session.history`) with OpenAI (`gpt-4.1-mini`) on the **web** host. That process needs `OPENAI_API_KEY` as well as the agent. On a missing key, empty tape, or model failure it falls back to the heuristic. Debrief still shows the transcript if the grade is late or fails; it retries `/api/calls/:id/score`.

## Elo

Each buyer is a chess bot. Easy / Typical / Hard-ass (and the sliders) map onto a **fixed bot Elo** (~1000 / ~1300 / ~1760). Everyone starts at 1200. After a scored call the seller's rating moves with the usual Elo formula (`K = 24`):

- the call grade 0–100 becomes a result (62 is a draw, earning a next step is a win, a dead call is a loss)
- a good tape against a hard-ass pays more than the same tape against an easy buyer
- bombing an easy buyer costs more than getting crushed by a hard-ass (you were supposed to)

The leaderboard **replays** those games in the selected window, so one lucky 95 cannot sit on top of three honest hard-ass calls. Default sort is Elo. `/leaderboard?range=today|3d|7d|14d|30d|all&sort=elo|avg|calls|best|recent&minCalls=1&pack=&profile=&q=`. Average / best / volume are still there. Recent tapes are the last 40 scored calls under the same filters.
