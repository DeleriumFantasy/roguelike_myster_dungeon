// Pathfinding and traversability helpers

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

function isValidPosition(x, y, grid) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && grid[y][x] !== TILE_TYPES.WALL;
}

function findNearestSafeTile(x, y, grid, floor) {
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

    return { x, y };
}

function isSafeTile(x, y, grid) {
    const tile = grid[y][x];
    return tile !== TILE_TYPES.PIT && tile !== TILE_TYPES.WATER && tile !== TILE_TYPES.SPIKE && tile !== TILE_TYPES.LAVA;
}

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
