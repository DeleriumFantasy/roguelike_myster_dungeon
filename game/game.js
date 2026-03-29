// Game bootstrap and high-level turn loop

const ENEMY_TEMPLATES = buildEnemyTemplates();

class Game {
    constructor() {
        this.seed = this.generateNewSeed();
        this.canvas = document.getElementById('canvas');
        this.infoPanel = document.getElementById('info-panel');
        this.resizeCanvas();
        this.inventoryModal = document.getElementById('inventory-modal');
        this.ui = new UI(this.canvas, this.infoPanel, this.inventoryModal, this);
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

    beginThrowMode(item) {
        if (!item) return;

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

        // Handle auto-explore
        if (this.autoExploreActive && !input) {
            const autoMoveInput = this.performAutoExploreTurn();
            if (!autoMoveInput) {
                return;
            }
            input = autoMoveInput;
        }

        const startFloor = this.world.currentFloor;

        const playerTurnResult = this.processPlayerTurn(input);
        if (!playerTurnResult?.consumed) {
            return;
        }

        if (!this.player.isAlive()) {
            this.finishGameOverState();
            return;
        }

        // Per-turn player effects
        this.player.applyPerTurnRegen();
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
        this.populateCurrentFloorIfNeeded();
        this.spawnPlayerOnFloor();
        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
        this.ui.addMessage('A new run begins. Banked storage and overworld NPC state were preserved.');
    }

    handleFloorChange(previousFloor) {
        if (this.world.currentFloor === previousFloor) {
            return;
        }

        this.trackQuestProgressForFloorVisit?.(this.world.currentFloor);
        this.populateCurrentFloorIfNeeded();
        this.spawnAlliesOnCurrentFloor();
        if (this.isOverworldFloor(this.world.currentFloor)) {
            this.ui.addMessage('You return to the overworld.');
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

        this.player.addCondition(trapDefinition.condition, getConditionDuration(trapDefinition.condition));
        if (trapDefinition.message) {
            this.ui.addMessage(trapDefinition.message);
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
        if (this.isOverworldFloor(floorIndex)) {
            return Math.max(FOV_RANGE, 14);
        }

        const normalizedFloor = clamp(Math.floor(Number(floorIndex) || 1), 1, 99);
        const easiestFov = 14;
        const hardestFov = 4;
        const progress = (normalizedFloor - 1) / 98;
        return Math.round(easiestFov + (hardestFov - easiestFov) * progress);
    }
}

// Start the game when the page loads
let game;
window.onload = () => {
    game = new Game();
};