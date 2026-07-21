// =============================
// Item Data and Shared Helpers
// =============================

// --- Hidden Names for Unidentified Items ---
const hiddenConsumable = 'Unknown consumable';
const hiddenThrowable = 'Unknown throwable';
const hiddenSword = 'Unknown weapon';
const hiddenArmor = 'Unknown armor';
const hiddenShield = 'Unknown shield';
const hiddenAccessory = 'Unknown accessory';
const hiddenPot = 'Unknown pot';
const hiddenStaff = 'Unknown staff';

// --- Enchantment Definitions ---
const ENCHANTMENT_DEFINITIONS = {
    sweepingAttack: {
        id: 'sweepingAttack',
        name: 'Sweeping attack',
        validItemTypes: [ITEM_TYPES.WEAPON]
    },
    sideAttack: {
        id: 'sideAttack',
        name: 'Side attack',
        validItemTypes: [ITEM_TYPES.WEAPON]
    },
    backAttack: {
        id: 'backAttack',
        name: 'Back attack',
        validItemTypes: [ITEM_TYPES.WEAPON]
    },
    rapidStrike: {
        id: 'rapidStrike',
        name: 'Rapid strike',
        validItemTypes: [ITEM_TYPES.WEAPON]
    },
    critical: {
        id: 'critical',
        name: 'Critical',
        validItemTypes: [ITEM_TYPES.WEAPON]
    },
    knockback: {
        id: 'knockback',
        name: 'Knockback',
        validItemTypes: [ITEM_TYPES.WEAPON]
    },
    hungerPower: {
        id: 'hungerPower',
        name: 'Hunger power',
        validItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ACCESSORY],
        hungerPowerMultiplier: 1.3
    },
    bloodyPower: {
        id: 'bloodyPower',
        name: 'Bloody power',
        validItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ACCESSORY],
        bloodyPowerMultiplier: 1.3
    },
    waterwalk: {
        id: 'waterwalk',
        name: 'Waterwalk',
        validItemTypes: [ITEM_TYPES.ACCESSORY]
    },
    lavawalk: {
        id: 'lavawalk',
        name: 'Lavawalk',
        validItemTypes: [ITEM_TYPES.ACCESSORY]
    },
    fly: {
        id: 'fly',
        name: 'Fly',
        validItemTypes: [ITEM_TYPES.ACCESSORY]
    },
    ruinTraps: {
        id: 'ruinTraps',
        name: 'Ruin traps',
        validItemTypes: [ITEM_TYPES.WEAPON]
    },
    inflictPoison: {
        id: 'inflictPoison',
        name: 'Poison',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.POISONED,
        inflictChance: 0.2
    },
    inflictSlow: {
        id: 'inflictSlow',
        name: 'Slow',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.SLOW,
        inflictChance: 0.2
    },
    inflictSleep: {
        id: 'inflictSleep',
        name: 'Sleep',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.SLEEP,
        inflictChance: 0.2
    },
    inflictFrightened: {
        id: 'inflictFrightened',
        name: 'Frightened',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.FRIGHTENED,
        inflictChance: 0.2
    },
    inflictBlind: {
        id: 'inflictBlind',
        name: 'Blind',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.BLIND,
        inflictChance: 0.2
    },
    inflictBound: {
        id: 'inflictBound',
        name: 'Bound',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.BOUND,
        inflictChance: 0.2
    },
    inflictBerserk: {
        id: 'inflictBerserk',
        name: 'Berserk',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.BERSERK,
        inflictChance: 0.2
    },
    preventPoison: {
        id: 'preventPoison',
        name: 'Poison ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.POISONED,
        preventionChance: 0.75
    },
    preventSlow: {
        id: 'preventSlow',
        name: 'Slow ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.SLOW,
        preventionChance: 0.75
    },
    preventSleep: {
        id: 'preventSleep',
        name: 'Sleep ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.SLEEP,
        preventionChance: 0.75
    },
    preventFrightened: {
        id: 'preventFrightened',
        name: 'Fear ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.FRIGHTENED,
        preventionChance: 0.75
    },
    preventBlind: {
        id: 'preventBlind',
        name: 'Blind ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.BLIND,
        preventionChance: 0.75
    },
    preventBound: {
        id: 'preventBound',
        name: 'Bind ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.BOUND,
        preventionChance: 0.75
    },
    preventBerserk: {
        id: 'preventBerserk',
        name: 'Berserk ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.BERSERK,
        preventionChance: 0.75
    },
    slayer: {
        id: 'slayer',
        name: 'Slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplier: 1.1
    },
    beastSlayer: {
        id: 'beastSlayer',
        name: 'Beast slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.BEAST]: 1.1
        }
    },
    slimeSlayer: {
        id: 'slimeSlayer',
        name: 'Slime slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.SLIME]: 1.1
        }
    },
    aquaticSlayer: {
        id: 'aquaticSlayer',
        name: 'Aquatic slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.AQUATIC]: 1.1
        }
    },
    floatingSlayer: {
        id: 'floatingSlayer',
        name: 'Floating slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.FLOATING]: 1.1
        }
    },
    ghostSlayer: {
        id: 'ghostSlayer',
        name: 'Ghost slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.GHOST]: 1.1
        }
    },
    vandalSlayer: {
        id: 'vandalSlayer',
        name: 'Vandal slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.VANDAL]: 1.1
        }
    },
    fuserSlayer: {
        id: 'fuserSlayer',
        name: 'Fuser slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.FUSER]: 1.1
        }
    },
    pariahSlayer: {
        id: 'pariahSlayer',
        name: 'Pariah slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.PARIAH]: 1.1
        }
    },
    crafterSlayer: {
        id: 'crafterSlayer',
        name: 'Crafter slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.CRAFTER]: 1.1
        }
    },
    defender: {
        id: 'defender',
        name: 'Defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplier: 1.1
    },
    beastDefender: {
        id: 'beastDefender',
        name: 'Beast defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.BEAST]: 1.1
        }
    },
    slimeDefender: {
        id: 'slimeDefender',
        name: 'Slime defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.SLIME]: 1.1
        }
    },
    aquaticDefender: {
        id: 'aquaticDefender',
        name: 'Aquatic defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.AQUATIC]: 1.1
        }
    },
    floatingDefender: {
        id: 'floatingDefender',
        name: 'Floating defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.FLOATING]: 1.1
        }
    },
    ghostDefender: {
        id: 'ghostDefender',
        name: 'Ghost defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.GHOST]: 1.1
        }
    },
    vandalDefender: {
        id: 'vandalDefender',
        name: 'Vandal defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.VANDAL]: 1.1
        }
    },
    fuserDefender: {
        id: 'fuserDefender',
        name: 'Fuser defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.FUSER]: 1.1
        }
    },
    pariahDefender: {
        id: 'pariahDefender',
        name: 'Pariah defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.PARIAH]: 1.1
        }
    },
    crafterDefender: {
        id: 'crafterDefender',
        name: 'Crafter defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.CRAFTER]: 1.1
        }
    },
    fasting: {
        id: 'fasting',
        name: 'Fasting',
        validItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY],
        grantsCondition: CONDITIONS.SATIATED,
        grantsConditionDuration: Infinity
    },
    gilded: {
        id: 'gilded',
        name: 'Gilded',
        validItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY]
    },
    scholar: {
        id: 'scholar',
        name: 'Scholar',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        expGainMultiplier: 1.25
    },
    sustenance: {
        id: 'sustenance',
        name: 'Sustenance',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        passiveHungerLossIntervalMultiplier: 2
    },
    vitality: {
        id: 'vitality',
        name: 'Vitality',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        passiveHealingBonus: 1
    },
    enemySight: {
        id: 'enemySight',
        name: 'Enemy sight',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        revealsEnemiesOnMap: true
    },
    itemSight: {
        id: 'itemSight',
        name: 'Item sight',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        revealsItemsOnMap: true
    },
    eagleEye: {
        id: 'eagleEye',
        name: 'Eagle eye',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        revealsTraps: true
    },
    counter: {
        id: 'counter',
        name: 'Counter',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        counterReflectRatio: 0.1
    },
    appraiser: {
        id: 'appraiser',
        name: 'Appraiser',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        identifiesItemsOnPickup: true
    },
    miner: {
        id: 'miner',
        name: 'Miner',
        validItemTypes: [ITEM_TYPES.ACCESSORY],
        reducesPickaxeDegradation: true
    }
};

