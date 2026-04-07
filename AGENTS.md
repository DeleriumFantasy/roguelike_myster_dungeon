# Repo Guide

## Architecture

- This is a plain browser JavaScript game loaded by global script tags in `index.html`.
- There are no modules, imports, or bundlers; load order is part of the runtime contract.
- Most systems are split by responsibility with `Object.assign(Class.prototype, { ... })` extension files.
- Content is increasingly config-driven: enemy metadata, quest pools, floor events, area generation rules, progression tables, and input bindings live in `config/` and are consumed by runtime helpers.

## Main Runtime Objects

- `World`: floor storage, actor occupancy, tile state, traversal, and generation.
- `Player`: core state plus combat, inventory, and progression extensions.
- `Enemy`: core identity/state plus AI, combat, progression, and item-behavior extensions.
- `UI`: Pixi-only rendering, prompts/panels, inventory presentation, and shared DOM/render helpers.
- `Game`: orchestration, turn flow, content population, NPC interactions, item resolution, and undo snapshots.

## Folder Map

### `config/`
- Early-load constants, immutable config tables, and pure lookup helpers.
- Holds enemy definitions, generation/event tuning, combat/input rules, and shared accessors such as `get...Rule()` and `getInputBinding()`.

### `engine/`
- Reusable runtime infrastructure plus `World` behavior.
- Shared helpers include floor/grid access, actor collections, map/set tile-state access, path normalization, and traversal/generation plumbing.

### `entities/`
- Class shells and focused entity behavior splits.
- `combat-utils.js` is the shared home for mutable combat/equipment helpers such as damage mitigation, equipped-item iteration, cursed checks, and equippable-type checks.

### `ui/`
- Presentation only; gameplay mutation should stay elsewhere.
- Pixi is the only renderer. `ui.js` owns shared DOM lookup, render-context helpers, visibility/weather formatting, and scene refresh plumbing.

### `game/`
- High-level orchestration built on `Game.prototype` extensions.
- Includes the undo system, config-driven content orchestration, shared access helpers (`getPlayerAllies()`, `getPlayerInventoryItems()`, `forEachWorldFloor()`), and turn-resolution flows.

## Load Order Rules

- Keep `index.html` in sync whenever adding or moving split files.
- Base class files must load before their extension files.
- Shared helpers must load before any file that calls them.
- Current important assumptions:
  - `world.js` before all `world-*` files
  - `item.js` before `item-data.js` and `item-factories.js`
  - `player.js` before player extension files
  - `enemy.js` before enemy extension files
  - Pixi CDN, then `ui-pixi-overlay.js`, `ui-pixi-sprites.js`, `ui-pixi-render-state.js`, `ui-pixi-layers.js`, `ui-pixi-actors.js`, `ui-pixi-effects.js`, then `ui.js`, `ui-panels.js`, and `ui-inventory.js`
  - `game.js` before the rest of `game/`, with `game-explore.js` loading last

## Editing Rules

- Prefer changing the focused split file instead of growing base shells.
- Put pure data/config in `config/`, not runtime mutation.
- Put shared world-state helpers in `engine/`, not in unrelated `game/` files.
- Put shared entity combat/equipment helpers in `entities/combat-utils.js`.
- Put shared orchestration selection/access helpers in `game/game-content-utils.js`.
- Put shared UI DOM/render helpers in `ui/ui.js`.
- Keep UI messaging separate from gameplay mutation whenever possible.

## Practical Conventions

- Preserve the global naming style already used by the repo.
- Keep file header comments accurate when responsibilities change.
- Prefer behavior-preserving refactors unless a gameplay change is explicitly requested.
- Validate after structural or load-order changes because script dependency mistakes fail at runtime.

## Local Guides

- Each major folder has its own `AGENTS.md` with narrower placement rules.
- Read the folder-specific guide before making structural edits in `config/`, `engine/`, `entities/`, `game/`, or `ui/`.

## Fast Orientation

- Start at `index.html` to confirm load order.
- For config/editability work: read `config/generation-constants.js`, `config/enemy-definitions.js`, and the helper readers in `config/rules.js`.
- For world/runtime bugs: check `engine/world.js`, `engine/world-actors.js`, `engine/world-tile-state.js`, `engine/world-traversal.js`, and `engine/world-generation.js`.
- For entity behavior: check `entities/player-combat.js`, `entities/player-inventory.js`, `entities/enemy-ai.js`, `entities/enemy-combat.js`, and `entities/combat-utils.js`.
- For NPC/quest/shop flow: check `game/game-npc-interactions.js`, `game/game-content.js`, `game/game-enemy-content.js`, and `game/game-inventory-actions.js`.
- For undo/input/turn flow: check `game/game.js`, `game/game-input.js`, `game/game-player-turns.js`, and `game/game-enemy-turns.js`.
- For UI/rendering: check `ui/ui.js`, `ui/ui-panels.js`, `ui/ui-inventory.js`, and the `ui-pixi-*` files.