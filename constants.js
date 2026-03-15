// Constants for the game
console.log('constants.js loaded');

// Directions
const DIRECTIONS = {
    NORTH: { x: 0, y: -1 },
    SOUTH: { x: 0, y: 1 },
    EAST: { x: 1, y: 0 },
    WEST: { x: -1, y: 0 },
    NORTHEAST: { x: 1, y: -1 },
    NORTHWEST: { x: -1, y: -1 },
    SOUTHEAST: { x: 1, y: 1 },
    SOUTHWEST: { x: -1, y: 1 }
};

// Tile types
// Each tile in the grid holds exactly one of these values.  Actors
// (player, enemies) and items occupy a tile but are tracked separately
// in their own collections; they do not alter the tile type itself.
const TILE_TYPES = {
    FLOOR: 'floor',
    WALL: 'wall',
    STAIRS_DOWN: 'stairs_down',
    STAIRS_UP: 'stairs_up',
    PIT: 'pit',
    WATER: 'water',
    SPIKE: 'spike',
    LAVA: 'lava'
};

const HAZARD_TYPES = {
    STEAM: 'steam',
    TRAP_SLOW: 'trap_slow',
    TRAP_SLEEP: 'trap_sleep',
    TRAP_BLIND: 'trap_blind',
    TRAP_BOUND: 'trap_bound',
    TRAP_POISON: 'trap_poison'
};

// Conditions
const CONDITIONS = {
    POISONED: 'poisoned',
    SLOW: 'slow',
    HASTE: 'haste',
    SLEEP: 'sleep',
    FRIGHTENED: 'frightened',
    BLIND: 'blind',
    INVISIBLE: 'invisible',
    BERSERK: 'berserk',
    BOUND: 'bound',
    BLESSED: 'blessed',
    INVINCIBILITY: 'invincibility',
    SATIATED: 'satiated',
    HUNGRY: 'hungry'
};

const ENEMY_TYPES = {
    BEAST: 'beast',
    SLIME: 'slime',
    AQUATIC: 'aquatic',
    FLOATING: 'floating',
    GHOST: 'ghost',
    VANDAL: 'vandal',
    THIEF: 'thief',
    FUSER: 'fuser',
    PARIAH: 'pariah',
    CRAFTER: 'Crafter',
    NPC: 'npc'
};

const ENEMY_SPEEDS = {
    SLOW: 'slow',
    NORMAL: 'normal',
    FAST: 'fast'
};

const CONDITION_RULES = {
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
        tickHunger: -5
    }
};

const HAZARD_DEFINITIONS = {
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
    [HAZARD_TYPES.STEAM]: {
        category: 'effect',
        damage: 5,
        spawnTile: TILE_TYPES.LAVA,
        generationChance: 0.2,
        activationChance: 0.08,
        dissipateChance: 0.18,
        message: 'Steam scalds you.'
    }
};

/* When an enemy is part of the ENEMY_TILE_TRAVERSAL_RULES it automatically ignores the tile's effects */
const TILE_EFFECT_RULES = {
    [TILE_TYPES.SPIKE]: {
        damage: 3,
        enemyImmuneTypes: [ENEMY_TYPES.FLOATING, ENEMY_TYPES.GHOST]
    },
    [TILE_TYPES.PIT]: {
        damage: 10,
    },
    [TILE_TYPES.WATER]: {
        damage: 5,
    },
    [TILE_TYPES.LAVA]: {
        damage: 10,
        itemBurns: true
    }
};

const ENEMY_TILE_TRAVERSAL_RULES = {
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
};

function getConditionDuration(condition, fallback = 1) {
    const configuredDuration = CONDITION_RULES[condition]?.duration;
    if (configuredDuration === Infinity || Number.isFinite(configuredDuration)) {
        return configuredDuration;
    }

    return fallback;
}

function getConditionRule(condition) {
    return CONDITION_RULES[condition] || null;
}

function getConditionTickDamage(condition, fallback = 0) {
    const tickDamage = CONDITION_RULES[condition]?.tickDamage;
    return Number.isFinite(tickDamage) ? tickDamage : fallback;
}

function getConditionTickHunger(condition, fallback = 0) {
    const tickHunger = CONDITION_RULES[condition]?.tickHunger;
    return Number.isFinite(tickHunger) ? tickHunger : fallback;
}

