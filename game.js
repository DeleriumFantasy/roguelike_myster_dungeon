// Main game class
console.log('game.js loaded');

const ENEMY_TEMPLATES = buildEnemyTemplates();

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
        this.inventoryOpen = false;
        this.debugShowAllMonsters = false;
        this.lastSaveTimestamp = null;
        this.pressedMoveKeys = new Set();
        this.pendingMoveTimer = null;

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
        const enemyEntries = this.getEnemySpawnEntriesForFloor(floorIndex);
        for (let i = 0; i < enemyCount; i++) {
            const chosenEntry = this.chooseWeightedEntry(rng, enemyEntries);
            if (!chosenEntry) {
                continue;
            }

            const enemyTypeKey = chosenEntry.key;
            const template = ENEMY_TEMPLATES[enemyTypeKey];
            const enemy = this.createEnemyForType(0, 0, enemyTypeKey, floorIndex);
            const spawn = this.world.findRandomOpenTile(rng, this.player, 200, enemy);
            if (!spawn) {
                console.warn('Could not find open tile for enemy spawn');
                continue;
            }
            enemy.x = spawn.x;
            enemy.y = spawn.y;
            this.world.addEnemy(enemy);
            console.log(`Created ${template.displayName} (${enemyTypeKey}) at (${spawn.x}, ${spawn.y}) with AI type: ${enemy.aiType}`);
        }
    }

    getEnemySpawnEntriesForFloor(floorIndex) {
        const entries = Object.entries(ENEMY_TEMPLATES).map(([key, template]) => ({
            key,
            weight: template.spawnWeight || 1,
            minFloor: template.minFloor,
            maxFloor: template.maxFloor
        }));
        return getWeightedEntriesForFloor(entries, floorIndex);
    }

    chooseWeightedEntry(rng, entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return null;
        }

        const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
        if (totalWeight <= 0) {
            return entries[0] || null;
        }

        let roll = (typeof rng?.next === 'function' ? rng.next() : Math.random()) * totalWeight;
        for (const entry of entries) {
            roll -= Math.max(0, Number(entry.weight) || 0);
            if (roll <= 0) {
                return entry;
            }
        }

        return entries[entries.length - 1] || null;
    }

    createEnemyForType(x, y, enemyTypeKey, floorIndex = this.world.currentFloor) {
        const templateKeys = Object.keys(ENEMY_TEMPLATES);
        const fallbackTemplate = ENEMY_TEMPLATES[templateKeys[0]];
        const template = ENEMY_TEMPLATES[enemyTypeKey] || fallbackTemplate;
        const depth = Math.max(0, floorIndex);

        const scaledStats = {
            health: template.health + depth * 3,
            power: template.power + Math.floor(depth / 2),
            armor: template.armor + Math.floor(depth / 4),
            exp: template.exp + depth * 2,
            fovRange: template.fovRange,
            tameThreshold: template.tameThreshold,
            monsterType: enemyTypeKey,
            creatureTypes: template.types,
            speed: template.speed
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
        const tierEntries = getWeightedItemEntriesForTier(tier);
        const chosenEntry = this.chooseWeightedEntry(rng, tierEntries);
        if (!chosenEntry || typeof chosenEntry.create !== 'function') {
            return null;
        }

        const item = chosenEntry.create();
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

    seedPlayerInventory() {
        const starterItems = [
            ...createTieredStarterItems(),
            ...createAllStatusConsumables()
        ];

        starterItems.forEach((item) => this.player.addItem(item));
    }

    setupEventListeners() {
        const handleKey = (e) => {
            const key = e.key;
            const lowerKey = key.toLowerCase();

            if (this.inventoryOpen && key !== 'Escape') return;
            if (this.ui.mapOpen && key !== 'Escape' && lowerKey !== 'm') return;

            const normalizedMoveKey = normalizeMoveInputKey(key, lowerKey);
            if (normalizedMoveKey) {
                const wasPressed = this.pressedMoveKeys.has(normalizedMoveKey);
                this.pressedMoveKeys.add(normalizedMoveKey);
                if (wasPressed) {
                    e.preventDefault();
                    return;
                }

                const moveDirection = this.getDirectionFromPressedKeys();
                if (!moveDirection) {
                    e.preventDefault();
                    return;
                }

                if (e.shiftKey) {
                    this.lookTowards(moveDirection.dx, moveDirection.dy);
                } else {
                    this.queueCombinedMoveFromPressedKeys();
                }
                e.preventDefault();
                return;
            }

            const lookDirection = this.getDirectionFromKey(key, lowerKey);
            if (e.shiftKey && lookDirection) {
                this.lookTowards(lookDirection.dx, lookDirection.dy);
                e.preventDefault();
                return;
            }

            let handled = true;
            switch (key) {
                case ' ':
                    this.handleFacingAttackInput();
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

        const handleKeyUp = (e) => {
            const key = e.key;
            const lowerKey = key.toLowerCase();
            const normalizedMoveKey = normalizeMoveInputKey(key, lowerKey);
            if (normalizedMoveKey) {
                this.pressedMoveKeys.delete(normalizedMoveKey);
            }
        };

        // use document listener only; canvas focus not strictly required now
        document.addEventListener('keydown', handleKey);
        document.addEventListener('keyup', handleKeyUp);

        document.getElementById('close-inventory').addEventListener('click', () => {
            this.ui.closeInventory();
            this.ui.canvas.focus();
        });

        document.getElementById('close-map').addEventListener('click', () => {
            this.ui.closeMap();
            this.ui.canvas.focus();
        });
    }

    queueCombinedMoveFromPressedKeys() {
        if (this.pendingMoveTimer !== null) {
            return;
        }

        this.pendingMoveTimer = window.setTimeout(() => {
            this.pendingMoveTimer = null;

            const moveDirection = this.getDirectionFromPressedKeys();
            if (!moveDirection) {
                return;
            }

            this.handleMoveInput(moveDirection.dx, moveDirection.dy);
        }, 40);
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
        const facing = typeof this.player.getFacingDirection === 'function'
            ? this.player.getFacingDirection()
            : (this.player.facing || { dx: 0, dy: -1 });

        this.performTurn({
            type: 'attack',
            dx: facing.dx,
            dy: facing.dy
        });
    }

    getDirectionFromKey(key, lowerKey) {
        return getDirectionForInputKey(key, lowerKey);
    }

    getDirectionFromPressedKeys() {
        let dx = 0;
        let dy = 0;

        for (const pressedKey of this.pressedMoveKeys) {
            const direction = getDirectionForInputKey(pressedKey, pressedKey);
            if (!direction) {
                continue;
            }
            dx += direction.dx;
            dy += direction.dy;
        }

        dx = Math.sign(dx);
        dy = Math.sign(dy);
        if (dx === 0 && dy === 0) {
            return null;
        }

        return { dx, dy };
    }

    beginThrowMode(item) {
        if (!item) return;

        const facing = typeof this.player.getFacingDirection === 'function'
            ? this.player.getFacingDirection()
            : (this.player.facing || { dx: 0, dy: -1 });

        this.performTurn({
            type: 'throw',
            item,
            dx: facing.dx,
            dy: facing.dy
        });
    }

    handleLetterKey(lowerKey) {
        const action = getInputActionForKey(lowerKey);
        switch (action) {
            case 'open-inventory':
                this.ui.openInventory(this.player);
                this.inventoryOpen = true;
                return true;
            case 'toggle-map':
                this.ui.toggleMap(this.world, this.player);
                return true;
            case 'quick-save':
                this.quickSave();
                return true;
            case 'quick-load':
                this.quickLoad();
                return true;
            case 'tame-nearest':
                this.tryTameNearestEnemy();
                return true;
            case 'debug-reveal-fov':
                this.fov.revealAll();
                return true;
            case 'debug-toggle-monsters':
                this.debugShowAllMonsters = !this.debugShowAllMonsters;
                console.log(`Show all monsters: ${this.debugShowAllMonsters}`);
                return true;
            default:
                return false;
        }
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

        const startFloor = this.world.currentFloor;

        // Player turn
        const playerTurnConsumed = this.processPlayerTurn(input);
        if (!playerTurnConsumed) {
            return;
        }

        if (!this.player.isAlive()) {
            this.finishGameOverState();
            return;
        }

        // Per-turn player effects
        const hungerChange = this.player.applyPerTurnRegen();

        this.handleFloorChange(startFloor);
        if (input.type !== 'move') {
            this.player.applyEnvironmentEffects(this.world);
        }

        if (!this.player.isAlive()) {
            this.finishGameOverState();
            return;
        }

        // Enemy turns
        this.processEnemyTurns();

        // World advance
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
        this.isGameOver = true;
    }

    handleFloorChange(previousFloor) {
        if (this.world.currentFloor === previousFloor) {
            return;
        }

        this.populateCurrentFloorIfNeeded();
        this.ui.addMessage(`You arrive on floor ${this.world.currentFloor + 1}.`);
        this.clearFailedMoveRecord();

        for (const condition of [...this.player.conditions.keys()]) {
            if (shouldRemoveConditionOnFloorChange(condition)) {
                this.player.removeCondition(condition);
            }
        }

    }

    processPlayerTurn(input) {
        if (this.player.hasCondition(CONDITIONS.SLEEP)) {
            this.player.tickConditions();
            this.ui.addMessage('You are asleep and miss your turn.');
            return true;
        }

        if (this.player.hasCondition(CONDITIONS.BERSERK)) {
            return this.processPlayerBerserkTurn();
        }

        // Action
        if (input.type === 'move') {
            if (this.player.hasCondition(CONDITIONS.BOUND)) {
                this.ui.addMessage('You are bound and cannot move.');
                return false;
            }

            const targetX = this.player.x + input.dx;
            const targetY = this.player.y + input.dy;

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

                this.applyPlayerTrapAtCurrentPosition();

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
            } else if (throwResult.type === 'burned') {
                this.ui.addMessage(`${itemLabel} burns up in lava.`);
            } else {
                this.ui.addMessage(`${itemLabel} lands at ${throwResult.x}, ${throwResult.y}.`);
            }

            this.clearFailedMoveRecord();
            return true;
        }

        if (input.type === 'attack') {
            const attackDx = Number(input.dx) || 0;
            const attackDy = Number(input.dy) || 0;
            if (attackDx === 0 && attackDy === 0) {
                return false;
            }

            this.lookTowards(attackDx, attackDy);

            // Pre-turn status tick
            this.player.tickConditions();

            const targetX = this.player.x + attackDx;
            const targetY = this.player.y + attackDy;
            const enemyOnTarget = this.world.getEnemyAt(targetX, targetY);

            if (enemyOnTarget) {
                if (typeof enemyOnTarget.onAttacked === 'function') {
                    enemyOnTarget.onAttacked();
                }
                const damage = this.player.attackEnemy(enemyOnTarget);
                this.ui.addMessage(`You attack ${enemyOnTarget.name} for ${damage}.`);
                if (!enemyOnTarget.isAlive()) {
                    this.handleEnemyDefeat(enemyOnTarget, { announceDefeat: true });
                }
            } else {
                this.ui.addMessage('You swing at empty space.');
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

    processPlayerBerserkTurn() {
        const actors = this.world.getEnemies().filter((enemy) => {
            if (!enemy || !enemy.isAlive()) {
                return false;
            }

            return !(typeof enemy.hasCondition === 'function' && enemy.hasCondition(CONDITIONS.INVISIBLE));
        });

        if (actors.length === 0) {
            this.player.tickConditions();
            this.ui.addMessage('You rage, but there is nothing to attack.');
            return true;
        }

        actors.sort((left, right) => {
            const leftDistance = distance(this.player.x, this.player.y, left.x, left.y);
            const rightDistance = distance(this.player.x, this.player.y, right.x, right.y);
            return leftDistance - rightDistance;
        });

        const target = actors[0];
        const dx = Math.sign(target.x - this.player.x);
        const dy = Math.sign(target.y - this.player.y);

        this.player.tickConditions();
        this.lookTowards(dx, dy);

        if (distance(this.player.x, this.player.y, target.x, target.y) <= 1.5) {
            const damage = this.player.attackEnemy(target);
            this.ui.addMessage(`You berserk attack ${target.name} for ${damage}.`);
            if (!target.isAlive()) {
                this.handleEnemyDefeat(target, { announceDefeat: true });
            }
            return true;
        }

        if (this.player.hasCondition(CONDITIONS.BOUND)) {
            this.ui.addMessage('You rage in place, unable to move while bound.');
            return true;
        }

        const path = this.findPathForPlayer(target.x, target.y);
        if (!path || path.length <= 1) {
            this.ui.addMessage('You rage, but cannot reach a target.');
            return true;
        }

        const next = path[1];
        const moved = this.player.move(next.x - this.player.x, next.y - this.player.y, this.world);
        if (moved) {
            this.applyPlayerTrapAtCurrentPosition();
            this.pickupItemsAfterMove(next.x, next.y);
            return true;
        }

        this.ui.addMessage('You rage, but your path is blocked.');
        return true;
    }

    findPathForPlayer(targetX, targetY) {
        return findPathAStar(this.player.x, this.player.y, targetX, targetY, (nx, ny, isGoal) => {
            return isGoal || this.world.canPlayerOccupy(nx, ny);
        });
    }

    resolveThrow(item, dx, dy) {
        const grid = this.world.getCurrentFloor().grid;
        let x = this.player.x + dx;
        let y = this.player.y + dy;
        let lastValid = null;
        const burnable = Boolean(item?.properties?.burnable);

        while (isValidPosition(x, y, grid)) {
            lastValid = { x, y };

            const tile = this.world.getTile(x, y);
            if (burnable && doesTileBurnItems(tile)) {
                return {
                    type: 'burned',
                    x,
                    y
                };
            }

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
        const dropResult = this.world.addItem(dropX, dropY, item);
        if (dropResult?.burned) {
            return {
                type: 'burned',
                x: dropX,
                y: dropY
            };
        }

        return {
            type: 'drop',
            x: dropX,
            y: dropY
        };
    }

    processEnemyTurns() {
        for (const enemy of [...this.world.getEnemies()]) {
            const actionsToTake = enemy.consumeActionTurns(this.player);
            for (let actionIndex = 0; actionIndex < actionsToTake; actionIndex++) {
                const result = enemy.takeTurn(this.world, this.player, this.fov);

                if (!enemy.isAlive()) {
                    this.handleEnemyDefeat(enemy, { announceDefeat: true });
                    break;
                }

                if (result?.type === 'attack-player') {
                    this.ui.addMessage(`${enemy.name} hits you for ${result.damage}.`);
                }
                if (result?.type === 'attack-enemy' && result.target) {
                    this.ui.addMessage(`${enemy.name} hits ${result.target.name} for ${result.damage}.`);
                    if (!result.target.isAlive()) {
                        this.handleEnemyDefeat(result.target, { announceDefeat: true, grantExp: false });
                    }
                }
                if (!this.player.isAlive()) {
                    return;
                }
            }
        }
    }

    handleEnemyDefeat(enemy, options = {}) {
        if (!enemy) {
            return;
        }

        const { announceDefeat = false, grantExp = true } = options;
        const floorEnemies = this.world.getEnemies();
        if (floorEnemies.includes(enemy)) {
            this.world.removeEnemy(enemy);
        }

        const droppedItem = this.rollEnemyDrop(enemy);
        if (droppedItem) {
            const dropName = typeof droppedItem.getDisplayName === 'function' ? droppedItem.getDisplayName() : droppedItem.name;
            const dropResult = this.world.addItem(enemy.x, enemy.y, droppedItem);
            if (dropResult?.burned) {
                this.ui.addMessage(`${enemy.name} dropped ${dropName}, but it burned in lava.`);
            } else {
                this.ui.addMessage(`${enemy.name} dropped ${dropName}.`);
            }
        }

        if (grantExp && enemy.exp) {
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
        const activatedSteam = this.world.advanceHazards();
        const playerKey = `${this.player.x},${this.player.y}`;
        const steamRule = getHazardEffectRule(HAZARD_TYPES.STEAM);
        if (activatedSteam.includes(playerKey)) {
            this.player.takeDamage(getEnvironmentalDamageForHazard(HAZARD_TYPES.STEAM, 0));
            if (steamRule?.message) {
                this.ui.addMessage(steamRule.message);
            }
        }

        for (const enemy of [...this.world.getEnemies()]) {
            const enemyKey = `${enemy.x},${enemy.y}`;
            if (!activatedSteam.includes(enemyKey)) {
                continue;
            }

            enemy.takeDamage(getEnvironmentalDamageForHazard(HAZARD_TYPES.STEAM, 0));
            if (!enemy.isAlive()) {
                this.handleEnemyDefeat(enemy, { announceDefeat: true, grantExp: false });
            }
        }
    }

    applyPlayerTrapAtCurrentPosition() {
        const x = this.player.x;
        const y = this.player.y;
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
                facing: this.player.getFacingDirection(),
                health: this.player.health,
                hunger: this.player.hunger,
                conditions: Array.from(this.player.conditions.entries()),
                equipment: this.serializeEquipmentMap(this.player.equipment),
                inventory: this.serializeItemList(this.player.inventory)
            }
        };
    }

    serializeFloor(floor) {
        return {
            grid: floor.grid,
            hazards: Array.from(floor.hazards.entries()),
            traps: Array.from(floor.traps.entries()),
            revealedTraps: Array.from(floor.revealedTraps.values()),
            meta: floor.meta,
            explored: Array.from(floor.fov.explored),
            items: this.serializeItemMap(floor.items),
            enemies: floor.enemies.map((enemy) => this.serializeEnemy(enemy))
        };
    }

    serializeEnemy(enemy) {
        return {
            x: enemy.x,
            y: enemy.y,
            name: enemy.name,
            aiType: enemy.aiType,
            baseAiType: enemy.baseAiType,
            health: enemy.health,
            stats: {
                health: enemy.maxHealth,
                power: enemy.power,
                armor: enemy.armor,
                exp: enemy.exp,
                fovRange: enemy.fovRange,
                tameThreshold: enemy.tameThreshold,
                monsterType: enemy.monsterType,
                creatureTypes: enemy.creatureTypes,
                speed: enemy.speed,
                actionCharge: enemy.actionCharge
            },
            isAlly: enemy.isAlly,
            tamingProgress: enemy.tamingProgress,
            conditions: Array.from(enemy.conditions.entries()),
            equipment: this.serializeEquipmentMap(enemy.equipment)
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

    serializeItemMap(itemMap) {
        return Array.from(itemMap.entries()).map(([key, items]) => [key, this.serializeItemList(items)]);
    }

    serializeItemList(items) {
        return (items || []).map((item) => this.serializeItem(item));
    }

    serializeEquipmentMap(equipment) {
        return Array.from(equipment.entries()).map(([slot, item]) => [slot, this.serializeItem(item)]);
    }

    deserializeItemList(itemList) {
        return (itemList || []).map((itemData) => this.deserializeItem(itemData));
    }

    deserializeItemMap(itemMapData) {
        return new Map((itemMapData || []).map(([key, items]) => [key, this.deserializeItemList(items)]));
    }

    deserializeEquipmentMap(equipmentData) {
        return new Map((equipmentData || []).map(([slot, itemData]) => [slot, this.deserializeItem(itemData)]));
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
        if (data.player.facing) {
            this.player.setFacingDirection(data.player.facing.dx, data.player.facing.dy);
        }
        this.player.health = data.player.health;
        this.player.hunger = data.player.hunger;
        this.player.conditions = new Map(data.player.conditions || []);
        this.player.equipment = this.deserializeEquipmentMap(data.player.equipment);
        this.player.inventory = this.deserializeItemList(data.player.inventory);
        this.player.allies = [];
        this.isGameOver = false;
        this.lastFailedMove = null;

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
            hazards: new Map(floorData.hazards || []),
            traps: new Map(floorData.traps || []),
            revealedTraps: new Set(floorData.revealedTraps || []),
            items: this.deserializeItemMap(floorData.items),
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
            enemyData.baseAiType || enemyData.aiType,
            enemyData.stats || {}
        );
        enemy.aiType = enemyData.aiType ?? enemy.aiType;
        enemy.baseAiType = enemyData.baseAiType || enemy.baseAiType;
        enemy.health = enemyData.health ?? enemy.health;
        enemy.isAlly = Boolean(enemyData.isAlly);
        enemy.tamingProgress = enemyData.tamingProgress || 0;
        enemy.conditions = new Map(enemyData.conditions || []);
        enemy.equipment = this.deserializeEquipmentMap(enemyData.equipment);
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