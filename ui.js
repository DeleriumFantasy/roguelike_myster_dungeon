// UI and rendering

class UI {
    constructor(canvas, infoPanel, inventoryModal, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.tabIndex = 0;
        this.canvas.focus();
        this.infoPanel = infoPanel;
        this.inventoryModal = inventoryModal;
        this.mapModal = document.getElementById('map-modal');
        this.mapCanvas = document.getElementById('map-canvas');
        this.mapCtx = this.mapCanvas ? this.mapCanvas.getContext('2d') : null;
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
        this.mapOpen = false;
        this.mapTileSize = 8;
        this.cameraRadius = CAMERA_RADIUS;
        this.cameraBounds = {
            minX: 0,
            maxX: GRID_SIZE - 1,
            minY: 0,
            maxY: GRID_SIZE - 1
        };
        this.topDownOffsetX = 0;
        this.topDownOffsetY = 0;

        if (this.mapCanvas) {
            this.mapCanvas.width = GRID_SIZE * this.mapTileSize;
            this.mapCanvas.height = GRID_SIZE * this.mapTileSize;
        }

        // Offscreen canvas for caching explored tile sprites on the map modal.
        // Rebuilt only when new tiles are explored or the floor changes.
        this._mapExploredCanvas = document.createElement('canvas');
        this._mapExploredCanvas.width = GRID_SIZE * this.mapTileSize;
        this._mapExploredCanvas.height = GRID_SIZE * this.mapTileSize;
        this._mapExploredCtx = this._mapExploredCanvas.getContext('2d');
        this._mapExploredCacheFloor = -1;
        this._mapExploredCacheSize = 0;
    }

    render(world, player, fov) {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        this.updateCamera(player);

        this.renderTopDownScene(world, player, fov);

        this.updateInfoPanel(player, world, fov);

        if (this.mapOpen) {
            this.renderMapModal(world, player);
        }
    }

