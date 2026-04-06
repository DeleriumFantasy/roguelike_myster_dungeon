# Game Guide

## Purpose

- `game/` is the orchestration layer built on `Game.prototype` extensions.
- These files coordinate world, entities, and UI. They should not become dumping grounds for low-level entity behavior.

## File Roles

	Also coordinates overworld dungeon path selection (`openDungeonSelectionFromOverworldStairs`) and applies selected descent transitions.
- `game.js`: bootstrap, high-level turn loop, config-driven dungeon path completion/unlock announcements, weather FOV modifier application, and trap handling. Processes only hostile enemies, not NPCs. Holds `this.settings` object (e.g. `autoExploreDescendImmediately`).
	Also coordinates overworld dungeon path selection (`openDungeonSelectionFromOverworldStairs`) and applies selected descent transitions.
	`getFovRangeForFloor()` reads floor weather and applies `WEATHER_DEFINITIONS` modifier. `applyPlayerTrapAtCurrentPosition()` handles `TRAP_TRIP` via `dropPlayerItems()` which drops equipped items first, then inventory if no equipped items.
- `game-input.js`: browser keyboard input, held-move orchestration, and centralized overlay close/focus restoration (`toggleInventory`, `handleEscapeKey`, `closeOverlayAndFocus`). Any keydown stops auto-explore. Escape exclusively toggles the settings modal.
- `game-turn-results.js`: shared structured turn-result factories.
- `game-content.js`: setup, floor population flow, floor event lifecycle (hoard room wake mechanics, event activation/progression/cleanup), and dungeon shop population.
- `game-content-utils.js`: shared content-selection helpers like weighted picks and floor content RNG.
- `game-content-registry.js`: content-registry helpers for enemy templates and weighted item entry selection.
- `game-enemy-content.js`: enemy spawning, configurable family-balancing (`ENEMY_FAMILY_SPAWN_BALANCING`), creation, promotion, and explicit overworld NPC placement, including config-driven second-questgiver availability.
- `game-item-generation.js`: floor-banded item spawn counts, floor-scaled item-tier weighting, premade item placement, starter loadout, and event-reward item helpers.
- `game-item-state.js`: throw resolution, pickup/drop mutation, and defeat drop state changes.
- `game-inventory-actions.js`: inventory action resolution that mutates gameplay state (use/equip/unequip/drop orchestration, floor-effect scroll outcomes, shared player-target helpers, inventory-use subhelpers, pot storage messaging, inventory-cap handling, and staging shop sales when items are dropped on shop tiles).
- `game-item-interactions.js`: item announcements and interaction coordination.
- `game-player-turns.js`: player turn resolution, including shop pickup confirmation, unpaid-item tracking, and exit interception when leaving a shop with unsettled goods.
- `game-enemy-turns.js`: enemy turn resolution, defeat/EXP handling, and ally stalling. Defeated allies are automatically stalled with the handler via `stallAllyWithHandler()` if one exists on the overworld.
- `game-explore.js`: auto-explore tick loop (`queueAutoExploreTick`/`runAutoExploreTick`), sticky target tracking, oscillation detection, forced-detour breakout, no-progress watchdog, damage-tile path avoidance via `findPathForAutoExplore`, BLIND/CONFUSED → random movement, cheater-equipment auto-attack mode, and descent logic controlled by `game.settings.autoExploreDescendImmediately`.
- `game-combat-helpers.js`: shared combat coordination helpers.
- `game-npc-interactions.js`: NPC interaction flow (merchant shop, banker services, handler ally storage with health restoration, questgiver tasks including escort quests, dungeon shopkeeper buy/sell settlement, and one-time starving/homebound/shaman services). Retrieved allies are restored to full health.
- Random floor event lifecycle (roll/activation/progression/cleanup) belongs in `game-content.js`. `throwing-challenge` is objective-based and has no turn countdown.

## Editing Rules

- Keep announcement-only logic separate from state mutation.
- Shared selection helpers used by both enemy and item content go in `game-content-utils.js`.
- Shared registry-style lookups used by both enemy and item generation go in `game-content-registry.js`.
- Enemy creation/spawn tables belong in `game-enemy-content.js`, not `game-content.js`.
- Keep special NPC interactions in `game-npc-interactions.js`; keep NPC spawn policy in `game-enemy-content.js`.
- Keep shop settlement math centralized in `game-npc-interactions.js` shared helpers so talk-to-shopkeeper and walk-away interception stay in sync.
- Keep enemy-family spawn tuning data in `game-enemy-content.js` and keep template stat data in `config/enemy-definitions.js`.
- Keep zero-weight, quest-only, or NPC-only template exclusions enforced in `game-enemy-content.js` rather than scattering ad hoc spawn checks.
- Item spawning and premade item placement belong in `game-item-generation.js`.
- Throw/drop/pickup resolution belongs in `game-item-state.js`.
- If a method mainly adds messages, prefer `game-item-interactions.js` or another interaction-oriented file.
- Input event plumbing should stay in `game-input.js`, not in `game.js`.
- Keep prompt/canvas focus restoration centralized in `ui/ui-panels.js` and have `game-input.js` call those helpers instead of duplicating DOM focus logic.
- If behavior depends on ordering between pickup and stair/hazard transitions, keep orchestration in `game-player-turns.js`.
- Keep dungeon path unlock chains, starting availability, and overworld progression prerequisites/messages in `config/generation-constants.js`; `game.js` and `game-enemy-content.js` should consume the helpers.

## Fast Orientation

- Start at `game.js` for lifecycle and phase flow.
- Read `game-input.js` for keyboard and held-move behavior.
- Read `game-player-turns.js` and `game-enemy-turns.js` for turn bugs.
- For player movement ordering bugs (e.g., item on stairs), check `game-player-turns.js` and `entities/player.js` together.
- Read `game-item-state.js` first for throw, pickup, and drop bugs.
- Read `game-enemy-content.js` and `game-item-generation.js` for spawning/content bugs and floor-scaling balance issues.
- For dungeon shop issues, check `game-content.js` (spawn), `game-player-turns.js` (pickup/exit handling), `game-npc-interactions.js` (combined settlement), and `game-inventory-actions.js` (sale staging, capacity handling, and shared inventory targeting).
- For inventory/focus bugs, check `game-input.js` (`toggleInventory`, `handleEscapeKey`, `closeOverlayAndFocus`) together with `ui/ui-panels.js` (`focusGameSurface`, `runNativePrompt`) and `ui/ui-inventory.js` (`runInventoryAction`, `buildInventoryDisplayEntries`).
- Read `game-npc-interactions.js` for banker, handler, questgiver, escort, and other special NPC behavior.
- For hoard room issues (wake distance, ally detection): check `game-content.js` `tryWakeCatacombsHoardEvent`, `isPositionAdjacentToRoom`, and the calls in `game-player-turns.js` and `game-enemy-turns.js`.

## Common Mistakes

- Avoid putting entity-level combat logic here when it belongs in `entities/`.
- Avoid mixing state mutation and UI messaging in the same new helper when they can stay separated.
- Keep runtime method names action-oriented: `spawn...`, `resolve...`, `announce...`, `pickup...`, `drop...`.
- Quest-specific companion spawning, completion, and failure flow belong in `game-npc-interactions.js`; passive escort movement logic belongs in `entities/enemy-ai.js`.