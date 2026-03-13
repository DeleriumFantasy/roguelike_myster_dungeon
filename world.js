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

        this.floors[this.currentFloor] = {
            grid,
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
        switch (areaType) {
            case AREA_TYPES.SWAMP:
                return this.generateSwampGrid(rng);
            case AREA_TYPES.FLOATING:
                return this.generateFloatingGrid(rng);
            case AREA_TYPES.DUNGEON:
            default:
                return this.generateDungeonGrid(rng);
        }
    }

    generateDungeonGrid(rng) {
        const grid = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                if (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1) {
                    grid[y][x] = TILE_TYPES.WALL;
                } else if (rng.next() < 0.1) {
                    grid[y][x] = TILE_TYPES.WALL;
                } else if (rng.next() < 0.05) {
                    const hazards = [TILE_TYPES.PIT, TILE_TYPES.WATER, TILE_TYPES.SPIKE];
                    grid[y][x] = hazards[rng.randomInt(0, hazards.length - 1)];
                } else {
                    grid[y][x] = TILE_TYPES.FLOOR;
                }
            }
        }

        return grid;
    }

    generateSwampGrid(rng) {
        const grid = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                if (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1) {
                    grid[y][x] = TILE_TYPES.WALL;
                } else if (rng.next() < 0.25) {
                    grid[y][x] = TILE_TYPES.WATER;
                } else if (rng.next() < 0.06) {
                    grid[y][x] = TILE_TYPES.WALL;
                } else {
                    grid[y][x] = TILE_TYPES.FLOOR;
                }
            }
        }

        // Placeholder for "crooked pathways": random walkers carve floor corridors.
        const walkers = 4;
        for (let i = 0; i < walkers; i++) {
            let x = rng.randomInt(1, GRID_SIZE - 2);
            let y = rng.randomInt(1, GRID_SIZE - 2);
            for (let step = 0; step < GRID_SIZE * 2; step++) {
                grid[y][x] = TILE_TYPES.FLOOR;
                const next = getNeighbors(x, y)[rng.randomInt(0, 3)];
                x = clamp(next.x, 1, GRID_SIZE - 2);
                y = clamp(next.y, 1, GRID_SIZE - 2);
            }
        }

        return grid;
    }

    generateFloatingGrid(rng) {
        const grid = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                // Floating floors use pits as boundaries instead of walls.
                if (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1) {
                    grid[y][x] = TILE_TYPES.PIT;
                } else if (rng.next() < 0.12) {
                    grid[y][x] = TILE_TYPES.PIT;
                } else {
                    grid[y][x] = TILE_TYPES.FLOOR;
                }
            }
        }

        return grid;
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

    getTile(x, y) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return TILE_TYPES.WALL;
        return this.getCurrentFloor().grid[y][x];
    }

    setTile(x, y, tile) {
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            this.getCurrentFloor().grid[y][x] = tile;
        }
    }

    addItem(x, y, item) {
        // prevent items on walls; other tile types are allowed
        const tile = this.getTile(x, y);
        if (tile === TILE_TYPES.WALL) {
            console.warn(`attempted to place item on wall at ${x},${y}`);
            return;
        }
        const key = `${x},${y}`;
        if (!this.getCurrentFloor().items.has(key)) {
            this.getCurrentFloor().items.set(key, []);
        }
        this.getCurrentFloor().items.get(key).push(item);
    }

    removeItem(x, y, item) {
        const key = `${x},${y}`;
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
        return this.getCurrentFloor().items.get(`${x},${y}`) || [];
    }

    addEnemy(enemy) {
        // only add enemies to non-wall tiles
        const tile = this.getTile(enemy.x, enemy.y);
        if (tile === TILE_TYPES.WALL) {
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

    canEnemyOccupy(x, y, player, enemy) {
        const grid = this.getCurrentFloor().grid;
        if (!isValidPosition(x, y, grid)) {
            return false;
        }
        if (player && player.x === x && player.y === y) {
            return false;
        }
        return !this.getEnemyAt(x, y, enemy);
    }

    canSpawnItemAt(x, y, player = null) {
        const grid = this.getCurrentFloor().grid;
        if (!isValidPosition(x, y, grid)) {
            return false;
        }

        const tile = grid[y][x];
        if (tile === TILE_TYPES.WATER || tile === TILE_TYPES.PIT) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        return !this.getEnemyAt(x, y);
    }

    findRandomOpenTile(rng, player = null, attempts = 200) {
        for (let i = 0; i < attempts; i++) {
            const x = rng.randomInt(1, GRID_SIZE - 2);
            const y = rng.randomInt(1, GRID_SIZE - 2);
            if (this.canEnemyOccupy(x, y, player, null)) {
                return { x, y };
            }
        }
        return null;
    }

    findRandomItemSpawnTile(rng, player = null, attempts = 200) {
        for (let i = 0; i < attempts; i++) {
            const x = rng.randomInt(1, GRID_SIZE - 2);
            const y = rng.randomInt(1, GRID_SIZE - 2);
            if (this.canSpawnItemAt(x, y, player)) {
                return { x, y };
            }
        }
        return null;
    }
}