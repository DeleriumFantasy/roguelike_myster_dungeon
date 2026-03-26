// Game setup and floor population helpers

Object.assign(Game.prototype, {
    getFloorRandomEventChance() {
        return 0.02;
    },

    getFoodPartyEventTurnLimit() {
        return 50;
    },

    getThrowingChallengeTurnLimit() {
        return 40;
    },

    rollRandomFloorEventType(rng) {
        const eventTypes = ['food-party', 'throwing-challenge'];
        return pickRandom(eventTypes, rng);
    },

    tryActivateRandomFloorEvent(rng, floorIndex) {
        const floor = this.world.getCurrentFloor();
        floor.meta = floor.meta || {};

        if (floor.meta.activeEvent) {
            return;
        }

        if (getRngRoll(rng) >= this.getFloorRandomEventChance()) {
            return;
        }

        const eventType = this.rollRandomFloorEventType(rng);
        if (eventType === 'food-party') {
            this.activateFoodPartyEvent(rng, floorIndex);
            return;
        }

        if (eventType === 'throwing-challenge') {
            this.activateThrowingChallengeEvent();
        }
    },

    activateFoodPartyEvent(rng, floorIndex) {
        const floor = this.world.getCurrentFloor();
        floor.meta = floor.meta || {};

        const spawnedItems = [];
        const eventSpawnCount = 12;
        for (let i = 0; i < eventSpawnCount; i++) {
            const spawn = this.world.findRandomItemSpawnTile(rng, this.player);
            if (!spawn) {
                continue;
            }

            const tier = this.rollItemTierForFloor(floorIndex, rng);
            const foodItem = createTieredItem('food', tier);
            if (!foodItem) {
                continue;
            }

            const placeResult = this.world.addItem(spawn.x, spawn.y, foodItem);
            if (!placeResult?.placed) {
                continue;
            }

            spawnedItems.push({ x: spawn.x, y: spawn.y, item: foodItem });
        }

        floor.meta.activeEvent = {
            type: 'food-party',
            turnsRemaining: this.getFoodPartyEventTurnLimit(),
            spawnedItems
        };

        this.ui.addMessage(`Random event! Food party begins. Grab the food within ${this.getFoodPartyEventTurnLimit()} turns.`);
    },

    activateThrowingChallengeEvent() {
        const floor = this.world.getCurrentFloor();
        floor.meta = floor.meta || {};

        floor.meta.activeEvent = {
            type: 'throwing-challenge',
            requiredKills: 5,
            currentKills: 0,
            turnsRemaining: this.getThrowingChallengeTurnLimit(),
            rewardGranted: false
        };

        this.ui.addMessage(`Random event! Throwing challenge: defeat 5 enemies using thrown items in ${this.getThrowingChallengeTurnLimit()} turns.`);
    },

    cleanupFoodPartyEventItems(activeEvent) {
        if (!activeEvent || !Array.isArray(activeEvent.spawnedItems)) {
            return;
        }

        for (const spawnedItem of activeEvent.spawnedItems) {
            const x = Number(spawnedItem?.x);
            const y = Number(spawnedItem?.y);
            const item = spawnedItem?.item;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !item) {
                continue;
            }

            const itemsOnTile = this.world.getItems(x, y);
            if (!Array.isArray(itemsOnTile) || !itemsOnTile.includes(item)) {
                continue;
            }

            this.world.removeItem(x, y, item);
        }
    },

    advanceActiveFloorEventTurn() {
        const floor = this.world.getCurrentFloor();
        const activeEvent = floor?.meta?.activeEvent;
        if (!activeEvent) {
            return;
        }

        const remainingTurns = Math.max(0, Math.floor(Number(activeEvent.turnsRemaining) - 1));
        activeEvent.turnsRemaining = remainingTurns;
        if (remainingTurns > 0) {
            return;
        }

        if (activeEvent.type === 'food-party') {
            this.cleanupFoodPartyEventItems(activeEvent);
            floor.meta.activeEvent = null;
            this.ui.addMessage('Food party has ended. Remaining event food disappears.');
            return;
        }

        if (activeEvent.type === 'throwing-challenge') {
            floor.meta.activeEvent = null;
            this.ui.addMessage('Throwing challenge failed. Time is up.');
        }
    },

    handleFloorEventEnemyDefeat(enemy, options = {}) {
        const floor = this.world.getCurrentFloor();
        const activeEvent = floor?.meta?.activeEvent;
        if (!activeEvent || activeEvent.type !== 'throwing-challenge') {
            return;
        }

        const { killer = null, defeatSource = '' } = options;
        if (killer !== this.player || defeatSource !== 'player-throw') {
            return;
        }

        if (this.isNeutralNpcEnemy(enemy)) {
            return;
        }

        if (activeEvent.rewardGranted) {
            return;
        }

        activeEvent.currentKills = Math.max(0, Math.floor(Number(activeEvent.currentKills) || 0) + 1);
        this.ui.addMessage(`Throwing challenge progress: ${activeEvent.currentKills}/${activeEvent.requiredKills}.`);

        if (activeEvent.currentKills < activeEvent.requiredKills) {
            return;
        }

        const rewardRng = this.getFloorContentRng(this.world.currentFloor + 900000);
        const rewardItem = this.createThrowingChallengeRewardItem(rewardRng, this.getDungeonDepthIndex(this.world.currentFloor));
        if (rewardItem) {
            this.player.addItem(rewardItem);
            this.ui.addMessage(`Throwing challenge complete! You receive ${getItemLabel(rewardItem)}.`);
        } else {
            this.ui.addMessage('Throwing challenge complete!');
        }

        activeEvent.rewardGranted = true;
        floor.meta.activeEvent = null;
    },

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
            this.tryActivateRandomFloorEvent(rng, dungeonDepthIndex);
        }

        floor.meta = floor.meta || {};
        floor.meta.contentSpawned = true;
    }
});
