// Tileset management - generates sprite sheet from tile definitions

console.log('tileset.js loaded');

class Tileset {
    constructor(tileSize = 16) {
        this.tileSize = tileSize;
        this.tiles = {
            [TILE_TYPES.FLOOR]: { x: 0, y: 0 },
            [TILE_TYPES.WALL]: { x: 1, y: 0 },
            [TILE_TYPES.PIT]: { x: 2, y: 0 },
            [TILE_TYPES.WATER]: { x: 3, y: 0 },
            [TILE_TYPES.SPIKE]: { x: 4, y: 0 },
            [TILE_TYPES.STAIRS_DOWN]: { x: 5, y: 0 },
            [TILE_TYPES.STAIRS_UP]: { x: 6, y: 0 }
        };
        this.spriteSheet = this.generateSpriteSheet();
    }

    generateSpriteSheet() {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize * 7;
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

        return canvas;
    }

    drawTile(ctx, tileType, gridX, gridY) {
        const x = gridX * this.tileSize;
        const y = gridY * this.tileSize;
        const cx = x + this.tileSize / 2;
        const cy = y + this.tileSize / 2;

        // Draw base color
        let color = COLORS.FLOOR;
        switch (tileType) {
            case TILE_TYPES.WALL:
                color = COLORS.WALL;
                break;
            case TILE_TYPES.PIT:
                color = COLORS.PIT;
                break;
            case TILE_TYPES.WATER:
                color = COLORS.WATER;
                break;
            case TILE_TYPES.SPIKE:
                color = COLORS.SPIKE;
                break;
            case TILE_TYPES.STAIRS_DOWN:
            case TILE_TYPES.STAIRS_UP:
                color = COLORS.STAIRS;
                break;
        }

        ctx.fillStyle = color;
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
        const pos = this.tiles[tileType];
        if (!pos) {
            console.warn(`Unknown tile type: ${tileType}, defaulting to floor`);
            return this.tiles[TILE_TYPES.FLOOR];
        }
        return {
            x: pos.x * this.tileSize,
            y: pos.y * this.tileSize,
            width: this.tileSize,
            height: this.tileSize
        };
    }
}