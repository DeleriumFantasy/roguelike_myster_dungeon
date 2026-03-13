// Main game class
console.log('game.js loaded');

const ENEMY_TEMPLATES = {
    goblinTier1: {
        displayName: 'Goblin',
        aiType: AI_TYPES.WANDER,
        health: 8,
        power: 3,
        armor: 4,
        exp: 2,
        fovRange: 9,
        tameThreshold: 3
    },
    goblinTier2: {
        displayName: 'Goblin',
        aiType: AI_TYPES.WANDER,
        health: 45,
        power: 5,
        armor: 0,
        exp: 14,
        fovRange: 9,
        tameThreshold: 3
    },
    goblinTier3: {
        displayName: 'Goblin',
        aiType: AI_TYPES.WANDER,
        health: 20,
        power: 5,
        armor: 0,
        exp: 19,
        fovRange: 9,
        tameThreshold: 3
    },



    ghost: {
        displayName: 'Ghost',
        aiType: AI_TYPES.AMBUSH,
        health: 16,
        power: 6,
        armor: 0,
        exp: 18,
        fovRange: 11,
        tameThreshold: 5
    }
};


class Game {
    constructor() {
        console.log('Game constructor');
        this.seed = 12345; // Change this seed to generate different layouts
        this.canvas = document.getElementById('canvas');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.infoPanel = document.getElementById('info-panel');
        this.inventoryModal = document.getElementById('inventory-modal');
        this.ui = new UI(this.canvas, this.infoPanel, this.inventoryModal, this);
        this.world = new World(this.seed);
        this.player = new Player(25, 25);
        this.fov = null; // will be set per floor
        this.isGameOver = false;
        this.lastFailedMove = null;
        this.awaitingThrowDirection = false;
        this.pendingThrowItem = null;
        this.inventoryOpen = false;
        this.debugShowAllMonsters = false;
        this.lastSaveTimestamp = null;

        this.setupEventListeners();
        this.initializeGame();
    }

    initializeGame() {
        this.populateCurrentFloorIfNeeded();
        this.seedPlayerInventory();

        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
    }

    populateCurrentFloorIfNeeded() {
        const floor = this.world.getCurrentFloor();
        if (floor.meta?.contentSpawned) {
            return;
        }

        const floorIndex = this.world.currentFloor;
        const rng = this.getFloorContentRng(floorIndex);
        this.spawnEnemiesForCurrentFloor(rng, floorIndex);
        this.spawnItemsForCurrentFloor(rng, floorIndex);

        floor.meta = floor.meta || {};
        floor.meta.contentSpawned = true;
    }

    getFloorContentRng(floorIndex) {
        return new SeededRNG(this.seed + (floorIndex + 1) * 7919);
    }

    getEnemySpawnCountForFloor(floorIndex) {
        return clamp(4 + Math.floor(floorIndex / 2), 4, 12);
    }

    getItemSpawnCountForFloor(floorIndex) {
        return clamp(5 + Math.floor(floorIndex / 3), 5, 14);
    }

    spawnEnemiesForCurrentFloor(rng, floorIndex = this.world.currentFloor) {
        const enemyCount = this.getEnemySpawnCountForFloor(floorIndex);
        const enemyTypes = Object.keys(ENEMY_TEMPLATES);
        for (let i = 0; i < enemyCount; i++) {
            const spawn = this.world.findRandomOpenTile(rng, this.player);
            if (!spawn) {
                console.warn('Could not find open tile for enemy spawn');
                continue;
            }
            const enemyTypeKey = enemyTypes[rng.randomInt(0, enemyTypes.length - 1)];
            const template = ENEMY_TEMPLATES[enemyTypeKey];
            const enemy = this.createEnemyForType(spawn.x, spawn.y, enemyTypeKey, floorIndex);
            this.world.addEnemy(enemy);
            console.log(`Created ${template.displayName} (${enemyTypeKey}) at (${spawn.x}, ${spawn.y}) with AI type: ${enemy.aiType}`);
        }
    }

