# Engine Guide

## Purpose

- `engine/` holds reusable runtime infrastructure and `World` behavior.
- The `World` system is split by responsibility across multiple prototype extension files.

## World Split

	Overworld stairs-down now signal `{ requiresDungeonSelection: true }` so `game/` can open the UI modal and apply the chosen descent path.
- `world.js`: base `World` shell, floor access, per-path floor storage, dungeon path unlock/completion tracking, generic tile lookup, and generic random tile helpers.
- `world-actors.js`: enemy and NPC collections, occupancy checks, indexed enemy lookup, and indexed enemy movement helpers. NPCs are stored separately from hostile enemies. `getActorAt` checks both collections. `getHostileEnemies()` returns alive non-ally enemies; `getFriendlyActors()` returns alive allies plus alive NPCs.
- `world-tile-state.js`: traps, hazards, item placement, item spawn helpers, and environmental damage profile lookups (`getEnvironmentalDamageProfile`).
- `world-traversal.js`: stair transitions, hazard transitions, water crossing, and landing rules. Player stair transitions are typically triggered via `player.checkHazards(...)` after move orchestration in `game/game-player-turns.js`.
	Overworld stairs-down now signal `{ requiresDungeonSelection: true }` so `game/` can open the UI modal and apply the chosen descent path.
	Max-depth stairs-down spawn the player at the center of the overworld (GRID_SIZE/2, GRID_SIZE/2) and signal `{ returnedToOverworldFromPathEnd: true, completedPathId }` for completion handling.
- `world-generation.js`: floor generation, layout, area building, premade special-room placement (including dungeon shops), and weather generation. Each floor generates with a chance for special weather (foggy weather reduces FOV) via `generateWeatherForFloor()`.

## Other Engine Files

- `random.js`: RNG helpers.
- `utils.js`: generic math/grid helpers.
- `actor-helpers.js`: actor classification and shared label/direction helpers.
- `pathfinding.js`: A* pathfinding with MinHeap priority queue. Supports `edgeCostFn` for cost-based routing (e.g., cost 1 for safe tiles, cost 50 for hostile tiles).
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
- Read `world-generation.js` for map structure bugs, premade-room placement issues, and dungeon shop spawn behavior.
- Read `world-traversal.js` for movement and environmental transition bugs.
- Read `world-tile-state.js` for drop, trap, hazard, and item placement bugs.
- Read `world-actors.js` for occupancy, NPC placement, and any shopkeeper teleport/movement bookkeeping issues.