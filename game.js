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
        this.pressedMoveKeys = new Set();
        this.pendingMoveTimer = null;

        this.setupEventListeners();
        this.initializeGame();
    }

    initializeGame() {
        this.populateCurrentFloorIfNeeded();
        this.spawnPlayerOnFloor();
        this.seedPlayerInventory();

        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
    }

    spawnPlayerOnFloor() {
        const grid = this.world.getCurrentFloor().grid;
        const rng = new SeededRNG(this.seed + 999999);

        for (let attempt = 0; attempt < 600; attempt++) {
            const x = rng.randomInt(1, GRID_SIZE - 2);
            const y = rng.randomInt(1, GRID_SIZE - 2);
            if (grid[y][x] === TILE_TYPES.FLOOR) {
                this.player.x = x;
                this.player.y = y;
                return;
            }
        }
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
            const enemy = this.createEnemyForType(0, 0, enemyTypeKey, floorIndex);
            const spawn = this.world.findRandomOpenTile(rng, this.player, 200, enemy);
            if (!spawn) {
                console.warn('Could not find open tile for enemy spawn');
                continue;
            }
            enemy.x = spawn.x;
            enemy.y = spawn.y;
            this.world.addEnemy(enemy);
            console.log(`Created ${enemy.name} (${enemyTypeKey}) at (${spawn.x}, ${spawn.y}) with AI type: ${enemy.aiType}`);
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
        if (item && item.type === ITEM_TYPES.MONEY) {
            item.properties = item.properties || {};
            item.properties.value = this.computeMoneyValueForFloor(item, floorIndex, rng);
        }
        applyWorldEnchantmentRoll(item, rng);
        return applyWorldCurseRoll(item, rng);
    }

    getMoneyValueRange(item) {
        const minValue = Number(item?.properties?.valueMin);
        const maxValue = Number(item?.properties?.valueMax);

        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
            return { min: 1, max: 1 };
        }

        const safeMin = Math.max(1, Math.floor(Math.min(minValue, maxValue)));
        const safeMax = Math.max(safeMin, Math.floor(Math.max(minValue, maxValue)));
        return { min: safeMin, max: safeMax };
    }

    computeMoneyValueForFloor(item, floorIndex = this.world.currentFloor, rng = null) {
        const floorMultiplier = Math.max(1, Math.floor(Number(floorIndex) + 1));
        const range = this.getMoneyValueRange(item);
        const rolledValue = rng && typeof rng.randomInt === 'function'
            ? rng.randomInt(range.min, range.max)
            : randomInt(range.min, range.max);

        return Math.max(1, Math.floor(rolledValue) * floorMultiplier);
    }

    getValidMoneyValue(item) {
        const configuredValue = Number(item?.properties?.value);
        if (Number.isFinite(configuredValue) && configuredValue > 0) {
            return Math.max(1, Math.floor(configuredValue));
        }

        return this.computeMoneyValueForFloor(item, this.world.currentFloor, null);
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

            const lookDirection = getDirectionForInputKey(key, lowerKey);
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

        if (this.tryTalkToFacingNpc(facing)) {
            return;
        }

        this.performTurn({
            type: 'attack',
            dx: facing.dx,
            dy: facing.dy
        });
    }

    tryTalkToFacingNpc(facing) {
        const targetX = this.player.x + (Number(facing?.dx) || 0);
        const targetY = this.player.y + (Number(facing?.dy) || 0);
        const enemy = this.world.getEnemyAt(targetX, targetY);
        if (!enemy || typeof enemy.isNeutralNpc !== 'function' || !enemy.isNeutralNpc()) {
            return false;
        }

        if (enemy.shopSoldOut) {
            this.ui.addMessage(`${enemy.name}: Thanks.`);
            return true;
        }

        if (!enemy.shopOfferItem) {
            this.generateNpcOffer(enemy);
        }

        if (!enemy.shopOfferItem || !Number.isFinite(enemy.shopOfferPrice)) {
            this.ui.addMessage(`${enemy.name}: I have nothing to sell right now.`);
            return true;
        }

        const itemLabel = typeof enemy.shopOfferItem.getDisplayName === 'function'
            ? enemy.shopOfferItem.getDisplayName()
            : enemy.shopOfferItem.name;
        const price = enemy.shopOfferPrice;
        const confirmed = window.confirm(`${enemy.name} offers ${itemLabel} for ${price} money. Buy it?`);
        if (!confirmed) {
            this.ui.addMessage(`${enemy.name}: Maybe next time.`);
            return true;
        }

        if ((this.player.money || 0) < price) {
            this.ui.addMessage(`${enemy.name}: You don't have enough money.`);
            return true;
        }

        this.player.money -= price;
        this.player.addItem(enemy.shopOfferItem);
        this.ui.addMessage(`You buy ${itemLabel} for ${price} money.`);
        enemy.shopOfferItem = null;
        enemy.shopOfferPrice = null;
        enemy.shopSoldOut = true;
        return true;
    }

    generateNpcOffer(enemy) {
        if (!enemy) {
            return;
        }

        const rng = {
            next: () => Math.random(),
            randomInt: (min, max) => randomInt(min, max)
        };

        let offeredItem = null;
        for (let attempt = 0; attempt < 8; attempt++) {
            const candidate = this.createRandomItemForFloor(rng, this.world.currentFloor);
            if (!candidate) {
                continue;
            }

            if (candidate.type === ITEM_TYPES.MONEY) {
                continue;
            }

            offeredItem = candidate;
            break;
        }

        if (!offeredItem) {
            return;
        }

        enemy.shopOfferItem = offeredItem;
        enemy.shopOfferPrice = randomInt(10, 100) * (this.world.currentFloor + 1);
    }

    playerHasEnchantment(enchantmentKey) {
        if (!enchantmentKey || !(this.player?.equipment instanceof Map)) {
            return false;
        }

        for (const item of this.player.equipment.values()) {
            if (!item || typeof item.getEnchantments !== 'function') {
                continue;
            }

            if (item.getEnchantments().includes(enchantmentKey)) {
                return true;
            }
        }

        return false;
    }

    tryKnockbackEnemy(enemy, fromX, fromY) {
        if (!enemy) {
            return false;
        }

        const pushDx = Math.sign(enemy.x - fromX);
        const pushDy = Math.sign(enemy.y - fromY);
        if (pushDx === 0 && pushDy === 0) {
            return false;
        }

        const targetX = enemy.x + pushDx;
        const targetY = enemy.y + pushDy;

        if (this.player.x === targetX && this.player.y === targetY) {
            return false;
        }

        const occupyingEnemy = this.world.getEnemyAt(targetX, targetY, enemy);
        if (occupyingEnemy) {
            return false;
        }

        if (typeof enemy.canOccupyTile === 'function' && !enemy.canOccupyTile(this.world, targetX, targetY, this.player)) {
            return false;
        }

        enemy.x = targetX;
        enemy.y = targetY;
        return true;
    }

    getAttackOffsetsForFacing(dx, dy) {
        const normalizedDx = Math.sign(Number(dx) || 0);
        const normalizedDy = Math.sign(Number(dy) || 0);
        if (normalizedDx === 0 && normalizedDy === 0) {
            return [];
        }

        const offsets = [{ dx: normalizedDx, dy: normalizedDy }];
        const hasSweepingAttack = this.playerHasEnchantment('sweepingAttack');
        const hasSideAttack = this.playerHasEnchantment('sideAttack');
        const hasBackAttack = this.playerHasEnchantment('backAttack');

        if (hasSweepingAttack) {
            if (normalizedDx === 0) {
                offsets.push({ dx: -1, dy: normalizedDy });
                offsets.push({ dx: 1, dy: normalizedDy });
            } else if (normalizedDy === 0) {
                offsets.push({ dx: normalizedDx, dy: -1 });
                offsets.push({ dx: normalizedDx, dy: 1 });
            } else {
                offsets.push({ dx: normalizedDx, dy: 0 });
                offsets.push({ dx: 0, dy: normalizedDy });
            }
        }

        if (hasSideAttack) {
            offsets.push({ dx: -normalizedDy, dy: normalizedDx });
            offsets.push({ dx: normalizedDy, dy: -normalizedDx });
        }

        if (hasBackAttack) {
            offsets.push({ dx: -normalizedDx, dy: -normalizedDy });
        }

        const uniqueOffsets = [];
        const seenKeys = new Set();
        for (const offset of offsets) {
            const key = `${offset.dx},${offset.dy}`;
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            uniqueOffsets.push(offset);
        }

        return uniqueOffsets;
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

            this.player.tickConditions();

            const thrownItem = this.player.dequeueThrowItem(input.item);
            if (!thrownItem) {
                return false;
            }

            input.item.identify?.();
            thrownItem.identify?.();

            const throwResult = this.resolveThrow(thrownItem, input.dx, input.dy);
            this.announceThrowResult(thrownItem, throwResult);
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

            const offsets = this.getAttackOffsetsForFacing(attackDx, attackDy);
            const hasKnockback = this.playerHasEnchantment('knockback');
            const hasRuinTraps = this.playerHasEnchantment('ruinTraps');
            const executeAttackPass = () => {
                const attackedEnemyKeys = new Set();
                let attackedAnyEnemyInPass = false;
                let revealedAnyTrapInPass = false;
                let ruinedAnyTrapInPass = false;

                for (const offset of offsets) {
                    const targetX = this.player.x + offset.dx;
                    const targetY = this.player.y + offset.dy;

                    if (typeof this.world.getTrap === 'function') {
                        const trapType = this.world.getTrap(targetX, targetY);
                        if (trapType) {
                            if (hasRuinTraps && typeof this.world.removeTrap === 'function') {
                                this.world.removeTrap(targetX, targetY);
                                ruinedAnyTrapInPass = true;
                            } else if (typeof this.world.revealTrap === 'function') {
                                const alreadyRevealed = typeof this.world.isTrapRevealed === 'function'
                                    ? this.world.isTrapRevealed(targetX, targetY)
                                    : false;
                                this.world.revealTrap(targetX, targetY);
                                if (!alreadyRevealed) {
                                    revealedAnyTrapInPass = true;
                                }
                            }
                        }
                    }

                    const enemyOnTarget = this.world.getEnemyAt(targetX, targetY);
                    if (!enemyOnTarget) {
                        continue;
                    }

                    const enemyKey = `${enemyOnTarget.x},${enemyOnTarget.y},${enemyOnTarget.name}`;
                    if (attackedEnemyKeys.has(enemyKey)) {
                        continue;
                    }
                    attackedEnemyKeys.add(enemyKey);

                    attackedAnyEnemyInPass = true;
                    const attackResult = this.player.attackEnemy(enemyOnTarget);
                    const damage = attackResult?.damage || 0;
                    const critical = Boolean(attackResult?.critical);
                    const inflictedConditions = Array.isArray(attackResult?.inflictedConditions)
                        ? attackResult.inflictedConditions
                        : [];
                    const criticalPrefix = critical ? 'Critical! ' : '';
                    this.ui.addMessage(`${criticalPrefix}You attack ${enemyOnTarget.name} for ${damage}.`);

                    for (const condition of inflictedConditions) {
                        this.ui.addMessage(`${enemyOnTarget.name} is ${condition}.`);
                    }

                    if (hasKnockback && damage > 0 && enemyOnTarget.isAlive() && Math.random() < 0.25) {
                        const knockedBack = this.tryKnockbackEnemy(enemyOnTarget, this.player.x, this.player.y);
                        if (knockedBack) {
                            this.ui.addMessage(`${enemyOnTarget.name} is knocked back.`);
                        }
                    }

                    if (!enemyOnTarget.isAlive()) {
                        this.handleEnemyDefeat(enemyOnTarget, { announceDefeat: true });
                    }
                }

                return {
                    attackedAnyEnemyInPass,
                    revealedAnyTrapInPass,
                    ruinedAnyTrapInPass
                };
            };

            const primaryPass = executeAttackPass();
            let attackedAnyEnemy = primaryPass.attackedAnyEnemyInPass;
            let revealedAnyTrap = primaryPass.revealedAnyTrapInPass;
            let ruinedAnyTrap = primaryPass.ruinedAnyTrapInPass;

            const rapidStrikeTriggered = this.playerHasEnchantment('rapidStrike') && Math.random() < 0.25;
            if (rapidStrikeTriggered) {
                this.ui.addMessage('Rapid strike triggers!');
                const extraPass = executeAttackPass();
                attackedAnyEnemy = attackedAnyEnemy || extraPass.attackedAnyEnemyInPass;
                revealedAnyTrap = revealedAnyTrap || extraPass.revealedAnyTrapInPass;
                ruinedAnyTrap = ruinedAnyTrap || extraPass.ruinedAnyTrapInPass;
            }

            if (revealedAnyTrap) {
                this.ui.addMessage('You reveal a hidden trap.');
            }

            if (ruinedAnyTrap) {
                this.ui.addMessage('You destroy a trap with Ruin traps.');
            }

            if (!attackedAnyEnemy) {
                this.ui.addMessage('You swing at empty space.');
            }

            this.clearFailedMoveRecord();
            return true;
        }

        // Pre-turn status tick
        this.player.tickConditions();

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
            const attackResult = this.player.attackEnemy(target);
            const damage = attackResult?.damage || 0;
            const inflictedConditions = Array.isArray(attackResult?.inflictedConditions)
                ? attackResult.inflictedConditions
                : [];
            const criticalPrefix = attackResult?.critical ? 'Critical! ' : '';
            this.ui.addMessage(`${criticalPrefix}You berserk attack ${target.name} for ${damage}.`);
            for (const condition of inflictedConditions) {
                this.ui.addMessage(`${target.name} is ${condition}.`);
            }
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

    getNearbyDropPositions(x, y, maxRadius = 3) {
        const positions = [];
        const seen = new Set();

        for (let radius = 1; radius <= maxRadius; radius++) {
            for (let offsetY = -radius; offsetY <= radius; offsetY++) {
                for (let offsetX = -radius; offsetX <= radius; offsetX++) {
                    if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) {
                        continue;
                    }

                    const px = x + offsetX;
                    const py = y + offsetY;
                    if (px < 0 || px >= GRID_SIZE || py < 0 || py >= GRID_SIZE) {
                        continue;
                    }

                    const key = `${px},${py}`;
                    if (seen.has(key)) {
                        continue;
                    }

                    seen.add(key);
                    positions.push({ x: px, y: py });
                }
            }
        }

        return positions;
    }

    dropItemsNearEnemy(enemy, items) {
        if (!enemy || !Array.isArray(items) || items.length === 0) {
            return [];
        }

        const dropped = [];
        const candidates = this.getNearbyDropPositions(enemy.x, enemy.y, 3);

        for (const item of items) {
            let placed = false;

            for (const candidate of candidates) {
                if (!this.world.canSpawnItemAt(candidate.x, candidate.y, this.player)) {
                    continue;
                }

                const dropResult = this.world.addItem(candidate.x, candidate.y, item);
                if (dropResult?.placed) {
                    dropped.push({ item, x: candidate.x, y: candidate.y, burned: false });
                    placed = true;
                    break;
                }
            }

            if (placed) {
                continue;
            }

            const fallbackResult = this.world.addItem(this.player.x, this.player.y, item);
            if (fallbackResult?.burned) {
                dropped.push({ item, x: this.player.x, y: this.player.y, burned: true });
            } else if (fallbackResult?.placed) {
                dropped.push({ item, x: this.player.x, y: this.player.y, burned: false });
            }
        }

        return dropped;
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
                const isFuser = typeof enemy.hasEnemyType === 'function' && enemy.hasEnemyType(ENEMY_TYPES.FUSER);
                if (isFuser) {
                    if (typeof enemy.canSwallowThrownItems === 'function' && enemy.canSwallowThrownItems()) {
                        const swallowResult = typeof enemy.swallowThrownItem === 'function'
                            ? enemy.swallowThrownItem(item)
                            : null;

                        if (swallowResult) {
                            const ejectedItems = Array.isArray(swallowResult.ejectedItems)
                                ? swallowResult.ejectedItems
                                : [];
                            const ejectedDrops = ejectedItems.length > 0
                                ? this.dropItemsNearEnemy(enemy, ejectedItems)
                                : [];

                            return {
                                type: 'swallowed',
                                enemy,
                                combined: Boolean(swallowResult.combined),
                                mergedEnchantmentCount: Number(swallowResult.mergedEnchantmentCount || 0),
                                storedItem: swallowResult.storedItem || null,
                                ejectedBecauseDifferentTypes: Boolean(swallowResult.ejectedBecauseDifferentTypes),
                                ejectedDrops,
                                x,
                                y
                            };
                        }
                    }

                    const droppedByFuser = this.dropItemsNearEnemy(enemy, [item]);
                    return {
                        type: 'fuser-reject',
                        enemy,
                        drops: droppedByFuser,
                        x,
                        y
                    };
                }

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

    announceThrowResult(item, result) {
        const label = typeof item.getDisplayName === 'function' ? item.getDisplayName() : item.name;
        if (result.type === 'swallowed') {
            this.ui.addMessage(`${result.enemy.name} swallows ${label}.`);
            if (result.ejectedBecauseDifferentTypes) {
                this.ui.addMessage(`${result.enemy.name} cannot fuse different item types and spits both items out.`);
                for (const drop of result.ejectedDrops || []) {
                    const dropName = typeof drop.item?.getDisplayName === 'function'
                        ? drop.item.getDisplayName()
                        : (drop.item?.name || 'item');
                    if (drop.burned) {
                        this.ui.addMessage(`${dropName} burns up in lava.`);
                    } else {
                        this.ui.addMessage(`${dropName} drops at ${drop.x}, ${drop.y}.`);
                    }
                }
                return;
            }

            if (result.combined) {
                if ((result.mergedEnchantmentCount || 0) > 0) {
                    this.ui.addMessage(`${result.enemy.name} fuses the item and gains ${result.mergedEnchantmentCount} enchantment(s).`);
                } else {
                    this.ui.addMessage(`${result.enemy.name} fuses the item, but no new enchantments are gained.`);
                }
            }
        } else if (result.type === 'fuser-reject') {
            this.ui.addMessage(`${result.enemy.name} refuses to swallow more items.`);
            for (const drop of result.drops || []) {
                const dropName = typeof drop.item?.getDisplayName === 'function'
                    ? drop.item.getDisplayName()
                    : (drop.item?.name || label);
                if (drop.burned) {
                    this.ui.addMessage(`${dropName} burns up in lava.`);
                } else {
                    this.ui.addMessage(`${dropName} drops at ${drop.x}, ${drop.y}.`);
                }
            }
        } else if (result.type === 'hit') {
            this.ui.addMessage(`${label} hits ${result.enemy.name}.`);
            if ((result.damage || 0) > 0) {
                this.ui.addMessage(`${result.enemy.name} takes ${result.damage} throw damage.`);
            }
            if ((result.healing || 0) > 0) {
                this.ui.addMessage(`${result.enemy.name} recovers ${result.healing} health from the throw.`);
            }
            this.ui.addMessage(`${label} shatters on impact.`);
            if (result.enemyDefeated) {
                this.ui.addMessage(`${result.enemy.name} is defeated.`);
            }
        } else if (result.type === 'burned') {
            this.ui.addMessage(`${label} burns up in lava.`);
        } else {
            this.ui.addMessage(`${label} lands at ${result.x}, ${result.y}.`);
        }
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
                if (result?.type === 'vandal-pickup-item' && result.pickedUpItem) {
                    const pickedLabel = typeof result.pickedUpItem.getDisplayName === 'function'
                        ? result.pickedUpItem.getDisplayName()
                        : result.pickedUpItem.name;
                    this.ui.addMessage(`${enemy.name} picks up ${pickedLabel}.`);

                    const pickupEffect = result.pickupEffect;
                    if (pickupEffect?.type === 'vandal-downgrade' && pickupEffect.item) {
                        const downgradedLabel = typeof pickupEffect.item.getDisplayName === 'function'
                            ? pickupEffect.item.getDisplayName()
                            : pickupEffect.item.name;
                        this.ui.addMessage(`${enemy.name} degrades it into ${downgradedLabel}.`);
                    } else if (pickupEffect?.type === 'vandal-transform-food' && pickupEffect.item) {
                        const foodLabel = typeof pickupEffect.item.getDisplayName === 'function'
                            ? pickupEffect.item.getDisplayName()
                            : pickupEffect.item.name;
                        this.ui.addMessage(`${enemy.name} turns it into ${foodLabel}.`);
                    } else if (pickupEffect?.type === 'vandal-destroy-item') {
                        this.ui.addMessage(`${enemy.name} destroys the item.`);
                    }
                }
                if (result?.type === 'vandal-dispose-item' && result.item) {
                    const itemLabel = typeof result.item.getDisplayName === 'function'
                        ? result.item.getDisplayName()
                        : result.item.name;
                    const disposalResult = this.world.addItem(result.tile.x, result.tile.y, result.item);
                    if (disposalResult?.burned) {
                        this.ui.addMessage(`${enemy.name} throws ${itemLabel} into lava and it burns up.`);
                    } else if (disposalResult?.placed) {
                        this.ui.addMessage(`${enemy.name} throws ${itemLabel} onto ${result.tile.tile}.`);
                    } else {
                        const fallbackDrop = this.dropItemsNearEnemy(enemy, [result.item]);
                        if (fallbackDrop.length > 0) {
                            const drop = fallbackDrop[0];
                            if (drop.burned) {
                                this.ui.addMessage(`${enemy.name} drops ${itemLabel}, but it burns up in lava.`);
                            } else {
                                this.ui.addMessage(`${enemy.name} drops ${itemLabel} at ${drop.x}, ${drop.y}.`);
                            }
                        }
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

        if (enemy.heldItem) {
            const heldDropResult = this.dropItemsNearEnemy(enemy, [enemy.heldItem]);
            enemy.heldItem = null;
            for (const drop of heldDropResult) {
                const dropName = typeof drop.item?.getDisplayName === 'function'
                    ? drop.item.getDisplayName()
                    : (drop.item?.name || 'item');
                if (drop.burned) {
                    this.ui.addMessage(`${enemy.name} drops ${dropName}, but it burns up in lava.`);
                } else {
                    this.ui.addMessage(`${enemy.name} drops ${dropName}.`);
                }
            }
        }

        const swallowedItems = enemy.swallowedItems instanceof Map
            ? Array.from(enemy.swallowedItems.values())
            : [];
        if (swallowedItems.length > 0) {
            const droppedSwallowedItems = this.dropItemsNearEnemy(enemy, swallowedItems);
            enemy.swallowedItems.clear();

            for (const drop of droppedSwallowedItems) {
                const dropName = typeof drop.item?.getDisplayName === 'function'
                    ? drop.item.getDisplayName()
                    : (drop.item?.name || 'item');
                if (drop.burned) {
                    this.ui.addMessage(`${enemy.name} releases ${dropName}, but it burns up in lava.`);
                } else {
                    this.ui.addMessage(`${enemy.name} releases ${dropName}.`);
                }
            }
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
            if (item.type === ITEM_TYPES.MONEY) {
                const value = this.getValidMoneyValue(item);
                this.player.money = (this.player.money || 0) + value;
                this.world.removeItem(x, y, item);
                pickedNames.push(`${value} money`);
                continue;
            }
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