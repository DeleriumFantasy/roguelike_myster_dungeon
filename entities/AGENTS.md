# Entities Guide

## Purpose

- `entities/` contains the class shells plus focused prototype extensions for player, enemy, and item behavior.
- Runtime behavior is intentionally split by responsibility rather than kept in monolithic class files.

## Player Split

- `player.js`: base player shell and core movement/environment state.
- `player-combat.js`: attacks, damage, statuses, and combat-side helpers.
- `player-inventory.js`: equipment, inventory, throwable handling, and ally equipment helpers.
- `player-progression.js`: EXP, leveling, and progression helpers.

## Enemy Split

- `enemy.js`: base enemy shell and core identity/type helpers.
- `enemy-item-behaviors.js`: carried items, thief/vandal/fuser logic, item-side enemy behavior.
- `enemy-ai.js`: perception, targeting, movement, and turn decisions.
- `enemy-progression.js`: ally progression and tier helpers.
- `enemy-combat.js`: attacks, damage, status application, and line-of-sight combat helpers.

## Item Split

- `item.js`: base item shell.
- `item-data.js`: item definitions, item metadata helpers, and shared item logic.
- `item-factories.js`: item creation and transformation helpers.

## Editing Rules

- Keep entity state initialization in the base shell file.
- Move behavior to the focused extension file instead of growing the shell again.
- If a helper is specific to one enemy archetype's item behavior, prefer `enemy-item-behaviors.js` over `enemy-ai.js`.
- If logic is about choosing actions, it belongs in `enemy-ai.js`; if it is about resolving hits or damage, it belongs in `enemy-combat.js`.
- If logic is about inventory/equipment mutation, it belongs in `player-inventory.js`.

## Common Mistakes

- Do not add UI messaging here.
- Do not move game orchestration decisions here when they belong in `game/`.
- Avoid wrapper methods that only rename a single helper call unless they are actively improving call-site clarity.