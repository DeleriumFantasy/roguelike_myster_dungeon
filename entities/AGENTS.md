# Entities Guide

## Purpose

- `entities/` contains the class shells plus focused prototype extensions for player, enemy, and item behavior.
- Keep behavior split by responsibility instead of growing monolithic class files.
- `combat-utils.js` is the shared home for mutable combat/equipment helpers used by both player and enemy code.

## Shared Helpers

- `combat-utils.js` now centralizes helpers such as:
  - `applyDamageToActor()` / `applyStandardAttackToTarget()`
  - `getActorConditionKeys()` / `getMitigatedDamageAmount()`
  - equipped-item iteration and aggregation helpers
  - `getItemCursedState()` and `isEquippableItemType()`
- Reuse these instead of duplicating cursed/equipment or damage-mitigation logic in individual entity files.

## Player Split

- `player.js`: base player shell and core movement/environment state.
- `player-combat.js`: attacks, damage, condition handling, and equipment combat bonuses.
- `player-inventory.js`: equipment, inventory mutation, throwable stacking, ally equipment, and carry-capacity helpers (`maxInventoryItems` defaults to 30).
- `player-progression.js`: EXP and leveling.

## Enemy Split

- `enemy.js`: base identity/state, including metadata such as `templateId`, `familyId`, `tier`, `npcRole`, `spawnContexts`, and `persistentNpc`.
- `enemy-item-behaviors.js`: thief/vandal/fuser carried-item logic.
- `enemy-ai.js`: perception, target choice, pathfinding, lethal-tile avoidance, and passive escort behavior.
- `enemy-progression.js`: ally leveling and equipment mutation for allies.
- `enemy-combat.js`: attacks, damage, status application, and line-of-sight helpers.

## Item Split

- `item.js`: base item shell and shared item behavior.
- `item-data.js`: item definitions, stable item metadata, shop pricing helpers, and pot/shop helper factories.
- `item-factories.js`: item creation, transformations, and world enchant/curse rolls.

## Editing Rules

- Keep entity state initialization in the base shell file.
- Move behavior to the focused extension file instead of re-growing the shell.
- If logic is about choosing actions, it belongs in `enemy-ai.js`; if it resolves hits/damage, it belongs in `enemy-combat.js`.
- If logic is about inventory/equipment mutation or stack handling, it belongs in `player-inventory.js`.
- If a helper is shared across player/enemy equipment or combat, put it in `combat-utils.js`.
- Keep movement-order orchestration in `game/game-player-turns.js`; keep raw movement/hazard hooks in `player.js`.

## Pathfinding Notes

- `findPath` uses A* with edge costs: cost `1` for safe tiles and cost `50` for hostile tiles.
- Enemies prefer safe routes but can still route through water/lava/spike tiles as a fallback to avoid getting stuck.

## Item Notes

- `item.js` display names summarize enchantments by count (`[N enchantments]`).
- Shop pricing metadata lives on the item definitions in `item-data.js`.
- World enchant rolls are handled in `item-factories.js` with stacked 5% checks, limited by available slots.