function getAllEnchantmentIdsForItemType(itemType) {
    return Object.entries(ENCHANTMENT_DEFINITIONS)
        .filter(([, definition]) => Array.isArray(definition.validItemTypes) && definition.validItemTypes.includes(itemType))
        .map(([key]) => key);
}

// --- Cheater Enchantment Sets ---
const CHEATER_WEAPON_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.WEAPON);
const CHEATER_ARMOR_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.ARMOR);
const CHEATER_SHIELD_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.SHIELD);
const CHEATER_ACCESSORY_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.ACCESSORY);

// --- Equipment Set Definitions ---
const EQUIPMENT_SET_DEFINITIONS = {
    warrior: {
        id: 'warrior',
        name: 'Warrior set',
        bonuses: [
            { pieces: 2, powerBonus: 5, armorBonus: 5 },
            { pieces: 3, grantsCondition: CONDITIONS.HEAVY_HITTER, grantsConditionDuration: Infinity }
        ]
    }
};

function createShopItemDefinition(name, type, hiddenName, baseShopPrice, baseSellPrice, properties = {}) {
    return {
        name,
        type,
        properties: {
            hiddenName,
            baseShopPrice,
            baseSellPrice,
            burnable: properties?.burnable ?? true,
            requiresIdentification: properties?.requiresIdentification ?? false,
            ...(properties || {})
        }
    };
}

