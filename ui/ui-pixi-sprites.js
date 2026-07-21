// Pixi sprite generation and texture caching system.
//
// Generates procedural actor sprites (player, ally, NPC, enemy) using Pixi Graphics,
// caches them by role and size, and provides color mixing utilities for sprite rendering.

Object.assign(PixiSceneOverlay.prototype, {
    getTextureForRect(rect, spriteSheetKey = 'terrain') {
        if (!rect) {
            return null;
        }

        const sourceKey = typeof spriteSheetKey === 'string' && spriteSheetKey.length > 0
            ? spriteSheetKey
            : spriteSheetKey;
        const baseTextures = this.baseTextures instanceof Map ? this.baseTextures : null;
        const baseTexture = sourceKey === 'terrain'
            ? this.baseTexture
            : (baseTextures ? baseTextures.get(sourceKey) : null);
        if (!baseTexture) {
            return null;
        }

        const key = `${sourceKey}:${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
        if (this.textureCache.has(key)) {
            return this.textureCache.get(key);
        }

        try {
            const texture = new PIXI.Texture(baseTexture, new PIXI.Rectangle(rect.x, rect.y, rect.width, rect.height));
            this.textureCache.set(key, texture);
            return texture;
        } catch (_error) {
            return null;
        }
    },

    syncBaseTexture(ui) {
        if (!(this.baseTextures instanceof Map)) {
            this.baseTextures = new Map();
        }
        if (!(this.boundSpriteSheets instanceof Map)) {
            this.boundSpriteSheets = new Map();
        }

        const spriteSheetEntries = ui.tileset.getLoadedSpriteSheetEntries();
        if (spriteSheetEntries.length === 0) {
            return false;
        }

        let didChange = false;
        for (const [key, spriteSheet] of spriteSheetEntries) {
            if (!spriteSheet) {
                continue;
            }

            if (this.boundSpriteSheets.get(key) === spriteSheet && this.baseTextures.has(key)) {
                continue;
            }

            this.boundSpriteSheets.set(key, spriteSheet);
            const baseTexture = PIXI.BaseTexture.from(spriteSheet);
            if (PIXI.SCALE_MODES && typeof PIXI.SCALE_MODES.NEAREST !== 'undefined') {
                baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            }
            if (PIXI.WRAP_MODES && typeof PIXI.WRAP_MODES.CLAMP !== 'undefined') {
                baseTexture.wrapMode = PIXI.WRAP_MODES.CLAMP;
            }
            if (PIXI.MIPMAP_MODES && typeof PIXI.MIPMAP_MODES.OFF !== 'undefined') {
                baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
            }
            this.baseTextures.set(key, baseTexture);
            didChange = true;
        }

        if (didChange) {
            this.textureCache.clear();
        }

        this.baseTexture = this.baseTextures.get('terrain');
        return Boolean(this.baseTexture);
    },

    getPlayerSpriteSheetTexture(actor, animationFrame = null) {
        if (!(this.baseTextures instanceof Map) || !this.baseTextures.has('player')) {
            return null;
        }

        const baseTexture = this.baseTextures.get('player');
        if (!baseTexture || !Number.isFinite(baseTexture.width) || !Number.isFinite(baseTexture.height)) {
            return null;
        }

        const columns = Math.max(1, Math.floor(PLAYER_SPRITESHEET_COLUMNS));
        const rows = Math.max(1, Math.floor(PLAYER_SPRITESHEET_ROWS));

        const frameWidth = baseTexture.width / columns;
        const frameHeight = baseTexture.height / rows;
        if (!Number.isFinite(frameWidth) || !Number.isFinite(frameHeight) || frameWidth <= 0 || frameHeight <= 0) {
            return null;
        }

        const columnIndex = (animationFrame !== null && Number.isFinite(animationFrame))
            ? Math.max(0, Math.min(columns - 1, Math.floor(animationFrame)))
            : 0;
        const rowIndex = this.getPlayerSpriteSheetRowIndex(actor);
        const rect = {
            x: frameWidth * columnIndex,
            y: frameHeight * rowIndex,
            width: frameWidth,
            height: frameHeight
        };

        return this.getTextureForRect(rect, 'player');
    },

    getPlayerSpriteSheetRowIndex(actor) {
        const facing = getActorFacing(actor);
        const normalized = normalizeDirection(facing.dx, facing.dy);

        if (normalized.dx === 0 && normalized.dy === 1) {
            return 0;
        }
        if (normalized.dx === 1 && normalized.dy === 1) {
            return 1;
        }
        if (normalized.dx === 1 && normalized.dy === 0) {
            return 2;
        }
        if (normalized.dx === 1 && normalized.dy === -1) {
            return 3;
        }
        if (normalized.dx === 0 && normalized.dy === -1) {
            return 4;
        }
        if (normalized.dx === -1 && normalized.dy === -1) {
            return 5;
        }
        if (normalized.dx === -1 && normalized.dy === 0) {
            return 6;
        }
        if (normalized.dx === -1 && normalized.dy === 1) {
            return 7;
        }

        return 0;
    },

    getActorSpriteTexture(actor, isPlayer, tileSize, animationTime = 0, animationFrame = null) {
        if (isPlayer) {
            const playerSheetTexture = this.getPlayerSpriteSheetTexture(actor, animationFrame);
            if (playerSheetTexture) {
                return playerSheetTexture;
            }
        }

        const role = isPlayer
            ? 'player'
            : (actor.isAlly ? 'ally' : (isNeutralNpcActor(actor) ? 'npc' : 'enemy'));
        const quantizedSize = Math.max(8, Math.round(tileSize));
        const visual = getEntityVisual(role, actor);
        const key = `${role}:${quantizedSize}:${visual.color}`;
        if (this.actorTextureCache.has(key)) {
            return this.actorTextureCache.get(key);
        }

        const baseColor = this.toPixiColor(visual.color);
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
            resolution: window.devicePixelRatio,
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

    toPixiColor(colorValue) {
        if (typeof colorValue !== 'string' || colorValue.length === 0) {
            return 0;
        }

        if (typeof PIXI.utils.string2hex === 'function') {
            try {
                return PIXI.utils.string2hex(colorValue);
            } catch (error) {
                return 0;
            }
        }

        return 0;
    },

    mixPixiColor(sourceColor, targetColor, amount = 0.5) {
        const mixAmount = clamp(Number(amount), 0, 1);
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

    parseCssColor(colorValue) {
        if (typeof colorValue !== 'string') {
            return { color: 0, alpha: 1 };
        }

        const rgbaMatch = colorValue.match(/rgba?\(([^)]+)\)/i);
        if (rgbaMatch) {
            const parts = rgbaMatch[1].split(',').map((part) => Number(part.trim()));
            const red = clamp(Math.floor(parts[0]), 0, 255);
            const green = clamp(Math.floor(parts[1]), 0, 255);
            const blue = clamp(Math.floor(parts[2]), 0, 255);
            const alpha = parts.length > 3 ? clamp(Number(parts[3]), 0, 1) : 1;
            return {
                color: (red << 16) + (green << 8) + blue,
                alpha
            };
        }

        return {
            color: this.toPixiColor(colorValue),
            alpha: 1
        };
    }
});
