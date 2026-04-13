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
        this.uiElementCache = new Map();
        this.tileset = new Tileset();
        this.tileset.tryLoadExternalSpriteSheet(() => {
            this.renderCurrentGameState();
        });
        this.statsDiv = this.infoPanel.querySelector('#stats');
        this.messagesDiv = this.infoPanel.querySelector('#messages');
        this.statsOpen = true;
        this.messagesOpen = true;
        this.mapOpen = false;
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
        this.pixiOverlay = new PixiSceneOverlay(this.pixiOverlayHost);
        this.applyOverlayVisibility();
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

        const element = document.getElementById(elementId) || null;
        if (element) {
            this.uiElementCache.set(elementId, element);
        }
        return element;
    }

    getGameRenderContext() {
        if (!this.game?.world || !this.game?.player || !this.game?.fov) {
            return null;
        }

        return {
            world: this.game.world,
            player: this.game.player,
            fov: this.game.fov
        };
    }

    renderCurrentGameState() {
        const renderContext = this.getGameRenderContext();
        if (!renderContext) {
            return false;
        }

        this.render(renderContext.world, renderContext.player, renderContext.fov);
        return true;
    }

    getPlayerAllies(player = this.game?.player, options = {}) {
        const { aliveOnly = false } = options;
        const allies = Array.isArray(player?.allies) ? player.allies : [];
        return allies.filter((ally) => Boolean(ally) && (!aliveOnly || ally?.isAlive?.()));
    }

    getPlayerInventoryItems(player = this.game?.player) {
        const inventory = player?.getInventory?.();
        return Array.isArray(inventory) ? inventory : [];
    }

    formatActorConditionText(actor) {
        const conditionEntries = Array.from(actor?.conditions?.entries?.() || []);
        return conditionEntries.length > 0
            ? conditionEntries.map(([condition, duration]) => `${condition} (${duration})`).join(', ')
            : 'none';
    }

    getWeatherDisplayName(world) {
        const weatherType = world?.getCurrentFloor?.()?.meta?.weather
            || world?.currentFloorObj?.meta?.weather
            || WEATHER_TYPES.NONE;
        const definition = typeof WEATHER_DEFINITIONS !== 'undefined'
            ? WEATHER_DEFINITIONS[weatherType]
            : null;

        if (typeof definition?.name === 'string' && definition.name.length > 0) {
            return definition.name;
        }

        return weatherType && weatherType.charAt
            ? weatherType.charAt(0).toUpperCase() + weatherType.slice(1)
            : 'None';
    }

    hasPendingPresentationAnimation() {
        return this.hasActiveVisualEffects();
    }

    getCameraTarget(player) {
        this.currentCameraTarget = player ? { x: player.x, y: player.y } : null;
        return this.currentCameraTarget;
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
        if (this.isActorBlind(this.game?.player)) {
            return false;
        }

        return !shouldHideUnseenTiles || fov.isVisible(x, y) || fov.isExplored(x, y);
    }

    isTileCurrentlyVisible(x, y, fov, shouldHideUnseenTiles) {
        if (this.isActorBlind(this.game?.player)) {
            return false;
        }

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

    getSceneViewportSize() {
        if (this.pixiOverlay && typeof this.pixiOverlay.getRenderViewportSize === 'function') {
            const viewport = this.pixiOverlay.getRenderViewportSize();
            return {
                width: Math.max(1, Math.floor(Number(viewport?.width) || 1)),
                height: Math.max(1, Math.floor(Number(viewport?.height) || 1))
            };
        }

        return {
            width: Math.max(1, Math.floor(Number(this.game?.canvas?.width) || window.innerWidth || 1)),
            height: Math.max(1, Math.floor(Number(this.game?.canvas?.height) || window.innerHeight || 1))
        };
    }

    updateCamera(player) {
        const cameraTarget = this.getCameraTarget(player);
        if (!cameraTarget || !Number.isFinite(cameraTarget.x) || !Number.isFinite(cameraTarget.y)) {
            return;
        }

        const { width, height } = this.getSceneViewportSize();

        if (this.mapOpen) {
            this.mapTileSize = Math.max(1, Math.floor(Math.min(width / GRID_SIZE, height / GRID_SIZE)));
            this.topDownOffsetX = Math.max(0, Math.floor((width - this.mapTileSize * GRID_SIZE) / 2));
            this.topDownOffsetY = Math.max(0, Math.floor((height - this.mapTileSize * GRID_SIZE) / 2));
            this.cameraBounds = {
                minX: 0,
                maxX: GRID_SIZE - 1,
                minY: 0,
                maxY: GRID_SIZE - 1
            };
            return;
        }

        const baseVisibleTilesY = 15;
        this.mapTileSize = Math.max(1, Math.floor(height / baseVisibleTilesY));
        const visibleTiles = this.getVisibleTileCounts(width, height);
        const projectedHeight = this.mapTileSize * visibleTiles.y;
        this.topDownOffsetX = Math.max(0, Math.floor((width - this.mapTileSize * visibleTiles.x) / 2));
        this.topDownOffsetY = Math.max(0, Math.floor((height - projectedHeight) / 2));
        this.cameraBounds = this.getCameraBounds(cameraTarget.x, cameraTarget.y, visibleTiles);
    }

    getCameraBounds(centerX, centerY, visibleTileCounts = this.getVisibleTileCounts()) {
        const visibleTilesX = Math.max(1, Math.min(GRID_SIZE, Math.floor(Number(visibleTileCounts?.x) || 1)));
        const visibleTilesY = Math.max(1, Math.min(GRID_SIZE, Math.floor(Number(visibleTileCounts?.y) || 1)));

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

    getVisibleTileCounts(viewportWidth = null, viewportHeight = null) {
        if (this.mapOpen) {
            return { x: GRID_SIZE, y: GRID_SIZE };
        }

        const viewport = Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight)
            ? { width: viewportWidth, height: viewportHeight }
            : this.getSceneViewportSize();
        const visibleTilesY = 15;
        const tileSize = Math.max(1, Math.floor(Number(this.mapTileSize) || 1));
        const visibleTilesX = Math.max(1, Math.min(GRID_SIZE, Math.floor(viewport.width / tileSize)));

        return {
            x: visibleTilesX,
            y: Math.max(1, Math.min(GRID_SIZE, visibleTilesY))
        };
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

            const renderContext = this.getGameRenderContext();
            if (!renderContext) {
                if (this.hasPendingPresentationAnimation()) {
                    this.scheduleVisualEffectRender();
                }
                return;
            }

            this.render(renderContext.world, renderContext.player, renderContext.fov);

            if (this.hasPendingPresentationAnimation()) {
                this.scheduleVisualEffectRender();
            }
        });
    }
}
