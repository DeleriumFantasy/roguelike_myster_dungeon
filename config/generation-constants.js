// Area generation rules and premade terrain data

const OVERWORLD_GENERATION_CONFIG = deepFreezeConfig({
    halfWidth: 14,
    halfHeight: 12,
    cornerInset: 3
});

const CATACOMBS_GENERATION_CONFIG = deepFreezeConfig({
    roomPlacementAttempts: 320,
    minRoomCount: 16,
    targetRoomCountRatio: 0.5,
    roomMinSize: 4,
    roomMaxSize: 8,
    roomPadding: 1,
    hallwayHazardChance: 0.2,
    hallwayHazardTiles: [TILE_TYPES.LAVA, TILE_TYPES.WATER, TILE_TYPES.SPIKE]
});

const AREA_SELECTION_RULES = deepFreezeConfig({
    floatingModulo: 9,
    floatingRemainder: 8,
    swampModulo: 7,
    swampRemainder: 5,
    dungeonModulo: 5,
    dungeonRemainder: 2
});

const AREA_FALLBACK_SELECTION_RULES = Object.freeze([
    { areaType: AREA_TYPES.FLOATING, modulo: AREA_SELECTION_RULES.floatingModulo, remainder: AREA_SELECTION_RULES.floatingRemainder },
    { areaType: AREA_TYPES.SWAMP, modulo: AREA_SELECTION_RULES.swampModulo, remainder: AREA_SELECTION_RULES.swampRemainder },
    { areaType: AREA_TYPES.DUNGEON, modulo: AREA_SELECTION_RULES.dungeonModulo, remainder: AREA_SELECTION_RULES.dungeonRemainder },
    { areaType: AREA_TYPES.CATACOMBS, default: true }
]);

const AREA_RUNTIME_GENERATION_RULES = Object.freeze({
    [AREA_TYPES.OVERWORLD]: {
        generatorMethod: 'generateOverworldGrid',
        generatorType: 'generator:overworld',
        skipHazards: true,
        skipTraps: true,
        roomOnlySpawns: false,
        postLayoutDecorators: []
    },
    [AREA_TYPES.DUNGEON]: {
        generatorMethod: 'generateRuleBasedAreaGrid',
        generatorType: 'generator:dungeon',
        skipHazards: false,
        skipTraps: false,
        roomOnlySpawns: false,
        postLayoutDecorators: []
    },
    [AREA_TYPES.SWAMP]: {
        generatorMethod: 'generateRuleBasedAreaGrid',
        generatorType: 'generator:swamp',
        skipHazards: false,
        skipTraps: false,
        roomOnlySpawns: false,
        postLayoutDecorators: []
    },
    [AREA_TYPES.FLOATING]: {
        generatorMethod: 'generateRuleBasedAreaGrid',
        generatorType: 'generator:floating',
        skipHazards: false,
        skipTraps: false,
        roomOnlySpawns: false,
        postLayoutDecorators: []
    },
    [AREA_TYPES.CATACOMBS]: {
        generatorMethod: 'generateCatacombsGrid',
        generatorType: 'generator:catacombs',
        skipHazards: false,
        skipTraps: false,
        roomOnlySpawns: true,
        postLayoutDecorators: ['decorateCatacombsHallways']
    }
});

// Edit dungeon choices, progression, and unlock flow here.
// - name: shown in the overworld stairs selection prompt.
// - startsUnlocked: whether the path is available at the start of a new run.
// - unlocksOnComplete: path ids unlocked after beating this path.
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
    anomalousRuins: {
        id: 'anomalousRuins',
        name: 'Anomalous Ruins',
        startsUnlocked: true,
        unlocksOnComplete: ['waterfallPath', 'graspingPillars'],
        areaSequence: [
            AREA_TYPES.CATACOMBS,
        ],
        loopSequence: true,
        maxDepth: 10,
        disallowedTiles: [TILE_TYPES.LAVA, TILE_TYPES.WATER, TILE_TYPES.SPIKE]
    },
    waterfallPath: {
        id: 'waterfallPath',
        name: 'Waterfall path',
        startsUnlocked: false,
        unlocksOnComplete: [],
        areaSequence: [
            AREA_TYPES.SWAMP
        ],
        loopSequence: true,
        maxDepth: 15,
        disallowedTiles: [TILE_TYPES.LAVA, TILE_TYPES.SPIKE]
    },
    graspingPillars: {
        id: 'graspingPillars',
        name: 'Grasping Pillars',
        startsUnlocked: false,
        unlocksOnComplete: [],
        areaSequence: [
            AREA_TYPES.DUNGEON,
        ],
        loopSequence: true,
        maxDepth: 15,
        disallowedTiles: [TILE_TYPES.LAVA, TILE_TYPES.WATER]
    },
};

