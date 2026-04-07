// Terrain sprites, autotiling, and shared visual constants

const TERRAIN_SPRITES = deepFreezeConfig({
    WALL_STONE_TOP_CORNER_LEFT: { x: 0, y: 0 },
    WALL_STONE_HORIZONTAL: { x: 1, y: 0 },
    WALL_STONE_TOP_CORNER_RIGHT: { x: 2, y: 0 },
    WALL_STONE_OVERHEAD: { x: 3, y: 0 },
    WALL_STONE_SPLIT_TOP: { x: 4, y: 0 },
    SPIKE_RAISED: { x: 6, y: 0 },
    WALL_STONE_VERTICAL: { x: 0, y: 1 },
    WALL_STONE_FRONT_END: { x: 1, y: 1 },
    WALL_STONE_SPLIT_LEFT: { x: 3, y: 1 },
    WALL_STONE_SPLIT_CROSS: { x: 4, y: 1 },
    WALL_STONE_SPLIT_RIGHT: { x: 5, y: 1 },
    WALL_STONE_BOTTOM_CORNER_LEFT: { x: 0, y: 2 },
    WALL_STONE_BOTTOM_CORNER_RIGHT: { x: 2, y: 2 },
    WALL_STONE_SPLIT_BOTTOM: { x: 4, y: 2 },
    FLOOR_STONE: { x: 0, y: 3 },
    PIT_OPEN: { x: 1, y: 3 },
    STAIRS_UP_STONE: { x: 2, y: 3 },
    STAIRS_DOWN_STONE: { x: 3, y: 3 },
    LAVA_ACTIVE: { x: 4, y: 3 },
    WATER_SHALLOW: { x: 5, y: 3 }
});

function getVisualConfigEntry(configMap, key, fallback = null) {
    if (!configMap || typeof configMap !== 'object') {
        return fallback;
    }

    return Object.prototype.hasOwnProperty.call(configMap, key)
        ? configMap[key]
        : fallback;
}

function pickTerrainSprite(spriteKey) {
    const sprite = getVisualConfigEntry(TERRAIN_SPRITES, spriteKey);
    if (!sprite) {
        throw new Error(`Unknown terrain sprite key: ${spriteKey}`);
    }
    return { x: sprite.x, y: sprite.y };
}

const TILE_VISUALS = deepFreezeConfig({
    [TILE_TYPES.FLOOR]: { color: '#333', sprite: pickTerrainSprite('FLOOR_STONE') },
    [TILE_TYPES.WALL]: { color: '#0e0e0e', sprite: pickTerrainSprite('WALL_STONE_HORIZONTAL') },
    [TILE_TYPES.PIT]: { color: '#8B4513', sprite: pickTerrainSprite('PIT_OPEN'), icon: 'pit', foregroundColor: '#000' },
    [TILE_TYPES.WATER]: { color: '#0000FF', sprite: pickTerrainSprite('WATER_SHALLOW') },
    [TILE_TYPES.SPIKE]: {
        color: '#666',
        sprite: pickTerrainSprite('SPIKE_RAISED'),
        icon: 'spike',
        foregroundColor: '#d9d9d9',
        sourceHeight: 19,
        overdrawTop: 3,
        prongs: [
            [4, 1, 8, 2],
            [8, 0, 7, 2],
            [12, 1, 8, 2],
            [6, 2, 9, 2],
            [10, 2, 9, 2]
        ]
    },
    [TILE_TYPES.STAIRS_DOWN]: { color: '#0ff', sprite: pickTerrainSprite('STAIRS_DOWN_STONE'), glyph: '<', foregroundColor: '#fff' },
    [TILE_TYPES.STAIRS_UP]: { color: '#0ff', sprite: pickTerrainSprite('STAIRS_UP_STONE'), glyph: '>', foregroundColor: '#fff' },
    [TILE_TYPES.LAVA]: { color: '#d9480f', sprite: pickTerrainSprite('LAVA_ACTIVE'), icon: 'lava', foregroundColor: '#ffb347' },
    [TILE_TYPES.SHOP]: { color: '#b91c1c', sprite: pickTerrainSprite('FLOOR_STONE'), foregroundColor: '#fecaca' }
});

