# Profiles

A **pack** is a folder. A **profile** is a YAML file in that folder (except `pack.yaml` and files starting with `_`).

```
profiles/packs/examples/pack.yaml
profiles/packs/examples/riley-plant.yaml
profiles/packs/manufacturers/pack.yaml          # empty motion, valid
profiles/packs/manufacturers/_template.yaml     # ignored (underscore)
profiles/packs/contractors/pack.yaml
profiles/private/packs/<your-pack>/             # gitignored overlay
```

## pack.yaml

```yaml
id: examples
label: Example buyers
description: Shown on the roster.
```

## Profile fields

| Field | Point |
|---|---|
| `id` | kebab-case, unique across loaded roots |
| `pack` | must equal the pack id |
| `name` / `title` / `organization` | handset |
| `summary` | roster card |
| `repBrief` | seller only, before they dial |
| `cast` | `gender`, `age`, `region`. Maps onto a shared voice bank. |
| `voice` | optional OpenAI Realtime voice override |
| `opening` | `engaged` \| `busy` \| `skeptical` \| `hostile` \| `wrong-book` |
| `personality` | `warmth`, `patience`, `skepticism`, `verbosity`, `hostility`, `timePressure` (0–1) |
| `attributes` | free-form facts |
| `vernacular` | nouns the buyer expects |
| `bannedSellerPhrases` | extra junk that should annoy them |
| `facts` | what they know |
| `hangupRules` | when they end it |
| `firstLine` | Attitude of the pickup, not a script |
| `scoring.rubric` | extra dimensions for this persona |

Override personality on the roster (Easy / Typical / Hard-ass) without editing YAML.

## Private overlay

`profiles/private` loads automatically. `OSP_EXTRA_PROFILES` adds more roots (`:`-separated). Later roots win on id collision.