const DUNGEON_WORLD_EVENT_RULES = deepFreezeConfig({
    secondQuestgiver: {
        requiredCompletedPaths: ['anomalousRuins', 'graspingPillars'],
        npcTypeKey: 'npcQuestgiverTier1',
        npcName: 'Questgiver (second)',
        unlockMessage: 'A second Questgiver has appeared in the overworld.'
    }
});

const QUESTGIVER_NAME_POOLS = Object.freeze({
    retrieveItem: ['Sealed relic', 'Surveyor\'s ledger', 'Crystal compass', 'Ancient field notes'],
    material: ['Reinforcement crate', 'Power conduit', 'Stone brace', 'Machined strut'],
    engineer: ['Engineer Hale', 'Engineer Mira', 'Engineer Varo', 'Engineer Seln']
});

const QUESTGIVER_QUEST_POOLS = Object.freeze({
    hunt: [
        { targetTypeKey: 'slimeTier1', minFloor: 1, requiredCount: 4, rewardMoney: 40, rewardTier: 1 },
        { targetTypeKey: 'beastTier1', minFloor: 1, requiredCount: 3, rewardMoney: 55, rewardTier: 1 },
        { targetTypeKey: 'ghostTier1', minFloor: 1, requiredCount: 2, rewardMoney: 70, rewardTier: 2 },
        { targetTypeKey: 'thiefTier1', minFloor: 1, requiredCount: 2, rewardMoney: 80, rewardTier: 2 },
        { targetTypeKey: 'fuserTier1', minFloor: 2, requiredCount: 2, rewardMoney: 110, rewardTier: 2 },
        { targetTypeKey: 'pariahTier1', minFloor: 2, requiredCount: 2, rewardMoney: 120, rewardTier: 2 }
    ],
    allyRetrieval: [
        { targetTypeKey: 'slimeTier1', minAllyLevel: 2, rewardMoney: 65, rewardTier: 1 },
        { targetTypeKey: 'beastTier1', minAllyLevel: 2, rewardMoney: 85, rewardTier: 1 },
        { targetTypeKey: 'aquaticTier1', minAllyLevel: 3, rewardMoney: 95, rewardTier: 2 },
        { targetTypeKey: 'floatingTier1', minAllyLevel: 3, rewardMoney: 105, rewardTier: 2 }
    ],
    escort: [
        { minFloor: 1, targetAdvanceMin: 2, targetAdvanceMax: 3, rewardMoney: 90, rewardTier: 1 },
        { minFloor: 3, targetAdvanceMin: 3, targetAdvanceMax: 4, rewardMoney: 135, rewardTier: 2 },
        { minFloor: 6, targetAdvanceMin: 4, targetAdvanceMax: 5, rewardMoney: 200, rewardTier: 3 }
    ],
    saveLostExplorer: [
        { minFloor: 1, targetAdvanceMin: 1, targetAdvanceMax: 2, rewardMoney: 110, rewardTier: 1 },
        { minFloor: 3, targetAdvanceMin: 2, targetAdvanceMax: 3, rewardMoney: 160, rewardTier: 2 },
        { minFloor: 6, targetAdvanceMin: 3, targetAdvanceMax: 4, rewardMoney: 230, rewardTier: 3 }
    ],
    retrieveItem: [
        { minFloor: 1, targetAdvanceMin: 1, targetAdvanceMax: 2, rewardMoney: 85, rewardTier: 1 },
        { minFloor: 3, targetAdvanceMin: 2, targetAdvanceMax: 3, rewardMoney: 130, rewardTier: 2 },
        { minFloor: 6, targetAdvanceMin: 3, targetAdvanceMax: 4, rewardMoney: 190, rewardTier: 3 }
    ],
    materialDelivery: [
        { minFloor: 1, targetAdvanceMin: 1, targetAdvanceMax: 2, materialCountMin: 3, materialCountMax: 4, rewardMoney: 115, rewardTier: 1 },
        { minFloor: 3, targetAdvanceMin: 2, targetAdvanceMax: 3, materialCountMin: 3, materialCountMax: 5, rewardMoney: 170, rewardTier: 2 },
        { minFloor: 6, targetAdvanceMin: 3, targetAdvanceMax: 4, materialCountMin: 4, materialCountMax: 5, rewardMoney: 240, rewardTier: 3 }
    ]
});

