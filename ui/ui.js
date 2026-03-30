// UI base class

class UI {
        // --- Transient Visual Effects: Shared Effect Queue and Triggers ---
        hasActiveVisualEffects() {
            return Array.isArray(this.activeVisualEffects) && this.activeVisualEffects.length > 0;
        }

        pruneExpiredVisualEffects(now = performance.now()) {
            if (!Array.isArray(this.activeVisualEffects) || this.activeVisualEffects.length === 0) {
                return;
            }
            this.activeVisualEffects = this.activeVisualEffects.filter((effect) => {
                const elapsed = now - Number(effect?.startedAt || 0);
                const duration = Math.max(1, Number(effect?.durationMs) || 1);
                return elapsed < duration;
            });
        }

        enqueueVisualEffect(effect) {
            if (!effect || typeof effect !== 'object') {
                return;
            }
            const now = performance.now();
            const nextEffect = {
                ...effect,
                startedAt: now,
                durationMs: Math.max(1, Number(effect.durationMs) || 1)
            };
            this.activeVisualEffects.push(nextEffect);
            if (this.game?.world && this.game?.player && this.game?.fov) {
                this.render(this.game.world, this.game.player, this.game.fov);
            }
            this.scheduleVisualEffectRender();
        }

        playMeleeStrikeEffect(fromX, fromY, toX, toY, options = {}) {
            this.enqueueVisualEffect({
                type: 'melee-strike',
                fromX,
                fromY,
                toX,
                toY,
                attackerSide: options.attackerSide || 'neutral',
                durationMs: options.durationMs || 240
            });
        }

        playThrowTrailEffect(fromX, fromY, toX, toY, options = {}) {
            const distanceTiles = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
            this.enqueueVisualEffect({
                type: 'throw-trail',
                fromX,
                fromY,
                toX,
                toY,
                durationMs: options.durationMs || (220 + distanceTiles * 65)
            });
        }

        playHitPulseEffect(x, y, options = {}) {
            this.enqueueVisualEffect({
                type: 'hit-pulse',
                x,
                y,
                targetSide: options.targetSide || 'neutral',
                durationMs: options.durationMs || 320
            });
        }
    constructor(infoPanel, inventoryModal, game) {
        this.gameContainer = document.getElementById('game-container');
        this.pixiOverlayHost = document.getElementById('pixi-overlay');
        this.infoPanel = infoPanel;
        this.inventoryModal = inventoryModal;
        this.game = game;
        this.messages = [];
        this.tileset = new Tileset();
        this.tileset.tryLoadExternalSpriteSheet(() => {
            if (this.game) {
                this.render(this.game.world, this.game.player, this.game.fov);
            }
        });
        this.statsDiv = this.infoPanel.querySelector('#stats');
        this.messagesDiv = this.infoPanel.querySelector('#messages');
        this.statsOpen = true;
        this.messagesOpen = true;
        this.mapOpen = false;
        this.settingsOpen = false;
        this.dungeonSelectionOpen = false;
        this.currentCameraTarget = null;
        this.mapTileSize = 8; // Will be dynamically set in updateCamera
        this.cameraBounds = {
            minX: 0,
            maxX: GRID_SIZE - 1,
            minY: 0,
            maxY: GRID_SIZE - 1
        };
        this.topDownOffsetX = 0;
        this.topDownOffsetY = 0;
        this.activeVisualEffects = [];
        this.pendingAnimationFrame = null;
        this.pixiOverlay = new PixiSceneOverlay(this.pixiOverlayHost);
        this.applyOverlayVisibility();
    }

    // Pixi is now always required for rendering.
    shouldRenderSceneWithPixi() {
        return true;
    }

    hasPendingPresentationAnimation() {
        return this.hasActiveVisualEffects();
    }

    getCameraTarget(player) {
        this.currentCameraTarget = player ? { x: player.x, y: player.y } : null;
        return player;
    }

    getActiveEventBannerData(world) {
        const activeEvent = world?.getCurrentFloor?.()?.meta?.activeEvent;
        if (!activeEvent) {
            return null;
        }

        const display = activeEvent.display || {};
        const turnsValue = Number(activeEvent.turnsRemaining);
        const turnsRemaining = Number.isFinite(turnsValue)
            ? Math.max(0, Math.floor(turnsValue))
            : null;

        return {
            title: display.title || 'Random Event Active',
            objective: display.objective || 'Complete the event objective.',
            turnsRemaining,
            appendTurnsRemaining: display.appendTurnsRemaining !== false
        };
    }