const WALL_AUTOTILE_SPRITES = deepFreezeConfig({
    isolated: 'WALL_STONE_FRONT_END',
    end_top: 'WALL_STONE_FRONT_END',
    end_right: 'WALL_STONE_HORIZONTAL',
    end_bottom: 'WALL_STONE_VERTICAL',
    end_left: 'WALL_STONE_HORIZONTAL',
    horizontal: 'WALL_STONE_HORIZONTAL',
    vertical: 'WALL_STONE_VERTICAL',
    corner_bottom_left: 'WALL_STONE_BOTTOM_CORNER_LEFT',
    corner_top_left: 'WALL_STONE_TOP_CORNER_LEFT',
    corner_top_right: 'WALL_STONE_TOP_CORNER_RIGHT',
    corner_bottom_right: 'WALL_STONE_BOTTOM_CORNER_RIGHT',
    tee_bottom: 'WALL_STONE_SPLIT_BOTTOM',
    tee_right: 'WALL_STONE_SPLIT_RIGHT',
    tee_top: 'WALL_STONE_SPLIT_TOP',
    tee_left: 'WALL_STONE_SPLIT_LEFT',
    cross: 'WALL_STONE_SPLIT_CROSS',
    enclosed: 'WALL_STONE_OVERHEAD'
});

