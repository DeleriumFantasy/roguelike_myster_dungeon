# Engine Guide

## Purpose

- `engine/` holds reusable runtime infrastructure and `World` behavior.
- The `World` system is split by responsibility across multiple prototype extension files.

## World Split

- `world.js`: base `World` shell, floor access, generic tile lookup, and generic random tile helpers.
- `world-actors.js`: enemy collection, occupancy checks, indexed enemy lookup, and indexed enemy movement helpers.
- `world-tile-state.js`: traps, hazards, item placement, and item spawn helpers.
- `world-traversal.js`: stair transitions, hazard transitions, water crossing, and landing rules.
- `world-generation.js`: floor generation, layout, and area building.

## Other Engine Files

- `random.js`: RNG helpers.
- `utils.js`: generic math/grid helpers.
- `actor-helpers.js`: actor classification and shared label/direction helpers.
- `pathfinding.js`: pathfinding and safe-tile search.
- `fov.js`: field-of-view and explored-state logic.
- `tileset.js`: sprite-sheet and tile rendering support.

## Editing Rules

- When changing `World`, edit the focused split file instead of pushing logic back into `world.js`.
- If code mutates traps, hazards, items-on-tiles, or tile occupancy state, prefer `world-tile-state.js`.
- If code changes how actors move through hazards, water, or stairs, prefer `world-traversal.js`.
- If code changes enemy lookup or occupancy rules, prefer `world-actors.js`.
- If code moves indexed enemies already on the current floor, prefer `world.moveEnemy(...)` over direct `enemy.x/enemy.y` mutation.
- Keep generic utilities outside the `World` prototype when they do not need world state.

## Load Order Notes

- `world.js` must load before all `world-*` extension files.
- `world-actors.js` and `world-tile-state.js` provide helpers used by later world extensions.

## Fast Orientation

- Start with `world.js` for the class shell.
- Read `world-generation.js` for map structure bugs.
- Read `world-traversal.js` for movement and environmental transition bugs.
- Read `world-tile-state.js` for drop, trap, hazard, and item placement bugs.