# AGENTS.md

Guidance for AI agents working in this repository.

## Project overview

A static, dependency-free site (vanilla HTML/CSS/JS, no build system, no `package.json`) for browsing **World Conqueror 4 Elite Force** unit data. Unit stats live in JSON files under `data/`; the app reads an auto-generated index (`data/units.json`) to populate the unit dropdown.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | Main EF Database page (unit search, level slider, stats display) |
| `script.js` | All front-end logic: manifest fetch, unit fetch/cache, level switching, rendering |
| `style.css` | All styling |
| `docs.html` | Static docs page |
| `data/<type>/<Unit Name>.json` | Unit data, one file per unit, grouped by unit type |
| `data/units.json` | **Generated** manifest: `[{ id, name, type }]` sorted by name — never edit by hand |
| `generate-manifest.js` | Scans `data/*` subfolders and regenerates `data/units.json` |
| `admin.html`, `admin.js`, `admin-server.js` | Local-only admin tooling, **gitignored**, never committed |
| `whats-new.txt` | Changelog entries shown in the "What's New?" panel |
| `.github/workflows/update-units.yml` | Regenerates + commits the manifest on every push to `main` |

## Unit types

Unit JSONs live in `data/<type>/` where `<type>` is one of: `infantry`, `artillery`, `navy`, `armored`, `airforce`. This list is hard-coded in `script.js:4` and `admin-server.js:14` — keep the two in sync if it changes.

## Unit JSON schema

One file per unit, named `<Display Name>.json` (spaces allowed). Fields:

- `name` — display name (must match the filename stem)
- `unit_type` — e.g. `"Infantry"`, `"armor"` (not strictly enforced; used for display)
- `levels` — array of 1–12 level objects, each with:
  - `level` — 1..12
  - `cost` — object of currency → amount. Known currencies: `pieces` (Frags), `money`, `industry`, `technology`, `honorInfantryBadges`, `honorArmoredBadges`. Omit unused currencies. Level 1 always costs `{ "pieces": 30 }`; levels 10–12 cost pieces + honor badges
  - `stats` — `attack`, `defense`, `movement`, `hp`, `range` (all numbers)
  - `skills` — array of `{ title, tier, description }`. Tier is one of `"bronze"`, `"silver"`, `"gold"`, `"platinum"`, or `null` (uncategorized, e.g. Iron Breaker). Skills accumulate: each level's list includes everything from prior levels
  - `note` — string, or the literal `"null"` when there is no note. Upgrade/unlock notes use newline-separated lines like `"Upgrade Emergency Rescue To silver\nUnlock Militia\n"`

Formatting: 2-space indent, trailing newline, JSON only (no comments).

## Workflow: adding/editing a unit

1. Add or edit the JSON at `data/<type>/<Name>.json`
2. Regenerate the manifest: `node generate-manifest.js` (also runs automatically on push via the GitHub workflow, and after every save in the local admin server)
3. Do **not** hand-edit `data/units.json` — it is derived
4. Optionally add a dated entry at the top of `whats-new.txt`

## Local admin tooling (not in the repo)

Run `node admin-server.js` (port 8125, opens `admin.html`). It serves the site and exposes `POST /api/save` (writes a unit file + regenerates manifest), `GET /api/units`, and `GET /api/units/:type/:id`. These files are intentionally gitignored.

## Conventions & gotchas

- No frameworks, no linters, no tests — keep it that way; match existing style
- `script.js` auto-discovers units from the manifest; no registration needed when adding units
- Skill tiers and the cost/stat keys are consumed by `script.js` (see `STAT_META` / `COST_META`) — keep key names stable
- Keep JSON valid: `generate-manifest.js` skips (with a warning) files that fail to parse, but the unit silently won't appear
- `whats-new.txt` entries: date line followed by blank line and summary text