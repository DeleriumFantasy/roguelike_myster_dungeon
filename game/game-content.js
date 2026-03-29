// Game setup and floor population helpers

const FLOOR_EVENT_DISPLAY = {
    'food-party': {
        title: () => 'Random Event: Food Party',
        objective: ({ turnsRemaining }) => `Spawned food disappears in ${turnsRemaining} turns.`,
        appendTurnsRemaining: false
    },
    'throwing-challenge': {
        title: () => 'Random Event: Throwing Challenge',
        objective: ({ currentKills, requiredKills }) => `Defeat enemies with thrown items (${currentKills}/${requiredKills}).`
    },
    'catacombs-hoard': {
        title: () => 'Random Event: Burial Hoard',
        objective: () => 'Be careful, the hoard is protected.'
    }
};

function getFloorEventDisplayData(eventType, context = {}) {
    const eventDisplay = FLOOR_EVENT_DISPLAY[eventType] || {};
    const titleValue = eventDisplay.title;
    const objectiveValue = eventDisplay.objective;
    const appendTurnsRemaining = eventDisplay.appendTurnsRemaining !== false;

    const title = typeof titleValue === 'function'
        ? titleValue(context)
        : (typeof titleValue === 'string' ? titleValue : 'Random Event Active');
    const objective = typeof objectiveValue === 'function'
        ? objectiveValue(context)
        : (typeof objectiveValue === 'string' ? objectiveValue : 'Complete the event objective.');

    return { title, objective, appendTurnsRemaining };
}

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

    createFloorEventDisplayData(eventType, context = {}) {
        return getFloorEventDisplayData(eventType, context);
    },

    shouldGuaranteeCatacombsHoardEvent(floorIndex = this.world.currentFloor) {
        return floorIndex === 1 && this.canActivateCatacombsHoardEvent();
    },

    rollRandomFloorEventType(rng) {
        const eventTypes = ['food-party', 'throwing-challenge'];
        if (this.canActivateCatacombsHoardEvent()) {
            eventTypes.push('catacombs-hoard');
        }
        return pickRandom(eventTypes, rng);
    },

    tryActivateRandomFloorEvent(rng, floorIndex) {
        const floor = this.world.getCurrentFloor();
        floor.meta = floor.meta || {};

        if (floor.meta.activeEvent) {
            return;
        }

        if (this.shouldGuaranteeCatacombsHoardEvent(this.world.currentFloor)) {
            this.activateCatacombsHoardEvent(rng, floorIndex);
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
            return;
        }

        if (eventType === 'catacombs-hoard') {
            this.activateCatacombsHoardEvent(rng, floorIndex);
        }
    },

    roomContainsPosition(room, x, y) {
        if (!room) {
            return false;
        }

        return x >= room.x
            && x < room.x + room.width
            && y >= room.y
            && y < room.y + room.height;
    },

    isPositionAdjacentToRoom(room, x, y, distance = 1) {
        if (!room) {
            return false;
        }

        const d = Math.max(0, Math.floor(distance));
        return x >= room.x - d
            && x < room.x + room.width + d
            && y >= room.y - d
            && y < room.y + room.height + d;
    },

    getRoomArea(room) {
        if (!room) {
            return 0;
        }

        return Math.max(0, Number(room.width) || 0) * Math.max(0, Number(room.height) || 0);
    },

    getRoomTiles(room) {
        const tiles = [];
        if (!room) {
            return tiles;
        }

        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                tiles.push({ x, y });
            }
        }

        return tiles;
    },

    shuffleTiles(rng, tiles) {
        const shuffled = [...tiles];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = getRngRandomInt(rng, 0, i);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    },

    getCatacombsHoardBlockedKeys(floor) {
        const blockedKeys = new Set();
        const stairs = floor?.meta?.stairPositions;
        if (stairs?.up) {
            blockedKeys.add(toGridKey(stairs.up.x, stairs.up.y));
        }
        if (stairs?.down) {
            blockedKeys.add(toGridKey(stairs.down.x, stairs.down.y));
        }

        return blockedKeys;
    },

    getEligibleCatacombsHoardRooms(floor = this.world.getCurrentFloor()) {
        const rooms = Array.isArray(floor?.meta?.catacombsRooms) ? floor.meta.catacombsRooms : [];
        const blockedKeys = this.getCatacombsHoardBlockedKeys(floor);

        return rooms.filter((room) => {
            if (this.getRoomArea(room) < 25) {
                return false;
            }

            const roomHasBlockedTile = Array.from(blockedKeys).some((key) => {
                const [x, y] = fromGridKey(key);
                return this.roomContainsPosition(room, x, y);
            });

            return !roomHasBlockedTile;
        });
    },

    canActivateCatacombsHoardEvent() {
        if (this.world.getAreaType() !== AREA_TYPES.CATACOMBS) {
            return false;
        }

        return this.getEligibleCatacombsHoardRooms().length > 0;
    },

    getCatacombsHoardEnemyCount(room) {
        return clamp(Math.floor(this.getRoomArea(room) * 0.3), 5, 10);
    },

    getCatacombsHoardItemCount(room) {
        return clamp(Math.floor(this.getRoomArea(room) * 0.2), 4, 8);
    },

    chooseCatacombsHoardRoom(rng, floor = this.world.getCurrentFloor()) {
        const eligibleRooms = this.getEligibleCatacombsHoardRooms(floor)
            .sort((left, right) => this.getRoomArea(right) - this.getRoomArea(left));
        if (eligibleRooms.length === 0) {
            return null;
        }

        const candidatePool = eligibleRooms.slice(0, Math.min(3, eligibleRooms.length));
        const chosenRoom = pickRandom(candidatePool, rng, candidatePool[0]);
        return chosenRoom ? { ...chosenRoom } : null;
    },

    getCatacombsHoardEnemySpawnTiles(room, rng) {
        const tiles = this.getRoomTiles(room).filter((tile) => this.world.canEnemyOccupy(tile.x, tile.y, this.player));
        return this.shuffleTiles(rng, tiles);
    },

    getCatacombsHoardItemSpawnTiles(room, rng) {
        const tiles = this.getRoomTiles(room).filter((tile) => this.world.canSpawnItemAt(tile.x, tile.y, this.player));
        return this.shuffleTiles(rng, tiles);
    },

    createCatacombsHoardEnemy(enemyTypeKey, floorIndex) {
        const enemy = this.createEnemyForType(0, 0, enemyTypeKey, floorIndex);
        if (!enemy) {
            return null;
        }

        enemy.addCondition(CONDITIONS.SLEEP, Infinity);
        enemy.sleepLockedUntilPlayerEntry = true;
        return enemy;
    },

    activateCatacombsHoardEvent(rng, floorIndex) {
        const floor = this.world.getCurrentFloor();
        floor.meta = floor.meta || {};

        const room = this.chooseCatacombsHoardRoom(rng, floor);
        if (!room) {
            return false;
        }

        const enemyEntries = this.getEnemySpawnEntriesForFloor(floorIndex)
            .filter((entry) => !this.isDungeonNpcTypeKey(entry.key));
        if (enemyEntries.length === 0) {
            return false;
        }

        const enemyTiles = this.getCatacombsHoardEnemySpawnTiles(room, rng);
        const sleepingEnemies = [];
        const spawnedItems = [];
        const enemyCount = Math.min(enemyTiles.length, this.getCatacombsHoardEnemyCount(room));

        for (let i = 0; i < enemyCount; i++) {
            const chosenEntry = this.chooseWeightedEntry(rng, enemyEntries);
            if (!chosenEntry) {
                continue;
            }

            const enemy = this.createCatacombsHoardEnemy(chosenEntry.key, floorIndex);
            if (!enemy) {
                continue;
            }

            const spawnTile = enemyTiles[i];
            this.assignActorPosition(enemy, spawnTile);
            this.addEnemyIfMissing(enemy);
            sleepingEnemies.push(enemy);
        }

        const itemTiles = this.getCatacombsHoardItemSpawnTiles(room, rng);
        const itemCount = Math.min(itemTiles.length, this.getCatacombsHoardItemCount(room));

        for (let i = 0; i < itemCount; i++) {
            const item = this.createRandomItemForFloor(rng, floorIndex);
            if (!item) {
                continue;
            }

            const spawnTile = itemTiles[i];
            const placementResult = this.world.addItem(spawnTile.x, spawnTile.y, item);
            if (!placementResult?.placed) {
                continue;
            }

            spawnedItems.push({ item, x: placementResult.x, y: placementResult.y });
        }

        if (sleepingEnemies.length === 0 && spawnedItems.length === 0) {
            return false;
        }

        floor.meta.activeEvent = {
            type: 'catacombs-hoard',
            room,
            sleepingEnemies,
            spawnedItems,
            awakened: false,
            display: this.createFloorEventDisplayData('catacombs-hoard')
        };

        return true;
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
            spawnedItems,
            display: this.createFloorEventDisplayData('food-party', {
                turnsRemaining: this.getFoodPartyEventTurnLimit()
            })
        };
    },

    activateThrowingChallengeEvent() {
        const floor = this.world.getCurrentFloor();
        floor.meta = floor.meta || {};

        floor.meta.activeEvent = {
            type: 'throwing-challenge',
            requiredKills: 5,
            currentKills: 0,
            turnsRemaining: this.getThrowingChallengeTurnLimit(),
            rewardGranted: false,
            display: this.createFloorEventDisplayData('throwing-challenge', {
                currentKills: 0,
                requiredKills: 5
            })
        };
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
        if (activeEvent.type === 'food-party') {
            activeEvent.display = this.createFloorEventDisplayData('food-party', {
                turnsRemaining: remainingTurns
            });
        }

        if (remainingTurns > 0) {
            return;
        }

        if (activeEvent.type === 'food-party') {
            this.cleanupFoodPartyEventItems(activeEvent);
            floor.meta.activeEvent = null;
            return;
        }

        if (activeEvent.type === 'throwing-challenge') {
            floor.meta.activeEvent = null;
        }
    },

    tryWakeCatacombsHoardEvent() {
        const floor = this.world.getCurrentFloor();
        const activeEvent = floor?.meta?.activeEvent;
        if (!activeEvent || activeEvent.type !== 'catacombs-hoard' || activeEvent.awakened) {
            return;
        }

        if (!this.isPositionAdjacentToRoom(activeEvent.room, this.player.x, this.player.y, 1)) {
            return;
        }

        const sleepingEnemies = Array.isArray(activeEvent.sleepingEnemies) ? activeEvent.sleepingEnemies : [];
        for (const enemy of sleepingEnemies) {
            if (!enemy?.isAlive?.()) {
                continue;
            }

            enemy.sleepLockedUntilPlayerEntry = false;
            enemy.removeCondition?.(CONDITIONS.SLEEP);
        }

        activeEvent.awakened = true;
        floor.meta.activeEvent = null;
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
        activeEvent.display = this.createFloorEventDisplayData('throwing-challenge', {
            currentKills: activeEvent.currentKills,
            requiredKills: activeEvent.requiredKills
        });

        if (activeEvent.currentKills < activeEvent.requiredKills) {
            return;
        }

        const rewardRng = this.getFloorContentRng(this.world.currentFloor + 900000);
        const rewardItem = this.createThrowingChallengeRewardItem(rewardRng, this.getDungeonDepthIndex(this.world.currentFloor));
        if (rewardItem) {
            this.player.addItem(rewardItem);
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
