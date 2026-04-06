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
        const visual = getEntityVisual(role, actor);
        const key = `${role}:${quantizedSize}:${visual?.color || 'default'}`;
        if (this.actorTextureCache.has(key)) {
            return this.actorTextureCache.get(key);
        }

        const defaultBaseColor = role === 'player'
            ? 0x66d9ff
            : (role === 'ally' ? 0x7ee787 : (role === 'npc' ? 0xf6c177 : 0xff6b6b));
        const baseColor = this.toPixiColor(visual?.color, defaultBaseColor);
        const palette = this.getActorSpritePalette(role, baseColor);
        const graphic = new PIXI.Graphics();

        graphic.lineStyle(Math.max(1, Math.floor(quantizedSize * 0.06)), palette.outline, 0.95);

        if (role === 'player') {
            this.drawPlayerSpriteGraphic(graphic, quantizedSize, palette);
        } else if (role === 'ally') {
            this.drawAllySpriteGraphic(graphic, quantizedSize, palette);
        } else if (role === 'npc') {
            this.drawNpcSpriteGraphic(graphic, quantizedSize, palette);
        } else {
            this.drawEnemySpriteGraphic(graphic, quantizedSize, palette);
        }

        const texture = this.app.renderer.generateTexture(graphic, {
            resolution: window.devicePixelRatio || 1,
            region: new PIXI.Rectangle(0, 0, quantizedSize, quantizedSize)
        });
        graphic.destroy(true);
        this.actorTextureCache.set(key, texture);
        return texture;
    },

    getActorSpritePalette(role, baseColor) {
        const accentColor = role === 'player'
            ? 0xf7d774
            : (role === 'ally' ? 0xc9ffd7 : (role === 'npc' ? 0x8b5cf6 : 0xffd166));

        return {
            outline: 0x0b0f14,
            shadow: this.mixPixiColor(baseColor, 0x05070a, 0.72),
            primary: this.mixPixiColor(baseColor, 0x10141b, 0.18),
            secondary: this.mixPixiColor(baseColor, 0x06080d, 0.44),
            accent: accentColor,
            highlight: this.mixPixiColor(baseColor, 0xffffff, 0.36),
            face: role === 'enemy' ? this.mixPixiColor(baseColor, 0xffffff, 0.16) : 0xf2d3ad,
            eye: role === 'enemy' ? 0xfff0a8 : 0x17202b,
            metal: 0xd9e2ec
        };
    },

    drawPlayerSpriteGraphic(graphic, size, palette) {
        const center = size / 2;
        const bottom = size * 0.84;

        graphic.beginFill(palette.secondary, 1);
        graphic.drawPolygon([
            center, size * 0.13,
            size * 0.74, size * 0.34,
            size * 0.7, bottom,
            size * 0.3, bottom,
            size * 0.26, size * 0.34
        ]);
        graphic.endFill();

        graphic.beginFill(palette.primary, 1);
        graphic.drawRoundedRect(center - size * 0.19, bottom - size * 0.4, size * 0.38, size * 0.29, size * 0.09);
        graphic.endFill();

        graphic.beginFill(palette.accent, 0.98);
        graphic.drawRect(center - size * 0.055, bottom - size * 0.36, size * 0.11, size * 0.24);
        graphic.endFill();

        graphic.beginFill(palette.metal, 0.95);
        graphic.drawCircle(center + size * 0.09, bottom - size * 0.21, size * 0.03);
        graphic.endFill();

        graphic.beginFill(palette.face, 1);
        graphic.drawCircle(center, size * 0.27, size * 0.13);
        graphic.endFill();

        graphic.beginFill(palette.highlight, 0.95);
        graphic.drawEllipse(center - size * 0.07, size * 0.22, size * 0.07, size * 0.04);
        graphic.endFill();

        graphic.beginFill(palette.eye, 0.9);
        graphic.drawCircle(center - size * 0.04, size * 0.28, size * 0.013);
        graphic.drawCircle(center + size * 0.04, size * 0.28, size * 0.013);
        graphic.endFill();
    },

    drawAllySpriteGraphic(graphic, size, palette) {
        const center = size / 2;
        const bottom = size * 0.84;

        graphic.beginFill(palette.secondary, 1);
        graphic.drawPolygon([
            center, size * 0.1,
            size * 0.84, size * 0.34,
            size * 0.72, bottom,
            center, size * 0.75,
            size * 0.28, bottom,
            size * 0.16, size * 0.34
        ]);
        graphic.endFill();

        graphic.beginFill(palette.primary, 1);
        graphic.drawPolygon([
            center, size * 0.2,
            size * 0.7, size * 0.38,
            size * 0.62, size * 0.66,
            center, size * 0.72,
            size * 0.38, size * 0.66,
            size * 0.3, size * 0.38
        ]);
        graphic.endFill();

        graphic.beginFill(palette.accent, 0.98);
        graphic.drawCircle(center, size * 0.47, size * 0.1);
        graphic.endFill();

        graphic.beginFill(palette.highlight, 0.9);
        graphic.drawPolygon([
            center, size * 0.28,
            size * 0.58, size * 0.46,
            center, size * 0.6,
            size * 0.42, size * 0.46
        ]);
        graphic.endFill();
    },

    drawNpcSpriteGraphic(graphic, size, palette) {
        const center = size / 2;
        const bottom = size * 0.84;

        graphic.beginFill(palette.secondary, 1);
        graphic.drawRoundedRect(center - size * 0.23, bottom - size * 0.38, size * 0.46, size * 0.34, size * 0.12);
        graphic.endFill();

        graphic.beginFill(palette.primary, 1);
        graphic.drawPolygon([
            center - size * 0.18, bottom - size * 0.1,
            center + size * 0.18, bottom - size * 0.1,
            center + size * 0.26, bottom,
            center - size * 0.26, bottom
        ]);
        graphic.endFill();

        graphic.beginFill(palette.face, 1);
        graphic.drawCircle(center, size * 0.27, size * 0.12);
        graphic.endFill();

        graphic.beginFill(palette.accent, 0.98);
        graphic.drawRect(center + size * 0.1, bottom - size * 0.28, size * 0.1, size * 0.22);
        graphic.endFill();

        graphic.beginFill(palette.highlight, 0.9);
        graphic.drawEllipse(center - size * 0.06, size * 0.22, size * 0.07, size * 0.04);
        graphic.endFill();

        graphic.beginFill(palette.eye, 0.85);
        graphic.drawCircle(center - size * 0.035, size * 0.28, size * 0.012);
        graphic.drawCircle(center + size * 0.035, size * 0.28, size * 0.012);
        graphic.endFill();
    },

    drawEnemySpriteGraphic(graphic, size, palette) {
        const center = size / 2;
        const bottom = size * 0.84;

        graphic.beginFill(palette.secondary, 1);
        graphic.drawPolygon([
            size * 0.18, bottom,
            size * 0.14, size * 0.54,
            size * 0.08, size * 0.36,
            size * 0.24, size * 0.18,
            center, size * 0.12,
            size * 0.76, size * 0.18,
            size * 0.92, size * 0.36,
            size * 0.86, size * 0.54,
            size * 0.82, bottom,
            size * 0.62, size * 0.72,
            size * 0.38, size * 0.72
        ]);
        graphic.endFill();

        graphic.beginFill(palette.primary, 1);
        graphic.drawPolygon([
            center, size * 0.22,
            size * 0.7, size * 0.36,
            size * 0.66, size * 0.64,
            center, size * 0.72,
            size * 0.34, size * 0.64,
            size * 0.3, size * 0.36
        ]);
        graphic.endFill();

        graphic.beginFill(palette.accent, 0.98);
        graphic.drawPolygon([
            size * 0.28, size * 0.2,
            size * 0.38, size * 0.07,
            size * 0.46, size * 0.24
        ]);
        graphic.drawPolygon([
            size * 0.72, size * 0.2,
            size * 0.62, size * 0.07,
            size * 0.54, size * 0.24
        ]);
        graphic.endFill();

        graphic.beginFill(palette.eye, 0.98);
        graphic.drawCircle(center - size * 0.1, size * 0.4, size * 0.03);
        graphic.drawCircle(center + size * 0.1, size * 0.4, size * 0.03);
        graphic.endFill();

        graphic.beginFill(0x2a0f11, 0.9);
        graphic.drawPolygon([
            center - size * 0.1, size * 0.52,
            center + size * 0.1, size * 0.52,
            center, size * 0.62
        ]);
        graphic.endFill();
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