    getEnemyDisplayName(enemy) {
        const baseName = String(enemy?.name || '').trim();
        if (!baseName) {
            return '';
        }

        if (enemy?.isAlly) {
            const allyLevel = Math.max(1, Math.floor(Number(enemy?.allyLevel) || 1));
            return `Lv${allyLevel} ${baseName}`;
        }

        return baseName;
    }

    getItemTypeAt(world, x, y) {
        const items = world.getItems(x, y);
        if (!Array.isArray(items) || items.length === 0) {
            return null;
        }

        return items[items.length - 1]?.type || null;
    }

    getTrapIcon(trapType) {
        return getTrapDefinition(trapType)?.icon || null;
    }

    isActorBlind(actor) {
        return typeof actor?.hasCondition === 'function' && actor.hasCondition(CONDITIONS.BLIND);
    }

    isEnemyInvisible(enemy) {
        return typeof enemy?.hasCondition === 'function' && enemy.hasCondition(CONDITIONS.INVISIBLE);
    }

    shouldRenderEnemy(enemy, isVisibleFn = () => true) {
        if (this.isEnemyInvisible(enemy)) {
            return false;
        }
        if (!isVisibleFn(enemy.x, enemy.y)) {
            return false;
        }
        return true;
    }

    isEnemyVisibleInFov(enemy, fov) {
        return this.shouldRenderEnemy(enemy, (x, y) => Boolean(fov?.isVisible(x, y)));
    }

    getWeatherTypeForWorld(world) {
        return world?.getCurrentFloor?.()?.meta?.weather || WEATHER_TYPES.NONE;
    }

    shouldUseFogForFloor(floorOrWorld) {
        if (floorOrWorld && typeof floorOrWorld === 'object') {
            return this.getWeatherTypeForWorld(floorOrWorld) === WEATHER_TYPES.FOGGY;
        }

        return Number.isInteger(floorOrWorld) && floorOrWorld >= 25;
    }

    shouldHideUnseenTilesForFloor(floorIndex) {
        return Number.isInteger(floorIndex) && floorIndex > 0;
    }

    isTileRevealed(x, y, fov, shouldHideUnseenTiles) {
        return !shouldHideUnseenTiles || fov.isVisible(x, y) || fov.isExplored(x, y);
    }

    isTileCurrentlyVisible(x, y, fov, shouldHideUnseenTiles) {
        return !shouldHideUnseenTiles || fov.isVisible(x, y);
    }

    getTileOverlayData(world, x, y) {
        const playerHasTrapSight = typeof this.game?.player?.revealsTraps === 'function'
            && this.game.player.revealsTraps();

        return {
            hazard: typeof world.getHazard === 'function' ? world.getHazard(x, y) : null,
            trapType: typeof world.getTrap === 'function' ? world.getTrap(x, y) : null,
            trapRevealed: playerHasTrapSight
                ? true
                : (typeof world.isTrapRevealed === 'function' ? world.isTrapRevealed(x, y) : false)
        };
    }

    parseGridKey(key) {
        return fromGridKey(key);
    }

    getVisibilityAlpha(isVisible) {
        return isVisible ? COLORS.VISIBLE : COLORS.EXPLORED;
    }

    // ...existing code...

    getScreenCenter(tileX, tileY) {
        const tileSize = this.getTileSize();
        const pos = this.worldToTopDownScreen(tileX, tileY);
        return {
            x: pos.x + tileSize / 2,
            y: pos.y + tileSize / 2
        };
    }

    updateCamera(player) {
        const cameraTarget = this.getCameraTarget(player);
        // Always show 15 vertical tiles: tile size = renderer height / 15
        if (this.pixiOverlay && this.pixiOverlay.app && this.pixiOverlay.app.renderer) {
            const renderer = this.pixiOverlay.app.renderer;
            const width = renderer.width;
            const height = renderer.height;
            this.mapTileSize = Math.floor(height / 15);
            // Get visible tile counts
            const visibleTilesY = 15;
            const visibleTilesX = Math.round(visibleTilesY * width / height);
            // Center the camera viewport (not the full grid)
            this.topDownOffsetX = Math.floor((width - this.mapTileSize * visibleTilesX) / 2);
            this.topDownOffsetY = Math.floor((height - this.mapTileSize * visibleTilesY) / 2);
        } else {
            this.mapTileSize = 8;
            this.topDownOffsetX = 0;
            this.topDownOffsetY = 0;
        }
        this.cameraBounds = this.getCameraBounds(cameraTarget.x, cameraTarget.y);
    }

