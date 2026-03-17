// Field of View using raycasting

// Precomputed direction vectors for all 360 ray angles (computed once at load time)
const FOV_DIRECTIONS = Array.from({ length: 360 }, (_, i) => {
    const rad = i * Math.PI / 180;
    return { dx: Math.cos(rad), dy: Math.sin(rad) };
});

class FOV {
    constructor(grid) {
        this.grid = grid;
        this.visible = new Set();
        this.explored = new Set();
    }

    compute(x, y, range) {
        this.visible.clear();
        this.castRays(x, y, range);
    }

    castRays(x, y, range) {
        // Cast rays in all directions using precomputed direction table
        for (const { dx, dy } of FOV_DIRECTIONS) {
            this.castRay(x, y, dx, dy, range);
        }
    }

    castRay(x, y, dx, dy, range) {

        let px = x + 0.5;
        let py = y + 0.5;

        for (let i = 0; i < range; i++) {
            const tileX = Math.floor(px);
            const tileY = Math.floor(py);

            if (tileX < 0 || tileX >= GRID_SIZE || tileY < 0 || tileY >= GRID_SIZE) break;

            const tileKey = toGridKey(tileX, tileY);
            this.visible.add(tileKey);
            this.explored.add(tileKey);

            if (this.grid[tileY][tileX] === TILE_TYPES.WALL) break;

            px += dx;
            py += dy;
        }
    }

    isVisible(x, y) {
        return this.visible.has(toGridKey(x, y));
    }

    isExplored(x, y) {
        return this.explored.has(toGridKey(x, y));
    }

    showAll() {
        this.visible.clear();
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const key = toGridKey(x, y);
                this.visible.add(key);
                this.explored.add(key);
            }
        }
    }
}