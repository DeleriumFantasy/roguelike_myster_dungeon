// World tile state, hazard state, and item placement helpers

Object.assign(World.prototype, {
    getFloorMap(collectionName, floor = this.getCurrentFloor()) {
        if (!floor) {
            return new Map();
        }

        if (!(floor[collectionName] instanceof Map)) {
            floor[collectionName] = new Map();
        }

        return floor[collectionName];
    },

    getFloorSet(collectionName, floor = this.getCurrentFloor()) {
        if (!floor) {
            return new Set();
        }

        if (!(floor[collectionName] instanceof Set)) {
            floor[collectionName] = new Set();
        }

        return floor[collectionName];
    },

    getEnvironmentalDamageProfile(x, y) {
        const tile = this.getTile(x, y);
        const hazard = typeof this.getHazard === 'function' ? this.getHazard(x, y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        return { tile, hazard, tileDamage, hazardDamage };
    },

    getHazard(x, y) {
        const key = this.tileKey(x, y);
        return this.getFloorMap('hazards').get(key) || null;
    },

    getTrap(x, y) {
        const key = this.tileKey(x, y);
        return this.getFloorMap('traps').get(key) || null;
    },

    isTrapRevealed(x, y) {
        const key = this.tileKey(x, y);
        return this.getFloorSet('revealedTraps').has(key);
    },

    revealTrap(x, y) {
        const key = this.tileKey(x, y);
        const traps = this.getFloorMap('traps');
        if (traps.has(key)) {
            this.getFloorSet('revealedTraps').add(key);
        }
    },

    removeTrap(x, y) {
        const key = this.tileKey(x, y);
        this.getFloorMap('traps').delete(key);
        this.getFloorSet('revealedTraps').delete(key);
    },

    setTrap(x, y, trapType, revealed = false) {
        if (!this.isWithinBounds(x, y)) {
            return false;
        }

        const key = this.tileKey(x, y);
        const traps = this.getFloorMap('traps');
        const revealedTraps = this.getFloorSet('revealedTraps');
        if (!trapType) {
            traps.delete(key);
            revealedTraps.delete(key);
            return true;
        }

        traps.set(key, trapType);
        if (revealed) {
            revealedTraps.add(key);
        } else {
            revealedTraps.delete(key);
        }

        return true;
    },

    removeAllTrapsOnCurrentFloor() {
        const traps = this.getFloorMap('traps');
        const revealedTraps = this.getFloorSet('revealedTraps');
        const removedCount = traps.size;
        traps.clear();
        revealedTraps.clear();
        return removedCount;
    },

    setHazard(x, y, hazardType) {
        if (!this.isWithinBounds(x, y)) {
            return;
        }

        const key = this.tileKey(x, y);
        const hazards = this.getFloorMap('hazards');

        if (!hazardType) {
            hazards.delete(key);
            return;
        }

        hazards.set(key, hazardType);
    },

    removeHazard(x, y) {
        const key = this.tileKey(x, y);
        this.getFloorMap('hazards').delete(key);
    },

    setTile(x, y, tile) {
        if (this.isWithinBounds(x, y)) {
            this.getCurrentFloor().grid[y][x] = tile;
        }
    },

    tileKey(x, y) {
        return toGridKey(x, y);
    },

    isItemTileOccupied(x, y) {
        const floor = this.getCurrentFloor();
        const key = this.tileKey(x, y);
        const items = floor.items.get(key);
        return Array.isArray(items) && items.length > 0;
    },

    isItemBurnable(item) {
        return Boolean(item?.properties?.burnable);
    },

    getItemTilePlacementOutcome(x, y, item) {
        const tile = this.getTile(x, y);
        if (tile === TILE_TYPES.WALL) {
            return { blocked: true, burned: false };
        }

        if (doesTileBurnItems(tile) && this.isItemBurnable(item)) {
            return { blocked: false, burned: true };
        }

        return { blocked: false, burned: false };
    },

    createItemPlacementResult({ placed, burned = false, blocked = false, x = null, y = null }) {
        const result = { placed, burned, blocked };
        if (placed && Number.isFinite(x) && Number.isFinite(y)) {
            result.x = x;
            result.y = y;
        }

        return result;
    },

    canPlaceItemAt(x, y, item) {
        const outcome = this.getItemTilePlacementOutcome(x, y, item);
        if (outcome.blocked || outcome.burned) {
            return false;
        }

        return !this.isItemTileOccupied(x, y);
    },

    findNearestEmptyItemTile(x, y, item) {
        const queue = [{ x, y }];
        const visited = new Set([this.tileKey(x, y)]);
        const originOccupied = this.isItemTileOccupied(x, y);

        while (queue.length > 0) {
            const current = queue.shift();
            const isOrigin = current.x === x && current.y === y;
            const allowCurrentTile = !(isOrigin && originOccupied);
            if (allowCurrentTile && this.canPlaceItemAt(current.x, current.y, item)) {
                return current;
            }

            for (const neighbor of getNeighbors(current.x, current.y)) {
                if (!this.isWithinBounds(neighbor.x, neighbor.y)) {
                    continue;
                }

                const key = this.tileKey(neighbor.x, neighbor.y);
                if (visited.has(key)) {
                    continue;
                }

                visited.add(key);
                queue.push(neighbor);
            }
        }

        return null;
    },

    addItem(x, y, item) {
        const initialOutcome = this.getItemTilePlacementOutcome(x, y, item);
        if (initialOutcome.blocked) {
            return this.createItemPlacementResult({ placed: false, blocked: true });
        }

        if (initialOutcome.burned) {
            return this.createItemPlacementResult({ placed: false, burned: true });
        }

        const target = this.findNearestEmptyItemTile(x, y, item);
        if (!target) {
            return this.createItemPlacementResult({ placed: false, blocked: true });
        }

        const floor = this.getCurrentFloor();
        const key = this.tileKey(target.x, target.y);
        if (!floor.items.has(key)) {
            floor.items.set(key, []);
        }

        floor.items.get(key).push(item);
        return this.createItemPlacementResult({ placed: true, x: target.x, y: target.y });
    },

    removeItem(x, y, item) {
        const floor = this.getCurrentFloor();
        const key = this.tileKey(x, y);
        const items = floor.items.get(key);
        if (!items) {
            return;
        }

        const index = items.indexOf(item);
        if (index > -1) {
            items.splice(index, 1);
            if (items.length === 0) {
                floor.items.delete(key);
            }
        }
    },

    getItems(x, y) {
        const floor = this.getCurrentFloor();
        const key = this.tileKey(x, y);
        return floor.items.get(key) || [];
    },

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
    },

    findRandomItemSpawnTile(rng, player = null, attempts = 200) {
        return this.findRandomTile(rng, attempts, (x, y) => this.canSpawnItemAt(x, y, player));
    },

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
});