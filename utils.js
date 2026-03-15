// Utility functions

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

function getRngRoll(rng = null) {
    if (rng && typeof rng.next === 'function') {
        return rng.next();
    }

    return Math.random();
}

function getRngRandomInt(rng, min, max) {
    if (rng && typeof rng.randomInt === 'function') {
        return rng.randomInt(min, max);
    }

    return randomInt(min, max);
}

function createMathRng() {
    return {
        next: () => Math.random(),
        randomInt: (min, max) => randomInt(min, max)
    };
}

function getItemLabel(item, fallback = 'item') {
    if (!item) {
        return fallback;
    }

    if (typeof item.getDisplayName === 'function') {
        return item.getDisplayName();
    }

    if (typeof item.name === 'string' && item.name.length > 0) {
        return item.name;
    }

    return fallback;
}

function normalizeDirection(dx, dy, fallback = { dx: 0, dy: -1 }) {
    const normalizedDx = Math.sign(Number(dx) || 0);
    const normalizedDy = Math.sign(Number(dy) || 0);
    if (normalizedDx === 0 && normalizedDy === 0) {
        return { dx: fallback.dx, dy: fallback.dy };
    }

    return { dx: normalizedDx, dy: normalizedDy };
}

function getActorFacing(actor, fallback = { dx: 0, dy: -1 }) {
    if (actor && typeof actor.getFacingDirection === 'function') {
        const facing = actor.getFacingDirection();
        return normalizeDirection(facing?.dx, facing?.dy, fallback);
    }

    return normalizeDirection(actor?.facing?.dx, actor?.facing?.dy, fallback);
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
        { x: x, y: y + 1 },
        { x: x - 1, y: y - 1 },
        { x: x + 1, y: y - 1 },
        { x: x - 1, y: y + 1 },
        { x: x + 1, y: y + 1 }
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
    return tile !== TILE_TYPES.PIT && tile !== TILE_TYPES.WATER && tile !== TILE_TYPES.SPIKE && tile !== TILE_TYPES.LAVA;
}

function actorAddCondition(actor, condition, duration = getConditionDuration(condition, 1)) {
    if (!actor || !(actor.conditions instanceof Map)) {
        return;
    }

    actor.conditions.set(condition, duration);
}

function actorHasCondition(actor, condition) {
    return Boolean(actor && actor.conditions instanceof Map && actor.conditions.has(condition));
}

function actorResolveOnAttackedConditions(actor) {
    if (!actor || !(actor.conditions instanceof Map)) {
        return;
    }

    for (const condition of [...actor.conditions.keys()]) {
        if (!shouldRemoveConditionOnAttacked(condition)) {
            continue;
        }

        if (typeof actor.removeCondition === 'function') {
            actor.removeCondition(condition);
        } else {
            actor.conditions.delete(condition);
        }
    }
}

// Shared A* pathfinding. canTraverseFn(x, y, isGoal) returns true if the tile can be entered.
function findPathAStar(startX, startY, goalX, goalY, canTraverseFn) {
    const start = { x: startX, y: startY };
    const goal = { x: goalX, y: goalY };
    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(`${start.x},${start.y}`, 0);
    fScore.set(`${start.x},${start.y}`, distance(start.x, start.y, goal.x, goal.y));

    while (openSet.length > 0) {
        openSet.sort((a, b) => fScore.get(`${a.x},${a.y}`) - fScore.get(`${b.x},${b.y}`));
        const current = openSet.shift();

        if (current.x === goal.x && current.y === goal.y) {
            const path = [current];
            let node = current;
            while (cameFrom.has(`${node.x},${node.y}`)) {
                node = cameFrom.get(`${node.x},${node.y}`);
                path.unshift(node);
            }
            return path;
        }

        for (const neighbor of getNeighbors(current.x, current.y)) {
            const isGoal = neighbor.x === goal.x && neighbor.y === goal.y;
            if (!canTraverseFn(neighbor.x, neighbor.y, isGoal)) {
                continue;
            }

            const tentativeGScore = gScore.get(`${current.x},${current.y}`) + 1;
            const neighborKey = `${neighbor.x},${neighbor.y}`;

            if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + distance(neighbor.x, neighbor.y, goal.x, goal.y));

                if (!openSet.some((n) => n.x === neighbor.x && n.y === neighbor.y)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    return null;
}