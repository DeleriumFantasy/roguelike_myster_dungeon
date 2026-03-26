# Game Guide

## Purpose

- `game/` is the orchestration layer built on `Game.prototype` extensions.
- These files coordinate world, entities, and UI. They should not become dumping grounds for low-level entity behavior.

## File Roles

- `game.js`: bootstrap and high-level turn loop.
- `game-input.js`: browser keyboard input and held-move orchestration.
- `game-turn-results.js`: shared structured turn-result factories.
- `game-content.js`: setup and floor population flow.
- `game-content-utils.js`: shared content-selection helpers like weighted picks and floor content RNG.
- `game-content-registry.js`: content-registry helpers for enemy templates and weighted item entry selection.
- `game-enemy-content.js`: enemy spawning, creation, and promotion.
- `game-item-generation.js`: item spawning, premade item placement, and starter loadout helpers.
- `game-item-state.js`: throw resolution, pickup/drop mutation, and defeat drop state changes.
- `game-item-interactions.js`: item announcements and interaction coordination.
- `game-player-turns.js`: player turn resolution.
- `game-enemy-turns.js`: enemy turn resolution and defeat/EXP handling.
- `game-combat-helpers.js`: shared combat coordination helpers.
- `game-npc-interactions.js`: banker/shop/NPC interaction flow.

## Editing Rules

- Keep announcement-only logic separate from state mutation.
- Shared selection helpers used by both enemy and item content go in `game-content-utils.js`.
- Shared registry-style lookups used by both enemy and item generation go in `game-content-registry.js`.
- Enemy creation/spawn tables belong in `game-enemy-content.js`, not `game-content.js`.
- Item spawning and premade item placement belong in `game-item-generation.js`.
- Throw/drop/pickup resolution belongs in `game-item-state.js`.
- If a method mainly adds messages, prefer `game-item-interactions.js` or another interaction-oriented file.
- Input event plumbing should stay in `game-input.js`, not in `game.js`.

## Fast Orientation

- Start at `game.js` for lifecycle and phase flow.
- Read `game-input.js` for keyboard and held-move behavior.
- Read `game-player-turns.js` and `game-enemy-turns.js` for turn bugs.
- Read `game-item-state.js` first for throw, pickup, and drop bugs.
- Read `game-enemy-content.js` and `game-item-generation.js` for spawning/content bugs.

## Common Mistakes

- Avoid putting entity-level combat logic here when it belongs in `entities/`.
- Avoid mixing state mutation and UI messaging in the same new helper when they can stay separated.
- Keep runtime method names action-oriented: `spawn...`, `resolve...`, `announce...`, `pickup...`, `drop...`.