function shouldRemoveConditionOnFloorChange(condition) {
    return Boolean(CONDITION_RULES[condition]?.removeOnFloorChange);
}

function shouldRemoveConditionOnAttacked(condition) {
    return Boolean(CONDITION_RULES[condition]?.removeOnAttacked);
}

function conditionPreventsDamage(condition) {
    return Boolean(CONDITION_RULES[condition]?.preventsDamage);
}

function conditionSurvivesFatalDamage(condition) {
    return Boolean(CONDITION_RULES[condition]?.surviveFatalDamage);
}

function getConditionDamageMultiplier(condition, fallback = 1) {
    const multiplier = CONDITION_RULES[condition]?.damageMultiplier;
    return Number.isFinite(multiplier) ? multiplier : fallback;
}

function conditionPreventsPassiveHungerLoss(condition) {
    return Boolean(CONDITION_RULES[condition]?.preventsPassiveHungerLoss);
}

function getTrapDefinition(trapType) {
    const definition = HAZARD_DEFINITIONS[trapType] || null;
    return definition?.category === 'trap' ? definition : null;
}

function getTrapTypes() {
    return Object.keys(HAZARD_DEFINITIONS).filter((hazardType) => HAZARD_DEFINITIONS[hazardType]?.category === 'trap');
}

function getTileEffectRule(tileType) {
    return TILE_EFFECT_RULES[tileType] || null;
}

function getHazardEffectRule(hazardType) {
    const definition = HAZARD_DEFINITIONS[hazardType] || null;
    return definition?.category === 'effect' ? definition : null;
}

function getEnvironmentalDamageForTile(tileType, fallback = 0) {
    const damage = TILE_EFFECT_RULES[tileType]?.damage;
    return Number.isFinite(damage) ? damage : fallback;
}

function getEnvironmentalDamageForHazard(hazardType, fallback = 0) {
    const damage = getHazardEffectRule(hazardType)?.damage;
    return Number.isFinite(damage) ? damage : fallback;
}

function doesTileBurnItems(tileType) {
    return Boolean(TILE_EFFECT_RULES[tileType]?.itemBurns);
}

function canEnemyTypeTraverseTile(tileType, enemyTypes = []) {
    const rule = ENEMY_TILE_TRAVERSAL_RULES[tileType];
    if (!rule) {
        return true;
    }

    return rule.requiredTypes.some((enemyType) => enemyTypes.includes(enemyType));
}

function isEnemyTypeImmuneToTileEffect(tileType, enemyTypes = []) {
    const immuneTypes = TILE_EFFECT_RULES[tileType]?.enemyImmuneTypes || [];
    const traversalRequiredTypes = ENEMY_TILE_TRAVERSAL_RULES[tileType]?.requiredTypes || [];
    const combinedImmuneTypes = [...new Set([...immuneTypes, ...traversalRequiredTypes])];
    return combinedImmuneTypes.some((enemyType) => enemyTypes.includes(enemyType));
}

// Equipment slots
const EQUIPMENT_SLOTS = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    SHIELD: 'shield',
    ACCESSORY: 'accessory'
};

// Item types
const ITEM_TYPES = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    SHIELD: 'shield',
    ACCESSORY: 'accessory',
    CONSUMABLE: 'consumable',
    THROWABLE: 'throwable'
};

// Item knowledge states for unidentified item gameplay.
const ITEM_KNOWLEDGE = {
    UNKNOWN: 'unknown',
    IDENTIFIED: 'identified'
};

// Enemy AI types
const AI_TYPES = {
    WANDER: 'wander',
    CHASE: 'chase',
    FLEE: 'flee',
    PATROL: 'patrol',
    AMBUSH: 'ambush',
    SUPPORT: 'support',
    GUARD: 'guard'
};

// Region and generation styles for floor content.
const AREA_TYPES = {
    OVERWORLD: 'overworld',
    DUNGEON: 'dungeon',
    SWAMP: 'swamp',
    FLOATING: 'floating',
    CATACOMBS: 'catacombs'
};

// Runtime flags for systems that are scaffolded but not fully implemented.
const FEATURE_FLAGS = {
    ADVANCED_AI: false,
    AREA_GENERATION_VARIANTS: false,
    ITEM_IDENTIFICATION: true,
    CURSED_EQUIPMENT: true,
    TAMING_ALLIES: false,
    ALLY_EQUIPMENT: false,
    MAP_OVERLAY: false
};

