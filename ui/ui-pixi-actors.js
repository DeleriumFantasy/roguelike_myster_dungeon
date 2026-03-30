// Pixi actor rendering: sprites, glows, health bars, and name labels.
//
// Handles drawing individual actors (player, allies, NPCs, enemies) with
// procedural textures, glow effects, health indicators, and animated positioning.

Object.assign(PixiSceneOverlay.prototype, {
    renderActors(renderState) {
        const { ui, player, tileSize, visibleActors } = renderState;

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
        const animationTime = now;
        const bobOffset = Math.sin((animationTime * 0.004) + (actor.x * 0.9) + (actor.y * 0.6)) * Math.max(1, tileSize * 0.04);
        const breatheScale = 1 + Math.sin((animationTime * 0.0032) + (actor.x * 0.5) + (actor.y * 0.35)) * 0.025;
        const actorTexture = this.getActorSpriteTexture(actor, isPlayer, tileSize);
        this.renderActorGlow(actor, centerX, centerY + bobOffset, tileSize, isPlayer);
        if (actorTexture) {
            const sprite = this.acquireSprite(actorTexture);
            sprite.anchor.set(0.5, 0.5);
            sprite.x = centerX;
            sprite.y = centerY + bobOffset;
            sprite.width = tileSize;
            sprite.height = tileSize;
            sprite.scale.x = (isPlayer ? 1.04 : 1) * breatheScale;
            sprite.scale.y = (isPlayer ? 1.04 : 1) * breatheScale;
            this.actorSpriteLayer.addChild(sprite);
        }

        if (isPlayer) {
            this.renderPlayerFacingArrow(actor, centerX, centerY + bobOffset, tileSize);
            this.renderHealthBar(actor, screenPos.x, screenPos.y, HEALTH_BAR_PALETTES.player, tileSize);
            return;
        }

        this.renderHealthBar(actor, screenPos.x, screenPos.y, HEALTH_BAR_PALETTES.enemy, tileSize);
        this.renderEnemyLabel(ui, actor, centerX, centerY, tileSize);
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
        const tip = tileSize * 0.38;
        const wing = tileSize * 0.2;
        const direction = normalizeDirection(facing?.dx, facing?.dy, { dx: 0, dy: -1 });
        const ux = direction.dx;
        const uy = direction.dy;
        const px = -uy;
        const py = ux;

        this.actorLayer.beginFill(this.toPixiColor(UI_VISUALS.playerFacingArrow), 1);
        this.actorLayer.drawPolygon([
            centerX + ux * tip, centerY + uy * tip,
            centerX - ux * wing + px * wing, centerY - uy * wing + py * wing,
            centerX - ux * wing - px * wing, centerY - uy * wing - py * wing
        ]);
        this.actorLayer.endFill();
    },

    renderHealthBar(actor, screenX, screenY, palette, tileSize) {
        const maxHealth = Math.max(1, Number(actor?.maxHealth) || 1);
        const health = clamp(Number(actor?.health) || 0, 0, maxHealth);
        const ratio = health / maxHealth;

        const barWidth = tileSize;
        const barHeight = Math.max(3, Math.round(tileSize * 0.18));
        const barX = screenX;
        const barY = screenY - Math.max(5, Math.round(tileSize * 0.3));
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
    },

    renderEnemyLabel(ui, actor, centerX, centerY, tileSize) {
        const label = ui.getEnemyDisplayName(actor);
        if (!label) {
            return;
        }

        const text = this.acquireText('enemy-label', {
            fontFamily: 'monospace',
            fontSize: Math.max(8, Math.floor(tileSize * 0.5)),
            fontWeight: '700',
            fill: UI_VISUALS.enemyNameColor,
            stroke: UI_VISUALS.enemyNameOutline,
            strokeThickness: 3,
            align: 'center'
        }, label);
        text.anchor.set(0.5, 0.5);
        text.x = centerX;
        text.y = centerY;
        this.actorLabelLayer.addChild(text);
    }
});
