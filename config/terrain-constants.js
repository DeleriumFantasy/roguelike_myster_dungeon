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

// Connectivity layout constants shared by all situationed spritesheet families
const SITUATIONED_CONNECTION_KEY_ORDER = deepFreezeConfig(['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br']);
const SITUATIONED_VARIANT_X_STEP = 3;
const WALL_SITUATIONED_VARIANT_PICK_CHANCE = 0.1;
const GROUND_SITUATIONED_VARIANT_PICK_CHANCE = 0.05;
const SITUATIONED_VARIANT_NEIGHBOR_OFFSETS = deepFreezeConfig([
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
]);

// Universal situation-to-sprite mapping: used by all 25+ families.
// Key format is tl,t,tr,l,r,bl,b,br where 1 means connected to a wall and 0 means open.
const SITUATIONED_SPRITESHEET_SITUATIONS = deepFreezeConfig({
    default: { x: 1, y: 1 },
    '00001011': { x: 0, y: 0 },    //connected to right, bottom, bottom-right
    '00011111': { x: 1, y: 0 },    //connected to left, right, bottom-left, bottom, bottom-right
    '00010110': { x: 2, y: 0 },    //connected to left, bottom-left, bottom
    '01101011': { x: 0, y: 1 },    //connected to top, top-right, right, bottom, bottom-right
    '11111111': { x: 1, y: 1 },    //connected to top-left, top, top-right, left, right, bottom-left, bottom, bottom-right
    '11010110': { x: 2, y: 1 },    //connected to top-left, top, left, bottom-left, bottom
    '01101000': { x: 0, y: 2 },    //connected to top, top-right, right
    '11111000': { x: 1, y: 2 },    //connected to top-left, top, top-right, left, right
    '11010000': { x: 2, y: 2 },    //connected to top-left, top, left
    '00001010': { x: 0, y: 3 },    //connected to right, bottom
    '00011000': { x: 1, y: 3 },    //connected to left, right
    '00010010': { x: 2, y: 3 },    //connected to left, bottom
    '01000010': { x: 0, y: 4 },    //connected to top, bottom
    '00000000': { x: 1, y: 4 },    //unconnected
    '01001000': { x: 0, y: 5 },    //connected to top, right
    '01010000': { x: 2, y: 5 },    //connected to top, left
    '00000010': { x: 1, y: 6 },    //connected to bottom only
    '00001000': { x: 0, y: 7 },    //connected to right only
    '01011010': { x: 1, y: 7 },    //connected to top, left, right, bottom
    '00010000': { x: 2, y: 7 },    //connected to left only
    '01000000': { x: 1, y: 8 },    //connected to top only
    '00011010': { x: 1, y: 9 },    //connected to left, right, bottom
    '01001010': { x: 0, y: 10 },   //connected to top, right, bottom
    '01010010': { x: 2, y: 10 },   //connected to top, left, bottom
    '01011000': { x: 1, y: 11 },   //connected to top, left, right
    '11111010': { x: 1, y: 12 },   //connected to top-left, top, top-right, left, right, bottom
    '11011110': { x: 0, y: 13 },   //connected to top-left, top, left, right, bottom-left, bottom
    '01111011': { x: 2, y: 13 },   //connected to top, top-right, left, right, bottom, bottom-right
    '01011111': { x: 1, y: 14 },   //connected to top, left, right, bottom-left, bottom, bottom-right
    '11111110': { x: 0, y: 15 },   //connected to top-left, top, top-right, left, right, bottom-left, bottom
    '11111011': { x: 1, y: 15 },   //connected to top-left, top, top-right, left, right, bottom, bottom-right
    '11011111': { x: 0, y: 16 },   //connected to top-left, top, left, right, bottom-left, bottom, bottom-right
    '01111111': { x: 1, y: 16 },   //connected to top, top-right, left, right, bottom-left, bottom, bottom-right
    '01101010': { x: 0, y: 17 },   //connected to top, top-right, right, bottom
    '11010010': { x: 1, y: 17 },   //connected to top-left, top, left, bottom
    '01001011': { x: 0, y: 18 },   //connected to top, right, bottom, bottom-right
    '01010110': { x: 1, y: 18 },   //connected to top, left, bottom-left, bottom
    '00011110': { x: 0, y: 19 },   //connected to left, right, bottom-left, bottom
    '00011011': { x: 1, y: 19 },   //connected to left, right, bottom, bottom-right
    '11011000': { x: 0, y: 20 },   //connected to top-left, top, left, right
    '01111000': { x: 1, y: 20 },   //connected to top, top-right, left, right
    '01011011': { x: 0, y: 21 },   //connected to top, left, right, bottom, bottom-right
    '01011110': { x: 1, y: 21 },   //connected to top, left, right, bottom-left, bottom
    '01111010': { x: 0, y: 22 },   //connected to top, top-right, left, right, bottom
    '11011010': { x: 1, y: 22 },   //connected to top-left, top, left, right, bottom
    '01111110': { x: 0, y: 23 },   //connected to top, top-right, left, right, bottom-left, bottom
    '11011011': { x: 1, y: 23 },   //connected to top-left, top, left, right, bottom, bottom-right
});

