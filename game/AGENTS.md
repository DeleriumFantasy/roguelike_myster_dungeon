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
- `game-enemy-content.js`: enemy spawning, configurable family-balancing (`ENEMY_FAMILY_SPAWN_BALANCING`), creation, promotion, and explicit overworld NPC placement.
- `game-item-generation.js`: floor-banded item spawn counts, floor-scaled item-tier weighting, premade item placement, starter loadout, and event-reward item helpers.
- `game-item-state.js`: throw resolution, pickup/drop mutation, and defeat drop state changes.
- `game-item-interactions.js`: item announcements and interaction coordination.
- `game-player-turns.js`: player turn resolution.
- `game-enemy-turns.js`: enemy turn resolution and defeat/EXP handling.
- `game-combat-helpers.js`: shared combat coordination helpers.
- `game-npc-interactions.js`: NPC interaction flow (merchant shop, banker services, handler ally storage, questgiver tasks including escort quests, and one-time starving/homebound/shaman services).
- Random floor event lifecycle (roll/activation/progression/cleanup) belongs in `game-content.js`.

## Editing Rules

- Keep announcement-only logic separate from state mutation.
- Shared selection helpers used by both enemy and item content go in `game-content-utils.js`.
- Shared registry-style lookups used by both enemy and item generation go in `game-content-registry.js`.
- Enemy creation/spawn tables belong in `game-enemy-content.js`, not `game-content.js`.
- Keep special NPC interactions in `game-npc-interactions.js`; keep NPC spawn policy in `game-enemy-content.js`.
- Keep enemy-family spawn tuning data in `game-enemy-content.js` and keep template stat data in `config/enemy-definitions.js`.
- Keep zero-weight, quest-only, or NPC-only template exclusions enforced in `game-enemy-content.js` rather than scattering ad hoc spawn checks.
- Item spawning and premade item placement belong in `game-item-generation.js`.
- Throw/drop/pickup resolution belongs in `game-item-state.js`.
- If a method mainly adds messages, prefer `game-item-interactions.js` or another interaction-oriented file.
- Input event plumbing should stay in `game-input.js`, not in `game.js`.

## Fast Orientation

- Start at `game.js` for lifecycle and phase flow.
- Read `game-input.js` for keyboard and held-move behavior.
- Read `game-player-turns.js` and `game-enemy-turns.js` for turn bugs.
- Read `game-item-state.js` first for throw, pickup, and drop bugs.
- Read `game-enemy-content.js` and `game-item-generation.js` for spawning/content bugs and floor-scaling balance issues.
- Read `game-npc-interactions.js` for banker, handler, questgiver, escort, and other special NPC behavior.

## Common Mistakes

- Avoid putting entity-level combat logic here when it belongs in `entities/`.
- Avoid mixing state mutation and UI messaging in the same new helper when they can stay separated.
- Keep runtime method names action-oriented: `spawn...`, `resolve...`, `announce...`, `pickup...`, `drop...`.
- Quest-specific companion spawning, completion, and failure flow belong in `game-npc-interactions.js`; passive escort movement logic belongs in `entities/enemy-ai.js`.