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
        return randomIntFromUnitRoll(this.next(), min, max);
    }
}

class MinHeap {
    constructor(compareFn) {
        this.compareFn = typeof compareFn === 'function' ? compareFn : ((left, right) => left - right);
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(value) {
        this.items.push(value);
        this.bubbleUp(this.items.length - 1);
    }

    pop() {
        if (this.items.length === 0) {
            return null;
        }

        const root = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0) {
            this.items[0] = last;
            this.bubbleDown(0);
        }

        return root;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.compareFn(this.items[index], this.items[parentIndex]) >= 0) {
                break;
            }

            [this.items[index], this.items[parentIndex]] = [this.items[parentIndex], this.items[index]];
            index = parentIndex;
        }
    }

    bubbleDown(index) {
        const length = this.items.length;

        while (true) {
            let smallest = index;
            const leftIndex = index * 2 + 1;
            const rightIndex = leftIndex + 1;

            if (leftIndex < length && this.compareFn(this.items[leftIndex], this.items[smallest]) < 0) {
                smallest = leftIndex;
            }

            if (rightIndex < length && this.compareFn(this.items[rightIndex], this.items[smallest]) < 0) {
                smallest = rightIndex;
            }

            if (smallest === index) {
                return;
            }

            [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
            index = smallest;
        }
    }
}

function randomIntFromUnitRoll(unitRoll, min, max) {
    return Math.floor(unitRoll * (max - min + 1)) + min;
}

function hasCallableMethod(target, methodName) {
    return Boolean(target && typeof target[methodName] === 'function');
}

function hasConditionMap(actor) {
    return Boolean(actor && actor.conditions instanceof Map);
}

function randomInt(min, max) {
    return randomIntFromUnitRoll(Math.random(), min, max);
}

function getRngRoll(rng = null) {
    if (hasCallableMethod(rng, 'next')) {
        return rng.next();
    }

    return Math.random();
}

function getRngRandomInt(rng, min, max) {
    if (hasCallableMethod(rng, 'randomInt')) {
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

function pickRandom(list, rng = null, fallback = null) {
    if (!Array.isArray(list) || list.length === 0) {
        return fallback;
    }

    const index = getRngRandomInt(rng, 0, list.length - 1);
    return list[index];
}

function isNeutralNpcActor(actor) {
    if (!actor) {
        return false;
    }

    if (hasCallableMethod(actor, 'isNeutralNpc')) {
        return actor.isNeutralNpc();
    }

    if (hasCallableMethod(actor, 'hasEnemyType')) {
        return actor.hasEnemyType(ENEMY_TYPES.NPC);
    }

    return Array.isArray(actor.creatureTypes)
        && actor.creatureTypes.includes(ENEMY_TYPES.NPC);
}

function getItemLabel(item, fallback = 'item') {
    if (!item) {
        return fallback;
    }

    if (hasCallableMethod(item, 'getDisplayName')) {
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
    if (hasCallableMethod(actor, 'getFacingDirection')) {
        const facing = actor.getFacingDirection();
        return normalizeDirection(facing?.dx, facing?.dy, fallback);
    }

    return normalizeDirection(actor?.facing?.dx, actor?.facing?.dy, fallback);
}

function isActorAlive(actor) {
    return Boolean(hasCallableMethod(actor, 'isAlive') && actor.isAlive());
}

function toGridKey(x, y) {
    return `${x},${y}`;
}

function fromGridKey(key) {
    return String(key).split(',').map(Number);
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function getNearestByDistance(originX, originY, candidates, shouldConsiderCandidate = () => true) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (const candidate of candidates || []) {
        if (!shouldConsiderCandidate(candidate)) {
            continue;
        }

        const candidateDistance = distance(originX, originY, candidate.x, candidate.y);
        if (candidateDistance < nearestDistance) {
            nearest = candidate;
            nearestDistance = candidateDistance;
        }
    }

    return nearest;
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
    const queue = [{ x, y }];
    const visited = new Set();
    visited.add(toGridKey(x, y));

    while (queue.length > 0) {
        const current = queue.shift();
        if (isSafeTile(current.x, current.y, grid)) {
            return { x: current.x, y: current.y };
        }

        for (const neighbor of getNeighbors(current.x, current.y)) {
            const key = toGridKey(neighbor.x, neighbor.y);
            if (!visited.has(key) && isValidPosition(neighbor.x, neighbor.y, grid)) {
                visited.add(key);
                queue.push(neighbor);
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
    if (!hasConditionMap(actor)) {
        return;
    }

    actor.conditions.set(condition, duration);
}

function actorHasCondition(actor, condition) {
    return Boolean(hasConditionMap(actor) && actor.conditions.has(condition));
}

function actorResolveOnAttackedConditions(actor) {
    if (!hasConditionMap(actor)) {
        return;
    }

    for (const condition of [...actor.conditions.keys()]) {
        if (!shouldRemoveConditionOnAttacked(condition)) {
            continue;
        }

        if (hasCallableMethod(actor, 'removeCondition')) {
            actor.removeCondition(condition);
        } else {
            actor.conditions.delete(condition);
        }
    }
}

// Shared A* pathfinding. canTraverseFn(x, y, isGoal) returns true if the tile can be entered.
function findPathAStar(startX, startY, goalX, goalY, canTraverseFn, edgeCostFn = null) {
    const start = { x: startX, y: startY };
    const goal = { x: goalX, y: goalY };
    const openSet = new MinHeap((left, right) => left.fScore - right.fScore);
    const cameFrom = new Map();
    const gScore = new Map();
    const closedSet = new Set();

    const startKey = toGridKey(start.x, start.y);
    const goalKey = toGridKey(goal.x, goal.y);

    gScore.set(startKey, 0);
    openSet.push({ x: start.x, y: start.y, fScore: distance(start.x, start.y, goal.x, goal.y) });

    while (openSet.size > 0) {
        const current = openSet.pop();
        const currentKey = toGridKey(current.x, current.y);

        if (closedSet.has(currentKey)) {
            continue;
        }

        if (current.x === goal.x && current.y === goal.y) {
            const path = [current];
            let node = current;
            while (cameFrom.has(toGridKey(node.x, node.y))) {
                node = cameFrom.get(toGridKey(node.x, node.y));
                path.unshift(node);
            }
            return path;
        }

        closedSet.add(currentKey);
        const currentGScore = gScore.get(currentKey) ?? Infinity;

        for (const neighbor of getNeighbors(current.x, current.y)) {
            const isGoal = neighbor.x === goal.x && neighbor.y === goal.y;
            if (!canTraverseFn(neighbor.x, neighbor.y, isGoal)) {
                continue;
            }

            const neighborKey = toGridKey(neighbor.x, neighbor.y);
            if (closedSet.has(neighborKey) && neighborKey !== goalKey) {
                continue;
            }

            const edgeCost = edgeCostFn ? edgeCostFn(neighbor.x, neighbor.y) : 1;
            const tentativeGScore = currentGScore + edgeCost;

            if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                openSet.push({
                    x: neighbor.x,
                    y: neighbor.y,
                    fScore: tentativeGScore + distance(neighbor.x, neighbor.y, goal.x, goal.y)
                });
            }
        }
    }

    return null;
}