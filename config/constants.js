// Constants for the game

function deepFreezeConfig(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }

    for (const nestedValue of Object.values(value)) {
        if (nestedValue && typeof nestedValue === 'object') {
            deepFreezeConfig(nestedValue);
        }
    }

    return Object.freeze(value);
}

// Directions
const DIRECTIONS = deepFreezeConfig({
    NORTH: { x: 0, y: -1 },
    SOUTH: { x: 0, y: 1 },
    EAST: { x: 1, y: 0 },
    WEST: { x: -1, y: 0 },
    NORTHEAST: { x: 1, y: -1 },
    NORTHWEST: { x: -1, y: -1 },
    SOUTHEAST: { x: 1, y: 1 },
    SOUTHWEST: { x: -1, y: 1 }
});

// Tile types
// Each tile in the grid holds exactly one of these values. Actors
// (player, enemies) and items occupy a tile but are tracked separately
// in their own collections; they do not alter the tile type itself.
const TILE_TYPES = deepFreezeConfig({
    FLOOR: 'floor',
    WALL: 'wall',
    STAIRS_DOWN: 'stairs_down',
    STAIRS_UP: 'stairs_up',
    PIT: 'pit',
    WATER: 'water',
    SPIKE: 'spike',
    LAVA: 'lava',
    SHOP: 'shop'
});

// Weather types
const WEATHER_TYPES = deepFreezeConfig({
    NONE: 'none',
    FOGGY: 'foggy'
});

const WEATHER_DEFINITIONS = deepFreezeConfig({
    [WEATHER_TYPES.NONE]: {
        name: 'Clear',
        fovModifier: 0
    },
    [WEATHER_TYPES.FOGGY]: {
        name: 'Foggy',
        fovModifier: -3
    }
});

const WEATHER_GENERATION_CHANCE = 0.3;

// Hazard types
const HAZARD_TYPES = deepFreezeConfig({
    STEAM: 'steam',
    TRAP_SLOW: 'trap_slow',
    TRAP_SLEEP: 'trap_sleep',
    TRAP_BLIND: 'trap_blind',
    TRAP_BOUND: 'trap_bound',
    TRAP_POISON: 'trap_poison',
    TRAP_TRIP: 'trap_trip'
});

// Status conditions
const CONDITIONS = deepFreezeConfig({
    POISONED: 'poisoned',
    SLOW: 'slow',
    HASTE: 'haste',
    SLEEP: 'sleep',
    FRIGHTENED: 'frightened',
    BLIND: 'blind',
    CONFUSED: 'confused',
    INVISIBLE: 'invisible',
    HEAVY_HITTER: 'heavy_hitter',
    BERSERK: 'berserk',
    BOUND: 'bound',
    BLESSED: 'blessed',
    INVINCIBILITY: 'invincibility',
    SATIATED: 'satiated',
    HUNGRY: 'hungry'
});

// Enemy classifications and speeds
const ENEMY_TYPES = deepFreezeConfig({
    BEAST: 'beast',
    SLIME: 'slime',
    AQUATIC: 'aquatic',
    FLOATING: 'floating',
    GHOST: 'ghost',
    VANDAL: 'vandal',
    THIEF: 'thief',
    FUSER: 'fuser',
    PARIAH: 'pariah',
    CRAFTER: 'crafter',
    NPC: 'npc'
});

const ENEMY_SPEEDS = deepFreezeConfig({
    SLOW: 'slow',
    NORMAL: 'normal',
    FAST: 'fast'
});

// Condition and hazard rules
const CONDITION_RULES = deepFreezeConfig({
    [CONDITIONS.POISONED]: {
        duration: 10,
        tickDamage: 2
    },
    [CONDITIONS.SLOW]: {
        duration: 10
    },
    [CONDITIONS.HASTE]: {
        duration: 10
    },
    [CONDITIONS.SLEEP]: {
        duration: 10,
        removeOnAttacked: true
    },
    [CONDITIONS.FRIGHTENED]: {
        duration: 10
    },
    [CONDITIONS.BLIND]: {
        duration: 10
    },
    [CONDITIONS.INVISIBLE]: {
        duration: 10
    },
    [CONDITIONS.HEAVY_HITTER]: {
        duration: Infinity
    },
    [CONDITIONS.BERSERK]: {
        duration: 10
    },
    [CONDITIONS.BOUND]: {
        duration: 10
    },
    [CONDITIONS.BLESSED]: {
        duration: 10,
        surviveFatalDamage: true
    },
    [CONDITIONS.INVINCIBILITY]: {
        duration: 10,
        preventsDamage: true
    },
    [CONDITIONS.SATIATED]: {
        duration: Infinity,
        removeOnFloorChange: true,
        damageMultiplier: 1.25,
        preventsPassiveHungerLoss: true
    },
    [CONDITIONS.HUNGRY]: {
        duration: 5,
        tickHunger: -5,
        damageMultiplier: 0.5
    }
});

