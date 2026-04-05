// Item data and shared item helpers

const hiddenConsumable = 'Unknown consumable';
const hiddenThrowable = 'Mysterious throwable';
const hiddenSword = 'Mysterious blade';
const hiddenArmor = 'Unknown armor';
const hiddenShield = 'Mysterious shield';
const hiddenAccessory = 'Unknown ring';
const hiddenPot = 'Unknown pot';

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

const CHEATER_WEAPON_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.WEAPON);
const CHEATER_ARMOR_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.ARMOR);
const CHEATER_SHIELD_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.SHIELD);
const CHEATER_ACCESSORY_ENCHANTMENTS = getAllEnchantmentIdsForItemType(ITEM_TYPES.ACCESSORY);

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

const DEFAULT_SHOP_PRICE_BY_CATEGORY = Object.freeze({
    healing: [0, 12, 24, 50, 120],
    food: [0, 6, 12, 24, 60],
    throwable: [0, 8, 20, 40, 70],
    weapon: [0, 40, 65, 95, 145],
    armor: [0, 35, 60, 95, 150],
    shield: [0, 30, 55, 90, 145],
    accessory: [0, 70, 110, 170, 185],
    statusConsumable: [0, 20, 36, 60, 95],
    scroll: [0, 45, 75, 100, 145],
    pot: [0, 20, 28, 36, 42]
});

