# Entities Guide

## Purpose

- `entities/` contains the class shells plus focused prototype extensions for player, enemy, and item behavior.
- Runtime behavior is intentionally split by responsibility rather than kept in monolithic class files.
- `combat-utils.js` provides shared mutable combat application helpers (`applyDamageToActor`, `applyStandardAttackToTarget`) used by player/enemy combat extensions.

## Player Split

- `player.js`: base player shell and core movement/environment state. Supports deferred hazard application on move (`applyHazards: false`) for turn-order-sensitive flows.
- `player-combat.js`: attacks, damage, statuses, and combat-side helpers.
- `player-inventory.js`: equipment, inventory, throwable handling, and ally equipment helpers (including equipping onto allies and returning replaced ally gear to player inventory).
- `player-progression.js`: EXP, leveling, and progression helpers.

## Enemy Split

- `enemy.js`: base enemy shell, core identity/type helpers, and per-enemy state used by AI and quest systems.
- `enemy-item-behaviors.js`: carried items, thief/vandal/fuser logic, item-side enemy behavior.
- `enemy-ai.js`: perception, targeting, movement (including A* pathfinding with cost-based routing around hostile tiles), turn decisions, passive escort behavior, lethal tile avoidance (`isLethalEnvironmentalPosition`, `tryMoveOffLethalTile`), and NPC occupancy blocking. Enemy AI reads tile/hazard damage profiles from `world.getEnvironmentalDamageProfile(...)`.
- `enemy-progression.js`: ally progression and tier helpers.
- `enemy-combat.js`: attacks, damage, status application, and line-of-sight combat helpers.
 Defeated allies are stalled with handler and restored to full health on retrieval.

## Item Split

- `item.js`: base item shell.
- `item-data.js`: item definitions, item metadata helpers, and shared item logic.
- `item-factories.js`: item creation and transformation helpers, including world enchant/curse roll behavior.

## Editing Rules

- Keep entity state initialization in the base shell file.
- Move behavior to the focused extension file instead of growing the shell again.
- If a helper is specific to one enemy archetype's item behavior, prefer `enemy-item-behaviors.js` over `enemy-ai.js`.
- If logic is about choosing actions, it belongs in `enemy-ai.js`; if it is about resolving hits or damage, it belongs in `enemy-combat.js`.
- If logic is about inventory/equipment mutation, it belongs in `player-inventory.js`.
- If a behavior depends on move ordering vs hazards/stairs, place move-order orchestration in `game/game-player-turns.js` and keep raw move/hazard hooks in `player.js`.
- Passive quest escort movement and flee logic belongs in `enemy-ai.js`; escort state flags belong in `enemy.js`.
- Pathfinding and movement cost logic belongs in `enemy-ai.js`; world-level movement validation belongs in `engine/world-actors.js`.

## Pathfinding Notes

- `findPath` uses A* with edge costs: cost 1 for safe tiles, cost 50 for hostile tiles (water/lava/spike).
- Enemies strongly prefer dry routes but can cross hostile terrain as a last resort to avoid getting stuck.
- `canTraverseTileForPathfinding` allows walls/pits as hard blocks; water/lava/spike tiles as passable paths.
- `canCrossHostileTileForPath` is a permissive check used to validate executing A* path steps onto hostile tiles.

## Item Notes

- `item.js` display names summarize enchantments by count (`[N enchantments]`) instead of listing every enchantment name.
- World spawn enchant rolls are handled in `item-factories.js` with three independent 5% checks (stacking by successes, slot-limited).