const CATACOMBS_GENERATION_CONFIG = {
    roomPlacementAttempts: 320,
    minRoomCount: 16,
    targetRoomCountRatio: 0.5,
    roomMinSize: 4,
    roomMaxSize: 8,
    roomPadding: 1,
    hallwayHazardChance: 0.2,
    hallwayHazardTiles: [TILE_TYPES.LAVA, TILE_TYPES.WATER, TILE_TYPES.SPIKE]
};

const AREA_SELECTION_RULES = {
    floatingModulo: 9,
    floatingRemainder: 8,
    swampModulo: 7,
    swampRemainder: 5,
    dungeonModulo: 5,
    dungeonRemainder: 2
};

const ATTACK_VARIANCE = {
    MIN: 0.875,
    MAX: 1.125
};

// Total cumulative EXP needed to reach each level key.
const PLAYER_LEVEL_TOTAL_EXP = {
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
};

// Game constants
const GRID_SIZE = 50;
const TILE_SIZE = 16; // pixels
const CAMERA_RADIUS = 10;
const CAMERA_TILE_DIAMETER = CAMERA_RADIUS * 2 + 1;
const CANVAS_WIDTH = CAMERA_TILE_DIAMETER * TILE_SIZE;
const CANVAS_HEIGHT = CAMERA_TILE_DIAMETER * TILE_SIZE;
const FOV_RANGE = 10;

// Colors
const COLORS = {
    STEAM: 'rgba(220, 220, 220, 0.6)',
    VISIBLE: 1.0,
    EXPLORED: 0.5,
    FOG_OVERLAY: 'rgba(100,100,100,0.5)'
};

const TILE_VISUALS = {
    [TILE_TYPES.FLOOR]: { color: '#333', sprite: { x: 0, y: 0 } },
    [TILE_TYPES.WALL]: { color: '#0e0e0e', sprite: { x: 1, y: 0 } },
    [TILE_TYPES.PIT]: { color: '#8B4513', sprite: { x: 2, y: 0 }, icon: 'pit', foregroundColor: '#000' },
    [TILE_TYPES.WATER]: { color: '#0000FF', sprite: { x: 3, y: 0 } },
    [TILE_TYPES.SPIKE]: { color: '#666', sprite: { x: 4, y: 0 }, icon: 'spike', foregroundColor: '#d9d9d9', sourceHeight: 24, overdrawTop: 12 },
    [TILE_TYPES.STAIRS_DOWN]: { color: '#0ff', sprite: { x: 5, y: 0 }, glyph: '<', foregroundColor: '#fff' },
    [TILE_TYPES.STAIRS_UP]: { color: '#0ff', sprite: { x: 6, y: 0 }, glyph: '>', foregroundColor: '#fff' },
    [TILE_TYPES.LAVA]: { color: '#d9480f', sprite: { x: 7, y: 0 }, icon: 'lava', foregroundColor: '#ffb347' }
};

const TERRAIN_SPRITESHEET_PATH = 'terrain-spritesheet.png';
const TERRAIN_SPRITESHEET_VERSION = '3';
const TERRAIN_SPRITESHEET_TILE_SIZE = 16;
const TERRAIN_SPRITESHEET_TILE_HEIGHT = 24;

const ENTITY_VISUALS = {
    player: { color: '#fff', miniMapInset: 0 },
    enemy: { color: '#f00', miniMapInset: 0 },
    npc: { color: '#22c55e', miniMapInset: 0 },
    item: { color: '#ff0', miniMapInset: 4, miniMapInsetMap: 2 }
};

const UI_VISUALS = {
    playerFacingArrow: '#111',
    mapPlayerOutline: '#000',
    trapBackdrop: 'rgba(0, 0, 0, 0.35)',
    trapIcon: '#ffd166'
};

const INPUT_DIRECTION_BINDINGS = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 },
    s: { dx: 0, dy: 1 },
    a: { dx: -1, dy: 0 },
    d: { dx: 1, dy: 0 }
};

const INPUT_ACTION_BINDINGS = {
    i: 'open-inventory',
    m: 'toggle-map',
    t: 'tame-nearest',
    v: 'debug-reveal-fov',
    b: 'debug-toggle-monsters'
};

