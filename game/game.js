// Game bootstrap and high-level turn loop

class Game {
    constructor() {
        this.seed = this.generateNewSeed();
        this.canvas = document.getElementById('canvas');
        this.infoPanel = document.getElementById('info-panel');
        this.resizeCanvas();
        this.inventoryModal = document.getElementById('inventory-modal');
        this.ui = new UI(this.infoPanel, this.inventoryModal, this);
        this.world = new World(this.seed);
        this.player = new Player(25, 25);
        this.fov = null; // will be set per floor
        this.isGameOver = false;
        this.lastFailedMove = null;
        this.inventoryOpen = false;
        this.fovCache = null;
        this.persistentOverworldNpcs = [];
        this.settings = {
            autoExploreDescendImmediately: false,
            alliesPassive: false
        };
        this.maxUndoStates = 5;
        this.undoHistory = [];
        this.inputController = new GameInputController(this);

        this.inputController.attach();
        this.initializeGame();
    }

    resizeCanvas() {
        const container = this.canvas?.parentElement;
        const availableWidth = Math.max(1, container?.clientWidth || window.innerWidth);
        const availableHeight = Math.max(1, container?.clientHeight || window.innerHeight);
        const tileSize = Math.max(1, Math.floor(availableHeight / CAMERA_VISIBLE_TILE_ROWS));
        const visibleTilesX = Math.max(1, Math.min(GRID_SIZE, Math.floor(availableWidth / tileSize)));
        const nextWidth = visibleTilesX * tileSize;
        const nextHeight = CAMERA_VISIBLE_TILE_ROWS * tileSize;

        this.canvas.width = nextWidth;
        this.canvas.height = nextHeight;
        this.ui?.handleCanvasResize?.();
    }

    getAvailableUndoCount() {
        return Array.isArray(this.undoHistory) ? this.undoHistory.length : 0;
    }

    cloneUndoValue(value, seen = new WeakMap()) {
        if (value === null || typeof value !== 'object') {
            return value;
        }

        if (seen.has(value)) {
            return seen.get(value);
        }

        if (value instanceof Map) {
            const clone = new Map();
            seen.set(value, clone);
            for (const [entryKey, entryValue] of value.entries()) {
                clone.set(this.cloneUndoValue(entryKey, seen), this.cloneUndoValue(entryValue, seen));
            }
            return clone;
        }

        if (value instanceof Set) {
            const clone = new Set();
            seen.set(value, clone);
            for (const entry of value.values()) {
                clone.add(this.cloneUndoValue(entry, seen));
            }
            return clone;
        }

        if (Array.isArray(value)) {
            const clone = [];
            seen.set(value, clone);
            for (const entry of value) {
                clone.push(this.cloneUndoValue(entry, seen));
            }
            return clone;
        }

        const clone = {};
        seen.set(value, clone);
        for (const [key, entryValue] of Object.entries(value)) {
            clone[key] = this.cloneUndoValue(entryValue, seen);
        }
        return clone;
    }

    looksLikeUndoWorld(value) {
        return Boolean(
            value
            && Array.isArray(value.floors)
            && value.pathFloors
            && typeof value.currentFloor === 'number'
            && value.unlockedDungeonPathIds instanceof Set
            && value.completedDungeonPathIds instanceof Set
        );
    }

    looksLikeUndoPlayer(value) {
        return Boolean(
            value
            && Array.isArray(value.inventory)
            && value.equipment instanceof Map
            && value.conditions instanceof Map
            && typeof value.maxHunger === 'number'
            && value.questgiverState
        );
    }

    looksLikeUndoEnemy(value) {
        return Boolean(
            value
            && typeof value.aiType === 'string'
            && typeof value.monsterType === 'string'
            && value.equipment instanceof Map
            && value.swallowedItems instanceof Map
            && typeof value.isAlly === 'boolean'
        );
    }

    looksLikeUndoItem(value) {
        return Boolean(
            value
            && typeof value.name === 'string'
            && typeof value.type === 'string'
            && value.properties
            && Object.prototype.hasOwnProperty.call(value, 'knowledgeState')
        );
    }

