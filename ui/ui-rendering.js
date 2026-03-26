// UI scene rendering and camera helpers

Object.assign(UI.prototype, {
    hasActiveVisualEffects() {
        return Array.isArray(this.activeVisualEffects) && this.activeVisualEffects.length > 0;
    },

    pruneExpiredVisualEffects(now = performance.now()) {
        if (!Array.isArray(this.activeVisualEffects) || this.activeVisualEffects.length === 0) {
            return;
        }

        this.activeVisualEffects = this.activeVisualEffects.filter((effect) => {
            const elapsed = now - Number(effect?.startedAt || 0);
            const duration = Math.max(1, Number(effect?.durationMs) || 1);
            return elapsed < duration;
        });
    },

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
    },

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
    },

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
    },

    playHitPulseEffect(x, y, options = {}) {
        this.enqueueVisualEffect({
            type: 'hit-pulse',
            x,
            y,
            targetSide: options.targetSide || 'neutral',
            durationMs: options.durationMs || 320
        });
    },

    renderTransientEffects(world, fov, now = performance.now()) {
        if (!this.hasActiveVisualEffects()) {
            return;
        }

        for (const effect of this.activeVisualEffects) {
            if (!effect || !effect.type) {
                continue;
            }

            const elapsed = now - Number(effect.startedAt || 0);
            const duration = Math.max(1, Number(effect.durationMs) || 1);
            const t = clamp(elapsed / duration, 0, 1);

            if (effect.type === 'melee-strike') {
                this.renderMeleeStrikeEffect(effect, t);
                continue;
            }

            if (effect.type === 'throw-trail') {
                this.renderThrowTrailEffect(effect, t);
                continue;
            }

            if (effect.type === 'hit-pulse') {
                this.renderHitPulseEffect(effect, fov, t);
            }
        }
    },

    renderMeleeStrikeEffect(effect, t) {
        const from = this.getScreenCenter(effect.fromX, effect.fromY);
        const to = this.getScreenCenter(effect.toX, effect.toY);
        const progress = Math.min(1, t * 1.25);
        const drawX = from.x + (to.x - from.x) * progress;
        const drawY = from.y + (to.y - from.y) * progress;
        const baseLineWidth = Math.max(2, Math.floor(this.getTileSize() * 0.16));
        const lineWidth = baseLineWidth + (1 - t) * baseLineWidth;
        const alpha = 1 - t;

        let stroke = UI_VISUALS.playerMeleeTrail;
        if (effect.attackerSide === 'enemy') {
            stroke = UI_VISUALS.enemyMeleeTrail;
        }

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(drawX, drawY);
        this.ctx.stroke();
        this.ctx.restore();
    },

    renderThrowTrailEffect(effect, t) {
        const from = this.getScreenCenter(effect.fromX, effect.fromY);
        const to = this.getScreenCenter(effect.toX, effect.toY);
        const currentX = from.x + (to.x - from.x) * t;
        const currentY = from.y + (to.y - from.y) * t;
        const tileSize = this.getTileSize();
        const projectileRadius = Math.max(2, tileSize * 0.16);

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.globalAlpha = 0.52;
        this.ctx.strokeStyle = UI_VISUALS.throwTrail;
        this.ctx.lineWidth = Math.max(3, Math.floor(tileSize * 0.18));
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();

        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = UI_VISUALS.throwProjectile;
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, projectileRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    },

    renderHitPulseEffect(effect, fov, t) {
        if (!this.isInCameraBounds(effect.x, effect.y)) {
            return;
        }

        const shouldHideUnseenTiles = this.shouldHideUnseenTilesForFloor(this.game?.world?.currentFloor);
        if (!this.isTileRevealed(effect.x, effect.y, fov, shouldHideUnseenTiles)) {
            return;
        }

        const center = this.getScreenCenter(effect.x, effect.y);
        const tileSize = this.getTileSize();
        const radius = tileSize * (0.35 + t * 0.78);
        const alpha = Math.max(0, 0.92 - t * 0.95);

        let fill = UI_VISUALS.hitPulseNeutral;
        if (effect.targetSide === 'player') {
            fill = UI_VISUALS.hitPulsePlayer;
        } else if (effect.targetSide === 'enemy') {
            fill = UI_VISUALS.hitPulseEnemy;
        }

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = fill;
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    },

    renderTopDownScene(world, player, fov) {
        const tileSize = this.getTileSize();
        const shouldUseFog = this.shouldUseFogForFloor(world.currentFloor);
        const shouldHideUnseenTiles = this.shouldHideUnseenTilesForFloor(world.currentFloor);

        if (this.isActorBlind(player)) {
            this.renderPlayer(player);
            this.renderTransientEffects(world, fov, performance.now());
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

        for (const [key] of world.getCurrentFloor().items) {
            const [x, y] = this.parseGridKey(key);
            if (!this.isInCameraBounds(x, y)) continue;
            const isVisible = this.isTileCurrentlyVisible(x, y, fov, shouldHideUnseenTiles);
            if (this.isTileRevealed(x, y, fov, shouldHideUnseenTiles)) {
                this.withTemporaryAlpha(this.ctx, shouldUseFog ? this.getVisibilityAlpha(isVisible) : 1, () => {
                    this.renderItem(world, x, y);
                });
            }
        }

        for (const enemy of world.getEnemies()) {
            if (!this.isInCameraBounds(enemy.x, enemy.y)) continue;
            if (!this.isEnemyVisibleInFov(enemy, fov)) continue;
            this.renderEnemy(enemy);
        }

        this.renderPlayer(player);

        for (const od of overdrawQueue) {
            this.ctx.drawImage(
                this.tileset.spriteSheet,
                od.srcRect.x, od.srcRect.y, od.srcRect.width, od.overdrawTop,
                od.screenX, od.screenY - od.drawOffsetY, tileSize, od.drawOffsetY
            );
        }

        this.renderTransientEffects(world, fov, performance.now());
    },

    getActiveEventBannerData(world) {
        const activeEvent = world?.getCurrentFloor?.()?.meta?.activeEvent;
        if (!activeEvent) {
            return null;
        }

        const turnsRemaining = Math.max(0, Math.floor(Number(activeEvent.turnsRemaining) || 0));
        if (activeEvent.type === 'food-party') {
            return {
                title: 'Random Event: Food Party',
                objective: 'Collect the spawned food before it disappears.',
                turnsRemaining
            };
        }

        if (activeEvent.type === 'throwing-challenge') {
            const requiredKills = Math.max(1, Math.floor(Number(activeEvent.requiredKills) || 1));
            const currentKills = clamp(Math.floor(Number(activeEvent.currentKills) || 0), 0, requiredKills);
            return {
                title: 'Random Event: Throwing Challenge',
                objective: `Defeat enemies with thrown items (${currentKills}/${requiredKills}).`,
                turnsRemaining
            };
        }

        return {
            title: 'Random Event Active',
            objective: 'Complete the event objective.',
            turnsRemaining
        };
    },

    renderActiveEventBanner(world) {
        const bannerData = this.getActiveEventBannerData(world);
        if (!bannerData) {
            return;
        }

        const { title, objective, turnsRemaining } = bannerData;
        const textLine = `${objective} Time left: ${turnsRemaining} turns.`;
        const paddingX = 12;
        const topY = 8;
        const lineHeight = 18;
        const boxWidth = Math.min(this.canvas.width - 16, Math.max(320, this.canvas.width * 0.9));
        const boxX = Math.floor((this.canvas.width - boxWidth) / 2);
        const boxHeight = 48;

        this.ctx.save();
        this.ctx.globalAlpha = 0.9;
        this.ctx.fillStyle = 'rgba(8, 12, 20, 0.9)';
        this.ctx.fillRect(boxX, topY, boxWidth, boxHeight);
        this.ctx.strokeStyle = '#f7c948';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(boxX, topY, boxWidth, boxHeight);

        this.ctx.globalAlpha = 1;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.font = 'bold 14px monospace';
        this.ctx.fillStyle = '#f7c948';
        this.ctx.fillText(title, boxX + paddingX, topY + 6);

        this.ctx.font = '12px monospace';
        this.ctx.fillStyle = '#f4f7ff';
        this.ctx.fillText(textLine, boxX + paddingX, topY + 6 + lineHeight);
        this.ctx.restore();
    },

    renderTile(x, y, world, fov) {
        const tileSize = this.getTileSize();
        const shouldUseFog = this.shouldUseFogForFloor(world.currentFloor);
        const shouldHideUnseenTiles = this.shouldHideUnseenTilesForFloor(world.currentFloor);

        if (!this.tileset.isReady()) {
            return null;
        }

        const tile = world.getTile(x, y);
        const overlays = this.getTileOverlayData(world, x, y);

        if (!this.isTileRevealed(x, y, fov, shouldHideUnseenTiles)) {
            return;
        }

        const screenPos = this.worldToTopDownScreen(x, y);
        const metrics = this.tileset.getRenderMetrics(tile, tileSize, world, x, y);
        const srcRect = metrics.sourceRect;
        const isVisible = this.isTileCurrentlyVisible(x, y, fov, shouldHideUnseenTiles);
        const overdrawTop = metrics.overdrawTop;
        const drawOffsetY = metrics.drawOffsetY;
        const drawHeight = metrics.drawHeight;

        this.ctx.drawImage(
            this.tileset.spriteSheet,
            srcRect.x, srcRect.y, srcRect.width, srcRect.height,
            screenPos.x, screenPos.y - drawOffsetY, tileSize, drawHeight
        );

        this.renderTileOverlays(this.ctx, overlays.hazard, overlays.trapType, overlays.trapRevealed, screenPos.x, screenPos.y, tileSize);

        if (shouldUseFog && !isVisible && fov.isExplored(x, y)) {
            this.ctx.fillStyle = COLORS.FOG_OVERLAY;
            this.ctx.fillRect(screenPos.x, screenPos.y - drawOffsetY, tileSize, drawHeight);
        }

        if (isVisible && drawOffsetY > 0) {
            return { srcRect, overdrawTop, drawOffsetY, screenX: screenPos.x, screenY: screenPos.y };
        }
        return null;
    },

    renderPlayer(player) {
        const tileSize = this.getTileSize();
        const screenPos = this.worldToTopDownScreen(player.x, player.y);
        this.renderPlayerMarker(this.ctx, screenPos.x, screenPos.y, tileSize, player);

        const facing = getActorFacing(player);
        this.renderPlayerFacingArrow(screenPos.x, screenPos.y, facing, tileSize);
        this.renderHealthBar(player, screenPos.x, screenPos.y, HEALTH_BAR_PALETTES.player);
    },

    renderPlayerMarker(ctx, x, y, size, player) {
        const playerVisual = getEntityVisual('player', player);
        ctx.fillStyle = playerVisual.color;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
        ctx.fill();
    },

    renderPlayerFacingArrow(x, y, facing, tileSize) {
        const cx = x + tileSize / 2;
        const cy = y + tileSize / 2;
        const tip = tileSize * 0.38;
        const wing = tileSize * 0.2;
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
    },

    getHealthBarFillColor(ratio, palette) {
        if (ratio > 0.66) {
            return palette.high;
        }
        if (ratio > 0.33) {
            return palette.mid;
        }
        return palette.low;
    },

    renderHealthBar(actor, screenX, screenY, palette) {
        const tileSize = this.getTileSize();
        const maxHealth = Math.max(1, Number(actor?.maxHealth) || 1);
        const health = clamp(Number(actor?.health) || 0, 0, maxHealth);
        const ratio = health / maxHealth;

        const barWidth = tileSize;
        const barHeight = Math.max(3, Math.round(tileSize * 0.18));
        const barX = screenX;
        const barY = screenY - Math.max(5, Math.round(tileSize * 0.3));

        this.ctx.save();
        this.ctx.fillStyle = palette.background;
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        this.ctx.fillStyle = this.getHealthBarFillColor(ratio, palette);
        this.ctx.fillRect(barX, barY, Math.round(barWidth * ratio), barHeight);

        this.ctx.strokeStyle = palette.border;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1);
        this.ctx.restore();
    },

    renderEnemy(enemy) {
        const tileSize = this.getTileSize();
        const screenPos = this.worldToTopDownScreen(enemy.x, enemy.y);
        this.ctx.fillStyle = getEntityVisual('enemy', enemy).color;
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x + tileSize / 2, screenPos.y + tileSize / 2, tileSize * 0.42, 0, Math.PI * 2);
        this.ctx.fill();

        this.renderEnemyName(enemy, screenPos.x, screenPos.y);
        this.renderHealthBar(enemy, screenPos.x, screenPos.y, HEALTH_BAR_PALETTES.enemy);
    },

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
    },

    renderEnemyName(enemy, screenX, screenY) {
        const tileSize = this.getTileSize();
        const label = this.getEnemyDisplayName(enemy);
        if (!label) {
            return;
        }

        this.ctx.save();
        this.ctx.font = `bold ${Math.max(8, Math.floor(tileSize * 0.5))}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = UI_VISUALS.enemyNameOutline;
        this.ctx.fillStyle = UI_VISUALS.enemyNameColor;

        const textX = screenX + tileSize / 2;
        const textY = screenY + tileSize / 2;
        this.ctx.strokeText(label, textX, textY);
        this.ctx.fillText(label, textX, textY);
        this.ctx.restore();
    },

    getItemTypeAt(world, x, y) {
        const items = world.getItems(x, y);
        if (!Array.isArray(items) || items.length === 0) {
            return null;
        }

        return items[items.length - 1]?.type || null;
    },

    renderItem(world, x, y) {
        const tileSize = this.getTileSize();
        const screenPos = this.worldToTopDownScreen(x, y);
        const itemVisual = getEntityVisual('item');
        const inset = Math.max(1, Math.round(tileSize * 0.25));
        const itemType = this.getItemTypeAt(world, x, y);
        this.ctx.fillStyle = getItemTypeColor(itemType, itemVisual.color);
        this.ctx.fillRect(
            screenPos.x + inset,
            screenPos.y + inset,
            tileSize - inset * 2,
            tileSize - inset * 2
        );
    },

    renderTileOverlays(ctx, hazard, trapType, trapRevealed, x, y, size) {
        if (hazard === HAZARD_TYPES.STEAM) {
            this.renderSteamOverlay(ctx, x, y, size);
        }

        if (trapType && trapRevealed) {
            this.renderTrapOverlay(ctx, trapType, x, y, size);
        }
    },

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
    },

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
    },

    getTrapIcon(trapType) {
        return getTrapDefinition(trapType)?.icon || null;
    },

    isActorBlind(actor) {
        return typeof actor?.hasCondition === 'function' && actor.hasCondition(CONDITIONS.BLIND);
    },

    isEnemyInvisible(enemy) {
        return typeof enemy?.hasCondition === 'function' && enemy.hasCondition(CONDITIONS.INVISIBLE);
    },

    shouldRenderEnemy(enemy, isVisibleFn = () => true) {
        if (this.isEnemyInvisible(enemy)) {
            return false;
        }
        if (!isVisibleFn(enemy.x, enemy.y)) {
            return false;
        }
        return true;
    },

    isEnemyVisibleInFov(enemy, fov) {
        return this.shouldRenderEnemy(enemy, (x, y) => Boolean(fov?.isVisible(x, y)));
    },

    shouldUseFogForFloor(floorIndex) {
        return Number.isInteger(floorIndex) && floorIndex >= 25;
    },

    shouldHideUnseenTilesForFloor(floorIndex) {
        return Number.isInteger(floorIndex) && floorIndex > 0;
    },

    isTileRevealed(x, y, fov, shouldHideUnseenTiles) {
        return !shouldHideUnseenTiles || fov.isVisible(x, y) || fov.isExplored(x, y);
    },

    isTileCurrentlyVisible(x, y, fov, shouldHideUnseenTiles) {
        return !shouldHideUnseenTiles || fov.isVisible(x, y);
    },

    getTileOverlayData(world, x, y) {
        return {
            hazard: typeof world.getHazard === 'function' ? world.getHazard(x, y) : null,
            trapType: typeof world.getTrap === 'function' ? world.getTrap(x, y) : null,
            trapRevealed: typeof world.isTrapRevealed === 'function' ? world.isTrapRevealed(x, y) : false
        };
    },

    parseGridKey(key) {
        return fromGridKey(key);
    },

    getVisibilityAlpha(isVisible) {
        return isVisible ? COLORS.VISIBLE : COLORS.EXPLORED;
    },

    withTemporaryAlpha(ctx, alpha, drawFn) {
        const previousAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        try {
            drawFn();
        } finally {
            ctx.globalAlpha = previousAlpha;
        }
    },

    getScreenCenter(tileX, tileY) {
        const tileSize = this.getTileSize();
        const pos = this.worldToTopDownScreen(tileX, tileY);
        return {
            x: pos.x + tileSize / 2,
            y: pos.y + tileSize / 2
        };
    },

    updateCamera(player) {
        const tileSize = this.getTileSize();
        this.cameraBounds = this.getCameraBounds(player.x, player.y);

        const visibleTilesX = this.cameraBounds.maxX - this.cameraBounds.minX + 1;
        const visibleTilesY = this.cameraBounds.maxY - this.cameraBounds.minY + 1;
        this.topDownOffsetX = Math.floor((this.canvas.width - visibleTilesX * tileSize) / 2);
        this.topDownOffsetY = Math.floor((this.canvas.height - visibleTilesY * tileSize) / 2);
    },

    getCameraBounds(centerX, centerY) {
        const visibleTileCounts = this.getVisibleTileCounts();
        const visibleTilesX = visibleTileCounts.x;
        const visibleTilesY = visibleTileCounts.y;

        let minX = centerX - Math.floor(visibleTilesX / 2);
        let maxX = minX + visibleTilesX - 1;
        let minY = centerY - Math.floor(visibleTilesY / 2);
        let maxY = minY + visibleTilesY - 1;

        if (minX < 0) {
            maxX = Math.min(GRID_SIZE - 1, maxX - minX);
            minX = 0;
        }
        if (maxX > GRID_SIZE - 1) {
            minX = Math.max(0, minX - (maxX - (GRID_SIZE - 1)));
            maxX = GRID_SIZE - 1;
        }
        if (minY < 0) {
            maxY = Math.min(GRID_SIZE - 1, maxY - minY);
            minY = 0;
        }
        if (maxY > GRID_SIZE - 1) {
            minY = Math.max(0, minY - (maxY - (GRID_SIZE - 1)));
            maxY = GRID_SIZE - 1;
        }

        return { minX, maxX, minY, maxY };
    },

    isInCameraBounds(x, y) {
        return x >= this.cameraBounds.minX && x <= this.cameraBounds.maxX && y >= this.cameraBounds.minY && y <= this.cameraBounds.maxY;
    },

    worldToTopDownScreen(worldX, worldY) {
        const tileSize = this.getTileSize();
        return {
            x: this.topDownOffsetX + (worldX - this.cameraBounds.minX) * tileSize,
            y: this.topDownOffsetY + (worldY - this.cameraBounds.minY) * tileSize
        };
    },

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
});
