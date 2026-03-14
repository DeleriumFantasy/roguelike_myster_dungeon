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
    FUSER: 'fuser',
    PARIAH: 'pariah',
    CRAFTER: 'Crafter'
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
        duration: 10,
        removeOnFloorChange: true,
        damageMultiplier: 1.25,
        preventsPassiveHungerLoss: true
    },
    [CONDITIONS.HUNGRY]: {
        duration: 10,
        tickHunger: -5
    }
};

const TRAP_DEFINITIONS = {
    [HAZARD_TYPES.TRAP_SLOW]: {
        condition: CONDITIONS.SLOW,
        message: 'You trigger a slowing trap.',
        icon: 'S'
    },
    [HAZARD_TYPES.TRAP_SLEEP]: {
        condition: CONDITIONS.SLEEP,
        message: 'You trigger a sleep trap.',
        icon: 'Z'
    },
    [HAZARD_TYPES.TRAP_BLIND]: {
        condition: CONDITIONS.BLIND,
        message: 'You trigger a blinding trap.',
        icon: 'B'
    },
    [HAZARD_TYPES.TRAP_BOUND]: {
        condition: CONDITIONS.BOUND,
        message: 'You trigger a binding trap.',
        icon: 'N'
    },
    [HAZARD_TYPES.TRAP_POISON]: {
        condition: CONDITIONS.POISONED,
        message: 'You trigger a poison trap.',
        icon: 'P'
    }
};

const TILE_EFFECT_RULES = {
    [TILE_TYPES.PIT]: {
        damage: 5
    },
    [TILE_TYPES.WATER]: {
        damage: 5
    },
    [TILE_TYPES.SPIKE]: {
        damage: 3,
        enemyImmuneTypes: [ENEMY_TYPES.FLOATING, ENEMY_TYPES.GHOST]
    },
    [TILE_TYPES.LAVA]: {
        damage: 7,
        enemyImmuneTypes: [ENEMY_TYPES.FLOATING, ENEMY_TYPES.GHOST],
        itemBurns: true
    }
};