    createEnemyForType(x, y, enemyTypeKey, floorIndex = this.world.currentFloor) {
        const template = ENEMY_TEMPLATES[enemyTypeKey] || ENEMY_TEMPLATES.goblinTier1;
        const depth = Math.max(0, floorIndex);

        const scaledStats = {
            health: template.health + depth * 3,
            power: template.power + Math.floor(depth / 2),
            armor: template.armor + Math.floor(depth / 4),
            exp: template.exp + depth * 2,
            fovRange: template.fovRange,
            tameThreshold: template.tameThreshold,
            monsterType: enemyTypeKey
        };

        return new Enemy(x, y, template.displayName, template.aiType, scaledStats);
    }

    spawnItemsForCurrentFloor(rng, floorIndex = this.world.currentFloor) {
        const itemCount = this.getItemSpawnCountForFloor(floorIndex);
        for (let i = 0; i < itemCount; i++) {
            const spawn = this.world.findRandomItemSpawnTile(rng, this.player);
            if (!spawn) {
                console.warn('Could not find open tile for item spawn');
                continue;
            }

            const item = this.createRandomItemForFloor(rng, floorIndex);
            if (!item) {
                continue;
            }
            this.world.addItem(spawn.x, spawn.y, item);
        }
    }

    createRandomItemForFloor(rng, floorIndex = this.world.currentFloor) {
        const tier = this.rollItemTierForFloor(floorIndex, rng);
        const tierFactories = this.getItemFactoriesForTier(tier);
        if (tierFactories.length === 0) {
            return null;
        }

        const factory = tierFactories[rng.randomInt(0, tierFactories.length - 1)];
        const item = factory();
        return applyWorldCurseRoll(item, rng);
    }

    rollItemTierForFloor(floorIndex, rng) {
        const baseTier = Math.min(4, 1 + Math.floor(floorIndex / 2));
        const tierRoll = rng.randomInt(0, 3);
        if (tierRoll === 0 && baseTier > 1) {
            return baseTier - 1;
        }
        if (tierRoll >= 2 && baseTier < 4) {
            return baseTier + 1;
        }
        return baseTier;
    }

    getItemFactoriesForTier(tier) {
        const normalizedTier = clamp(tier, 1, 4);
        const accessoryTier = Math.min(normalizedTier, 2);

        switch (normalizedTier) {
            case 4:
                return [
                    createHealingTier4,
                    createFoodTier4,
                    createThrowableTier4,
                    createWeaponTier4,
                    createArmorTier4,
                    createShieldTier4,
                    accessoryTier === 2 ? createAccessoryAttackTier2 : createAccessoryAttackTier1,
                    accessoryTier === 2 ? createAccessoryDefenseTier2 : createAccessoryDefenseTier1
                ];
            case 3:
                return [
                    createHealingTier3,
                    createFoodTier3,
                    createThrowableTier3,
                    createWeaponTier3,
                    createArmorTier3,
                    createShieldTier3,
                    accessoryTier === 2 ? createAccessoryAttackTier2 : createAccessoryAttackTier1,
                    accessoryTier === 2 ? createAccessoryDefenseTier2 : createAccessoryDefenseTier1
                ];
            case 2:
                return [
                    createHealingTier2,
                    createFoodTier2,
                    createThrowableTier2,
                    createWeaponTier2,
                    createArmorTier2,
                    createShieldTier2,
                    createAccessoryAttackTier2,
                    createAccessoryDefenseTier2
                ];
            case 1:
            default:
                return [
                    createHealingTier1,
                    createFoodTier1,
                    createThrowableTier1,
                    createWeaponTier1,
                    createArmorTier1,
                    createShieldTier1,
                    createAccessoryAttackTier1,
                    createAccessoryDefenseTier1
                ];
        }
    }

    seedPlayerInventory() {
        this.player.addItem(createHealingTier1());
        this.player.addItem(createFoodTier1());
        this.player.addItem(createThrowableTier1());
        this.player.addItem(createWeaponTier1());
        this.player.addItem(createShieldTier1());
        this.player.addItem(createArmorTier1());
        this.player.addItem(createAccessoryDefenseTier1());
    }

