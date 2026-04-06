# UI Guide

## Purpose

- `ui/` contains rendering and presentation logic only.
- UI files should read world/player/enemy state and present it, but avoid becoming the place where gameplay state changes are decided.

## File Roles

- `ui-pixi-overlay.js`: PixiJS class orchestrator (~210 lines). Manages Pixi application and scene hierarchy, and delegates rendering to subsystems. Main render() method coordinates terrain, items, actors, effects, and panel updates in draw order.
- `ui-pixi-sprites.js`: Procedural sprite generation (~220 lines). Generates actor sprites (player with cloak, ally diamond, NPC rounded torso, enemy polygon) via Pixi Graphics→texture, caches by role+size. Includes color mixing, CSS color parsing, and Pixi hex color utilities.
- `ui-pixi-render-state.js`: Shared per-frame render-state helpers. Builds camera/visibility state once per frame and centralizes layer clearing helpers used by the overlay orchestrator.
- `ui-pixi-layers.js`: World layer rendering (~220 lines). Terrain sprite placement, tile overlays (steam hazards, trap icons), item indicators, shop tile tint/`$` markers, wall depth cues, and actor shadows.
- `ui-pixi-actors.js`: Actor sprite rendering (~130 lines). Places actor sprites with bob/breathe animations, renders acto glows, health bars (color-coded by ratio), player facing arrow, and enemy name labels.
- `ui-pixi-effects.js`: Transient effects and banners (~150 lines). Melee strike trails, projectile throw paths with animated projectile circle, hit pulse overlays, and active-event banner rendering with objective + turn counter.
- `ui.js`: base UI shell, shared DOM/canvas setup, shared scene/view helpers (camera bounds, visibility predicates, tile/item/enemy display helpers, banner data helpers), camera targeting, and scene view helpers.
- `ui-panels.js`: stats and message overlay updates, settings modal (`openSettings`, `closeSettings`, `settingsOpen`), shared focus-restoration helpers (`focusGameSurface`, `runNativePrompt`), and native prompt helpers for shop pickup/exit settlement. Settings changes are read from/written to `game.settings` on close. Message list renders newest-first. Ally stats are included in the stats overlay.
	Dungeon selection modal presentation (`openDungeonSelection`, `closeDungeonSelection`) also belongs here.
- `ui-inventory.js`: inventory modal presentation (lists, prompts, hover details panel with unknown-item redaction, `runManagedInventoryPrompt`, `applyInventoryOutcome`, `buildInventoryDisplayEntries`, `runInventoryAction`) and delegation of gameplay mutations to `game-inventory-actions.js`.

## Editing Rules

- Keep rendering decisions here; keep gameplay state mutation in `game/`, `entities/`, or `engine/`.
- Inventory actions that mutate gameplay state (use/equip/unequip/drop) belong in `game-inventory-actions.js`; `ui-inventory.js` should only gather input and present results.
- Route native `window.prompt`/`window.confirm` calls through `runNativePrompt` or `runManagedInventoryPrompt` so held-input reset and focus restoration stay consistent.
- If a method only formats messages or DOM text, prefer `ui-panels.js`.
- If a helper is scene-render-specific and shared across Pixi subsystems, prefer `ui-pixi-render-state.js`.

## Fast Orientation

**For Pixi scene rendering issues:**
- Start in `ui-pixi-overlay.js` render() method to understand the draw order.
- For sprite appearance issues: check `ui-pixi-sprites.js` (getActorSpriteTexture, color mixing).
- For shared per-frame state issues: check `ui-pixi-render-state.js` (buildRenderState, visibility helpers, layer clearing).
- For layer/depth/terrain issues: check `ui-pixi-layers.js` (renderTerrain, renderDepth, renderItems).
- For actor/health-bar/label issues: check `ui-pixi-actors.js` (renderActors, renderHealthBar, renderEnemyLabel).
- For effect animation issues: check `ui-pixi-effects.js` (renderMeleeStrikeEffect, renderThrowTrailEffect, renderHitPulseEffect).

**For canvas/visibility predicate issues (used everywhere):**
- Check `ui.js` for shared helpers: isTileRevealed, isEnemyVisibleInFov, shouldUseFogForFloor, getVisibilityAlpha, etc.

**For stats/message/settings/shop prompt issues:**
- Check `ui-panels.js`, especially `focusGameSurface`, `runNativePrompt`, and the shop-settlement prompt helpers.

**For shop tile appearance issues:**
- Check `ui-pixi-layers.js`.

**For inventory detail hover panel issues:**
- Check `ui-inventory.js` (`runManagedInventoryPrompt`, `applyInventoryOutcome`, `buildInventoryDisplayEntries`, `runInventoryAction`) and `index.html` (`#inventory-item-details`, `#inventory-title`).

## Common Mistakes

- Do not resolve combat, drops, or movement here.
- Do not duplicate visibility logic across UI files if a shared helper already exists.
- Keep presentation wording consistent with message helpers already used elsewhere.