// Family registry: each family defines its own wall/ground variant counts, sheet keys, and paths.
// All families share SITUATIONED_SPRITESHEET_SITUATIONS (universal 48-situation connectivity layout).
// Expand this registry to add new area families; wall and ground variant counts can differ per family.
const SITUATIONED_SPRITESHEET_FAMILIES = deepFreezeConfig({
    desert: {
        wallSheetKey: 'wallDesert',
        groundSheetKey: 'groundDesert',
        wallSheetPath: 'assets/wall_ruin_desert.png',    
        groundSheetPath: 'assets/ground_ruin_desert.png', 
        tileSize: 24,
        spacing: 1,
        margin: 0,
        wallSituationVariantCounts: {
            '00011111': 2, //block top
            '01101011': 2, //block left
            '11111111': 2, //block middle
            '11010110': 2, //block right
            '11111000': 2, //block bottom
            '00011010': 1, //threeway lrb + top open
            '01001010': 1, //threeway trb + left open
            '01010010': 1, //threeway tlb + right open
            '01011000': 1, //threeway ltr + bottom open
            '11010010': 1, 
            '01101010': 1,
            '01001011': 1,
            '01010110': 1,
            '00011011': 1,
            '11011000': 1,
            '01111000': 1
        },
        groundSituationVariantCounts: {
            '11111111': 3,
        }
    },
    ancientFactory: {
        wallSheetKey: 'wallAncientFactory',
        groundSheetKey: 'groundAncientFactory',
        wallSheetPath: 'assets/wall_ancient_factory.png',  
        groundSheetPath: 'assets/ground_ancient_factory.png', 
        tileSize: 24,
        spacing: 1,
        margin: 0,
        wallSituationVariantCounts: {
            '00011111': 2, //block top
            '01101011': 2, //block left
            '11111111': 2, //block middle
            '11010110': 2, //block right
            '11111000': 2, //block bottom
            '00011000': 1, //single horizontal
            '00010000': 1, //single left end
            '00001000': 1, //single right end
            '01011000': 1, //threeway ltr + bottom open
            '01011111': 1, //threeway ltr + bottom wall
            '01111111': 1,
            '01101010': 1,
            '01001011': 2,
            '01010110': 1,
            '11011000': 1,
            '01111000': 2
        },
        groundSituationVariantCounts: {
            '11111111': 2
        }
    },
    // TODO: Add 23 more families (tundra, cavern, volcano, swamp, forest, etc.)
    // Each new family should define its own wallSheetKey, groundSheetKey, paths,
    // wallSituationVariantCounts, and groundSituationVariantCounts.
});

const SITUATIONED_SPRITESHEET_FAMILY_BY_AREA_TYPE = deepFreezeConfig({
    [AREA_TYPES.OVERWORLD]: 'ancientFactory',
    [AREA_TYPES.DUNGEON]: 'desert'
});


function isValidSpriteGridPosition(position) {
    return Boolean(position)
        && Number.isFinite(position.x)
        && Number.isFinite(position.y)
        && position.x >= 0
        && position.y >= 0;
}

function cloneSpriteGridPosition(position) {
    return isValidSpriteGridPosition(position)
        ? { x: position.x, y: position.y }
        : null;
}

