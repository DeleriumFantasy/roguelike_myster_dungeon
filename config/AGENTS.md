# Config Guide

## Purpose

- `config/` holds shared constants, immutable tables, and pure lookup helpers used across the runtime.
- Keep this folder side-effect free: prefer data tables plus small readers over stateful logic.

## File Roles

- `constants.js`: core enums plus frozen rule tables. Use `deepFreezeConfig()` for long-lived config objects.
- `rules.js`: read-only accessors such as `getConditionRule()`, `getHazardDefinition()`, and tile/traversal helpers.
- `terrain-constants.js`: terrain visuals, autotiling tables, and `getVisualConfigEntry()` helpers.
- `input-constants.js`: key bindings, inventory action maps, and `getInputBinding()`.
- `generation-constants.js`: area generation rules, quest pools, floor-event tuning, dungeon path definitions, world-event progression, and config access helpers.
- `enemy-definitions.js`: enemy family definitions, metadata, spawn/drop tuning, and template builders.
- `combat-rules.js`: pure combat math, attack variance, and EXP progression readers.

## Editing Rules

- Put reusable data and pure lookups here, not runtime mutation.
- If a helper needs `this`, it probably belongs outside `config/`.
- Prefer `get...Rule`, `get...Definition`, `get...Config`, and `..._RULES` naming.
- When adding a new table, also add or reuse a small reader/helper instead of scattering direct property access in runtime files.

## Placement Hints

- Add new enemy/NPC template metadata to `enemy-definitions.js`.
- Keep quest pools, floor-event tuning, dungeon-path unlock chains, and area runtime generation rules in `generation-constants.js`.
- Keep shared interpretation helpers centralized in `rules.js` or the owning config file.
- Add new static key bindings to `input-constants.js`, not to input handling code directly.

## Common Mistakes

- Do not move behavior here just because it references constants.
- Do not hardcode progression or event tuning in runtime files when a config table can express it.
- Do not duplicate rule readers in `game/`, `engine/`, or `entities/`.
- Keep these files early-load safe because many later scripts depend on their globals.