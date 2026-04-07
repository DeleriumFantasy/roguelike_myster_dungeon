// Pixi actor rendering: sprites, glows, health bars, and name labels.
//
// Handles drawing individual actors (player, allies, NPCs, enemies) with
// procedural textures, glow effects, health indicators, and animated positioning.

Object.assign(PixiSceneOverlay.prototype, {
    renderActors(renderState) {
        const { ui, player, tileSize, visibleActors } = renderState;

        if (renderState.playerBlind) {
            return;
        }

        for (const actor of visibleActors) {
            if (actor === player) {
                continue;
            }

            if (!ui.isInCameraBounds(actor.x, actor.y)) {
                continue;
            }

            this.renderActorMarker(renderState, actor, false);
        }

        this.renderActorMarker(renderState, player, true);
    },

    renderActorMarker(renderState, actor, isPlayer) {
        const { ui, tileSize, now } = renderState;
        const screenPos = this.getScreenPositionFromState(renderState, actor.x, actor.y);
        const centerX = screenPos.x + tileSize / 2;
        const centerY = screenPos.y + tileSize / 2;
        const groundY = screenPos.y + tileSize * 0.8;
        const animationTime = now;
        const bobOffset = Math.sin((animationTime * 0.004) + (actor.x * 0.9) + (actor.y * 0.6)) * Math.max(1, tileSize * 0.04);
        const breatheScale = 1 + Math.sin((animationTime * 0.0032) + (actor.x * 0.5) + (actor.y * 0.35)) * 0.025;
        const actorTexture = this.getActorSpriteTexture(actor, isPlayer, tileSize);
        this.renderActorGlow(actor, centerX, groundY + bobOffset * 0.2, tileSize, isPlayer);
        if (actorTexture) {
            const sprite = this.acquireSprite(actorTexture);
            sprite.anchor.set(0.5, 0.58);
            sprite.x = centerX;
            sprite.y = screenPos.y + tileSize * 0.58 + bobOffset;
            sprite.width = tileSize;
            sprite.height = tileSize;
            sprite.scale.x = (isPlayer ? 1.04 : 1) * breatheScale;
            sprite.scale.y = (isPlayer ? 1.04 : 1) * breatheScale;
            this.actorSpriteLayer.addChild(sprite);
        }

        if (isPlayer) {
            this.renderPlayerFacingArrow(actor, centerX, centerY + bobOffset, tileSize);
            this.renderPlayerLowHungerAlert(actor, centerX, screenPos.y, tileSize, bobOffset);
            this.renderHealthBar(actor, screenPos.x, screenPos.y, HEALTH_BAR_PALETTES.player, tileSize);
            return;
        }

        this.renderHealthBar(
            actor,
            screenPos.x,
            screenPos.y,
            HEALTH_BAR_PALETTES.enemy,
            tileSize,
            ui.getEnemyDisplayName(actor)
        );
    },

    renderActorGlow(actor, centerX, centerY, tileSize, isPlayer) {
        const glowColor = isPlayer
            ? 0x91dfff
            : (actor?.isAlly ? 0x97e89c : (isNeutralNpcActor(actor) ? 0xf4cc82 : 0xff7b73));
        const alpha = isPlayer ? 0.12 : (actor?.isAlly ? 0.1 : 0.06);

        this.actorLayer.beginFill(glowColor, alpha);
        this.actorLayer.drawEllipse(centerX, centerY + tileSize * 0.04, tileSize * 0.28, tileSize * 0.18);
        this.actorLayer.endFill();
    },

    renderPlayerFacingArrow(player, centerX, centerY, tileSize) {
        const facing = getActorFacing(player);
        const direction = normalizeDirection(facing?.dx, facing?.dy, { dx: 0, dy: -1 });
        const ux = direction.dx;
        const uy = direction.dy;
        const px = -uy;
        const py = ux;
        const offset = tileSize * 0.24;
        const length = tileSize * 0.16;
        const halfWidth = tileSize * 0.08;
        const baseCenterX = centerX + ux * offset;
        const baseCenterY = centerY + uy * offset;

        this.actorLayer.lineStyle(Math.max(1, Math.round(tileSize * 0.045)), 0xffffff, 0.95);
        this.actorLayer.beginFill(this.toPixiColor(UI_VISUALS.playerFacingArrow), 0.95);
        this.actorLayer.drawPolygon([
            baseCenterX + ux * length, baseCenterY + uy * length,
            baseCenterX - ux * length * 0.55 + px * halfWidth, baseCenterY - uy * length * 0.55 + py * halfWidth,
            baseCenterX - ux * length * 0.55 - px * halfWidth, baseCenterY - uy * length * 0.55 - py * halfWidth
        ]);
        this.actorLayer.endFill();
        this.actorLayer.lineStyle(0, 0, 0);
    },

    renderPlayerLowHungerAlert(player, centerX, screenY, tileSize, bobOffset = 0) {
        const hunger = Number(player?.hunger || 0);
        if (!Number.isFinite(hunger) || hunger > 5) {
            return;
        }

        const text = this.acquireText('player-low-hunger-alert', {
            fontFamily: 'monospace',
            fontSize: Math.max(10, Math.floor(tileSize * 0.72)),
            fontWeight: '900',
            fill: '#ffdd57',
            stroke: '#000000',
            strokeThickness: Math.max(2, Math.round(tileSize * 0.08)),
            align: 'center'
        }, '!');
        text.anchor.set(0.5, 0.5);
        text.x = centerX;
        text.y = screenY - Math.max(8, Math.round(tileSize * 0.22)) + bobOffset * 0.2;
        this.actorLabelLayer.addChild(text);
    },

    renderHealthBar(actor, screenX, screenY, palette, tileSize, labelText = '') {
        const maxHealth = Math.max(1, Number(actor?.maxHealth) || 1);
        const health = clamp(Number(actor?.health) || 0, 0, maxHealth);
        const ratio = health / maxHealth;
        const trimmedLabel = typeof labelText === 'string' ? labelText.trim() : '';
        const showLabel = trimmedLabel.length > 0;
        const displayLabel = showLabel && trimmedLabel.length > 14
            ? `${trimmedLabel.slice(0, 13)}…`
            : trimmedLabel;

        const barWidth = tileSize;
        const barHeight = showLabel
            ? Math.max(7, Math.round(tileSize * 0.22))
            : Math.max(3, Math.round(tileSize * 0.16));
        const barX = screenX + Math.round((tileSize - barWidth) / 2);
        const barY = screenY - Math.max(showLabel ? 5 : 4, Math.round(tileSize * (showLabel ? 0.28 : 0.24)));
        const fillColor = ratio > 0.66
            ? palette.high
            : (ratio > 0.33 ? palette.mid : palette.low);

        this.actorLayer.beginFill(this.toPixiColor(palette.background), 1);
        this.actorLayer.drawRect(barX, barY, barWidth, barHeight);
        this.actorLayer.endFill();

        this.actorLayer.beginFill(this.toPixiColor(fillColor), 1);
        this.actorLayer.drawRect(barX, barY, Math.round(barWidth * ratio), barHeight);
        this.actorLayer.endFill();

        this.actorLayer.lineStyle(1, this.toPixiColor(palette.border), 1);
        this.actorLayer.drawRect(barX, barY, barWidth, barHeight);
        this.actorLayer.lineStyle(0, 0, 0);

        if (!showLabel) {
            return;
        }

        const availableTextWidth = Math.max(8, barWidth - 4);
        const maxFontSize = Math.max(6, Math.floor(tileSize * 0.18));
        const estimatedFontSize = Math.floor(availableTextWidth / Math.max(1, displayLabel.length) / 0.62);
        const labelFontSize = Math.max(4, Math.min(maxFontSize, estimatedFontSize));

        const text = this.acquireText('healthbar-label', {
            fontFamily: 'monospace',
            fontSize: labelFontSize,
            fontWeight: '700',
            fill: UI_VISUALS.enemyNameColor,
            stroke: UI_VISUALS.enemyNameOutline,
            strokeThickness: labelFontSize <= 5 ? 1 : 2,
            align: 'center'
        }, displayLabel);
        text.anchor.set(0.5, 0.5);
        text.x = barX + barWidth / 2;
        text.y = barY + barHeight / 2;
        this.actorLabelLayer.addChild(text);
    },

    renderEnemyLabel() {
        return;
    }
});
