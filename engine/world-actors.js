// World actor collections and occupancy helpers

Object.assign(World.prototype, {
    isActorAlive(actor) {
        return Boolean(actor?.isAlive?.());
    },

    getLivingActors(actors) {
        const actorList = Array.isArray(actors) ? actors : [];
        return actorList.filter((actor) => this.isActorAlive(actor));
    },

    getEnemyCollection(floor = this.getCurrentFloor()) {
        return this.getFloorArray('enemies', floor);
    },

    getNpcCollection(floor = this.getCurrentFloor()) {
        return this.getFloorArray('npcs', floor);
    },

    ensureEnemyOccupancyIndex(floor = this.getCurrentFloor()) {
        return this.getFloorMap('enemyOccupancy', floor);
    },

    getEnemyOccupancyKey(x, y) {
        return toGridKey(x, y);
    },

    indexEnemy(enemy, floor = this.getCurrentFloor()) {
        if (!enemy || !this.isActorAlive(enemy)) {
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

        for (const enemy of this.getLivingActors(this.getEnemyCollection(floor))) {
            const key = this.getEnemyOccupancyKey(enemy.x, enemy.y);
            occupancy.set(key, enemy);
            enemy._occupancyKey = key;
            enemy._occupancyFloorIndex = this.currentFloor;
        }

        return occupancy;
    },

    moveActor(actor, x, y) {
        if (!actor) {
            return false;
        }

        const floor = this.getCurrentFloor();
        const isIndexedEnemy = this.getEnemyCollection(floor).includes(actor);
        if (isIndexedEnemy) {
            this.unindexEnemy(actor, floor);
        }

        actor.x = x;
        actor.y = y;

        if (isIndexedEnemy) {
            this.indexEnemy(actor, floor);
        }

        return true;
    },

    addActor(actor) {
        if (!actor) {
            return;
        }

        const tile = this.getTile(actor.x, actor.y);
        if (typeof actor.canTraverseTile === 'function' && !actor.canTraverseTile(tile)) {
            return;
        }

        if (typeof actor.canTraverseTile !== 'function' && tile === TILE_TYPES.WALL) {
            return;
        }

        if (this.getActorAt(actor.x, actor.y)) {
            return;
        }

        // Route NPCs to NPC collection, enemies to enemy collection
        if (typeof actor.isNeutralNpc === 'function' && actor.isNeutralNpc()) {
            this.addNpc(actor);
        } else {
            this.getEnemyCollection().push(actor);
            this.indexEnemy(actor);
        }
    },

    removeActor(actor) {
        const enemies = this.getEnemyCollection();
        const index = enemies.indexOf(actor);
        if (index > -1) {
            this.unindexEnemy(actor);
            enemies.splice(index, 1);
        }
    },

    removeEnemy(enemy) {
        this.removeActor(enemy);
    },

    getEnemies() {
        return this.getEnemyCollection();
    },

    getHostileActors() {
        return this.getLivingActors(this.getEnemyCollection()).filter((enemy) => !enemy.isAlly);
    },

    addNpc(npc) {
        if (npc) {
            this.getNpcCollection().push(npc);
        }
    },

    removeNpc(npc) {
        const npcs = this.getNpcCollection();
        const index = npcs.indexOf(npc);
        if (index > -1) {
            npcs.splice(index, 1);
        }
    },

    getNpcs() {
        return this.getNpcCollection();
    },

    getAllActors() {
        const floor = this.getCurrentFloor();
        return [...this.getEnemyCollection(floor), ...this.getNpcCollection(floor)];
    },

    getNpcAt(x, y) {
        if (!this.isWithinBounds(x, y)) {
            return null;
        }

        for (const npc of this.getNpcCollection()) {
            if (npc?.x === x && npc?.y === y && this.isActorAlive(npc)) {
                return npc;
            }
        }

        return null;
    },

    getActorAt(x, y) {
        // Check enemy occupancy first (faster via index)
        const enemy = this.getEnemyAt(x, y);
        if (enemy) {
            return enemy;
        }

        // Check NPCs
        return this.getNpcAt(x, y);
    },

    getEnemyAt(x, y, excludeEnemy = null) {
        const occupancy = this.ensureEnemyOccupancyIndex();
        if (occupancy.size === 0 && this.getEnemyCollection().length > 0) {
            this.rebuildEnemyOccupancyIndex();
        }

        const enemy = occupancy.get(this.getEnemyOccupancyKey(x, y)) || null;
        const isAlive = this.isActorAlive(enemy);
        if (!enemy || enemy === excludeEnemy || !isAlive) {
            if (enemy && !isAlive) {
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

        return !this.getActorAt(x, y);
    },

    canActorOccupy(x, y, player, excludedActor, candidateActor = null, options = {}) {
        if (!this.isWithinBounds(x, y)) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        const minDistanceFromPlayer = Math.max(0, Math.floor(Number(options?.minDistanceFromPlayer) || 0));
        if (player && minDistanceFromPlayer > 0) {
            const distanceFromPlayer = Math.max(
                Math.abs(Number(player.x) - x),
                Math.abs(Number(player.y) - y)
            );
            if (Number.isFinite(distanceFromPlayer) && distanceFromPlayer <= minDistanceFromPlayer) {
                return false;
            }
        }

        if (candidateActor && typeof candidateActor.canTraverseTile === 'function') {
            const tile = this.getTile(x, y);
            if (!candidateActor.canTraverseTile(tile)) {
                return false;
            }
        }

        const enemyAtTile = this.getEnemyAt(x, y, excludedActor);
        if (enemyAtTile) {
            return false;
        }

        const npcAtTile = this.getNpcAt(x, y);
        if (npcAtTile && npcAtTile !== excludedActor) {
            return false;
        }

        return true;
    },

    findRandomOpenActorTile(rng, player = null, attempts = 200, candidateActor = null, options = {}) {
        return this.findRandomTile(rng, attempts, (x, y) => this.canActorOccupy(x, y, player, null, candidateActor, options));
    }
});