function getFamilyConfig(familyName) {
    if (typeof familyName !== 'string') {
        return null;
    }
    return getVisualConfigEntry(SITUATIONED_SPRITESHEET_FAMILIES, familyName);
}

function getSituationedSpriteSheetFamilyAt(world) {
    const areaType = typeof world?.getAreaType === 'function'
        ? world.getAreaType(world.currentFloor)
        : null;
    const familyName = getVisualConfigEntry(SITUATIONED_SPRITESHEET_FAMILY_BY_AREA_TYPE, areaType, 'desert');
    return getFamilyConfig(familyName) ? familyName : 'desert';
}

function getWallRuinSpriteSheetKeyAt(world) {
    const familyName = getSituationedSpriteSheetFamilyAt(world);
    const familyConfig = getFamilyConfig(familyName);
    return familyConfig?.wallSheetKey || 'wallDesert';
}

function getGroundRuinSpriteSheetKeyAt(world) {
    const familyName = getSituationedSpriteSheetFamilyAt(world);
    const familyConfig = getFamilyConfig(familyName);
    return familyConfig?.groundSheetKey || 'groundDesert';
}

function getSituationedSpriteSheetVariantCount(familyName, surfaceType, situationKey) {
    const familyConfig = getFamilyConfig(familyName);
    if (!familyConfig) {
        return 0;
    }

    const variantCounts = surfaceType === 'ground'
        ? (familyConfig.groundSituationVariantCounts || familyConfig.situationVariantCounts)
        : (familyConfig.wallSituationVariantCounts || familyConfig.situationVariantCounts);
    const configuredCount = getVisualConfigEntry(variantCounts, situationKey, 0);
    if (!Number.isFinite(configuredCount)) {
        return 0;
    }

    return Math.max(0, Math.floor(configuredCount));
}

function getWallRuinSituationVariantCount(world, situationKey) {
    return getSituationedSpriteSheetVariantCount(getSituationedSpriteSheetFamilyAt(world), 'wall', situationKey);
}

function getGroundRuinSituationVariantCount(world, situationKey) {
    return getSituationedSpriteSheetVariantCount(getSituationedSpriteSheetFamilyAt(world), 'ground', situationKey);
}


function getStableVariantSeed(surfaceType, situationKey, x, y) {
    const situationId = Number.parseInt(situationKey, 2);
    const safeSituationId = Number.isFinite(situationId) ? situationId : 0;
    const typeSalt = surfaceType === 'ground' ? 0x27d4eb2f : 0x165667b1;
    return ((x * 0x9e3779b1) ^ (y * 0x85ebca6b) ^ (safeSituationId * 0xc2b2ae35) ^ typeSalt) >>> 0;
}

function getStableVariantNormalized(surfaceType, situationKey, x, y) {
    return getStableVariantSeed(surfaceType, situationKey, x, y) / 4294967296;
}

function isStableVariantCandidate(surfaceType, situationKey, x, y, pickChance) {
    return getStableVariantNormalized(surfaceType, situationKey, x, y) < pickChance;
}

function hasLowerOrderedVariantNeighbor(world, x, y, isValidNeighbor, getNeighborSituationKey, getNeighborVariantCount, pickChance) {
    for (const [dx, dy] of SITUATIONED_VARIANT_NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny > y || (ny === y && nx >= x)) {
            continue;
        }

        if (!world.isWithinBounds(nx, ny) || !isValidNeighbor(nx, ny)) {
            continue;
        }

        const neighborSituationKey = getNeighborSituationKey(nx, ny);
        const neighborVariantCount = getNeighborVariantCount(world, neighborSituationKey);
        if (neighborVariantCount <= 0) {
            continue;
        }

        if (isStableVariantCandidate(pickChance.surfaceType, neighborSituationKey, nx, ny, pickChance.value)) {
            return true;
        }
    }

    return false;
}

