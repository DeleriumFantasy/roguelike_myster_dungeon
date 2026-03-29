// Enemy carried-item and special item behavior helpers

Object.assign(Enemy.prototype, {
    hasHeldItem() {
        return Boolean(this.heldItem);
    },

    getHeldItem() {
        return this.heldItem;
    },

    setHeldItem(item) {
        this.heldItem = item || null;
        return this.heldItem;
    },

    takeHeldItem() {
        const heldItem = this.heldItem;
        this.heldItem = null;
        return heldItem || null;
    },

    getSwallowedItems() {
        return this.swallowedItems instanceof Map
            ? Array.from(this.swallowedItems.values())
            : [];
    },

    clearSwallowedItems() {
        if (this.swallowedItems instanceof Map) {
            this.swallowedItems.clear();
        }
    },

    collectCarriedItems() {
        const heldItems = this.hasHeldItem()
            ? [this.takeHeldItem()]
            : [];
        const swallowedItems = this.getSwallowedItems();
        this.clearSwallowedItems();

        return {
            heldItems,
            swallowedItems
        };
    },

    getTierFromMonsterType(regex, fallbackTier = 1) {
        const match = String(this.monsterType || '').match(regex);
        const parsedTier = match ? Number(match[1]) : NaN;
        return Number.isFinite(parsedTier) ? Math.max(1, parsedTier) : fallbackTier;
    },

    getVandalTier() {
        return this.getTierFromMonsterType(/vandalTier(\d+)/i, 1);
    },

    getThiefTier() {
        return this.getTierFromMonsterType(/thiefTier(\d+)/i, 1);
    },

    getThiefStealConfig() {
        const tier = Math.max(1, this.getThiefTier());
        return {
            percent: 10 + (tier - 1) * 5,
            max: 1000 + (tier - 1) * 500
        };
    },

    getThiefStealAmount(player) {
        const playerMoney = Math.max(0, Math.floor(Number(player?.money) || 0));
        if (playerMoney <= 0) {
            return 0;
        }

        const stealConfig = this.getThiefStealConfig();
        const scaledAmount = Math.floor(playerMoney * (stealConfig.percent / 100));
        const plannedAmount = Math.max(1, scaledAmount);
        return Math.min(playerMoney, stealConfig.max, plannedAmount);
    },

    tryTeleportToRandomOpenTile(world, player, avoidDamagingTiles, maxAttempts = 200) {
        if (world && typeof world.findRandomTile === 'function') {
            const rng = createMathRng();
            const tile = world.findRandomTile(rng, maxAttempts, (x, y) => this.canOccupyTile(world, x, y, player, { avoidDamagingTiles }));
            if (tile) {
                world.moveEnemy(this, tile.x, tile.y);
                return true;
            }
            return false;
        }

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = randomInt(1, GRID_SIZE - 2);
            const y = randomInt(1, GRID_SIZE - 2);
            if (this.canOccupyTile(world, x, y, player, { avoidDamagingTiles })) {
                world.moveEnemy(this, x, y);
                return true;
            }
        }

        return false;
    },

    tryTeleportAway(world, player = null) {
        return this.tryTeleportToRandomOpenTile(world, player, true)
            || this.tryTeleportToRandomOpenTile(world, player, false);
    },

    createEnemyActionResult(type, details = {}) {
        return {
            type,
            ...details
        };
    },

    applyThiefPanicState() {
        this.addCondition(CONDITIONS.FRIGHTENED, getConditionDuration(CONDITIONS.FRIGHTENED, 10));
        this.speed = ENEMY_SPEEDS.FAST;
    },

    resolveThiefStealAttempt(world, player, stolenAmount) {
        this.applyThiefPanicState();
        const teleported = this.tryTeleportAway(world, player);
        return this.createEnemyActionResult('thief-steal', {
            stolenAmount,
            teleported
        });
    },

    performPlayerAttackOrThiefSteal(world, player) {
        if (!this.isThief()) {
            return this.createAttackPlayerResult(player);
        }

        if (this.hasHeldItem()) {
            return this.resolveThiefStealAttempt(world, player, 0);
        }

        const stolenAmount = this.getThiefStealAmount(player);
        if (stolenAmount > 0) {
            player.money = Math.max(0, (Number(player.money) || 0) - stolenAmount);
            this.addStolenMoneyToHeldItem(stolenAmount);
        }

        return this.resolveThiefStealAttempt(world, player, stolenAmount);
    },

    addStolenMoneyToHeldItem(stolenAmount) {
        const normalizedAmount = Math.max(0, Math.floor(Number(stolenAmount) || 0));
        if (normalizedAmount <= 0) {
            return;
        }

        const heldItem = this.getHeldItem();
        if (heldItem && heldItem.type === ITEM_TYPES.MONEY) {
            const heldProperties = heldItem.properties || {};
            const currentValue = Math.max(0, Math.floor(Number(heldProperties.value) || 0));
            heldProperties.value = currentValue + normalizedAmount;
            heldItem.properties = heldProperties;
            return;
        }

        const moneyItem = createTieredItem('money', 4);
        if (!moneyItem) {
            return;
        }

        moneyItem.properties = moneyItem.properties || {};
        moneyItem.properties.value = normalizedAmount;
        this.setHeldItem(moneyItem);
    },

    getVandalAttackRange() {
        return this.isVandal() ? 4 : 1.5;
    },

    performVandalRangedAttack(world, player) {
        if (!this.isVandal() || !player) {
            return null;
        }

        const thrownRock = createTieredItem('throwable', 2);
        if (!thrownRock) {
            return null;
        }

        const throwDx = Math.sign(player.x - this.x);
        const throwDy = Math.sign(player.y - this.y);
        if (throwDx === 0 && throwDy === 0) {
            return this.createEnemyActionResult('wait');
        }

        return this.createEnemyActionResult('vandal-ranged-attack', {
            item: thrownRock,
            dx: throwDx,
            dy: throwDy
        });
    },

    canSwallowThrownItems() {
        return this.hasEnemyType(ENEMY_TYPES.FUSER) && !this.fuserFusionLocked;
    },

    createSwallowItemClone(item) {
        if (!item) {
            return null;
        }

        return typeof item.createSingleUseClone === 'function'
            ? item.createSingleUseClone()
            : new Item(item.name, item.type, { ...(item.properties || {}) });
    },

    ejectSwallowedItemsExcept(itemType) {
        const ejectedItems = [];
        if (!(this.swallowedItems instanceof Map)) {
            return ejectedItems;
        }

        for (const [storedType, storedItem] of this.swallowedItems.entries()) {
            if (storedType === itemType) {
                continue;
            }

            this.swallowedItems.delete(storedType);
            ejectedItems.push(storedItem);
        }

        return ejectedItems;
    },

    swallowThrownItem(item) {
        if (!item || !this.canSwallowThrownItems()) {
            return null;
        }

        const itemType = item.type;
        if (typeof itemType !== 'string' || itemType.length === 0) {
            return null;
        }

        const incomingItem = this.createSwallowItemClone(item);
        if (!incomingItem) {
            return null;
        }

        const ejectedItems = this.ejectSwallowedItemsExcept(itemType);
        if (ejectedItems.length > 0) {
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
    },

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
});
