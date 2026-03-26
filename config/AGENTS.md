# Config Guide

## Purpose

- `config/` defines shared constants and pure rule helpers used across the runtime.
- These files should stay side-effect free. Prefer data tables and small pure functions over stateful logic.

## File Roles

- `constants.js`: core enums, status rules, tile rules, and shared constant tables.
- `rules.js`: read-only helpers for interpreting condition, hazard, and traversal rule tables.
- `terrain-constants.js`: tile visuals, autotiling helpers, and terrain lookups.
- `input-constants.js`: key bindings and input interpretation helpers.
- `generation-constants.js`: area generation rules and generation data.
- `enemy-definitions.js`: enemy templates and spawn-related enemy metadata.
- `combat-rules.js`: shared combat math and EXP progression helpers.

## Editing Rules

- Put reusable data and pure lookups here, not runtime state mutation.
- Avoid importing game logic concepts into config helpers unless the helper is still purely interpretive.
- If a function needs `this`, it probably does not belong in `config/`.
- Keep naming table-driven. Prefer `get...Rule`, `get...Definition`, and `..._RULES` patterns.

## Placement Hints

- Add new enemy template data to `enemy-definitions.js`.
- Add new rule-table readers to `rules.js`.
- Add new static visual mappings to `terrain-constants.js`.
- Add new key binding interpretation to `input-constants.js`.

## Common Mistakes

- Do not move runtime behavior here just because it uses constants.
- Do not create duplicate rule readers in runtime files when `rules.js` can expose them once.
- Keep these files early-load safe because many later scripts assume their globals already exist.