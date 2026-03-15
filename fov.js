// Field of View using raycasting
console.log('fov.js loaded');

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
        // Cast rays in all directions
        for (let angle = 0; angle < 360; angle += 1) {
            this.castRay(x, y, angle * Math.PI / 180, range);
        }
    }

    castRay(x, y, angle, range) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        let px = x + 0.5;
        let py = y + 0.5;

        for (let i = 0; i < range; i++) {
            const tileX = Math.floor(px);
            const tileY = Math.floor(py);

            if (tileX < 0 || tileX >= GRID_SIZE || tileY < 0 || tileY >= GRID_SIZE) break;

            this.visible.add(`${tileX},${tileY}`);
            this.explored.add(`${tileX},${tileY}`);

            if (this.grid[tileY][tileX] === TILE_TYPES.WALL) break;

            px += dx;
            py += dy;
        }
    }

    isVisible(x, y) {
        return this.visible.has(`${x},${y}`);
    }

    isExplored(x, y) {
        return this.explored.has(`${x},${y}`);
    }

    revealAll() {
        // debug: mark all tiles as explored
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                this.explored.add(`${x},${y}`);
            }
        }
        console.log('All tiles revealed for debugging');
    }

    showAll() {
        this.visible.clear();
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const key = `${x},${y}`;
                this.visible.add(key);
                this.explored.add(key);
            }
        }
    }
}