// Field of View using raycasting

// Precomputed direction vectors for all 360 ray angles (computed once at load time)
const FOV_DIRECTIONS = Array.from({ length: 360 }, (_, i) => {
    const rad = i * Math.PI / 180;
    return { dx: Math.cos(rad), dy: Math.sin(rad) };
});

const FOV_EIGHT_DIRECTIONS = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 }
];

class FOV {
    constructor(grid) {
        this.grid = grid;
        this.visible = new Set();
        this.explored = new Set();
    }

    compute(x, y, range) {
        this.visible.clear();
        this.castRays(x, y, range);

        // Reveal any hidden region if its entire boundary is revealed walls.
        // Iterate to a fixed point so nested enclosed regions can unlock.
        let changed = true;
        while (changed) {
            changed = this.revealEnclosedHiddenRegions();
        }
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

    revealEnclosedHiddenRegions() {
        const visited = new Set();
        let didReveal = false;

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const startKey = toGridKey(x, y);
                if (visited.has(startKey) || this.isRevealedTile(x, y)) {
                    continue;
                }

                const region = [];
                const queue = [{ x, y }];
                let isFullyEnclosed = true;
                let boundaryWallCount = 0;

                while (queue.length > 0) {
                    const current = queue.pop();
                    const currentKey = toGridKey(current.x, current.y);
                    if (visited.has(currentKey)) {
                        continue;
                    }

                    visited.add(currentKey);

                    if (this.isRevealedTile(current.x, current.y)) {
                        isFullyEnclosed = false;
                        continue;
                    }

                    region.push(current);

                    for (const direction of FOV_EIGHT_DIRECTIONS) {
                        const nextX = current.x + direction.dx;
                        const nextY = current.y + direction.dy;

                        if (this.isSeenBoundary(nextX, nextY)) {
                            boundaryWallCount += 1;
                            continue;
                        }

                        if (!this.isRevealedTile(nextX, nextY)) {
                            const nextKey = toGridKey(nextX, nextY);
                            if (!visited.has(nextKey)) {
                                queue.push({ x: nextX, y: nextY });
                            }
                            continue;
                        }

                        if (!this.isRevealedWall(nextX, nextY)) {
                            isFullyEnclosed = false;
                            continue;
                        }

                        boundaryWallCount += 1;
                    }
                }

                if (!isFullyEnclosed || boundaryWallCount === 0) {
                    continue;
                }

                for (const tile of region) {
                    const key = toGridKey(tile.x, tile.y);
                    this.visible.add(key);
                    this.explored.add(key);
                    didReveal = true;
                }
            }
        }

        return didReveal;
    }

    isInBounds(x, y) {
        return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
    }

    isRevealedWall(x, y) {
        if (!this.isInBounds(x, y) || !this.isWall(x, y)) {
            return false;
        }
        const key = toGridKey(x, y);
        return this.visible.has(key) || this.explored.has(key);
    }

    isSeenBoundary(x, y) {
        if (!this.isInBounds(x, y)) {
            return true;
        }
        return this.isRevealedWall(x, y);
    }

    isRevealedTile(x, y) {
        if (!this.isInBounds(x, y)) {
            return false;
        }
        const key = toGridKey(x, y);
        return this.visible.has(key) || this.explored.has(key);
    }

    isWall(x, y) {
        return this.grid?.[y]?.[x] === TILE_TYPES.WALL;
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