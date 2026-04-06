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