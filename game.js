// Main game class

const ENEMY_TEMPLATES = buildEnemyTemplates();

class Game {
    constructor() {
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
        this.pressedMoveKeys = new Set();
        this.pendingMoveTimer = null;
        this.fovCache = null;

        this.setupEventListeners();
        this.initializeGame();
    }

    initializeGame() {
        this.populateCurrentFloorIfNeeded();
        this.spawnPlayerOnFloor();
        this.seedPlayerInventory();
        this.spawnStartingAlly();

        this.updateFOV();
        this.ui.render(this.world, this.player, this.fov);
    }

    getDungeonDepthIndex(floorIndex = this.world.currentFloor) {
        return Math.max(0, Number(floorIndex) - 1);
    }

    isOverworldFloor(floorIndex = this.world.currentFloor) {
        return this.world.getAreaType(floorIndex) === AREA_TYPES.OVERWORLD;
    }

    getDisplayFloorLabel(floorIndex = this.world.currentFloor) {
        return this.isOverworldFloor(floorIndex) ? 'Overworld' : String(Math.max(1, floorIndex));
    }

    assignActorPosition(actor, position) {
        actor.x = position.x;
        actor.y = position.y;
    }

    addEnemyIfMissing(enemy) {
        if (!this.world.getEnemies().includes(enemy)) {
            this.world.addEnemy(enemy);
        }
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
    }