const TIERED_ITEM_DEFINITIONS = {
    money: {
        1: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 10, valueMax: 50 }),
        2: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 50, valueMax: 100 }),
        3: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 100, valueMax: 200 }),
        4: createShopItemDefinition('Money', ITEM_TYPES.MONEY, 'Unknown currency', 1, 1, { valueMin: 200, valueMax: 300 })
    },
    healing: {
        1: { name: 'Old bandage', type: ITEM_TYPES.CONSUMABLE, properties: { health: 5, baseShopPrice: 12, baseSellPrice: 6, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        2: { name: 'Diluted potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 10, baseShopPrice: 24, baseSellPrice: 12, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        3: { name: 'Healing potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 20, baseShopPrice: 50, baseSellPrice: 25, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        4: { name: 'Greater healing potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 50, baseShopPrice: 120, baseSellPrice: 60, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
    },
    food: {
        1: { name: 'Bitter seeds', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 5, baseShopPrice: 6, baseSellPrice: 3, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        2: { name: 'Apple', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 10, baseShopPrice: 12, baseSellPrice: 6, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        3: { name: 'Bread', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 20, baseShopPrice: 24, baseSellPrice: 12, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        4: { name: 'Stew', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 50, baseShopPrice: 60, baseSellPrice: 30, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
    },
    throwable: {
        1: { name: 'Pebble', type: ITEM_TYPES.THROWABLE, properties: { power: 5, baseShopPrice: 8, baseSellPrice: 4, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
        2: [
            { name: 'Sharp rock', type: ITEM_TYPES.THROWABLE, properties: { power: 10, baseShopPrice: 18, baseSellPrice: 9, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
            { name: 'Pushback crystal', type: ITEM_TYPES.THROWABLE, properties: { power: 5, throwEffect: 'pushback', baseShopPrice: 26, baseSellPrice: 13, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } }
        ],
        3: [
            { name: 'Ninja star', type: ITEM_TYPES.THROWABLE, properties: { power: 15, baseShopPrice: 34, baseSellPrice: 17, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
            { name: 'Blink crystal', type: ITEM_TYPES.THROWABLE, properties: { throwEffect: 'blink', breakOnWall: true, baseShopPrice: 52, baseSellPrice: 26, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } }
        ],
        4: [
            { name: 'Javelin', type: ITEM_TYPES.THROWABLE, properties: { power: 20, baseShopPrice: 60, baseSellPrice: 30, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
            { name: 'Switch crystal', type: ITEM_TYPES.THROWABLE, properties: { throwEffect: 'switch', baseShopPrice: 80, baseSellPrice: 40, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } }
        ]
    },
    weapon: {
        0: { name: 'Cheater sword', type: ITEM_TYPES.WEAPON, properties: { power: 9999, slots: 80, baseShopPrice: 50000, baseSellPrice: 25000, enchantments: [...CHEATER_WEAPON_ENCHANTMENTS], hiddenName: hiddenSword, burnable: false } },
        1: { name: 'Rusted sword', type: ITEM_TYPES.WEAPON, properties: { power: 3, slots: 7, baseShopPrice: 40, baseSellPrice: 20, hiddenName: hiddenSword, burnable: false } },
        2: { name: 'Bronze sword', type: ITEM_TYPES.WEAPON, properties: { power: 4, slots: 6, baseShopPrice: 65, baseSellPrice: 32, hiddenName: hiddenSword, burnable: false } },
        3: { name: 'Iron sword', type: ITEM_TYPES.WEAPON, properties: { power: 5, slots: 5, baseShopPrice: 95, baseSellPrice: 47, hiddenName: hiddenSword, burnable: false } },
        4: [
            { name: 'Fancy sword', type: ITEM_TYPES.WEAPON, properties: { power: 8, slots: 4, baseShopPrice: 145, baseSellPrice: 72, setId: 'warrior', hiddenName: hiddenSword, burnable: false } },
            { name: 'Pickaxe', type: ITEM_TYPES.WEAPON, properties: { power: 1, slots: 0, breaksWalls: true, spawnImprovementMin: 5, spawnImprovementMax: 10, baseShopPrice: 170, baseSellPrice: 85, hiddenName: hiddenSword, burnable: false } }
        ]
    },
    armor: {
        0: { name: 'Cheater armor', type: ITEM_TYPES.ARMOR, properties: { armor: 9999, slots: 80, baseShopPrice: 50000, baseSellPrice: 25000, enchantments: [...CHEATER_ARMOR_ENCHANTMENTS], hiddenName: hiddenArmor, burnable: false } },
        1: { name: 'Rags', type: ITEM_TYPES.ARMOR, properties: { armor: 3, slots: 7, baseShopPrice: 35, baseSellPrice: 17, hiddenName: hiddenArmor, burnable: true } },
        2: { name: 'Leather armor', type: ITEM_TYPES.ARMOR, properties: { armor: 4, slots: 6, baseShopPrice: 60, baseSellPrice: 30, hiddenName: hiddenArmor, burnable: true } },
        3: { name: 'Chainmail armor', type: ITEM_TYPES.ARMOR, properties: { armor: 6, slots: 5, baseShopPrice: 95, baseSellPrice: 47, hiddenName: hiddenArmor, burnable: false } },
        4: { name: 'Plate armor', type: ITEM_TYPES.ARMOR, properties: { armor: 8, slots: 4, baseShopPrice: 150, baseSellPrice: 75, setId: 'warrior', hiddenName: hiddenArmor, burnable: false } }
    },
    shield: {
        0: { name: 'Cheater shield', type: ITEM_TYPES.SHIELD, properties: { armor: 9999, slots: 80, baseShopPrice: 50000, baseSellPrice: 25000, enchantments: [...CHEATER_SHIELD_ENCHANTMENTS], hiddenName: hiddenShield, burnable: false } },
        1: { name: 'Rotten shield', type: ITEM_TYPES.SHIELD, properties: { armor: 3, slots: 7, baseShopPrice: 30, baseSellPrice: 15, hiddenName: hiddenShield, burnable: true } },
        2: { name: 'Wooden shield', type: ITEM_TYPES.SHIELD, properties: { armor: 4, slots: 6, baseShopPrice: 55, baseSellPrice: 27, hiddenName: hiddenShield, burnable: true } },
        3: { name: 'Kite shield', type: ITEM_TYPES.SHIELD, properties: { armor: 6, slots: 5, baseShopPrice: 90, baseSellPrice: 45, hiddenName: hiddenShield, burnable: false } },
        4: { name: 'Tower shield', type: ITEM_TYPES.SHIELD, properties: { armor: 8, slots: 4, baseShopPrice: 145, baseSellPrice: 72, setId: 'warrior', hiddenName: hiddenShield, burnable: false } }
    },
    accessory: {
        0: { name: 'Cheater accessory', type: ITEM_TYPES.ACCESSORY, properties: { power: 9999, armor: 9999, slots: 80, baseShopPrice: 50000, baseSellPrice: 25000, enchantments: [...CHEATER_ACCESSORY_ENCHANTMENTS], hiddenName: hiddenAccessory, burnable: false } },
        1: [
            { name: 'Copper ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 5, slots: 3, baseShopPrice: 70, baseSellPrice: 35, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Copper bracelet', type: ITEM_TYPES.ACCESSORY, properties: { armor: 5, slots: 3, baseShopPrice: 70, baseSellPrice: 35, hiddenName: hiddenAccessory, burnable: false } }
        ],
        2: [
            { name: 'Bronze ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 10, slots: 3, baseShopPrice: 110, baseSellPrice: 55, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Bronze bracelet', type: ITEM_TYPES.ACCESSORY, properties: { armor: 10, slots: 3, baseShopPrice: 110, baseSellPrice: 55, hiddenName: hiddenAccessory, burnable: false } }
],
        3: [
            { name: 'Waterwalk ring', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['waterwalk'], slots: 3, baseShopPrice: 160, baseSellPrice: 80, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Lavawalk bracelet', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['lavawalk'], slots: 3, baseShopPrice: 160, baseSellPrice: 80, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Flying amulet', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['fly'], slots: 3, baseShopPrice: 190, baseSellPrice: 95, hiddenName: hiddenAccessory, burnable: false } }
        ],
        4: [
            { name: 'Scholar charm', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['scholar'], slots: 3, baseShopPrice: 180, baseSellPrice: 90, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Sustenance charm', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['sustenance'], slots: 3, baseShopPrice: 180, baseSellPrice: 90, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Vitality charm', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['vitality'], slots: 3, baseShopPrice: 180, baseSellPrice: 90, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Hunter lens', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['enemySight'], slots: 3, baseShopPrice: 180, baseSellPrice: 90, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Treasure lens', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['itemSight'], slots: 3, baseShopPrice: 180, baseSellPrice: 90, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Appraiser monocle', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['appraiser'], slots: 3, baseShopPrice: 180, baseSellPrice: 90, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Mining hardhat', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['miner'], slots: 3, baseShopPrice: 190, baseSellPrice: 95, hiddenName: hiddenAccessory, burnable: false } }
        ]
    },
    statusConsumable: {
        1: [
            { name: 'Poison brew', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.POISONED, baseShopPrice: 20, baseSellPrice: 10, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Sleeping draught', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SLEEP, baseShopPrice: 22, baseSellPrice: 11, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Fright powder', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.FRIGHTENED, baseShopPrice: 22, baseSellPrice: 11, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Spoiled milk', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.HUNGRY, baseShopPrice: 16, baseSellPrice: 8, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        2: [
            { name: 'Viscous slime tincture', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SLOW, baseShopPrice: 34, baseSellPrice: 17, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false, dropOnlyEnemyTypes: [ENEMY_TYPES.SLIME] } },
            { name: 'Haste potion', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.HASTE, baseShopPrice: 40, baseSellPrice: 20, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        3: [
            { name: 'Methanol jug', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BLIND, baseShopPrice: 55, baseSellPrice: 27, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Invisibility salve', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.INVISIBLE, baseShopPrice: 65, baseSellPrice: 32, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Shard of madness', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BERSERK, baseShopPrice: 65, baseSellPrice: 32, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        4: [
            { name: 'Petrification salts', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BOUND, baseShopPrice: 90, baseSellPrice: 45, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Holy water', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BLESSED, baseShopPrice: 95, baseSellPrice: 47, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Invincibility elixir', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.INVINCIBILITY, baseShopPrice: 150, baseSellPrice: 75, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Garlic chicken pizza', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SATIATED, baseShopPrice: 100, baseSellPrice: 50, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ]
    },
    scroll: {
        1: [
            { name: 'Trap eraser scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'erase-traps', baseShopPrice: 45, baseSellPrice: 22, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Mapping scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'map-floor', baseShopPrice: 45, baseSellPrice: 22, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        2: [
            { name: 'Identifying scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'identify-item', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY, ITEM_TYPES.CONSUMABLE, ITEM_TYPES.THROWABLE], baseShopPrice: 70, baseSellPrice: 35, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Gilding scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'add-gilded', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY], baseShopPrice: 85, baseSellPrice: 42, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        3: [
            { name: 'Purifying scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'purify-item', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY, ITEM_TYPES.CONSUMABLE, ITEM_TYPES.THROWABLE], baseShopPrice: 95, baseSellPrice: 47, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Warp scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'warp-player', baseShopPrice: 110, baseSellPrice: 55, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        4: [
            { name: 'Earthly power scroll', type: ITEM_TYPES.CONSUMABLE, properties: { improvesItemTypes: [ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD], baseShopPrice: 140, baseSellPrice: 70, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Heavenly power scroll', type: ITEM_TYPES.CONSUMABLE, properties: { improvesItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ACCESSORY], baseShopPrice: 140, baseSellPrice: 70, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Slot adding scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'add-slot', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY], baseShopPrice: 165, baseSellPrice: 82, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ]
    },
    pot: {
        1: [
            createPotDefinition('Basic pot', 'basic', 3, 5, 20, 10),
            createPotDefinition('Randomizer pot', 'randomizer', 2, 5, 42, 21),
            createPotDefinition('Money pot', 'money', 2, 5, 36, 18),
            createPotDefinition('Food pot', 'food', 2, 5, 28, 14),
            createPotDefinition('Banking pot', 'banking', 2, 3, 42, 21)
        ]
    },
};

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

const ITEM_SPAWN_POOL_BY_TIER = {
    1: [
        { category: 'money', tier: 1, weight: 4 },
        { category: 'healing', tier: 1, weight: 4 },
        { category: 'food', tier: 1, weight: 4 },
        { category: 'pot', tier: 1, weight: 1 },
        { category: 'statusConsumable', tier: 1, weight: 2 },
        { category: 'scroll', tier: 1, weight: 1 },
        { category: 'throwable', tier: 1, weight: 3 },
        { category: 'weapon', tier: 1, weight: 2 },
        { category: 'armor', tier: 1, weight: 2 },
        { category: 'shield', tier: 1, weight: 2 },
        { category: 'accessory', tier: 1, weight: 1 }
    ],
    2: [
        { category: 'money', tier: 2, weight: 4 },
        { category: 'healing', tier: 2, weight: 4 },
        { category: 'food', tier: 2, weight: 4 },
        { category: 'pot', tier: 1, weight: 1 },
        { category: 'statusConsumable', tier: 2, weight: 2 },
        { category: 'scroll', tier: 2, weight: 1 },
        { category: 'throwable', tier: 2, weight: 3 },
        { category: 'weapon', tier: 2, weight: 2 },
        { category: 'armor', tier: 2, weight: 2 },
        { category: 'shield', tier: 2, weight: 2 },
        { category: 'accessory', tier: 2, weight: 1 }
    ],
    3: [
        { category: 'money', tier: 3, weight: 4 },
        { category: 'healing', tier: 3, weight: 4 },
        { category: 'food', tier: 3, weight: 4 },
        { category: 'pot', tier: 1, weight: 1 },
        { category: 'statusConsumable', tier: 3, weight: 2 },
        { category: 'scroll', tier: 3, weight: 1 },
        { category: 'throwable', tier: 3, weight: 3 },
        { category: 'weapon', tier: 3, weight: 2 },
        { category: 'armor', tier: 3, weight: 2 },
        { category: 'shield', tier: 3, weight: 2 },
        { category: 'accessory', tier: 3, weight: 1 }
    ],
    4: [
        { category: 'money', tier: 4, weight: 4 },
        { category: 'healing', tier: 4, weight: 4 },
        { category: 'food', tier: 4, weight: 4 },
        { category: 'pot', tier: 1, weight: 1 },
        { category: 'statusConsumable', tier: 4, weight: 2 },
        { category: 'scroll', tier: 4, weight: 1 },
        { category: 'throwable', tier: 4, weight: 3 },
        { category: 'weapon', tier: 4, weight: 2 },
        { category: 'armor', tier: 4, weight: 2 },
        { category: 'shield', tier: 4, weight: 2 },
        { category: 'accessory', tier: 4, weight: 1 }
    ]
};