    renderTopDownScene(world, player, fov) {
        if (this.isActorBlind(player)) {
            this.renderPlayer(player);
            return;
        }

        const { minX, maxX, minY, maxY } = this.cameraBounds;
        const overdrawQueue = [];

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const od = this.renderTile(x, y, world, fov);
                if (od) overdrawQueue.push(od);
            }
        }

        // Render items (also show in fogged/explored tiles, but not on unseen tiles)
        for (const [key] of world.getCurrentFloor().items) {
            const [x, y] = this.parseGridKey(key);
            if (!this.isInCameraBounds(x, y)) continue;
            const isVisible = fov.isVisible(x, y);
            if (isVisible || fov.isExplored(x, y)) {
                this.withTemporaryAlpha(this.ctx, this.getVisibilityAlpha(isVisible), () => {
                    this.renderItem(x, y);
                });
            }
        }

        // Render enemies
        for (const enemy of world.getEnemies()) {
            if (!this.isInCameraBounds(enemy.x, enemy.y)) continue;
            if (!this.isEnemyVisibleInFov(enemy, fov)) continue;
            this.renderEnemy(enemy);
        }

        // Render player
        this.renderPlayer(player);

        // Re-draw just the prong-tip overdraw portion on top of player/enemies
        // so spikes on the row below appear to protrude in front of actors.
        for (const od of overdrawQueue) {
            this.ctx.drawImage(
                this.tileset.spriteSheet,
                od.srcRect.x, od.srcRect.y, od.srcRect.width, od.overdrawTop,
                od.screenX, od.screenY - od.drawOffsetY, TILE_SIZE, od.drawOffsetY
            );
        }

    }

    renderTile(x, y, world, fov) {
        if (!this.tileset.isReady()) {
            return null;
        }

        const tile = world.getTile(x, y);
        const overlays = this.getTileOverlayData(world, x, y);

        if (!fov.isVisible(x, y) && !fov.isExplored(x, y)) {
            // unexplored – draw nothing (black background)
            return;
        }

        // Draw tile from sprite sheet
        const screenPos = this.worldToTopDownScreen(x, y);
        const metrics = this.tileset.getRenderMetrics(tile, TILE_SIZE, world, x, y);
        const srcRect = metrics.sourceRect;
        const isVisible = fov.isVisible(x, y);
        const overdrawTop = metrics.overdrawTop;
        const drawOffsetY = metrics.drawOffsetY;
        const drawHeight = metrics.drawHeight;

        this.ctx.drawImage(
            this.tileset.spriteSheet,
            srcRect.x, srcRect.y, srcRect.width, srcRect.height,
            screenPos.x, screenPos.y - drawOffsetY, TILE_SIZE, drawHeight
        );

        this.renderTileOverlays(this.ctx, overlays.hazard, overlays.trapType, overlays.trapRevealed, screenPos.x, screenPos.y, TILE_SIZE);

        // if fogged (explored but not visible) overlay grey – cover full overdraw height
        if (!isVisible && fov.isExplored(x, y)) {
            this.ctx.fillStyle = COLORS.FOG_OVERLAY;
            this.ctx.fillRect(screenPos.x, screenPos.y - drawOffsetY, TILE_SIZE, drawHeight);
        }

        // Return overdraw descriptor so caller can re-paint prong tips after entities.
        // Only needed for visible tiles since no entities render on fogged tiles.
        if (isVisible && drawOffsetY > 0) {
            return { srcRect, overdrawTop, drawOffsetY, screenX: screenPos.x, screenY: screenPos.y };
        }
        return null;
    }

    renderPlayer(player) {
        const screenPos = this.worldToTopDownScreen(player.x, player.y);
        this.renderPlayerMarker(this.ctx, screenPos.x, screenPos.y, TILE_SIZE, player);

        const facing = getActorFacing(player);
        this.renderPlayerFacingArrow(screenPos.x, screenPos.y, facing);
        this.renderHealthBar(player, screenPos.x, screenPos.y, HEALTH_BAR_PALETTES.player);
    }

    renderPlayerMarker(ctx, x, y, size, player) {
        const playerVisual = getEntityVisual('player', player);
        ctx.fillStyle = playerVisual.color;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
    }

    renderPlayerFacingArrow(x, y, facing) {
        const cx = x + TILE_SIZE / 2;
        const cy = y + TILE_SIZE / 2;
        const tip = TILE_SIZE * 0.38;
        const wing = TILE_SIZE * 0.2;
        const direction = normalizeDirection(facing?.dx, facing?.dy, { dx: 0, dy: -1 });
        const ux = direction.dx;
        const uy = direction.dy;
        const px = -uy;
        const py = ux;

        this.ctx.fillStyle = UI_VISUALS.playerFacingArrow;
        this.ctx.beginPath();

        this.ctx.moveTo(cx + ux * tip, cy + uy * tip);
        this.ctx.lineTo(cx - ux * wing + px * wing, cy - uy * wing + py * wing);
        this.ctx.lineTo(cx - ux * wing - px * wing, cy - uy * wing - py * wing);

        this.ctx.closePath();
        this.ctx.fill();
    }

    getHealthBarFillColor(ratio, palette) {
        if (ratio > 0.66) {
            return palette.high;
        }
        if (ratio > 0.33) {
            return palette.mid;
        }
        return palette.low;
    }

    renderHealthBar(actor, screenX, screenY, palette) {
        const maxHealth = Math.max(1, Number(actor?.maxHealth) || 1);
        const health = clamp(Number(actor?.health) || 0, 0, maxHealth);
        const ratio = health / maxHealth;

        const barWidth = TILE_SIZE;
        const barHeight = 3;
        const barX = screenX;
        const barY = screenY - 5;

        this.ctx.save();
        this.ctx.fillStyle = palette.background;
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        this.ctx.fillStyle = this.getHealthBarFillColor(ratio, palette);
        this.ctx.fillRect(barX, barY, Math.round(barWidth * ratio), barHeight);

        this.ctx.strokeStyle = palette.border;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1);
        this.ctx.restore();
    }

    renderEnemy(enemy) {
        const screenPos = this.worldToTopDownScreen(enemy.x, enemy.y);
        this.ctx.fillStyle = getEntityVisual('enemy', enemy).color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x + TILE_SIZE / 2, screenPos.y + TILE_SIZE / 2, TILE_SIZE * 0.42, 0, Math.PI * 2);
        this.ctx.fill();

        this.renderEnemyName(enemy, screenPos.x, screenPos.y);
        this.renderHealthBar(enemy, screenPos.x, screenPos.y, HEALTH_BAR_PALETTES.enemy);
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

    renderEnemyName(enemy, screenX, screenY) {
        const label = this.getEnemyDisplayName(enemy);
        if (!label) {
            return;
        }

        this.ctx.save();
        this.ctx.font = 'bold 8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = UI_VISUALS.enemyNameOutline;
        this.ctx.fillStyle = UI_VISUALS.enemyNameColor;

        const textX = screenX + TILE_SIZE / 2;
        const textY = screenY + TILE_SIZE / 2;
        this.ctx.strokeText(label, textX, textY);
        this.ctx.fillText(label, textX, textY);
        this.ctx.restore();
    }

    renderItem(x, y) {
        const screenPos = this.worldToTopDownScreen(x, y);
        const itemVisual = getEntityVisual('item');
        this.ctx.fillStyle = itemVisual.color;
        this.ctx.fillRect(
            screenPos.x + itemVisual.miniMapInset,
            screenPos.y + itemVisual.miniMapInset,
            TILE_SIZE - itemVisual.miniMapInset * 2,
            TILE_SIZE - itemVisual.miniMapInset * 2
        );
    }

    renderTileOverlays(ctx, hazard, trapType, trapRevealed, x, y, size) {
        if (hazard === HAZARD_TYPES.STEAM) {
            this.renderSteamOverlay(ctx, x, y, size);
        }

        if (trapType && trapRevealed) {
            this.renderTrapOverlay(ctx, trapType, x, y, size);
        }
    }

    renderSteamOverlay(ctx, x, y, size) {
        ctx.fillStyle = COLORS.STEAM;
        const centers = [
            { x: x + size * 0.3, y: y + size * 0.35, r: size * 0.16 },
            { x: x + size * 0.55, y: y + size * 0.28, r: size * 0.18 },
            { x: x + size * 0.48, y: y + size * 0.55, r: size * 0.2 }
        ];

        for (const puff of centers) {
            ctx.beginPath();
            ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderTrapOverlay(ctx, trapType, x, y, size) {
        const icon = this.getTrapIcon(trapType);
        if (!icon) {
            return;
        }

        ctx.fillStyle = UI_VISUALS.trapBackdrop;
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        ctx.fillStyle = UI_VISUALS.trapIcon;
        ctx.font = `bold ${Math.max(8, Math.floor(size * 0.55))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, x + size / 2, y + size / 2);
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

    getTileOverlayData(world, x, y) {
        return {
            hazard: typeof world.getHazard === 'function' ? world.getHazard(x, y) : null,
            trapType: typeof world.getTrap === 'function' ? world.getTrap(x, y) : null,
            trapRevealed: typeof world.isTrapRevealed === 'function' ? world.isTrapRevealed(x, y) : false
        };
    }

    parseGridKey(key) {
        return fromGridKey(key);
    }

    getVisibilityAlpha(isVisible) {
        return isVisible ? COLORS.VISIBLE : COLORS.EXPLORED;
    }

    withTemporaryAlpha(ctx, alpha, drawFn) {
        const previousAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        try {
            drawFn();
        } finally {
            ctx.globalAlpha = previousAlpha;
        }
    }

    getScreenCenter(tileX, tileY) {
        const pos = this.worldToTopDownScreen(tileX, tileY);
        return {
            x: pos.x + TILE_SIZE / 2,
            y: pos.y + TILE_SIZE / 2
        };
    }

    updateCamera(player) {
        this.cameraBounds = this.getCameraBounds(player.x, player.y);

        const visibleTilesX = this.cameraBounds.maxX - this.cameraBounds.minX + 1;
        const visibleTilesY = this.cameraBounds.maxY - this.cameraBounds.minY + 1;
        this.topDownOffsetX = Math.floor((CANVAS_WIDTH - visibleTilesX * TILE_SIZE) / 2);
        this.topDownOffsetY = Math.floor((CANVAS_HEIGHT - visibleTilesY * TILE_SIZE) / 2);
    }

    getCameraBounds(centerX, centerY) {
        return {
            minX: clamp(centerX - this.cameraRadius, 0, GRID_SIZE - 1),
            maxX: clamp(centerX + this.cameraRadius, 0, GRID_SIZE - 1),
            minY: clamp(centerY - this.cameraRadius, 0, GRID_SIZE - 1),
            maxY: clamp(centerY + this.cameraRadius, 0, GRID_SIZE - 1)
        };
    }

    isInCameraBounds(x, y) {
        return x >= this.cameraBounds.minX && x <= this.cameraBounds.maxX && y >= this.cameraBounds.minY && y <= this.cameraBounds.maxY;
    }

    worldToTopDownScreen(worldX, worldY) {
        return {
            x: this.topDownOffsetX + (worldX - this.cameraBounds.minX) * TILE_SIZE,
            y: this.topDownOffsetY + (worldY - this.cameraBounds.minY) * TILE_SIZE
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

    updateInfoPanel(player, world, fov) {
        const areaType = world.getAreaType(world.currentFloor);
        const playerBlind = this.isActorBlind(player);
        const conditionEntries = Array.from(player.conditions.entries());
        const conditionText = conditionEntries.length > 0
            ? conditionEntries.map(([condition, duration]) => `${condition} (${duration})`).join(', ')
            : 'none';
        const visibleEnemyLines = [];
        if (!playerBlind) {
            for (const enemy of world.getEnemies()) {
                if (!this.isEnemyVisibleInFov(enemy, fov)) continue;
                const aiState = enemy.lastResolvedAi || enemy.baseAiType || enemy.aiType || AI_TYPES.WANDER;
                const fuserSummary = this.getFuserFusionSummary(enemy);
                const displayName = this.getEnemyDisplayName(enemy);
                visibleEnemyLines.push(`${displayName} (${enemy.x},${enemy.y}) - ${aiState}${fuserSummary}`);
            }
        }

        const enemyDebugHtml = visibleEnemyLines.length > 0
            ? visibleEnemyLines.map((line) => `<p>${line}</p>`).join('')
            : '<p>(none visible)</p>';

        const floorLabel = typeof this.game?.getDisplayFloorLabel === 'function'
            ? this.game.getDisplayFloorLabel(world.currentFloor)
            : String(world.currentFloor + 1);
        const statsDiv = this.statsDiv;
        statsDiv.innerHTML = `
            <h3>Player Stats</h3>
            <p>Level: ${player.level}</p>
            <p>EXP: ${player.exp}/${player.expToNextLevel}</p>
            <p>Money: ${player.money || 0}</p>
            <p>Health: ${player.health}/${player.maxHealth}</p>
            <p>Hunger: ${player.hunger}/${player.maxHunger}</p>
            <p>Power: ${player.power}</p>
            <p>Armor: ${player.armor}</p>
            <p>Conditions: ${conditionText}</p>
            <p>Floor: ${floorLabel}</p>
            <p>Area: ${areaType}</p>
            <p>Allies: ${player.allies.length}</p>
            <p>Position: ${player.x}, ${player.y}</p>
            <h3>Visible Enemies</h3>
            ${enemyDebugHtml}
        `;

        this.renderMessages();
    }

    addMessage(message) {
        this.messages.push(message);
        this.renderMessages();
    }

    renderMessages() {
        this.messagesDiv.innerHTML = '<h3>Messages</h3>' + this.messages.slice(-10).map(msg => `<p>${msg}</p>`).join('');
    }

    createInventoryListItem(text, onClick = null) {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.textContent = text;
        if (typeof onClick === 'function') {
            div.onclick = onClick;
        }
        return div;
    }

    reopenInventoryForCurrentPlayer() {
        this.openInventory(this.game.player);
    }

    openInventory(player) {
        this.game.inventoryOpen = true;
        const list = this.inventoryModal.querySelector('#inventory-list');
        list.innerHTML = '';

        list.appendChild(this.createInventoryListItem('Equipped'));

        const equippedItems = typeof player.getEquippedItems === 'function' ? player.getEquippedItems() : [];
        if (equippedItems.length === 0) {
            list.appendChild(this.createInventoryListItem('(none)'));
        } else {
            for (const [slot, item] of equippedItems) {
                const displayName = `[${slot}] ${this.formatInventoryItemLabel(item)}`;
                list.appendChild(this.createInventoryListItem(displayName, () => this.handleEquippedItemClick(slot, item)));
            }
        }

        list.appendChild(this.createInventoryListItem('Backpack'));

        player.getInventory().forEach((item) => {
            const displayName = this.formatInventoryItemLabel(item);
            list.appendChild(this.createInventoryListItem(displayName, () => this.handleInventoryClick(item)));
        });
        this.inventoryModal.style.display = 'block';
    }

    closeInventory() {
        this.game.inventoryOpen = false;
        this.inventoryModal.style.display = 'none';
    }

    handleEquippedItemClick(slot, item) {
        const unequipped = this.game.player.unequipSlot(slot);
        if (unequipped) {
            this.addMessage(`Unequipped ${item.name}`);
        } else {
            this.addMessage(`${item.name} is cursed and cannot be unequipped`);
        }

        this.reopenInventoryForCurrentPlayer();
    }

    handleInventoryClick(item) {
        const itemLabel = this.formatInventoryItemLabel(item);
        const actions = this.getAvailableInventoryActions(item);
        const choice = this.promptForInventoryAction(itemLabel, actions);
        if (!choice) {
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'use') {
            item.use(this.game.player);
            this.game.player.removeItem(item);
            this.addMessage(`Used ${itemLabel}`);
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'equip') {
            const equipped = item.equip(this.game.player);
            if (equipped) {
                this.game.player.removeItem(item);
                this.addMessage(`Equipped ${item.name}`);
            } else {
                this.addMessage(`Could not equip ${itemLabel}`);
            }
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'throw') {
            this.closeInventory();
            this.game.beginThrowMode(item);
            return;
        }

        if (choice === 'drop') {
            this.game.player.removeItem(item);
            const dropResult = this.game.world.addItem(this.game.player.x, this.game.player.y, item);
            if (dropResult?.burned) {
                this.addMessage(`${itemLabel} burns up in lava.`);
            } else {
                this.addMessage(`Dropped ${itemLabel}`);
            }
            this.reopenInventoryForCurrentPlayer();
        }
    }

    pluralizeItemLabel(label) {
        const name = String(label || '').trim();
        if (!name) {
            return name;
        }

        if (/[^aeiou]y$/i.test(name)) {
            return `${name.slice(0, -1)}ies`;
        }

        if (/(s|x|z|ch|sh)$/i.test(name)) {
            return `${name}es`;
        }

        return `${name}s`;
    }

    formatInventoryItemLabel(item) {
        const baseLabel = getItemLabel(item);
        const identified = typeof item.isIdentified === 'function' ? item.isIdentified() : true;
        const cursed = typeof item.isCursed === 'function' ? item.isCursed() : Boolean(item?.properties?.cursed);
        const quantity = typeof item.getQuantity === 'function' ? item.getQuantity() : 1;

        let label = baseLabel;
        if (item?.type === ITEM_TYPES.THROWABLE && quantity > 1) {
            label = `${this.pluralizeItemLabel(baseLabel)} x${quantity}`;
        }

        if (identified && cursed) {
            label = `${label} *cursed`;
        }

        return label;
    }

    getAvailableInventoryActions(item) {
        return getInventoryActionsForItemType(item?.type);
    }

    promptForInventoryAction(itemLabel, actions) {
        const optionsText = actions.join('/');
        const response = window.prompt(`Choose action for ${itemLabel}: ${optionsText}`, actions[0]);
        if (!response) {
            return null;
        }

        const normalized = response.trim().toLowerCase();
        if (!actions.includes(normalized)) {
            this.addMessage(`Invalid action. Choose one of: ${optionsText}`);
            return null;
        }

        return normalized;
    }

    toggleMap(world, player) {
        if (this.mapOpen) {
            this.closeMap();
            return;
        }
        this.openMap(world, player);
    }

    openMap(world, player) {
        this.mapOpen = true;
        this.renderMapModal(world, player);
        this.mapModal.style.display = 'block';
    }

    closeMap() {
        this.mapOpen = false;
        this.mapModal.style.display = 'none';
    }

    renderMapModal(world, player) {
        if (!this.mapOpen) return;

        if (!this.mapCtx || !this.mapCanvas) return;

        if (!this.tileset.isReady()) return;

        if (this.isActorBlind(player)) {
            this.mapCtx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
            const tileSize = this.mapTileSize;
            this.renderPlayerMarker(this.mapCtx, player.x * tileSize, player.y * tileSize, tileSize, player);
            return;
        }

        const mapCtx = this.mapCtx;
        const mapFov = world.getCurrentFloor().fov;
        const tileSize = this.mapTileSize;

        // Rebuild the offscreen explored-tile cache when new tiles are discovered or the floor changes.
        if (this._mapExploredCacheFloor !== world.currentFloor || this._mapExploredCacheSize !== mapFov.explored.size) {
            const eCtx = this._mapExploredCtx;
            eCtx.clearRect(0, 0, this._mapExploredCanvas.width, this._mapExploredCanvas.height);
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    if (!mapFov.isExplored(x, y)) continue;
                    const tile = world.getTile(x, y);
                    const srcRect = this.tileset.getMapSourceRect(tile, world, x, y);
                    eCtx.drawImage(
                        this.tileset.spriteSheet,
                        srcRect.x, srcRect.y, srcRect.width, srcRect.height,
                        x * tileSize, y * tileSize, tileSize, tileSize
                    );
                }
            }
            this._mapExploredCacheFloor = world.currentFloor;
            this._mapExploredCacheSize = mapFov.explored.size;
        }

        // Blit the cached tile layer in one draw call, then draw dynamic overlays on top.
        mapCtx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
        mapCtx.drawImage(this._mapExploredCanvas, 0, 0);

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (!mapFov.isExplored(x, y)) continue;

                const overlays = this.getTileOverlayData(world, x, y);
                this.renderTileOverlays(mapCtx, overlays.hazard, overlays.trapType, overlays.trapRevealed, x * tileSize, y * tileSize, tileSize);

                if (!mapFov.isVisible(x, y)) {
                    mapCtx.fillStyle = COLORS.FOG_OVERLAY;
                    mapCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }
            }
        }

        for (const [key] of world.getCurrentFloor().items) {
            const [x, y] = this.parseGridKey(key);
            const explored = mapFov.isExplored(x, y);
            if (!explored) continue;

            const itemVisual = getEntityVisual('item');
            this.withTemporaryAlpha(mapCtx, this.getVisibilityAlpha(mapFov.isVisible(x, y)), () => {
                mapCtx.fillStyle = itemVisual.color;
                mapCtx.fillRect(
                    x * tileSize + itemVisual.miniMapInsetMap,
                    y * tileSize + itemVisual.miniMapInsetMap,
                    Math.max(2, tileSize - itemVisual.miniMapInsetMap * 2),
                    Math.max(2, tileSize - itemVisual.miniMapInsetMap * 2)
                );
            });
        }

        for (const enemy of world.getEnemies()) {
            if (!this.isEnemyVisibleInFov(enemy, mapFov)) {
                continue;
            }
            mapCtx.fillStyle = getEntityVisual('enemy', enemy).color;
            mapCtx.fillRect(enemy.x * tileSize, enemy.y * tileSize, tileSize, tileSize);
        }

        this.renderPlayerMarker(mapCtx, player.x * tileSize, player.y * tileSize, tileSize, player);

        // Draw a subtle outline so the player marker remains visible on bright tiles.
        mapCtx.strokeStyle = UI_VISUALS.mapPlayerOutline;
        mapCtx.beginPath();
        mapCtx.arc(player.x * tileSize + tileSize / 2, player.y * tileSize + tileSize / 2, Math.max(1, tileSize / 2 - 0.5), 0, Math.PI * 2);
        mapCtx.stroke();
    }
}