    setupEventListeners() {
        const handleKey = (e) => {
            const key = e.key;
            const lowerKey = key.toLowerCase();

            if (this.awaitingThrowDirection) {
                const handledThrow = this.handleThrowDirectionInput(key, lowerKey);
                if (handledThrow) {
                    e.preventDefault();
                }
                return;
            }

            if (this.inventoryOpen && key !== 'Escape') return;
            if (this.ui.mapOpen && key !== 'Escape' && lowerKey !== 'm') return;

            let handled = true;
            switch (key) {
                case 'ArrowUp':
                    this.handleMoveInput(0, -1);
                    break;
                case 'ArrowDown':
                    this.handleMoveInput(0, 1);
                    break;
                case 'ArrowLeft':
                    this.handleMoveInput(-1, 0);
                    break;
                case 'ArrowRight':
                    this.handleMoveInput(1, 0);
                    break;
                case 'Escape':
                    if (this.inventoryOpen) {
                        this.ui.closeInventory();
                        this.ui.canvas.focus();
                    } else if (this.ui.mapOpen) {
                        this.ui.closeMap();
                    }
                    break;
                default:
                    handled = this.handleLetterKey(lowerKey);
            }

            if (handled) {
                e.preventDefault();
            }
        };

        // use document listener only; canvas focus not strictly required now
        document.addEventListener('keydown', handleKey);

        document.getElementById('close-inventory').addEventListener('click', () => {
            this.ui.closeInventory();
            this.ui.canvas.focus();
        });

        document.getElementById('close-map').addEventListener('click', () => {
            this.ui.closeMap();
            this.ui.canvas.focus();
        });
    }

    handleThrowDirectionInput(key, lowerKey) {
        if (key === 'Escape') {
            this.cancelThrowMode();
            return true;
        }

        const direction = this.getDirectionFromKey(key, lowerKey);
        if (!direction) {
            return false;
        }

        const throwItem = this.pendingThrowItem;
        this.pendingThrowItem = null;
        this.awaitingThrowDirection = false;

        this.performTurn({
            type: 'throw',
            item: throwItem,
            dx: direction.dx,
            dy: direction.dy
        });
        return true;
    }

    getDirectionFromKey(key, lowerKey) {
        switch (key) {
            case 'ArrowUp':
                return { dx: 0, dy: -1 };
            case 'ArrowDown':
                return { dx: 0, dy: 1 };
            case 'ArrowLeft':
                return { dx: -1, dy: 0 };
            case 'ArrowRight':
                return { dx: 1, dy: 0 };
            default:
                break;
        }

        switch (lowerKey) {
            case 'w':
                return { dx: 0, dy: -1 };
            case 's':
                return { dx: 0, dy: 1 };
            case 'a':
                return { dx: -1, dy: 0 };
            case 'd':
                return { dx: 1, dy: 0 };
            default:
                return null;
        }
    }

    beginThrowMode(item) {
        if (!item) return;
        this.awaitingThrowDirection = true;
        this.pendingThrowItem = item;
        this.ui.addMessage('Choose throw direction (WASD or arrows). Press Escape to cancel.');
    }

    cancelThrowMode() {
        this.awaitingThrowDirection = false;
        this.pendingThrowItem = null;
        this.ui.addMessage('Throw cancelled.');
    }

