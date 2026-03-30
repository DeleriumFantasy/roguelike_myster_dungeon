// Pixi sprite generation and texture caching system.
//
// Generates procedural actor sprites (player, ally, NPC, enemy) using Pixi Graphics,
// caches them by role and size, and provides color mixing utilities for sprite rendering.

Object.assign(PixiSceneOverlay.prototype, {
    getTextureForRect(rect) {
        if (!this.baseTexture || !rect) {
            return null;
        }

        const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
        if (this.textureCache.has(key)) {
            return this.textureCache.get(key);
        }

        const texture = new PIXI.Texture(this.baseTexture, new PIXI.Rectangle(rect.x, rect.y, rect.width, rect.height));
        this.textureCache.set(key, texture);
        return texture;
    },

    syncBaseTexture(ui) {
        const spriteSheet = ui?.tileset?.spriteSheet;
        if (!spriteSheet) {
            return false;
        }

        if (this.boundSpriteSheet === spriteSheet && this.baseTexture) {
            return true;
        }

        this.boundSpriteSheet = spriteSheet;
        this.baseTexture = PIXI.BaseTexture.from(spriteSheet);
        this.textureCache.clear();
        return true;
    },

    getActorSpriteTexture(actor, isPlayer, tileSize) {
        if (!this.app?.renderer) {
            return null;
        }

        const role = isPlayer
            ? 'player'
            : (actor?.isAlly ? 'ally' : (isNeutralNpcActor(actor) ? 'npc' : 'enemy'));
        const quantizedSize = Math.max(8, Math.round(tileSize));
        const key = `${role}:${quantizedSize}`;
        if (this.actorTextureCache.has(key)) {
            return this.actorTextureCache.get(key);
        }

        const visual = isPlayer ? getEntityVisual('player', actor) : getEntityVisual('enemy', actor);
        const color = this.toPixiColor(visual.color);
        const outline = 0x111111;
        const shadowColor = this.mixPixiColor(color, 0x05070a, 0.6);
        const bodyColor = this.mixPixiColor(color, 0x0d1016, 0.14);
        const accentColor = isPlayer
            ? 0x8fe7ff
            : (role === 'ally' ? 0x9ef0a8 : (role === 'npc' ? 0xf4cd84 : 0xff8b76));
        const highlightColor = this.mixPixiColor(color, 0xffffff, 0.3);
        const faceColor = isPlayer
            ? 0xf4d6aa
            : (role === 'npc' ? 0xe8c697 : this.mixPixiColor(color, 0xffffff, 0.12));
        const center = quantizedSize / 2;
        const spriteBottom = quantizedSize * 0.83;
        const graphic = new PIXI.Graphics();

        graphic.beginFill(shadowColor, 0.28);
        graphic.drawEllipse(center, quantizedSize * 0.84, quantizedSize * 0.24, quantizedSize * 0.1);
        graphic.endFill();

        graphic.lineStyle(Math.max(1, Math.floor(quantizedSize * 0.06)), outline, 0.95);
        if (isPlayer) {
            const bodyWidth = quantizedSize * 0.58;
            const bodyHeight = quantizedSize * 0.34;
            const cloakWidth = quantizedSize * 0.68;
            const cloakHeight = quantizedSize * 0.42;

            graphic.beginFill(this.mixPixiColor(bodyColor, 0x091a28, 0.5), 1);
            graphic.drawRoundedRect(center - cloakWidth / 2, spriteBottom - cloakHeight, cloakWidth, cloakHeight, quantizedSize * 0.16);
            graphic.endFill();

            graphic.beginFill(bodyColor, 1);
            graphic.drawRoundedRect(center - bodyWidth / 2, spriteBottom - bodyHeight - quantizedSize * 0.06, bodyWidth, bodyHeight, quantizedSize * 0.14);
            graphic.endFill();

            graphic.beginFill(accentColor, 0.95);
            graphic.drawRect(center - quantizedSize * 0.05, spriteBottom - bodyHeight - quantizedSize * 0.05, quantizedSize * 0.1, bodyHeight * 0.9);
            graphic.endFill();

            graphic.beginFill(faceColor, 1);
            graphic.drawCircle(center, quantizedSize * 0.28, quantizedSize * 0.15);
            graphic.endFill();

            graphic.beginFill(highlightColor, 0.85);
            graphic.drawEllipse(center - quantizedSize * 0.08, quantizedSize * 0.23, quantizedSize * 0.08, quantizedSize * 0.05);
            graphic.endFill();
        } else if (role === 'ally') {
            graphic.beginFill(bodyColor, 1);
            graphic.drawPolygon([
                center, quantizedSize * 0.2,
                quantizedSize * 0.8, quantizedSize * 0.46,
                center, spriteBottom,
                quantizedSize * 0.2, quantizedSize * 0.46
            ]);
            graphic.endFill();

            graphic.beginFill(accentColor, 0.95);
            graphic.drawPolygon([
                center, quantizedSize * 0.34,
                quantizedSize * 0.63, quantizedSize * 0.48,
                center, quantizedSize * 0.68,
                quantizedSize * 0.37, quantizedSize * 0.48
            ]);
            graphic.endFill();

            graphic.beginFill(highlightColor, 0.8);
            graphic.drawCircle(center, quantizedSize * 0.48, quantizedSize * 0.06);
            graphic.endFill();
        } else if (role === 'npc') {
            const torsoWidth = quantizedSize * 0.54;
            const torsoHeight = quantizedSize * 0.34;
            graphic.beginFill(bodyColor, 1);
            graphic.drawRoundedRect(center - torsoWidth / 2, spriteBottom - torsoHeight - quantizedSize * 0.06, torsoWidth, torsoHeight, quantizedSize * 0.14);
            graphic.endFill();

            graphic.beginFill(faceColor, 1);
            graphic.drawCircle(center, quantizedSize * 0.27, quantizedSize * 0.14);
            graphic.endFill();

            graphic.beginFill(accentColor, 0.95);
            graphic.drawRect(center + torsoWidth * 0.08, spriteBottom - torsoHeight * 0.9, quantizedSize * 0.12, torsoHeight * 0.72);
            graphic.endFill();

            graphic.beginFill(highlightColor, 0.7);
            graphic.drawEllipse(center - quantizedSize * 0.06, quantizedSize * 0.24, quantizedSize * 0.07, quantizedSize * 0.05);
            graphic.endFill();
        } else {
            graphic.beginFill(bodyColor, 1);
            graphic.drawPolygon([
                center, quantizedSize * 0.12,
                quantizedSize * 0.78, quantizedSize * 0.3,
                quantizedSize * 0.84, quantizedSize * 0.62,
                center, spriteBottom,
                quantizedSize * 0.16, quantizedSize * 0.62,
                quantizedSize * 0.22, quantizedSize * 0.3
            ]);
            graphic.endFill();

            graphic.beginFill(accentColor, 0.95);
            graphic.drawPolygon([
                quantizedSize * 0.3, quantizedSize * 0.22,
                quantizedSize * 0.4, quantizedSize * 0.1,
                quantizedSize * 0.46, quantizedSize * 0.24
            ]);
            graphic.drawPolygon([
                quantizedSize * 0.7, quantizedSize * 0.22,
                quantizedSize * 0.6, quantizedSize * 0.1,
                quantizedSize * 0.54, quantizedSize * 0.24
            ]);
            graphic.endFill();

            graphic.beginFill(0xfff3bd, 0.95);
            graphic.drawCircle(center - quantizedSize * 0.11, quantizedSize * 0.42, quantizedSize * 0.045);
            graphic.drawCircle(center + quantizedSize * 0.11, quantizedSize * 0.42, quantizedSize * 0.045);
            graphic.endFill();
        }

        graphic.beginFill(0xffffff, 0.14);
        graphic.drawEllipse(center - quantizedSize * 0.1, quantizedSize * 0.2, quantizedSize * 0.12, quantizedSize * 0.08);
        graphic.endFill();

        const texture = this.app.renderer.generateTexture(graphic, {
            resolution: window.devicePixelRatio || 1,
            region: new PIXI.Rectangle(0, 0, quantizedSize, quantizedSize)
        });
        graphic.destroy(true);
        this.actorTextureCache.set(key, texture);
        return texture;
    },

    toPixiColor(colorValue, fallback = 0xffffff) {
        if (typeof colorValue !== 'string' || colorValue.length === 0) {
            return fallback;
        }

        if (window.PIXI?.utils?.string2hex) {
            return PIXI.utils.string2hex(colorValue);
        }

        return fallback;
    },

    mixPixiColor(sourceColor, targetColor, amount = 0.5) {
        const mixAmount = clamp(Number(amount) || 0, 0, 1);
        const sourceRed = (sourceColor >> 16) & 0xff;
        const sourceGreen = (sourceColor >> 8) & 0xff;
        const sourceBlue = sourceColor & 0xff;
        const targetRed = (targetColor >> 16) & 0xff;
        const targetGreen = (targetColor >> 8) & 0xff;
        const targetBlue = targetColor & 0xff;

        const red = Math.round(sourceRed + (targetRed - sourceRed) * mixAmount);
        const green = Math.round(sourceGreen + (targetGreen - sourceGreen) * mixAmount);
        const blue = Math.round(sourceBlue + (targetBlue - sourceBlue) * mixAmount);
        return (red << 16) + (green << 8) + blue;
    },

    parseCssColor(colorValue, fallbackColor = 0xffffff) {
        if (typeof colorValue !== 'string') {
            return { color: fallbackColor, alpha: 1 };
        }

        const rgbaMatch = colorValue.match(/rgba?\(([^)]+)\)/i);
        if (rgbaMatch) {
            const parts = rgbaMatch[1].split(',').map((part) => Number(part.trim()));
            const red = clamp(Math.floor(parts[0] || 0), 0, 255);
            const green = clamp(Math.floor(parts[1] || 0), 0, 255);
            const blue = clamp(Math.floor(parts[2] || 0), 0, 255);
            const alpha = parts.length > 3 ? clamp(Number(parts[3]) || 0, 0, 1) : 1;
            return {
                color: (red << 16) + (green << 8) + blue,
                alpha
            };
        }

        return {
            color: this.toPixiColor(colorValue, fallbackColor),
            alpha: 1
        };
    }
});
