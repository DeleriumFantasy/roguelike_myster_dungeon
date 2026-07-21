// UI base class

class UI {
        // --- Transient Visual Effects: Shared Effect Queue and Triggers ---
        getDefaultVisualEffectDurationMs(effectType = '') {
            switch (effectType) {
                case 'melee-strike':
                    return 140;
                case 'throw-trail':
                    return 180;
                case 'hit-pulse':
                    return 200;
                case 'player-walk':
                    return 500;
                default:
                    return 180;
            }
        }

        resolveVisualEffectDurationMs(effect = {}) {
            const requestedDuration = Number(effect?.durationMs);
            if (Number.isFinite(requestedDuration) && requestedDuration > 0) {
                return Math.max(1, Math.floor(requestedDuration));
            }

            return this.getDefaultVisualEffectDurationMs(effect?.type);
        }

        pruneExpiredVisualEffects(now = performance.now()) {
            if (!Array.isArray(this.activeVisualEffects) || this.activeVisualEffects.length === 0) {
                return;
            }
            this.activeVisualEffects = this.activeVisualEffects.filter((effect) => {
                const elapsed = now - Number(effect.startedAt);
                const duration = this.resolveVisualEffectDurationMs(effect);
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
                durationMs: this.resolveVisualEffectDurationMs(effect)
            };
            this.activeVisualEffects.push(nextEffect);
            this.renderCurrentGameState();
            this.scheduleVisualEffectRender();
        }

        playMeleeStrikeEffect(fromX, fromY, toX, toY, options = {}) {
            this.enqueueVisualEffect({
                type: 'melee-strike',
                fromX,
                fromY,
                toX,
                toY,
                attackerSide: options.attackerSide,
                durationMs: options.durationMs
            });
        }

        playThrowTrailEffect(fromX, fromY, toX, toY, options = {}) {
            this.enqueueVisualEffect({
                type: 'throw-trail',
                fromX,
                fromY,
                toX,
                toY,
                durationMs: options.durationMs
            });
        }

        playHitPulseEffect(x, y, options = {}) {
            this.enqueueVisualEffect({
                type: 'hit-pulse',
                x,
                y,
                targetSide: options.targetSide,
                durationMs: options.durationMs
            });
        }
    constructor(infoPanel, inventoryModal, game) {
        this.gameContainer = document.getElementById('game-container');
        this.pixiOverlayHost = document.getElementById('pixi-overlay');
        this.infoPanel = infoPanel;
        this.inventoryModal = inventoryModal;
        this.game = game;
        this.messages = [];
        this.uiElementCache = new Map();
        this.tileset = new Tileset();
        this.tileset.tryLoadExternalSpriteSheet(() => {
            this.renderCurrentGameState();
        });
        this.statsDiv = this.infoPanel.querySelector('#stats');
        this.messagesDiv = this.infoPanel.querySelector('#messages');
        this.statsOpen = true;
        this.messagesOpen = true;
        this.settingsOpen = false;
        this.dungeonSelectionOpen = false;
        this.gamePromptOpen = false;
        this.activeGamePromptConfig = null;
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
        this.perfDebug = {
            enabled: Boolean(window?.__GAME_PERF_DEBUG === true),
            reportIntervalMs: 5000,
            lastReportAt: 0,
            renderSamples: 0,
            renderTotalMs: 0,
            renderPixiMs: 0,
            renderInfoMs: 0
        };
        this.pixiOverlay = new PixiSceneOverlay(this.pixiOverlayHost);
        this.applyOverlayVisibility();
    }

    recordRenderPerfSample(totalMs, pixiMs, infoMs) {
        if (!this.perfDebug?.enabled) {
            return;
        }

        this.perfDebug.renderSamples += 1;
        this.perfDebug.renderTotalMs += Math.max(0, Number(totalMs));
        this.perfDebug.renderPixiMs += Math.max(0, Number(pixiMs));
        this.perfDebug.renderInfoMs += Math.max(0, Number(infoMs));

        const now = performance.now();
        const lastReportAt = Number(this.perfDebug.lastReportAt);
        const reportIntervalMs = Math.max(1000, Number(this.perfDebug.reportIntervalMs));
        if (now - lastReportAt < reportIntervalMs || this.perfDebug.renderSamples <= 0) {
            return;
        }

        const sampleCount = this.perfDebug.renderSamples;
        const averageTotal = this.perfDebug.renderTotalMs / sampleCount;
        const averagePixi = this.perfDebug.renderPixiMs / sampleCount;
        const averageInfo = this.perfDebug.renderInfoMs / sampleCount;

        console.info(
            `[perf][ui] samples=${sampleCount} avgRender=${averageTotal.toFixed(2)}ms avgPixi=${averagePixi.toFixed(2)}ms avgInfo=${averageInfo.toFixed(2)}ms`
        );

        this.perfDebug.lastReportAt = now;
        this.perfDebug.renderSamples = 0;
        this.perfDebug.renderTotalMs = 0;
        this.perfDebug.renderPixiMs = 0;
        this.perfDebug.renderInfoMs = 0;
    }

    getUiElement(id) {
        const elementId = typeof id === 'string' ? id : '';
        if (!elementId) {
            return null;
        }

        if (!(this.uiElementCache instanceof Map)) {
            this.uiElementCache = new Map();
        }

        if (this.uiElementCache.has(elementId)) {
            return this.uiElementCache.get(elementId);
        }

        const element = document.getElementById(elementId);
        if (element) {
            this.uiElementCache.set(elementId, element);
        }
        return element;
    }

    getGameRenderContext() {
        return {
            world: this.game.world,
            player: this.game.player,
            fov: this.game.fov
        };
    }

    renderCurrentGameState() {
        const renderContext = this.getGameRenderContext();
        this.render(renderContext.world, renderContext.player, renderContext.fov);
        return true;
    }

    getPlayerAllies(player = this.game.player, options = {}) {
        const { aliveOnly = false } = options;
        const allies = Array.isArray(player.allies) ? player.allies : [];
        return allies.filter((ally) => Boolean(ally) && (!aliveOnly || ally.isAlive()));
    }

    getPlayerInventoryItems(player = this.game.player) {
        const inventory = player.getInventory();
        return Array.isArray(inventory) ? inventory : [];
    }

    formatActorConditionText(actor) {
        const conditionEntries = Array.from(actor.conditions.entries());
        return conditionEntries.length > 0
            ? conditionEntries.map(([condition, duration]) => `${condition} (${duration})`).join(', ')
            : 'none';
    }

    getWeatherDisplayName(world) {
        const weatherType = world.getCurrentFloor().meta.weather;
        const definition = typeof WEATHER_DEFINITIONS !== 'undefined'
            ? WEATHER_DEFINITIONS[weatherType]
            : null;

        if (typeof definition.name === 'string' && definition.name.length > 0) {
            return definition.name;
        }

        return weatherType && weatherType.charAt
            ? weatherType.charAt(0).toUpperCase() + weatherType.slice(1)
            : '';
    }

    hasPendingPresentationAnimation() {
        if (!Array.isArray(this.activeVisualEffects) || this.activeVisualEffects.length === 0) {
            return false;
        }

        const hasNonWalkEffect = this.activeVisualEffects.some((effect) => {
            return Boolean(effect && typeof effect === 'object' && effect.type !== 'player-walk');
        });
        if (hasNonWalkEffect) {
            return true;
        }

        const moveKeysPressed = Number(this.game.inputController.pressedMoveKeys.size) > 0;
        return !moveKeysPressed;
    }

    getPlayerWalkAnimationFrame(now = performance.now()) {
        if (!Array.isArray(this.activeVisualEffects) || this.activeVisualEffects.length === 0) {
            return null;
        }

        let walkEffect = null;
        for (let i = this.activeVisualEffects.length - 1; i >= 0; i -= 1) {
            const effect = this.activeVisualEffects[i];
            if (effect.type === 'player-walk') {
                walkEffect = effect;
                break;
            }
        }

        if (!walkEffect) {
            return null;
        }

        const animationStartAt = Number(walkEffect.animationStartAt);
        const elapsed = Math.max(0, now - animationStartAt);
        const duration = Math.max(1, Number(walkEffect.durationMs));
        const columns = Number(walkEffect.columns);
        const frameIndex = Math.floor(elapsed / (duration / columns)) % columns;
        return Number(frameIndex);
    }

    getCameraTarget(player) {
        this.currentCameraTarget = player ? { x: player.x, y: player.y } : null;
        return this.currentCameraTarget;
    }

    getActiveEventBannerData(world) {
        const activeEvent = world.getCurrentFloor().meta.activeEvent;
        if (!activeEvent) {
            return null;
        }

        const display = activeEvent.display;
        const turnsValue = Number(activeEvent.turnsRemaining);
        const turnsRemaining = Number.isFinite(turnsValue)
            ? Math.max(0, Math.floor(turnsValue))
            : null;

        return {
            title: display.title,
            objective: display.objective,
            turnsRemaining,
            appendTurnsRemaining: display.appendTurnsRemaining !== false
        };
    }

    getEnemyDisplayName(enemy) {
        const baseName = String(enemy.name).trim();
        if (!baseName) {
            return '';
        }

        if (enemy.isAlly) {
            const allyLevel = Math.max(1, Math.floor(Number(enemy.allyLevel)));
            return `Lv${allyLevel} ${baseName}`;
        }

        return baseName;
    }

    getItemTypeAt(world, x, y) {
        const items = world.getItems(x, y);
        if (!Array.isArray(items) || items.length === 0) {
            return null;
        }

        return items[items.length - 1].type;
    }

    isActorBlind(actor) {
        return actor.hasCondition(CONDITIONS.BLIND);
    }

    isEnemyInvisible(enemy) {
        return enemy.hasCondition(CONDITIONS.INVISIBLE);
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
        return this.shouldRenderEnemy(enemy, (x, y) => Boolean(fov.isVisible(x, y)));
    }

    shouldUseFogForFloor(world) {
        return world.getCurrentFloor().meta.weather === WEATHER_TYPES.FOGGY;
    }

    shouldHideUnseenTilesForFloor(floorIndex) {
        return Number.isInteger(floorIndex) && floorIndex > 0;
    }

    isTileRevealed(x, y, fov, shouldHideUnseenTiles) {
        if (this.isActorBlind(this.game.player)) {
            return false;
        }

        return !shouldHideUnseenTiles || fov.isVisible(x, y) || fov.isExplored(x, y);
    }

    isTileCurrentlyVisible(x, y, fov, shouldHideUnseenTiles) {
        if (this.isActorBlind(this.game.player)) {
            return false;
        }

        return !shouldHideUnseenTiles || fov.isVisible(x, y);
    }

    getTileOverlayData(world, x, y) {
        const playerHasTrapSight = this.game.player.revealsTraps();

        return {
            hazard: world.getHazard(x, y),
            trapType: world.getTrap(x, y),
            trapRevealed: playerHasTrapSight
                ? true
                : world.isTrapRevealed(x, y)
        };
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

    getSceneViewportSize() {
        const viewport = this.pixiOverlay.getRenderViewportSize();
        return {
            width: Math.max(1, Math.floor(Number(viewport.width))),
            height: Math.max(1, Math.floor(Number(viewport.height)))
        };
    }

    updateCamera(player) {
        const cameraTarget = this.getCameraTarget(player);
        if (!cameraTarget || !Number.isFinite(cameraTarget.x) || !Number.isFinite(cameraTarget.y)) {
            return;
        }

        const { width, height } = this.getSceneViewportSize();

        const baseVisibleTilesY = 15;
        this.mapTileSize = Math.max(1, Math.floor(height / baseVisibleTilesY));
        const visibleTiles = this.getVisibleTileCounts(width, height);
        const projectedHeight = this.mapTileSize * visibleTiles.y;
        this.topDownOffsetX = Math.max(0, Math.floor((width - this.mapTileSize * visibleTiles.x) / 2));
        this.topDownOffsetY = Math.max(0, Math.floor((height - projectedHeight) / 2));
        this.cameraBounds = this.getCameraBounds(cameraTarget.x, cameraTarget.y, visibleTiles);
    }

    getCameraBounds(centerX, centerY, visibleTileCounts = this.getVisibleTileCounts()) {
        const visibleTilesX = Math.max(1, Math.min(GRID_SIZE, Math.floor(Number(visibleTileCounts.x))));
        const visibleTilesY = Math.max(1, Math.min(GRID_SIZE, Math.floor(Number(visibleTileCounts.y))));

        // Center camera on player
        let minX = Math.floor(centerX - (visibleTilesX - 1) / 2);
        let minY = Math.floor(centerY - (visibleTilesY - 1) / 2);
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
        if (!enemy.hasEnemyType(ENEMY_TYPES.FUSER)) {
            return '';
        }

        if (!(enemy.swallowedItems instanceof Map) || enemy.swallowedItems.size === 0) {
            return ' | fused: none';
        }

        const entries = [];
        for (const [itemType, item] of enemy.swallowedItems.entries()) {
            const itemLabel = getItemLabel(item);
            entries.push(`${itemType}=${itemLabel}`);
        }

        return ` | fused: ${entries.join('; ')}`;
    }

    getTileSize() {
        // Return the dynamically calculated tile size
        return this.mapTileSize;
    }

    getVisibleTileCounts(viewportWidth = null, viewportHeight = null) {
        const viewport = Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight)
            ? { width: viewportWidth, height: viewportHeight }
            : this.getSceneViewportSize();
        const visibleTilesY = 15;
        const tileSize = Math.max(1, Math.floor(Number(this.mapTileSize)));
        const visibleTilesX = Math.max(1, Math.min(GRID_SIZE, Math.floor(viewport.width / tileSize)));

        return {
            x: visibleTilesX,
            y: Math.max(1, Math.min(GRID_SIZE, visibleTilesY))
        };
    }

    render(world, player, fov, options = {}) {
        const { skipInfoPanel = false } = options;
        const renderStart = performance.now();
        this.pruneExpiredVisualEffects(renderStart);
        this.updateCamera(player);

        const pixiStart = performance.now();
        this.pixiOverlay.render(this, world, player, fov);
        const pixiMs = performance.now() - pixiStart;

        let infoMs = 0;

        if (!skipInfoPanel) {
            const infoStart = performance.now();
            this.updateInfoPanel(player, world, fov);
            infoMs = performance.now() - infoStart;
        }

        this.recordRenderPerfSample(performance.now() - renderStart, pixiMs, infoMs);
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

            const renderContext = this.getGameRenderContext();
            this.render(renderContext.world, renderContext.player, renderContext.fov, {
                skipInfoPanel: true
            });

            if (this.hasPendingPresentationAnimation()) {
                this.scheduleVisualEffectRender();
            }
        });
    }
}