    looksLikeUndoFov(value) {
        return Boolean(
            value
            && Array.isArray(value.grid)
            && value.visible instanceof Set
            && value.explored instanceof Set
            && !Object.prototype.hasOwnProperty.call(value, 'meta')
        );
    }

    rehydrateUndoValue(value, seen = new WeakSet()) {
        if (value === null || typeof value !== 'object' || seen.has(value)) {
            return value;
        }

        seen.add(value);

        if (value instanceof Map) {
            for (const [entryKey, entryValue] of value.entries()) {
                this.rehydrateUndoValue(entryKey, seen);
                this.rehydrateUndoValue(entryValue, seen);
            }
            return value;
        }

        if (value instanceof Set) {
            for (const entry of value.values()) {
                this.rehydrateUndoValue(entry, seen);
            }
            return value;
        }

        if (this.looksLikeUndoWorld(value)) {
            Object.setPrototypeOf(value, World.prototype);
        } else if (this.looksLikeUndoPlayer(value)) {
            Object.setPrototypeOf(value, Player.prototype);
        } else if (this.looksLikeUndoEnemy(value)) {
            Object.setPrototypeOf(value, Enemy.prototype);
        } else if (this.looksLikeUndoItem(value)) {
            Object.setPrototypeOf(value, Item.prototype);
        } else if (this.looksLikeUndoFov(value)) {
            Object.setPrototypeOf(value, FOV.prototype);
        }

        if (Array.isArray(value)) {
            for (const entry of value) {
                this.rehydrateUndoValue(entry, seen);
            }
            return value;
        }

        for (const entryValue of Object.values(value)) {
            this.rehydrateUndoValue(entryValue, seen);
        }

        return value;
    }

    createUndoSnapshot() {
        return this.cloneUndoValue({
            seed: this.seed,
            world: this.world,
            player: this.player,
            persistentOverworldNpcs: this.persistentOverworldNpcs,
            settings: this.settings,
            lastFailedMove: this.lastFailedMove,
            uiMessages: this.ui?.messages || []
        });
    }

    commitUndoSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }

        if (!Array.isArray(this.undoHistory)) {
            this.undoHistory = [];
        }

        this.undoHistory.push(snapshot);
        if (this.undoHistory.length > this.maxUndoStates) {
            this.undoHistory.splice(0, this.undoHistory.length - this.maxUndoStates);
        }
    }

    rebuildUndoRuntimeState() {
        const floorsToRepair = [];
        const floorCollections = typeof this.getWorldFloorCollections === 'function'
            ? this.getWorldFloorCollections()
            : [];

        for (const floors of floorCollections) {
            floorsToRepair.push(...floors);
        }

        for (const floor of floorsToRepair) {
            if (!floor || !Array.isArray(floor.grid)) {
                continue;
            }

            if (!(floor.fov instanceof FOV)) {
                floor.fov = new FOV(floor.grid);
            } else {
                floor.fov.grid = floor.grid;
            }

            if (!(floor.hazards instanceof Map)) {
                floor.hazards = new Map(floor.hazards || []);
            }

            if (!(floor.traps instanceof Map)) {
                floor.traps = new Map(floor.traps || []);
            }

            if (!(floor.revealedTraps instanceof Set)) {
                floor.revealedTraps = new Set(floor.revealedTraps || []);
            }

            if (!(floor.items instanceof Map)) {
                floor.items = new Map(floor.items || []);
            }

            if (!Array.isArray(floor.enemies)) {
                floor.enemies = [];
            }

            if (!Array.isArray(floor.npcs)) {
                floor.npcs = [];
            }

            floor.enemyOccupancy = new Map();
            for (const enemy of floor.enemies) {
                if (!enemy || !enemy.isAlive?.()) {
                    continue;
                }

                const key = toGridKey(enemy.x, enemy.y);
                floor.enemyOccupancy.set(key, enemy);
                enemy._occupancyKey = key;
                enemy._occupancyFloorIndex = this.world.currentFloor;
            }
        }
    }

    restoreUndoSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            return false;
        }

        this.stopAutoExplore?.();
        this.inputController?.reset?.();

        this.rehydrateUndoValue(snapshot);

        this.seed = Number.isFinite(snapshot.seed) ? snapshot.seed : this.seed;
        this.world = snapshot.world;
        this.player = snapshot.player;
        this.persistentOverworldNpcs = Array.isArray(snapshot.persistentOverworldNpcs)
            ? snapshot.persistentOverworldNpcs
            : [];
        this.settings = snapshot.settings && typeof snapshot.settings === 'object'
            ? snapshot.settings
            : this.settings;
        this.lastFailedMove = snapshot.lastFailedMove || null;
        this.inventoryOpen = false;
        this.isGameOver = false;
        this.fovCache = null;

        if (this.ui) {
            this.ui.closeInventory?.();
            this.ui.activeVisualEffects = [];
            this.ui.messages = Array.isArray(snapshot.uiMessages) ? [...snapshot.uiMessages] : [];
        }

        this.rebuildUndoRuntimeState();
        this.updateFOV();
        this.ui?.render?.(this.world, this.player, this.fov);
        return true;
    }

    undoLastTurn() {
        if (!Array.isArray(this.undoHistory) || this.undoHistory.length === 0) {
            this.ui?.addMessage?.('No undo is available.');
            this.ui?.render?.(this.world, this.player, this.fov);
            return false;
        }

        const snapshot = this.undoHistory.pop();
        if (!this.restoreUndoSnapshot(snapshot)) {
            this.ui?.addMessage?.('Undo failed.');
            this.ui?.render?.(this.world, this.player, this.fov);
            return false;
        }

        this.ui?.addMessage?.(`Undid the last action. ${this.getAvailableUndoCount()}/${this.maxUndoStates} stored states remain.`);
        this.ui?.render?.(this.world, this.player, this.fov);
        return true;
    }

    lookTowards(dx, dy) {
        if (typeof this.player.setFacingDirection === 'function') {
            this.player.setFacingDirection(dx, dy);
        } else {
            this.player.facing = { dx, dy };
        }

        this.ui.render(this.world, this.player, this.fov);
    }

    handleFacingAttackInput() {
        const facing = getActorFacing(this.player);

        if (this.tryTalkToFacingNpc(facing)) {
            return;
        }

        this.performTurn({
            type: 'attack',
            dx: facing.dx,
            dy: facing.dy
        });
    }

    isNeutralNpcEnemy(enemy) {
        return isNeutralNpcActor(enemy);
    }

    applySettingsChanges(changes = {}) {
        if (!this.settings || !changes || typeof changes !== 'object') {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(changes, 'autoExploreDescendImmediately')) {
            this.settings.autoExploreDescendImmediately = Boolean(changes.autoExploreDescendImmediately);
        }

        if (Object.prototype.hasOwnProperty.call(changes, 'alliesPassive')) {
            this.settings.alliesPassive = Boolean(changes.alliesPassive);
        }
    }

    handleCompletedDungeonPath(pathId) {
        if (!pathId) {
            return;
        }

        const definition = getDungeonPathDefinition(pathId);
        if (!definition) {
            return;
        }

        if (this.world.hasCompletedDungeonPath(pathId)) {
            return;
        }

        this.world.markDungeonPathCompleted(pathId);
        this.ui.addMessage(`Path completed: ${definition.name || pathId}.`);

        const newlyUnlocked = getDungeonPathUnlocksOnComplete(pathId)
            .filter((unlockPathId) => this.world.unlockDungeonPath(unlockPathId))
            .map((unlockPathId) => getDungeonPathDefinition(unlockPathId)?.name || unlockPathId);
        if (newlyUnlocked.length > 0) {
            this.ui.addMessage(`New paths unlocked: ${newlyUnlocked.join(', ')}.`);
        }

        const hadSecondQuestgiver = Array.isArray(this.persistentOverworldNpcs)
            && this.persistentOverworldNpcs.some((npc) => npc?.isSecondQuestgiver);
        const secondQuestgiver = this.ensureSecondQuestgiverAvailability?.();
        if (secondQuestgiver && !hadSecondQuestgiver) {
            if (this.isOverworldFloor(this.world.currentFloor)) {
                const spawnRng = this.getFloorContentRng?.(this.world.currentFloor + 424242) || createMathRng();
                const spawn = this.world.findRandomOpenTile(spawnRng, this.player, 200, secondQuestgiver);
                if (spawn) {
                    this.assignActorPosition(secondQuestgiver, spawn);
                    this.addEnemyIfMissing(secondQuestgiver);
                }
            }

            const unlockMessage = getDungeonWorldEventUnlockMessage('secondQuestgiver');
            if (unlockMessage) {
                this.ui.addMessage(unlockMessage);
            }
        }

    }

    openDungeonSelectionFromOverworldStairs() {
        if (this.ui?.dungeonSelectionOpen) {
            return;
        }

        const options = this.world.getDungeonPathOptions();
        if (!Array.isArray(options) || options.length === 0) {
            this.ui.addMessage('No dungeon options are available.');
            return;
        }

        this.ui.openDungeonSelection(options, (selectedPathId) => {
            if (!this.world.setSelectedDungeonPath(selectedPathId)) {
                this.ui.addMessage('Invalid dungeon selection.');
                return;
            }

            const selectedOption = options.find((option) => option.id === selectedPathId) || null;
            const previousFloor = this.world.currentFloor;
            this.world.descendFloor();
            this.world.moveActorToTile(this.player, TILE_TYPES.STAIRS_UP);
            this.ui.addMessage(`You choose ${selectedOption?.name || 'a dungeon path'}.`);
            this.handleFloorChange(previousFloor);
            this.updateFOV();
            this.ui.render(this.world, this.player, this.fov);
        });
    }

    beginThrowMode(item) {
        if (!item) return;

        if (item?.properties?.throwBlocked) {
            this.ui?.addMessage?.(
                typeof item?.properties?.throwBlockMessage === 'string'
                    ? item.properties.throwBlockMessage
                    : `${getItemLabel(item)} is too heavy to throw.`
            );
            return;
        }

        const facing = getActorFacing(this.player);

        this.performTurn({
            type: 'throw',
            item,
            dx: facing.dx,
            dy: facing.dy
        });
    }

    handleMoveInput(dx, dy) {
        this.lookTowards(dx, dy);

        const moveInput = { type: 'move', dx, dy };
        if (this.shouldDropRepeatedFailedMove(moveInput)) {
            return;
        }
        this.performTurn(moveInput);
    }

    shouldDropRepeatedFailedMove(moveInput) {
        const failed = this.lastFailedMove;
        if (!failed) {
            return false;
        }
        if (failed.dx !== moveInput.dx || failed.dy !== moveInput.dy) {
            return false;
        }
        return this.player.x === failed.playerX && this.player.y === failed.playerY;
    }

    recordFailedMove(moveInput) {
        this.lastFailedMove = {
            dx: moveInput.dx,
            dy: moveInput.dy,
            playerX: this.player.x,
            playerY: this.player.y
        };
    }

    clearFailedMoveRecord() {
        this.lastFailedMove = null;
    }

    performTurn(input) {
        if (this.isGameOver) {
            return;
        }

        this.player.hungerLossDisabled = this.isOverworldFloor(this.world.currentFloor);

        // Handle auto-explore
        if (this.autoExploreActive && !input) {
            const autoMoveInput = this.performAutoExploreTurn();
            if (!autoMoveInput) {
                return;
            }
            input = autoMoveInput;
        }

        const startFloor = this.world.currentFloor;
        const pendingUndoSnapshot = this.createUndoSnapshot();

        const playerTurnResult = this.processPlayerTurn(input);
        if (!playerTurnResult?.consumed) {
            return;
        }

        this.commitUndoSnapshot(pendingUndoSnapshot);

        if (!this.player.isAlive()) {
            this.finishGameOverState();
            return;
        }

        // Per-turn player effects
        this.player.applyPerTurnRegen({
            disableHungerEffects: this.isOverworldFloor(this.world.currentFloor)
        });
        this.advanceActiveFloorEventTurn?.();

        this.handleFloorChange(startFloor);
        if (playerTurnResult.applyEnvironmentAfterAction) {
            this.player.applyEnvironmentEffects(this.world);
        }

        if (!this.player.isAlive()) {
            this.finishGameOverState();
            return;
        }

        if (!playerTurnResult.skipEnemyPhase) {
            this.processEnemyTurns();
        }

        this.worldAdvance();

        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);

        if (!this.player.isAlive()) {
            this.finishGameOverState();
        }
    }

    finishGameOverState() {
        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
        this.ui.addMessage('Game Over!');
        this.resetRunAfterDeath();
    }

    generateNewSeed() {
        return Math.floor(Math.random() * 2147483647);
    }

    resetPlayerForNewRunPreservingBank() {
        const bankMoney = Math.max(0, Math.floor(Number(this.player?.bankMoney) || 0));
        const bankItems = Array.isArray(this.player?.bankItems) ? [...this.player.bankItems] : [];

        this.player = new Player(25, 25);
        this.player.bankMoney = bankMoney;
        this.player.bankItems = bankItems;
        this.player.money = 0;
        this.player.inventory = [];
        this.player.equipment = new Map();
        this.player.conditions = new Map();
        this.player.allies = [];
        this.player.turns = 0;
        this.player.exp = 0;
        this.player.level = 1;
        this.player.expToNextLevel = this.player.getExpToNextLevel();
        this.player.maxHealth = 20;
        this.player.health = 20;
        this.player.maxHunger = 100;
        this.player.hunger = 100;
        this.player.updateStats();
    }

    resetRunAfterDeath() {
        this.isGameOver = false;
        this.inventoryOpen = false;
        this.inputController.reset();
        this.clearFailedMoveRecord();
        this.fovCache = null;

        this.resetPlayerForNewRunPreservingBank();
        this.seed = this.generateNewSeed();
        this.world = new World(this.seed);
        this.spawnPlayerOnFloor();
        this.populateCurrentFloorIfNeeded();
        this.clearNearbyHostileEnemiesFromPlayerSpawn?.();
        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
        this.ui.addMessage('A new run begins. Banked storage and overworld NPC state were preserved. Press U or Ctrl+Z to undo if needed.');
    }

    handleFloorChange(previousFloor) {
        if (this.world.currentFloor === previousFloor) {
            return;
        }

        this.trackQuestProgressForFloorVisit?.(this.world.currentFloor);
        this.populateCurrentFloorIfNeeded();
        this.spawnAlliesOnCurrentFloor();
        this.clearNearbyHostileEnemiesFromPlayerSpawn?.();
        if (this.isOverworldFloor(this.world.currentFloor)) {
            this.player.heal(this.player.maxHealth);
            this.player.restoreHunger(this.player.maxHunger);
            this.player.hungerLossDisabled = true;
            if (typeof this.player.identifyAllItems === 'function') {
                this.player.identifyAllItems();
                this.ui.addMessage('All of your items have been identified.');
            }
            this.ui.addMessage('You return to the overworld, restored to full health and hunger.');
        } else if (this.isOverworldFloor(previousFloor)) {
            this.ui.addMessage(`You enter the dungeon on floor ${this.getDisplayFloorLabel(this.world.currentFloor)}.`);
        } else {
            this.ui.addMessage(`You arrive on floor ${this.getDisplayFloorLabel(this.world.currentFloor)}.`);
        }
        this.clearFailedMoveRecord();

        for (const condition of [...this.player.conditions.keys()]) {
            if (shouldRemoveConditionOnFloorChange(condition)) {
                this.player.removeCondition(condition);
            }
        }

    }

    worldAdvance() {
        const activatedSteam = new Set(this.world.advanceHazards());
        const steamDamage = getEnvironmentalDamageForHazard(HAZARD_TYPES.STEAM, 0);
        const applySteamDamage = (actor) => {
            actor.takeDamage(steamDamage, null, { armorEffectiveness: 0.5 });
        };

        const playerKey = toGridKey(this.player.x, this.player.y);
        const steamRule = getHazardEffectRule(HAZARD_TYPES.STEAM);
        if (activatedSteam.has(playerKey)) {
            applySteamDamage(this.player);
            if (steamRule?.message) {
                this.ui.addMessage(steamRule.message);
            }
        }

        for (const enemy of [...this.world.getEnemies()]) {
            const enemyKey = toGridKey(enemy.x, enemy.y);
            if (!activatedSteam.has(enemyKey)) {
                continue;
            }

            applySteamDamage(enemy);
            if (!enemy.isAlive()) {
                this.handleEnemyDefeat(enemy, { announceDefeat: true, grantExp: false });
            }
        }
    }

    dropPlayerItems() {
        const itemsToDrop = [];
        let removedEquippedItems = false;

        // Collect equipped items and remove them directly from equipment.
        // Trip traps should drop gear to the ground, not route it through the backpack.
        if (typeof this.player?.getEquippedItems === 'function') {
            const equippedItems = this.player.getEquippedItems();
            for (const [slot, item] of equippedItems) {
                if (!item) {
                    continue;
                }

                itemsToDrop.push(item);
                if (this.player.equipment instanceof Map) {
                    this.player.equipment.delete(slot);
                    removedEquippedItems = true;
                }
            }
        }

        if (removedEquippedItems && typeof this.player?.updateStats === 'function') {
            this.player.updateStats();
        }

        // If no equipped items, drop inventory instead.
        if (itemsToDrop.length === 0 && Array.isArray(this.player?.inventory)) {
            itemsToDrop.push(...this.player.inventory);
            this.player.inventory = [];
        }

        if (itemsToDrop.length > 0) {
            this.dropItemsNearEnemy(this.player, itemsToDrop);
        }

        return itemsToDrop.length;
    }

    applyPlayerTrapAtCurrentPosition() {
        const x = this.player.x;
        const y = this.player.y;

        if (typeof this.player?.hasEquippedEnchantment === 'function' && this.player.hasEquippedEnchantment('fly')) {
            return;
        }

        if (typeof this.world.getTrap !== 'function') {
            return;
        }

        const trapType = this.world.getTrap(x, y);
        if (!trapType) {
            return;
        }

        if (typeof this.world.revealTrap === 'function') {
            this.world.revealTrap(x, y);
        }

        const trapDefinition = getTrapDefinition(trapType);
        if (!trapDefinition) {
            return;
        }

        if (trapType === HAZARD_TYPES.TRAP_TRIP) {
            const itemsDropped = this.dropPlayerItems();
            if (trapDefinition.message) {
                this.ui.addMessage(trapDefinition.message);
            }
        } else {
            this.player.addCondition(trapDefinition.condition, getConditionDuration(trapDefinition.condition));
            if (trapDefinition.message) {
                this.ui.addMessage(trapDefinition.message);
            }
        }
    }

    updateFOV() {
        this.fov = this.world.getCurrentFloor().fov;
        const fovRange = this.getFovRangeForFloor(this.world.currentFloor);

        const currentState = {
            floor: this.world.currentFloor,
            x: this.player.x,
            y: this.player.y,
            overworld: this.isOverworldFloor(),
            fovRange
        };

        if (this.fovCache
            && this.fovCache.floor === currentState.floor
            && this.fovCache.x === currentState.x
            && this.fovCache.y === currentState.y
            && this.fovCache.overworld === currentState.overworld
            && this.fovCache.fovRange === currentState.fovRange) {
            return;
        }

        this.fov.compute(this.player.x, this.player.y, fovRange);
        if (this.isOverworldFloor() && typeof this.fov.showAll === 'function') {
            this.fov.showAll();
        }

        this.fovCache = currentState;
    }

    getFovRangeForFloor(floorIndex = this.world.currentFloor) {
        let fovRange;
        
        if (this.isOverworldFloor(floorIndex)) {
            fovRange = Math.max(FOV_RANGE, 14);
        } else {
            const normalizedFloor = clamp(Math.floor(Number(floorIndex) || 1), 1, 99);
            const easiestFov = 14;
            const hardestFov = 4;
            const progress = (normalizedFloor - 1) / 98;
            fovRange = Math.round(easiestFov + (hardestFov - easiestFov) * progress);
        }

        // Apply weather modifier
        const currentFloor = this.world.getCurrentFloor();
        const weather = currentFloor?.meta?.weather || WEATHER_TYPES.NONE;
        const weatherDefinition = WEATHER_DEFINITIONS[weather];
        if (weatherDefinition?.fovModifier) {
            fovRange = Math.max(2, fovRange + weatherDefinition.fovModifier);
        }

        return fovRange;
    }
}

// Start the game when the page loads
let game;
window.onload = () => {
    game = new Game();
};