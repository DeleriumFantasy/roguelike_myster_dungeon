// Game setup and floor population helpers

Object.assign(Game.prototype, {
    initializeGame() {
        this.populateCurrentFloorIfNeeded();
        this.spawnPlayerOnFloor();
        this.seedPlayerInventory();
        this.spawnStartingAlly();

        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
    },

    getDungeonDepthIndex(floorIndex = this.world.currentFloor) {
        return Math.max(0, Number(floorIndex) - 1);
    },

    isOverworldFloor(floorIndex = this.world.currentFloor) {
        return this.world.getAreaType(floorIndex) === AREA_TYPES.OVERWORLD;
    },

    getDisplayFloorLabel(floorIndex = this.world.currentFloor) {
        return this.isOverworldFloor(floorIndex) ? 'Overworld' : String(Math.max(1, floorIndex));
    },

    assignActorPosition(actor, position) {
        actor.x = position.x;
        actor.y = position.y;
    },

    addEnemyIfMissing(enemy) {
        if (!this.world.getEnemies().includes(enemy)) {
            this.world.addEnemy(enemy);
        }
    },

    spawnPlayerOnFloor() {
        if (this.isOverworldFloor()) {
            const centerX = Math.floor(GRID_SIZE / 2);
            const centerY = Math.floor(GRID_SIZE / 2);
            const centerSpawn = this.findNearestPlayerSpawnFrom(centerX, centerY);
            if (centerSpawn) {
                this.player.x = centerSpawn.x;
                this.player.y = centerSpawn.y;
                return;
            }
        }

        const rng = new SeededRNG(this.seed + 999999);

        const spawn = this.world.findRandomFloorTile(rng, 600);
        if (spawn) {
            this.player.x = spawn.x;
            this.player.y = spawn.y;
        }
    },

    findNearestPlayerSpawnFrom(originX, originY) {
        for (let radius = 0; radius <= GRID_SIZE; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
                        continue;
                    }

                    const x = originX + dx;
                    const y = originY + dy;
                    if (!this.world.isWithinBounds(x, y)) {
                        continue;
                    }

                    if (this.world.canPlayerOccupy(x, y)) {
                        return { x, y };
                    }
                }
            }
        }

        return null;
    },

    spawnStartingAlly() {
        const slime = this.createEnemyForType(0, 0, 'slimeTier1', 0);
        const rng = new SeededRNG(this.seed + 888888);
        const spawn = this.world.findRandomOpenTile(rng, this.player, 200, slime);
        if (spawn) {
            this.assignActorPosition(slime, spawn);
        } else {
            slime.x = this.player.x;
            slime.y = this.player.y;
        }
        slime.tame(this.player);
        this.addEnemyIfMissing(slime);
    },

    spawnAlliesOnCurrentFloor() {
        const rng = new SeededRNG(this.seed + this.world.currentFloor * 31337);
        for (const ally of this.player.allies) {
            if (!ally.isAlive()) continue;

            const spawn = this.findSpawnNearPlayer(ally, rng);
            this.assignActorPosition(ally, spawn);
            this.addEnemyIfMissing(ally);
        }
    },

    findSpawnNearPlayer(enemy, rng) {
        for (let radius = 1; radius <= 5; radius++) {
            const candidates = [];
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    const x = this.player.x + dx;
                    const y = this.player.y + dy;
                    if (this.world.canEnemyOccupy(x, y, this.player, null, enemy)) {
                        candidates.push({ x, y });
                    }
                }
            }
            if (candidates.length > 0) {
                return pickRandom(candidates, rng);
            }
        }
        const fallback = this.world.findRandomOpenTile(rng, this.player, 200, enemy);
        return fallback || { x: this.player.x, y: this.player.y };
    },

    populateCurrentFloorIfNeeded() {
        const floor = this.world.getCurrentFloor();
        if (floor.meta?.contentSpawned) {
            return;
        }

        const floorIndex = this.world.currentFloor;
        const itemFloorIndex = this.isOverworldFloor(floorIndex)
            ? 0
            : this.getDungeonDepthIndex(floorIndex);
        const enemyFloorIndex = itemFloorIndex;
        const rng = this.getFloorContentRng(floorIndex);
        this.spawnPremadeLegendEnemies(rng, enemyFloorIndex);
        if (this.isOverworldFloor(floorIndex)) {
            this.spawnOverworldNpcs(rng);
        } else {
            const dungeonDepthIndex = this.getDungeonDepthIndex(floorIndex);
            this.spawnEnemiesForCurrentFloor(rng, dungeonDepthIndex);
            this.spawnItemsForCurrentFloor(rng, dungeonDepthIndex);
            this.spawnPremadeItemsForCurrentFloor(rng, itemFloorIndex);
        }

        floor.meta = floor.meta || {};
        floor.meta.contentSpawned = true;
    }
});
