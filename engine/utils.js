// Shared grid, distance, and clamp helpers

function toGridKey(x, y) {
    return `${x},${y}`;
}

function fromGridKey(key) {
    const [x, y] = String(key).split(',').map(Number);
    const result = [x, y];
    result.x = x;
    result.y = y;
    return result;
}

function normalizeStringValue(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}

function normalizeInteger(value, fallback = 0, min = -Infinity, max = Infinity) {
    const numericValue = Number(value);
    const normalizedValue = Number.isFinite(numericValue)
        ? Math.floor(numericValue)
        : Math.floor(Number(fallback) || 0);
    return clamp(normalizedValue, min, max);
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

const CARDINAL_DIRECTIONS = Object.freeze([
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 }
]);

function getCardinalNeighbors(x, y) {
    return CARDINAL_DIRECTIONS.map((direction) => ({
        x: x + direction.dx,
        y: y + direction.dy
    }));
}

function getNeighbors(x, y) {
    return [
        ...getCardinalNeighbors(x, y),
        { x: x - 1, y: y - 1 },
        { x: x + 1, y: y - 1 },
        { x: x - 1, y: y + 1 },
        { x: x + 1, y: y + 1 }
    ];
}