const INVENTORY_ACTIONS_BY_TYPE = {
    [ITEM_TYPES.THROWABLE]: ['throw', 'drop'],
    [ITEM_TYPES.WEAPON]: ['equip', 'throw', 'drop'],
    [ITEM_TYPES.ARMOR]: ['equip', 'throw', 'drop'],
    [ITEM_TYPES.SHIELD]: ['equip', 'throw', 'drop'],
    [ITEM_TYPES.ACCESSORY]: ['equip', 'throw', 'drop'],
    default: ['use', 'throw', 'drop']
};

const AREA_GENERATION_RULES = {
    [AREA_TYPES.OVERWORLD]: {
        boundaryTile: TILE_TYPES.WALL,
        baseTile: TILE_TYPES.FLOOR,
        replacementRules: []
    },
    [AREA_TYPES.DUNGEON]: {
        boundaryTile: TILE_TYPES.WALL,
        baseTile: TILE_TYPES.FLOOR,
        replacementRules: [
            { chance: 0.1, tile: TILE_TYPES.WALL },
            { chance: 0.05, choices: [TILE_TYPES.PIT, TILE_TYPES.WATER, TILE_TYPES.SPIKE, TILE_TYPES.LAVA] }
        ]
    },
    [AREA_TYPES.SWAMP]: {
        boundaryTile: TILE_TYPES.WALL,
        baseTile: TILE_TYPES.FLOOR,
        replacementRules: [
            { chance: 0.25, tile: TILE_TYPES.WATER },
            { chance: 0.06, tile: TILE_TYPES.WALL }
        ],
        walkers: {
            count: 4,
            steps: GRID_SIZE * 2,
            cardinalOnly: true
        }
    },
    [AREA_TYPES.FLOATING]: {
        boundaryTile: TILE_TYPES.PIT,
        baseTile: TILE_TYPES.FLOOR,
        replacementRules: [
            { chance: 0.12, tile: TILE_TYPES.PIT }
        ]
    },
    [AREA_TYPES.CATACOMBS]: {
        boundaryTile: TILE_TYPES.WALL,
        baseTile: TILE_TYPES.WALL,
        replacementRules: []
    }
};

const PREMADE_TERRAIN_LEGEND = {
    '.': TILE_TYPES.FLOOR,
    '~': TILE_TYPES.WATER,
    L: TILE_TYPES.LAVA,
    P: TILE_TYPES.PIT
};

const PREMADE_TERRAIN_SHAPES = {
    island_2x2: {
        rows: [
            '~~~~',
            '~..~',
            '~..~',
            '~~~~'
        ]
    },
    lava_pool_3x2: {
        rows: [
            '.....',
            '.LLL.',
            '.LLL.',
            '.....'
        ]
    },
    pit_cross: {
        rows: [
            '..P..',
            '.PPP.',
            'PPPPP',
            '.PPP.',
            '..P..'
        ]
    }
};

const PREMADE_TERRAIN_PLACEMENT_RULES = {
    [AREA_TYPES.OVERWORLD]: [],
    [AREA_TYPES.DUNGEON]: [
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.45 },
        { shapeId: 'lava_pool_3x2', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.35 },
        { shapeId: 'island_2x2', minFloor: 0, minCount: 1, maxCount: 3, chance: 0.9 }
    ],
    [AREA_TYPES.SWAMP]: [
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.45 },
        { shapeId: 'island_2x2', minFloor: 0, minCount: 1, maxCount: 3, chance: 0.9 }
    ],
    [AREA_TYPES.FLOATING]: [
        { shapeId: 'island_2x2', minFloor: 0, minCount: 0, maxCount: 2, chance: 0.6 },
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.4 }
    ],
    [AREA_TYPES.CATACOMBS]: []
};

const ENEMY_SPEED_MULTIPLIERS = {
    [ENEMY_SPEEDS.SLOW]: 0.5,
    [ENEMY_SPEEDS.NORMAL]: 1,
    [ENEMY_SPEEDS.FAST]: 2
};

const ENEMY_AI_ACTION_METHODS = {
    [AI_TYPES.CHASE]: 'performChaseAction',
    [AI_TYPES.FLEE]: 'flee',
    [AI_TYPES.PATROL]: 'performPatrolAction',
    [AI_TYPES.AMBUSH]: 'performAmbushAction',
    [AI_TYPES.SUPPORT]: 'performSupportAction',
    [AI_TYPES.GUARD]: 'performGuardAction',
    [AI_TYPES.WANDER]: 'performWanderAction'
};

