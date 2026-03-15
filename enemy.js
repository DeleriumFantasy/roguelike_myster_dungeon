// Enemy class
console.log('enemy.js loaded');

class Enemy {
    constructor(x, y, name, aiType, stats = {}) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.monsterType = stats.monsterType || name.toLowerCase();
        this.creatureTypes = this.normalizeCreatureTypes(stats.creatureTypes);
        this.aiType = aiType;
        this.baseAiType = aiType || AI_TYPES.WANDER;
        this.maxHealth = stats.health || 20;
        this.health = this.maxHealth;
        this.power = stats.power || 5;
        this.armor = stats.armor || 0;
        this.exp = stats.exp || 0;
        this.fovRange = stats.fovRange || 10;
        this.tameThreshold = stats.tameThreshold || 4;
        this.speed = this.normalizeSpeed(stats.speed);
        this.actionCharge = typeof stats.actionCharge === 'number' ? Math.max(0, stats.actionCharge) : 0;
        this.conditions = new Map();
        this.aiByStatus = new Map([
            [CONDITIONS.FRIGHTENED, AI_TYPES.FLEE],
            [CONDITIONS.SLEEP, AI_TYPES.GUARD]
        ]);
        this.lastHostilePos = null;
        this.targetX = null;
        this.targetY = null;
        this.isAlly = false;
        this.tamedBy = null;
        this.equipment = new Map();
        this.swallowedItems = new Map();
        this.fuserFusionLocked = false;
        this.heldItem = null;
        this.shopOfferItem = null;
        this.shopOfferPrice = null;
        this.shopSoldOut = false;
        this.lastResolvedAi = this.baseAiType;
    }

    normalizeCreatureTypes(creatureTypes) {
        if (!Array.isArray(creatureTypes) || creatureTypes.length === 0) {
            if (this.monsterType === 'ghost') {
                return [ENEMY_TYPES.GHOST, ENEMY_TYPES.FLOATING];
            }
            return [];
        }

        return [...new Set(creatureTypes.filter((type) => typeof type === 'string'))];
    }

    normalizeSpeed(speed) {
        if (Object.values(ENEMY_SPEEDS).includes(speed)) {
            return speed;
        }

        return ENEMY_SPEEDS.NORMAL;
    }

    hasEnemyType(enemyType) {
        return this.creatureTypes.includes(enemyType);
    }

    isNeutralNpc() {
        return this.hasEnemyType(ENEMY_TYPES.NPC);
    }

    isVandal() {
        return this.hasEnemyType(ENEMY_TYPES.VANDAL);
    }

    isThief() {
        return this.hasEnemyType(ENEMY_TYPES.THIEF);
    }

    isCrafter() {
        return this.hasEnemyType(ENEMY_TYPES.CRAFTER);
    }

    hasHeldItem() {
        return Boolean(this.heldItem);
    }

    getVandalTier() {
        const match = String(this.monsterType || '').match(/vandalTier(\d+)/i);
        const parsedTier = match ? Number(match[1]) : NaN;
        return Number.isFinite(parsedTier) ? parsedTier : 1;
    }

    getThiefTier() {
        const match = String(this.monsterType || '').match(/thiefTier(\d+)/i);
        const parsedTier = match ? Number(match[1]) : NaN;
        return Number.isFinite(parsedTier) ? parsedTier : 1;
    }

    getThiefStealConfig() {
        const tier = Math.max(1, this.getThiefTier());
        return {
            percent: 10 + (tier - 1) * 5,
            max: 1000 + (tier - 1) * 500
        };
    }

    getThiefStealAmount(player) {
        const playerMoney = Math.max(0, Math.floor(Number(player?.money) || 0));
        if (playerMoney <= 0) {
            return 0;
        }

        const stealConfig = this.getThiefStealConfig();
        const scaledAmount = Math.floor(playerMoney * (stealConfig.percent / 100));
        const plannedAmount = Math.max(1, scaledAmount);
        return Math.min(playerMoney, stealConfig.max, plannedAmount);
    }

    tryTeleportAway(world, player = null) {
        for (let attempt = 0; attempt < 200; attempt++) {
            const x = randomInt(1, GRID_SIZE - 2);
            const y = randomInt(1, GRID_SIZE - 2);
            if (!this.canOccupyTile(world, x, y, player, { avoidDamagingTiles: true })) {
                continue;
            }

            this.x = x;
            this.y = y;
            return true;
        }

        for (let attempt = 0; attempt < 200; attempt++) {
            const x = randomInt(1, GRID_SIZE - 2);
            const y = randomInt(1, GRID_SIZE - 2);
            if (!this.canOccupyTile(world, x, y, player, { avoidDamagingTiles: false })) {
                continue;
            }

            this.x = x;
            this.y = y;
            return true;
        }

        return false;
    }

    performPlayerAttackOrThiefSteal(world, player) {
        if (!this.isThief()) {
            const damage = this.attackTarget(player);
            return { type: 'attack-player', damage };
        }

        const stolenAmount = this.getThiefStealAmount(player);
        if (stolenAmount > 0) {
            player.money = Math.max(0, (Number(player.money) || 0) - stolenAmount);
        }

        this.addCondition(CONDITIONS.FRIGHTENED, getConditionDuration(CONDITIONS.FRIGHTENED, 10));
        this.speed = ENEMY_SPEEDS.FAST;
        const teleported = this.tryTeleportAway(world, player);

        return {
            type: 'thief-steal',
            stolenAmount,
            teleported
        };
    }

    getVandalAttackRange() {
        return this.isVandal() ? 4 : 1.5;
    }

    performVandalRangedAttack(world, player) {
        if (!this.isVandal() || !player) {
            return null;
        }

        const thrownRock = createTieredItem('throwable', 2);
        if (!thrownRock) {
            return null;
        }

        const throwImpact = thrownRock.throw(this, player) || { damage: 0, healing: 0 };
        let dropResult = null;
        if (getRngRoll() < 0.2) {
            dropResult = world?.addItem?.(player.x, player.y, thrownRock) || null;
        }

        return {
            type: 'vandal-ranged-attack',
            item: thrownRock,
            damage: throwImpact.damage || 0,
            healing: throwImpact.healing || 0,
            droppedOnPlayerTile: Boolean(dropResult?.placed),
            burnedOnDrop: Boolean(dropResult?.burned)
        };
    }

    canSwallowThrownItems() {
        return this.hasEnemyType(ENEMY_TYPES.FUSER) && !this.fuserFusionLocked;
    }

    swallowThrownItem(item) {
        if (!item || !this.canSwallowThrownItems()) {
            return null;
        }

        const itemType = item.type;
        if (typeof itemType !== 'string' || itemType.length === 0) {
            return null;
        }

        const incomingItem = typeof item.createSingleUseClone === 'function'
            ? item.createSingleUseClone()
            : new Item(item.name, item.type, { ...(item.properties || {}) });

        const differentTypeEntries = Array.from(this.swallowedItems.entries())
            .filter(([storedType]) => storedType !== itemType);
        if (differentTypeEntries.length > 0) {
            const ejectedItems = [];
            for (const [storedType, storedItem] of differentTypeEntries) {
                this.swallowedItems.delete(storedType);
                ejectedItems.push(storedItem);
            }

            ejectedItems.push(incomingItem);
            return {
                combined: false,
                itemType,
                storedItem: null,
                mergedEnchantmentCount: 0,
                ejectedItems,
                ejectedBecauseDifferentTypes: true
            };
        }

        const existingItem = this.swallowedItems.get(itemType);
        if (!existingItem) {
            this.swallowedItems.set(itemType, incomingItem);
            return {
                combined: false,
                itemType,
                storedItem: incomingItem,
                mergedEnchantmentCount: 0,
                ejectedItems: [],
                ejectedBecauseDifferentTypes: false
            };
        }

        const mergedEnchantmentCount = this.mergeEnchantmentsIntoBaseItem(existingItem, incomingItem);
        this.fuserFusionLocked = true;
        return {
            combined: true,
            itemType,
            storedItem: existingItem,
            mergedEnchantmentCount,
            ejectedItems: [],
            ejectedBecauseDifferentTypes: false
        };
    }

    mergeEnchantmentsIntoBaseItem(baseItem, sourceItem) {
        if (!baseItem || !sourceItem) {
            return 0;
        }

        if (!baseItem.properties) {
            baseItem.properties = {};
        }

        const maxEnchantmentCount = Math.max(0, Math.floor(Number(baseItem?.properties?.slots || 0)));
        const baseEnchantments = typeof baseItem.getEnchantments === 'function'
            ? baseItem.getEnchantments()
            : [];
        const sourceEnchantments = typeof sourceItem.getEnchantments === 'function'
            ? sourceItem.getEnchantments()
            : [];

        const mergedEnchantments = maxEnchantmentCount > 0
            ? [...baseEnchantments].slice(0, maxEnchantmentCount)
            : [];
        let mergedCount = 0;
        if (maxEnchantmentCount <= 0) {
            if (baseItem.properties && Object.prototype.hasOwnProperty.call(baseItem.properties, 'enchantments')) {
                delete baseItem.properties.enchantments;
            }
            return 0;
        }

        for (const enchantmentKey of sourceEnchantments) {
            if (mergedEnchantments.length >= maxEnchantmentCount) {
                break;
            }

            if (mergedEnchantments.includes(enchantmentKey)) {
                continue;
            }

            mergedEnchantments.push(enchantmentKey);
            mergedCount += 1;
        }

        if (mergedEnchantments.length > 0) {
            baseItem.properties.enchantments = mergedEnchantments;
        } else if (baseItem.properties && Object.prototype.hasOwnProperty.call(baseItem.properties, 'enchantments')) {
            delete baseItem.properties.enchantments;
        }

        return mergedCount;
    }

    isPariahTarget(enemy) {
        return Boolean(
            enemy
            && enemy !== this
            && typeof enemy.isAlive === 'function'
            && enemy.isAlive()
            && typeof enemy.hasEnemyType === 'function'
            && enemy.hasEnemyType(ENEMY_TYPES.PARIAH)
        );
    }

    canSeeActor(world, actor) {
        if (!actor || typeof actor.isAlive !== 'function' || !actor.isAlive()) {
            return false;
        }

        if (typeof actor.hasCondition === 'function' && actor.hasCondition(CONDITIONS.INVISIBLE)) {
            return false;
        }

        return this.canSeePosition(world, actor.x, actor.y);
    }

    canSeePosition(world, x, y) {
        const distanceToTarget = distance(this.x, this.y, x, y);
        return distanceToTarget <= this.fovRange && this.hasLineOfSight(world, x, y);
    }

    getNearestVisiblePariah(world) {
        let nearest = null;
        let nearestDistance = Infinity;

        for (const enemy of world.getEnemies()) {
            if (!this.isPariahTarget(enemy)) {
                continue;
            }

            if (!this.canSeeActor(world, enemy)) {
                continue;
            }

            const enemyDistance = distance(this.x, this.y, enemy.x, enemy.y);
            if (enemyDistance < nearestDistance) {
                nearest = enemy;
                nearestDistance = enemyDistance;
            }
        }

        return nearest;
    }

    getVisibleHostileTarget(world, player) {
        const pariah = this.getNearestVisiblePariah(world);
        if (pariah) {
            return {
                kind: 'enemy',
                target: pariah,
                x: pariah.x,
                y: pariah.y
            };
        }

        if (this.canSeeActor(world, player)) {
            return {
                kind: 'player',
                target: player,
                x: player.x,
                y: player.y
            };
        }

        return null;
    }

    getNearestBerserkTarget(world, player) {
        let nearest = null;
        let nearestDistance = Infinity;

        const candidates = [];
        if (player && player !== this) {
            candidates.push(player);
        }

        for (const enemy of world.getEnemies()) {
            if (enemy !== this && enemy.isAlive()) {
                if (typeof enemy.isNeutralNpc === 'function' && enemy.isNeutralNpc()) {
                    continue;
                }
                candidates.push(enemy);
            }
        }

        for (const target of candidates) {
            if (!this.canSeeActor(world, target)) {
                continue;
            }

            const targetDistance = distance(this.x, this.y, target.x, target.y);
            if (targetDistance < nearestDistance) {
                nearest = target;
                nearestDistance = targetDistance;
            }
        }

        return nearest;
    }

    getActionsPerPlayerTurn(player) {
        let actionsPerTurn = getEnemySpeedMultiplier(this.speed);

        if (this.conditions.has(CONDITIONS.HASTE)) {
            actionsPerTurn *= 2;
        }

        if (this.conditions.has(CONDITIONS.SLOW)) {
            actionsPerTurn *= 0.5;
        }

        if (player?.hasCondition?.(CONDITIONS.HASTE)) {
            actionsPerTurn *= 0.5;
        }

        if (player?.hasCondition?.(CONDITIONS.SLOW)) {
            actionsPerTurn *= 2;
        }

        return actionsPerTurn;
    }

    consumeActionTurns(player) {
        this.actionCharge += this.getActionsPerPlayerTurn(player);
        const availableActions = Math.floor(this.actionCharge + Number.EPSILON);
        this.actionCharge = Math.max(0, this.actionCharge - availableActions);
        return availableActions;
    }

    takeTurn(world, player, fov) {
        if (this.conditions.has(CONDITIONS.SLEEP)) {
            this.tickConditions();
            this.applyEnvironmentEffects(world);
            return { type: 'sleep' };
        }

        // Pre-turn status tick
        this.tickConditions();

        if (!this.isAlive()) return;

        // Action
        const actionResult = this.performAction(world, player, fov);

        this.applyEnvironmentEffects(world);

        return actionResult;
    }

    tickConditions() {
        for (const [condition, duration] of this.conditions) {
            const tickDamage = getConditionTickDamage(condition, 0);
            if (tickDamage > 0) {
                this.takeDamage(tickDamage);
            }
            if (duration > 1) {
                this.conditions.set(condition, duration - 1);
            } else {
                this.conditions.delete(condition);
            }
        }
    }

    performAction(world, player, fov) {
        if (this.isNeutralNpc()) {
            this.lastResolvedAi = AI_TYPES.WANDER;
            return this.performWanderAction(world, player);
        }

        if (this.conditions.has(CONDITIONS.BLIND)) {
            return this.performBlindAction(world, player);
        }

        if (this.conditions.has(CONDITIONS.BERSERK)) {
            this.lastResolvedAi = 'berserk';
            return this.performBerserkAction(world, player);
        }

        const vandalAction = this.performVandalAction(world, player);
        if (vandalAction) {
            return vandalAction;
        }

        const crafterAction = this.performCrafterAction(world);
        if (crafterAction) {
            return crafterAction;
        }

        const resolvedAi = this.getAiTypeForTurn(world, player, fov);
        this.lastResolvedAi = resolvedAi;

        const methodName = getEnemyAiActionMethod(resolvedAi);
        if (typeof this[methodName] === 'function') {
            return this[methodName](world, player);
        }

        return this.performWanderAction(world, player);
    }

    getAiTypeForTurn(world, player, fov) {
        if (this.isAlly) {
            return AI_TYPES.SUPPORT;
        }

        if (this.isVandal() && this.hasHeldItem() && this.getVandalTier() === 2) {
            return AI_TYPES.FLEE;
        }

        for (const [condition, overrideAi] of this.aiByStatus) {
            if (this.conditions.has(condition)) {
                return overrideAi;
            }
        }

        const visibleHostile = this.getVisibleHostileTarget(world, player);
        if (visibleHostile) {
            this.lastHostilePos = { x: visibleHostile.x, y: visibleHostile.y };
            return AI_TYPES.CHASE;
        }

        // If the enemy recently saw a hostile target, finish investigating the
        // last seen position before returning to its standard AI.
        if (this.lastHostilePos) {
            if (this.x === this.lastHostilePos.x && this.y === this.lastHostilePos.y) {
                this.lastHostilePos = null;
                return this.getStandardAiType();
            }
            return AI_TYPES.CHASE;
        }

        return this.getStandardAiType();
    }

    getStandardAiType() {
        // Placeholder for monster-type based AI tables.
        if (this.hasEnemyType(ENEMY_TYPES.GHOST)) {
            return AI_TYPES.AMBUSH;
        }

        return this.baseAiType;
    }

    canLookThroughWalls() {
        return this.hasEnemyType(ENEMY_TYPES.GHOST);
    }

    canTraverseTile(tile) {
        return canEnemyTypeTraverseTile(tile, this.creatureTypes);
    }

    getNearestVisibleGroundItem(world) {
        if (!world || this.hasHeldItem()) {
            return null;
        }

        let nearest = null;
        let nearestDistance = Infinity;
        for (const [key, items] of world.getCurrentFloor().items.entries()) {
            if (!Array.isArray(items) || items.length === 0) {
                continue;
            }

            const [x, y] = key.split(',').map(Number);
            if (!this.canSeePosition(world, x, y)) {
                continue;
            }

            const itemDistance = distance(this.x, this.y, x, y);
            if (itemDistance < nearestDistance) {
                nearest = { x, y, item: items[0] };
                nearestDistance = itemDistance;
            }
        }

        return nearest;
    }

    getNearestVisibleVandalDisposalTile(world) {
        if (!world || !this.hasHeldItem()) {
            return null;
        }

        let nearest = null;
        let nearestDistance = Infinity;
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const tile = world.getTile(x, y);
                if (tile !== TILE_TYPES.WATER && tile !== TILE_TYPES.LAVA) {
                    continue;
                }

                if (!this.canSeePosition(world, x, y)) {
                    continue;
                }

                const tileDistance = distance(this.x, this.y, x, y);
                if (tileDistance < nearestDistance) {
                    nearest = { x, y, tile };
                    nearestDistance = tileDistance;
                }
            }
        }

        return nearest;
    }

    pickUpGroundItem(world) {
        if (!world || this.hasHeldItem()) {
            return null;
        }

        const items = world.getItems(this.x, this.y);
        if (!Array.isArray(items) || items.length === 0) {
            return null;
        }

        const item = items[0];
        world.removeItem(this.x, this.y, item);
        this.heldItem = item;
        return item;
    }

    applyVandalPickupEffect() {
        if (!this.isVandal() || !this.heldItem) {
            return null;
        }

        const vandalTier = this.getVandalTier();
        if (vandalTier === 2) {
            this.heldItem = createLowerTierVersionOfItem(this.heldItem) || this.heldItem;
            return { type: 'vandal-downgrade', item: this.heldItem };
        }

        if (vandalTier === 3) {
            this.heldItem = createBitterSeedsItemFrom(this.heldItem) || this.heldItem;
            return { type: 'vandal-transform-food', item: this.heldItem };
        }

        if (vandalTier === 4) {
            const destroyedItem = this.heldItem;
            this.heldItem = null;
            return { type: 'vandal-destroy-item', item: destroyedItem };
        }

        return { type: 'vandal-hold-item', item: this.heldItem };
    }

    performVandalAction(world, player) {
        if (!this.isVandal()) {
            return null;
        }

        if (!this.hasHeldItem()) {
            const pickedUpItem = this.pickUpGroundItem(world);
            if (pickedUpItem) {
                const pickupEffect = this.applyVandalPickupEffect();
                return {
                    type: 'vandal-pickup-item',
                    pickedUpItem,
                    pickupEffect
                };
            }

            const visibleItem = this.getNearestVisibleGroundItem(world);
            if (visibleItem) {
                this.targetX = visibleItem.x;
                this.targetY = visibleItem.y;
                return this.tryMoveTowardTarget(world, visibleItem.x, visibleItem.y, player);
            }

            return null;
        }

        if (this.getVandalTier() === 1) {
            const disposalTile = this.getNearestVisibleVandalDisposalTile(world);
            if (disposalTile) {
                const thrownItem = this.heldItem;
                this.heldItem = null;
                return {
                    type: 'vandal-dispose-item',
                    item: thrownItem,
                    tile: disposalTile
                };
            }
        }

        return null;
    }

    performCrafterAction(world) {
        if (!this.isCrafter() || !world || typeof world.getTrap !== 'function') {
            return null;
        }

        if (world.getTrap(this.x, this.y)) {
            return null;
        }

        if (getRngRoll() >= 0.05) {
            return null;
        }

        const trapTypes = getTrapTypes();
        if (!Array.isArray(trapTypes) || trapTypes.length === 0) {
            return null;
        }

        const trapType = trapTypes[randomInt(0, trapTypes.length - 1)];
        const placed = typeof world.setTrap === 'function'
            ? world.setTrap(this.x, this.y, trapType, true)
            : false;

        if (!placed) {
            return null;
        }

        return {
            type: 'crafter-create-trap',
            trapType,
            x: this.x,
            y: this.y
        };
    }

    applyEnvironmentEffects(world) {
        const tile = world.getTile(this.x, this.y);
        const hazard = typeof world.getHazard === 'function' ? world.getHazard(this.x, this.y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        if (tileDamage > 0 && !isEnemyTypeImmuneToTileEffect(tile, this.creatureTypes)) {
            this.takeDamage(tileDamage);
        }

        if (hazardDamage > 0) {
            this.takeDamage(hazardDamage);
        }
    }

    isDamagingPosition(world, x, y) {
        const tile = world.getTile(x, y);
        const hazard = typeof world.getHazard === 'function' ? world.getHazard(x, y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        if (hazardDamage > 0) {
            return true;
        }

        return tileDamage > 0 && !isEnemyTypeImmuneToTileEffect(tile, this.creatureTypes);
    }

    isWithinBounds(x, y) {
        return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
    }

    canOccupyTile(world, x, y, player = null, options = {}) {
        const { avoidDamagingTiles = false } = options;

        if (!this.isWithinBounds(x, y)) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        if (world.getEnemyAt(x, y, this)) {
            return false;
        }

        const tile = world.getTile(x, y);
        if (!this.canTraverseTile(tile)) {
            return false;
        }

        if (avoidDamagingTiles && this.isDamagingPosition(world, x, y)) {
            return false;
        }

        return true;
    }

    performWanderAction(world, player) {
        if (this.targetX === null || (this.x === this.targetX && this.y === this.targetY)) {
            const target = this.getRandomWalkableTarget(world);
            this.targetX = target.x;
            this.targetY = target.y;
        }

        return this.tryMoveTowardTarget(world, this.targetX, this.targetY, player);
    }

    performChaseAction(world, player) {
        const visibleHostile = this.getVisibleHostileTarget(world, player);
        if (visibleHostile) {
            this.lastHostilePos = { x: visibleHostile.x, y: visibleHostile.y };

            const meleeRange = distance(this.x, this.y, visibleHostile.x, visibleHostile.y);
            if (visibleHostile.kind === 'player' && !this.isAlly && this.isVandal() && meleeRange <= this.getVandalAttackRange()) {
                return this.performVandalRangedAttack(world, player);
            }

            if (meleeRange <= 1.5) {
                if (visibleHostile.kind === 'player') {
                    if (!this.isAlly) {
                        return this.performPlayerAttackOrThiefSteal(world, player);
                    }
                    return { type: 'blocked' };
                }

                const damage = this.attackEnemy(visibleHostile.target);
                return {
                    type: 'attack-enemy',
                    damage,
                    target: visibleHostile.target
                };
            }

            return this.tryMoveTowardTarget(world, visibleHostile.x, visibleHostile.y, player);
        }

        if (this.lastHostilePos) {
            const chaseResult = this.tryMoveTowardTarget(world, this.lastHostilePos.x, this.lastHostilePos.y, player);
            if (chaseResult?.type === 'blocked') {
                // If the last known location is unreachable, drop chase state.
                this.lastHostilePos = null;
            }
            return chaseResult;
        }

        return { type: 'wait' };
    }

    performPatrolAction(world, player) {
        // Placeholder: future patrol logic will follow waypoints.
        return this.performWanderAction(world, player);
    }

    performAmbushAction(world, player) {
        const distanceToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distanceToPlayer <= Math.max(1, this.fovRange - 2) && this.hasLineOfSight(world, player.x, player.y)) {
            return this.performChaseAction(world, player);
        }

        return { type: 'wait' };
    }

    performSupportAction(world, player) {
        const distToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distToPlayer > 2) {
            return this.tryMoveTowardTarget(world, player.x, player.y, player);
        }

        return { type: 'wait' };
    }

    performGuardAction(world, player) {
        // Placeholder: guard AI will react to nearby threats once combat exists.
        const distanceToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distanceToPlayer <= 1.5 && this.hasLineOfSight(world, player.x, player.y)) {
            return this.performChaseAction(world, player);
        }

        return { type: 'wait' };
    }

    performBerserkAction(world, player) {
        const target = this.getNearestBerserkTarget(world, player);
        if (!target) {
            return { type: 'wait' };
        }

        const targetDistance = distance(this.x, this.y, target.x, target.y);
        if (target === player && !this.isAlly && this.isVandal() && targetDistance <= this.getVandalAttackRange()) {
            return this.performVandalRangedAttack(world, player);
        }

        if (targetDistance <= 1.5) {
            if (target === player) {
                return this.performPlayerAttackOrThiefSteal(world, player);
            }

            const damage = this.attackEnemy(target);
            return { type: 'attack-enemy', damage, target };
        }

        this.lastHostilePos = { x: target.x, y: target.y };
        return this.tryMoveTowardTarget(world, target.x, target.y, player);
    }

    performBlindAction(world, player) {
        const neighbors = shuffle(getNeighbors(this.x, this.y).slice());

        if (this.conditions.has(CONDITIONS.BOUND)) {
            for (const neighbor of neighbors) {
                if (player && !this.isAlly && neighbor.x === player.x && neighbor.y === player.y) {
                    return this.performPlayerAttackOrThiefSteal(world, player);
                }

                const blockingEnemy = world.getEnemyAt(neighbor.x, neighbor.y, this);
                if (blockingEnemy && !(typeof blockingEnemy.isNeutralNpc === 'function' && blockingEnemy.isNeutralNpc())) {
                    const damage = this.attackEnemy(blockingEnemy);
                    return { type: 'attack-enemy', damage, target: blockingEnemy };
                }
            }

            return { type: 'wait' };
        }

        for (const neighbor of neighbors) {
            if (player && !this.isAlly && neighbor.x === player.x && neighbor.y === player.y) {
                return this.performPlayerAttackOrThiefSteal(world, player);
            }

            const blockingEnemy = world.getEnemyAt(neighbor.x, neighbor.y, this);
            if (blockingEnemy && !(typeof blockingEnemy.isNeutralNpc === 'function' && blockingEnemy.isNeutralNpc())) {
                const damage = this.attackEnemy(blockingEnemy);
                return { type: 'attack-enemy', damage, target: blockingEnemy };
            }

            if (this.canOccupyTile(world, neighbor.x, neighbor.y, player)) {
                this.x = neighbor.x;
                this.y = neighbor.y;
                return { type: 'move' };
            }
        }

        return { type: 'wait' };
    }

    getRandomWalkableTarget(world) {
        if (!world || typeof world.getTile !== 'function') {
            return { x: this.x, y: this.y };
        }

        for (let attempt = 0; attempt < 200; attempt++) {
            const x = randomInt(1, GRID_SIZE - 2);
            const y = randomInt(1, GRID_SIZE - 2);
            if (world.getTile(x, y) !== TILE_TYPES.FLOOR) {
                continue;
            }

            return { x, y };
        }

        return { x: this.x, y: this.y };
    }

    tryMoveTowardTarget(world, targetX, targetY, player = null) {
        if (targetX === null || targetY === null) {
            return false;
        }

        if (this.conditions.has(CONDITIONS.BOUND)) {
            return { type: 'wait' };
        }

        let path = this.findPath(world, targetX, targetY, { avoidDamagingTiles: true });
        if (!path) {
            path = this.findPath(world, targetX, targetY, { avoidDamagingTiles: false });
        }
        if (path && path.length > 1) {
            const next = path[1];

            if (player && next.x === player.x && next.y === player.y) {
                if (!this.isAlly) {
                    return this.performPlayerAttackOrThiefSteal(world, player);
                }
                return { type: 'blocked' };
            }

            if (!this.canOccupyTile(world, next.x, next.y, player, { avoidDamagingTiles: true })
                && !this.canOccupyTile(world, next.x, next.y, player, { avoidDamagingTiles: false })) {
                return { type: 'blocked' };
            }

            this.x = next.x;
            this.y = next.y;
            return { type: 'move' };
        }

        this.targetX = null;
        this.targetY = null;
        return { type: 'blocked' };
    }

    canBeTamed() {
        return this.isAlive() && !this.isAlly && !this.isNeutralNpc();
    }

    getTameThreshold() {
        return this.tameThreshold;
    }

    tame(tamer) {
        this.isAlly = true;
        this.tamedBy = tamer || null;
        this.aiType = AI_TYPES.SUPPORT;
        this.conditions.delete(CONDITIONS.FRIGHTENED);
        if (tamer && typeof tamer.addAlly === 'function') {
            tamer.addAlly(this);
        }
    }

    untame() {
        if (this.tamedBy && typeof this.tamedBy.removeAlly === 'function') {
            this.tamedBy.removeAlly(this);
        }
        this.isAlly = false;
        this.tamedBy = null;
    }

    equipItem(item) {
        if (!this.isAlly || !item) {
            return false;
        }

        const validSlots = Object.values(EQUIPMENT_SLOTS);
        if (!validSlots.includes(item.type)) {
            return false;
        }

        const currentItem = this.equipment.get(item.type);
        const currentItemIsCursed = currentItem
            ? (typeof currentItem.isCursed === 'function'
                ? currentItem.isCursed()
                : Boolean(currentItem.properties?.cursed))
            : false;
        if (currentItem && currentItemIsCursed) {
            return false;
        }

        this.equipment.set(item.type, item);
        return true;
    }

    unequipSlot(slot) {
        const item = this.equipment.get(slot);
        if (!item) {
            return true;
        }

        const isCursed = typeof item.isCursed === 'function'
            ? item.isCursed()
            : Boolean(item.properties?.cursed);
        if (isCursed) {
            return false;
        }

        this.equipment.delete(slot);
        return true;
    }

    flee(world, player) {
        if (this.conditions.has(CONDITIONS.BOUND)) {
            return { type: 'wait' };
        }

        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = distance(this.x, this.y, player.x, player.y);
        if (dist > 0) {
            const dirX = Math.round(dx / dist);
            const dirY = Math.round(dy / dist);
            const newX = this.x + dirX;
            const newY = this.y + dirY;
            if (this.canOccupyTile(world, newX, newY, player)) {
                this.x = newX;
                this.y = newY;
                return { type: 'move' };
            }
        }

        return { type: 'blocked' };
    }

    findPath(world, targetX, targetY, options = {}) {
        const { avoidDamagingTiles = false } = options;
        return findPathAStar(this.x, this.y, targetX, targetY, (nx, ny, isGoal) => {
            if (isGoal) return true;
            if (!this.canOccupyTile(world, nx, ny, null, { avoidDamagingTiles })) return false;
            return true;
        });
    }

    takeDamage(amount, attacker = null) {
        const incomingDamage = Math.max(0, Number(amount) || 0);
        if (incomingDamage <= 0) {
            return 0;
        }

        const mitigationMultiplier = this.getIncomingDamageMultiplierAgainst(attacker);
        const adjustedIncomingDamage = Math.max(1, Math.round(incomingDamage * mitigationMultiplier));
        const damageDealt = applyDamageToActor(this, adjustedIncomingDamage, this.getEffectiveArmor());
        if (this.health <= 0) {
            // Drop items
            // Placeholder
        }
        return damageDealt;
    }

    heal(amount) {
        const value = Math.max(0, amount);
        this.health = Math.min(this.maxHealth, this.health + value);
    }

    getEffectiveArmor() {
        let armor = this.armor;
        for (const item of this.equipment.values()) {
            armor += item.properties?.armor || 0;
            if (typeof item.getEnchantmentArmorBonus === 'function') {
                armor += item.getEnchantmentArmorBonus();
            }
        }
        return armor;
    }

    getIncomingDamageMultiplierAgainst(attacker) {
        let multiplier = 1;
        for (const item of this.equipment.values()) {
            if (typeof item.getIncomingDamageMultiplierFrom === 'function') {
                multiplier *= item.getIncomingDamageMultiplierFrom(attacker);
            }
        }

        return Math.max(0.1, multiplier);
    }

    addCondition(condition, duration = getConditionDuration(condition, 1)) {
        if (this.shouldPreventConditionFromEquipment(condition)) {
            return false;
        }

        actorAddCondition(this, condition, duration);
        return true;
    }

    hasCondition(condition) {
        return actorHasCondition(this, condition);
    }

    onAttacked() {
        actorResolveOnAttackedConditions(this);
    }

    getAttackPower() {
        let basePower = this.power;
        for (const item of this.equipment.values()) {
            if (item.properties?.power) {
                basePower += item.properties.power;
            }
            if (typeof item.getEnchantmentPowerBonus === 'function') {
                basePower += item.getEnchantmentPowerBonus();
            }
        }

        const damageMultiplier = Array.from(this.conditions.keys()).reduce((multiplier, condition) => {
            return multiplier * getConditionDamageMultiplier(condition, 1);
        }, 1);

        if (damageMultiplier !== 1) {
            basePower = Math.max(basePower, Math.round(basePower * damageMultiplier));
        }

        return basePower;
    }

    getAttackPowerAgainst(target) {
        let basePower = this.getAttackPower();
        const weapon = this.equipment.get(EQUIPMENT_SLOTS.WEAPON);
        if (weapon && typeof weapon.getDamageMultiplierAgainst === 'function') {
            basePower = Math.max(1, Math.round(basePower * weapon.getDamageMultiplierAgainst(target)));
        }

        return basePower;
    }

    getWeaponInflictedConditions() {
        const weapon = this.equipment.get(EQUIPMENT_SLOTS.WEAPON);
        if (!weapon || typeof weapon.getOnHitInflictedConditions !== 'function') {
            return [];
        }

        return weapon.getOnHitInflictedConditions(getRngRoll);
    }

    shouldPreventConditionFromEquipment(condition) {
        if (!condition) {
            return false;
        }

        const armor = this.equipment.get(EQUIPMENT_SLOTS.ARMOR);
        if (!armor || typeof armor.getConditionPreventionChance !== 'function') {
            return false;
        }

        const preventionChance = armor.getConditionPreventionChance(condition);
        return preventionChance > 0 && getRngRoll() < preventionChance;
    }

    attackTarget(target) {
        const damage = applyStandardAttackToTarget(target, this.getAttackPowerAgainst(target), Math.random, this);
        if (damage > 0 && target && target.isAlive?.() && typeof target.addCondition === 'function') {
            for (const condition of this.getWeaponInflictedConditions()) {
                target.addCondition(condition, getConditionDuration(condition, 10));
            }
        }

        return damage;
    }

    attackEnemy(targetEnemy) {
        if (!targetEnemy || !targetEnemy.isAlive()) {
            return 0;
        }

        if (typeof targetEnemy.isNeutralNpc === 'function' && targetEnemy.isNeutralNpc()) {
            return 0;
        }

        return this.attackTarget(targetEnemy);
    }

    isAlive() {
        return this.health > 0;
    }

    hasLineOfSight(world, targetX, targetY) {
        // Simple line-of-sight check using Bresenham's line algorithm
        const x0 = this.x, y0 = this.y;
        const x1 = targetX, y1 = targetY;
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0, y = y0;

        while (true) {
            if (!this.isWithinBounds(x, y)) {
                return false;
            }

            if (!this.canLookThroughWalls() && world.getTile(x, y) === TILE_TYPES.WALL) {
                return false;
            }

            if (x === x1 && y === y1) {
                return true;
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

}