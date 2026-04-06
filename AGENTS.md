# Repo Guide

## Architecture

- This project is a plain browser JavaScript game loaded through global script tags in `index.html`.
- It does not use ES modules, bundlers, or imports/exports.
- Script load order is part of the architecture. A file can depend on globals defined by earlier scripts.
- Most larger systems are split by extending prototypes with `Object.assign(Class.prototype, { ... })` in focused files.

## Main Runtime Objects

- `World`: floor state, actor occupancy (enemies and NPCs separated), tile state, traversal, and generation.
- `Player`: base player state, then combat, inventory, and progression helpers in separate files.
- `Enemy`: base enemy state, then item behavior, AI, progression, and combat helpers in separate files. Hostile enemies only (NPCs are a separate type).
- `UI`: base UI object, then rendering, panels, and inventory helpers in separate files.
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
- `world-generation.js`: floor generation and area layout helpers.

### `entities/`

 // All canvas-specific helpers and fallback rendering have been removed. Only PixiJS is supported.
- `player.js`: base player shell.
- `combat-utils.js`: shared combat application helpers that mutate actor state (`applyDamageToActor`, `applyStandardAttackToTarget`).
- `player-combat.js`: damage, attacks, conditions.
- `player-inventory.js`: equipment, inventory, throwables, ally item handling, and carried-capacity helpers (the player's equipped gear counts toward the same configurable carry limit; default 30 via `maxInventoryItems`).
- `player-progression.js`: level and EXP handling.
- `enemy.js`: base enemy shell, core type helpers, and persistent enemy-side state flags.
- `enemy-item-behaviors.js`: thief, vandal, fuser, and carried-item logic.
- `enemy-ai.js`: perception, target choice, movement, turn AI, and passive escort behavior.
- `enemy-progression.js`: ally progression and tier helpers.
- `enemy-combat.js`: attacks, damage, line of sight.
- `item.js`: base item shell.
- `item-data.js`: item definitions, shop pricing metadata, shared item helpers, and helper factories for shop-capable/pot item definitions.
- `item-factories.js`: item creation and transformation helpers, including world enchant/curse rolls.

### `ui/`

- Rendering and UI-specific logic only.
- `ui.js`: base UI shell, shared DOM/canvas setup, shared scene/view helpers (camera bounds, visibility predicates, display name/item/trap helpers), camera targeting, and scene-mode switching.
- `ui-pixi-overlay.js`: PixiJS orchestrator (~210 lines), manages Pixi app and layer hierarchy.
- `ui-pixi-sprites.js`: Procedural actor sprite generation (~220 lines).
- `ui-pixi-layers.js`: Terrain, items, shop markers, depth, shadows rendering (~220 lines).
- `ui-pixi-actors.js`: Actor sprites with glows, health bars, labels (~130 lines).
- `ui-pixi-effects.js`: Combat effects and event banners (~150 lines).
- `ui-panels.js`: stats, message, settings, shop prompt helpers, and shared focus-restoration helpers for native prompts/modals.
- `ui-inventory.js`: inventory modal helpers, including managed prompt/outcome helpers, inventory entry builders, and the live `Inventory [count/max]` title.

### `game/`

- High-level orchestration built on `Game.prototype` extensions.
- `game.js`: game bootstrap and main loop, including config-driven dungeon-path completion unlock flow and overworld progression announcements.
- `game-input.js`: browser keyboard input, held-move orchestration, and centralized overlay close/focus restoration.
- `game-turn-results.js`: shared structured turn-result factories.
- `game-content.js`: setup and floor population flow, including floor event lifecycle and dungeon shop population.
- `game-content-utils.js`: shared content-selection helpers such as weighted rolls.
- `game-content-registry.js`: content-registry helpers for enemy templates and weighted item entry selection.
- `game-enemy-content.js`: enemy spawn tables, family-balancing curves, enemy creation, promotion, and overworld NPC roster placement, including config-driven second-questgiver availability.
- `game-inventory-actions.js`: inventory action resolution, including shared target builders, inventory-use subhelpers, pot storage messaging, inventory-cap handling, and shop sale staging when items are dropped on shop tiles.
- `game-item-generation.js`: floor-banded item spawn counts, floor-scaled tier weighting, random item generation, starter loadout, premade item placement.
- `game-item-state.js`: throw resolution, pickup/drop mutation, defeat drop state changes.
- `game-item-interactions.js`: item-related announcements and coordination helpers.
- `game-player-turns.js`: player turn resolution, shop pickup confirmation, and unpaid-item exit interception.
- `game-enemy-turns.js`: enemy turn resolution, defeat handling, EXP.
- `game-explore.js`: auto-explore tick loop, sticky target tracking, forced-detour breakout logic, no-progress watchdog, cheater mode, and descent logic wired to `game.settings`.
- `game-combat-helpers.js`: shared combat helpers used across turn files.
- `game-npc-interactions.js`: NPC interaction flow (merchant, banker, questgiver, handler, escort tasks, and shopkeeper buy/sell settlement).

## Load Order Rules

- Keep `index.html` in sync whenever adding a new split file.
- Base class files must load before their prototype extension files.
- Shared helper files must load before any extension that calls them.
- Current important order assumptions:
  - `world.js` before `world-actors.js`, `world-tile-state.js`, `world-traversal.js`, and `world-generation.js`
  - `item.js` before `item-data.js` and `item-factories.js`
  - `player.js` before player extension files
  - `enemy.js` before enemy extension files
  - Pixi CDN, then `ui-pixi-overlay.js`, `ui-pixi-sprites.js`, `ui-pixi-render-state.js`, `ui-pixi-layers.js`, `ui-pixi-actors.js`, `ui-pixi-effects.js`, then `ui.js`
  - `game-input.js` and `game-turn-results.js` after `game.js` and before turn-processing files
  - `game-npc-interactions.js` after `game.js`/`game-turn-results.js` and before turn-processing files that call NPC helpers
  - `game-content-utils.js` and `game-content-registry.js` before `game-enemy-content.js` and `game-item-generation.js`
  - `game-item-state.js` before `game-item-interactions.js`
  - `game-explore.js` loads last among `game/` files because it depends on all turn and world helpers

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
- For item issues: check `game-item-generation.js`, `game-item-state.js`, `game-item-interactions.js`, then item entity files (`item.js` display naming and `item-factories.js` world roll behavior).
- For enemy behavior issues: check `enemy-ai.js` (including A* pathfinding with hostile-tile cost routing), `enemy-item-behaviors.js`, `enemy-combat.js`, then `game-enemy-turns.js`.
- For enemy pathfinding issues: check `entities/enemy-ai.js` `findPath`, `canTraverseTileForPathfinding`, and cost-based routing logic. Enemies prefer safe routes but route through hostile tiles (water/lava/spike) at cost 50 rather than getting stuck.
- For map or rendering issues: check `ui/ui-pixi-overlay.js` (orchestrator) and subsystems (`ui-pixi-sprites.js` for actor appearance, `ui-pixi-render-state.js` for per-frame shared state, `ui-pixi-layers.js` for tile/item/depth, `ui-pixi-actors.js` for health bars and labels, `ui-pixi-effects.js` for combat animations), then `engine/fov.js` for visibility logic.
- For NPC or quest issues: check `game-npc-interactions.js`, `game-enemy-content.js`, and `entities/enemy-ai.js` if escort or passive ally behavior is involved.
- For dungeon shop issues: check `config/generation-constants.js` (shop premade shape/chance), `engine/world-generation.js` (placement), `game/game-content.js` (shopkeeper + stock spawn), `game/game-player-turns.js` (pickup and exit interception), `game/game-npc-interactions.js` (combined buy/sell settlement), `game/game-inventory-actions.js` (sale staging), `entities/item-data.js` (prices), and `ui/ui-panels.js` / `ui/ui-pixi-layers.js` (prompts and visuals).
- For dungeon path progression or unlock issues: check `config/generation-constants.js` (`DUNGEON_PATH_DEFINITIONS`, `DUNGEON_WORLD_EVENT_RULES`), `engine/world.js` (`selectedDungeonPathId`, `unlockedDungeonPathIds`, `completedDungeonPathIds`), `engine/world-generation.js` (`selectAreaTypeForFloor()`), and `game/game.js` / `game/game-enemy-content.js`.
- For auto-explore issues: check `game-explore.js` (tick loop, sticky targets, oscillation breakout, forced detours, no-progress watchdog, damage-tile avoidance, BLIND/CONFUSED random movement, descent setting), `game-input.js` (any keypress stops explore), and `game.js` (`game.settings.autoExploreDescendImmediately`).
- For settings menu issues: check `ui/ui-panels.js` (`openSettings`, `closeSettings`, `settingsOpen`), `game-input.js` (Escape toggles settings), `index.html` (`#settings-modal`), and `game.js` (`this.settings` object).
- For inventory UI issues: check `ui/ui-inventory.js` (unified equipped/backpack list, ally equipment entries, hover details panel, unknown-item redaction, `runManagedInventoryPrompt`, `applyInventoryOutcome`, `buildInventoryDisplayEntries`), `ui/ui-panels.js` (`focusGameSurface`, `runNativePrompt`), `entities/player-inventory.js` (carried-count/capacity helpers), and `index.html` (`#inventory-item-details`, `#inventory-title`).
- For stair/item ordering issues: check `game/game-player-turns.js` and `entities/player.js` (deferred hazard/stair trigger so pickup happens first).
- For floor spawning issues: check `game-content.js`, `game-enemy-content.js` (including `ENEMY_FAMILY_SPAWN_BALANCING`, zero-weight filtering, and NPC placement/filtering), `game-item-generation.js` (count bands and tier weighting), and `engine/world-generation.js`.
- For trap issues: check `engine/world-tile-state.js` (trap state and reveal), `config/constants.js` (trap definitions), and `game/game.js` (`applyPlayerTrapAtCurrentPosition()` and `dropPlayerItems()` for trip traps).
- For weather issues: check `config/constants.js` (weather types and definitions), `config/generation-constants.js` (spawn weights), `engine/world-generation.js` (weather generation), and `game/game.js` (`getFovRangeForFloor()` for fog effects).
- For dungeon path return portal issues: check `engine/world-traversal.js` (max-depth stairs spawn player at center of overworld).
- For ally defeat/stalling issues: check `game/game-enemy-turns.js` (`stallAllyWithHandler()`, `getHandlerNpc()`), `game/game-npc-interactions.js` (handler ally retrieval with health restoration).