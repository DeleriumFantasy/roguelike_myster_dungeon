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
    FLOOR: '.',
    WALL: '#',
    STAIRS_DOWN: '>',
    STAIRS_UP: '<',
    PIT: '^',
    WATER: '~',
    SPIKE: '*'
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
    STAIRS: '#0ff',
    PLAYER: '#fff',
    ENEMY: '#f00',
    ITEM: '#ff0',
    VISIBLE: 1.0,
    EXPLORED: 0.5,
    UNEXPLORED: 0.0,
    FOG_OVERLAY: 'rgba(100,100,100,0.5)'
};