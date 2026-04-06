// Game setup and floor population helpers

const FLOOR_EVENT_DISPLAY = {
    'food-party': {
        title: () => 'Random Event: Food Party',
        objective: ({ turnsRemaining }) => `Spawned food disappears in ${turnsRemaining} turns.`,
        appendTurnsRemaining: false
    },
    'throwing-challenge': {
        title: () => 'Random Event: Throwing Challenge',
        objective: ({ currentKills, requiredKills }) => `Defeat enemies with thrown items (${currentKills}/${requiredKills}).`,
        appendTurnsRemaining: false
    },
    hoard: {
        title: () => 'Random Event: Guarded Hoard',
        objective: () => 'Be careful, the hoard is protected.'
    },
    'save-lost-explorer': {
        title: () => 'Quest: Save Lost Explorer',
        objective: () => 'Find the lost explorer in the guarded room.',
        appendTurnsRemaining: false
    },
    'retrieve-item': {
        title: () => 'Quest: Retrieve Item',
        objective: ({ itemName }) => `Recover ${itemName || 'the quest item'} and return it to the Questgiver.`,
        appendTurnsRemaining: false
    },
    'material-delivery': {
        title: () => 'Quest: Material Delivery',
        objective: ({ engineerName, materialCount, materialName }) => `Bring ${materialCount || 1} ${materialName || 'delivery material'}${(materialCount || 1) === 1 ? '' : 's'} to ${engineerName || 'the engineer'}.`,
        appendTurnsRemaining: false
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

    createFloorEventDisplayData(eventType, context = {}) {
        return getFloorEventDisplayData(eventType, context);
    },

    ensureFloorMeta(floor = this.world.getCurrentFloor()) {
        const targetFloor = floor || this.world.getCurrentFloor();
        if (!targetFloor) {
            return null;
        }

        targetFloor.meta = targetFloor.meta || {};
        return targetFloor;
    },

    canStartFloorEvent(floor = this.ensureFloorMeta()) {
        return Boolean(floor && !floor.meta?.activeEvent);
    },

    setActiveFloorEvent(eventType, eventData = {}, displayContext = {}, floor = this.ensureFloorMeta()) {
        if (!floor) {
            return false;
        }

        floor.meta.activeEvent = {
            type: eventType,
            ...eventData,
            display: this.createFloorEventDisplayData(eventType, displayContext)
        };
        return true;
    },

    shouldGuaranteeHoardEvent(floorIndex = this.world.currentFloor) {
        return floorIndex === 1 && this.canActivateHoardEvent();
    },

    rollRandomFloorEventType(rng) {
        const eventTypes = ['food-party', 'throwing-challenge'];
        if (this.canActivateHoardEvent()) {
            eventTypes.push('hoard');
        }
        return pickRandom(eventTypes, rng);
    },

    activateRandomFloorEventByType(eventType, rng, floorIndex) {
        const activators = {
            'food-party': () => this.activateFoodPartyEvent(rng, floorIndex),
            'throwing-challenge': () => this.activateThrowingChallengeEvent(),
            hoard: () => this.activateHoardEvent(rng, floorIndex)
        };

        return activators[eventType]?.() || false;
    },

    tryActivateRandomFloorEvent(rng, floorIndex) {
        const floor = this.ensureFloorMeta();
        if (!this.canStartFloorEvent(floor)) {
            return false;
        }

        if (this.shouldGuaranteeHoardEvent(this.world.currentFloor)) {
            return this.activateHoardEvent(rng, floorIndex);
        }

        if (getRngRoll(rng) >= this.getFloorRandomEventChance()) {
            return false;
        }

        const eventType = this.rollRandomFloorEventType(rng);
        return this.activateRandomFloorEventByType(eventType, rng, floorIndex);
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

    addBlockedAreaKeys(blockedKeys, area, paddingOverride = null) {
        if (!(blockedKeys instanceof Set) || !area) {
            return;
        }

        const padding = paddingOverride === null
            ? Math.max(0, Math.floor(Number(area.padding) || 0))
            : Math.max(0, Math.floor(Number(paddingOverride) || 0));
        const width = Math.max(1, Math.floor(Number(area.width) || 1));
        const height = Math.max(1, Math.floor(Number(area.height) || 1));
        const startX = Math.floor(Number(area.x) || 0) - padding;
        const startY = Math.floor(Number(area.y) || 0) - padding;
        const endX = startX + width + padding * 2 - 1;
        const endY = startY + height + padding * 2 - 1;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (!this.world.isWithinInteriorBounds(x, y)) {
                    continue;
                }
                blockedKeys.add(toGridKey(x, y));
            }
        }
    },

    getHoardEventBlockedKeys(floor, options = {}) {
        const blockedKeys = new Set();
        const includeSpecialAreas = options.ignoreSpecialAreas !== true;
        const includeQuestRooms = options.ignoreQuestRooms !== true;
        const stairs = floor?.meta?.stairPositions;
        if (stairs?.up) {
            blockedKeys.add(toGridKey(stairs.up.x, stairs.up.y));
        }
        if (stairs?.down) {
            blockedKeys.add(toGridKey(stairs.down.x, stairs.down.y));
        }

        if (includeSpecialAreas) {
            const specialAreas = Array.isArray(floor?.meta?.specialAreas) ? floor.meta.specialAreas : [];
            for (const area of specialAreas) {
                this.addBlockedAreaKeys(blockedKeys, area);
            }
        }

        if (includeQuestRooms) {
            const questRooms = Array.isArray(floor?.meta?.questRooms) ? floor.meta.questRooms : [];
            for (const room of questRooms) {
                this.addBlockedAreaKeys(blockedKeys, room, 1);
            }
        }

        return blockedKeys;
    },

    getEligibleHoardEventRooms(floor = this.world.getCurrentFloor()) {
        const rooms = Array.isArray(floor?.meta?.encounterRooms) ? floor.meta.encounterRooms : [];
        const blockedKeys = this.getHoardEventBlockedKeys(floor);

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

    canActivateHoardEvent() {
        const floor = this.world.getCurrentFloor();
        return Boolean(floor?.grid);
    },

    getGuardedEncounterEnemyCount(room) {
        return clamp(Math.floor(this.getRoomArea(room) * 0.3), 5, 10);
    },

    getHoardEventItemCount(room) {
        return clamp(Math.floor(this.getRoomArea(room) * 0.2), 4, 8);
    },

    chooseHoardEventRoom(rng, floor = this.world.getCurrentFloor()) {
        const eligibleRooms = this.getEligibleHoardEventRooms(floor)
            .sort((left, right) => this.getRoomArea(right) - this.getRoomArea(left));
        if (eligibleRooms.length === 0) {
            return null;
        }

        const candidatePool = eligibleRooms.slice(0, Math.min(3, eligibleRooms.length));
        const chosenRoom = pickRandom(candidatePool, rng, candidatePool[0]);
        return chosenRoom ? { ...chosenRoom } : null;
    },

    getShuffledRoomTilesByPredicate(room, rng, predicate = () => true) {
        return this.shuffleTiles(
            rng,
            this.getRoomTiles(room).filter((tile) => predicate(tile))
        );
    },

    getGuardedEncounterEnemySpawnTiles(room, rng, reservedKeys = new Set()) {
        return this.getShuffledRoomTilesByPredicate(
            room,
            rng,
            (tile) => !reservedKeys.has(toGridKey(tile.x, tile.y))
                && this.world.canEnemyOccupy(tile.x, tile.y, this.player)
        );
    },

    getGuardedEncounterItemSpawnTiles(room, rng) {
        return this.getShuffledRoomTilesByPredicate(
            room,
            rng,
            (tile) => this.world.canSpawnItemAt(tile.x, tile.y, this.player)
        );
    },

    getRoomCenterPosition(room) {
        if (!room) {
            return { x: this.player.x, y: this.player.y };
        }

        return {
            x: Math.floor(room.x + room.width / 2),
            y: Math.floor(room.y + room.height / 2)
        };
    },

    getQuestEncounterBlockedKeys(floor = this.world.getCurrentFloor(), options = {}) {
        const blockedKeys = this.getHoardEventBlockedKeys(floor, options);
        const grid = floor?.grid;

        if (options.ignoreShopTiles !== true && Array.isArray(grid)) {
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[y].length; x++) {
                    if (grid[y][x] === TILE_TYPES.SHOP) {
                        blockedKeys.add(toGridKey(x, y));
                    }
                }
            }
        }

        return blockedKeys;
    },

    getRelaxedQuestEncounterPlacementOptions() {
        return {
            ignoreSpecialAreas: true,
            ignoreQuestRooms: true,
            ignoreShopTiles: true
        };
    },

    findNearestOpenTileOutsideRoom(room, floor = this.world.getCurrentFloor()) {
        const grid = floor?.grid;
        if (!room || !Array.isArray(grid)) {
            return null;
        }

        const center = this.getRoomCenterPosition(room);
        for (let radius = 1; radius <= GRID_SIZE; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
                        continue;
                    }

                    const x = center.x + dx;
                    const y = center.y + dy;
                    if (!this.world.isWithinInteriorBounds(x, y) || this.roomContainsPosition(room, x, y)) {
                        continue;
                    }

                    const tile = grid[y][x];
                    if (tile === TILE_TYPES.FLOOR || tile === TILE_TYPES.STAIRS_UP || tile === TILE_TYPES.STAIRS_DOWN || tile === TILE_TYPES.SHOP) {
                        return { x, y };
                    }
                }
            }
        }

        return null;
    },

    sanitizeEncounterRoomTiles(tileKeys, floor = this.world.getCurrentFloor()) {
        if (!(tileKeys instanceof Set) || !floor) {
            return;
        }

        for (const key of tileKeys) {
            const [x, y] = fromGridKey(key);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue;
            }

            this.world.setTile(x, y, TILE_TYPES.FLOOR);
            this.world.removeHazard?.(x, y);
            this.world.removeTrap?.(x, y);
            if (floor.items instanceof Map) {
                floor.items.delete(key);
            }
        }
    },

    relocateActorsOutOfRoom(room, rng, floor = this.world.getCurrentFloor()) {
        const floorEnemies = Array.isArray(floor?.enemies) ? floor.enemies : [];
        for (const enemy of floorEnemies) {
            if (!enemy?.isAlive?.() || enemy.isAlly || enemy.isShopkeeper || enemy.isLostExplorerNpc) {
                continue;
            }

            if (!this.isPositionAdjacentToRoom(room, enemy.x, enemy.y, 1)) {
                continue;
            }

            let spawn = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidate = this.world.findRandomOpenTile(rng, this.player, 200, enemy);
                if (candidate && !this.roomContainsPosition(room, candidate.x, candidate.y)) {
                    spawn = candidate;
                    break;
                }
            }

            if (spawn) {
                this.assignActorPosition(enemy, spawn);
            }
        }
    },

    prepareEncounterRoom(room, rng, floor = this.world.getCurrentFloor()) {
        if (!room) {
            return;
        }

        const roomKeys = new Set(this.getRoomTiles(room).map((tile) => toGridKey(tile.x, tile.y)));
        this.sanitizeEncounterRoomTiles(roomKeys, floor);
        this.relocateActorsOutOfRoom(room, rng, floor);
    },

    buildQuestEncounterBoundaryWalls(room, floor = this.world.getCurrentFloor()) {
        const grid = floor?.grid;
        if (!room || !Array.isArray(grid)) {
            return;
        }

        for (let y = room.y - 1; y <= room.y + room.height; y++) {
            for (let x = room.x - 1; x <= room.x + room.width; x++) {
                if (!this.world.isWithinInteriorBounds(x, y) || this.roomContainsPosition(room, x, y)) {
                    continue;
                }

                const key = toGridKey(x, y);
                this.world.setTile(x, y, TILE_TYPES.WALL);
                this.world.removeHazard?.(x, y);
                this.world.removeTrap?.(x, y);
                if (floor.items instanceof Map) {
                    floor.items.delete(key);
                }
            }
        }
    },

    findQuestEncounterRoomCandidate(rng, blockedKeys = new Set(), attempts = 80) {
        for (let attempt = 0; attempt < attempts; attempt++) {
            const width = getRngRandomInt(rng, 6, 9);
            const height = getRngRandomInt(rng, 6, 9);
            const x = getRngRandomInt(rng, 2, GRID_SIZE - width - 3);
            const y = getRngRandomInt(rng, 2, GRID_SIZE - height - 3);
            const candidate = { x, y, width, height };

            const touchesBlockedTile = Array.from(blockedKeys).some((key) => {
                const [blockedX, blockedY] = fromGridKey(key);
                return Number.isFinite(blockedX)
                    && Number.isFinite(blockedY)
                    && this.isPositionAdjacentToRoom(candidate, blockedX, blockedY, 1);
            });

            if (touchesBlockedTile) {
                continue;
            }

            return candidate;
        }

        return null;
    },

    registerQuestEncounterRoom(floor, room) {
        if (!floor?.meta || !room) {
            return;
        }

        if (!Array.isArray(floor.meta.questRooms)) {
            floor.meta.questRooms = [];
        }
        floor.meta.questRooms.push({ ...room });

        if (!Array.isArray(floor.meta.specialAreas)) {
            floor.meta.specialAreas = [];
        }

        const specialArea = typeof this.world?.createSpecialAreaDescriptor === 'function'
            ? this.world.createSpecialAreaDescriptor('guarded-room', room.x, room.y, room.width, room.height, { padding: 1 })
            : {
                type: 'guarded-room',
                x: room.x,
                y: room.y,
                width: room.width,
                height: room.height,
                padding: 1
            };
        floor.meta.specialAreas.push(specialArea);
    },

    createQuestEncounterRoom(rng, floor = this.world.getCurrentFloor(), options = {}) {
        const targetFloor = this.ensureFloorMeta(floor);
        const grid = targetFloor?.grid;
        if (!Array.isArray(grid)) {
            return null;
        }

        const roomTileKeys = new Set();
        const hallwayTileKeys = new Set();
        let room = this.findQuestEncounterRoomCandidate(
            rng,
            this.getQuestEncounterBlockedKeys(targetFloor),
            80
        );

        if (!room && options.forcePlacement) {
            room = this.findQuestEncounterRoomCandidate(
                rng,
                this.getQuestEncounterBlockedKeys(targetFloor, this.getRelaxedQuestEncounterPlacementOptions()),
                160
            );
        }

        if (!room) {
            room = {
                x: clamp(Math.floor(GRID_SIZE / 2) - 3, 1, GRID_SIZE - 8),
                y: clamp(Math.floor(GRID_SIZE / 2) - 3, 1, GRID_SIZE - 8),
                width: 6,
                height: 6
            };
        }

        this.buildQuestEncounterBoundaryWalls(room, targetFloor);
        this.world.carveRoom(grid, room, roomTileKeys);

        const connectionTarget = this.findNearestOpenTileOutsideRoom(room, targetFloor);
        if (connectionTarget) {
            this.world.carveHallwayBetweenPoints(
                grid,
                this.getRoomCenterPosition(room),
                connectionTarget,
                rng,
                roomTileKeys,
                hallwayTileKeys
            );
        }

        this.sanitizeEncounterRoomTiles(roomTileKeys, targetFloor);
        this.sanitizeEncounterRoomTiles(hallwayTileKeys, targetFloor);
        this.prepareEncounterRoom(room, rng, targetFloor);

        this.registerQuestEncounterRoom(targetFloor, room);

        return room;
    },

    createNeutralGuardNpc(name, extraProperties = {}, enemyTypeKey = 'npcTier1') {
        const npc = this.createEnemyForType(0, 0, enemyTypeKey, 0);
        if (!npc) {
            return null;
        }

        npc.name = String(name || 'NPC');
        npc.aiType = AI_TYPES.GUARD;
        npc.baseAiType = AI_TYPES.GUARD;
        Object.assign(npc, extraProperties || {});
        npc.isNeutralNpc = () => true;
        return npc;
    },

    createLostExplorerNpc(quest) {
        return this.createNeutralGuardNpc('Lost explorer', {
            monsterType: 'npcLostExplorerTier1',
            isLostExplorerNpc: true,
            lostExplorerQuestId: quest?.id ?? null
        });
    },

    createMaterialDeliveryEngineerNpc(quest) {
        const engineerName = typeof quest?.engineerName === 'string' && quest.engineerName.trim().length > 0
            ? quest.engineerName.trim()
            : 'Engineer';
        return this.createNeutralGuardNpc(engineerName, {
            monsterType: 'npcEngineerTier1',
            isMaterialDeliveryEngineerNpc: true,
            materialDeliveryQuestId: quest?.id ?? null
        });
    },

    getActiveQuestForFloor(questType, floorIndex = this.world.currentFloor) {
        const activeQuest = this.ensureQuestgiverState?.().activeQuest;
        if (!activeQuest || activeQuest.type !== questType || activeQuest.completed) {
            return null;
        }

        const normalizedFloor = Math.max(0, Math.floor(Number(floorIndex) || 0));
        if (normalizedFloor <= 0) {
            return null;
        }

        const currentPathId = this.world?.getSelectedDungeonPathId?.() || getDefaultDungeonPathId();
        const targetPathId = activeQuest.targetPathId || getDefaultDungeonPathId();
        const targetFloor = Math.max(1, Math.floor(Number(activeQuest.targetFloor) || 1));

        if (currentPathId !== targetPathId || normalizedFloor !== targetFloor) {
            return null;
        }

        return activeQuest;
    },

    createRetrieveItemQuestItem(quest) {
        const itemName = typeof quest?.itemName === 'string' && quest.itemName.trim().length > 0
            ? quest.itemName.trim()
            : 'Recovered relic';
        const item = new Item(itemName, ITEM_TYPES.CONSUMABLE, {
            requiresIdentification: false,
            hiddenName: itemName,
            questItem: true,
            questReturnOnly: true,
            questType: 'retrieve-item',
            questId: quest?.id ?? null,
            burnable: false,
            useBlockMessage: `${itemName} must be returned to the Questgiver.`
        });
        item.identify?.();
        return item;
    },

    getQuestFloorEventContext(questType, floorIndex = this.world.currentFloor, options = {}) {
        const floor = this.ensureFloorMeta();
        if (!this.canStartFloorEvent(floor)) {
            return null;
        }

        const activeQuest = this.getActiveQuestForFloor(questType, floorIndex);
        if (!activeQuest || (options.requireIncomplete !== false && activeQuest.completed)) {
            return null;
        }

        return { floor, activeQuest };
    },

    findQuestNpcSpawn(rng, npc, floor = this.ensureFloorMeta(), options = {}) {
        if (!npc || !floor) {
            return null;
        }

        const strictAttempts = Math.max(1, Math.floor(Number(options.strictAttempts) || 60));
        const relaxedAttempts = Math.max(0, Math.floor(Number(options.relaxedAttempts) || 120));
        const fallbackAttempts = Math.max(0, Math.floor(Number(options.fallbackAttempts) || 1));
        const tryFindSpawn = (blockedKeys = null, attempts = 60) => {
            for (let attempt = 0; attempt < attempts; attempt++) {
                const candidate = this.world.findRandomOpenTile(rng, this.player, 250, npc);
                if (!candidate) {
                    continue;
                }

                if (blockedKeys instanceof Set && blockedKeys.has(toGridKey(candidate.x, candidate.y))) {
                    continue;
                }

                return candidate;
            }

            return null;
        };

        let spawn = tryFindSpawn(this.getQuestEncounterBlockedKeys(floor), strictAttempts);
        if (!spawn && relaxedAttempts > 0) {
            spawn = tryFindSpawn(
                this.getQuestEncounterBlockedKeys(floor, this.getRelaxedQuestEncounterPlacementOptions()),
                relaxedAttempts
            );
        }

        if (!spawn && fallbackAttempts > 0) {
            spawn = tryFindSpawn(null, fallbackAttempts);
        }

        return spawn;
    },

    activateQuestNpcEvent(questType, rng, floorIndex = this.world.currentFloor, options = {}) {
        const questContext = this.getQuestFloorEventContext(questType, floorIndex, options);
        if (!questContext) {
            return false;
        }

        const npc = typeof options.createNpc === 'function'
            ? options.createNpc(questContext.activeQuest)
            : null;
        if (!npc) {
            return false;
        }

        const spawn = this.findQuestNpcSpawn(rng, npc, questContext.floor, options.spawnOptions);
        if (!spawn) {
            return false;
        }

        this.assignActorPosition(npc, spawn);
        this.addEnemyIfMissing(npc);

        const eventActorKey = typeof options.eventActorKey === 'string' && options.eventActorKey.length > 0
            ? options.eventActorKey
            : 'npc';
        const displayContext = typeof options.getDisplayContext === 'function'
            ? options.getDisplayContext(questContext.activeQuest, npc, spawn)
            : (options.displayContext || {});

        return this.setActiveFloorEvent(
            options.eventType || questType,
            {
                [eventActorKey]: npc,
                questId: questContext.activeQuest.id,
                ...(options.eventData || {})
            },
            displayContext,
            questContext.floor
        );
    },

    getGuardedEncounterRoom(rng, floor = this.world.getCurrentFloor(), options = {}) {
        const room = this.chooseHoardEventRoom(rng, floor)
            || this.createQuestEncounterRoom(rng, floor, options);
        if (!room) {
            return null;
        }

        this.prepareEncounterRoom(room, rng, floor);
        return room;
    },

    getGuardedEncounterEnemyContext(floorIndex = this.world.currentFloor) {
        const enemyFloorIndex = this.getDungeonDepthIndex(floorIndex);
        const enemyEntries = this.getEnemySpawnEntriesForFloor(enemyFloorIndex)
            .filter((entry) => !this.isDungeonNpcTypeKey(entry.key));

        return { enemyFloorIndex, enemyEntries };
    },

    spawnSleepingEnemiesForGuardedRoom(room, rng, floorIndex, options = {}) {
        const enemyContext = options.enemyContext || this.getGuardedEncounterEnemyContext(floorIndex);
        const reservedKeys = options.reservedKeys instanceof Set
            ? new Set(options.reservedKeys)
            : new Set();
        const shuffledEnemyTiles = this.getGuardedEncounterEnemySpawnTiles(room, rng, reservedKeys);
        const requestedCount = Number.isFinite(options.enemyCount)
            ? Math.max(0, Math.floor(options.enemyCount))
            : this.getGuardedEncounterEnemyCount(room);
        const enemyCount = Math.min(shuffledEnemyTiles.length, requestedCount);
        const sleepingEnemies = [];

        for (let i = 0; i < enemyCount; i++) {
            const chosenEntry = this.chooseWeightedEntry(rng, enemyContext.enemyEntries);
            if (!chosenEntry) {
                continue;
            }

            const enemy = this.createHoardEventEnemy(chosenEntry.key, enemyContext.enemyFloorIndex);
            if (!enemy) {
                continue;
            }

            const spawnTile = shuffledEnemyTiles[i];
            this.assignActorPosition(enemy, spawnTile);
            this.addEnemyIfMissing(enemy);
            sleepingEnemies.push(enemy);
        }

        return sleepingEnemies;
    },

    prepareGuardedEncounterEvent(rng, floorIndex, floor = this.ensureFloorMeta(), options = {}) {
        if (!this.canStartFloorEvent(floor)) {
            return null;
        }

        const enemyContext = this.getGuardedEncounterEnemyContext(floorIndex);
        if (enemyContext.enemyEntries.length === 0) {
            return null;
        }

        const room = this.getGuardedEncounterRoom(rng, floor, options);
        if (!room) {
            return null;
        }

        return { floor, room, enemyContext };
    },

    activateGuardedQuestEvent(questType, rng, floorIndex, options = {}) {
        const questContext = this.getQuestFloorEventContext(questType, floorIndex, options);
        if (!questContext) {
            return false;
        }

        const setup = this.prepareGuardedEncounterEvent(rng, floorIndex, questContext.floor, {
            forcePlacement: options.forcePlacement !== false
        });
        if (!setup) {
            return false;
        }

        const prepared = typeof options.prepareEncounter === 'function'
            ? options.prepareEncounter({ ...setup, activeQuest: questContext.activeQuest })
            : {};
        if (!prepared) {
            return false;
        }

        const sleepingEnemies = this.spawnSleepingEnemiesForGuardedRoom(setup.room, rng, floorIndex, {
            enemyContext: setup.enemyContext,
            reservedKeys: prepared.reservedKeys,
            enemyCount: prepared.enemyCount
        });

        return this.setActiveFloorEvent(
            options.eventType || questType,
            {
                room: setup.room,
                sleepingEnemies,
                questId: questContext.activeQuest.id,
                awakened: false,
                ...(prepared.eventData || {})
            },
            prepared.displayContext || {},
            questContext.floor
        );
    },

    tryActivateSaveLostExplorerEvent(rng, floorIndex = this.world.currentFloor) {
        return this.activateGuardedQuestEvent('save-lost-explorer', rng, floorIndex, {
            prepareEncounter: ({ activeQuest, room }) => {
                const explorer = this.createLostExplorerNpc(activeQuest);
                if (!explorer) {
                    return null;
                }

                const roomTiles = this.getShuffledRoomTilesByPredicate(
                    room,
                    rng,
                    (tile) => this.world.canEnemyOccupy(tile.x, tile.y, this.player, null, explorer)
                );
                const explorerTile = roomTiles[0];
                if (!explorerTile) {
                    return null;
                }

                this.assignActorPosition(explorer, explorerTile);
                this.addEnemyIfMissing(explorer);

                return {
                    eventData: { explorer },
                    reservedKeys: new Set([toGridKey(explorerTile.x, explorerTile.y)]),
                    enemyCount: clamp(Math.floor(this.getRoomArea(room) * 0.25), 4, 8)
                };
            }
        });
    },

    tryActivateRetrieveItemQuestEvent(rng, floorIndex = this.world.currentFloor) {
        return this.activateGuardedQuestEvent('retrieve-item', rng, floorIndex, {
            prepareEncounter: ({ activeQuest, room }) => {
                const questItem = this.createRetrieveItemQuestItem(activeQuest);
                const itemTiles = this.getGuardedEncounterItemSpawnTiles(room, rng);
                if (!questItem || itemTiles.length === 0) {
                    return null;
                }

                const itemTile = itemTiles[0];
                const placementResult = this.world.addItem(itemTile.x, itemTile.y, questItem);
                if (!placementResult?.placed) {
                    return null;
                }

                return {
                    eventData: { questItem },
                    reservedKeys: new Set([toGridKey(placementResult.x, placementResult.y)]),
                    enemyCount: clamp(Math.floor(this.getRoomArea(room) * 0.2), 4, 7),
                    displayContext: { itemName: activeQuest.itemName }
                };
            }
        });
    },

    tryActivateMaterialDeliveryQuestEvent(rng, floorIndex = this.world.currentFloor) {
        return this.activateQuestNpcEvent('material-delivery', rng, floorIndex, {
            createNpc: (activeQuest) => this.createMaterialDeliveryEngineerNpc(activeQuest),
            eventActorKey: 'engineer',
            getDisplayContext: (activeQuest) => ({
                engineerName: activeQuest.engineerName,
                materialCount: activeQuest.materialCount,
                materialName: activeQuest.materialName
            })
        });
    },

    createHoardEventEnemy(enemyTypeKey, floorIndex) {
        const enemy = this.createEnemyForType(0, 0, enemyTypeKey, floorIndex);
        if (!enemy) {
            return null;
        }

        enemy.addCondition(CONDITIONS.SLEEP, Infinity);
        enemy.sleepLockedUntilPlayerEntry = true;
        return enemy;
    },

    activateHoardEvent(rng, floorIndex) {
        const setup = this.prepareGuardedEncounterEvent(rng, floorIndex);
        if (!setup) {
            return false;
        }

        const sleepingEnemies = this.spawnSleepingEnemiesForGuardedRoom(setup.room, rng, floorIndex, {
            enemyContext: setup.enemyContext,
            enemyCount: this.getGuardedEncounterEnemyCount(setup.room)
        });

        const itemTiles = this.getGuardedEncounterItemSpawnTiles(setup.room, rng);
        const itemCount = Math.min(itemTiles.length, this.getHoardEventItemCount(setup.room));
        const spawnedItems = [];

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

        return this.setActiveFloorEvent(
            'hoard',
            {
                room: setup.room,
                sleepingEnemies,
                spawnedItems,
                awakened: false
            },
            {},
            setup.floor
        );
    },

    getQuestEventInfoForFloor(floorIndex = this.world.currentFloor) {
        const questEventTypes = ['save-lost-explorer', 'retrieve-item', 'material-delivery'];
        for (const questType of questEventTypes) {
            const activeQuest = this.getActiveQuestForFloor(questType, floorIndex);
            if (activeQuest) {
                return { questType, activeQuest };
            }
        }

        return null;
    },

    ensureQuestEventForFloor(rng, floorIndex = this.world.currentFloor, options = {}) {
        const floor = this.ensureFloorMeta();
        const questInfo = this.getQuestEventInfoForFloor(floorIndex);
        if (!floor || !questInfo) {
            return false;
        }

        const activeEvent = floor.meta?.activeEvent || null;
        const activeEventQuestId = Math.floor(Number(activeEvent?.questId));
        const targetQuestId = Math.floor(Number(questInfo.activeQuest?.id));
        if (activeEvent?.type === questInfo.questType && activeEventQuestId === targetQuestId) {
            return true;
        }

        if (options.overrideExistingEvent && activeEvent) {
            if (activeEvent.type === 'food-party') {
                this.cleanupFoodPartyEventItems(activeEvent);
            }
            floor.meta.activeEvent = null;
        }

        return this.tryActivateQuestFloorEvent(rng, floorIndex);
    },

    tryActivateQuestFloorEvent(rng, floorIndex = this.world.currentFloor) {
        const questActivators = [
            () => this.tryActivateSaveLostExplorerEvent(rng, floorIndex),
            () => this.tryActivateRetrieveItemQuestEvent(rng, floorIndex),
            () => this.tryActivateMaterialDeliveryQuestEvent(rng, floorIndex)
        ];

        return questActivators.some((activate) => activate());
    },

    activateFoodPartyEvent(rng, floorIndex) {
        const floor = this.ensureFloorMeta();
        if (!floor) {
            return false;
        }

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

        return this.setActiveFloorEvent(
            'food-party',
            {
                turnsRemaining: this.getFoodPartyEventTurnLimit(),
                spawnedItems
            },
            {
                turnsRemaining: this.getFoodPartyEventTurnLimit()
            },
            floor
        );
    },

    activateThrowingChallengeEvent() {
        const floor = this.ensureFloorMeta();
        if (!floor) {
            return false;
        }

        return this.setActiveFloorEvent(
            'throwing-challenge',
            {
                requiredKills: 5,
                currentKills: 0,
                rewardGranted: false
            },
            {
                currentKills: 0,
                requiredKills: 5
            },
            floor
        );
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

        if (activeEvent.type !== 'food-party') {
            return;
        }

        const remainingTurns = Math.max(0, Math.floor(Number(activeEvent.turnsRemaining) - 1));
        activeEvent.turnsRemaining = remainingTurns;
        activeEvent.display = this.createFloorEventDisplayData('food-party', {
            turnsRemaining: remainingTurns
        });

        if (remainingTurns > 0) {
            return;
        }

        this.cleanupFoodPartyEventItems(activeEvent);
        floor.meta.activeEvent = null;
    },

    tryWakeGuardedRoomEvent() {
        const floor = this.world.getCurrentFloor();
        const activeEvent = floor?.meta?.activeEvent;
        const supportedEventTypes = new Set(['hoard', 'save-lost-explorer', 'retrieve-item']);
        if (!activeEvent || !supportedEventTypes.has(activeEvent.type) || activeEvent.awakened) {
            return;
        }

        const isNearRoom = (x, y) => this.isPositionAdjacentToRoom(activeEvent.room, x, y, 1);

        const playerIsNear = isNearRoom(this.player.x, this.player.y);
        const allyIsNear = !playerIsNear && typeof this.world?.getEnemies === 'function'
            && this.world.getEnemies().some((e) => e?.isAlly && e.isAlive?.() && isNearRoom(e.x, e.y));

        if (!playerIsNear && !allyIsNear) {
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
        if (activeEvent.type === 'hoard') {
            floor.meta.activeEvent = null;
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
            const rewardResult = this.tryAddItemToPlayerInventory?.(rewardItem, { dropIfFull: true });
            if (rewardResult && !rewardResult.added) {
                this.ui?.addMessage?.(`Inventory is full. ${getItemLabel(rewardItem)} drops at your feet.`);
            }
        }

        activeEvent.rewardGranted = true;
        floor.meta.activeEvent = null;
    },

    initializeGame() {
        this.populateCurrentFloorIfNeeded();
        this.spawnPlayerOnFloor();

        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
    },

    grantDebugCheaterLoadout() {
        const equippedCount = Number(this.equipStartingCheaterLoadout?.() || 0);
        const allyGranted = Boolean(this.spawnStartingAlly?.());
        const message = equippedCount > 0 || allyGranted
            ? 'Debug loadout granted.'
            : 'Debug loadout refreshed.';

        this.ui?.addMessage?.(message);
        this.updateFOV();
        this.ui?.render?.(this.world, this.player, this.fov);
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
        const existingAlly = Array.isArray(this.player?.allies)
            ? this.player.allies.find((ally) => ally?.monsterType === 'slimeTier1')
            : null;
        const hadStarterAlly = Boolean(existingAlly && (typeof existingAlly.isAlive !== 'function' || existingAlly.isAlive()));
        const slime = existingAlly || this.createEnemyForType(0, 0, 'slimeTier1', 0);
        const rng = new SeededRNG(this.seed + 888888 + this.world.currentFloor * 31337);
        const spawn = this.findSpawnNearPlayer(slime, rng);

        if (spawn) {
            this.assignActorPosition(slime, spawn);
        } else {
            slime.x = this.player.x;
            slime.y = this.player.y;
        }

        slime.health = slime.maxHealth;
        slime.tame(this.player);
        this.addEnemyIfMissing(slime);
        return !hadStarterAlly;
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
        const floor = this.ensureFloorMeta();
        const floorIndex = this.world.currentFloor;
        const itemFloorIndex = this.isOverworldFloor(floorIndex)
            ? 0
            : this.getDungeonDepthIndex(floorIndex);
        const enemyFloorIndex = itemFloorIndex;
        const rng = this.getFloorContentRng(floorIndex);

        if (floor?.meta?.contentSpawned) {
            this.ensureQuestEventForFloor(rng, floorIndex, { overrideExistingEvent: true });
            return;
        }

        this.spawnPremadeLegendEnemies(rng, enemyFloorIndex);
        if (this.isOverworldFloor(floorIndex)) {
            this.spawnOverworldNpcs(rng);
        } else {
            const dungeonDepthIndex = this.getDungeonDepthIndex(floorIndex);
            this.spawnEnemiesForCurrentFloor(rng, dungeonDepthIndex);
            this.spawnItemsForCurrentFloor(rng, dungeonDepthIndex);
            this.spawnPremadeItemsForCurrentFloor(rng, itemFloorIndex);
            this.populateDungeonShopIfPresent(rng, itemFloorIndex);
        }

        const activatedQuestEvent = this.ensureQuestEventForFloor(rng, floorIndex);
        if (!activatedQuestEvent) {
            this.tryActivateRandomFloorEvent(rng, enemyFloorIndex);
        }

        floor.meta.contentSpawned = true;
    },

    populateDungeonShopIfPresent(rng, floorIndex) {
        const floor = this.world.getCurrentFloor();
        if (!floor || !floor.grid) {
            return;
        }

        const shopTiles = [];
        for (let y = 0; y < floor.grid.length; y++) {
            for (let x = 0; x < floor.grid[y].length; x++) {
                if (floor.grid[y][x] === TILE_TYPES.SHOP) {
                    shopTiles.push({ x, y });
                }
            }
        }

        if (shopTiles.length === 0) {
            return;
        }

        const shopkeeperTile = pickRandom(shopTiles, rng, shopTiles[0]);
        const shopkeeper = this.createEnemyForType(shopkeeperTile.x, shopkeeperTile.y, 'npcTier1', 0);
        if (shopkeeper) {
            shopkeeper.name = 'Shopkeeper';
            shopkeeper.isShopkeeper = true;
            shopkeeper.aiType = AI_TYPES.GUARD;
            shopkeeper.baseAiType = AI_TYPES.GUARD;
            shopkeeper.isNeutralNpc = () => true;
            this.world.addEnemy(shopkeeper);
        }

        for (const tile of shopTiles) {
            if (tile.x === shopkeeperTile.x && tile.y === shopkeeperTile.y) {
                continue;
            }

            if (rng.next() < 0.5) {
                const item = this.createRandomItemForFloor(rng, floorIndex);
                if (item) {
                    item.properties = item.properties || {};
                    item.properties.shopOwned = true;
                    item.properties.shopUnpaid = false;
                    item.properties.shopkeeperId = shopkeeper?.id || null;
                    item.properties.shopPrice = this.getShopItemPrice?.(item) || 30;
                    this.world.addItem(tile.x, tile.y, item);
                }
            }
        }
    }
});
