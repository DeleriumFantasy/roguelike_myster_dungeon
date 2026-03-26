# Repo Guide

## Architecture

- This project is a plain browser JavaScript game loaded through global script tags in `index.html`.
- It does not use ES modules, bundlers, or imports/exports.
- Script load order is part of the architecture. A file can depend on globals defined by earlier scripts.
- Most larger systems are split by extending prototypes with `Object.assign(Class.prototype, { ... })` in focused files.

## Main Runtime Objects

- `World`: floor state, actor occupancy, tile state, traversal, and generation.
- `Player`: base player state, then combat, inventory, and progression helpers in separate files.
- `Enemy`: base enemy state, then item behavior, AI, progression, and combat helpers in separate files.
- `UI`: base UI object, then rendering, panels, inventory, and map helpers in separate files.
- `Game`: bootstrap and turn flow, then content, combat, NPC, item, and turn-resolution helpers in separate files.

## Folder Map

### `config/`

- Shared constants, rule helpers, enemy definitions, generation constants, and combat/input rules.
- These files are loaded first and are expected to define globals used everywhere else.

### `engine/`

- Generic engine helpers and the world runtime.
- `world.js`: core `World` class shell and generic floor/tile helpers.
- `world-actors.js`: enemy collection, occupancy helpers, and occupancy indexing.
- `world-tile-state.js`: trap state, hazard state, item placement, and item spawn helpers.
- `world-traversal.js`: hazard transitions, water crossing, and landing logic.
- `world-generation.js`: floor generation and area layout helpers.

### `entities/`

- Class shells plus responsibility-based prototype extensions.
- `player.js`: base player shell.
- `player-combat.js`: damage, attacks, conditions.
- `player-inventory.js`: equipment, inventory, throwables, ally item handling.
- `player-progression.js`: level and EXP handling.
- `enemy.js`: base enemy shell and core type helpers.
- `enemy-item-behaviors.js`: thief, vandal, fuser, carried-item logic.
- `enemy-ai.js`: perception, target choice, movement, turn AI.
- `enemy-progression.js`: ally progression and tier helpers.
- `enemy-combat.js`: attacks, damage, line of sight.
- `item.js`: base item shell.
- `item-data.js`: item definitions and shared item helpers.
- `item-factories.js`: item creation and transformation helpers.

### `ui/`

- Rendering and UI-specific logic only.
- `ui.js`: base UI shell.
- `ui-rendering.js`: main scene rendering and camera logic.
- `ui-panels.js`: stats panel and message log helpers.
- `ui-inventory.js`: inventory modal helpers.
- `ui-map.js`: map overlay helpers.

### `game/`

- High-level orchestration built on `Game.prototype` extensions.
- `game.js`: game bootstrap and main loop.
- `game-input.js`: browser keyboard input and held-move orchestration.
- `game-turn-results.js`: shared structured turn-result factories.
- `game-content.js`: setup and floor population flow.
- `game-content-utils.js`: shared content-selection helpers such as weighted rolls.
- `game-content-registry.js`: content-registry helpers for enemy templates and weighted item entry selection.
- `game-enemy-content.js`: enemy spawn tables, enemy creation, promotion.
- `game-item-generation.js`: item spawn counts, random item generation, starter loadout, premade item placement.
- `game-item-state.js`: throw resolution, pickup/drop mutation, defeat drop state changes.
- `game-item-interactions.js`: item-related announcements and coordination helpers.
- `game-player-turns.js`: player turn resolution.
- `game-enemy-turns.js`: enemy turn resolution, defeat handling, EXP.
- `game-combat-helpers.js`: shared combat helpers used across turn files.
- `game-npc-interactions.js`: NPC, shop, and bank interactions.

## Load Order Rules

- Keep `index.html` in sync whenever adding a new split file.
- Base class files must load before their prototype extension files.
- Shared helper files must load before any extension that calls them.
- Current important order assumptions:
  - `world.js` before `world-actors.js`, `world-tile-state.js`, `world-traversal.js`, and `world-generation.js`
  - `item.js` before `item-data.js` and `item-factories.js`
  - `player.js` before player extension files
  - `enemy.js` before enemy extension files
  - `game-input.js` and `game-turn-results.js` after `game.js` and before turn-processing files
  - `game-content-utils.js` and `game-content-registry.js` before `game-enemy-content.js` and `game-item-generation.js`
  - `game-item-state.js` before `game-item-interactions.js`

## Editing Rules

- Prefer changing the focused extension file for a behavior instead of adding unrelated methods back into a base file.
- If a helper is shared across enemy and item content, place it in `game-content-utils.js` instead of a domain-specific file.
- If a helper represents shared content-registry lookup or content construction setup, place it in `game-content-registry.js`.
- If code mutates world tile state, it probably belongs in `engine/world-tile-state.js`.
- If code changes how actors move through the world, it probably belongs in `engine/world-traversal.js`.
- If code changes indexed enemy occupancy or enemy movement bookkeeping, it probably belongs in `engine/world-actors.js`.
- If code only announces UI messages and does not change state, keep it out of state files.
- Avoid reintroducing wrapper methods that only forward to another helper unless they carry naming value used by multiple call sites.

## Practical Conventions

- File header comments describe each file's intended responsibility. Keep them accurate when responsibilities change.
- Preserve the global naming style used by the repo.
- Keep refactors behavior-preserving unless a gameplay change is explicitly requested.
- Validate after script-order or split changes because global-script dependency mistakes fail at runtime.

## Local Guides

- Each major folder also has its own `AGENTS.md` with narrower placement rules and faster orientation.
- After opening a file in `config/`, `engine/`, `entities/`, `game/`, or `ui/`, read that folder's local guide before making structural edits.

## Fast Orientation

- Start at `index.html` to understand dependency order.
- Read the base class file first, then its prototype extension files.
- For item issues: check `game-item-generation.js`, `game-item-state.js`, `game-item-interactions.js`, then item entity files.
- For enemy behavior issues: check `enemy-ai.js`, `enemy-item-behaviors.js`, `enemy-combat.js`, then `game-enemy-turns.js`.
- For map or rendering issues: check `ui-rendering.js`, `ui-map.js`, and `engine/fov.js`.
- For floor spawning issues: check `game-content.js`, `game-enemy-content.js`, `game-item-generation.js`, and `engine/world-generation.js`.