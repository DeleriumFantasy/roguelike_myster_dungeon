// World core runtime state helpers

class World {
    constructor(seed) {
        this.baseSeed = seed;
        this.floors = [];
        this.pathFloors = Object.create(null);
        this.pathSeedVersions = Object.create(null);
        this.currentFloor = 0;
        this.selectedDungeonPathId = getDefaultDungeonPathId();
        this.unlockedDungeonPathIds = new Set(getInitiallyUnlockedDungeonPathIds());
        this.unlockedDungeonPathIds.add(this.selectedDungeonPathId);
        this.completedDungeonPathIds = new Set();
        this.generateFloor();
    }

    normalizePathId(pathId = this.selectedDungeonPathId) {
        return normalizeStringValue(pathId, '');
    }

    normalizeFloorIndex(floorIndex = this.currentFloor) {
        return normalizeInteger(floorIndex, 0, 0);
    }

    ensurePathFloorsStore() {
        if (!this.pathFloors || typeof this.pathFloors !== 'object') {
            this.pathFloors = Object.create(null);
        }

        return this.pathFloors;
    }

    ensurePathSeedVersionsStore() {
        if (!this.pathSeedVersions || typeof this.pathSeedVersions !== 'object') {
            this.pathSeedVersions = Object.create(null);
        }

        return this.pathSeedVersions;
    }

    getDungeonPathSeedVersion(pathId = this.selectedDungeonPathId) {
        const normalizedPathId = this.normalizePathId(pathId);
        if (!normalizedPathId) {
            return 0;
        }

        const pathSeedVersions = this.ensurePathSeedVersionsStore();
        if (!Number.isFinite(pathSeedVersions[normalizedPathId])) {
            pathSeedVersions[normalizedPathId] = 0;
        }

        return normalizeInteger(pathSeedVersions[normalizedPathId], 0, 0);
    }

    getDungeonPathSeedOffset(pathId = this.selectedDungeonPathId) {
        const normalizedPathId = this.normalizePathId(pathId);
        let hash = this.getDungeonPathSeedVersion(normalizedPathId) % 1000003;

        for (let i = 0; i < normalizedPathId.length; i++) {
            hash = ((hash * 31) + normalizedPathId.charCodeAt(i)) % 1000003;
        }

        return hash;
    }

    getPathFloors(pathId = this.selectedDungeonPathId, options = {}) {
        const { createIfMissing = false } = options;
        const normalizedPathId = this.normalizePathId(pathId);
        if (!normalizedPathId) {
            return null;
        }

        const pathFloors = this.ensurePathFloorsStore();
        if (!Array.isArray(pathFloors[normalizedPathId]) && createIfMissing) {
            pathFloors[normalizedPathId] = [];
        }

        return Array.isArray(pathFloors[normalizedPathId])
            ? pathFloors[normalizedPathId]
            : null;
    }

    getFloorAt(floorIndex = this.currentFloor, pathId = this.selectedDungeonPathId) {
        const normalizedFloorIndex = this.normalizeFloorIndex(floorIndex);
        if (normalizedFloorIndex === 0) {
            return this.floors[0] || null;
        }

        const pathFloors = this.getPathFloors(pathId);
        return pathFloors?.[normalizedFloorIndex] || null;
    }

    setFloorAt(floorIndex, floorData, pathId = this.selectedDungeonPathId) {
        const normalizedFloorIndex = this.normalizeFloorIndex(floorIndex);
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

    getFloorGrid(floorIndex = this.currentFloor, pathId = this.selectedDungeonPathId) {
        return this.getFloorAt(floorIndex, pathId)?.grid || null;
    }

    getDisposalTiles() {
        return this.getCurrentFloor()?.disposalTiles || [];
    }

    getAreaType(floorIndex = this.currentFloor) {
        return this.getFloorAt(this.normalizeFloorIndex(floorIndex), this.selectedDungeonPathId)?.meta?.areaType || AREA_TYPES.DUNGEON;
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
        const normalizedPathId = this.normalizePathId(pathId);
        if (!normalizedPathId || !getDungeonPathDefinition(normalizedPathId)) {
            return false;
        }

        const pathSeedVersions = this.ensurePathSeedVersionsStore();
        const pathFloors = this.ensurePathFloorsStore();
        pathSeedVersions[normalizedPathId] = this.getDungeonPathSeedVersion(normalizedPathId) + 1;
        delete pathFloors[normalizedPathId];
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
        const grid = this.getFloorGrid();
        if (!Array.isArray(grid)) {
            return null;
        }

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
        const grid = this.getFloorGrid();
        if (!grid || !this.isWithinBounds(x, y)) {
            return TILE_TYPES.WALL;
        }

        return grid[y][x];
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
