# Game Guide

## Purpose

- `game/` is the orchestration layer built on `Game.prototype` extensions.
- These files coordinate `world`, `entities`, and `ui`; they should not become dumping grounds for low-level entity behavior.

## File Roles

- `game.js`: bootstrap, high-level turn loop, undo snapshot/restore support, settings state, dungeon-path progression, and floor/weather orchestration.
- `game-input.js`: keyboard input, held-move orchestration, undo shortcuts, and overlay-close/focus plumbing.
- `game-turn-results.js`: shared structured result factories.
- `game-content.js`: floor setup/population, floor event lifecycle, and dungeon shop population.
- `game-content-utils.js`: shared orchestration helpers such as weighted picks, floor RNG, player inventory/ally access, world-floor iteration, and NPC lookup by role.
- `game-content-registry.js`: content-registry and enemy template lookup helpers.
- `game-enemy-content.js`: enemy spawning, family balancing, promotion, and persistent overworld NPC roster placement.
- `game-item-generation.js`: spawn counts, tier weighting, premade item placement, and reward item helpers.
- `game-item-state.js`: throw, pickup, drop, and defeat-drop mutation.
- `game-inventory-actions.js`: inventory action resolution and mutation, including targeted scroll/pot/shop flows.
- `game-item-interactions.js`: item-related announcements and coordination.
- `game-player-turns.js`: player turn resolution, shop pickup confirmation, and exit interception.
- `game-enemy-turns.js`: enemy turn resolution, defeat handling, EXP awards, and ally stalling with the handler.
- `game-explore.js`: auto-explore tick loop, oscillation breakout, danger avoidance, and descent logic tied to settings.
- `game-combat-helpers.js`: shared combat coordination helpers.
- `game-npc-interactions.js`: banker/merchant/handler/questgiver flows, escort handling, quest completion, and dungeon shop settlement.

## Editing Rules

- Keep announcement-only logic separate from state mutation.
- Shared orchestration helpers belong in `game-content-utils.js`.
- Shared content/template lookup belongs in `game-content-registry.js`.
- Enemy spawn policy belongs in `game-enemy-content.js`, not `game-content.js`.
- Item spawn tuning belongs in `game-item-generation.js`; throw/drop/pickup mutation belongs in `game-item-state.js`.
- Keep special NPC interaction flow in `game-npc-interactions.js` and UI prompt plumbing in `ui/ui-panels.js`.
- Keep input plumbing in `game-input.js`, not in `game.js`.
- Keep path unlock chains and world-event requirements in `config/generation-constants.js`; consume them from `game/` rather than duplicating them.

## Shared Helper Notes

- Prefer `getPlayerInventoryItems()`, `getPlayerAllies()`, `forEachWorldFloor()`, and `findNpcByRole()` instead of repeating array and floor-collection plumbing.
- Prefer config readers like `getFloorEventRule()` / `getEnemyScalingRules()` / `getQuestgiver...()` over direct hardcoded values.
- `game.js` owns the undo system (`maxUndoStates`, snapshot helpers, `undoLastTurn()`).

## Fast Orientation

- Start at `game.js` for lifecycle, settings, and undo flow.
- Read `game-input.js` for keyboard and overlay behavior.
- Read `game-player-turns.js` and `game-enemy-turns.js` for turn-order bugs.
- Read `game-item-state.js` for throw, pickup, and drop issues.
- Read `game-content.js`, `game-enemy-content.js`, and `game-item-generation.js` for content spawning and floor-event issues.
- Read `game-npc-interactions.js` for banker, handler, questgiver, escort, and shop settlement behavior.

## Common Mistakes

- Avoid putting entity-level combat logic here when it belongs in `entities/`.
- Avoid mixing UI-only wording with mutation-heavy logic unless there is no better split.
- Keep runtime helper names action-oriented: `spawn...`, `resolve...`, `announce...`, `pickup...`, `drop...`.