const HAZARD_DEFINITIONS = deepFreezeConfig({
    [HAZARD_TYPES.TRAP_SLOW]: {
        category: 'trap',
        condition: CONDITIONS.SLOW,
        message: 'You trigger a slowing trap.',
        icon: 'S'
    },
    [HAZARD_TYPES.TRAP_SLEEP]: {
        category: 'trap',
        condition: CONDITIONS.SLEEP,
        message: 'You trigger a sleep trap.',
        icon: 'Z'
    },
    [HAZARD_TYPES.TRAP_BLIND]: {
        category: 'trap',
        condition: CONDITIONS.BLIND,
        message: 'You trigger a blinding trap.',
        icon: 'B'
    },
    [HAZARD_TYPES.TRAP_BOUND]: {
        category: 'trap',
        condition: CONDITIONS.BOUND,
        message: 'You trigger a binding trap.',
        icon: 'X'
    },
    [HAZARD_TYPES.TRAP_POISON]: {
        category: 'trap',
        condition: CONDITIONS.POISONED,
        message: 'You trigger a poison trap.',
        icon: 'P'
    },
    [HAZARD_TYPES.TRAP_TRIP]: {
        category: 'trap',
        message: 'You trigger a tripping trap and drop your items!',
        icon: 'T'
    },
    [HAZARD_TYPES.STEAM]: {
        category: 'effect',
        damage: 5,
        spawnTile: TILE_TYPES.LAVA,
        generationChance: 0.2,
        activationChance: 0.08,
        dissipateChance: 0.18,
        message: 'Steam scalds you.'
    }
});

// Tile effects and traversal rules
// Enemies that are required to traverse a tile also ignore that tile's effects.
const TILE_EFFECT_RULES = deepFreezeConfig({
    [TILE_TYPES.SPIKE]: {
        damage: 3,
        enemyImmuneTypes: [ENEMY_TYPES.FLOATING, ENEMY_TYPES.GHOST]
    },
    [TILE_TYPES.PIT]: {
        damage: 10
    },
    [TILE_TYPES.WATER]: {
        damage: 5
    },
    [TILE_TYPES.LAVA]: {
        damage: 10,
        itemBurns: true
    }
});

const ENEMY_TILE_TRAVERSAL_RULES = deepFreezeConfig({
    [TILE_TYPES.WALL]: {
        requiredTypes: [ENEMY_TYPES.GHOST]
    },
    [TILE_TYPES.PIT]: {
        requiredTypes: [ENEMY_TYPES.FLOATING, ENEMY_TYPES.GHOST]
    },
    [TILE_TYPES.WATER]: {
        requiredTypes: [ENEMY_TYPES.AQUATIC, ENEMY_TYPES.FLOATING, ENEMY_TYPES.GHOST]
    },
    [TILE_TYPES.LAVA]: {
        requiredTypes: [ENEMY_TYPES.FLOATING, ENEMY_TYPES.GHOST]
    }
});

// Equipment and item types
const EQUIPMENT_SLOTS = deepFreezeConfig({
    WEAPON: 'weapon',
    ARMOR: 'armor',
    SHIELD: 'shield',
    ACCESSORY: 'accessory'
});

const ITEM_TYPES = deepFreezeConfig({
    MONEY: 'money',
    WEAPON: 'weapon',
    ARMOR: 'armor',
    SHIELD: 'shield',
    ACCESSORY: 'accessory',
    CONSUMABLE: 'consumable',
    THROWABLE: 'throwable',
    POT: 'pot'
});

// Item visuals and knowledge states
const ITEM_TYPE_COLORS = deepFreezeConfig({
    [ITEM_TYPES.MONEY]: '#c9a227',
    [ITEM_TYPES.CONSUMABLE]: '#0614df',
    [ITEM_TYPES.THROWABLE]: '#ebff3a',
    [ITEM_TYPES.POT]: '#8b5a2b',
    [ITEM_TYPES.WEAPON]: '#ff001e',
    [ITEM_TYPES.ARMOR]: '#02d625',
    [ITEM_TYPES.SHIELD]: '#e100ff',
    [ITEM_TYPES.ACCESSORY]: '#ff7b00'
});

function getItemTypeColor(itemType, fallback = '#000000') {
    if (!itemType) {
        return fallback;
    }

    return ITEM_TYPE_COLORS[itemType] || fallback;
}

const ITEM_KNOWLEDGE = deepFreezeConfig({
    UNKNOWN: 'unknown',
    IDENTIFIED: 'identified'
});

// AI and area types
const AI_TYPES = deepFreezeConfig({
    WANDER: 'wander',
    CHASE: 'chase',
    FLEE: 'flee',
    AMBUSH: 'ambush',
    GUARD: 'guard',
    BERSERK: 'berserk'
});

const AREA_TYPES = deepFreezeConfig({
    OVERWORLD: 'overworld',
    DUNGEON: 'dungeon',
    SWAMP: 'swamp',
    FLOATING: 'floating',
    CATACOMBS: 'catacombs'
});

// Throw-taming and generation tuning
const THROW_FOOD_TAMING_RULES = deepFreezeConfig({
    baseChance: 0.1,
    thresholdBaseline: 3,
    thresholdPenaltyPerPoint: 0.08,
    lowHpBonusScale: 0.65,
    itemTierBonusPerTier: 0.03,
    playerLevelBonusPerLevel: 0.007,
    playerLevelBonusCap: 0.1
});

// Combat and progression constants
const ATTACK_VARIANCE = deepFreezeConfig({
    MIN: 0.875,
    MAX: 1.125
});

const PLAYER_LEVEL_TOTAL_EXP = deepFreezeConfig({
    2: 10,
    3: 40,
    4: 100,
    5: 200,
    6: 400,
    7: 700,
    8: 1000,
    9: 1300,
    10: 1800,
    11: 2400,
    12: 3000,
    13: 3600,
    14: 4000,
    15: 4800,
    16: 5600,
    17: 6400,
    18: 7400,
    19: 8400,
    20: 9900
});

// Grid, camera, and shared colors
const GRID_SIZE = 50;
const TILE_SIZE = 16;
const CAMERA_VISIBLE_TILE_ROWS = 20;
const FOV_RANGE = 10;

const COLORS = deepFreezeConfig({
    STEAM: 'rgba(220, 220, 220, 0.6)',
    VISIBLE: 1.0,
    EXPLORED: 0.5,
    FOG_OVERLAY: 'rgba(100,100,100,0.5)'
});