# Contributing

## Add a buyer (most common)

1. Copy `profiles/packs/manufacturers/_template.yaml` into the pack folder you want (`examples`, `manufacturers`, `contractors`, or a new pack).
2. Use a lowercase kebab-case `id`. `pack` must match `pack.yaml`.
3. Fill `repBrief` (what the seller is practicing) and `facts` / `vernacular` (what the buyer knows).
4. Run `pnpm test`. Start a call and hang up once.

Do not put secrets in YAML. Do not put your company’s product name in the buyer prompt unless the persona would actually know it.

## Add a pack

Create `profiles/packs/<id>/pack.yaml`:

```yaml
id: manufacturers
label: Manufacturers
description: Spec and factory buyers.
```

Empty packs are valid. They show up in the UI with a “add a YAML” hint.

## Code

- `packages/core` is the contract. UI and the LiveKit agent both import it.
- Keep buyer behavior in YAML + `buildBuyerInstructions`. Don’t special-case a persona in React.
- Personality knobs are `0–1`. Don’t add a new knob unless it changes the prompt and the roster sliders.
- `pnpm test` and `pnpm typecheck` before you send a PR.

## Product rules (calls)

The default scoring punishes “platform / AI / demo tour” and rewards one concrete job, their nouns, and a small next step. If you add a pack that is genuinely a product demo motion, override `scoring.rubric` and `bannedSellerPhrases` on those profiles instead of weakening the global rubric.