function getStableSituationVariantIndex(world, surfaceType, situationKey, x, y, variantCount, isValidNeighbor, getNeighborSituationKey, getNeighborVariantCount, pickChance) {
    if (variantCount <= 0) {
        return 0;
    }

    const unsignedHash = getStableVariantSeed(surfaceType, situationKey, x, y);
    const normalized = unsignedHash / 4294967296;
    if (normalized >= pickChance) {
        return 0;
    }

    if (hasLowerOrderedVariantNeighbor(
        world,
        x,
        y,
        isValidNeighbor,
        getNeighborSituationKey,
        getNeighborVariantCount,
        { surfaceType, value: pickChance }
    )) {
        return 0;
    }

    return 1 + ((unsignedHash >>> 8) % variantCount);
}

function getStableWallRuinVariantIndex(world, situationKey, x, y, variantCount) {
    return getStableSituationVariantIndex(
        world,
        'wall',
        situationKey,
        x,
        y,
        variantCount,
        (nx, ny) => isWallTile(world, nx, ny),
        (nx, ny) => getWallConnectionSituationKey(getNormalizedWallRuinNeighborhood(getWallNeighborhood(world, nx, ny))),
        getWallRuinSituationVariantCount,
        WALL_SITUATIONED_VARIANT_PICK_CHANCE
    );
}

function getWallRuinVariantSprite(baseSprite, variantIndex) {
    if (!isValidSpriteGridPosition(baseSprite)) {
        return null;
    }

    const safeVariantIndex = Number.isFinite(variantIndex)
        ? Math.max(0, Math.floor(variantIndex))
        : 0;

    return {
        x: baseSprite.x + safeVariantIndex * SITUATIONED_VARIANT_X_STEP,
        y: baseSprite.y
    };
}

function getStableGroundRuinVariantIndex(world, situationKey, x, y, variantCount) {
    return getStableSituationVariantIndex(
        world,
        'ground',
        situationKey,
        x,
        y,
        variantCount,
        (nx, ny) => world.isWithinBounds(nx, ny) && isWalkableTileType(world.getTile(nx, ny)),
        (nx, ny) => getGroundRuinConnectionSituationKey(getNormalizedWallRuinNeighborhood(getGroundNeighborhood(world, nx, ny))),
        getGroundRuinSituationVariantCount,
        GROUND_SITUATIONED_VARIANT_PICK_CHANCE
    );
}

function getGroundRuinVariantSprite(baseSprite, variantIndex) {
    if (!isValidSpriteGridPosition(baseSprite)) {
        return null;
    }

    const safeVariantIndex = Number.isFinite(variantIndex)
        ? Math.max(0, Math.floor(variantIndex))
        : 0;

    return {
        x: baseSprite.x + safeVariantIndex * SITUATIONED_VARIANT_X_STEP,
        y: baseSprite.y
    };
}

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

function isWalkableTileType(tileType) {
    return tileType === TILE_TYPES.FLOOR
        || tileType === TILE_TYPES.SHOP
        || tileType === TILE_TYPES.STAIRS_UP
        || tileType === TILE_TYPES.STAIRS_DOWN;
}

function getGroundRuinConnectionSituationKey(neighborhood) {
    return SITUATIONED_CONNECTION_KEY_ORDER
        .map((key) => (neighborhood[key] ? '1' : '0'))
        .join('');
}

function getWallConnectionSituationKey(neighborhood) {
    return SITUATIONED_CONNECTION_KEY_ORDER
        .map((key) => (neighborhood[key] ? '1' : '0'))
        .join('');
}

function getGroundNeighborhood(world, x, y) {
    return {
        t: isWalkableTileType(world.getTile(x, y - 1)),
        r: isWalkableTileType(world.getTile(x + 1, y)),
        b: isWalkableTileType(world.getTile(x, y + 1)),
        l: isWalkableTileType(world.getTile(x - 1, y)),
        tl: isWalkableTileType(world.getTile(x - 1, y - 1)),
        tr: isWalkableTileType(world.getTile(x + 1, y - 1)),
        bl: isWalkableTileType(world.getTile(x - 1, y + 1)),
        br: isWalkableTileType(world.getTile(x + 1, y + 1))
    };
}

