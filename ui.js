// UI and rendering
console.log('ui.js loaded');

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

            if (this.game.debugShowAllMonsters) {
                for (const enemy of world.getEnemies()) {
                    if (!this.isInCameraBounds(enemy.x, enemy.y)) continue;
                    this.renderEnemy(enemy);
                }
            }

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
            if (fov.isVisible(x, y) || fov.isExplored(x, y)) {
                this.withTemporaryAlpha(this.ctx, this.getVisibilityAlpha(fov.isVisible(x, y)), () => {
                    this.renderItem(x, y);
                });
            }
        }

        // Render enemies
        for (const enemy of world.getEnemies()) {
            if (!this.isInCameraBounds(enemy.x, enemy.y)) continue;
            if (!this.shouldRenderEnemy(enemy, (x, y) => fov.isVisible(x, y))) continue;
            if (fov.isVisible(enemy.x, enemy.y) || this.game.debugShowAllMonsters) {
                this.renderEnemy(enemy);
            }
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

        // Debug: show lines to wander targets and chase destinations when debug mode is on
        if (this.game.debugShowAllMonsters) {
            this.renderDebugTargetLines(world);
        }
    }

    renderDebugTargetLines(world) {
        this.ctx.lineWidth = 2;
        for (const enemy of world.getEnemies()) {
            let destX = null;
            let destY = null;
            let color = 'yellow';

            if (enemy.targetX !== null && enemy.targetY !== null) {
                destX = enemy.targetX;
                destY = enemy.targetY;
                color = enemy.aiType === AI_TYPES.WANDER ? 'cyan' : 'yellow';
            } else if (enemy.lastHostilePos) {
                destX = enemy.lastHostilePos.x;
                destY = enemy.lastHostilePos.y;
                color = 'red';
            }

            if (destX === null || destY === null) continue;
            if (!this.isInCameraBounds(enemy.x, enemy.y) && !this.isInCameraBounds(destX, destY)) continue;

            const from = this.getScreenCenter(enemy.x, enemy.y);
            const to = this.getScreenCenter(destX, destY);
            this.ctx.strokeStyle = color;
            this.ctx.beginPath();
            this.ctx.moveTo(from.x, from.y);
            this.ctx.lineTo(to.x, to.y);
            this.ctx.stroke();
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
        const metrics = this.tileset.getRenderMetrics(tile, TILE_SIZE);
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

    renderEnemy(enemy) {
        const screenPos = this.worldToTopDownScreen(enemy.x, enemy.y);
        this.ctx.fillStyle = getEntityVisual('enemy', enemy).color;
        this.ctx.fillRect(screenPos.x, screenPos.y, TILE_SIZE, TILE_SIZE);
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
        if (this.isEnemyInvisible(enemy) && !this.game.debugShowAllMonsters) {
            return false;
        }
        if (!this.game.debugShowAllMonsters && !isVisibleFn(enemy.x, enemy.y)) {
            return false;
        }
        return true;
    }

    getTileOverlayData(world, x, y) {
        return {
            hazard: typeof world.getHazard === 'function' ? world.getHazard(x, y) : null,
            trapType: typeof world.getTrap === 'function' ? world.getTrap(x, y) : null,
            trapRevealed: typeof world.isTrapRevealed === 'function' ? world.isTrapRevealed(x, y) : false
        };
    }

    parseGridKey(key) {
        return key.split(',').map(Number);
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
        for (const enemy of world.getEnemies()) {
            if (!this.shouldRenderEnemy(enemy, (x, y) => fov && fov.isVisible(x, y))) continue;
            if (playerBlind && !this.game.debugShowAllMonsters) continue;
            const isVisible = this.game.debugShowAllMonsters || (fov && fov.isVisible(enemy.x, enemy.y));
            if (!isVisible) continue;
            const aiState = enemy.lastResolvedAi || enemy.baseAiType || enemy.aiType || AI_TYPES.WANDER;
            const fuserSummary = this.getFuserFusionSummary(enemy);
            visibleEnemyLines.push(`${enemy.name} (${enemy.x},${enemy.y}) - ${aiState}${fuserSummary}`);
        }

        const enemyDebugHtml = visibleEnemyLines.length > 0
            ? visibleEnemyLines.map((line) => `<p>${line}</p>`).join('')
            : '<p>(none visible)</p>';

        const floorLabel = typeof this.game?.getDisplayFloorLabel === 'function'
            ? this.game.getDisplayFloorLabel(world.currentFloor)
            : String(world.currentFloor + 1);
        const statsDiv = this.infoPanel.querySelector('#stats');
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

        const messagesDiv = this.infoPanel.querySelector('#messages');
        messagesDiv.innerHTML = '<h3>Messages</h3>' + this.messages.slice(-10).map(msg => `<p>${msg}</p>`).join('');
    }

    addMessage(message) {
        this.messages.push(message);
        this.updateInfoPanel(this.game.player, this.game.world, this.game.fov);
    }

    openInventory(player) {
        this.game.inventoryOpen = true;
        const list = this.inventoryModal.querySelector('#inventory-list');
        list.innerHTML = '';

        const equippedHeader = document.createElement('div');
        equippedHeader.className = 'inventory-item';
        equippedHeader.textContent = 'Equipped';
        list.appendChild(equippedHeader);

        const equippedItems = typeof player.getEquippedItems === 'function' ? player.getEquippedItems() : [];
        if (equippedItems.length === 0) {
            const none = document.createElement('div');
            none.className = 'inventory-item';
            none.textContent = '(none)';
            list.appendChild(none);
        } else {
            for (const [slot, item] of equippedItems) {
                const div = document.createElement('div');
                div.className = 'inventory-item';
                div.textContent = `[${slot}] ${this.formatInventoryItemLabel(item)}`;
                div.onclick = () => this.handleEquippedItemClick(slot, item);
                list.appendChild(div);
            }
        }

        const inventoryHeader = document.createElement('div');
        inventoryHeader.className = 'inventory-item';
        inventoryHeader.textContent = 'Backpack';
        list.appendChild(inventoryHeader);

        player.getInventory().forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'inventory-item';
            const displayName = this.formatInventoryItemLabel(item);
            div.textContent = displayName;
            div.onclick = () => this.handleInventoryClick(item, index);
            list.appendChild(div);
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

        this.openInventory(this.game.player);
    }

    handleInventoryClick(item, index) {
        const itemLabel = this.formatInventoryItemLabel(item);
        const actions = this.getAvailableInventoryActions(item);
        const choice = this.promptForInventoryAction(itemLabel, actions);
        if (!choice) {
            this.openInventory(this.game.player);
            return;
        }

        if (choice === 'use') {
            item.use(this.game.player);
            this.game.player.removeItem(item);
            this.addMessage(`Used ${itemLabel}`);
            this.openInventory(this.game.player);
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
            this.openInventory(this.game.player);
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
            this.openInventory(this.game.player);
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
        const floorMeta = world.getCurrentFloorMeta();
        const tileSize = this.mapTileSize;

        mapCtx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const explored = mapFov.isExplored(x, y) || floorMeta.mapRevealed;
                const visible = mapFov.isVisible(x, y);
                if (!explored) {
                    continue;
                }

                const tile = world.getTile(x, y);
                const srcRect = this.tileset.getMapSourceRect(tile);
                mapCtx.drawImage(
                    this.tileset.spriteSheet,
                    srcRect.x, srcRect.y, srcRect.width, srcRect.height,
                    x * tileSize, y * tileSize, tileSize, tileSize
                );

                const overlays = this.getTileOverlayData(world, x, y);
                this.renderTileOverlays(mapCtx, overlays.hazard, overlays.trapType, overlays.trapRevealed, x * tileSize, y * tileSize, tileSize);

                if (!visible) {
                    mapCtx.fillStyle = COLORS.FOG_OVERLAY;
                    mapCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }
            }
        }

        for (const [key] of world.getCurrentFloor().items) {
            const [x, y] = this.parseGridKey(key);
            const explored = mapFov.isExplored(x, y) || floorMeta.mapRevealed;
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
            if (!this.shouldRenderEnemy(enemy, (x, y) => mapFov.isVisible(x, y))) {
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