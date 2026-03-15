// World generation and management
console.log('world.js loaded');

class World {
    constructor(seed) {
        this.baseSeed = seed;
        this.floors = [];
        this.currentFloor = 0;
        this.generateFloor();
    }

    generateFloor(areaType = this.selectAreaTypeForFloor(this.currentFloor)) {
        const rng = new SeededRNG(this.baseSeed + this.currentFloor);
        const layout = this.generateGridForArea(areaType, rng);
        const grid = layout.grid;
        const stairPositions = this.placeStairs(grid, rng, layout);

        if (areaType === AREA_TYPES.CATACOMBS) {
            this.decorateCatacombsHallways(grid, rng, layout, stairPositions);
        }

        const hazards = this.generateHazardsForGrid(grid, rng, areaType, layout);
        const traps = this.generateTrapsForGrid(grid, rng, areaType, layout);

        this.floors[this.currentFloor] = {
            grid,
            hazards,
            traps,
            revealedTraps: new Set(),
            items: new Map(),
            enemies: [],
            fov: new FOV(grid),
            meta: {
                areaType,
                generatorType: this.getGeneratorType(areaType),
                mapRevealed: false,
                contentSpawned: false
            }
        };
    }

    generateGridForArea(areaType, rng) {
        if (areaType === AREA_TYPES.CATACOMBS) {
            return this.generateCatacombsGrid(rng);
        }

        const rule = getAreaGenerationRule(areaType);
        const grid = [];

        for (let y = 0; y < GRID_SIZE; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                grid[y][x] = this.generateTileFromAreaRule(rule, rng, x, y);
            }
        }