const QUESTGIVER_ADVANCE_QUEST_CONFIGS = Object.freeze({
    escort: {
        poolKey: 'escort',
        questType: 'escort-npc',
        rewardFloorMultiplier: 10,
        minimumAdvance: 0,
        extraFieldBuilder: 'escortPassenger',
        escortTypeKey: 'escortPassengerTier1'
    },
    saveLostExplorer: {
        poolKey: 'saveLostExplorer',
        questType: 'save-lost-explorer',
        rewardFloorMultiplier: 12,
        minimumAdvance: 1
    },
    retrieveItem: {
        poolKey: 'retrieveItem',
        questType: 'retrieve-item',
        rewardFloorMultiplier: 10,
        minimumAdvance: 1,
        extraFieldBuilder: 'retrieveItemName',
        itemNamePoolKey: 'retrieveItem'
    },
    materialDelivery: {
        poolKey: 'materialDelivery',
        questType: 'material-delivery',
        rewardFloorMultiplier: 12,
        minimumAdvance: 1,
        extraFieldBuilder: 'materialDelivery',
        materialNamePoolKey: 'material',
        engineerNamePoolKey: 'engineer'
    }
});

const QUESTGIVER_QUEST_BUILDER_METHODS = Object.freeze([
    'buildQuestgiverHuntQuest',
    'buildQuestgiverAllyRetrievalQuest',
    'buildQuestgiverExploreQuest',
    'buildQuestgiverEscortQuest',
    'buildQuestgiverLostExplorerQuest',
    'buildQuestgiverRetrieveItemQuest',
    'buildQuestgiverMaterialDeliveryQuest'
]);

const ENEMY_SCALING_RULES = Object.freeze({
    healthPerDepth: 3,
    powerPerDepthInterval: 2,
    armorPerDepthInterval: 4,
    expPerDepth: 2
});

const ITEM_SPAWN_IMPROVEMENT_RULES = Object.freeze({
    rollCount: 3,
    chancePerRoll: 0.05
});

const ITEM_SPAWN_COUNT_RULES = Object.freeze([
    { maxDisplayFloor: 25, minCount: 4, maxCount: 5 },
    { maxDisplayFloor: 50, minCount: 3, maxCount: 4 },
    { maxDisplayFloor: 75, minCount: 2, maxCount: 3 },
    { maxDisplayFloor: 99, minCount: 1, maxCount: 2 }
]);

const ITEM_TIER_WEIGHT_RULES = Object.freeze([
    {
        minDisplayFloor: 1,
        maxDisplayFloor: 25,
        tiers: {
            1: { start: 80, end: 55 },
            2: { start: 20, end: 45 }
        }
    },
    {
        minDisplayFloor: 26,
        maxDisplayFloor: 99,
        tiers: {
            1: { start: 50, end: 2 },
            2: { start: 30, end: 8 },
            3: { start: 15, end: 20 },
            4: { start: 5, end: 70 }
        }
    }
]);

const ITEM_REWARD_TIER_BOOST_CHANCES = Object.freeze([0.7, 0.35]);

const FLOOR_EVENT_GLOBAL_RULES = Object.freeze({
    randomEventChance: 0.02,
    guaranteedHoardFloors: [1]
});