function getNormalizedWallRuinNeighborhood(neighborhood) {
    if (!neighborhood || typeof neighborhood !== 'object') {
        return neighborhood;
    }

    const top = Boolean(neighborhood.t);
    const right = Boolean(neighborhood.r);
    const bottom = Boolean(neighborhood.b);
    const left = Boolean(neighborhood.l);

    return {
        ...neighborhood,
        tl: Boolean(neighborhood.tl) && top && left,
        tr: Boolean(neighborhood.tr) && top && right,
        bl: Boolean(neighborhood.bl) && bottom && left,
        br: Boolean(neighborhood.br) && bottom && right
    };
}

function getNormalizedWallRuinSituationKey(neighborhood) {
    return getWallConnectionSituationKey(getNormalizedWallRuinNeighborhood(neighborhood));
}

function getWallRuinSpriteAt(world, x, y) {
    const neighborhood = getWallNeighborhood(world, x, y);
    const situationKey = getWallConnectionSituationKey(neighborhood);
    const normalizedSituationKey = getNormalizedWallRuinSituationKey(neighborhood);
    const candidateSituationKeys = situationKey === normalizedSituationKey
        ? [situationKey]
        : [situationKey, normalizedSituationKey];

    for (const candidateSituationKey of candidateSituationKeys) {
        const exactSprite = cloneSpriteGridPosition(getVisualConfigEntry(SITUATIONED_SPRITESHEET_SITUATIONS, candidateSituationKey));
        if (!exactSprite) {
            continue;
        }

        const variantCount = getWallRuinSituationVariantCount(world, candidateSituationKey);
        const variantIndex = getStableWallRuinVariantIndex(world, candidateSituationKey, x, y, variantCount);
        const variantSprite = getWallRuinVariantSprite(exactSprite, variantIndex);
        if (variantSprite) {
            return variantSprite;
        }

        return exactSprite;
    }

    return cloneSpriteGridPosition(getVisualConfigEntry(SITUATIONED_SPRITESHEET_SITUATIONS, 'default'));
}

function getGroundRuinSpriteAt(world, x, y) {
    const neighborhood = getGroundNeighborhood(world, x, y);
    const situationKey = getGroundRuinConnectionSituationKey(neighborhood);
    const normalizedSituationKey = getGroundRuinConnectionSituationKey(getNormalizedWallRuinNeighborhood(neighborhood));
    const candidateSituationKeys = situationKey === normalizedSituationKey
        ? [situationKey]
        : [situationKey, normalizedSituationKey];

    for (const candidateSituationKey of candidateSituationKeys) {
        const exactSprite = cloneSpriteGridPosition(getVisualConfigEntry(SITUATIONED_SPRITESHEET_SITUATIONS, candidateSituationKey));
        if (!exactSprite) {
            continue;
        }

        const variantCount = getGroundRuinSituationVariantCount(world, candidateSituationKey);
        const variantIndex = getStableGroundRuinVariantIndex(world, candidateSituationKey, x, y, variantCount);
        const variantSprite = getGroundRuinVariantSprite(exactSprite, variantIndex);
        if (variantSprite) {
            return variantSprite;
        }

        return exactSprite;
    }

    return cloneSpriteGridPosition(getVisualConfigEntry(SITUATIONED_SPRITESHEET_SITUATIONS, 'default'));
}

const TERRAIN_SPRITESHEET_PATH = 'assets/terrain.png';
const TERRAIN_SPRITESHEET_VERSION = '4';
const TERRAIN_SPRITESHEET_TILE_SIZE = 16;
const TERRAIN_SPRITESHEET_TILE_HEIGHT = 16;
const TERRAIN_SPRITESHEET_SPACING = 0;
const TERRAIN_SPRITESHEET_MARGIN = 0;

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
        !world
        || typeof world.getTile !== 'function'
        || !Number.isFinite(x)
        || !Number.isFinite(y)
    ) {
        return baseVisual;
    }

    if (tileType === TILE_TYPES.WALL) {
        return {
            ...baseVisual,
            sprite: getWallRuinSpriteAt(world, x, y),
            spriteSheetKey: getWallRuinSpriteSheetKeyAt(world)
        };
    }

    if (tileType === TILE_TYPES.FLOOR) {
        return {
            ...baseVisual,
            sprite: getGroundRuinSpriteAt(world, x, y),
            spriteSheetKey: getGroundRuinSpriteSheetKeyAt(world)
        };
    }

    return baseVisual;
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