        this.applyAreaWalkers(grid, rule, rng);
        this.applyPremadeTerrainShapes(grid, areaType, rng, this.currentFloor);
        return {
            grid,
            roomTileKeys: null,
            hallwayTileKeys: null
        };
    }

    generateCatacombsGrid(rng) {
        const config = getCatacombsGenerationConfig();
        const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(TILE_TYPES.WALL));
        const rooms = [];
        const roomTileKeys = new Set();
        const hallwayTileKeys = new Set();
        const minRoomCount = Number.isFinite(config?.minRoomCount) ? Math.max(2, config.minRoomCount) : 16;
        const roomCountRatio = Number.isFinite(config?.targetRoomCountRatio) ? config.targetRoomCountRatio : 0.5;
        const targetRooms = Math.max(minRoomCount, Math.floor(GRID_SIZE * roomCountRatio));
        const roomPlacementAttempts = Number.isFinite(config?.roomPlacementAttempts) ? Math.max(1, config.roomPlacementAttempts) : 320;
        const roomMinSize = Number.isFinite(config?.roomMinSize) ? Math.max(3, config.roomMinSize) : 4;
        const roomMaxSize = Number.isFinite(config?.roomMaxSize) ? Math.max(roomMinSize, config.roomMaxSize) : 8;
        const roomPadding = Number.isFinite(config?.roomPadding) ? Math.max(0, config.roomPadding) : 1;

        for (let attempt = 0; attempt < roomPlacementAttempts && rooms.length < targetRooms; attempt++) {
            const width = rng.randomInt(roomMinSize, roomMaxSize);
            const height = rng.randomInt(roomMinSize, roomMaxSize);
            const x = rng.randomInt(1, GRID_SIZE - width - 2);
            const y = rng.randomInt(1, GRID_SIZE - height - 2);
            const candidate = { x, y, width, height };

            if (this.doesRoomOverlap(rooms, candidate, roomPadding)) {
                continue;
            }

            this.carveRoom(grid, candidate, roomTileKeys);
            rooms.push(candidate);
        }

        if (rooms.length < 2) {
            const fallbackRule = getAreaGenerationRule(AREA_TYPES.DUNGEON);
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    grid[y][x] = this.generateTileFromAreaRule(fallbackRule, rng, x, y);
                }
            }
            return {
                grid,
                roomTileKeys: null,
                hallwayTileKeys: null
            };
        }

        for (let i = 1; i < rooms.length; i++) {
            const from = this.getRoomCenter(rooms[i - 1]);
            const to = this.getRoomCenter(rooms[i]);
            this.carveHallwayBetweenPoints(grid, from, to, rng, roomTileKeys, hallwayTileKeys);
        }

        return {
            grid,
            roomTileKeys,
            hallwayTileKeys
        };
    }

    doesRoomOverlap(existingRooms, candidate, padding = 0) {
        return existingRooms.some((room) => (
            candidate.x <= room.x + room.width - 1 + padding
            && candidate.x + candidate.width - 1 + padding >= room.x
            && candidate.y <= room.y + room.height - 1 + padding
            && candidate.y + candidate.height - 1 + padding >= room.y
        ));
    }

    carveRoom(grid, room, roomTileKeys) {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                grid[y][x] = TILE_TYPES.FLOOR;
                roomTileKeys.add(this.tileKey(x, y));
            }
        }
    }

    getRoomCenter(room) {
        return {
            x: Math.floor(room.x + room.width / 2),
            y: Math.floor(room.y + room.height / 2)
        };
    }

    carveHallwayBetweenPoints(grid, from, to, rng, roomTileKeys, hallwayTileKeys) {
        const carveCell = (x, y) => {
            if (x <= 0 || x >= GRID_SIZE - 1 || y <= 0 || y >= GRID_SIZE - 1) {
                return;
            }

            grid[y][x] = TILE_TYPES.FLOOR;
            const key = this.tileKey(x, y);
            if (!roomTileKeys.has(key)) {
                hallwayTileKeys.add(key);
            }
        };

        const carveHorizontal = (startX, endX, y) => {
            const [left, right] = startX <= endX ? [startX, endX] : [endX, startX];
            for (let x = left; x <= right; x++) {
                carveCell(x, y);
            }
        };

        const carveVertical = (x, startY, endY) => {
            const [top, bottom] = startY <= endY ? [startY, endY] : [endY, startY];
            for (let y = top; y <= bottom; y++) {
                carveCell(x, y);
            }
        };

        if (rng.next() < 0.5) {
            carveHorizontal(from.x, to.x, from.y);
            carveVertical(to.x, from.y, to.y);
        } else {
            carveVertical(from.x, from.y, to.y);
            carveHorizontal(from.x, to.x, to.y);
        }
    }

    decorateCatacombsHallways(grid, rng, layout, stairPositions) {
        const hallwayKeys = layout?.hallwayTileKeys;
        if (!hallwayKeys || hallwayKeys.size === 0) {
            return;
        }

        const start = stairPositions?.up || this.findNearestFloorToCenter(grid);
        const end = stairPositions?.down;
        const protectedPath = start && end
            ? this.findCardinalPathKeys(grid, start, end, (tile) => tile === TILE_TYPES.FLOOR || tile === TILE_TYPES.STAIRS_UP || tile === TILE_TYPES.STAIRS_DOWN)
            : new Set();

        if (start) {
            protectedPath.add(this.tileKey(start.x, start.y));
        }
        if (end) {
            protectedPath.add(this.tileKey(end.x, end.y));
        }

        const config = getCatacombsGenerationConfig();
        const hallwayHazardChance = Number.isFinite(config?.hallwayHazardChance)
            ? clamp(config.hallwayHazardChance, 0, 1)
            : 0.2;
        const hallwayHazardTiles = Array.isArray(config?.hallwayHazardTiles) && config.hallwayHazardTiles.length > 0
            ? config.hallwayHazardTiles
            : [TILE_TYPES.LAVA, TILE_TYPES.WATER, TILE_TYPES.SPIKE];

        for (const key of hallwayKeys) {
            if (protectedPath.has(key)) {
                continue;
            }

            if (rng.next() >= hallwayHazardChance) {
                continue;
            }

            const [x, y] = key.split(',').map((value) => Number(value));
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue;
            }

            const replacement = hallwayHazardTiles[rng.randomInt(0, hallwayHazardTiles.length - 1)];
            grid[y][x] = replacement;
        }
    }

    findNearestFloorToCenter(grid) {
        const center = {
            x: Math.floor(GRID_SIZE / 2),
            y: Math.floor(GRID_SIZE / 2)
        };

        let best = null;
        let bestDistance = Infinity;
        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const tile = grid[y][x];
                if (tile !== TILE_TYPES.FLOOR) {
                    continue;
                }

                const currentDistance = distance(x, y, center.x, center.y);
                if (currentDistance < bestDistance) {
                    best = { x, y };
                    bestDistance = currentDistance;
                }
            }
        }

        return best;
    }

    findCardinalPathKeys(grid, start, goal, canTraverseTile) {
        const startKey = this.tileKey(start.x, start.y);
        const goalKey = this.tileKey(goal.x, goal.y);
        const queue = [start];
        const cameFrom = new Map();
        const visited = new Set([startKey]);

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = this.tileKey(current.x, current.y);
            if (currentKey === goalKey) {
                const pathKeys = new Set([goalKey]);
                let traceKey = goalKey;
                while (cameFrom.has(traceKey)) {
                    traceKey = cameFrom.get(traceKey);
                    pathKeys.add(traceKey);
                }
                return pathKeys;
            }

            const cardinalNeighbors = [
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y },
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 }
            ];

            for (const neighbor of cardinalNeighbors) {
                if (neighbor.x <= 0 || neighbor.x >= GRID_SIZE - 1 || neighbor.y <= 0 || neighbor.y >= GRID_SIZE - 1) {
                    continue;
                }

                const neighborKey = this.tileKey(neighbor.x, neighbor.y);
                if (visited.has(neighborKey)) {
                    continue;
                }

                const tile = grid[neighbor.y][neighbor.x];
                if (typeof canTraverseTile === 'function' && !canTraverseTile(tile)) {
                    continue;
                }

                visited.add(neighborKey);
                cameFrom.set(neighborKey, currentKey);
                queue.push(neighbor);
            }
        }

        return new Set();
    }

    applyPremadeTerrainShapes(grid, areaType, rng, floorIndex) {
        const placementRules = getPremadeTerrainPlacementRulesForFloor(areaType, floorIndex);
        for (const placementRule of placementRules) {
            const chance = Number.isFinite(placementRule.chance) ? placementRule.chance : 1;
            if (rng.next() > chance) {
                continue;
            }

            const minCount = Number.isFinite(placementRule.minCount) ? Math.max(0, placementRule.minCount) : 0;
            const maxCount = Number.isFinite(placementRule.maxCount) ? Math.max(minCount, placementRule.maxCount) : minCount;
            const targetCount = maxCount > minCount ? rng.randomInt(minCount, maxCount) : minCount;

            for (let i = 0; i < targetCount; i++) {
                this.placePremadeTerrainShapeRandom(grid, placementRule.shapeId, rng);
            }
        }
    }

    placePremadeTerrainShapeRandom(grid, shapeId, rng, attempts = 40) {
        const shape = getPremadeTerrainShape(shapeId);
        if (!shape || !Array.isArray(shape.rows) || shape.rows.length === 0) {
            return false;
        }

        const shapeHeight = shape.rows.length;
        const shapeWidth = shape.rows[0].length;
        const maxX = GRID_SIZE - 1 - shapeWidth;
        const maxY = GRID_SIZE - 1 - shapeHeight;
        if (maxX < 1 || maxY < 1) {
            return false;
        }

        for (let attempt = 0; attempt < attempts; attempt++) {
            const startX = rng.randomInt(1, maxX);
            const startY = rng.randomInt(1, maxY);

            if (!this.canPlacePremadeTerrainShapeAt(grid, shape, startX, startY)) {
                continue;
            }

            this.applyPremadeTerrainShapeAt(grid, shape, startX, startY);
            return true;
        }

        return false;
    }

    canPlacePremadeTerrainShapeAt(grid, shape, startX, startY) {
        const legend = getPremadeTerrainLegend();
        for (let rowIndex = 0; rowIndex < shape.rows.length; rowIndex++) {
            const row = shape.rows[rowIndex];
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const symbol = row[colIndex];
                const replacementTile = legend[symbol];
                if (!replacementTile) {
                    continue;
                }

                const x = startX + colIndex;
                const y = startY + rowIndex;
                if (x <= 0 || x >= GRID_SIZE - 1 || y <= 0 || y >= GRID_SIZE - 1) {
                    return false;
                }

                if (grid[y][x] === TILE_TYPES.STAIRS_UP || grid[y][x] === TILE_TYPES.STAIRS_DOWN) {
                    return false;
                }
            }
        }

        return true;
    }

    applyPremadeTerrainShapeAt(grid, shape, startX, startY) {
        const legend = getPremadeTerrainLegend();
        for (let rowIndex = 0; rowIndex < shape.rows.length; rowIndex++) {
            const row = shape.rows[rowIndex];
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const symbol = row[colIndex];
                const replacementTile = legend[symbol];
                if (!replacementTile) {
                    continue;
                }

                grid[startY + rowIndex][startX + colIndex] = replacementTile;
            }
        }
    }

    generateTileFromAreaRule(rule, rng, x, y) {
        if (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1) {
            return rule.boundaryTile;
        }

        for (const replacementRule of rule.replacementRules || []) {
            if (rng.next() >= replacementRule.chance) {
                continue;
            }

            if (Array.isArray(replacementRule.choices) && replacementRule.choices.length > 0) {
                return replacementRule.choices[rng.randomInt(0, replacementRule.choices.length - 1)];
            }

            return replacementRule.tile;
        }

        return rule.baseTile;
    }

    applyAreaWalkers(grid, rule, rng) {
        const walkerRule = rule.walkers;
        if (!walkerRule) {
            return;
        }

        for (let i = 0; i < walkerRule.count; i++) {
            let x = rng.randomInt(1, GRID_SIZE - 2);
            let y = rng.randomInt(1, GRID_SIZE - 2);
            for (let step = 0; step < walkerRule.steps; step++) {
                grid[y][x] = TILE_TYPES.FLOOR;
                const neighbors = getNeighbors(x, y).filter((neighbor) => {
                    if (!walkerRule.cardinalOnly) {
                        return true;
                    }

                    return neighbor.x === x || neighbor.y === y;
                });
                const next = neighbors[rng.randomInt(0, neighbors.length - 1)];
                x = clamp(next.x, 1, GRID_SIZE - 2);
                y = clamp(next.y, 1, GRID_SIZE - 2);
            }
        }
    }

    placeStairs(grid, rng, layout = null) {
        const roomKeys = layout?.roomTileKeys;
        const preferredKeys = roomKeys && roomKeys.size > 0
            ? Array.from(roomKeys)
            : null;
        const blocked = new Set();

        const pickPosition = () => {
            if (preferredKeys && preferredKeys.length > 0) {
                for (let i = preferredKeys.length - 1; i > 0; i--) {
                    const j = rng.randomInt(0, i);
                    [preferredKeys[i], preferredKeys[j]] = [preferredKeys[j], preferredKeys[i]];
                }

                for (const key of preferredKeys) {
                    if (blocked.has(key)) {
                        continue;
                    }

                    const [x, y] = key.split(',').map((value) => Number(value));
                    if (!Number.isFinite(x) || !Number.isFinite(y)) {
                        continue;
                    }

                    if (grid[y][x] === TILE_TYPES.FLOOR) {
                        return { x, y, key };
                    }
                }
            }

            for (let attempt = 0; attempt < 600; attempt++) {
                const x = rng.randomInt(1, GRID_SIZE - 2);
                const y = rng.randomInt(1, GRID_SIZE - 2);
                const key = this.tileKey(x, y);
                if (blocked.has(key)) {
                    continue;
                }

                if (grid[y][x] === TILE_TYPES.FLOOR) {
                    return { x, y, key };
                }
            }

            return null;
        };

        const place = (tileType) => {
            const position = pickPosition();
            if (!position) {
                return null;
            }

            grid[position.y][position.x] = tileType;
            blocked.add(position.key);
            return { x: position.x, y: position.y };
        };

        const down = place(TILE_TYPES.STAIRS_DOWN);
        let up = null;
        if (this.currentFloor > 0) {
            up = place(TILE_TYPES.STAIRS_UP);
        }

        return { up, down };
    }

    generateHazardsForGrid(grid, rng, areaType, layout = null) {
        const hazards = new Map();
        const steamRule = getHazardEffectRule(HAZARD_TYPES.STEAM);
        const roomTileKeys = layout?.roomTileKeys;
        const roomOnly = areaType === AREA_TYPES.CATACOMBS && roomTileKeys instanceof Set;

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const key = this.tileKey(x, y);
                if (roomOnly && !roomTileKeys.has(key)) {
                    continue;
                }

                if (grid[y][x] === steamRule?.spawnTile && rng.next() < (steamRule?.generationChance ?? 0)) {
                    hazards.set(key, HAZARD_TYPES.STEAM);
                }
            }
        }

        return hazards;
    }

    generateTrapsForGrid(grid, rng, areaType, layout = null) {
        const traps = new Map();
        const trapTypes = getTrapTypes();
        const roomTileKeys = layout?.roomTileKeys;
        const roomOnly = areaType === AREA_TYPES.CATACOMBS && roomTileKeys instanceof Set;

        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const key = this.tileKey(x, y);
                if (roomOnly && !roomTileKeys.has(key)) {
                    continue;
                }

                const tile = grid[y][x];
                if (tile !== TILE_TYPES.FLOOR) {
                    continue;
                }

                if (rng.next() >= 0.025) {
                    continue;
                }

                traps.set(key, trapTypes[rng.randomInt(0, trapTypes.length - 1)]);
            }
        }

        return traps;
    }

    selectAreaTypeForFloor(floorIndex) {
        const rules = getAreaSelectionRules();

        if (floorIndex % rules.floatingModulo === rules.floatingRemainder) {
            return AREA_TYPES.FLOATING;
        }
        if (floorIndex % rules.swampModulo === rules.swampRemainder) {
            return AREA_TYPES.SWAMP;
        }
        if (floorIndex % rules.dungeonModulo === rules.dungeonRemainder) {
            return AREA_TYPES.DUNGEON;
        }
        return AREA_TYPES.CATACOMBS;
    }

    getGeneratorType(areaType) {
        return `generator:${areaType}`;
    }

    getCurrentFloor() {
        return this.floors[this.currentFloor];
    }

    getCurrentFloorMeta() {
        return this.getCurrentFloor().meta;
    }

    getAreaType(floorIndex = this.currentFloor) {
        return this.floors[floorIndex]?.meta?.areaType || AREA_TYPES.DUNGEON;
    }

    getMapData(floorIndex = this.currentFloor) {
        const floor = this.floors[floorIndex];
        if (!floor) return null;

        return {
            floorIndex,
            areaType: floor.meta.areaType,
            explored: Array.from(floor.fov.explored),
            mapRevealed: floor.meta.mapRevealed
        };
    }

    revealCurrentMap() {
        const floor = this.getCurrentFloor();
        floor.meta.mapRevealed = true;
        floor.fov.revealAll();
    }

    descendFloor() {
        this.currentFloor++;
        if (!this.floors[this.currentFloor]) {
            this.generateFloor();
        }
    }

    ascendFloor() {
        if (this.currentFloor > 0) {
            this.currentFloor--;
        }
    }

    findFirstTile(tileType) {
        const grid = this.getCurrentFloor().grid;
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (grid[y][x] === tileType) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    moveActorToTile(actor, tileType) {
        const position = this.findFirstTile(tileType);
        if (!position || !actor) {
            return false;
        }

        actor.x = position.x;
        actor.y = position.y;
        return true;
    }

    resolvePlayerHazardTransition(player, tileType) {
        if (!player) {
            return false;
        }

        if (tileType === TILE_TYPES.PIT || tileType === TILE_TYPES.WATER) {
            const safePos = findNearestSafeTile(player.x, player.y, this.getCurrentFloor().grid, this.currentFloor);
            player.x = safePos.x;
            player.y = safePos.y;

            if (tileType === TILE_TYPES.PIT && this.currentFloor > 0) {
                const pitX = player.x;
                const pitY = player.y;
                this.ascendFloor();
                const safePrevFloor = findNearestSafeTile(pitX, pitY, this.getCurrentFloor().grid, this.currentFloor);
                player.x = safePrevFloor.x;
                player.y = safePrevFloor.y;
            }
            return true;
        }

        if (tileType === TILE_TYPES.STAIRS_DOWN) {
            this.descendFloor();
            return this.moveActorToTile(player, TILE_TYPES.STAIRS_UP);
        }

        if (tileType === TILE_TYPES.STAIRS_UP && this.currentFloor > 0) {
            this.ascendFloor();
            return this.moveActorToTile(player, TILE_TYPES.STAIRS_DOWN);
        }

        return false;
    }

    getTile(x, y) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return TILE_TYPES.WALL;
        return this.getCurrentFloor().grid[y][x];
    }

    getHazard(x, y) {
        return this.getCurrentFloor().hazards.get(this.tileKey(x, y)) || null;
    }

    getTrap(x, y) {
        return this.getCurrentFloor().traps.get(this.tileKey(x, y)) || null;
    }

    isTrapRevealed(x, y) {
        return this.getCurrentFloor().revealedTraps.has(this.tileKey(x, y));
    }

    revealTrap(x, y) {
        const key = this.tileKey(x, y);
        if (this.getCurrentFloor().traps.has(key)) {
            this.getCurrentFloor().revealedTraps.add(key);
        }
    }

    removeTrap(x, y) {
        const key = this.tileKey(x, y);
        this.getCurrentFloor().traps.delete(key);
        this.getCurrentFloor().revealedTraps.delete(key);
    }

    setTrap(x, y, trapType, revealed = false) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
            return false;
        }

        const key = this.tileKey(x, y);
        if (!trapType) {
            this.getCurrentFloor().traps.delete(key);
            this.getCurrentFloor().revealedTraps.delete(key);
            return true;
        }

        this.getCurrentFloor().traps.set(key, trapType);
        if (revealed) {
            this.getCurrentFloor().revealedTraps.add(key);
        } else {
            this.getCurrentFloor().revealedTraps.delete(key);
        }

        return true;
    }

    setHazard(x, y, hazardType) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
            return;
        }

        const key = this.tileKey(x, y);

        if (!hazardType) {
            this.getCurrentFloor().hazards.delete(key);
            return;
        }

        this.getCurrentFloor().hazards.set(key, hazardType);
    }

    removeHazard(x, y) {
        this.getCurrentFloor().hazards.delete(this.tileKey(x, y));
    }

    setTile(x, y, tile) {
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            this.getCurrentFloor().grid[y][x] = tile;
        }
    }

    tileKey(x, y) {
        return `${x},${y}`;
    }

    addItem(x, y, item) {
        // prevent items on walls; other tile types are allowed
        const tile = this.getTile(x, y);
        if (tile === TILE_TYPES.WALL) {
            console.warn(`attempted to place item on wall at ${x},${y}`);
            return { placed: false, burned: false, blocked: true };
        }

        const burnable = Boolean(item?.properties?.burnable);
        if (doesTileBurnItems(tile) && burnable) {
            return { placed: false, burned: true, blocked: false };
        }

        const key = this.tileKey(x, y);
        if (!this.getCurrentFloor().items.has(key)) {
            this.getCurrentFloor().items.set(key, []);
        }
        this.getCurrentFloor().items.get(key).push(item);
        return { placed: true, burned: false, blocked: false };
    }

    removeItem(x, y, item) {
        const key = this.tileKey(x, y);
        const items = this.getCurrentFloor().items.get(key);
        if (items) {
            const index = items.indexOf(item);
            if (index > -1) {
                items.splice(index, 1);
                if (items.length === 0) {
                    this.getCurrentFloor().items.delete(key);
                }
            }
        }
    }

    getItems(x, y) {
        return this.getCurrentFloor().items.get(this.tileKey(x, y)) || [];
    }

    addEnemy(enemy) {
        const tile = this.getTile(enemy.x, enemy.y);
        if (typeof enemy.canTraverseTile === 'function' && !enemy.canTraverseTile(tile)) {
            console.warn(`enemy ${enemy.name} cannot be placed on ${tile} at ${enemy.x},${enemy.y}`);
            return;
        }

        if (typeof enemy.canTraverseTile !== 'function' && tile === TILE_TYPES.WALL) {
            console.warn(`enemy ${enemy.name} placed on wall at ${enemy.x},${enemy.y}`);
            return;
        }

        if (this.getEnemyAt(enemy.x, enemy.y)) {
            console.warn(`enemy ${enemy.name} overlaps another enemy at ${enemy.x},${enemy.y}`);
            return;
        }

        this.getCurrentFloor().enemies.push(enemy);
    }

    removeEnemy(enemy) {
        const index = this.getCurrentFloor().enemies.indexOf(enemy);
        if (index > -1) {
            this.getCurrentFloor().enemies.splice(index, 1);
        }
    }

    getEnemies() {
        return this.getCurrentFloor().enemies;
    }

    getEnemyAt(x, y, excludeEnemy = null) {
        for (const enemy of this.getCurrentFloor().enemies) {
            if (enemy === excludeEnemy) continue;
            if (!enemy.isAlive()) continue;
            if (enemy.x === x && enemy.y === y) {
                return enemy;
            }
        }
        return null;
    }

    canPlayerOccupy(x, y) {
        const grid = this.getCurrentFloor().grid;
        if (!isValidPosition(x, y, grid)) {
            return false;
        }
        return !this.getEnemyAt(x, y);
    }

    canEnemyOccupy(x, y, player, enemy, candidateEnemy = null) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
            return false;
        }
        if (player && player.x === x && player.y === y) {
            return false;
        }

        if (candidateEnemy && typeof candidateEnemy.canTraverseTile === 'function') {
            const tile = this.getTile(x, y);
            if (!candidateEnemy.canTraverseTile(tile)) {
                return false;
            }
        }

        return !this.getEnemyAt(x, y, enemy);
    }

    canSpawnItemAt(x, y, player = null) {
        const grid = this.getCurrentFloor().grid;
        if (!isValidPosition(x, y, grid)) {
            return false;
        }

        const tile = grid[y][x];
        if (tile === TILE_TYPES.WATER || tile === TILE_TYPES.PIT || doesTileBurnItems(tile)) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        return !this.getEnemyAt(x, y);
    }

    findRandomTile(rng, attempts, predicate) {
        for (let i = 0; i < attempts; i++) {
            const x = rng.randomInt(1, GRID_SIZE - 2);
            const y = rng.randomInt(1, GRID_SIZE - 2);
            if (predicate(x, y)) {
                return { x, y };
            }
        }
        return null;
    }

    findRandomOpenTile(rng, player = null, attempts = 200, candidateEnemy = null) {
        return this.findRandomTile(rng, attempts, (x, y) => this.canEnemyOccupy(x, y, player, null, candidateEnemy));
    }

    findRandomItemSpawnTile(rng, player = null, attempts = 200) {
        return this.findRandomTile(rng, attempts, (x, y) => this.canSpawnItemAt(x, y, player));
    }

    advanceHazards() {
        const activatedSteam = [];
        const floor = this.getCurrentFloor();
        const steamRule = getHazardEffectRule(HAZARD_TYPES.STEAM);

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const tile = floor.grid[y][x];
                const key = this.tileKey(x, y);
                const existingHazard = floor.hazards.get(key);

                if (tile !== steamRule?.spawnTile) {
                    floor.hazards.delete(key);
                    continue;
                }

                if (existingHazard === HAZARD_TYPES.STEAM) {
                    if (Math.random() < (steamRule?.dissipateChance ?? 0)) {
                        floor.hazards.delete(key);
                    }
                    continue;
                }

                if (Math.random() < (steamRule?.activationChance ?? 0)) {
                    floor.hazards.set(key, HAZARD_TYPES.STEAM);
                    activatedSteam.push(key);
                }
            }
        }

        return activatedSteam;
    }
}