const FLOOR_EVENT_RULES = Object.freeze({
    'food-party': {
        title: () => 'Random Event: Food Party',
        objective: ({ turnsRemaining }) => `Spawned food disappears in ${turnsRemaining} turns.`,
        appendTurnsRemaining: false,
        turnLimit: 50,
        spawnCount: 12
    },
    'throwing-challenge': {
        title: () => 'Random Event: Throwing Challenge',
        objective: ({ currentKills, requiredKills }) => `Defeat enemies with thrown items (${currentKills}/${requiredKills}).`,
        appendTurnsRemaining: false,
        requiredKills: 5
    },
    hoard: {
        title: () => 'Random Event: Guarded Hoard',
        objective: () => 'Be careful, the hoard is protected.',
        eligibleRoomAreaMin: 25,
        candidatePoolSize: 3,
        enemyCountMultiplier: 0.3,
        enemyCountMin: 5,
        enemyCountMax: 10,
        itemCountMultiplier: 0.2,
        itemCountMin: 4,
        itemCountMax: 8
    },
    'save-lost-explorer': {
        title: () => 'Quest: Save Lost Explorer',
        objective: () => 'Find the lost explorer in the guarded room.',
        appendTurnsRemaining: false
    },
    'retrieve-item': {
        title: () => 'Quest: Retrieve Item',
        objective: ({ itemName }) => `Recover ${itemName || 'the quest item'} and return it to the Questgiver.`,
        appendTurnsRemaining: false
    },
    'material-delivery': {
        title: () => 'Quest: Material Delivery',
        objective: ({ engineerName, materialCount, materialName }) => `Bring ${materialCount || 1} ${materialName || 'delivery material'}${(materialCount || 1) === 1 ? '' : 's'} to ${engineerName || 'the engineer'}.`,
        appendTurnsRemaining: false
    }
});

const RANDOM_FLOOR_EVENT_TYPES = Object.freeze(['food-party', 'throwing-challenge']);
const RANDOM_FLOOR_EVENT_ACTIVATORS = Object.freeze({
    'food-party': 'activateFoodPartyEvent',
    'throwing-challenge': 'activateThrowingChallengeEvent',
    hoard: 'activateHoardEvent'
});
const QUEST_FLOOR_EVENT_TYPES = Object.freeze(['save-lost-explorer', 'retrieve-item', 'material-delivery']);
const QUEST_FLOOR_EVENT_ACTIVATOR_METHODS = Object.freeze([
    'tryActivateSaveLostExplorerEvent',
    'tryActivateRetrieveItemQuestEvent',
    'tryActivateMaterialDeliveryQuestEvent'
]);

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
    '#': TILE_TYPES.SHOP,
    L: TILE_TYPES.LAVA,
    P: TILE_TYPES.PIT,
    S: HAZARD_TYPES.STEAM,
    I: 'premade_random_item',
    E: 'premade_random_enemy',
    $: TILE_TYPES.SHOP
};

const PREMADE_TERRAIN_SHAPES = {
    dungeonShop: {
        rows: [
            '#####',
            '#####',
            '##$##',
            '#####',
            '#####'
        ]
    },
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
        { shapeId: 'lava_item', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 },
        { shapeId: 'dungeonShop', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 }
    ],
    [AREA_TYPES.SWAMP]: [
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.45 },
        { shapeId: 'lava_pool_3x2', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.35 },
        { shapeId: 'island_2x2', minFloor: 0, minCount: 1, maxCount: 3, chance: 0.9 },
        { shapeId: 'lava_item', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.2 },
        { shapeId: 'dungeonShop', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 }
    ],
    [AREA_TYPES.FLOATING]: [
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.45 },
        { shapeId: 'lava_pool_3x2', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.35 },
        { shapeId: 'island_2x2', minFloor: 0, minCount: 0, maxCount: 2, chance: 0.6 },
        { shapeId: 'lava_item', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.1 },
        { shapeId: 'dungeonShop', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 }
    ],
    [AREA_TYPES.CATACOMBS]: [
        { shapeId: 'pit_cross', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.45 },
        { shapeId: 'lava_pool_3x2', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.35 },
        { shapeId: 'island_2x2', minFloor: 0, minCount: 1, maxCount: 3, chance: 0.9 },
        { shapeId: 'lava_item', minFloor: 0, minCount: 0, maxCount: 1, chance: 0.2 },
        { shapeId: 'dungeonShop', minFloor: 0, minCount: 0, maxCount: 1, chance: 1 }
    ]
};

function normalizeConfigKey(key) {
    return typeof key === 'string' ? key : '';
}

function getConfigMapValue(configMap, key, fallback = null) {
    if (!configMap || typeof configMap !== 'object') {
        return fallback;
    }

    const normalizedKey = normalizeConfigKey(key);
    return Object.prototype.hasOwnProperty.call(configMap, normalizedKey)
        ? configMap[normalizedKey]
        : fallback;
}

function getConfigArrayEntries(configMap, key) {
    const entries = getConfigMapValue(configMap, key, []);
    return Array.isArray(entries) ? entries : [];
}