const ENEMY_FAMILY_DEFINITIONS = {
    slime: {
        defaults: { types: [ENEMY_TYPES.SLIME], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 9 },
        tiers: {
            1: { key: 'slimeTier1', displayName: 'Green slime', health: 8, power: 3, armor: 4, exp: 2, tameThreshold: 3, spawnWeight: 12, minFloor: 0 },
            2: { key: 'slimeTier2', displayName: 'Blue slime', health: 11, power: 5, armor: 8, exp: 5, tameThreshold: 4, spawnWeight: 10, minFloor: 1 },
            3: { key: 'slimeTier3', displayName: 'Rare slime', health: 5, power: 100, armor: 100, exp: 2000, tameThreshold: 5, aiType: AI_TYPES.SUPPORT, spawnWeight: 1, minFloor: 4 },
            4: { key: 'slimeTier4', displayName: 'Shiny slime', health: 20, power: 100, armor: 999, exp: 3333, tameThreshold: 6, aiType: AI_TYPES.SUPPORT, speed: ENEMY_SPEEDS.FAST, spawnWeight: 1, minFloor: 6, guaranteedMoneyDrop: 2500 }
        }
    },
    ghost: {
        defaults: { types: [ENEMY_TYPES.GHOST, ENEMY_TYPES.FLOATING], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.AMBUSH, fovRange: 11 },
        tiers: {
            1: { key: 'ghostTier1', displayName: 'Wisp', health: 23, power: 16, armor: 10, exp: 25, tameThreshold: 3, spawnWeight: 8, minFloor: 1 },
            2: { key: 'ghostTier2', displayName: 'Shadow', health: 60, power: 35, armor: 22, exp: 250, tameThreshold: 4, spawnWeight: 6, minFloor: 3 },
            3: { key: 'ghostTier3', displayName: 'Wraith', health: 100, power: 50, armor: 30, exp: 800, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'ghostTier4', displayName: 'Reaper', health: 185, power: 175, armor: 35, exp: 1850, tameThreshold: 6, spawnWeight: 2, minFloor: 7 }
        }
    },
    beast: {
        defaults: { types: [ENEMY_TYPES.BEAST], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 10 },
        tiers: {
            1: { key: 'beastTier1', displayName: 'Hyena', health: 15, power: 9, armor: 4, exp: 12, tameThreshold: 3, spawnWeight: 12, minFloor: 1},
            2: { key: 'beastTier2', displayName: 'Wolf', health: 45, power: 23, armor: 10, exp: 27, tameThreshold: 4, spawnWeight: 8, minFloor: 3},
            3: { key: 'beastTier3', displayName: 'Dire wolf', health: 85, power: 40, armor: 33, exp: 350, tameThreshold: 5, spawnWeight: 3, minFloor: 5},
            4: { key: 'beastTier4', displayName: 'Lion', health: 185, power: 60, armor: 40, exp: 1350, tameThreshold: 6, spawnWeight: 1, minFloor: 7, speed: ENEMY_SPEEDS.FAST},
        }
    },
    aquatic: {
        defaults: { types: [ENEMY_TYPES.AQUATIC], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 10 },
        tiers: {
            1: { key: 'aquaticTier1', displayName: 'Large frog', health: 16, power: 8, armor: 3, exp: 14, tameThreshold: 3, spawnWeight: 10, minFloor: 1 },
            2: { key: 'aquaticTier2', displayName: 'Snake', health: 40, power: 20, armor: 9, exp: 70, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'aquaticTier3', displayName: 'Crocodile', health: 92, power: 38, armor: 22, exp: 360, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'aquaticTier4', displayName: 'Hippo', health: 165, power: 58, armor: 34, exp: 1450, tameThreshold: 6, spawnWeight: 2, minFloor: 7 },
        }
    },
    floating: {
        defaults: { types: [ENEMY_TYPES.FLOATING], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 11 },
        tiers: {
            1: { key: 'floatingTier1', displayName: 'Raven', health: 12, power: 9, armor: 2, exp: 16, tameThreshold: 3, spawnWeight: 9, minFloor: 1 },
            2: { key: 'floatingTier2', displayName: 'Hawk', health: 34, power: 22, armor: 8, exp: 78, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'floatingTier3', displayName: 'Giant Eagle', health: 74, power: 41, armor: 17, exp: 390, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'floatingTier4', displayName: 'Roc', health: 135, power: 60, armor: 28, exp: 1500, tameThreshold: 6, spawnWeight: 2, minFloor: 7 },
        }
    },
    vandal: {
        defaults: { types: [ENEMY_TYPES.VANDAL], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.CHASE, fovRange: 10 },
        tiers: {
            1: { key: 'vandalTier1', displayName: 'Mischief maker', health: 18, power: 10, armor: 5, exp: 18, tameThreshold: 3, spawnWeight: 10, minFloor: 1 },
            2: { key: 'vandalTier2', displayName: 'Ruffian', health: 48, power: 24, armor: 12, exp: 95, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'vandalTier3', displayName: 'Scoundrel', health: 95, power: 44, armor: 24, exp: 430, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'vandalTier4', displayName: 'Brute', health: 170, power: 65, armor: 36, exp: 1600, tameThreshold: 6, spawnWeight: 2, minFloor: 7 },
        }
    },
    thief: {
        defaults: { types: [ENEMY_TYPES.THIEF], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.CHASE, fovRange: 12 },
        tiers: {
            1: { key: 'thiefTier1', displayName: 'Pickpocket', health: 12, power: 9, armor: 3, exp: 15, tameThreshold: 3, spawnWeight: 9, minFloor: 1 },
            2: { key: 'thiefTier2', displayName: 'Snatcher', health: 35, power: 21, armor: 9, exp: 80, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'thiefTier3', displayName: 'Bandit', health: 70, power: 36, armor: 18, exp: 320, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'thiefTier4', displayName: 'Master thief', health: 120, power: 55, armor: 28, exp: 1200, tameThreshold: 6, spawnWeight: 2, minFloor: 7 },
        }
    },
    fuser: {
        defaults: { types: [ENEMY_TYPES.FUSER], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.PATROL, fovRange: 11 },
        tiers: {
            1: { key: 'fuserTier1', displayName: 'Pixy', health: 17, power: 10, armor: 4, exp: 20, tameThreshold: 3, spawnWeight: 8, minFloor: 2 },
            2: { key: 'fuserTier2', displayName: 'Boggart', health: 45, power: 25, armor: 11, exp: 105, tameThreshold: 4, spawnWeight: 6, minFloor: 4 },
            3: { key: 'fuserTier3', displayName: 'Fae', health: 88, power: 43, armor: 23, exp: 500, tameThreshold: 5, spawnWeight: 4, minFloor: 6 },
            4: { key: 'fuserTier4', displayName: 'Homunculus', health: 155, power: 62, armor: 34, exp: 1750, tameThreshold: 6, spawnWeight: 2, minFloor: 8 },
        }
    },
    pariah: {
        defaults: { types: [ENEMY_TYPES.PARIAH], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.AMBUSH, fovRange: 11 },
        tiers: {
            1: { key: 'pariahTier1', displayName: 'Leper', health: 14, power: 11, armor: 3, exp: 22, tameThreshold: 3, spawnWeight: 8, minFloor: 2 },
            2: { key: 'pariahTier2', displayName: 'Reject', health: 42, power: 27, armor: 9, exp: 115, tameThreshold: 4, spawnWeight: 6, minFloor: 4 },
            3: { key: 'pariahTier3', displayName: 'Outcast', health: 82, power: 46, armor: 20, exp: 540, tameThreshold: 5, spawnWeight: 4, minFloor: 6 },
            4: { key: 'pariahTier4', displayName: 'Exile', health: 145, power: 66, armor: 31, exp: 1900, tameThreshold: 6, spawnWeight: 2, minFloor: 8 },
        }
    },
    crafter: {
        defaults: { types: [ENEMY_TYPES.CRAFTER], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.GUARD, fovRange: 10 },
        tiers: {
            1: { key: 'crafterTier1', displayName: 'Snarer', health: 20, power: 8, armor: 6, exp: 25, tameThreshold: 3, spawnWeight: 8, minFloor: 2 },
            2: { key: 'crafterTier2', displayName: 'Trapper', health: 55, power: 22, armor: 16, exp: 130, tameThreshold: 4, spawnWeight: 6, minFloor: 4 },
            3: { key: 'crafterTier3', displayName: 'Schemer', health: 100, power: 38, armor: 30, exp: 620, tameThreshold: 5, spawnWeight: 4, minFloor: 6 },
            4: { key: 'crafterTier4', displayName: 'Illaqueator', health: 175, power: 54, armor: 44, exp: 2100, tameThreshold: 6, spawnWeight: 2, minFloor: 8 },
        }
    },
    npc: {
        defaults: { types: [ENEMY_TYPES.NPC], speed: ENEMY_SPEEDS.SLOW, aiType: AI_TYPES.WANDER, fovRange: 8 },
        tiers: {
            1: { key: 'npcTier1', displayName: 'Wandering merchant', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 2, minFloor: 0 }
        }
    }
};

