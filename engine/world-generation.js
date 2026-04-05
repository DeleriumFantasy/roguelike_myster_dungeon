// World generation helpers

Object.assign(World.prototype, {
    generateFloor(areaType = this.selectAreaTypeForFloor(this.currentFloor)) {
        const pathSeedOffset = this.currentFloor > 0
            ? this.getDungeonPathSeedOffset(this.selectedDungeonPathId)
            : 0;
        const rng = new SeededRNG(this.baseSeed + this.currentFloor + pathSeedOffset);
        const layout = this.generateGridForArea(areaType, rng);
        const grid = layout.grid;
        const stairPositions = this.placeStairs(grid, rng, layout);

        if (areaType === AREA_TYPES.CATACOMBS) {
            this.decorateCatacombsHallways(grid, rng, layout, stairPositions);
        }

        this.applyDungeonPathTileRestrictions(grid, areaType);

        const hazards = areaType === AREA_TYPES.OVERWORLD
            ? new Map()
            : this.generateHazardsForGrid(grid, rng, areaType, layout);
        const traps = areaType === AREA_TYPES.OVERWORLD
            ? new Map()
            : this.generateTrapsForGrid(grid, rng, areaType, layout);
        const disposalTiles = this.collectTilesByType(grid, [TILE_TYPES.WATER, TILE_TYPES.LAVA]);
        const weather = this.generateWeatherForFloor(rng, areaType);

        this.setFloorAt(this.currentFloor, {
            grid,
            hazards,
            traps,
            disposalTiles,
            revealedTraps: new Set(),
            items: new Map(),
            enemies: [],
            npcs: [],
            fov: new FOV(grid),
            meta: {
                areaType,
                generatorType: this.getGeneratorType(areaType),
                catacombsRooms: Array.isArray(layout?.rooms) ? layout.rooms.map((room) => ({ ...room })) : [],
                stairPositions: stairPositions ? {
                    up: stairPositions.up ? { ...stairPositions.up } : null,
                    down: stairPositions.down ? { ...stairPositions.down } : null
                } : null,
                premadeItemSpawns: Array.isArray(layout?.premadeItemSpawns) ? [...layout.premadeItemSpawns] : [],
                premadeEnemySpawns: Array.isArray(layout?.premadeEnemySpawns) ? [...layout.premadeEnemySpawns] : [],
                contentSpawned: false,
                weather
            }
        }, this.selectedDungeonPathId);
    },

    generateWeatherForFloor(rng, areaType = AREA_TYPES.DUNGEON) {
        if (getRngRoll() > WEATHER_GENERATION_CHANCE) {
            return WEATHER_TYPES.NONE;
        }

        const weights = WEATHER_SPAWN_WEIGHTS[areaType] || {};
        if (Object.keys(weights).length === 0) {
            return WEATHER_TYPES.NONE;
        }

        const validWeathers = Object.entries(weights);
        let totalWeight = 0;
        for (const [_, weight] of validWeathers) {
            totalWeight += weight;
        }

        let roll = getRngRoll() * totalWeight;
        for (const [weather, weight] of validWeathers) {
            roll -= weight;
            if (roll <= 0) {
                return weather;
            }
        }

        return WEATHER_TYPES.NONE;
    },

    applyDungeonPathTileRestrictions(grid, areaType) {
        if (!Array.isArray(grid) || areaType === AREA_TYPES.OVERWORLD || this.currentFloor <= 0) {
            return;
        }

        const disallowedTiles = getDungeonPathDisallowedTiles(this.selectedDungeonPathId);
        if (!Array.isArray(disallowedTiles) || disallowedTiles.length === 0) {
            return;
        }

        const blockedTiles = new Set(disallowedTiles);
        const replacementTile = blockedTiles.has(TILE_TYPES.WATER)
            ? TILE_TYPES.FLOOR
            : TILE_TYPES.WATER;
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (!blockedTiles.has(grid[y][x])) {
                    continue;
                }

                grid[y][x] = replacementTile;
            }
        }
    },

    collectTilesByType(grid, tileTypes) {
        const targetTiles = new Set(tileTypes);
        const matches = [];

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const tile = grid[y][x];
                if (targetTiles.has(tile)) {
                    matches.push({ x, y, tile });
                }
            }
        }

        return matches;
    },

    generateGridForArea(areaType, rng) {
        if (areaType === AREA_TYPES.OVERWORLD) {
            return this.generateOverworldGrid();
        }

        if (areaType === AREA_TYPES.CATACOMBS) {
            return this.generateCatacombsGrid(rng);
        }

        const rule = getAreaGenerationRule(areaType);
        const grid = [];
        const premadeItemSpawns = [];
        const premadeEnemySpawns = [];

        for (let y = 0; y < GRID_SIZE; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                grid[y][x] = this.generateTileFromAreaRule(rule, rng, x, y);
            }
        }

        this.applyAreaWalkers(grid, rule, rng);
        this.applyPremadeTerrainShapes(grid, areaType, rng, this.currentFloor, premadeItemSpawns, premadeEnemySpawns);
        return {
            grid,
            roomTileKeys: null,
            hallwayTileKeys: null,
            rooms: null,
            premadeItemSpawns,
            premadeEnemySpawns
        };
    },

    generateOverworldGrid() {
        const config = getOverworldGenerationConfig();
        const centerX = Math.floor(GRID_SIZE / 2);
        const centerY = Math.floor(GRID_SIZE / 2);
        const halfWidth = clamp(Math.floor(Number(config?.halfWidth) || 14), 4, Math.floor((GRID_SIZE - 2) / 2));
        const halfHeight = clamp(Math.floor(Number(config?.halfHeight) || 12), 4, Math.floor((GRID_SIZE - 2) / 2));
        const cornerInset = Math.max(0, Math.floor(Number(config?.cornerInset) || 0));
        const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(TILE_TYPES.WALL));

        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const dx = Math.abs(x - centerX);
                const dy = Math.abs(y - centerY);
                if (dx > halfWidth || dy > halfHeight) {
                    continue;
                }

                const insetX = Math.max(0, dx - Math.max(0, halfWidth - cornerInset));
                const insetY = Math.max(0, dy - Math.max(0, halfHeight - cornerInset));
                if (insetX + insetY > cornerInset) {
                    continue;
                }

                grid[y][x] = TILE_TYPES.FLOOR;
            }
        }

        return {
            grid,
            roomTileKeys: null,
            hallwayTileKeys: null,
            rooms: null
        };
    },

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
                hallwayTileKeys: null,
                rooms: null
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
            hallwayTileKeys,
            rooms: rooms.map((room) => ({ ...room }))
        };
    },

    doesRoomOverlap(existingRooms, candidate, padding = 0) {
        return existingRooms.some((room) => (
            candidate.x <= room.x + room.width - 1 + padding
            && candidate.x + candidate.width - 1 + padding >= room.x
            && candidate.y <= room.y + room.height - 1 + padding
            && candidate.y + candidate.height - 1 + padding >= room.y
        ));
    },

    carveRoom(grid, room, roomTileKeys) {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                grid[y][x] = TILE_TYPES.FLOOR;
                roomTileKeys.add(this.tileKey(x, y));
            }
        }
    },

    getRoomCenter(room) {
        return {
            x: Math.floor(room.x + room.width / 2),
            y: Math.floor(room.y + room.height / 2)
        };
    },

    carveHallwayBetweenPoints(grid, from, to, rng, roomTileKeys, hallwayTileKeys) {
        const carveCell = (x, y) => {
            if (!this.isWithinInteriorBounds(x, y)) {
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
    },

    decorateCatacombsHallways(grid, rng, layout, stairPositions) {
        const hallwayKeys = layout?.hallwayTileKeys;
        if (!hallwayKeys || hallwayKeys.size === 0) {
            return;
        }

        const start = stairPositions?.up || this.findNearestFloorToCenter(grid);
        const end = stairPositions?.down;
        const protectedPath = start && end
            ? this.findCardinalPathKeys(grid, start, end, (tile) => tile === TILE_TYPES.FLOOR || tile === TILE_TYPES.SHOP || tile === TILE_TYPES.STAIRS_UP || tile === TILE_TYPES.STAIRS_DOWN)
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

            const [x, y] = fromGridKey(key);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue;
            }

            const replacement = pickRandom(hallwayHazardTiles, rng, TILE_TYPES.FLOOR);
            grid[y][x] = replacement;
        }
    },

    findNearestFloorToCenter(grid) {
        const center = {
            x: Math.floor(GRID_SIZE / 2),
            y: Math.floor(GRID_SIZE / 2)
        };

        const floorCandidates = [];
        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                if (!this.isFloorTile(grid, x, y)) {
                    continue;
                }

                floorCandidates.push({ x, y });
            }
        }

        return getNearestByDistance(center.x, center.y, floorCandidates);
    },

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
    },

    applyPremadeTerrainShapes(grid, areaType, rng, floorIndex, premadeItemSpawns = [], premadeEnemySpawns = []) {
        const placementRules = getPremadeTerrainPlacementRulesForFloor(areaType, floorIndex);
        for (const placementRule of placementRules) {
            const chance = Number.isFinite(placementRule.chance) ? placementRule.chance : 1;
            if (rng.next() > chance) {
                continue;
            }

            const minCount = Number.isFinite(placementRule.minCount) ? Math.max(0, placementRule.minCount) : 0;
            const maxCount = Number.isFinite(placementRule.maxCount) ? Math.max(minCount, placementRule.maxCount) : minCount;
            if (maxCount <= 0) {
                continue;
            }

            const effectiveMinCount = minCount === 0 ? 1 : minCount;
            const targetCount = maxCount > effectiveMinCount
                ? rng.randomInt(effectiveMinCount, maxCount)
                : effectiveMinCount;

            for (let i = 0; i < targetCount; i++) {
                this.placePremadeTerrainShapeRandom(grid, placementRule.shapeId, rng, 40, premadeItemSpawns, premadeEnemySpawns);
            }
        }
    },

    placePremadeTerrainShapeRandom(grid, shapeId, rng, attempts = 40, premadeItemSpawns = [], premadeEnemySpawns = []) {
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

            this.applyPremadeTerrainShapeAt(grid, shape, startX, startY, premadeItemSpawns, premadeEnemySpawns);
            return true;
        }

        return false;
    },

    forEachShapeCell(shape, callback) {
        const legend = getPremadeTerrainLegend();
        for (let rowIndex = 0; rowIndex < shape.rows.length; rowIndex++) {
            const row = shape.rows[rowIndex];
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const symbol = row[colIndex];
                const replacementTile = legend[symbol];
                if (!replacementTile) continue;
                if (callback(rowIndex, colIndex, replacementTile) === false) return false;
            }
        }
        return true;
    },

    canPlacePremadeTerrainShapeAt(grid, shape, startX, startY) {
        return this.forEachShapeCell(shape, (rowIndex, colIndex) => {
            const x = startX + colIndex;
            const y = startY + rowIndex;
            if (!this.isWithinInteriorBounds(x, y)) return false;
            if (grid[y][x] === TILE_TYPES.STAIRS_UP || grid[y][x] === TILE_TYPES.STAIRS_DOWN) return false;
        });
    },

    applyPremadeTerrainShapeAt(grid, shape, startX, startY, premadeItemSpawns = [], premadeEnemySpawns = []) {
        this.forEachShapeCell(shape, (rowIndex, colIndex, replacementTile) => {
            const x = startX + colIndex;
            const y = startY + rowIndex;
            if (replacementTile === 'premade_random_item') {
                grid[y][x] = TILE_TYPES.FLOOR;
                premadeItemSpawns.push({ x, y });
                return;
            }

            if (replacementTile === 'premade_random_enemy') {
                grid[y][x] = TILE_TYPES.FLOOR;
                premadeEnemySpawns.push({ x, y });
                return;
            }

            grid[y][x] = replacementTile;
        });
    },

    generateTileFromAreaRule(rule, rng, x, y) {
        if (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1) {
            return rule.boundaryTile;
        }

        for (const replacementRule of rule.replacementRules || []) {
            if (rng.next() >= replacementRule.chance) {
                continue;
            }

            if (Array.isArray(replacementRule.choices) && replacementRule.choices.length > 0) {
                return pickRandom(replacementRule.choices, rng, replacementRule.tile);
            }

            return replacementRule.tile;
        }

        return rule.baseTile;
    },

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
                const next = pickRandom(neighbors, rng, { x, y });
                x = clamp(next.x, 1, GRID_SIZE - 2);
                y = clamp(next.y, 1, GRID_SIZE - 2);
            }
        }
    },

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

                    const [x, y] = fromGridKey(key);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) {
                        continue;
                    }

                    if (this.isFloorTile(grid, x, y)) {
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

                if (this.isFloorTile(grid, x, y)) {
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

        const maxDepth = getDungeonPathMaxDepth(this.selectedDungeonPathId);
        const canPlaceDownStairs = this.currentFloor === 0
            || !Number.isFinite(maxDepth)
            || this.currentFloor <= maxDepth;
        const down = canPlaceDownStairs ? place(TILE_TYPES.STAIRS_DOWN) : null;
        let up = null;
        if (this.currentFloor > 0) {
            up = place(TILE_TYPES.STAIRS_UP);
        }

        return { up, down };
    },

    getRoomGenFilter(areaType, layout) {
        const roomTileKeys = layout?.roomTileKeys;
        const roomOnly = areaType === AREA_TYPES.CATACOMBS && roomTileKeys instanceof Set;
        return { roomTileKeys, roomOnly };
    },

    generateHazardsForGrid(grid, rng, areaType, layout = null) {
        const hazards = new Map();
        const steamRule = getHazardEffectRule(HAZARD_TYPES.STEAM);
        const { roomTileKeys, roomOnly } = this.getRoomGenFilter(areaType, layout);

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const key = this.tileKey(x, y);
                if (this.isFilteredOutByRoomOnly(roomOnly, roomTileKeys, key)) {
                    continue;
                }

                if (grid[y][x] === steamRule?.spawnTile && rng.next() < (steamRule?.generationChance ?? 0)) {
                    hazards.set(key, HAZARD_TYPES.STEAM);
                }
            }
        }

        return hazards;
    },

    generateTrapsForGrid(grid, rng, areaType, layout = null) {
        const traps = new Map();
        const trapTypes = getTrapTypes();
        const { roomTileKeys, roomOnly } = this.getRoomGenFilter(areaType, layout);

        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const key = this.tileKey(x, y);
                if (this.isFilteredOutByRoomOnly(roomOnly, roomTileKeys, key)) {
                    continue;
                }

                const tile = grid[y][x];
                if (tile !== TILE_TYPES.FLOOR) {
                    continue;
                }

                if (rng.next() >= 0.025) {
                    continue;
                }

                traps.set(key, pickRandom(trapTypes, rng));
            }
        }

        return traps;
    },

    selectAreaTypeForFloor(floorIndex) {
        if (floorIndex === 0) {
            return AREA_TYPES.OVERWORLD;
        }

        const dungeonFloorIndex = Math.max(0, floorIndex - 1);
        const pathAreaType = getDungeonAreaTypeForDepth(this.selectedDungeonPathId, dungeonFloorIndex);
        if (pathAreaType) {
            return pathAreaType;
        }

        const rules = getAreaSelectionRules();

        if (dungeonFloorIndex % rules.floatingModulo === rules.floatingRemainder) {
            return AREA_TYPES.FLOATING;
        }
        if (dungeonFloorIndex % rules.swampModulo === rules.swampRemainder) {
            return AREA_TYPES.SWAMP;
        }
        if (dungeonFloorIndex % rules.dungeonModulo === rules.dungeonRemainder) {
            return AREA_TYPES.DUNGEON;
        }
        return AREA_TYPES.CATACOMBS;
    },

    getGeneratorType(areaType) {
        return `generator:${areaType}`;
    }
});
