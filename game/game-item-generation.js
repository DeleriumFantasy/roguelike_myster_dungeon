// Item generation, money valuation, and starter loadout helpers

Object.assign(Game.prototype, {
    isSpawnRolledEquipment(item) {
        return item && [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY].includes(item.type);
    },

    applySpawnImprovementRolls(item, rng = null) {
        if (!this.isSpawnRolledEquipment(item)) {
            return item;
        }

        const improvementRules = typeof getItemSpawnImprovementRules === 'function'
            ? getItemSpawnImprovementRules()
            : null;
        const rollCount = Math.max(0, Math.floor(Number(improvementRules?.rollCount) || 3));
        const chancePerRoll = Math.min(1, Math.max(0, Number(improvementRules?.chancePerRoll) || 0.05));

        let improvementCount = 0;
        for (let rollIndex = 0; rollIndex < rollCount; rollIndex++) {
            if (getRngRoll(rng) < chancePerRoll) {
                improvementCount += 1;
            }
        }

        if (improvementCount <= 0) {
            return item;
        }

        item.properties = item.properties || {};
        item.properties.improvementLevel = Number(item.properties.improvementLevel || 0) + improvementCount;

        if (item.type === ITEM_TYPES.WEAPON) {
            item.properties.power = Number(item.properties.power || 0) + improvementCount;
            item.properties.improvementPowerBonus = Number(item.properties.improvementPowerBonus || 0) + improvementCount;
            return item;
        }

        if (item.type === ITEM_TYPES.ARMOR || item.type === ITEM_TYPES.SHIELD) {
            item.properties.armor = Number(item.properties.armor || 0) + improvementCount;
            item.properties.improvementArmorBonus = Number(item.properties.improvementArmorBonus || 0) + improvementCount;
            return item;
        }

        if (Number(item.properties.power || 0) > 0) {
            item.properties.power = Number(item.properties.power || 0) + improvementCount;
            item.properties.improvementPowerBonus = Number(item.properties.improvementPowerBonus || 0) + improvementCount;
        } else {
            item.properties.armor = Number(item.properties.armor || 0) + improvementCount;
            item.properties.improvementArmorBonus = Number(item.properties.improvementArmorBonus || 0) + improvementCount;
        }

        return item;
    },

    getItemSpawnCountForFloor(floorIndex, rng = null) {
        const displayFloor = clamp(Math.floor(Number(floorIndex) || 0) + 1, 1, 99);
        const countRange = typeof getItemSpawnCountRangeForDisplayFloor === 'function'
            ? getItemSpawnCountRangeForDisplayFloor(displayFloor)
            : { minCount: 1, maxCount: 2 };
        const minCount = Math.max(1, Math.floor(Number(countRange?.minCount) || 1));
        const maxCount = Math.max(minCount, Math.floor(Number(countRange?.maxCount) || minCount));
        return getRngRandomInt(rng, minCount, maxCount);
    },

    spawnItemsForCurrentFloor(rng, floorIndex = this.world.currentFloor) {
        const itemCount = this.getItemSpawnCountForFloor(floorIndex, rng);
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

            const item = chosenEntry.create(rng);
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
            this.applySpawnImprovementRolls(item, rng);
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
        const displayFloor = clamp(Math.floor(Number(floorIndex) || 0) + 1, 1, 99);
        const weightedTiers = typeof getItemTierWeightsForDisplayFloor === 'function'
            ? getItemTierWeightsForDisplayFloor(displayFloor)
            : [{ tier: 1, weight: 1 }];

        const totalWeight = weightedTiers.reduce((sum, entry) => sum + Math.max(1, Math.floor(Number(entry?.weight) || 1)), 0);
        let roll = getRngRoll(rng) * totalWeight;
        for (const entry of weightedTiers) {
            roll -= Math.max(1, Math.floor(Number(entry?.weight) || 1));
            if (roll <= 0) {
                return Math.max(1, Math.floor(Number(entry?.tier) || 1));
            }
        }

        const fallbackEntry = weightedTiers[weightedTiers.length - 1];
        return Math.max(1, Math.floor(Number(fallbackEntry?.tier) || 1));
    },

    rollBoostedRewardTierForFloor(floorIndex, rng) {
        let tier = this.rollItemTierForFloor(floorIndex, rng);
        const boostChances = typeof getItemRewardTierBoostChances === 'function'
            ? getItemRewardTierBoostChances()
            : [0.7, 0.35];

        for (const chance of boostChances) {
            if (tier < 4 && getRngRoll(rng) < Math.min(1, Math.max(0, Number(chance) || 0))) {
                tier += 1;
            }
        }

        return clamp(tier, 1, 4);
    },

    createThrowingChallengeRewardItem(rng, floorIndex = this.world.currentFloor) {
        for (let attempt = 0; attempt < 10; attempt++) {
            const tier = this.rollBoostedRewardTierForFloor(floorIndex, rng);
            const tierEntries = getWeightedItemEntriesForTier(tier);
            const chosenEntry = this.chooseWeightedEntry(rng, tierEntries);
            if (!chosenEntry || typeof chosenEntry.create !== 'function') {
                continue;
            }

            const item = chosenEntry.create(rng);
            if (!item) {
                continue;
            }

            if (item.type === ITEM_TYPES.MONEY) {
                item.properties = item.properties || {};
                item.properties.value = this.computeMoneyValueForFloor(item, floorIndex, rng);
            }

            this.applySpawnImprovementRolls(item, rng);
            applyWorldEnchantmentRoll(item, rng);
            return applyWorldCurseRoll(item, rng);
        }

        return null;
    },

    seedPlayerInventory() {
        return this.equipStartingCheaterLoadout();
    },

    equipStartingCheaterLoadout() {
        const cheaterItems = [
            { slot: ITEM_TYPES.WEAPON, item: createTieredItem('weapon', 0) },
            { slot: ITEM_TYPES.ARMOR, item: createTieredItem('armor', 0) },
            { slot: ITEM_TYPES.SHIELD, item: createTieredItem('shield', 0) },
            { slot: ITEM_TYPES.ACCESSORY, item: createTieredItem('accessory', 0) }
        ];
        let equippedCount = 0;

        for (const entry of cheaterItems) {
            const item = entry?.item;
            if (!item) {
                continue;
            }

            const equippedItem = this.player?.equipment?.get?.(entry.slot) || null;
            if (equippedItem?.name && String(equippedItem.name).startsWith('Cheater ')) {
                continue;
            }

            if (this.player.equipItem(item)) {
                equippedCount += 1;
            }
        }

        return equippedCount;
    }
});
