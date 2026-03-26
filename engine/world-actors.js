// World actor collections and occupancy helpers

Object.assign(World.prototype, {
    ensureEnemyOccupancyIndex(floor = this.getCurrentFloor()) {
        if (!(floor.enemyOccupancy instanceof Map)) {
            floor.enemyOccupancy = new Map();
        }

        return floor.enemyOccupancy;
    },

    getEnemyOccupancyKey(x, y) {
        return toGridKey(x, y);
    },

    indexEnemy(enemy, floor = this.getCurrentFloor()) {
        if (!enemy || !enemy.isAlive?.()) {
            return;
        }

        const occupancy = this.ensureEnemyOccupancyIndex(floor);
        const key = this.getEnemyOccupancyKey(enemy.x, enemy.y);
        occupancy.set(key, enemy);
        enemy._occupancyKey = key;
        enemy._occupancyFloorIndex = this.currentFloor;
    },

    unindexEnemy(enemy, floor = this.getCurrentFloor()) {
        if (!enemy) {
            return;
        }

        const occupancy = this.ensureEnemyOccupancyIndex(floor);
        const key = enemy._occupancyKey || this.getEnemyOccupancyKey(enemy.x, enemy.y);
        if (occupancy.get(key) === enemy) {
            occupancy.delete(key);
        }

        delete enemy._occupancyKey;
        delete enemy._occupancyFloorIndex;
    },

    rebuildEnemyOccupancyIndex(floor = this.getCurrentFloor()) {
        const occupancy = this.ensureEnemyOccupancyIndex(floor);
        occupancy.clear();

        for (const enemy of floor.enemies) {
            if (!enemy?.isAlive?.()) {
                continue;
            }

            const key = this.getEnemyOccupancyKey(enemy.x, enemy.y);
            occupancy.set(key, enemy);
            enemy._occupancyKey = key;
            enemy._occupancyFloorIndex = this.currentFloor;
        }

        return occupancy;
    },

    moveEnemy(enemy, x, y) {
        if (!enemy) {
            return false;
        }

        const floor = this.getCurrentFloor();
        const isIndexedEnemy = floor.enemies.includes(enemy);
        if (isIndexedEnemy) {
            this.unindexEnemy(enemy, floor);
        }

        enemy.x = x;
        enemy.y = y;

        if (isIndexedEnemy) {
            this.indexEnemy(enemy, floor);
        }

        return true;
    },

    addEnemy(enemy) {
        const tile = this.getTile(enemy.x, enemy.y);
        if (typeof enemy.canTraverseTile === 'function' && !enemy.canTraverseTile(tile)) {
            return;
        }

        if (typeof enemy.canTraverseTile !== 'function' && tile === TILE_TYPES.WALL) {
            return;
        }

        if (this.getEnemyAt(enemy.x, enemy.y)) {
            return;
        }

        this.getCurrentFloor().enemies.push(enemy);
        this.indexEnemy(enemy);
    },

    removeEnemy(enemy) {
        const index = this.getCurrentFloor().enemies.indexOf(enemy);
        if (index > -1) {
            this.unindexEnemy(enemy);
            this.getCurrentFloor().enemies.splice(index, 1);
        }
    },

    getEnemies() {
        return this.getCurrentFloor().enemies;
    },

    getEnemyAt(x, y, excludeEnemy = null) {
        const occupancy = this.ensureEnemyOccupancyIndex();
        if (occupancy.size === 0 && this.getCurrentFloor().enemies.length > 0) {
            this.rebuildEnemyOccupancyIndex();
        }

        const enemy = occupancy.get(this.getEnemyOccupancyKey(x, y)) || null;
        if (!enemy || enemy === excludeEnemy || !enemy.isAlive?.()) {
            if (enemy && !enemy.isAlive?.()) {
                occupancy.delete(this.getEnemyOccupancyKey(x, y));
            }
            return null;
        }

        return enemy;
    },

    canPlayerOccupy(x, y) {
        const grid = this.getCurrentFloor().grid;
        if (!isValidPosition(x, y, grid)) {
            return false;
        }

        return !this.getEnemyAt(x, y);
    },

    canEnemyOccupy(x, y, player, enemy, candidateEnemy = null) {
        if (!this.isWithinBounds(x, y)) {
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
    },

    findRandomOpenTile(rng, player = null, attempts = 200, candidateEnemy = null) {
        return this.findRandomTile(rng, attempts, (x, y) => this.canEnemyOccupy(x, y, player, null, candidateEnemy));
    }
});