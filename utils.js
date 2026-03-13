// Utility functions
console.log('utils.js loaded');

class SeededRNG {
    constructor(seed) {
        this.seed = seed;
        this.state = seed;
    }

    next() {
        // Simple linear congruential generator
        this.state = (this.state * 1103515245 + 12345) % 2147483648;
        return this.state / 2147483648;
    }

    randomInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getNeighbors(x, y) {
    return [
        { x: x - 1, y: y },
        { x: x + 1, y: y },
        { x: x, y: y - 1 },
        { x: x, y: y + 1 }
    ];
}

function isValidPosition(x, y, grid) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && grid[y][x] !== TILE_TYPES.WALL;
}

function findNearestSafeTile(x, y, grid, floor) {
    // Simple BFS to find nearest safe tile
    const queue = [{ x, y, dist: 0 }];
    const visited = new Set();
    visited.add(`${x},${y}`);

    while (queue.length > 0) {
        const current = queue.shift();
        if (isSafeTile(current.x, current.y, grid)) {
            return { x: current.x, y: current.y };
        }

        for (const neighbor of getNeighbors(current.x, current.y)) {
            const key = `${neighbor.x},${neighbor.y}`;
            if (!visited.has(key) && isValidPosition(neighbor.x, neighbor.y, grid)) {
                visited.add(key);
                queue.push({ ...neighbor, dist: current.dist + 1 });
            }
        }
    }

    // If no safe tile found, return original position
    return { x, y };
}

function isSafeTile(x, y, grid) {
    const tile = grid[y][x];
    return tile !== TILE_TYPES.PIT && tile !== TILE_TYPES.WATER && tile !== TILE_TYPES.SPIKE;
}

function getDirection(dx, dy) {
    if (dx === 0 && dy === -1) return 'north';
    if (dx === 0 && dy === 1) return 'south';
    if (dx === 1 && dy === 0) return 'east';
    if (dx === -1 && dy === 0) return 'west';
    if (dx === 1 && dy === -1) return 'northeast';
    if (dx === -1 && dy === -1) return 'northwest';
    if (dx === 1 && dy === 1) return 'southeast';
    if (dx === -1 && dy === 1) return 'southwest';
    return 'unknown';
}