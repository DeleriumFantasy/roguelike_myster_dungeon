// Item creation and transformation helpers

function applyConfiguredSpawnImprovements(item, rng = null) {
    if (!item || !item.properties) {
        return item;
    }

    const minImprovement = Number(item.properties.spawnImprovementMin);
    const maxImprovement = Number(item.properties.spawnImprovementMax);
    delete item.properties.spawnImprovementMin;
    delete item.properties.spawnImprovementMax;

    if (!Number.isFinite(minImprovement) || !Number.isFinite(maxImprovement) || maxImprovement <= 0) {
        return item;
    }

    const safeMin = Math.max(0, Math.floor(Math.min(minImprovement, maxImprovement)));
    const safeMax = Math.max(safeMin, Math.floor(Math.max(minImprovement, maxImprovement)));
    const improvementCount = getRngRandomInt(rng, safeMin, safeMax);
    if (improvementCount <= 0) {
        return item;
    }

    item.properties.improvementLevel = Number(item.properties.improvementLevel || 0) + improvementCount;

    if (item.type === ITEM_TYPES.WEAPON) {
        item.properties.power = Number(item.properties.power || 0) + improvementCount;
        item.properties.improvementPowerBonus = Number(item.properties.improvementPowerBonus || 0) + improvementCount;
    } else if (item.type === ITEM_TYPES.ARMOR || item.type === ITEM_TYPES.SHIELD) {
        item.properties.armor = Number(item.properties.armor || 0) + improvementCount;
        item.properties.improvementArmorBonus = Number(item.properties.improvementArmorBonus || 0) + improvementCount;
    } else if (item.type === ITEM_TYPES.ACCESSORY) {
        if (Number(item.properties.power || 0) > 0) {
            item.properties.power = Number(item.properties.power || 0) + improvementCount;
            item.properties.improvementPowerBonus = Number(item.properties.improvementPowerBonus || 0) + improvementCount;
        } else {
            item.properties.armor = Number(item.properties.armor || 0) + improvementCount;
            item.properties.improvementArmorBonus = Number(item.properties.improvementArmorBonus || 0) + improvementCount;
        }
    }

    return item;
}

function applyConfiguredPotCapacity(item, rng = null) {
    if (!item?.isPotItem?.()) {
        return item;
    }

    item.properties = item.properties || {};
    const existingCapacity = Number(item.properties.potCapacity);
    if (Number.isFinite(existingCapacity) && existingCapacity > 0) {
        return item;
    }

    const minCapacity = Number(item.properties.minCapacity);
    const maxCapacity = Number(item.properties.maxCapacity);
    const safeMin = Number.isFinite(minCapacity) && minCapacity > 0
        ? Math.floor(minCapacity)
        : 1;
    const safeMax = Number.isFinite(maxCapacity) && maxCapacity > 0
        ? Math.max(safeMin, Math.floor(maxCapacity))
        : safeMin;

    item.properties.potCapacity = getRngRandomInt(rng, safeMin, safeMax);
    return item;
}

function createItemFromDefinition(definition, rng = null) {
    if (!definition) {
        return null;
    }

    const item = new Item(definition.name, definition.type, { ...definition.properties });
    applyConfiguredPotCapacity(item, rng);
    return applyConfiguredSpawnImprovements(item, rng);
}

function getTieredItemMatch(item) {
    if (!item) {
        return null;
    }

    for (const [category, tierDefinitions] of Object.entries(TIERED_ITEM_DEFINITIONS)) {
        for (const [tierKey, tierDefinition] of Object.entries(tierDefinitions || {})) {
            const normalizedDefinitions = normalizeTierDefinitions(tierDefinition);

            for (const definition of normalizedDefinitions) {
                if (!definition) {
                    continue;
                }

                if (definition.name === item.name && definition.type === item.type) {
                    return {
                        category,
                        tier: Number(tierKey),
                        definition
                    };
                }
            }
        }
    }

    return null;
}

