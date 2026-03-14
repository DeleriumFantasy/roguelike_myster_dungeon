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
        const grid = this.generateGridForArea(areaType, rng);
        this.placeStairs(grid, rng);
        const hazards = this.generateHazardsForGrid(grid, rng);
        const traps = this.generateTrapsForGrid(grid, rng);

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
        const rule = getAreaGenerationRule(areaType);
        const grid = [];

        for (let y = 0; y < GRID_SIZE; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                grid[y][x] = this.generateTileFromAreaRule(rule, rng, x, y);
            }
        }

        this.applyAreaWalkers(grid, rule, rng);
        return grid;
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

    placeStairs(grid, rng) {
        const place = (tileType) => {
            let placed = false;
            while (!placed) {
                const x = rng.randomInt(1, GRID_SIZE - 2);
                const y = rng.randomInt(1, GRID_SIZE - 2);
                if (grid[y][x] === TILE_TYPES.FLOOR) {
                    grid[y][x] = tileType;
                    placed = true;
                }
            }
        };

        place(TILE_TYPES.STAIRS_DOWN);

        if (this.currentFloor > 0) {
            place(TILE_TYPES.STAIRS_UP);
        }
    }

    generateHazardsForGrid(grid, rng) {
        const hazards = new Map();
        const steamRule = getHazardEffectRule(HAZARD_TYPES.STEAM);

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (grid[y][x] === steamRule?.spawnTile && rng.next() < (steamRule?.generationChance ?? 0)) {
                    hazards.set(`${x},${y}`, HAZARD_TYPES.STEAM);
                }
            }
        }

        return hazards;
    }

    generateTrapsForGrid(grid, rng) {
        const traps = new Map();
        const trapTypes = getTrapTypes();

        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const tile = grid[y][x];
                if (tile !== TILE_TYPES.FLOOR) {
                    continue;
                }

                if (rng.next() >= 0.025) {
                    continue;
                }

                traps.set(`${x},${y}`, trapTypes[rng.randomInt(0, trapTypes.length - 1)]);
            }
        }

        return traps;
    }

    selectAreaTypeForFloor(floorIndex) {
        // Placeholder progression until weighted biome selection is implemented.
        if (floorIndex % 5 === 4) {
            return AREA_TYPES.FLOATING;
        }
        if (floorIndex % 3 === 2) {
            return AREA_TYPES.SWAMP;
        }
        return AREA_TYPES.DUNGEON;
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