function createPotDefinition(name, potType, minCapacity, maxCapacity, baseShopPrice, baseSellPrice, extraProperties = {}) {
    return createShopItemDefinition(name, ITEM_TYPES.POT, hiddenPot, baseShopPrice, baseSellPrice, {
        potType,
        minCapacity,
        maxCapacity,
        ...extraProperties
    });
}

// --- Tiered Item Definitions ---
const ITEM_CONFIG = window.ITEM_BALANCE_CONFIG || {};
const DEFAULT_SHOP_PRICE_BY_CATEGORY = ITEM_CONFIG.defaultShopPriceByCategory;

function normalizeEnchantmentEnemyTypeMultiplierMap(configMap) {
    if (!configMap || typeof configMap !== 'object') {
        return null;
    }

    const normalizedMap = {};
    for (const [enemyTypeKey, multiplierValue] of Object.entries(configMap)) {
        const resolvedEnemyType = Object.prototype.hasOwnProperty.call(ENEMY_TYPES, enemyTypeKey)
            ? ENEMY_TYPES[enemyTypeKey]
            : enemyTypeKey;
        const normalizedMultiplier = Number(multiplierValue);
        if (typeof resolvedEnemyType !== 'string' || resolvedEnemyType.length === 0) {
            continue;
        }
        if (!Number.isFinite(normalizedMultiplier) || normalizedMultiplier <= 0) {
            continue;
        }
        normalizedMap[resolvedEnemyType] = normalizedMultiplier;
    }

    return Object.keys(normalizedMap).length > 0 ? normalizedMap : null;
}

