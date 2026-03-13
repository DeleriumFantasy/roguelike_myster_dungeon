# Roguelike Dungeon Crawler

A browser-based roguelike dungeon crawler game built with HTML5 Canvas and JavaScript.

## Features

- Placeholder AI router for monster-specific and condition-specific behavior (Ambush, Patrol, Support, Guard)
- Placeholder area generation variants (Dungeon, Swamp, Floating)
- Placeholder save/load snapshot system (localStorage)
- Placeholder item identification: some item names are hidden until use
- Placeholder taming system for converting enemies into allies
- Placeholder ally equipment hooks
- Graphical map overlay modal using the same tile visuals
- Placeholder melee attacks when moving into enemy tiles
- Player and enemies are prevented from occupying the same tile
- Placeholder auto-pickup when stepping onto item tiles
- Inventory modal now shows currently equipped items
- Inventory item click now prompts actions by type: consumables use/throw/drop, throwables throw/drop, equipment equip/throw/drop
- Directional throwing: choose throw direction; projectile hits first monster or drops before wall
- Grid-based turn system on a 50x50 tile map
- Canonical turn pipeline: Pre-turn status tick → Action → Post-turn resolution → World advance
- FOV-based line-of-sight using raycasting (explored tiles persist between turns)
- Procedural floor generation with seeded RNG for reproducible layouts (change seed in game.js)
- Enemy battles for experience and item drops
- Conditions both beneficial and damaging
- Hazards that can damage or obstruct
- Item system with equipment, consumables, throwables and more
- Tile grid enforces a single type per cell; actors and items share space separately
- Tiles that were seen remain "explored" and are drawn normally with a semi‑transparent grey overlay to indicate fog; items and tile types are still visible in fog while monsters stay hidden
- Enemy specific AI with variable FOV
- Camera viewport shows 10 tiles in each direction around the player
- Cursed equipment support: cursed gear cannot be unequipped
- Cursed chance is rolled when eligible items are generated into the world

## How to Play

1. Open `index.html` in a web browser (you can serve it with a simple HTTP server; spaces and accents in the path may require quoting)
2. Open the browser developer console to see debug messages and errors
3. Click the canvas once to ensure it has focus

## Controls

- Arrow keys / WASD: Move
- i: Open inventory
- Click a throwable in inventory, then press Arrow keys / WASD to choose throw direction (Escape cancels)
- m: Open/close map modal
- k: Save snapshot (placeholder)
- l: Load snapshot (placeholder)
- t: Attempt to tame adjacent enemy (placeholder)
- Escape: Close inventory

## Architecture

The game is built with a modular architecture for scalability:

- `constants.js`: Game constants and enums
- `utils.js`: Utility functions
- `fov.js`: Field of view calculations
- `world.js`: World generation and management
- `items.js`: Item definitions and logic
- `player.js`: Player class
- `enemy.js`: Enemy class and AI
- `ui.js`: Rendering and UI management
- `game.js`: Main game loop and logic

## Future Enhancements

The code is designed to be easily extensible for:

- Additional stats, conditions, and hazards
- More complex enemy AI
- Procedural content generation by area/biome
- Save/load functionality with migrations
- Full map and minimap systems
- Ally command systems and ally inventory/equipment
- Multiplayer support