const WALL_BASE_AUTOTILE_RULES = deepFreezeConfig([
    { caseKey: 'enclosed', required: ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl', 'br'] },
    { caseKey: 'cross', required: ['t', 'r', 'b', 'l'] },
    { caseKey: 'tee_left', required: ['t', 'r', 'b'], forbidden: ['l'] },
    { caseKey: 'tee_bottom', required: ['t', 'r', 'l'], forbidden: ['b'] },
    { caseKey: 'tee_right', required: ['t', 'b', 'l'], forbidden: ['r'] },
    { caseKey: 'tee_top', required: ['r', 'b', 'l'], forbidden: ['t'] },
    { caseKey: 'corner_bottom_left', required: ['t', 'r'], forbidden: ['b', 'l'] },
    { caseKey: 'corner_top_left', required: ['r', 'b'], forbidden: ['t', 'l'] },
    { caseKey: 'corner_top_right', required: ['b', 'l'], forbidden: ['t', 'r'] },
    { caseKey: 'corner_bottom_right', required: ['l', 't'], forbidden: ['r', 'b'] },
    { caseKey: 'vertical', required: ['t', 'b'], forbidden: ['r', 'l'] },
    { caseKey: 'horizontal', required: ['r', 'l'], forbidden: ['t', 'b'] },
    { caseKey: 'end_top', required: ['t'], forbidden: ['r', 'b', 'l'] },
    { caseKey: 'end_right', required: ['r'], forbidden: ['t', 'b', 'l'] },
    { caseKey: 'end_bottom', required: ['b'], forbidden: ['t', 'r', 'l'] },
    { caseKey: 'end_left', required: ['l'], forbidden: ['t', 'r', 'b'] },
    { caseKey: 'isolated', forbidden: ['t', 'r', 'b', 'l'] }
]);

const WALL_BAND_OVERRIDE_RULES = deepFreezeConfig([
    {
        caseKey: 'corner_bottom_right',
        required: ['t', 'r', 'b', 'l', 'tr', 'bl', 'br'],
        forbidden: ['tl']
    },
    {
        caseKey: 'corner_bottom_left',
        required: ['t', 'r', 'b', 'l', 'tl', 'bl', 'br'],
        forbidden: ['tr']
    },
    {
        caseKey: 'corner_top_left',
        required: ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl'],
        forbidden: ['br']
    },
    {
        caseKey: 'corner_top_right',
        required: ['t', 'r', 'b', 'l', 'tl', 'tr', 'br'],
        forbidden: ['bl']
    },
    {
        caseKey: 'horizontal',
        required: ['r', 'l', 'b', 'bl', 'br'],
        forbidden: ['t']
    },
    {
        caseKey: 'horizontal',
        required: ['t', 'r', 'l', 'tl', 'tr'],
        forbidden: ['b']
    },
    {
        caseKey: 'vertical',
        required: ['t', 'r', 'b', 'tr', 'br'],
        forbidden: ['l']
    },
    {
        caseKey: 'vertical',
        required: ['t', 'b', 'l', 'tl', 'bl'],
        forbidden: ['r']
    }
]);

function isWallTile(world, x, y) {
    return world.getTile(x, y) === TILE_TYPES.WALL;
}

function getWallNeighborhood(world, x, y) {
    return {
        t: isWallTile(world, x, y - 1),
        r: isWallTile(world, x + 1, y),
        b: isWallTile(world, x, y + 1),
        l: isWallTile(world, x - 1, y),
        tl: isWallTile(world, x - 1, y - 1),
        tr: isWallTile(world, x + 1, y - 1),
        bl: isWallTile(world, x - 1, y + 1),
        br: isWallTile(world, x + 1, y + 1)
    };
}

function doesNeighborhoodMatchRule(neighborhood, rule) {
    const { required = [], forbidden = [] } = rule;
    return required.every((key) => Boolean(neighborhood[key]))
        && forbidden.every((key) => !Boolean(neighborhood[key]));
}

function findWallCaseByRules(neighborhood, rules, fallbackCase = null) {
    for (const rule of rules) {
        if (doesNeighborhoodMatchRule(neighborhood, rule)) {
            return rule.caseKey;
        }
    }
    return fallbackCase;
}

function getWallAutotileCase(world, x, y) {
    const neighborhood = getWallNeighborhood(world, x, y);
    const bandOverrideCase = findWallCaseByRules(neighborhood, WALL_BAND_OVERRIDE_RULES);
    if (bandOverrideCase) {
        return bandOverrideCase;
    }

    return findWallCaseByRules(neighborhood, WALL_BASE_AUTOTILE_RULES, 'isolated');
}

function getWallSpriteKeyAt(world, x, y) {
    const autotileCase = getWallAutotileCase(world, x, y);
    return getVisualConfigEntry(WALL_AUTOTILE_SPRITES, autotileCase, 'WALL_STONE_HORIZONTAL');
}

const TERRAIN_SPRITESHEET_PATH = 'assets/terrain.png';
const TERRAIN_SPRITESHEET_VERSION = '4';
const TERRAIN_SPRITESHEET_TILE_SIZE = 16;
const TERRAIN_SPRITESHEET_TILE_HEIGHT = 16;

const ENTITY_VISUALS = deepFreezeConfig({
    player: { color: '#66d9ff', miniMapInset: 0 },
    enemy: { color: '#ff6b6b', miniMapInset: 0 },
    ally: { color: '#7ee787', miniMapInset: 0 },
    npc: { color: '#f6c177', miniMapInset: 0 },
    item: { color: '#ffdf6b', miniMapInset: 4, miniMapInsetMap: 2 }
});

const UI_VISUALS = deepFreezeConfig({
    playerFacingArrow: '#111',
    playerHealthBarBackground: '#111',
    playerHealthBarBorder: '#000',
    playerHealthBarHigh: '#34d399',
    playerHealthBarMid: '#facc15',
    playerHealthBarLow: '#f87171',
    mapPlayerOutline: '#000',
    trapBackdrop: 'rgba(0, 0, 0, 0.35)',
    trapIcon: '#ffd166',
    enemyNameColor: '#fff',
    enemyNameOutline: '#000',
    enemyHealthBarBackground: '#111',
    enemyHealthBarBorder: '#000',
    enemyHealthBarHigh: '#39d353',
    enemyHealthBarMid: '#f59e0b',
    enemyHealthBarLow: '#ef4444',
    playerMeleeTrail: '#facc15',
    enemyMeleeTrail: '#fb7185',
    throwTrail: '#93c5fd',
    throwProjectile: '#ffffff',
    hitPulsePlayer: '#f43f5e',
    hitPulseEnemy: '#22d3ee',
    hitPulseNeutral: '#ffffff'
});

const HEALTH_BAR_PALETTES = deepFreezeConfig({
    player: {
        background: UI_VISUALS.playerHealthBarBackground,
        border: UI_VISUALS.playerHealthBarBorder,
        high: UI_VISUALS.playerHealthBarHigh,
        mid: UI_VISUALS.playerHealthBarMid,
        low: UI_VISUALS.playerHealthBarLow
    },
    enemy: {
        background: UI_VISUALS.enemyHealthBarBackground,
        border: UI_VISUALS.enemyHealthBarBorder,
        high: UI_VISUALS.enemyHealthBarHigh,
        mid: UI_VISUALS.enemyHealthBarMid,
        low: UI_VISUALS.enemyHealthBarLow
    }
});

function getTileVisual(tileType) {
    return getVisualConfigEntry(TILE_VISUALS, tileType, TILE_VISUALS[TILE_TYPES.FLOOR]);
}

function getTileVisualAt(tileType, world = null, x = null, y = null) {
    const baseVisual = getTileVisual(tileType);
    if (
        tileType !== TILE_TYPES.WALL
        || !world
        || typeof world.getTile !== 'function'
        || !Number.isFinite(x)
        || !Number.isFinite(y)
    ) {
        return baseVisual;
    }

    const spriteKey = getWallSpriteKeyAt(world, x, y);
    return {
        ...baseVisual,
        sprite: pickTerrainSprite(spriteKey)
    };
}

function getEntityVisual(entityKind, entity = null) {
    if (entityKind === 'enemy' && entity) {
        if (entity.isAlly) {
            return ENTITY_VISUALS.ally;
        }
        if (isNeutralNpcActor(entity)) {
            return ENTITY_VISUALS.npc;
        }
    }

    return getVisualConfigEntry(ENTITY_VISUALS, entityKind, ENTITY_VISUALS.enemy);
}