function getTileVisual(tileType) {
    return TILE_VISUALS[tileType] || TILE_VISUALS[TILE_TYPES.FLOOR];
}

function getEntityVisual(entityKind, entity = null) {
    if (entityKind === 'enemy' && entity && typeof entity.isNeutralNpc === 'function' && entity.isNeutralNpc()) {
        return ENTITY_VISUALS.npc;
    }

    return ENTITY_VISUALS[entityKind] || ENTITY_VISUALS.enemy;
}

function normalizeMoveInputKey(key, lowerKey = String(key).toLowerCase()) {
    if (Object.prototype.hasOwnProperty.call(INPUT_DIRECTION_BINDINGS, key)) {
        return key;
    }
    if (Object.prototype.hasOwnProperty.call(INPUT_DIRECTION_BINDINGS, lowerKey)) {
        return lowerKey;
    }
    return null;
}

function getDirectionForInputKey(key, lowerKey = String(key).toLowerCase()) {
    const normalizedKey = normalizeMoveInputKey(key, lowerKey);
    return normalizedKey ? INPUT_DIRECTION_BINDINGS[normalizedKey] : null;
}

function getInputActionForKey(lowerKey) {
    return INPUT_ACTION_BINDINGS[lowerKey] || null;
}

function getInventoryActionsForItemType(itemType) {
    return INVENTORY_ACTIONS_BY_TYPE[itemType] || INVENTORY_ACTIONS_BY_TYPE.default;
}