function copyItemPersistentState(sourceItem, targetItem, options = {}) {
    if (!sourceItem || !targetItem) {
        return targetItem;
    }

    const {
        preserveEnchantments = true,
        preserveCurse = true,
        preserveKnowledgeState = true,
        preserveQuantity = true,
        preserveImprovements = false
    } = options;

    if (preserveEnchantments) {
        const enchantments = typeof sourceItem.getEnchantments === 'function'
            ? sourceItem.getEnchantments()
            : (Array.isArray(sourceItem.properties?.enchantments) ? [...sourceItem.properties.enchantments] : []);
        if (enchantments.length > 0) {
            targetItem.properties.enchantments = [...enchantments];
        }
    }

    if (preserveCurse && typeof sourceItem.isCursed === 'function' && sourceItem.isCursed()) {
        targetItem.properties.cursed = true;
    }

    if (preserveQuantity && typeof sourceItem.getQuantity === 'function') {
        const quantity = sourceItem.getQuantity();
        if (quantity > 1 && typeof targetItem.setQuantity === 'function') {
            targetItem.setQuantity(quantity);
        }
    }

    if (preserveKnowledgeState && typeof sourceItem.knowledgeState === 'string') {
        targetItem.knowledgeState = sourceItem.knowledgeState;
    }

    if (preserveImprovements) {
        const improvementLevel = Number(sourceItem?.properties?.improvementLevel || 0);
        const powerBonus = Number(sourceItem?.properties?.improvementPowerBonus || 0);
        const armorBonus = Number(sourceItem?.properties?.improvementArmorBonus || 0);

        if (improvementLevel > 0) {
            targetItem.properties.improvementLevel = Math.floor(improvementLevel);
        }

        if (powerBonus > 0) {
            targetItem.properties.power = Number(targetItem.properties.power || 0) + Math.floor(powerBonus);
            targetItem.properties.improvementPowerBonus = Math.floor(powerBonus);
        }

        if (armorBonus > 0) {
            targetItem.properties.armor = Number(targetItem.properties.armor || 0) + Math.floor(armorBonus);
            targetItem.properties.improvementArmorBonus = Math.floor(armorBonus);
        }
    }

    return targetItem;
}

function itemHasEnchantment(item, enchantmentId) {
    if (!item || typeof enchantmentId !== 'string' || enchantmentId.length === 0) {
        return false;
    }

    if (typeof item.getEnchantments === 'function') {
        return item.getEnchantments().includes(enchantmentId);
    }

    return Array.isArray(item.properties?.enchantments)
        && item.properties.enchantments.includes(enchantmentId);
}

function createLowerTierVersionOfItem(item) {
    const match = getTieredItemMatch(item);
    if (!match) {
        return typeof item?.createSingleUseClone === 'function' ? item.createSingleUseClone() : null;
    }

    const targetTier = Math.max(1, match.tier - 1);
    const targetTierDefinition = TIERED_ITEM_DEFINITIONS[match.category]?.[targetTier];
    const normalizedDefinitions = normalizeTierDefinitions(targetTierDefinition);

    let chosenDefinition = normalizedDefinitions.find((definition) => definition?.type === item.type) || normalizedDefinitions[0] || null;
    if (Array.isArray(targetTierDefinition) && match.definition?.properties?.condition) {
        chosenDefinition = normalizedDefinitions.find((definition) => definition?.properties?.condition === match.definition.properties.condition)
            || chosenDefinition;
    }

    const transformedItem = createItemFromDefinition(chosenDefinition || match.definition);
    const preserveImprovements = itemHasEnchantment(item, 'gilded');
    return copyItemPersistentState(item, transformedItem, {
        preserveEnchantments: true,
        preserveCurse: true,
        preserveKnowledgeState: true,
        preserveQuantity: true,
        preserveImprovements
    });
}