const HAZARD_EFFECT_RULES = {
    [HAZARD_TYPES.STEAM]: {
        damage: 4,
        spawnTile: TILE_TYPES.LAVA,
        generationChance: 0.2,
        activationChance: 0.08,
        dissipateChance: 0.18,
        message: 'Steam scalds you.'
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
    if (Number.isFinite(configuredDuration)) {
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
    return TRAP_DEFINITIONS[trapType] || null;
}

function getTrapTypes() {
    return Object.keys(TRAP_DEFINITIONS);
}

function getTileEffectRule(tileType) {
    return TILE_EFFECT_RULES[tileType] || null;
}

function getHazardEffectRule(hazardType) {
    return HAZARD_EFFECT_RULES[hazardType] || null;
}

function getEnvironmentalDamageForTile(tileType, fallback = 0) {
    const damage = TILE_EFFECT_RULES[tileType]?.damage;
    return Number.isFinite(damage) ? damage : fallback;
}

function getEnvironmentalDamageForHazard(hazardType, fallback = 0) {
    const damage = HAZARD_EFFECT_RULES[hazardType]?.damage;
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
    return immuneTypes.some((enemyType) => enemyTypes.includes(enemyType));
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
    DUNGEON: 'dungeon',
    SWAMP: 'swamp',
    FLOATING: 'floating'
};

// Planned save system metadata.
const SAVE_CONFIG = {
    VERSION: 1,
    STORAGE_KEY: 'roguelike-save-v1'
};

// Runtime flags for systems that are scaffolded but not fully implemented.
const FEATURE_FLAGS = {
    ADVANCED_AI: false,
    AREA_GENERATION_VARIANTS: false,
    SAVE_LOAD: false,
    ITEM_IDENTIFICATION: true,
    CURSED_EQUIPMENT: true,
    TAMING_ALLIES: false,
    ALLY_EQUIPMENT: false,
    MAP_OVERLAY: false
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
    FLOOR: '#333',
    WALL: '#0e0e0e',
    PIT: '#8B4513',    
    WATER: '#0000FF',    
    SPIKE: '#666',    
    LAVA: '#d9480f',
    STEAM: 'rgba(220, 220, 220, 0.6)',
    STAIRS: '#0ff',
    PLAYER: '#fff',
    ENEMY: '#f00',
    ITEM: '#ff0',
    VISIBLE: 1.0,
    EXPLORED: 0.5,
    UNEXPLORED: 0.0,
    FOG_OVERLAY: 'rgba(100,100,100,0.5)'
};

const TILE_VISUALS = {
    [TILE_TYPES.FLOOR]: { color: COLORS.FLOOR, sprite: { x: 0, y: 0 } },
    [TILE_TYPES.WALL]: { color: COLORS.WALL, sprite: { x: 1, y: 0 } },
    [TILE_TYPES.PIT]: { color: COLORS.PIT, sprite: { x: 2, y: 0 }, icon: 'pit' },
    [TILE_TYPES.WATER]: { color: COLORS.WATER, sprite: { x: 3, y: 0 } },
    [TILE_TYPES.SPIKE]: { color: COLORS.SPIKE, sprite: { x: 4, y: 0 }, icon: 'spike' },
    [TILE_TYPES.STAIRS_DOWN]: { color: COLORS.STAIRS, sprite: { x: 5, y: 0 }, glyph: '>' },
    [TILE_TYPES.STAIRS_UP]: { color: COLORS.STAIRS, sprite: { x: 6, y: 0 }, glyph: '<' },
    [TILE_TYPES.LAVA]: { color: COLORS.LAVA, sprite: { x: 7, y: 0 }, icon: 'lava' }
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
    k: 'quick-save',
    l: 'quick-load',
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
    }
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
            4: { key: 'slimeTier4', displayName: 'Shiny slime', health: 20, power: 100, armor: 999, exp: 3333, tameThreshold: 6, aiType: AI_TYPES.SUPPORT, speed: ENEMY_SPEEDS.FAST, spawnWeight: 1, minFloor: 6 }
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
        defaults: { speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, health: 1, power: 1, armor: 1, exp: 1, fovRange: 10, tameThreshold: 1, spawnWeight: 3, minFloor: 0 },
        tiers: {
            1: { key: 'beastTier1', displayName: 'Wolf', types: [ENEMY_TYPES.BEAST] },
            2: { key: 'beastTier2', displayName: 'Wolf', types: [ENEMY_TYPES.BEAST] },
            3: { key: 'beastTier3', displayName: 'Wolf', types: [ENEMY_TYPES.BEAST] },
            4: { key: 'beastTier4', displayName: 'Wolf', types: [ENEMY_TYPES.BEAST] },
        }
    },
    aquatic: {
        defaults: { speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, health: 1, power: 1, armor: 1, exp: 1, fovRange: 10, tameThreshold: 1, spawnWeight: 3, minFloor: 0 },
        tiers: {
            1: { key: 'aquaticTier1', displayName: 'Fish', types: [ENEMY_TYPES.AQUATIC] },
            2: { key: 'aquaticTier2', displayName: 'Fish', types: [ENEMY_TYPES.AQUATIC] },
            3: { key: 'aquaticTier3', displayName: 'Fish', types: [ENEMY_TYPES.AQUATIC] },
            4: { key: 'aquaticTier4', displayName: 'Fish', types: [ENEMY_TYPES.AQUATIC] },
        }
    },
    floating: {
        defaults: { speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, health: 1, power: 1, armor: 1, exp: 1, fovRange: 10, tameThreshold: 1, spawnWeight: 3, minFloor: 0 },
        tiers: {
            1: { key: 'floatingTier1', displayName: 'Bird', types: [ENEMY_TYPES.FLOATING] },
            2: { key: 'floatingTier2', displayName: 'Bird', types: [ENEMY_TYPES.FLOATING] },
            3: { key: 'floatingTier3', displayName: 'Bird', types: [ENEMY_TYPES.FLOATING] },
            4: { key: 'floatingTier4', displayName: 'Bird', types: [ENEMY_TYPES.FLOATING] },
        }
    },
    vandal: {
        defaults: { speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, health: 1, power: 1, armor: 1, exp: 1, fovRange: 10, tameThreshold: 1, spawnWeight: 3, minFloor: 0 },
        tiers: {
            1: { key: 'vandalTier1', displayName: 'Vandal', types: [ENEMY_TYPES.VANDAL] },
            2: { key: 'vandalTier2', displayName: 'Vandal', types: [ENEMY_TYPES.VANDAL] },
            3: { key: 'vandalTier3', displayName: 'Vandal', types: [ENEMY_TYPES.VANDAL] },
            4: { key: 'vandalTier4', displayName: 'Vandal', types: [ENEMY_TYPES.VANDAL] },
        }
    },
    fuser: {
        defaults: { speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, health: 1, power: 1, armor: 1, exp: 1, fovRange: 10, tameThreshold: 1, spawnWeight: 3, minFloor: 0 },
        tiers: {
            1: { key: 'fuserTier1', displayName: 'Fuser', types: [ENEMY_TYPES.FUSER] },
            2: { key: 'fuserTier2', displayName: 'Fuser', types: [ENEMY_TYPES.FUSER] },
            3: { key: 'fuserTier3', displayName: 'Fuser', types: [ENEMY_TYPES.FUSER] },
            4: { key: 'fuserTier4', displayName: 'Fuser', types: [ENEMY_TYPES.FUSER] },
        }
    },
    pariah: {
        defaults: { speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, health: 1, power: 1, armor: 1, exp: 1, fovRange: 10, tameThreshold: 1, spawnWeight: 3, minFloor: 0 },
        tiers: {
            1: { key: 'pariahTier1', displayName: 'Pariah', types: [ENEMY_TYPES.PARIAH] },
            2: { key: 'pariahTier2', displayName: 'Pariah', types: [ENEMY_TYPES.PARIAH] },
            3: { key: 'pariahTier3', displayName: 'Pariah', types: [ENEMY_TYPES.PARIAH] },
            4: { key: 'pariahTier4', displayName: 'Pariah', types: [ENEMY_TYPES.PARIAH] },
        }
    },
    crafter: {
        defaults: { speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, health: 1, power: 1, armor: 1, exp: 1, fovRange: 10, tameThreshold: 1, spawnWeight: 3, minFloor: 0 },
        tiers: {
            1: { key: 'crafterTier1', displayName: 'Trapper', types: [ENEMY_TYPES.CRAFTER] },
            2: { key: 'crafterTier2', displayName: 'Trapper', types: [ENEMY_TYPES.CRAFTER] },
            3: { key: 'crafterTier3', displayName: 'Trapper', types: [ENEMY_TYPES.CRAFTER] },
            4: { key: 'crafterTier4', displayName: 'Trapper', types: [ENEMY_TYPES.CRAFTER] },
        }
    }
};

function getTileVisual(tileType) {
    return TILE_VISUALS[tileType] || TILE_VISUALS[TILE_TYPES.FLOOR];
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