function getAreaGenerationRule(areaType) {
    return AREA_GENERATION_RULES[areaType] || AREA_GENERATION_RULES[AREA_TYPES.DUNGEON];
}

function getCatacombsGenerationConfig() {
    return CATACOMBS_GENERATION_CONFIG;
}

function getAreaSelectionRules() {
    return AREA_SELECTION_RULES;
}

function getPremadeTerrainShape(shapeId) {
    return PREMADE_TERRAIN_SHAPES[shapeId] || null;
}

function getPremadeTerrainLegend() {
    return PREMADE_TERRAIN_LEGEND;
}

function getPremadeTerrainPlacementRules(areaType) {
    return PREMADE_TERRAIN_PLACEMENT_RULES[areaType] || [];
}

function getPremadeTerrainPlacementRulesForFloor(areaType, floorIndex) {
    return getWeightedEntriesForFloor(getPremadeTerrainPlacementRules(areaType), floorIndex);
}

function getEnemySpeedMultiplier(speed) {
    return ENEMY_SPEED_MULTIPLIERS[speed] ?? ENEMY_SPEED_MULTIPLIERS[ENEMY_SPEEDS.NORMAL];
}

function getEnemyAiActionMethod(aiType) {
    return ENEMY_AI_ACTION_METHODS[aiType] || ENEMY_AI_ACTION_METHODS[AI_TYPES.WANDER];
}

function buildEnemyTemplates() {
    const templates = {};
    for (const family of Object.values(ENEMY_FAMILY_DEFINITIONS)) {
        for (const tierDefinition of Object.values(family.tiers)) {
            templates[tierDefinition.key] = {
                ...family.defaults,
                ...tierDefinition,
                types: tierDefinition.types || family.defaults.types || []
            };
        }
    }
    return templates;
}

function getWeightedEntriesForFloor(entries, floorIndex) {
    return entries.filter((entry) => {
        const minFloor = Number.isFinite(entry.minFloor) ? entry.minFloor : 0;
        const maxFloor = Number.isFinite(entry.maxFloor) ? entry.maxFloor : Infinity;
        return floorIndex >= minFloor && floorIndex <= maxFloor;
    });
}