function applyEnchantmentConfigTuning(definitions, tuningByEnchantmentId) {
    if (!definitions || typeof definitions !== 'object') {
        return;
    }
    if (!tuningByEnchantmentId || typeof tuningByEnchantmentId !== 'object') {
        return;
    }

    const scalarKeys = [
        'hungerPowerMultiplier',
        'bloodyPowerMultiplier',
        'inflictChance',
        'preventionChance',
        'damageMultiplier',
        'shieldMultiplier',
        'expGainMultiplier',
        'passiveHungerLossIntervalMultiplier',
        'passiveHealingBonus',
        'counterReflectRatio'
    ];

    for (const [enchantmentId, tuning] of Object.entries(tuningByEnchantmentId)) {
        const definition = definitions[enchantmentId];
        if (!definition || typeof definition !== 'object' || !tuning || typeof tuning !== 'object') {
            continue;
        }

        for (const key of scalarKeys) {
            if (!Object.prototype.hasOwnProperty.call(tuning, key)) {
                continue;
            }

            const value = Number(tuning[key]);
            if (Number.isFinite(value) && value > 0) {
                definition[key] = value;
            }
        }

        if (Object.prototype.hasOwnProperty.call(tuning, 'damageMultiplierByEnemyType')) {
            const normalizedDamageMap = normalizeEnchantmentEnemyTypeMultiplierMap(tuning.damageMultiplierByEnemyType);
            if (normalizedDamageMap) {
                definition.damageMultiplierByEnemyType = normalizedDamageMap;
            }
        }

        if (Object.prototype.hasOwnProperty.call(tuning, 'shieldMultiplierByEnemyType')) {
            const normalizedShieldMap = normalizeEnchantmentEnemyTypeMultiplierMap(tuning.shieldMultiplierByEnemyType);
            if (normalizedShieldMap) {
                definition.shieldMultiplierByEnemyType = normalizedShieldMap;
            }
        }
    }
}

applyEnchantmentConfigTuning(ENCHANTMENT_DEFINITIONS, ITEM_CONFIG.enchantmentTuning);

function resolveItemCategoryFromConfig(configItem, itemType, itemId = '') {
    if (itemType === ITEM_TYPES.WEAPON) {
        return 'weapon';
    }
    if (itemType === ITEM_TYPES.ARMOR) {
        return 'armor';
    }
    if (itemType === ITEM_TYPES.SHIELD) {
        return 'shield';
    }
    if (itemType === ITEM_TYPES.ACCESSORY) {
        return 'accessory';
    }
    if (itemType === ITEM_TYPES.THROWABLE) {
        return 'throwable';
    }
    if (itemType === ITEM_TYPES.STAFF) {
        return 'staff';
    }
    if (itemType === ITEM_TYPES.POT) {
        return 'pot';
    }

    if (itemType === ITEM_TYPES.CONSUMABLE) {
        if (Number.isFinite(Number(configItem?.health))) {
            return 'healing';
        }
        if (Number.isFinite(Number(configItem?.hunger))) {
            return 'food';
        }
        if (typeof configItem?.scrollEffect === 'string'
            || Array.isArray(configItem?.targetItemTypes)
            || Array.isArray(configItem?.improvesItemTypes)) {
            return 'scroll';
        }
        if (typeof configItem?.condition === 'string') {
            return 'statusConsumable';
        }
    }

    return null;
}

function resolveItemTypeFromConfig(configType) {
    if (typeof configType === 'string' && Object.prototype.hasOwnProperty.call(ITEM_TYPES, configType)) {
        return ITEM_TYPES[configType];
    }
    return configType;
}

function resolveConditionFromConfig(configCondition) {
    if (typeof configCondition === 'string' && Object.prototype.hasOwnProperty.call(CONDITIONS, configCondition)) {
        return CONDITIONS[configCondition];
    }
    return configCondition;
}

function resolveEnemyTypesFromConfig(configEnemyTypes) {
    if (!Array.isArray(configEnemyTypes)) {
        return configEnemyTypes;
    }

    return configEnemyTypes
        .map((enemyType) => {
            if (typeof enemyType === 'string' && Object.prototype.hasOwnProperty.call(ENEMY_TYPES, enemyType)) {
                return ENEMY_TYPES[enemyType];
            }
            return enemyType;
        })
        .filter((enemyType) => typeof enemyType === 'string' && enemyType.length > 0);
}

function resolveItemTypeListFromConfig(configTypes) {
    if (!Array.isArray(configTypes)) {
        return configTypes;
    }

    return configTypes
        .map((configType) => resolveItemTypeFromConfig(configType))
        .filter((itemType) => typeof itemType === 'string' && itemType.length > 0);
}

