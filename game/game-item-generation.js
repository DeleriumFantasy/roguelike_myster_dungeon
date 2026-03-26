// Item generation, money valuation, and starter loadout helpers

Object.assign(Game.prototype, {
    getItemSpawnCountForFloor(floorIndex) {
        return clamp(5 + Math.floor(floorIndex / 3), 5, 14);
    },

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
    },

    spawnPremadeItemsForCurrentFloor(rng, floorIndex = this.world.currentFloor) {
        const floor = this.world.getCurrentFloor();
        const premadeItemSpawns = Array.isArray(floor?.meta?.premadeItemSpawns)
            ? floor.meta.premadeItemSpawns
            : [];

        for (const spawn of premadeItemSpawns) {
            const x = Number(spawn?.x);
            const y = Number(spawn?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue;
            }

            const item = this.createRandomItemForFloor(rng, floorIndex);
            if (!item) {
                continue;
            }

            this.world.addItem(x, y, item);
        }
    },

    createRandomItemForFloor(rng, floorIndex = this.world.currentFloor, options = {}) {
        const { forEnemyDrop = false, dropEnemy = null } = options;

        for (let attempt = 0; attempt < 12; attempt++) {
            const chosenEntry = this.getWeightedItemEntriesForFloor(rng, floorIndex);
            if (!chosenEntry || typeof chosenEntry.create !== 'function') {
                continue;
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
    },

    getMoneyValueRange(item) {
        const minValue = Number(item?.properties?.valueMin);
        const maxValue = Number(item?.properties?.valueMax);

        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
            return { min: 1, max: 1 };
        }

        const safeMin = Math.max(1, Math.floor(Math.min(minValue, maxValue)));
        const safeMax = Math.max(safeMin, Math.floor(Math.max(minValue, maxValue)));
        return { min: safeMin, max: safeMax };
    },

    computeMoneyValueForFloor(item, floorIndex = this.world.currentFloor, rng = null) {
        const floorMultiplier = Math.max(1, Math.floor(Number(floorIndex) + 1));
        const range = this.getMoneyValueRange(item);
        const rolledValue = getRngRandomInt(rng, range.min, range.max);

        return Math.max(1, Math.floor(rolledValue) * floorMultiplier);
    },

    getValidMoneyValue(item) {
        const configuredValue = Number(item?.properties?.value);
        if (Number.isFinite(configuredValue) && configuredValue > 0) {
            return Math.max(1, Math.floor(configuredValue));
        }

        return this.computeMoneyValueForFloor(item, this.getDungeonDepthIndex(), null);
    },

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
    },

    seedPlayerInventory() {
        this.equipStartingCheaterLoadout();

        const starterItems = [
            ...createTieredStarterItems(),
            ...createAllStatusConsumables()
        ];

        starterItems.forEach((item) => this.player.addItem(item));
    },

    equipStartingCheaterLoadout() {
        const cheaterItems = [
            createTieredItem('weapon', 0),
            createTieredItem('armor', 0),
            createTieredItem('shield', 0),
            createTieredItem('accessory', 0)
        ];

        for (const item of cheaterItems) {
            if (!item) {
                continue;
            }

            this.player.equipItem(item);
        }
    }
});