    getCameraBounds(centerX, centerY) {
        const visibleTileCounts = this.getVisibleTileCounts();
        const visibleTilesX = visibleTileCounts.x;
        const visibleTilesY = visibleTileCounts.y;

        // Center camera on player
        let minX = Math.round(centerX - visibleTilesX / 2);
        let minY = Math.round(centerY - visibleTilesY / 2);
        let maxX = minX + visibleTilesX - 1;
        let maxY = minY + visibleTilesY - 1;

        // Clamp so camera never goes out of grid
        if (minX < 0) {
            minX = 0;
            maxX = visibleTilesX - 1;
        }
        if (maxX > GRID_SIZE - 1) {
            maxX = GRID_SIZE - 1;
            minX = GRID_SIZE - visibleTilesX;
        }
        if (minY < 0) {
            minY = 0;
            maxY = visibleTilesY - 1;
        }
        if (maxY > GRID_SIZE - 1) {
            maxY = GRID_SIZE - 1;
            minY = GRID_SIZE - visibleTilesY;
        }

        // Clamp again in case grid is smaller than camera
        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = Math.min(GRID_SIZE - 1, maxX);
        maxY = Math.min(GRID_SIZE - 1, maxY);

        return { minX, maxX, minY, maxY };
    }

    isInCameraBounds(x, y) {
        return x >= this.cameraBounds.minX && x <= this.cameraBounds.maxX && y >= this.cameraBounds.minY && y <= this.cameraBounds.maxY;
    }

    worldToTopDownScreen(worldX, worldY) {
        const tileSize = this.getTileSize();
        return {
            x: this.topDownOffsetX + (worldX - this.cameraBounds.minX) * tileSize,
            y: this.topDownOffsetY + (worldY - this.cameraBounds.minY) * tileSize
        };
    }

    getFuserFusionSummary(enemy) {
        if (!enemy || typeof enemy.hasEnemyType !== 'function' || !enemy.hasEnemyType(ENEMY_TYPES.FUSER)) {
            return '';
        }

        if (!(enemy.swallowedItems instanceof Map) || enemy.swallowedItems.size === 0) {
            return ' | fused: none';
        }

        const entries = [];
        for (const [itemType, item] of enemy.swallowedItems.entries()) {
            const itemLabel = getItemLabel(item, String(itemType));
            entries.push(`${itemType}=${itemLabel}`);
        }

        return ` | fused: ${entries.join('; ')}`;
    }

    getTileSize() {
        // Return the dynamically calculated tile size
        return this.mapTileSize;
    }

    getVisibleTileCounts() {
        // Always show 15 vertical tiles, and as many horizontal as fit the aspect ratio
        if (this.pixiOverlay && this.pixiOverlay.app && this.pixiOverlay.app.renderer) {
            const renderer = this.pixiOverlay.app.renderer;
            const height = renderer.height;
            const width = renderer.width;
            const visibleTilesY = 15;
            const visibleTilesX = Math.round(visibleTilesY * width / height);
            return {
                x: visibleTilesX,
                y: visibleTilesY
            };
        }
        // Fallback
        return { x: 15, y: 15 };
    }

    render(world, player, fov) {
        // ...existing code...
        this.pruneExpiredVisualEffects(performance.now());
        this.updateCamera(player);
        this.pixiOverlay?.render(this, world, player, fov);
        this.updateInfoPanel(player, world, fov);
    }

    scheduleVisualEffectRender() {
        if (this.pendingAnimationFrame !== null) {
            return;
        }

        this.pendingAnimationFrame = window.requestAnimationFrame(() => {
            this.pendingAnimationFrame = null;

            if (!this.hasPendingPresentationAnimation()) {
                return;
            }

            if (!this.game || !this.game.world || !this.game.player || !this.game.fov) {
                if (this.hasPendingPresentationAnimation()) {
                    this.scheduleVisualEffectRender();
                }
                return;
            }

            this.render(this.game.world, this.game.player, this.game.fov);

            if (this.hasPendingPresentationAnimation()) {
                this.scheduleVisualEffectRender();
            }
        });
    }
}