function createBitterSeedsItemFrom(sourceItem = null) {
    const bitterSeeds = createTieredItem('food', 1);
    if (!bitterSeeds) {
        return null;
    }

    if (sourceItem && typeof sourceItem.knowledgeState === 'string') {
        bitterSeeds.knowledgeState = sourceItem.knowledgeState;
    }

    return bitterSeeds;
}

function estimateItemTierFromValue(value) {
    const numericValue = Math.max(0, Math.floor(Number(value) || 0));
    if (numericValue >= 45) {
        return 4;
    }
    if (numericValue >= 20) {
        return 3;
    }
    if (numericValue >= 10) {
        return 2;
    }
    return 1;
}

function chooseWeightedItemEntry(entries, rng = null) {
    const validEntries = Array.isArray(entries)
        ? entries.filter((entry) => Number(entry?.weight) > 0 && typeof entry?.create === 'function')
        : [];
    if (validEntries.length === 0) {
        return null;
    }

    const totalWeight = validEntries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
    if (totalWeight <= 0) {
        return validEntries[0] || null;
    }

    let roll = getRngRoll(rng) * totalWeight;
    for (const entry of validEntries) {
        roll -= Number(entry.weight || 0);
        if (roll <= 0) {
            return entry;
        }
    }

    return validEntries[validEntries.length - 1] || null;
}

function createMoneyItemWithValue(value) {
    const moneyItem = createTieredItem('money', 1);
    if (!moneyItem) {
        return null;
    }

    moneyItem.properties = moneyItem.properties || {};
    moneyItem.properties.value = Math.max(1, Math.floor(Number(value) || 1));
    return moneyItem;
}

function createFoodPotResultItem(sourceItem = null, rng = null) {
    const match = getTieredItemMatch(sourceItem);
    const tier = Number.isFinite(Number(match?.tier))
        ? clamp(Math.floor(Number(match.tier)), 1, 4)
        : estimateItemTierFromValue(getItemSellPrice(sourceItem));

    return createTieredItem('food', tier, rng) || createBitterSeedsItemFrom(sourceItem);
}

function createRandomizedPotResultItem(sourceItem = null, rng = null, floorIndex = 0) {
    const match = getTieredItemMatch(sourceItem);
    if (match && getRngRoll(rng) < 0.65) {
        const tierDefinitions = TIERED_ITEM_DEFINITIONS[match.category] || {};
        const alternativeTiers = Object.keys(tierDefinitions)
            .map((tier) => Number(tier))
            .filter((tier) => Number.isFinite(tier) && tier !== match.tier)
            .sort((left, right) => Math.abs(left - match.tier) - Math.abs(right - match.tier));
        const preferredTiers = alternativeTiers.slice(0, Math.min(2, alternativeTiers.length));
        const chosenTier = pickRandom(preferredTiers.length > 0 ? preferredTiers : alternativeTiers, rng, alternativeTiers[0]);

        if (Number.isFinite(chosenTier)) {
            const transformedItem = createTieredItem(match.category, chosenTier, rng);
            if (transformedItem && !transformedItem?.isPotItem?.()) {
                if (sourceItem?.type === ITEM_TYPES.THROWABLE && transformedItem.type === ITEM_TYPES.THROWABLE) {
                    transformedItem.setQuantity?.(sourceItem.getQuantity?.() || 1);
                }
                return transformedItem;
            }
        }
    }

    const fallbackTier = match
        ? clamp(Math.floor(Number(match.tier) || 1), 1, 4)
        : clamp(Math.floor(Number(floorIndex) || 0) + 1, 1, 4);
    const weightedEntries = getWeightedItemEntriesForTier(fallbackTier)
        .filter((entry) => entry?.category !== 'money');

    for (let attempt = 0; attempt < 12; attempt++) {
        const chosenEntry = chooseWeightedItemEntry(weightedEntries, rng);
        const transformedItem = chosenEntry?.create?.(rng) || null;
        if (!transformedItem || transformedItem?.isPotItem?.()) {
            continue;
        }

        if (sourceItem?.type === ITEM_TYPES.THROWABLE && transformedItem.type === ITEM_TYPES.THROWABLE) {
            transformedItem.setQuantity?.(sourceItem.getQuantity?.() || 1);
        }

        return transformedItem;
    }

    const fallbackItem = createTieredItem('food', fallbackTier, rng);
    if (sourceItem?.type === ITEM_TYPES.THROWABLE && fallbackItem?.type === ITEM_TYPES.THROWABLE) {
        fallbackItem.setQuantity?.(sourceItem.getQuantity?.() || 1);
    }

    return fallbackItem;
}

