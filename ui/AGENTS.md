# UI Guide

## Purpose

- `ui/` contains rendering and presentation logic only.
- Read world/player/enemy state here, but keep gameplay mutation in `game/`, `entities/`, or `engine/`.
- PixiJS is the only renderer.

## File Roles

- `ui.js`: base UI shell and shared helpers for DOM lookup, render-context access, scene refresh, ally/inventory access, visibility predicates, and weather/condition formatting.
- `ui-panels.js`: message log, stats overlay, settings modal, dungeon selection modal, prompt plumbing, and focus restoration.
- `ui-inventory.js`: inventory modal presentation, hover details, action prompts, and delegation of mutations to `game/game-inventory-actions.js`.
- `ui-pixi-overlay.js`: Pixi app orchestration and shared display-object pooling.
- `ui-pixi-render-state.js`: per-frame render-state building and layer clearing.
- `ui-pixi-layers.js`: terrain, items, depth, shadows, and shop/trap/hazard overlays.
- `ui-pixi-actors.js`: actor sprites, labels, glows, and health bars.
- `ui-pixi-effects.js`: transient effects and event banners.
- `ui-pixi-sprites.js`: procedural sprite generation and caching.

## Editing Rules

- Reuse `ui.js` helpers such as `getUiElement()`, `renderCurrentGameState()`, `getPlayerAllies()`, and `getPlayerInventoryItems()` instead of repeating DOM or game-state plumbing.
- Inventory actions that mutate gameplay belong in `game/game-inventory-actions.js`; `ui-inventory.js` should gather input and present the result.
- Route prompt/focus behavior through `ui-panels.js` helpers so held-input reset and focus restoration stay consistent.
- If a helper is scene-render specific and shared across Pixi passes, prefer `ui-pixi-render-state.js`.
- If a method only formats display text or DOM state, prefer `ui-panels.js` or `ui.js`.

## Fast Orientation

**For Pixi scene rendering issues:**
- Start in `ui-pixi-overlay.js` to understand draw order and container ownership.
- Check `ui-pixi-render-state.js` for camera/visibility state that is shared across passes.
- Check `ui-pixi-layers.js`, `ui-pixi-actors.js`, and `ui-pixi-effects.js` for the actual drawing logic.

**For panel/prompt issues:**
- Check `ui-panels.js`, especially settings, dungeon selection, prompt helpers, and `focusGameSurface()`.

**For inventory issues:**
- Check `ui-inventory.js` together with `game/game-inventory-actions.js`.
- Inventory detail hover UI uses `#inventory-item-details` and `#inventory-item-details-content` from `index.html`.

## Common Mistakes

- Do not resolve combat, drops, or movement here.
- Do not duplicate DOM lookups or scene refresh code when shared helpers already exist.
- Keep presentation wording consistent with the existing message/prompt helpers.