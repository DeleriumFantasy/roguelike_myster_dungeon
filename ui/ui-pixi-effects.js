// Pixi transient effects and event banners: melee trails, projectiles, hit pulses, notifications.
//
// Manages animated combat effects (melee strikes, thrown projectiles, hit indicators)
// and active event banner rendering for objective notifications with time tracking.

Object.assign(PixiSceneOverlay.prototype, {
    renderTransientEffects(renderState) {
        const { ui, fov, now } = renderState;
        const effects = Array.isArray(ui.activeVisualEffects) ? ui.activeVisualEffects : [];
        if (effects.length === 0) {
            return;
        }

        for (const effect of effects) {
            if (!effect?.type) {
                continue;
            }

            const elapsed = now - Number(effect.startedAt || 0);
            const duration = Math.max(1, Number(effect.durationMs) || 1);
            const t = clamp(elapsed / duration, 0, 1);

            if (effect.type === 'melee-strike') {
                this.renderMeleeStrikeEffect(renderState, effect, t);
                continue;
            }

            if (effect.type === 'throw-trail') {
                this.renderThrowTrailEffect(renderState, effect, t);
                continue;
            }

            if (effect.type === 'hit-pulse') {
                this.renderHitPulseEffect(renderState, effect, t);
            }
        }
    },

    renderMeleeStrikeEffect(renderState, effect, t) {
        const { tileSize } = renderState;
        const from = this.getScreenCenterFromState(renderState, effect.fromX, effect.fromY);
        const to = this.getScreenCenterFromState(renderState, effect.toX, effect.toY);
        const progress = Math.min(1, t * 1.25);
        const drawX = from.x + (to.x - from.x) * progress;
        const drawY = from.y + (to.y - from.y) * progress;
        const baseLineWidth = Math.max(2, Math.floor(tileSize * 0.16));
        const lineWidth = baseLineWidth + (1 - t) * baseLineWidth;
        const alpha = 1 - t;
        const stroke = effect.attackerSide === 'enemy'
            ? UI_VISUALS.enemyMeleeTrail
            : UI_VISUALS.playerMeleeTrail;

        this.effectLayer.lineStyle(lineWidth, this.toPixiColor(stroke), alpha);
        this.effectLayer.moveTo(from.x, from.y);
        this.effectLayer.lineTo(drawX, drawY);
        this.effectLayer.lineStyle(0, 0, 0);
    },

    renderThrowTrailEffect(renderState, effect, t) {
        const { tileSize } = renderState;
        const from = this.getScreenCenterFromState(renderState, effect.fromX, effect.fromY);
        const to = this.getScreenCenterFromState(renderState, effect.toX, effect.toY);
        const currentX = from.x + (to.x - from.x) * t;
        const currentY = from.y + (to.y - from.y) * t;
        const projectileRadius = Math.max(2, tileSize * 0.16);

        this.effectLayer.lineStyle(Math.max(3, Math.floor(tileSize * 0.18)), this.toPixiColor(UI_VISUALS.throwTrail), 0.52);
        this.effectLayer.moveTo(from.x, from.y);
        this.effectLayer.lineTo(currentX, currentY);
        this.effectLayer.lineStyle(0, 0, 0);
        this.effectLayer.beginFill(this.toPixiColor(UI_VISUALS.throwProjectile), 1);
        this.effectLayer.drawCircle(currentX, currentY, projectileRadius);
        this.effectLayer.endFill();
    },

    renderHitPulseEffect(renderState, effect, t) {
        const { ui, tileSize } = renderState;
        if (!ui.isInCameraBounds(effect.x, effect.y)) {
            return;
        }

        if (!this.isTileRevealedInState(renderState, effect.x, effect.y)) {
            return;
        }

        const center = this.getScreenCenterFromState(renderState, effect.x, effect.y);
        const radius = tileSize * (0.35 + t * 0.78);
        const alpha = Math.max(0, 0.92 - t * 0.95);
        let fill = UI_VISUALS.hitPulseNeutral;
        if (effect.targetSide === 'player') {
            fill = UI_VISUALS.hitPulsePlayer;
        } else if (effect.targetSide === 'enemy') {
            fill = UI_VISUALS.hitPulseEnemy;
        }

        this.effectLayer.beginFill(this.toPixiColor(fill), alpha);
        this.effectLayer.drawCircle(center.x, center.y, radius);
        this.effectLayer.endFill();
    },

    renderActiveEventBanner(renderState) {
        const { ui, world } = renderState;
        const bannerData = ui.getActiveEventBannerData(world);
        if (!bannerData) {
            return;
        }

        const { title, objective, turnsRemaining, appendTurnsRemaining } = bannerData;
        const textLine = Number.isFinite(turnsRemaining) && appendTurnsRemaining
            ? `${objective} Time left: ${turnsRemaining} turns.`
            : objective;
        const paddingX = 12;
        const topY = 8;
        const lineHeight = 18;
        const boxWidth = Math.min(this.currentWidth - 16, Math.max(320, this.currentWidth * 0.9));
        const boxX = Math.floor((this.currentWidth - boxWidth) / 2);
        const boxHeight = 48;

        const box = this.acquireGraphics();
        box.beginFill(0x080c14, 0.9);
        box.lineStyle(2, 0xf7c948, 1);
        box.drawRect(boxX, topY, boxWidth, boxHeight);
        box.endFill();
        this.bannerLayer.addChild(box);

        const titleText = this.acquireText('event-banner-title', {
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: '700',
            fill: '#f7c948'
        }, title);
        titleText.x = boxX + paddingX;
        titleText.y = topY + 6;
        this.bannerLayer.addChild(titleText);

        const bodyText = this.acquireText('event-banner-body', {
            fontFamily: 'monospace',
            fontSize: 12,
            fill: '#f4f7ff'
        }, textLine);
        bodyText.x = boxX + paddingX;
        bodyText.y = topY + 6 + lineHeight;
        this.bannerLayer.addChild(bodyText);
    }
});
