// Area generation rules and premade terrain data

const OVERWORLD_GENERATION_CONFIG = {
    halfWidth: 14,
    halfHeight: 12,
    cornerInset: 3
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

// Edit dungeon choices and their floor area progression here.
// - name: shown in the overworld stairs selection prompt.
// - areaSequence: ordered area types encountered by dungeon depth.
// - loopSequence: when true, repeats areaSequence after the last entry.
// - maxDepth: maximum dungeon depth reachable for this path.
// - disallowedTiles: tile types that are replaced during generation.

// Weather spawn weights for different areas
const WEATHER_SPAWN_WEIGHTS = {
    [AREA_TYPES.OVERWORLD]: {
        [WEATHER_TYPES.FOGGY]: 0.5
    },
    [AREA_TYPES.DUNGEON]: {
        [WEATHER_TYPES.FOGGY]: 0.6
    },
    [AREA_TYPES.SWAMP]: {
        [WEATHER_TYPES.FOGGY]: 0.8
    },
    [AREA_TYPES.CATACOMBS]: {
        [WEATHER_TYPES.FOGGY]: 0.4
    }
};

const DUNGEON_PATH_DEFINITIONS = {
    waterfallPath: {
        id: 'waterfallPath',
        name: 'Waterfall path',
        areaSequence: [
            AREA_TYPES.SWAMP
        ],
        loopSequence: true,
        maxDepth: 10,
        disallowedTiles: [TILE_TYPES.LAVA, TILE_TYPES.SPIKE]
    },
    graspingPillars: {
        id: 'graspingPillars',
        name: 'Grasping Pillars',
        areaSequence: [
            AREA_TYPES.DUNGEON,
        ],
        loopSequence: true,
        maxDepth: 15,
        disallowedTiles: [TILE_TYPES.LAVA, TILE_TYPES.WATER]
    },
    anomalousRuins: {
        id: 'anomalousRuins',
        name: 'Anomalous Ruins',
        areaSequence: [
            AREA_TYPES.CATACOMBS,
        ],
        loopSequence: true,
        maxDepth: 15,
        disallowedTiles: [TILE_TYPES.LAVA, TILE_TYPES.WATER, TILE_TYPES.SPIKE]
    }
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
    '^': TILE_TYPES.SPIKE,
    L: TILE_TYPES.LAVA,
    P: TILE_TYPES.PIT,
    S: HAZARD_TYPES.STEAM,
    I: 'premade_random_item',
    E: 'premade_random_enemy'
};

const PREMADE_TERRAIN_SHAPES = {
    lava_item: {
        rows: [
            'SSSSS',
            'SLLLS',
            'SLILS',
            'SLLLS',
            'SSSSS'
        ]
    },
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
        { shapeId: 'island_2x2', minFloor: 0, minCount: 1, maxCount: 3, chance: 0.9 },
        { shapeId: 'lava_item', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 }
    ],
    [AREA_TYPES.SWAMP]: [
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.45 },
        { shapeId: 'island_2x2', minFloor: 0, minCount: 1, maxCount: 3, chance: 0.9 },
        { shapeId: 'lava_item', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 }
    ],
    [AREA_TYPES.FLOATING]: [
        { shapeId: 'island_2x2', minFloor: 0, minCount: 0, maxCount: 2, chance: 0.6 },
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.4 },
        { shapeId: 'lava_item', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 }
    ],
    [AREA_TYPES.CATACOMBS]: []
};

function getAreaGenerationRule(areaType) {
    return AREA_GENERATION_RULES[areaType] || AREA_GENERATION_RULES[AREA_TYPES.DUNGEON];
}

function getCatacombsGenerationConfig() {
    return CATACOMBS_GENERATION_CONFIG;
}

function getOverworldGenerationConfig() {
    return OVERWORLD_GENERATION_CONFIG;
}

function getAreaSelectionRules() {
    return AREA_SELECTION_RULES;
}

function getDungeonPathDefinitions() {
    return DUNGEON_PATH_DEFINITIONS;
}

function getDefaultDungeonPathId() {
    const pathIds = Object.keys(DUNGEON_PATH_DEFINITIONS);
    return pathIds[0] || 'waterfallPath';
}

function getDungeonPathDefinition(pathId) {
    const normalizedPathId = typeof pathId === 'string' ? pathId : '';
    return DUNGEON_PATH_DEFINITIONS[normalizedPathId] || null;
}

function getDungeonPathMaxDepth(pathId) {
    const definition = getDungeonPathDefinition(pathId);
    const maxDepth = Number(definition?.maxDepth);
    if (!Number.isFinite(maxDepth) || maxDepth <= 0) {
        return null;
    }

    return Math.floor(maxDepth);
}

function getDungeonPathDisallowedTiles(pathId) {
    const definition = getDungeonPathDefinition(pathId);
    const disallowed = Array.isArray(definition?.disallowedTiles)
        ? definition.disallowedTiles
        : [];
    return disallowed.filter((tileType) => Object.values(TILE_TYPES).includes(tileType));
}

function getDungeonAreaTypeForDepth(pathId, dungeonDepthIndex) {
    const definition = getDungeonPathDefinition(pathId);
    if (!definition) {
        return null;
    }

    const sequence = Array.isArray(definition.areaSequence)
        ? definition.areaSequence.filter((areaType) => Object.values(AREA_TYPES).includes(areaType))
        : [];
    if (sequence.length === 0) {
        return null;
    }

    const depthIndex = Math.max(0, Math.floor(Number(dungeonDepthIndex) || 0));
    if (definition.loopSequence) {
        return sequence[depthIndex % sequence.length];
    }

    return sequence[Math.min(depthIndex, sequence.length - 1)];
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

function getWeightedEntriesForFloor(entries, floorIndex) {
    return entries.filter((entry) => {
        const minFloor = Number.isFinite(entry.minFloor) ? entry.minFloor : 0;
        const maxFloor = Number.isFinite(entry.maxFloor) ? entry.maxFloor : Infinity;
        return floorIndex >= minFloor && floorIndex <= maxFloor;
    });
}