function transformItemForPot(sourceItem, potItem, options = {}) {
    if (!sourceItem || !potItem) {
        return sourceItem || null;
    }

    const rng = options.rng || null;
    const floorIndex = Number.isFinite(Number(options.floorIndex))
        ? Math.floor(Number(options.floorIndex))
        : 0;
    const potType = typeof potItem?.getPotType === 'function'
        ? potItem.getPotType()
        : String(potItem?.properties?.potType || 'basic');

    if (potType === 'money') {
        return createMoneyItemWithValue(getItemSellPrice(sourceItem));
    }

    if (potType === 'food') {
        return createFoodPotResultItem(sourceItem, rng);
    }

    if (potType === 'randomizer') {
        return createRandomizedPotResultItem(sourceItem, rng, floorIndex) || sourceItem;
    }

    return sourceItem;
}

function isEnemyDropRestrictedItem(item) {
    const restrictedTypes = item?.properties?.dropOnlyEnemyTypes;
    return Array.isArray(restrictedTypes) && restrictedTypes.length > 0;
}

function canEnemyDropItem(item, enemy) {
    if (!isEnemyDropRestrictedItem(item)) {
        return true;
    }

    if (!enemy || typeof enemy.hasEnemyType !== 'function') {
        return false;
    }

    return item.properties.dropOnlyEnemyTypes.some((enemyType) => enemy.hasEnemyType(enemyType));
}

function createTieredItem(category, tier, rng = null) {
    let definition = TIERED_ITEM_DEFINITIONS[category]?.[tier] || null;
    if (Array.isArray(definition)) {
        definition = pickRandom(definition, rng);
    }
    return createItemFromDefinition(definition, rng);
}

function createStatusConsumable(condition) {
    const definitions = getStatusConsumableDefinitions();
    const normalizedCondition = normalizeConditionKey(condition);

    if (!normalizedCondition) {
        return null;
    }

    const matchingDefinitions = definitions.filter((definition) => definition.properties.condition === normalizedCondition);
    if (matchingDefinitions.length === 0) {
        return null;
    }

    const chosenDefinition = pickRandom(matchingDefinitions);

    return createItemFromDefinition({
        name: chosenDefinition.name,
        type: chosenDefinition.type,
        properties: {
            ...chosenDefinition.properties,
            condition: normalizedCondition
        }
    }, null);
}

function getWeightedItemEntriesForTier(tier) {
    const normalizedTier = clamp(tier, 1, 4);
    const entries = ITEM_SPAWN_POOL_BY_TIER[normalizedTier] || ITEM_SPAWN_POOL_BY_TIER[1];

    return entries.map((entry) => ({
        category: entry.category,
        tier: entry.tier,
        weight: entry.weight,
        create: (rng = null) => createTieredItem(entry.category, entry.tier, rng)
    }));
}

function createAllStatusConsumables() {
    const conditions = [...new Set(getStatusConsumableDefinitions().map((definition) => definition.properties.condition))];
    return conditions
        .map((condition) => createStatusConsumable(condition))
        .filter((item) => Boolean(item));
}

