// Tileset management - generates sprite sheet from tile definitions

console.log('tileset.js loaded');

class Tileset {
    constructor(tileSize = 16) {
        this.tileSize = tileSize;
        this.tiles = Object.fromEntries(Object.entries(TILE_VISUALS).map(([tileType, visual]) => [tileType, visual.sprite]));
        this.spriteSheet = this.generateSpriteSheet();
    }

    generateSpriteSheet() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize * 8;
        canvas.height = this.tileSize;
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
        const x = gridX * this.tileSize;
        const y = gridY * this.tileSize;
        const cx = x + this.tileSize / 2;
        const cy = y + this.tileSize / 2;

        ctx.fillStyle = getTileVisual(tileType).color;
        ctx.fillRect(x, y, this.tileSize, this.tileSize);

        // Draw icons
        if (tileType === TILE_TYPES.PIT) {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(cx, cy, this.tileSize / 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (tileType === TILE_TYPES.SPIKE) {
            ctx.fillStyle = '#999';
            const dotRadius = 2;
            const dotOffsets = [
                { x: -3, y: -3 },
                { x: 3, y: -3 },
                { x: -3, y: 3 },
                { x: 3, y: 3 },
                { x: 0, y: 0 }
            ];
            for (const offset of dotOffsets) {
                ctx.beginPath();
                ctx.arc(cx + offset.x, cy + offset.y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (tileType === TILE_TYPES.LAVA) {
            ctx.fillStyle = '#ffb347';
            ctx.beginPath();
            ctx.arc(cx - 3, cy, this.tileSize / 6, 0, Math.PI * 2);
            ctx.arc(cx + 2, cy - 2, this.tileSize / 7, 0, Math.PI * 2);
            ctx.arc(cx + 4, cy + 3, this.tileSize / 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (tileType === TILE_TYPES.STAIRS_DOWN) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('>', cx, cy);
        } else if (tileType === TILE_TYPES.STAIRS_UP) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('<', cx, cy);
        }
    }

    getSourceRect(tileType) {
        const pos = this.tiles[tileType] || this.tiles[TILE_TYPES.FLOOR];
        if (!this.tiles[tileType]) {
            console.warn(`Unknown tile type: ${tileType}, defaulting to floor`);
        }
        return {
            x: pos.x * this.tileSize,
            y: pos.y * this.tileSize,
            width: this.tileSize,
            height: this.tileSize
        };
    }
}