    handleLetterKey(lowerKey) {
        switch (lowerKey) {
            case 'w':
                this.handleMoveInput(0, -1);
                return true;
            case 's':
                this.handleMoveInput(0, 1);
                return true;
            case 'a':
                this.handleMoveInput(-1, 0);
                return true;
            case 'd':
                this.handleMoveInput(1, 0);
                return true;
            case 'i':
                this.ui.openInventory(this.player);
                this.inventoryOpen = true;
                return true;
            case 'm':
                this.ui.toggleMap(this.world, this.player);
                return true;
            case 'k':
                this.quickSave();
                return true;
            case 'l':
                this.quickLoad();
                return true;
            case 't':
                this.tryTameNearestEnemy();
                return true;
            case 'v':
                // DEBUG: reveal all tiles
                this.fov.revealAll();
                return true;
            case 'b':
                // DEBUG: toggle show all monsters
                this.debugShowAllMonsters = !this.debugShowAllMonsters;
                console.log(`Show all monsters: ${this.debugShowAllMonsters}`);
                return true;
            default:
                return false;
        }
    }

    handleMoveInput(dx, dy) {
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

        const startFloor = this.world.currentFloor;

        // Player turn
        const playerTurnConsumed = this.processPlayerTurn(input);
        if (!playerTurnConsumed) {
            return;
        }

        // Per-turn player effects
        const hungerChange = this.player.applyPerTurnRegen();

        this.handleFloorChange(startFloor);

        // Enemy turns
        this.processEnemyTurns();

        // World advance
        this.worldAdvance();

        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);