function getDefaultHiddenNameForType(itemType) {
    if (itemType === ITEM_TYPES.THROWABLE) {
        return hiddenThrowable;
    }
    if (itemType === ITEM_TYPES.WEAPON) {
        return hiddenSword;
    }
    if (itemType === ITEM_TYPES.ARMOR) {
        return hiddenArmor;
    }
    if (itemType === ITEM_TYPES.SHIELD) {
        return hiddenShield;
    }
    if (itemType === ITEM_TYPES.ACCESSORY) {
        return hiddenAccessory;
    }
    if (itemType === ITEM_TYPES.POT) {
        return hiddenPot;
    }
    if (itemType === ITEM_TYPES.STAFF) {
        return hiddenStaff;
    }
    return hiddenConsumable;
}

function resolveEnchantmentsFromConfig(configEnchantments, itemType) {
    if (configEnchantments === 'ALL') {
        if (itemType === ITEM_TYPES.WEAPON) {
            return [...CHEATER_WEAPON_ENCHANTMENTS];
        }
        if (itemType === ITEM_TYPES.ARMOR) {
            return [...CHEATER_ARMOR_ENCHANTMENTS];
        }
        if (itemType === ITEM_TYPES.SHIELD) {
            return [...CHEATER_SHIELD_ENCHANTMENTS];
        }
        if (itemType === ITEM_TYPES.ACCESSORY) {
            return [...CHEATER_ACCESSORY_ENCHANTMENTS];
        }
        return [];
    }

    return Array.isArray(configEnchantments)
        ? [...configEnchantments]
        : configEnchantments;
}

function resolveItemPropertiesFromConfig(configItem, itemType) {
    const properties = {};

    for (const [key, value] of Object.entries(configItem || {})) {
        if (key === 'id' || key === 'name' || key === 'type' || key === 'tier') {
            continue;
        }

        if (key === 'condition') {
            properties.condition = resolveConditionFromConfig(value);
            continue;
        }

        if (key === 'dropOnlyEnemyTypes') {
            properties.dropOnlyEnemyTypes = resolveEnemyTypesFromConfig(value);
            continue;
        }

        if (key === 'targetItemTypes' || key === 'improvesItemTypes') {
            properties[key] = resolveItemTypeListFromConfig(value);
            continue;
        }

        if (key === 'enchantments') {
            properties.enchantments = resolveEnchantmentsFromConfig(value, itemType);
            continue;
        }

        properties[key] = value;
    }

    if (typeof properties.hiddenName !== 'string' || properties.hiddenName.length === 0) {
        properties.hiddenName = getDefaultHiddenNameForType(itemType);
    }

    if (!Object.prototype.hasOwnProperty.call(properties, 'burnable')) {
        properties.burnable = true;
    }

    if (!Object.prototype.hasOwnProperty.call(properties, 'requiresIdentification')) {
        properties.requiresIdentification = false;
    }

    return properties;
}

function addItemDefinitionToTieredMap(tieredMap, category, tier, definition) {
    if (!tieredMap[category]) {
        tieredMap[category] = {};
    }

    if (!tieredMap[category][tier]) {
        tieredMap[category][tier] = definition;
        return;
    }

    if (!Array.isArray(tieredMap[category][tier])) {
        tieredMap[category][tier] = [tieredMap[category][tier]];
    }

    tieredMap[category][tier].push(definition);
}

function buildTieredItemDefinitionsFromConfig() {
    const tieredDefinitions = {
        money: {
            1: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 10, valueMax: 50 }),
            2: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 50, valueMax: 100 }),
            3: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 100, valueMax: 200 }),
            4: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 200, valueMax: 300 })
        }
    };

    const configItems = Array.isArray(ITEM_CONFIG.items) ? ITEM_CONFIG.items : [];
    for (const configItem of configItems) {
        const itemId = typeof configItem?.id === 'string' ? configItem.id : '';
        const itemType = resolveItemTypeFromConfig(configItem?.type);
        const category = resolveItemCategoryFromConfig(configItem, itemType, itemId);
        const tier = Number(configItem?.tier);

        if (!category || !Number.isFinite(Number(tier)) || typeof itemType !== 'string') {
            continue;
        }

        const definition = {
            name: configItem.name,
            type: itemType,
            properties: resolveItemPropertiesFromConfig(configItem, itemType)
        };

        addItemDefinitionToTieredMap(tieredDefinitions, category, Math.floor(Number(tier)), definition);
    }

    return tieredDefinitions;
}