function createAllImprovementScrolls() {
    const improvementScrollDefinitions = normalizeTierDefinitions(TIERED_ITEM_DEFINITIONS.scroll?.[4])
        .filter((definition) => Array.isArray(definition?.properties?.improvesItemTypes));
    return improvementScrollDefinitions
        .map((definition) => createItemFromDefinition(definition))
        .filter((item) => Boolean(item));
}

function createAllTieredItems() {
    const items = [];

    for (const tierDefinitions of Object.values(TIERED_ITEM_DEFINITIONS || {})) {
        const orderedTierKeys = Object.keys(tierDefinitions || {})
            .map((tierKey) => Number(tierKey))
            .filter((tier) => Number.isFinite(tier))
            .sort((left, right) => right - left);

        for (const tier of orderedTierKeys) {
            const tierDefinition = tierDefinitions[tier];
            for (const definition of normalizeTierDefinitions(tierDefinition)) {
                if (!definition) {
                    continue;
                }

                const item = createItemFromDefinition(definition);
                if (item) {
                    items.push(item);
                }
            }
        }
    }

    return items;
}

/**
 * Creates a set of starter items, one for each category, all at tier 1.
 */
function createTieredStarterItems() {
    return [
        createTieredItem('healing', 1),
        createTieredItem('food', 1),
        createTieredItem('throwable', 1),
        createTieredItem('weapon', 1),
        createTieredItem('shield', 1),
        createTieredItem('armor', 1),
        createTieredItem('accessory', 1)
    ];
}

function canItemBeCursed(item) {
    if (!item) return false;
    return item.type === ITEM_TYPES.WEAPON ||
        item.type === ITEM_TYPES.ARMOR ||
        item.type === ITEM_TYPES.SHIELD ||
        item.type === ITEM_TYPES.ACCESSORY;
}

function prepareRollableEquipmentItem(item) {
    if (!item || !canItemBeCursed(item)) {
        return null;
    }

    if (!item.properties) {
        item.properties = {};
    }

    return item;
}

function getMaxEnchantmentCountForItem(item) {
    const slotCount = Number(item?.properties?.slots || 0);
    if (!Number.isFinite(slotCount) || slotCount <= 0) {
        return 0;
    }

    return Math.max(0, Math.floor(slotCount));
}

function getEnchantmentPoolForItem(item) {
    return Object.entries(ENCHANTMENT_DEFINITIONS)
        .filter(([, definition]) => Array.isArray(definition.validItemTypes) && definition.validItemTypes.includes(item.type))
        .map(([key]) => key);
}

function applyWorldEnchantmentRoll(item, rng = null, chance = 0.05, rollCount = 3) {
    const rollableItem = prepareRollableEquipmentItem(item);
    if (!rollableItem) {
        return item;
    }

    const maxEnchantmentCount = getMaxEnchantmentCountForItem(rollableItem);
    if (maxEnchantmentCount <= 0) {
        return rollableItem;
    }

    for (let rollIndex = 0; rollIndex < Math.max(0, Math.floor(Number(rollCount) || 0)); rollIndex++) {
        if (getRngRoll(rng) >= chance) {
            continue;
        }

        if (rollableItem.getEnchantments().length >= maxEnchantmentCount) {
            break;
        }

        const availableEnchantments = getEnchantmentPoolForItem(rollableItem)
            .filter((enchantmentId) => !rollableItem.hasEnchantment(enchantmentId));
        if (availableEnchantments.length === 0) {
            break;
        }

        const index = getRngRandomInt(rng, 0, availableEnchantments.length - 1);
        const chosenEnchantment = availableEnchantments[index];
        if (typeof chosenEnchantment === 'string') {
            rollableItem.addEnchantment(chosenEnchantment);
        }
    }

    return rollableItem;
}

function applyWorldCurseRoll(item, rng = null, chance = 0.2) {
    const rollableItem = prepareRollableEquipmentItem(item);
    if (!rollableItem) {
        return item;
    }

    const roll = getRngRoll(rng);
    rollableItem.properties.cursed = roll < chance;
    return rollableItem;
}
