// Item data and shared item helpers

const hiddenConsumable = 'Unknown consumable';
const hiddenThrowable = 'Mysterious throwable';
const hiddenSword = 'Mysterious blade';
const hiddenArmor = 'Unknown armor';
const hiddenShield = 'Mysterious shield';
const hiddenAccessory = 'Unknown ring';

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

const TIERED_ITEM_DEFINITIONS = {
    money: {
        1: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 10, valueMax: 50, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } },
        2: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 50, valueMax: 100, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } },
        3: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 100, valueMax: 200, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } },
        4: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 200, valueMax: 300, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } }
    },
    healing: {
        1: { name: 'Old bandage', type: ITEM_TYPES.CONSUMABLE, properties: { health: 5, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        2: { name: 'Diluted potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 10, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        3: { name: 'Healing potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 20, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        4: { name: 'Greater healing potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 50, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
    },
    food: {
        1: { name: 'Bitter seeds', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 5, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        2: { name: 'Apple', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 10, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        3: { name: 'Bread', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 20, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        4: { name: 'Stew', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 50, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
    },
    throwable: {
        1: { name: 'Pebble', type: ITEM_TYPES.THROWABLE, properties: { power: 5, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
        2: [
            { name: 'Sharp rock', type: ITEM_TYPES.THROWABLE, properties: { power: 10, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
            { name: 'Pushback crystal', type: ITEM_TYPES.THROWABLE, properties: { power: 5, throwEffect: 'pushback', hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } }
        ],
        3: [
            { name: 'Ninja star', type: ITEM_TYPES.THROWABLE, properties: { power: 15, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
            { name: 'Blink crystal', type: ITEM_TYPES.THROWABLE, properties: { throwEffect: 'blink', breakOnWall: true, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } }
        ],
        4: [
            { name: 'Javelin', type: ITEM_TYPES.THROWABLE, properties: { power: 20, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
            { name: 'Switch crystal', type: ITEM_TYPES.THROWABLE, properties: { throwEffect: 'switch', hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } }
        ]
    },
    weapon: {
        0: { name: 'Cheater sword', type: ITEM_TYPES.WEAPON, properties: { power: 9999, slots: 80, enchantments: [...CHEATER_WEAPON_ENCHANTMENTS], hiddenName: hiddenSword, burnable: false } },
        1: { name: 'Rusted sword', type: ITEM_TYPES.WEAPON, properties: { power: 3, slots: 7, hiddenName: hiddenSword, burnable: false } },
        2: { name: 'Bronze sword', type: ITEM_TYPES.WEAPON, properties: { power: 4, slots: 6, hiddenName: hiddenSword, burnable: false } },
        3: { name: 'Iron sword', type: ITEM_TYPES.WEAPON, properties: { power: 5, slots: 5, hiddenName: hiddenSword, burnable: false } },
        4: [
            { name: 'Fancy sword', type: ITEM_TYPES.WEAPON, properties: { power: 8, slots: 4, hiddenName: hiddenSword, burnable: false } },
            { name: 'Pickaxe', type: ITEM_TYPES.WEAPON, properties: { power: 1, slots: 0, breaksWalls: true, spawnImprovementMin: 5, spawnImprovementMax: 10, hiddenName: hiddenSword, burnable: false } }
        ]
    },
    armor: {
        0: { name: 'Cheater armor', type: ITEM_TYPES.ARMOR, properties: { armor: 9999, slots: 80, enchantments: [...CHEATER_ARMOR_ENCHANTMENTS], hiddenName: hiddenArmor, burnable: false } },
        1: { name: 'Rags', type: ITEM_TYPES.ARMOR, properties: { armor: 3, slots: 7, hiddenName: hiddenArmor, burnable: true } },
        2: { name: 'Leather armor', type: ITEM_TYPES.ARMOR, properties: { armor: 4, slots: 6, hiddenName: hiddenArmor, burnable: true } },
        3: { name: 'Chainmail armor', type: ITEM_TYPES.ARMOR, properties: { armor: 6, slots: 5, hiddenName: hiddenArmor, burnable: false } },
        4: { name: 'Plate armor', type: ITEM_TYPES.ARMOR, properties: { armor: 8, slots: 4, hiddenName: hiddenArmor, burnable: false } }
    },
    shield: {
        0: { name: 'Cheater shield', type: ITEM_TYPES.SHIELD, properties: { armor: 9999, slots: 80, enchantments: [...CHEATER_SHIELD_ENCHANTMENTS], hiddenName: hiddenShield, burnable: false } },
        1: { name: 'Rotten shield', type: ITEM_TYPES.SHIELD, properties: { armor: 3, slots: 7, hiddenName: hiddenShield, burnable: true } },
        2: { name: 'Wooden shield', type: ITEM_TYPES.SHIELD, properties: { armor: 4, slots: 6, hiddenName: hiddenShield, burnable: true } },
        3: { name: 'Kite shield', type: ITEM_TYPES.SHIELD, properties: { armor: 6, slots: 5, hiddenName: hiddenShield, burnable: false } },
        4: { name: 'Tower shield', type: ITEM_TYPES.SHIELD, properties: { armor: 8, slots: 4, hiddenName: hiddenShield, burnable: false } }
    },
    accessory: {
        0: { name: 'Cheater accessory', type: ITEM_TYPES.ACCESSORY, properties: { power: 9999, armor: 9999, slots: 80, enchantments: [...CHEATER_ACCESSORY_ENCHANTMENTS], hiddenName: hiddenAccessory, burnable: false } },
        1: [
            { name: 'Copper ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 5, slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Copper bracelet', type: ITEM_TYPES.ACCESSORY, properties: { armor: 5, slots: 3, hiddenName: hiddenAccessory, burnable: false } }
        ],
        2: [
            { name: 'Bronze ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 10, slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Bronze bracelet', type: ITEM_TYPES.ACCESSORY, properties: { armor: 10, slots: 3, hiddenName: hiddenAccessory, burnable: false } }
],
        3: [
            { name: 'Waterwalk ring', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['waterwalk'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Lavawalk bracelet', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['lavawalk'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Flying amulet', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['fly'], slots: 3, hiddenName: hiddenAccessory, burnable: false } }
        ],
        4: [
            { name: 'Scholar charm', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['scholar'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Sustenance charm', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['sustenance'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Vitality charm', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['vitality'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Hunter lens', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['enemySight'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Treasure lens', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['itemSight'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Appraiser monocle', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['appraiser'], slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Mining hardhat', type: ITEM_TYPES.ACCESSORY, properties: { enchantments: ['miner'], slots: 3, hiddenName: hiddenAccessory, burnable: false } }
        ]
    },
    statusConsumable: {
        1: [
            { name: 'Poison brew', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.POISONED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Sleeping draught', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SLEEP, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Fright powder', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.FRIGHTENED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Spoiled milk', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.HUNGRY, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        2: [
            { name: 'Viscous slime tincture', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SLOW, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false, dropOnlyEnemyTypes: [ENEMY_TYPES.SLIME] } },
            { name: 'Haste potion', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.HASTE, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        3: [
            { name: 'Methanol jug', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BLIND, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Invisibility salve', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.INVISIBLE, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Shard of madness', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BERSERK, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        4: [
            { name: 'Petrification salts', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BOUND, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Holy water', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BLESSED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Invincibility elixir', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.INVINCIBILITY, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Garlic chicken pizza', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SATIATED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ]
    },
    scroll: {
        1: [
            { name: 'Trap eraser scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'erase-traps', hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Mapping scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'map-floor', hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        2: [
            { name: 'Identifying scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'identify-item', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY, ITEM_TYPES.CONSUMABLE, ITEM_TYPES.THROWABLE], hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Gilding scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'add-gilded', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY], hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        3: [
            { name: 'Purifying scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'purify-item', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY, ITEM_TYPES.CONSUMABLE, ITEM_TYPES.THROWABLE], hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Warp scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'warp-player', hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        4: [
            { name: 'Earthly power scroll', type: ITEM_TYPES.CONSUMABLE, properties: { improvesItemTypes: [ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD], hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Heavenly power scroll', type: ITEM_TYPES.CONSUMABLE, properties: { improvesItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ACCESSORY], hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Slot adding scroll', type: ITEM_TYPES.CONSUMABLE, properties: { scrollEffect: 'add-slot', targetItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY], hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ]
    }
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
        { category: 'statusConsumable', tier: 4, weight: 2 },
        { category: 'scroll', tier: 4, weight: 1 },
        { category: 'throwable', tier: 4, weight: 3 },
        { category: 'weapon', tier: 4, weight: 2 },
        { category: 'armor', tier: 4, weight: 2 },
        { category: 'shield', tier: 4, weight: 2 },
        { category: 'accessory', tier: 4, weight: 1 }
    ]
};