function getAreaGenerationRule(areaType) {
    return getConfigMapValue(AREA_GENERATION_RULES, areaType, AREA_GENERATION_RULES[AREA_TYPES.DUNGEON]);
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

function getAreaFallbackSelectionRules() {
    return Array.isArray(AREA_FALLBACK_SELECTION_RULES)
        ? [...AREA_FALLBACK_SELECTION_RULES]
        : [];
}

function getFallbackAreaTypeForDungeonDepth(dungeonDepthIndex) {
    const normalizedDepthIndex = Math.max(0, Math.floor(Number(dungeonDepthIndex) || 0));
    const selectionRules = getAreaFallbackSelectionRules();

    for (const rule of selectionRules) {
        if (!rule || rule.default) {
            continue;
        }

        const modulo = Math.max(1, Math.floor(Number(rule.modulo) || 1));
        const remainder = Math.floor(Number(rule.remainder) || 0);
        if (normalizedDepthIndex % modulo === remainder) {
            return rule.areaType;
        }
    }

    const defaultRule = selectionRules.find((rule) => Boolean(rule?.default));
    return defaultRule?.areaType || AREA_TYPES.CATACOMBS;
}

function getAreaRuntimeGenerationRule(areaType) {
    return getConfigMapValue(AREA_RUNTIME_GENERATION_RULES, areaType, AREA_RUNTIME_GENERATION_RULES[AREA_TYPES.DUNGEON] || null);
}

function getDungeonPathDefinitions() {
    return DUNGEON_PATH_DEFINITIONS;
}

function getDefaultDungeonPathId() {
    const pathIds = Object.keys(DUNGEON_PATH_DEFINITIONS);
    const initiallyUnlockedPathId = pathIds.find((pathId) => Boolean(DUNGEON_PATH_DEFINITIONS[pathId]?.startsUnlocked));
    return initiallyUnlockedPathId || pathIds[0] || 'anomalousRuins';
}

function getDungeonPathDefinition(pathId) {
    return getConfigMapValue(DUNGEON_PATH_DEFINITIONS, pathId, null);
}

function getInitiallyUnlockedDungeonPathIds() {
    const pathIds = Object.keys(DUNGEON_PATH_DEFINITIONS)
        .filter((pathId) => Boolean(DUNGEON_PATH_DEFINITIONS[pathId]?.startsUnlocked));
    return pathIds.length > 0 ? pathIds : [getDefaultDungeonPathId()];
}

function getDungeonPathUnlocksOnComplete(pathId) {
    const unlocksOnComplete = getDungeonPathDefinition(pathId)?.unlocksOnComplete;
    return Array.isArray(unlocksOnComplete)
        ? unlocksOnComplete.filter((unlockPathId) => Boolean(getDungeonPathDefinition(unlockPathId)))
        : [];
}

function getDungeonWorldEventRule(eventId) {
    return getConfigMapValue(DUNGEON_WORLD_EVENT_RULES, eventId, null);
}

function getDungeonWorldEventRequiredCompletedPaths(eventId) {
    const requiredCompletedPaths = getDungeonWorldEventRule(eventId)?.requiredCompletedPaths;
    return Array.isArray(requiredCompletedPaths)
        ? requiredCompletedPaths.filter((pathId) => Boolean(getDungeonPathDefinition(pathId)))
        : [];
}

function getDungeonWorldEventUnlockMessage(eventId) {
    const unlockMessage = getDungeonWorldEventRule(eventId)?.unlockMessage;
    return typeof unlockMessage === 'string' ? unlockMessage : '';
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

function getQuestgiverQuestPool(poolKey) {
    return getConfigArrayEntries(QUESTGIVER_QUEST_POOLS, poolKey);
}

function getQuestgiverAdvanceQuestConfig(configKey) {
    return getConfigMapValue(QUESTGIVER_ADVANCE_QUEST_CONFIGS, configKey, null);
}

function getQuestgiverNamePoolEntries(poolKey) {
    return getConfigArrayEntries(QUESTGIVER_NAME_POOLS, poolKey);
}

function getQuestgiverQuestBuilderMethods() {
    return Array.isArray(QUESTGIVER_QUEST_BUILDER_METHODS)
        ? [...QUESTGIVER_QUEST_BUILDER_METHODS]
        : [];
}

function getEnemyScalingRules() {
    return ENEMY_SCALING_RULES;
}

function getItemSpawnImprovementRules() {
    return ITEM_SPAWN_IMPROVEMENT_RULES;
}

function getItemSpawnCountRangeForDisplayFloor(displayFloor) {
    const normalizedFloor = Math.max(1, Math.min(99, Math.floor(Number(displayFloor) || 1)));
    const matchingRule = ITEM_SPAWN_COUNT_RULES.find((rule) => normalizedFloor <= Math.max(1, Math.floor(Number(rule?.maxDisplayFloor) || 1)));

    if (!matchingRule) {
        return { minCount: 1, maxCount: 2 };
    }

    return {
        minCount: Math.max(1, Math.floor(Number(matchingRule.minCount) || 1)),
        maxCount: Math.max(1, Math.floor(Number(matchingRule.maxCount) || 1))
    };
}

function getItemTierWeightsForDisplayFloor(displayFloor) {
    const normalizedFloor = Math.max(1, Math.min(99, Math.floor(Number(displayFloor) || 1)));
    const matchingRule = ITEM_TIER_WEIGHT_RULES.find((rule) => {
        const minDisplayFloor = Math.max(1, Math.floor(Number(rule?.minDisplayFloor) || 1));
        const maxDisplayFloor = Math.max(minDisplayFloor, Math.floor(Number(rule?.maxDisplayFloor) || minDisplayFloor));
        return normalizedFloor >= minDisplayFloor && normalizedFloor <= maxDisplayFloor;
    }) || ITEM_TIER_WEIGHT_RULES[ITEM_TIER_WEIGHT_RULES.length - 1];

    if (!matchingRule || typeof matchingRule !== 'object') {
        return [{ tier: 1, weight: 1 }];
    }

    const minDisplayFloor = Math.max(1, Math.floor(Number(matchingRule.minDisplayFloor) || normalizedFloor));
    const maxDisplayFloor = Math.max(minDisplayFloor, Math.floor(Number(matchingRule.maxDisplayFloor) || minDisplayFloor));
    const progress = maxDisplayFloor === minDisplayFloor
        ? 0
        : (normalizedFloor - minDisplayFloor) / (maxDisplayFloor - minDisplayFloor);

    return Object.entries(matchingRule.tiers || {})
        .map(([tier, weightRule]) => {
            const startWeight = Number(weightRule?.start ?? weightRule);
            const endWeight = Number(weightRule?.end ?? startWeight);
            const interpolatedWeight = Math.round(startWeight + (endWeight - startWeight) * progress);
            return {
                tier: Math.max(1, Math.floor(Number(tier) || 1)),
                weight: Math.max(1, interpolatedWeight)
            };
        })
        .sort((a, b) => a.tier - b.tier);
}

function getItemRewardTierBoostChances() {
    return Array.isArray(ITEM_REWARD_TIER_BOOST_CHANCES)
        ? [...ITEM_REWARD_TIER_BOOST_CHANCES]
        : [];
}

function getFloorEventGlobalRules() {
    return FLOOR_EVENT_GLOBAL_RULES;
}

function getFloorEventRule(eventType) {
    return getConfigMapValue(FLOOR_EVENT_RULES, eventType, null);
}

function getRandomFloorEventTypeKeys() {
    return Array.isArray(RANDOM_FLOOR_EVENT_TYPES)
        ? [...RANDOM_FLOOR_EVENT_TYPES]
        : [];
}

function getRandomFloorEventActivatorMethod(eventType) {
    return getConfigMapValue(RANDOM_FLOOR_EVENT_ACTIVATORS, eventType, '');
}

function getQuestFloorEventTypeKeys() {
    return Array.isArray(QUEST_FLOOR_EVENT_TYPES)
        ? [...QUEST_FLOOR_EVENT_TYPES]
        : [];
}

function getQuestFloorEventActivatorMethods() {
    return Array.isArray(QUEST_FLOOR_EVENT_ACTIVATOR_METHODS)
        ? [...QUEST_FLOOR_EVENT_ACTIVATOR_METHODS]
        : [];
}

function getPremadeTerrainShape(shapeId) {
    return getConfigMapValue(PREMADE_TERRAIN_SHAPES, shapeId, null);
}

function getPremadeTerrainLegend() {
    return PREMADE_TERRAIN_LEGEND;
}

function getPremadeTerrainPlacementRules(areaType) {
    return getConfigArrayEntries(PREMADE_TERRAIN_PLACEMENT_RULES, areaType);
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