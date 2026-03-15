// Tileset management - generates sprite sheet from tile definitions

console.log('tileset.js loaded');

class Tileset {
    constructor(tileSize = 16) {
        this.sourceTileWidth = TERRAIN_SPRITESHEET_TILE_SIZE;
        this.sourceTileHeight = TERRAIN_SPRITESHEET_TILE_HEIGHT;
        this.tiles = Object.fromEntries(Object.entries(TILE_VISUALS).map(([tileType, visual]) => [tileType, visual.sprite]));
        this.spriteSheet = this.generateSpriteSheet();
        // External spritesheet is loaded by the caller via tryLoadExternalSpriteSheet(onLoad).
    }

    tryLoadExternalSpriteSheet(onLoad = null) {
        const image = new Image();
        const spriteVersion = typeof TERRAIN_SPRITESHEET_VERSION === 'string' ? TERRAIN_SPRITESHEET_VERSION : '1';
        const versionedPath = `${TERRAIN_SPRITESHEET_PATH}?v=${encodeURIComponent(spriteVersion)}`;
        image.onload = () => {
            this.spriteSheet = image;
            console.log(`Terrain spritesheet loaded: ${versionedPath}`);
            if (onLoad) onLoad();
        };
        image.onerror = () => {
            console.warn(`Failed to load terrain spritesheet at ${TERRAIN_SPRITESHEET_PATH}. Using generated fallback.`);
        };
        image.src = versionedPath;
    }

    generateSpriteSheet() {
        const canvas = document.createElement('canvas');
        canvas.width = this.sourceTileWidth * 8;
        canvas.height = this.sourceTileHeight;
        const ctx = canvas.getContext('2d');

        // Draw each tile
        this.drawTile(ctx, TILE_TYPES.FLOOR, 0, 0);
        this.drawTile(ctx, TILE_TYPES.WALL, 1, 0);
        this.drawTile(ctx, TILE_TYPES.PIT, 2, 0);
        this.drawTile(ctx, TILE_TYPES.WATER, 3, 0);
        this.drawTile(ctx, TILE_TYPES.SPIKE, 4, 0);
        this.drawTile(ctx, TILE_TYPES.STAIRS_DOWN, 5, 0);
        this.drawTile(ctx, TILE_TYPES.STAIRS_UP, 6, 0);
        this.drawTile(ctx, TILE_TYPES.LAVA, 7, 0);

        return canvas;
    }

    drawTile(ctx, tileType, gridX, gridY) {
        const x = gridX * this.sourceTileWidth;
        const y = gridY * this.sourceTileHeight;
        const visual = getTileVisual(tileType);
        const localY = visual.overdrawTop || 0;
        const cx = x + this.sourceTileWidth / 2;
        const cy = y + localY + this.sourceTileWidth / 2;

        ctx.fillStyle = visual.color;
        ctx.fillRect(x, y + localY, this.sourceTileWidth, this.sourceTileWidth);

        // Draw icons
        if (visual.icon === 'pit') {
            ctx.fillStyle = visual.foregroundColor;
            ctx.beginPath();
            ctx.arc(cx, cy, this.sourceTileWidth / 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (visual.icon === 'spike') {
            ctx.fillStyle = visual.foregroundColor;
            const prongs = [
                { x: -5, topY: -13, baseY: -4, halfWidth: 2 },
                { x: 0, topY: -15, baseY: -3, halfWidth: 2 },
                { x: 5, topY: -13, baseY: -4, halfWidth: 2 },
                { x: -3, topY: -8, baseY: 1, halfWidth: 2 },
                { x: 3, topY: -8, baseY: 1, halfWidth: 2 }
            ];

            for (const prong of prongs) {
                ctx.beginPath();
                ctx.moveTo(cx + prong.x, cy + prong.topY);
                ctx.lineTo(cx + prong.x - prong.halfWidth, cy + prong.baseY);
                ctx.lineTo(cx + prong.x + prong.halfWidth, cy + prong.baseY);
                ctx.closePath();
                ctx.fill();
            }
        } else if (visual.icon === 'lava') {
            ctx.fillStyle = visual.foregroundColor;
            ctx.beginPath();
            ctx.arc(cx - 3, cy, this.sourceTileWidth / 6, 0, Math.PI * 2);
            ctx.arc(cx + 2, cy - 2, this.sourceTileWidth / 7, 0, Math.PI * 2);
            ctx.arc(cx + 4, cy + 3, this.sourceTileWidth / 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (visual.glyph) {
            ctx.fillStyle = visual.foregroundColor;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(visual.glyph, cx, cy);
        }
    }

    getSourceRect(tileType) {
        const pos = this.tiles[tileType] || this.tiles[TILE_TYPES.FLOOR];
        const visual = getTileVisual(tileType);
        const sourceHeight = visual.sourceHeight || TERRAIN_SPRITESHEET_TILE_SIZE;
        if (!this.tiles[tileType]) {
            console.warn(`Unknown tile type: ${tileType}, defaulting to floor`);
        }
        return {
            x: pos.x * this.sourceTileWidth,
            y: pos.y * this.sourceTileHeight,
            width: this.sourceTileWidth,
            height: sourceHeight
        };
    }
}