function getSortedDefinedPlayerExpLevels() {
    return Object.keys(PLAYER_LEVEL_TOTAL_EXP)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
}

function getPlayerTotalExpForLevel(level) {
    if (level <= 1) {
        return 0;
    }

    if (Number.isFinite(PLAYER_LEVEL_TOTAL_EXP[level])) {
        return PLAYER_LEVEL_TOTAL_EXP[level];
    }

    const definedLevels = getSortedDefinedPlayerExpLevels();
    const highestDefinedLevel = definedLevels[definedLevels.length - 1];
    if (!Number.isFinite(highestDefinedLevel)) {
        return Math.max(0, level - 1) * 10;
    }

    const previousDefinedLevel = definedLevels.length > 1
        ? definedLevels[definedLevels.length - 2]
        : 1;
    const highestDefinedTotal = PLAYER_LEVEL_TOTAL_EXP[highestDefinedLevel];
    const previousDefinedTotal = previousDefinedLevel > 1
        ? PLAYER_LEVEL_TOTAL_EXP[previousDefinedLevel]
        : 0;

    let stepRequirement = Math.max(1, highestDefinedTotal - previousDefinedTotal);
    let total = highestDefinedTotal;
    for (let nextLevel = highestDefinedLevel + 1; nextLevel <= level; nextLevel++) {
        stepRequirement = Math.max(1, Math.floor(stepRequirement * 1.5));
        total += stepRequirement;
    }

    return total;
}

function getExpRequiredForPlayerLevel(level) {
    const targetTotal = getPlayerTotalExpForLevel(level);
    const previousTotal = getPlayerTotalExpForLevel(level - 1);
    const required = targetTotal - previousTotal;
    return Number.isFinite(required) && required > 0 ? required : 10;
}

function getAttackVarianceMultiplier(randomFn = Math.random) {
    const roll = typeof randomFn === 'function' ? randomFn() : Math.random();
    const normalizedRoll = Number.isFinite(roll) ? clamp(roll, 0, 1) : Math.random();
    return ATTACK_VARIANCE.MIN + (ATTACK_VARIANCE.MAX - ATTACK_VARIANCE.MIN) * normalizedRoll;
}

function calculateStandardAttackDamage(attackPower, randomFn = Math.random) {
    const normalizedPower = Math.max(0, Number(attackPower) || 0);
    const variance = getAttackVarianceMultiplier(randomFn);
    return Math.max(1, Math.round(normalizedPower * variance) + 1);
}

function applyDamageToActor(actor, incomingDamage, defenseValue = 0) {
    if (!actor) {
        return 0;
    }

    const normalizedIncomingDamage = Math.max(0, Number(incomingDamage) || 0);
    const normalizedDefense = Math.max(0, Number(defenseValue) || 0);
    if (normalizedIncomingDamage <= 0) {
        return 0;
    }

    const activeConditions = Array.from(actor.conditions?.keys?.() || []);
    if (activeConditions.some((condition) => conditionPreventsDamage(condition))) {
        return 0;
    }

    const mitigatedDamage = Math.max(1, normalizedIncomingDamage - normalizedDefense);
    const nextHealth = actor.health - mitigatedDamage;
    const fatalProtectionCondition = activeConditions.find((condition) => conditionSurvivesFatalDamage(condition));

    if (nextHealth <= 0 && fatalProtectionCondition) {
        const dealtDamage = Math.max(0, actor.health - 1);
        actor.health = Math.max(1, actor.health - dealtDamage);
        if (typeof actor.removeCondition === 'function') {
            actor.removeCondition(fatalProtectionCondition);
        } else if (actor.conditions instanceof Map) {
            actor.conditions.delete(fatalProtectionCondition);
        }
        return dealtDamage;
    }

    actor.health = Math.max(0, nextHealth);
    return Math.min(mitigatedDamage, actor.health + mitigatedDamage);
}

function applyStandardAttackToTarget(target, attackPower, randomFn = Math.random, attacker = null) {
    if (!target) {
        return 0;
    }

    const rolledDamage = calculateStandardAttackDamage(attackPower, randomFn);

    const damage = typeof target.takeDamage === 'function'
        ? target.takeDamage(rolledDamage, attacker)
        : applyDamageToActor(target, rolledDamage);

    if (damage > 0 && typeof target.onAttacked === 'function') {
        target.onAttacked();
    }

    return damage || 0;
}