const TIERED_ITEM_DEFINITIONS = buildTieredItemDefinitionsFromConfig();

// --- Annotate Tiered Item Definitions ---
function annotateTieredItemDefinitions(definitionsByCategory) {
    for (const [categoryKey, tierDefinitions] of Object.entries(definitionsByCategory || {})) {
        for (const [tierKey, tierDefinition] of Object.entries(tierDefinitions || {})) {
            const normalizedTier = Number.isFinite(Number(tierKey)) ? Number(tierKey) : null;
            const definitions = Array.isArray(tierDefinition) ? tierDefinition : [tierDefinition];

            for (let definitionIndex = 0; definitionIndex < definitions.length; definitionIndex++) {
                const definition = definitions[definitionIndex];
                if (!definition || typeof definition !== 'object') {
                    continue;
                }

                definition.properties = definition.properties || {};
                const idSuffix = definitions.length > 1 ? `-${definitionIndex + 1}` : '';
                if (typeof definition.properties.itemId !== 'string' || definition.properties.itemId.length === 0) {
                    definition.properties.itemId = `${categoryKey}-tier-${tierKey}${idSuffix}`;
                }
                if (typeof definition.properties.itemCategory !== 'string' || definition.properties.itemCategory.length === 0) {
                    definition.properties.itemCategory = categoryKey;
                }
                if (normalizedTier !== null && !Number.isFinite(Number(definition.properties.itemTier))) {
                    definition.properties.itemTier = normalizedTier;
                }
            }
        }
    }

    return definitionsByCategory;
}

annotateTieredItemDefinitions(TIERED_ITEM_DEFINITIONS);

// --- Helper Functions ---
function sumEnchantmentBonus(enchantments, bonusKey) {
    return enchantments.reduce((sum, enchantmentId) => {
        const bonus = Number(ENCHANTMENT_DEFINITIONS[enchantmentId]?.[bonusKey] || 0);
        return sum + (Number.isFinite(bonus) ? bonus : 0);
    }, 0);
}

function actorMatchesEnemyType(actor, enemyType) {
    return typeof actor.hasEnemyType === 'function'
        ? actor.hasEnemyType(enemyType)
        : Array.isArray(actor.creatureTypes) && actor.creatureTypes.includes(enemyType);
}

