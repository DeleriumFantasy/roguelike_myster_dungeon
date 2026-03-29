# UI Guide

## Purpose

- `ui/` contains rendering and presentation logic only.
- UI files should read world/player/enemy state and present it, but avoid becoming the place where gameplay state changes are decided.

## File Roles

- `ui.js`: base UI shell and shared DOM/canvas setup.
- `ui-rendering.js`: scene rendering, tile drawing, camera, and visibility-based render decisions.
- `ui-panels.js`: stats and message overlay updates.
- `ui-inventory.js`: inventory modal behavior.
- `ui-map.js`: minimap/map overlay rendering.

## Editing Rules

- Keep rendering decisions here; keep gameplay state mutation in `game/`, `entities/`, or `engine/`.
- Shared render predicates should live in `ui-rendering.js` and be reused by panel/map rendering.
- If a method only formats messages or DOM text, prefer `ui-panels.js`.
- If a helper is canvas-specific and scene-specific, prefer `ui-rendering.js`.

## Fast Orientation

- For on-screen actor/tile rendering, start in `ui-rendering.js`.
- For the top-left overlay map, start in `ui-map.js`.
- For stats or message overlay output, start in `ui-panels.js`.

## Common Mistakes

- Do not resolve combat, drops, or movement here.
- Do not duplicate visibility logic across UI files if a shared helper already exists.
- Keep presentation wording consistent with message helpers already used elsewhere.