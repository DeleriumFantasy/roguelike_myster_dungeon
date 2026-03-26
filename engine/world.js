// World core runtime state helpers

class World {
    constructor(seed) {
        this.baseSeed = seed;
        this.floors = [];
        this.currentFloor = 0;
        this.generateFloor();
    }

    isWithinBounds(x, y) {
        return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
    }

    isWithinInteriorBounds(x, y) {
        return x > 0 && x < GRID_SIZE - 1 && y > 0 && y < GRID_SIZE - 1;
    }

    isFloorTile(grid, x, y) {
        return grid[y][x] === TILE_TYPES.FLOOR;
    }

    isFilteredOutByRoomOnly(roomOnly, roomTileKeys, key) {
        return Boolean(roomOnly && !roomTileKeys.has(key));
    }

    getCurrentFloor() {
        return this.floors[this.currentFloor];
    }

    getDisposalTiles() {
        return this.getCurrentFloor().disposalTiles || [];
    }

    getAreaType(floorIndex = this.currentFloor) {
        return this.floors[floorIndex]?.meta?.areaType || AREA_TYPES.DUNGEON;
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

    getTile(x, y) {
        if (!this.isWithinBounds(x, y)) return TILE_TYPES.WALL;
        return this.getCurrentFloor().grid[y][x];
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

    findRandomFloorTile(rng, attempts = 200) {
        return this.findRandomTile(rng, attempts, (x, y) => this.getTile(x, y) === TILE_TYPES.FLOOR);
    }
}