        if (!this.player.isAlive()) {
            this.ui.addMessage('Game Over!');
            this.isGameOver = true;
        }
    }

    handleFloorChange(previousFloor) {
        if (this.world.currentFloor === previousFloor) {
            return;
        }

        this.populateCurrentFloorIfNeeded();
        this.ui.addMessage(`You arrive on floor ${this.world.currentFloor + 1}.`);
        this.clearFailedMoveRecord();
    }

    processPlayerTurn(input) {
        // Action
        if (input.type === 'move') {
            const targetX = this.player.x + input.dx;
            const targetY = this.player.y + input.dy;

            const enemyOnTarget = this.world.getEnemyAt(targetX, targetY);
            if (enemyOnTarget) {
                // Pre-turn status tick
                this.player.tickConditions();

                const damage = this.player.attackEnemy(enemyOnTarget);
                this.ui.addMessage(`You attack ${enemyOnTarget.name} for ${damage}.`);
                if (!enemyOnTarget.isAlive()) {
                    this.handleEnemyDefeat(enemyOnTarget, { announceDefeat: true });
                }

                this.clearFailedMoveRecord();
                return true;
            }

            if (!this.world.canPlayerOccupy(targetX, targetY)) {
                this.recordFailedMove(input);
                return false;
            }

            // Pre-turn status tick
            this.player.tickConditions();

            const floorBeforeMove = this.world.currentFloor;
            const moved = this.player.move(input.dx, input.dy, this.world);
            if (moved) {
                this.clearFailedMoveRecord();

                if (this.world.currentFloor === floorBeforeMove) {
                    this.pickupItemsAfterMove(targetX, targetY);
                }

                return true;
            }

            this.recordFailedMove(input);
            return false;
        }

        if (input.type === 'throw') {
            if (!input.item) {
                return false;
            }

            // Pre-turn status tick
            this.player.tickConditions();

            const throwResult = this.resolveThrow(input.item, input.dx, input.dy);
            this.player.removeItem(input.item);
            if (typeof input.item.identify === 'function') {
                input.item.identify();
            }

            const itemLabel = typeof input.item.getDisplayName === 'function' ? input.item.getDisplayName() : input.item.name;
            if (throwResult.type === 'hit') {
                this.ui.addMessage(`${itemLabel} hits ${throwResult.enemy.name}.`);
                if ((throwResult.damage || 0) > 0) {
                    this.ui.addMessage(`${throwResult.enemy.name} takes ${throwResult.damage} throw damage.`);
                }
                if ((throwResult.healing || 0) > 0) {
                    this.ui.addMessage(`${throwResult.enemy.name} recovers ${throwResult.healing} health from the throw.`);
                }
                this.ui.addMessage(`${itemLabel} shatters on impact.`);
                if (throwResult.enemyDefeated) {
                    this.ui.addMessage(`${throwResult.enemy.name} is defeated.`);
                }
            } else {
                this.ui.addMessage(`${itemLabel} lands at ${throwResult.x}, ${throwResult.y}.`);
            }

            this.clearFailedMoveRecord();
            return true;
        }

        // Pre-turn status tick
        this.player.tickConditions();

        // Post-turn resolution
        // Placeholder
        return true;
    }

    resolveThrow(item, dx, dy) {
        const grid = this.world.getCurrentFloor().grid;
        let x = this.player.x + dx;
        let y = this.player.y + dy;
        let lastValid = null;

        while (isValidPosition(x, y, grid)) {
            lastValid = { x, y };

            const enemy = this.world.getEnemyAt(x, y);
            if (enemy && !enemy.isAlly) {
                const throwImpact = item.throw(this.player, enemy) || { damage: 0, healing: 0 };
                const enemyDefeated = !enemy.isAlive();
                if (enemyDefeated) {
                    this.handleEnemyDefeat(enemy, { announceDefeat: false });
                }

                return {
                    type: 'hit',
                    enemy,
                    enemyDefeated,
                    damage: throwImpact.damage || 0,
                    healing: throwImpact.healing || 0,
                    x,
                    y
                };
            }

            x += dx;
            y += dy;
        }

        const dropX = lastValid ? lastValid.x : this.player.x;
        const dropY = lastValid ? lastValid.y : this.player.y;
        this.world.addItem(dropX, dropY, item);
        return {
            type: 'drop',
            x: dropX,
            y: dropY
        };
    }

    processEnemyTurns() {
        for (const enemy of [...this.world.getEnemies()]) {
            const result = enemy.takeTurn(this.world, this.player, this.fov);

            if (!enemy.isAlive()) {
                this.handleEnemyDefeat(enemy, { announceDefeat: true });
                continue;
            }

            if (result?.type === 'attack-player') {
                this.ui.addMessage(`${enemy.name} hits you for ${result.damage}.`);
            }
            if (!this.player.isAlive()) {
                break;
            }
        }
    }

    handleEnemyDefeat(enemy, options = {}) {
        if (!enemy) {
            return;
        }

        const { announceDefeat = false } = options;
        const floorEnemies = this.world.getEnemies();
        if (floorEnemies.includes(enemy)) {
            this.world.removeEnemy(enemy);
        }

        const droppedItem = this.rollEnemyDrop(enemy);
        if (droppedItem) {
            this.world.addItem(enemy.x, enemy.y, droppedItem);
            const dropName = typeof droppedItem.getDisplayName === 'function' ? droppedItem.getDisplayName() : droppedItem.name;
            this.ui.addMessage(`${enemy.name} dropped ${dropName}.`);
        }

        if (enemy.exp) {
            const levelUps = this.player.addExp(enemy.exp);
            this.ui.addMessage(`Gained ${enemy.exp} EXP.`);
            if (levelUps > 0) {
                this.ui.addMessage(`Leveled up to ${this.player.level}!`);
            }
        }

        if (announceDefeat) {
            this.ui.addMessage(`${enemy.name} is defeated.`);
        }
    }

    rollEnemyDrop(enemy) {
        if (!enemy) {
            return null;
        }

        const dropChance = Math.min(0.85, 0.35 + this.world.currentFloor * 0.05);
        if (Math.random() >= dropChance) {
            return null;
        }

        const rng = {
            next: () => Math.random(),
            randomInt: (min, max) => randomInt(min, max)
        };

        return this.createRandomItemForFloor(rng, this.world.currentFloor);
    }

    pickupItemsAtPlayerPosition() {
        const pickupResult = this.pickupItemsAtPosition(this.player.x, this.player.y);
        if (pickupResult.count === 0) {
            return;
        }

        if (pickupResult.count === 1) {
            this.ui.addMessage(`Picked up ${pickupResult.names[0]}.`);
            return;
        }

        this.ui.addMessage(`Picked up ${pickupResult.count} items.`);
    }

    pickupItemsAfterMove(targetX, targetY) {
        const endedOnTargetTile = this.player.x === targetX && this.player.y === targetY;
        if (endedOnTargetTile) {
            this.pickupItemsAtPlayerPosition();
            return;
        }

        const pickupResult = this.pickupItemsAtPosition(targetX, targetY);
        if (pickupResult.count === 0) {
            return;
        }

        if (pickupResult.count === 1) {
            this.ui.addMessage(`You grab ${pickupResult.names[0]} as you are swept away.`);
            return;
        }

        this.ui.addMessage(`You grab ${pickupResult.count} items as you are swept away.`);
    }

    pickupItemsAtPosition(x, y) {
        const items = this.world.getItems(x, y);
        if (!items.length) {
            return { count: 0, names: [] };
        }

        const pickedNames = [];
        for (const item of [...items]) {
            this.player.addItem(item);
            this.world.removeItem(x, y, item);
            const itemName = typeof item.getDisplayName === 'function' ? item.getDisplayName() : item.name;
            pickedNames.push(itemName);
        }

        return {
            count: pickedNames.length,
            names: pickedNames
        };
    }

    worldAdvance() {
        // Placeholder for world updates
    }

    tryTameNearestEnemy() {
        const candidates = this.world.getEnemies().filter((enemy) => {
            if (!enemy.isAlive()) return false;
            const enemyDistance = distance(enemy.x, enemy.y, this.player.x, this.player.y);
            return enemyDistance <= 1.5;
        });

        if (candidates.length === 0) {
            this.ui.addMessage('No tameable enemy nearby.');
            return;
        }

        const target = candidates[0];
        const progressed = target.attemptTame(this.player, 1);
        if (!progressed) {
            this.ui.addMessage(`${target.name} resists taming.`);
            return;
        }

        if (target.isAlly) {
            this.ui.addMessage(`${target.name} is now your ally.`);
        } else {
            this.ui.addMessage(`Taming progress on ${target.name}: ${target.tamingProgress}/${target.getTameThreshold()}`);
        }
    }

    quickSave() {
        if (!FEATURE_FLAGS.SAVE_LOAD) {
            this.ui.addMessage('Save/load is placeholder; writing compatibility snapshot.');
        }

        const payload = this.serializeGameState();
        localStorage.setItem(SAVE_CONFIG.STORAGE_KEY, JSON.stringify(payload));
        this.lastSaveTimestamp = Date.now();
        this.ui.addMessage('Game snapshot saved.');
    }

    quickLoad() {
        const raw = localStorage.getItem(SAVE_CONFIG.STORAGE_KEY);
        if (!raw) {
            this.ui.addMessage('No saved snapshot found.');
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            this.loadGameState(parsed);
            this.ui.addMessage('Game snapshot loaded.');
        } catch (error) {
            console.error(error);
            this.ui.addMessage('Failed to load snapshot.');
        }
    }

    serializeGameState() {
        return {
            version: SAVE_CONFIG.VERSION,
            seed: this.seed,
            world: {
                baseSeed: this.world.baseSeed,
                currentFloor: this.world.currentFloor,
                floors: this.world.floors.map((floor) => this.serializeFloor(floor))
            },
            player: {
                x: this.player.x,
                y: this.player.y,
                health: this.player.health,
                hunger: this.player.hunger,
                conditions: Array.from(this.player.conditions.entries()),
                equipment: Array.from(this.player.equipment.entries()).map(([slot, item]) => [slot, this.serializeItem(item)]),
                inventory: this.player.inventory.map((item) => this.serializeItem(item))
            }
        };
    }

    serializeFloor(floor) {
        return {
            grid: floor.grid,
            meta: floor.meta,
            explored: Array.from(floor.fov.explored),
            items: Array.from(floor.items.entries()).map(([key, items]) => [key, items.map((item) => this.serializeItem(item))]),
            enemies: floor.enemies.map((enemy) => this.serializeEnemy(enemy))
        };
    }

    serializeEnemy(enemy) {
        return {
            x: enemy.x,
            y: enemy.y,
            name: enemy.name,
            aiType: enemy.aiType,
            health: enemy.health,
            stats: {
                health: enemy.maxHealth,
                power: enemy.power,
                armor: enemy.armor
            },
            isAlly: enemy.isAlly,
            tamingProgress: enemy.tamingProgress,
            conditions: Array.from(enemy.conditions.entries()),
            equipment: Array.from(enemy.equipment.entries()).map(([slot, item]) => [slot, this.serializeItem(item)])
        };
    }

    serializeItem(item) {
        return {
            name: item.name,
            type: item.type,
            properties: item.properties,
            knowledgeState: item.knowledgeState
        };
    }

    loadGameState(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid save format');
        }

        this.seed = data.seed;
        this.world.baseSeed = data.world.baseSeed;
        this.world.currentFloor = data.world.currentFloor;
        this.world.floors = data.world.floors.map((floorData) => this.deserializeFloor(floorData));

        this.player.x = data.player.x;
        this.player.y = data.player.y;
        this.player.health = data.player.health;
        this.player.hunger = data.player.hunger;
        this.player.conditions = new Map(data.player.conditions || []);
        this.player.equipment = new Map((data.player.equipment || []).map(([slot, itemData]) => [slot, this.deserializeItem(itemData)]));
        this.player.inventory = (data.player.inventory || []).map((itemData) => this.deserializeItem(itemData));
        this.player.allies = [];
        this.isGameOver = false;
        this.lastFailedMove = null;
        this.awaitingThrowDirection = false;
        this.pendingThrowItem = null;

        this.bindLoadedAllies();
        this.populateCurrentFloorIfNeeded();
        this.player.updateStats();
        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
    }

    deserializeFloor(floorData) {
        const grid = floorData.grid;
        const fov = new FOV(grid);
        fov.explored = new Set(floorData.explored || []);

        const hasAnyItems = Array.isArray(floorData.items) && floorData.items.length > 0;
        const hasAnyEnemies = Array.isArray(floorData.enemies) && floorData.enemies.length > 0;
        const meta = floorData.meta || {
            areaType: AREA_TYPES.DUNGEON,
            generatorType: 'generator:dungeon',
            mapRevealed: false
        };
        if (typeof meta.contentSpawned !== 'boolean') {
            meta.contentSpawned = hasAnyItems || hasAnyEnemies;
        }

        return {
            grid,
            items: new Map((floorData.items || []).map(([key, items]) => [key, items.map((itemData) => this.deserializeItem(itemData))])),
            enemies: (floorData.enemies || []).map((enemyData) => this.deserializeEnemy(enemyData)),
            fov,
            meta
        };
    }

    deserializeEnemy(enemyData) {
        const enemy = new Enemy(
            enemyData.x,
            enemyData.y,
            enemyData.name,
            enemyData.aiType,
            enemyData.stats || {}
        );
        enemy.health = enemyData.health ?? enemy.health;
        enemy.isAlly = Boolean(enemyData.isAlly);
        enemy.tamingProgress = enemyData.tamingProgress || 0;
        enemy.conditions = new Map(enemyData.conditions || []);
        enemy.equipment = new Map((enemyData.equipment || []).map(([slot, itemData]) => [slot, this.deserializeItem(itemData)]));
        return enemy;
    }

    deserializeItem(itemData) {
        const item = new Item(itemData.name, itemData.type, itemData.properties || {});
        if (itemData.knowledgeState) {
            item.knowledgeState = itemData.knowledgeState;
        }
        return item;
    }

    bindLoadedAllies() {
        for (const floor of this.world.floors) {
            for (const enemy of floor.enemies) {
                if (enemy.isAlly) {
                    enemy.tamedBy = this.player;
                    this.player.addAlly(enemy);
                }
            }
        }
    }

    updateFOV() {
        this.fov = this.world.getCurrentFloor().fov;
        this.fov.compute(this.player.x, this.player.y, FOV_RANGE);
    }
}

// Start the game when the page loads
let game;
window.onload = () => {
    game = new Game();
};