function getPositiveFiniteNumber(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function applyEnemyTypeMultipliers(currentValue, actor, multiplierMap, applyMultiplier) {
    if (!multiplierMap || typeof applyMultiplier !== 'function') {
        return currentValue;
    }

    let nextValue = currentValue;
    for (const [enemyType, configuredMultiplier] of Object.entries(multiplierMap)) {
        const enemyTypeMultiplier = getPositiveFiniteNumber(configuredMultiplier);
        if (enemyTypeMultiplier <= 0) {
            continue;
        }

        if (actorMatchesEnemyType(actor, enemyType)) {
            nextValue = applyMultiplier(nextValue, enemyTypeMultiplier);
        }
    }

    return nextValue;
}

function normalizeConditionKey(condition) {
    return Object.values(CONDITIONS).includes(condition) ? condition : null;
}

function getEquipmentSetDefinition(setId) {
    if (typeof setId !== 'string' || setId.length === 0) {
        return null;
    }

    return EQUIPMENT_SET_DEFINITIONS[setId] || null;
}

function resolveConditionDuration(properties) {
    const condition = properties.condition;
    const configuredDuration = getConditionDuration(condition, 10);
    const duration = Number(properties.duration ?? configuredDuration);
    return { condition, duration };
}

function getRawItemQuantity(properties) {
    const quantity = Number(properties?.quantity);
    return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function setRawItemQuantity(properties, quantity) {
    const nextQuantity = Number(quantity);
    if (Number.isFinite(nextQuantity) && nextQuantity > 1) {
        properties.quantity = Math.floor(nextQuantity);
        return;
    }
    if (Object.prototype.hasOwnProperty.call(properties, 'quantity')) {
        delete properties.quantity;
    }
}

function getBaseShopPriceForItem(item) {
    if (!item) {
        return 0;
    }

    const configuredBasePrice = Number(item?.properties?.baseShopPrice);
    if (Number.isFinite(configuredBasePrice) && configuredBasePrice > 0) {
        return Math.floor(configuredBasePrice);
    }

    const match = getTieredItemMatch(item);
    const tier = clamp(Math.floor(Number(match?.tier) || 1), 1, 4);
    const categoryPrices = DEFAULT_SHOP_PRICE_BY_CATEGORY[String(match?.category || '')];
    if (Array.isArray(categoryPrices)) {
        return categoryPrices[tier] || categoryPrices[categoryPrices.length - 1] || 30;
    }

    return 30;
}

function getItemShopPrice(item) {
    if (!item) {
        return 0;
    }

    const basePrice = getBaseShopPriceForItem(item);
    const improvementLevel = typeof item?.getImprovementLevel === 'function'
        ? item.getImprovementLevel()
        : Math.max(0, Math.floor(Number(item?.properties?.improvementLevel) || 0));
    const enchantmentCount = typeof item?.getEnchantments === 'function'
        ? item.getEnchantments().length
        : (Array.isArray(item?.properties?.enchantments) ? item.properties.enchantments.length : 0);
    const quantity = typeof item?.getQuantity === 'function'
        ? Math.max(1, Math.floor(Number(item.getQuantity()) || 1))
        : getRawItemQuantity(item?.properties);
    const cursed = typeof item?.isCursed === 'function'
        ? item.isCursed()
        : Boolean(item?.properties?.cursed);

    const improvedPrice = basePrice + improvementLevel * 20 + enchantmentCount * 35;
    const adjustedPrice = cursed ? Math.max(1, Math.floor(improvedPrice * 0.85)) : improvedPrice;
    return Math.max(1, Math.floor(adjustedPrice * quantity));
}

function getItemSellPrice(item) {
    if (!item) {
        return 0;
    }

    const configuredSellPrice = Number(item?.properties?.baseSellPrice);
    const dynamicSellPrice = Math.max(1, Math.floor(getItemShopPrice(item) * 0.5));
    if (Number.isFinite(configuredSellPrice) && configuredSellPrice > 0) {
        return Math.max(Math.floor(configuredSellPrice), dynamicSellPrice);
    }

    return dynamicSellPrice;
}

function getStatusConsumableDefinitions() {
    const statusByTier = TIERED_ITEM_DEFINITIONS.statusConsumable || {};
    const definitions = [];

    for (const [tier, tierDefinition] of Object.entries(statusByTier)) {
        if (!tierDefinition) {
            continue;
        }

        const normalizedTier = Number(tier);
        const normalizedDefinitions = normalizeTierDefinitions(tierDefinition);

        for (const definition of normalizedDefinitions) {
            if (!definition || typeof definition !== 'object') {
                continue;
            }

            const condition = normalizeConditionKey(definition.properties?.condition);
            if (!condition) {
                continue;
            }
            definitions.push({
                name: definition.name,
                type: ITEM_TYPES.CONSUMABLE,
                properties: {
                    ...(definition.properties || {}),
                    condition,
                    tier: Number.isFinite(normalizedTier) ? normalizedTier : undefined
                }
            });
        }
    }

    return definitions;
}

function normalizeTierDefinitions(tierDefinition) {
    if (!tierDefinition) {
        return [];
    }

    return Array.isArray(tierDefinition)
        ? tierDefinition
        : [tierDefinition];
}

const ITEM_SPAWN_POOL_BY_TIER = ITEM_CONFIG.itemSpawnPoolByTier;