    spawnAlliesOnCurrentFloor() {
        const rng = new SeededRNG(this.seed + this.world.currentFloor * 31337);
        for (const ally of this.player.allies) {
            if (!ally.isAlive()) continue;

            const spawn = this.findSpawnNearPlayer(ally, rng);
            this.assignActorPosition(ally, spawn);
            this.addEnemyIfMissing(ally);
        }
    }

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
                return candidates[rng.randomInt(0, candidates.length - 1)];
            }
        }
        const fallback = this.world.findRandomOpenTile(rng, this.player, 200, enemy);
        return fallback || { x: this.player.x, y: this.player.y };
    }

    populateCurrentFloorIfNeeded() {
        const floor = this.world.getCurrentFloor();
        if (floor.meta?.contentSpawned) {
            return;
        }

        const floorIndex = this.world.currentFloor;
        const rng = this.getFloorContentRng(floorIndex);
        if (this.isOverworldFloor(floorIndex)) {
            this.spawnOverworldNpcs(rng);
        } else {
            const dungeonDepthIndex = this.getDungeonDepthIndex(floorIndex);
            this.spawnEnemiesForCurrentFloor(rng, dungeonDepthIndex);
            this.spawnItemsForCurrentFloor(rng, dungeonDepthIndex);
        }

        floor.meta = floor.meta || {};
        floor.meta.contentSpawned = true;
    }

    spawnOverworldNpcs(rng) {
        const npcCount = 3;
        for (let index = 0; index < npcCount; index++) {
            const npc = this.createEnemyForType(0, 0, 'npcTier1', 0);
            const spawn = this.world.findRandomOpenTile(rng, this.player, 200, npc);
            if (!spawn) {
                continue;
            }

            this.assignActorPosition(npc, spawn);
            this.addEnemyIfMissing(npc);
        }
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
                continue;
            }
            this.assignActorPosition(enemy, spawn);
            this.addEnemyIfMissing(enemy);
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

        let roll = getRngRoll(rng) * totalWeight;
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

    getNextEnemyTierTypeKey(monsterType) {
        const typeKey = String(monsterType || '');
        const tierMatch = typeKey.match(/^(.*Tier)(\d+)$/i);
        if (!tierMatch) {
            return null;
        }

        const baseKey = tierMatch[1];
        const currentTier = Number(tierMatch[2]);
        if (!Number.isFinite(currentTier) || currentTier < 1) {
            return null;
        }

        const nextTierKey = `${baseKey}${currentTier + 1}`;
        return ENEMY_TEMPLATES[nextTierKey] ? nextTierKey : null;
    }

    tryPromoteEnemyAfterKill(enemy) {
        if (!enemy || typeof enemy.isAlive !== 'function' || !enemy.isAlive()) {
            return null;
        }

        const nextTierTypeKey = this.getNextEnemyTierTypeKey(enemy.monsterType);
        if (!nextTierTypeKey) {
            return null;
        }

        const currentHealth = Math.max(0, Math.floor(Number(enemy.health) || 0));
        const promotedEnemy = this.createEnemyForType(enemy.x, enemy.y, nextTierTypeKey, this.getDungeonDepthIndex());

        enemy.name = promotedEnemy.name;
        enemy.monsterType = promotedEnemy.monsterType;
        enemy.creatureTypes = [...promotedEnemy.creatureTypes];
        if (!enemy.isAlly) {
            enemy.aiType = promotedEnemy.aiType;
            enemy.baseAiType = promotedEnemy.baseAiType;
        }
        enemy.maxHealth = promotedEnemy.maxHealth;
        enemy.power = promotedEnemy.power;
        enemy.armor = promotedEnemy.armor;
        enemy.exp = promotedEnemy.exp;
        enemy.fovRange = promotedEnemy.fovRange;
        enemy.tameThreshold = promotedEnemy.tameThreshold;
        enemy.speed = promotedEnemy.speed;

        const healthGain = Math.floor(enemy.maxHealth / 2);
        enemy.health = Math.min(enemy.maxHealth, currentHealth + healthGain);

        return {
            newName: enemy.name,
            newTierTypeKey: nextTierTypeKey,
            healthGain
        };
    }

    spawnItemsForCurrentFloor(rng, floorIndex = this.world.currentFloor) {
        const itemCount = this.getItemSpawnCountForFloor(floorIndex);
        for (let i = 0; i < itemCount; i++) {
            const spawn = this.world.findRandomItemSpawnTile(rng, this.player);
            if (!spawn) {
                continue;
            }

            const item = this.createRandomItemForFloor(rng, floorIndex);
            if (!item) {
                continue;
            }
            this.world.addItem(spawn.x, spawn.y, item);
        }
    }

    createRandomItemForFloor(rng, floorIndex = this.world.currentFloor, options = {}) {
        const { forEnemyDrop = false, dropEnemy = null } = options;

        for (let attempt = 0; attempt < 12; attempt++) {
            const tier = this.rollItemTierForFloor(floorIndex, rng);
            const tierEntries = getWeightedItemEntriesForTier(tier);
            const chosenEntry = this.chooseWeightedEntry(rng, tierEntries);
            if (!chosenEntry || typeof chosenEntry.create !== 'function') {
                return null;
            }

            const item = chosenEntry.create();
            if (!item) {
                continue;
            }

            if (typeof isEnemyDropRestrictedItem === 'function' && isEnemyDropRestrictedItem(item)) {
                if (!forEnemyDrop) {
                    continue;
                }

                if (typeof canEnemyDropItem === 'function' && !canEnemyDropItem(item, dropEnemy)) {
                    continue;
                }
            }

            if (item.type === ITEM_TYPES.MONEY) {
                item.properties = item.properties || {};
                item.properties.value = this.computeMoneyValueForFloor(item, floorIndex, rng);
            }
            applyWorldEnchantmentRoll(item, rng);
            return applyWorldCurseRoll(item, rng);
        }

        return null;
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
        const rolledValue = getRngRandomInt(rng, range.min, range.max);

        return Math.max(1, Math.floor(rolledValue) * floorMultiplier);
    }

    getValidMoneyValue(item) {
        const configuredValue = Number(item?.properties?.value);
        if (Number.isFinite(configuredValue) && configuredValue > 0) {
            return Math.max(1, Math.floor(configuredValue));
        }

        return this.computeMoneyValueForFloor(item, this.getDungeonDepthIndex(), null);
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

        const itemLabel = getItemLabel(enemy.shopOfferItem);
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

        const rng = createMathRng();

        let offeredItem = null;
        for (let attempt = 0; attempt < 8; attempt++) {
            const candidate = this.createRandomItemForFloor(rng, this.getDungeonDepthIndex());
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
        enemy.shopOfferPrice = randomInt(10, 100) * Math.max(1, this.world.currentFloor);
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

        const facing = getActorFacing(this.player);

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
        this.player.applyPerTurnRegen();

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
                 this.player.tickConditions();
                this.ui.addMessage('You are bound and cannot move.');
                 this.clearFailedMoveRecord();
                 return true;
            }

            const targetX = this.player.x + input.dx;
            const targetY = this.player.y + input.dy;

            const allyAtTarget = this.world.getEnemyAt(targetX, targetY);
            if (allyAtTarget && allyAtTarget.isAlly) {
                // Pre-turn status tick
                this.player.tickConditions();

                const prevPlayerX = this.player.x;
                const prevPlayerY = this.player.y;
                allyAtTarget.x = prevPlayerX;
                allyAtTarget.y = prevPlayerY;
                this.player.x = targetX;
                this.player.y = targetY;
                this.clearFailedMoveRecord();
                this.pickupItemsAfterMove(targetX, targetY);
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
                    const { damage, critical, inflictedConditions } = this.extractAttackResultData(attackResult);
                    const criticalPrefix = critical ? 'Critical! ' : '';
                    this.ui.addMessage(`${criticalPrefix}You attack ${enemyOnTarget.name} for ${damage}.`);
                    this.announceInflictedConditions(enemyOnTarget.name, inflictedConditions);

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
            const { damage, critical, inflictedConditions } = this.extractAttackResultData(attackResult);
            const criticalPrefix = critical ? 'Critical! ' : '';
            this.ui.addMessage(`${criticalPrefix}You berserk attack ${target.name} for ${damage}.`);
            this.announceInflictedConditions(target.name, inflictedConditions);
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

    isFoodItemForTaming(item) {
        if (!item) {
            return false;
        }

        const tierMatch = typeof getTieredItemMatch === 'function'
            ? getTieredItemMatch(item)
            : null;

        if (tierMatch?.category === 'food') {
            return true;
        }

        // Allow custom food-like items that restore hunger.
        return Number(item?.properties?.hunger || 0) > 0;
    }

    getItemTierForTaming(item) {
        const tierMatch = typeof getTieredItemMatch === 'function'
            ? getTieredItemMatch(item)
            : null;
        const tier = Number(tierMatch?.tier);
        return Number.isFinite(tier) ? clamp(tier, 1, 4) : 1;
    }

    calculateThrownFoodTameChance(enemy, item, enemyHealthBeforeThrow) {
        const rules = THROW_FOOD_TAMING_RULES;
        const threshold = Math.max(1, Number(enemy?.getTameThreshold?.() ?? enemy?.tameThreshold ?? 1));
        const maxHealth = Math.max(1, Number(enemy?.maxHealth || 1));
        const currentHealth = clamp(Number(enemyHealthBeforeThrow) || 0, 0, maxHealth);
        const missingHealthRatio = 1 - (currentHealth / maxHealth);
        const itemTier = this.getItemTierForTaming(item);
        const playerLevel = Math.max(1, Number(this.player?.level || 1));

        const thresholdPenalty = Math.max(0, threshold - rules.thresholdBaseline) * rules.thresholdPenaltyPerPoint;
        const lowHpBonus = missingHealthRatio * rules.lowHpBonusScale;
        const itemTierBonus = Math.max(0, itemTier - 1) * rules.itemTierBonusPerTier;
        const playerLevelBonus = Math.min(rules.playerLevelBonusCap, Math.max(0, playerLevel - 1) * rules.playerLevelBonusPerLevel);

        const chance = rules.baseChance - thresholdPenalty + lowHpBonus + itemTierBonus + playerLevelBonus;
        return chance;
    }

    tryTameEnemyWithThrownFood(enemy, item, enemyHealthBeforeThrow) {
        if (!enemy || !enemy.canBeTamed?.() || !this.isFoodItemForTaming(item)) {
            return { attempted: false, chance: 0, succeeded: false };
        }

        const chance = this.calculateThrownFoodTameChance(enemy, item, enemyHealthBeforeThrow);
        const succeeded = getRngRoll() < chance;
        if (succeeded) {
            enemy.tame(this.player);
        }

        return {
            attempted: true,
            chance,
            succeeded
        };
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

                const enemyHealthBeforeThrow = Number(enemy.health || 0);
                const throwImpact = item.throw(this.player, enemy) || { damage: 0, healing: 0 };
                const enemyDefeated = !enemy.isAlive();
                const tameRoll = enemyDefeated
                    ? { attempted: false, chance: 0, succeeded: false }
                    : this.tryTameEnemyWithThrownFood(enemy, item, enemyHealthBeforeThrow);
                if (enemyDefeated) {
                    this.handleEnemyDefeat(enemy, { announceDefeat: false });
                }

                return {
                    type: 'hit',
                    enemy,
                    enemyDefeated,
                    damage: throwImpact.damage || 0,
                    healing: throwImpact.healing || 0,
                    tameAttempted: tameRoll.attempted,
                    tameChance: tameRoll.chance,
                    tameSucceeded: tameRoll.succeeded,
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

    announceCombatHit(attackerName, targetName, damage) {
        this.ui.addMessage(`${attackerName} hits ${targetName} for ${damage}.`);
    }

    extractAttackResultData(attackResult) {
        return {
            damage: attackResult?.damage || 0,
            critical: Boolean(attackResult?.critical),
            inflictedConditions: Array.isArray(attackResult?.inflictedConditions)
                ? attackResult.inflictedConditions
                : []
        };
    }

    announceInflictedConditions(targetName, inflictedConditions) {
        for (const condition of inflictedConditions) {
            this.ui.addMessage(`${targetName} is ${condition}.`);
        }
    }

    announceSimpleDropOutcome(drop, itemLabel) {
        if (!drop) {
            return;
        }

        if (drop.burned) {
            this.ui.addMessage(`${itemLabel} burns up in lava.`);
            return;
        }

        this.ui.addMessage(`${itemLabel} drops at ${drop.x}, ${drop.y}.`);
    }

    announceSimpleDropList(drops, fallbackLabel = 'item') {
        for (const drop of drops || []) {
            const dropName = getItemLabel(drop.item, fallbackLabel);
            this.announceSimpleDropOutcome(drop, dropName);
        }
    }

    announceActorItemDisposition(actorName, action, itemLabel, drop, options = {}) {
        const { includeCoordinates = false, burnedSuffix = 'it burns up in lava.' } = options;
        if (!drop) {
            return;
        }

        if (drop.burned) {
            this.ui.addMessage(`${actorName} ${action} ${itemLabel}, but ${burnedSuffix}`);
            return;
        }

        if (includeCoordinates) {
            this.ui.addMessage(`${actorName} ${action} ${itemLabel} at ${drop.x}, ${drop.y}.`);
            return;
        }

        this.ui.addMessage(`${actorName} ${action} ${itemLabel}.`);
    }

    announceActorDropList(actorName, action, drops, options = {}) {
        for (const drop of drops || []) {
            const dropName = getItemLabel(drop.item, 'item');
            this.announceActorItemDisposition(actorName, action, dropName, drop, options);
        }
    }

    announceThrowHitOutcome(itemLabel, result) {
        this.ui.addMessage(`${itemLabel} hits ${result.enemy.name}.`);
        if ((result.damage || 0) > 0) {
            this.ui.addMessage(`${result.enemy.name} takes ${result.damage} throw damage.`);
        }
        if ((result.healing || 0) > 0) {
            this.ui.addMessage(`${result.enemy.name} recovers ${result.healing} health from the throw.`);
        }
        if (result.tameSucceeded) {
            this.ui.addMessage(`${result.enemy.name} has been tamed and is now your ally.`);
        } else if (result.tameAttempted) {
            this.ui.addMessage(`${result.enemy.name} resists the taming attempt.`);
        }
        this.ui.addMessage(`${itemLabel} shatters on impact.`);
        if (result.enemyDefeated) {
            this.ui.addMessage(`${result.enemy.name} is defeated.`);
        }
    }

    getVandalPickupEffectMessage(enemyName, pickupEffect) {
        if (!pickupEffect || typeof pickupEffect.type !== 'string') {
            return null;
        }

        const effectMessageBuilders = {
            'vandal-downgrade': (effect) => {
                if (!effect.item) {
                    return null;
                }

                const itemLabel = getItemLabel(effect.item);
                return `${enemyName} degrades it into ${itemLabel}.`;
            },
            'vandal-transform-food': (effect) => {
                if (!effect.item) {
                    return null;
                }

                const itemLabel = getItemLabel(effect.item);
                return `${enemyName} turns it into ${itemLabel}.`;
            },
            'vandal-destroy-item': () => `${enemyName} destroys the item.`
        };

        const messageBuilder = effectMessageBuilders[pickupEffect.type];
        return typeof messageBuilder === 'function' ? messageBuilder(pickupEffect) : null;
    }

    announceVandalPickupEvent(enemyName, pickedUpItem, pickupEffect) {
        const pickedLabel = getItemLabel(pickedUpItem);
        this.ui.addMessage(`${enemyName} picks up ${pickedLabel}.`);

        const effectMessage = this.getVandalPickupEffectMessage(enemyName, pickupEffect);
        if (effectMessage) {
            this.ui.addMessage(effectMessage);
        }
    }

    announceThiefStealEvent(enemyName, stolenAmount, teleported) {
        if (stolenAmount > 0) {
            this.ui.addMessage(`${enemyName} steals ${stolenAmount} money from you!`);
        } else {
            this.ui.addMessage(`${enemyName} tries to steal from you, but you have no money.`);
        }

        if (teleported) {
            this.ui.addMessage(`${enemyName} teleports away in panic.`);
        } else {
            this.ui.addMessage(`${enemyName} panics and tries to flee.`);
        }
    }

    announceVandalRangedAttackEvent(enemyName, result) {
        const rockLabel = getItemLabel(result?.item, 'Sharp rock');
        this.ui.addMessage(`${enemyName} throws ${rockLabel} at you.`);
        this.ui.addMessage(`${enemyName} hits you for ${result?.damage || 0}.`);

        if (result?.burnedOnDrop) {
            this.ui.addMessage(`${rockLabel} burns up before it can land.`);
        } else if (result?.droppedOnPlayerTile) {
            this.ui.addMessage(`${rockLabel} lands on your tile instead of shattering.`);
        } else {
            this.ui.addMessage(`${rockLabel} shatters on impact.`);
        }
    }

    getGuaranteedEnemyDrops(enemy) {
        if (!enemy) {
            return [];
        }

        const enemyTemplate = ENEMY_TEMPLATES[enemy.monsterType] || null;
        const guaranteedMoneyDrop = Math.max(0, Math.floor(Number(enemyTemplate?.guaranteedMoneyDrop) || 0));
        if (guaranteedMoneyDrop <= 0) {
            return [];
        }

        const moneyItem = createTieredItem('money', 4);
        if (!moneyItem) {
            return [];
        }

        moneyItem.properties = moneyItem.properties || {};
        moneyItem.properties.value = guaranteedMoneyDrop;
        return [moneyItem];
    }

    announceThrowResult(item, result) {
        const label = getItemLabel(item);
        if (result.type === 'swallowed') {
            this.ui.addMessage(`${result.enemy.name} swallows ${label}.`);
            if (result.ejectedBecauseDifferentTypes) {
                this.ui.addMessage(`${result.enemy.name} cannot fuse different item types and spits both items out.`);
                this.announceSimpleDropList(result.ejectedDrops, 'item');
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
            this.announceSimpleDropList(result.drops, label);
        } else if (result.type === 'hit') {
            this.announceThrowHitOutcome(label, result);
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
                const result = enemy.takeTurn(this.world, this.player);

                if (!enemy.isAlive()) {
                    this.handleEnemyDefeat(enemy, { announceDefeat: true });
                    break;
                }

                if (!this.handleEnemyActionResult(enemy, result)) {
                    return;
                }
            }
        }
    }

    handleEnemyActionResult(enemy, result) {
        if (!result || !result.type) {
            return this.player.isAlive();
        }

        if (result.type === 'attack-player') {
            this.announceCombatHit(enemy.name, 'you', result.damage);
        }

        if (result.type === 'vandal-ranged-attack') {
            this.announceVandalRangedAttackEvent(enemy.name, result);
        }

        if (result.type === 'thief-steal') {
            this.announceThiefStealEvent(enemy.name, result.stolenAmount || 0, Boolean(result.teleported));
        }

        if (result.type === 'attack-enemy' && result.target) {
            this.announceCombatHit(enemy.name, result.target.name, result.damage);
            if (!result.target.isAlive()) {
                this.handleEnemyDefeat(result.target, { announceDefeat: true, grantExp: false });
                if (!enemy.isAlly) {
                    const promotionResult = this.tryPromoteEnemyAfterKill(enemy);
                    if (promotionResult) {
                        this.ui.addMessage(`${enemy.name} grows stronger and becomes ${promotionResult.newName}.`);
                        if (promotionResult.healthGain > 0) {
                            this.ui.addMessage(`${enemy.name} gains ${promotionResult.healthGain} HP from evolving.`);
                        }
                    }
                }
            }
        }

        if (result.type === 'vandal-pickup-item' && result.pickedUpItem) {
            this.announceVandalPickupEvent(enemy.name, result.pickedUpItem, result.pickupEffect);
        }

        if (result.type === 'vandal-dispose-item' && result.item) {
            const itemLabel = getItemLabel(result.item);
            const disposalResult = this.world.addItem(result.tile.x, result.tile.y, result.item);
            if (disposalResult?.burned) {
                this.ui.addMessage(`${enemy.name} throws ${itemLabel} into lava and it burns up.`);
            } else if (disposalResult?.placed) {
                this.ui.addMessage(`${enemy.name} throws ${itemLabel} onto ${result.tile.tile}.`);
            } else {
                const fallbackDrop = this.dropItemsNearEnemy(enemy, [result.item]);
                if (fallbackDrop.length > 0) {
                    const drop = fallbackDrop[0];
                    this.announceActorItemDisposition(enemy.name, 'drops', itemLabel, drop, { includeCoordinates: true });
                }
            }
        }

        return this.player.isAlive();
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
            this.announceActorDropList(enemy.name, 'drops', heldDropResult);
        }

        const swallowedItems = enemy.swallowedItems instanceof Map
            ? Array.from(enemy.swallowedItems.values())
            : [];
        if (swallowedItems.length > 0) {
            const droppedSwallowedItems = this.dropItemsNearEnemy(enemy, swallowedItems);
            enemy.swallowedItems.clear();
            this.announceActorDropList(enemy.name, 'releases', droppedSwallowedItems);
        }

        const guaranteedDrops = this.getGuaranteedEnemyDrops(enemy);
        if (guaranteedDrops.length > 0) {
            const guaranteedDropResults = this.dropItemsNearEnemy(enemy, guaranteedDrops);
            this.announceActorDropList(enemy.name, 'drops', guaranteedDropResults);
        }

        const droppedItem = this.rollEnemyDrop(enemy);
        if (droppedItem) {
            const dropName = getItemLabel(droppedItem);
            const dropResult = this.world.addItem(enemy.x, enemy.y, droppedItem);
            this.announceActorItemDisposition(enemy.name, 'dropped', dropName, {
                burned: Boolean(dropResult?.burned),
                x: enemy.x,
                y: enemy.y,
                burnedSuffix: 'it burned in lava.'
            });
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

        const dropChance = Math.min(0.85, 0.35 + this.getDungeonDepthIndex() * 0.05);
        if (getRngRoll() >= dropChance) {
            return null;
        }

        const rng = createMathRng();

        return this.createRandomItemForFloor(rng, this.getDungeonDepthIndex(), { forEnemyDrop: true, dropEnemy: enemy });
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
            const itemName = getItemLabel(item);
            pickedNames.push(itemName);
        }

        return {
            count: pickedNames.length,
            names: pickedNames
        };
    }

    worldAdvance() {
        const activatedSteam = this.world.advanceHazards();
        const playerKey = toGridKey(this.player.x, this.player.y);
        const steamRule = getHazardEffectRule(HAZARD_TYPES.STEAM);
        if (activatedSteam.includes(playerKey)) {
            this.player.takeDamage(getEnvironmentalDamageForHazard(HAZARD_TYPES.STEAM, 0), null, { armorEffectiveness: 0.5 });
            if (steamRule?.message) {
                this.ui.addMessage(steamRule.message);
            }
        }

        for (const enemy of [...this.world.getEnemies()]) {
            const enemyKey = toGridKey(enemy.x, enemy.y);
            if (!activatedSteam.includes(enemyKey)) {
                continue;
            }

            enemy.takeDamage(getEnvironmentalDamageForHazard(HAZARD_TYPES.STEAM, 0), null, { armorEffectiveness: 0.5 });
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

    updateFOV() {
        this.fov = this.world.getCurrentFloor().fov;

        const currentState = {
            floor: this.world.currentFloor,
            x: this.player.x,
            y: this.player.y,
            overworld: this.isOverworldFloor()
        };

        if (this.fovCache
            && this.fovCache.floor === currentState.floor
            && this.fovCache.x === currentState.x
            && this.fovCache.y === currentState.y
            && this.fovCache.overworld === currentState.overworld) {
            return;
        }

        this.fov.compute(this.player.x, this.player.y, FOV_RANGE);
        if (this.isOverworldFloor() && typeof this.fov.showAll === 'function') {
            this.fov.showAll();
        }

        this.fovCache = currentState;
    }
}

// Start the game when the page loads
let game;
window.onload = () => {
    game = new Game();
};