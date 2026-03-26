// Item creation and transformation helpers

function createItemFromDefinition(definition) {
    if (!definition) {
        return null;
    }

    return new Item(definition.name, definition.type, { ...definition.properties });
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
        preserveQuantity = true
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

    return targetItem;
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
    return copyItemPersistentState(item, transformedItem, {
        preserveEnchantments: true,
        preserveCurse: true,
        preserveKnowledgeState: true,
        preserveQuantity: true
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

function createTieredItem(category, tier) {
    let definition = TIERED_ITEM_DEFINITIONS[category]?.[tier] || null;
    if (Array.isArray(definition)) {
        definition = pickRandom(definition);
    }
    return createItemFromDefinition(definition);
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
    });
}

function getWeightedItemEntriesForTier(tier) {
    const normalizedTier = clamp(tier, 1, 4);
    const entries = ITEM_SPAWN_POOL_BY_TIER[normalizedTier] || ITEM_SPAWN_POOL_BY_TIER[1];

    return entries.map((entry) => ({
        weight: entry.weight,
        create: () => createTieredItem(entry.category, entry.tier)
    }));
}

function createAllStatusConsumables() {
    const conditions = [...new Set(getStatusConsumableDefinitions().map((definition) => definition.properties.condition))];
    return conditions
        .map((condition) => createStatusConsumable(condition))
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

function applyWorldEnchantmentRoll(item, rng = null, chance = 0.15) {
    const rollableItem = prepareRollableEquipmentItem(item);
    if (!rollableItem) {
        return item;
    }

    const maxEnchantmentCount = getMaxEnchantmentCountForItem(rollableItem);
    if (maxEnchantmentCount <= 0) {
        return rollableItem;
    }

    const roll = getRngRoll(rng);
    if (roll >= chance) {
        return rollableItem;
    }

    const pool = getEnchantmentPoolForItem(rollableItem);
    if (pool.length === 0) {
        return rollableItem;
    }

    const availableEnchantments = [...pool];
    const maxSelectableEnchantments = Math.min(maxEnchantmentCount, availableEnchantments.length);
    const desiredCountRoll = getRngRoll(rng);
    const desiredCount = Math.max(1, Math.ceil(desiredCountRoll * maxSelectableEnchantments));

    const chosenEnchantments = [];
    while (chosenEnchantments.length < desiredCount && availableEnchantments.length > 0) {
        const index = getRngRandomInt(rng, 0, availableEnchantments.length - 1);
        const [chosen] = availableEnchantments.splice(index, 1);
        if (typeof chosen === 'string') {
            chosenEnchantments.push(chosen);
        }
    }

    if (chosenEnchantments.length > 0) {
        rollableItem.properties.enchantments = chosenEnchantments;
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
