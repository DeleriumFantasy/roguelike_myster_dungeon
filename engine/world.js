// World core runtime state helpers

class World {
    constructor(seed) {
        this.baseSeed = seed;
        this.floors = [];
        this.pathFloors = {};
        this.pathSeedVersions = {};
        this.currentFloor = 0;
        this.selectedDungeonPathId = getDefaultDungeonPathId();
        this.unlockedDungeonPathIds = new Set(getInitiallyUnlockedDungeonPathIds());
        this.unlockedDungeonPathIds.add(this.selectedDungeonPathId);
        this.completedDungeonPathIds = new Set();
        this.generateFloor();
    }

    getDungeonPathSeedVersion(pathId = this.selectedDungeonPathId) {
        const normalizedPathId = typeof pathId === 'string' ? pathId : '';
        if (!normalizedPathId) {
            return 0;
        }

        if (!this.pathSeedVersions || typeof this.pathSeedVersions !== 'object') {
            this.pathSeedVersions = {};
        }

        if (!Number.isFinite(this.pathSeedVersions[normalizedPathId])) {
            this.pathSeedVersions[normalizedPathId] = 0;
        }

        return Math.max(0, Math.floor(Number(this.pathSeedVersions[normalizedPathId]) || 0));
    }

    getDungeonPathSeedOffset(pathId = this.selectedDungeonPathId) {
        const normalizedPathId = typeof pathId === 'string' ? pathId : '';
        let hash = this.getDungeonPathSeedVersion(normalizedPathId) % 1000003;

        for (let i = 0; i < normalizedPathId.length; i++) {
            hash = ((hash * 31) + normalizedPathId.charCodeAt(i)) % 1000003;
        }

        return hash;
    }

    getPathFloors(pathId = this.selectedDungeonPathId, options = {}) {
        const { createIfMissing = false } = options;
        const normalizedPathId = typeof pathId === 'string' ? pathId : '';
        if (!normalizedPathId) {
            return null;
        }

        if (!Array.isArray(this.pathFloors[normalizedPathId]) && createIfMissing) {
            this.pathFloors[normalizedPathId] = [];
        }

        return Array.isArray(this.pathFloors[normalizedPathId])
            ? this.pathFloors[normalizedPathId]
            : null;
    }

    getFloorAt(floorIndex = this.currentFloor, pathId = this.selectedDungeonPathId) {
        const normalizedFloorIndex = Math.max(0, Math.floor(Number(floorIndex) || 0));
        if (normalizedFloorIndex === 0) {
            return this.floors[0] || null;
        }

        const pathFloors = this.getPathFloors(pathId);
        return pathFloors?.[normalizedFloorIndex] || null;
    }

    setFloorAt(floorIndex, floorData, pathId = this.selectedDungeonPathId) {
        const normalizedFloorIndex = Math.max(0, Math.floor(Number(floorIndex) || 0));
        if (normalizedFloorIndex === 0) {
            this.floors[0] = floorData;
            return;
        }

        const pathFloors = this.getPathFloors(pathId, { createIfMissing: true });
        pathFloors[normalizedFloorIndex] = floorData;
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
        return this.getFloorAt(this.currentFloor, this.selectedDungeonPathId);
    }

    getDisposalTiles() {
        return this.getCurrentFloor().disposalTiles || [];
    }

    getAreaType(floorIndex = this.currentFloor) {
        return this.getFloorAt(floorIndex, this.selectedDungeonPathId)?.meta?.areaType || AREA_TYPES.DUNGEON;
    }

    getSelectedDungeonPathId() {
        return this.selectedDungeonPathId;
    }

    isDungeonPathUnlocked(pathId) {
        return this.unlockedDungeonPathIds.has(pathId);
    }

    unlockDungeonPath(pathId) {
        if (!getDungeonPathDefinition(pathId)) {
            return false;
        }

        this.unlockedDungeonPathIds.add(pathId);
        return true;
    }

    hasCompletedDungeonPath(pathId) {
        return this.completedDungeonPathIds.has(pathId);
    }

    markDungeonPathCompleted(pathId) {
        if (!getDungeonPathDefinition(pathId)) {
            return false;
        }

        this.completedDungeonPathIds.add(pathId);
        this.unlockDungeonPath(pathId);
        return true;
    }

    rerollDungeonPath(pathId = this.selectedDungeonPathId) {
        const normalizedPathId = typeof pathId === 'string' ? pathId : '';
        if (!normalizedPathId || !getDungeonPathDefinition(normalizedPathId)) {
            return false;
        }

        if (!this.pathSeedVersions || typeof this.pathSeedVersions !== 'object') {
            this.pathSeedVersions = {};
        }

        this.pathSeedVersions[normalizedPathId] = this.getDungeonPathSeedVersion(normalizedPathId) + 1;
        delete this.pathFloors[normalizedPathId];
        return true;
    }

    setSelectedDungeonPath(pathId) {
        if (!getDungeonPathDefinition(pathId) || !this.isDungeonPathUnlocked(pathId)) {
            return false;
        }

        this.selectedDungeonPathId = pathId;
        return true;
    }

    getDungeonPathOptions() {
        const definitions = getDungeonPathDefinitions();
        return Object.keys(definitions)
            .filter((pathId) => this.isDungeonPathUnlocked(pathId))
            .map((pathId) => {
                const definition = definitions[pathId] || {};
                return {
                    id: pathId,
                    name: typeof definition.name === 'string' ? definition.name : pathId
                };
            });
    }

    descendFloor() {
        this.currentFloor++;
        if (!this.getFloorAt(this.currentFloor, this.selectedDungeonPathId)) {
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
