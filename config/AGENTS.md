# Config Guide

## Purpose

- `config/` holds shared constants, immutable tables, and pure lookup helpers used across the runtime.
- Keep this folder side-effect free: prefer data tables plus small readers over stateful logic.

## File Roles

- `constants.js`: core enums plus frozen rule tables. Use `deepFreezeConfig()` for long-lived config objects.
- `rules.js`: read-only accessors such as `getConditionRule()`, `getHazardDefinition()`, and tile/traversal helpers.
- `terrain-constants.js`: terrain visuals, shared situation maps, terrain-family registries, variant-count tables, and `getVisualConfigEntry()` helpers.
- `input-constants.js`: key bindings, inventory action maps, and `getInputBinding()`.
- `generation-constants.js`: area generation rules, quest pools, floor-event tuning, dungeon path definitions, world-event progression, and config access helpers.
- `enemy-definitions.js`: enemy family definitions, metadata, spawn/drop tuning, and template builders.
- `combat-rules.js`: pure combat math, attack variance, and EXP progression readers.

## Editing Rules

- Put reusable data and pure lookups here, not runtime mutation.
- If a helper needs `this`, it probably belongs outside `config/`.
- Prefer `get...Rule`, `get...Definition`, `get...Config`, and `..._RULES` naming.
- When adding a new table, also add or reuse a small reader/helper instead of scattering direct property access in runtime files.
- For terrain work, keep family metadata declarative: add or edit sheet families, per-family variant counts, and selection order in `terrain-constants.js` before touching `engine/tileset.js`.
- Keep shared situation layouts centralized; do not duplicate identical wall/ground connectivity maps per family unless the art layout truly diverges.
- Prefer small, deterministic helpers in config files rather than complex hashing logic. If a helper becomes stateful or heavy, move it to an engine/runtime file instead.

## Placement Hints

- Add new enemy/NPC template metadata to `enemy-definitions.js`.
- Keep quest pools, floor-event tuning, dungeon-path unlock chains, and area runtime generation rules in `generation-constants.js`.
- Keep shared interpretation helpers centralized in `rules.js` or the owning config file.
- Add new static key bindings to `input-constants.js`, not to input handling code directly.
- Add new terrain sheet families, asset paths, and family ordering to `terrain-constants.js`.
- If a terrain helper only reads config and returns a derived key/sprite, it still belongs in `terrain-constants.js`; if it manages image loading or render rectangles, keep it in `engine/tileset.js`.

## Common Mistakes

- Do not move behavior here just because it references constants.
- Do not hardcode progression or event tuning in runtime files when a config table can express it.
- Do not duplicate rule readers in `game/`, `engine/`, or `entities/`.
- Keep these files early-load safe because many later scripts depend on their globals.
- Do not reintroduce one-off terrain sheet constants when the family registry can express the same data.
- Do not duplicate wall and ground variant-count tables when they intentionally share the same layout and differ only by family data.