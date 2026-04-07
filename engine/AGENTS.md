# Engine Guide

## Purpose

- `engine/` contains reusable runtime infrastructure and the `World` implementation.
- `World` is intentionally split by responsibility across several `world-*` files.

## World Split

- `world.js`: base `World` shell, floor/path storage, dungeon-path state, and shared normalization/access helpers such as `normalizePathId()`, `normalizeFloorIndex()`, and `getFloorGrid()`.
- `world-actors.js`: enemy/NPC collections, occupancy bookkeeping, indexed enemy lookup, and collection helpers like `getEnemyCollection()` / `getNpcCollection()`.
- `world-tile-state.js`: traps, hazards, items-on-tiles, environmental damage profiles, and collection helpers like `getFloorMap()` / `getFloorSet()`.
- `world-traversal.js`: stairs, water/pit movement, hazard transitions, and overworld return/selection signaling.
- `world-generation.js`: area generation, config-driven generator dispatch, special-room placement, weather generation, and post-layout decorators.

## Other Engine Files

- `utils.js`: generic math/grid helpers, normalization utilities, and cardinal-neighbor helpers.
- `random.js`: RNG helpers.
- `actor-helpers.js`: shared actor classification and display helpers.
- `pathfinding.js`: A* pathfinding with optional cost-based routing.
- `fov.js`: field-of-view and explored-state logic.
- `tileset.js`: sprite-sheet support.

## Editing Rules

- When changing `World`, edit the focused split file instead of pushing logic back into `world.js`.
- If code mutates traps, hazards, or items-on-tiles, prefer `world-tile-state.js`.
- If code changes actor occupancy or indexed movement bookkeeping, prefer `world-actors.js`.
- If code changes stairs, water, pits, or transition outcomes, prefer `world-traversal.js`.
- If code changes area construction or generation dispatch, prefer `world-generation.js`.
- Keep generic helpers outside the `World` prototype when they do not need world state.

## Load Order Notes

- `world.js` must load before every `world-*` extension file.
- `world-actors.js` and `world-tile-state.js` expose helpers used by later world extensions.

## Fast Orientation

- Start with `world.js` for the class shell and shared storage helpers.
- Read `world-generation.js` for map layout, area selection, dungeon shops, and weather issues.
- Read `world-traversal.js` for stair/water/pit transition bugs.
- Read `world-tile-state.js` for item placement, hazards, traps, and damage-profile issues.
- Read `world-actors.js` for occupancy, NPC placement, and enemy indexing problems.