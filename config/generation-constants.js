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
    enabled: false,
    healthPerDepth: 0,
    powerPerDepthInterval: 0,
    armorPerDepthInterval: 0,
    expPerDepth: 0
});

const ITEM_SPAWN_IMPROVEMENT_RULES = Object.freeze({
    rollCount: 3,
    chancePerRoll: 0.05
});

const ITEM_REWARD_TIER_BOOST_CHANCES = Object.freeze([0.7, 0.35]);

// Dungeon-path + floor spawn tuning.
//
// Supported fields:
// - enemyCount: fixed enemy spawn count
// - enemyTypeWeights: enemy type weight multipliers ({ enemyTypeKey: multiplier })
// - dungeonNpcChance: 0..1 chance for neutral dungeon NPC spawn roll
// - trapSpawnChance: 0..1 per-floor-tile trap placement chance
// - trapFailureChance: 0..1 chance that a hidden trap is revealed but fails to trigger
// - excludedTrapTypes: trap type ids that are not allowed for that floor
// - itemMinCount / itemMaxCount: item spawn range for the floor
// - itemTierWeights: weighted item-tier list for that floor (array of { tier, weight })
// - itemCategoryWeights: category weight multipliers for that floor ({ categoryKey: multiplier })
// - noCursedItems: when true, spawned items do not receive world curse rolls
// - cursedItemChance: 0..1 chance for spawned items to roll a curse
const DUNGEON_PATH_FLOOR_SPAWN_RULES = deepFreezeConfig({
    anomalousRuins: {
        default: {
            enemyCount: 4,
            enemyTypeWeights: {
                slimeTier1: 1.35,
                beastTier1: 1.3,
                aquaticTier1: 1.2,
                floatingTier1: 1.2,
                vandalTier1: 1.15,
                thiefTier1: 1.1,
                ghostTier1: 0.85,
                fuserTier1: 0.8,
                pariahTier1: 0.75,
                crafterTier1: 0.7,
                slimeTier2: 0.5,
                beastTier2: 0.45,
                aquaticTier2: 0.45,
                floatingTier2: 0.45,
                vandalTier2: 0.45,
                thiefTier2: 0.45,
                ghostTier2: 0.35,
                fuserTier2: 0.35,
                pariahTier2: 0.35,
                crafterTier2: 0.35,
                slimeTier3: 0.15,
                beastTier3: 0.15,
                aquaticTier3: 0.15,
                floatingTier3: 0.15,
                vandalTier3: 0.15,
                thiefTier3: 0.15,
                ghostTier3: 0.1,
                fuserTier3: 0.1,
                pariahTier3: 0.1,
                crafterTier3: 0.1,
                slimeTier4: 0.05,
                beastTier4: 0.05,
                aquaticTier4: 0.05,
                floatingTier4: 0.05,
                vandalTier4: 0.05,
                thiefTier4: 0.05,
                ghostTier4: 0.03,
                fuserTier4: 0.03,
                pariahTier4: 0.03,
                crafterTier4: 0.03
            },
            dungeonNpcChance: 0.14,
            trapSpawnChance: 0.03,
            trapFailureChance: 0.5,
            excludedTrapTypes: [HAZARD_TYPES.TRAP_SLEEP, HAZARD_TYPES.TRAP_BLIND, HAZARD_TYPES.TRAP_TRIP],
            noCursedItems: true,
            cursedItemChance: 0,
            itemMinCount: 5,
            itemMaxCount: 10,
            itemTierWeights: [
                { tier: 1, weight: 78 },
                { tier: 2, weight: 19 },
                { tier: 3, weight: 3 }
            ],
            itemCategoryWeights: {
                money: 0.9,
                healing: 1.35,
                scroll: 0.12,
                statusConsumable: 1.3,
                throwable: 1.15,
                weapon: 1.35,
                armor: 1.3,
                shield: 1.25,
                accessory: 1.2,
                food: 1.25,
                pot: 0.15
            }
        },
        floorRanges: [
            {
                minDisplayFloor: 1,
                maxDisplayFloor: 3,
                enemyCount: 4,
                dungeonNpcChance: 0.18,
                trapSpawnChance: 0.022,
                trapFailureChance: 0.5,
                enemyTypeWeights: {
                    slimeTier2: 0.08,
                    beastTier2: 0.12,
                    aquaticTier2: 0.12,
                    floatingTier2: 0.12,
                    vandalTier2: 0.12,
                    thiefTier2: 0.12,
                    ghostTier2: 0.06,
                    fuserTier2: 0.06,
                    pariahTier2: 0.06,
                    crafterTier2: 0.06,
                    slimeTier3: 0,
                    beastTier3: 0,
                    aquaticTier3: 0,
                    floatingTier3: 0,
                    vandalTier3: 0,
                    thiefTier3: 0,
                    ghostTier3: 0,
                    fuserTier3: 0,
                    pariahTier3: 0,
                    crafterTier3: 0,
                    slimeTier4: 0,
                    beastTier4: 0,
                    aquaticTier4: 0,
                    floatingTier4: 0,
                    vandalTier4: 0,
                    thiefTier4: 0,
                    ghostTier4: 0,
                    fuserTier4: 0,
                    pariahTier4: 0,
                    crafterTier4: 0
                },
                itemMinCount: 4,
                itemMaxCount: 5,
                itemTierWeights: [
                    { tier: 1, weight: 85 },
                    { tier: 2, weight: 14 },
                    { tier: 4, weight: 1 }
                ]
            },
            {
                minDisplayFloor: 4,
                maxDisplayFloor: 7,
                enemyCount: 4,
                dungeonNpcChance: 0.14,
                trapSpawnChance: 0.03,
                trapFailureChance: 0.5,
                enemyTypeWeights: {
                    slimeTier2: 0.35,
                    beastTier2: 0.32,
                    aquaticTier2: 0.32,
                    floatingTier2: 0.32,
                    vandalTier2: 0.32,
                    thiefTier2: 0.32,
                    ghostTier2: 0.24,
                    fuserTier2: 0.24,
                    pariahTier2: 0.24,
                    crafterTier2: 0.24,
                    slimeTier3: 0.05,
                    beastTier3: 0.05,
                    aquaticTier3: 0.05,
                    floatingTier3: 0.05,
                    vandalTier3: 0.05,
                    thiefTier3: 0.05,
                    ghostTier3: 0.03,
                    fuserTier3: 0.03,
                    pariahTier3: 0.03,
                    crafterTier3: 0.03,
                    slimeTier4: 0,
                    beastTier4: 0,
                    aquaticTier4: 0,
                    floatingTier4: 0,
                    vandalTier4: 0,
                    thiefTier4: 0,
                    ghostTier4: 0,
                    fuserTier4: 0,
                    pariahTier4: 0,
                    crafterTier4: 0
                },
                itemMinCount: 3,
                itemMaxCount: 4,
                itemTierWeights: [
                    { tier: 1, weight: 72 },
                    { tier: 2, weight: 24 },
                    { tier: 3, weight: 4 }
                ]
            },
            {
                minDisplayFloor: 8,
                maxDisplayFloor: 15,
                enemyCount: 5,
                dungeonNpcChance: 0.1,
                trapSpawnChance: 0.038,
                trapFailureChance: 0.5,
                itemMinCount: 2,
                itemMaxCount: 3,
                itemTierWeights: [
                    { tier: 1, weight: 60 },
                    { tier: 2, weight: 30 },
                    { tier: 3, weight: 9 },
                    { tier: 4, weight: 1 }
                ]
            }
        ]
    },
    waterfallPath: {
        default: {
            enemyCount: 5,
            enemyTypeWeights: {
                slimeTier1: 0.95,
                beastTier1: 0.95,
                aquaticTier1: 1.0,
                floatingTier1: 0.95,
                vandalTier1: 0.95,
                thiefTier1: 1.0,
                ghostTier1: 1.0,
                fuserTier1: 1.05,
                pariahTier1: 1.05,
                crafterTier1: 1.05,
                slimeTier2: 1.3,
                beastTier2: 1.3,
                aquaticTier2: 1.35,
                floatingTier2: 1.25,
                vandalTier2: 1.3,
                thiefTier2: 1.3,
                ghostTier2: 1.35,
                fuserTier2: 1.4,
                pariahTier2: 1.4,
                crafterTier2: 1.4,
                slimeTier3: 0.8,
                beastTier3: 0.85,
                aquaticTier3: 0.85,
                floatingTier3: 0.8,
                vandalTier3: 0.85,
                thiefTier3: 0.85,
                ghostTier3: 0.95,
                fuserTier3: 0.95,
                pariahTier3: 0.95,
                crafterTier3: 0.95,
                slimeTier4: 0.3,
                beastTier4: 0.35,
                aquaticTier4: 0.35,
                floatingTier4: 0.3,
                vandalTier4: 0.35,
                thiefTier4: 0.35,
                ghostTier4: 0.45,
                fuserTier4: 0.45,
                pariahTier4: 0.45,
                crafterTier4: 0.45
            },
            dungeonNpcChance: 0.16,
            trapSpawnChance: 0.02,
            cursedItemChance: 0.12,
            itemMinCount: 3,
            itemMaxCount: 6,
            itemTierWeights: [
                { tier: 1, weight: 34 },
                { tier: 2, weight: 36 },
                { tier: 3, weight: 22 },
                { tier: 4, weight: 8 }
            ],
            itemCategoryWeights: {
                money: 1,
                healing: 1.1,
                food: 1.1,
                pot: 1.05,
                statusConsumable: 1,
                scroll: 1,
                throwable: 1.05,
                weapon: 0.95,
                armor: 0.95,
                shield: 0.95,
                accessory: 1
            }
        },
        floorRanges: [
            {
                minDisplayFloor: 1,
                maxDisplayFloor: 4,
                enemyCount: 5,
                dungeonNpcChance: 0.2,
                trapSpawnChance: 0.016,
                enemyTypeWeights: {
                    slimeTier2: 0.28,
                    beastTier2: 0.28,
                    aquaticTier2: 0.28,
                    floatingTier2: 0.26,
                    vandalTier2: 0.28,
                    thiefTier2: 0.28,
                    ghostTier2: 0.22,
                    fuserTier2: 0.22,
                    pariahTier2: 0.22,
                    crafterTier2: 0.22,
                    slimeTier3: 0.04,
                    beastTier3: 0.04,
                    aquaticTier3: 0.04,
                    floatingTier3: 0.04,
                    vandalTier3: 0.04,
                    thiefTier3: 0.04,
                    ghostTier3: 0.02,
                    fuserTier3: 0.02,
                    pariahTier3: 0.02,
                    crafterTier3: 0.02,
                    slimeTier4: 0,
                    beastTier4: 0,
                    aquaticTier4: 0,
                    floatingTier4: 0,
                    vandalTier4: 0,
                    thiefTier4: 0,
                    ghostTier4: 0,
                    fuserTier4: 0,
                    pariahTier4: 0,
                    crafterTier4: 0
                },
                itemMinCount: 3,
                itemMaxCount: 6
            },
            {
                minDisplayFloor: 5,
                maxDisplayFloor: 10,
                enemyCount: 6,
                dungeonNpcChance: 0.14,
                trapSpawnChance: 0.02,
                trapFailureChance: 0.5,
                enemyTypeWeights: {
                    slimeTier2: 0.7,
                    beastTier2: 0.7,
                    aquaticTier2: 0.72,
                    floatingTier2: 0.68,
                    vandalTier2: 0.7,
                    thiefTier2: 0.7,
                    ghostTier2: 0.62,
                    fuserTier2: 0.62,
                    pariahTier2: 0.62,
                    crafterTier2: 0.62,
                    slimeTier3: 0.2,
                    beastTier3: 0.2,
                    aquaticTier3: 0.2,
                    floatingTier3: 0.2,
                    vandalTier3: 0.2,
                    thiefTier3: 0.2,
                    ghostTier3: 0.16,
                    fuserTier3: 0.16,
                    pariahTier3: 0.16,
                    crafterTier3: 0.16,
                    slimeTier4: 0.04,
                    beastTier4: 0.04,
                    aquaticTier4: 0.04,
                    floatingTier4: 0.04,
                    vandalTier4: 0.04,
                    thiefTier4: 0.04,
                    ghostTier4: 0.03,
                    fuserTier4: 0.03,
                    pariahTier4: 0.03,
                    crafterTier4: 0.03
                },
                itemMinCount: 3,
                itemMaxCount: 4
            },
            {
                minDisplayFloor: 11,
                maxDisplayFloor: 15,
                enemyCount: 7,
                dungeonNpcChance: 0.1,
                trapSpawnChance: 0.026,
                trapFailureChance: 0.5,
                itemMinCount: 2,
                itemMaxCount: 3,
                itemTierWeights: [
                    { tier: 1, weight: 20 },
                    { tier: 2, weight: 34 },
                    { tier: 3, weight: 30 },
                    { tier: 4, weight: 16 }
                ]
            }
        ]
    },
    graspingPillars: {
        default: {
            enemyCount: 5,
            enemyTypeWeights: {
                slimeTier1: 1.0,
                beastTier1: 1.0,
                aquaticTier1: 0.95,
                floatingTier1: 0.95,
                vandalTier1: 1.0,
                thiefTier1: 1.0,
                ghostTier1: 1.05,
                fuserTier1: 1.1,
                pariahTier1: 1.15,
                crafterTier1: 1.15,
                slimeTier2: 1.15,
                beastTier2: 1.2,
                aquaticTier2: 1.15,
                floatingTier2: 1.1,
                vandalTier2: 1.2,
                thiefTier2: 1.2,
                ghostTier2: 1.3,
                fuserTier2: 1.35,
                pariahTier2: 1.35,
                crafterTier2: 1.35,
                slimeTier3: 0.65,
                beastTier3: 0.7,
                aquaticTier3: 0.65,
                floatingTier3: 0.6,
                vandalTier3: 0.7,
                thiefTier3: 0.7,
                ghostTier3: 0.8,
                fuserTier3: 0.8,
                pariahTier3: 0.85,
                crafterTier3: 0.85,
                slimeTier4: 0.2,
                beastTier4: 0.25,
                aquaticTier4: 0.2,
                floatingTier4: 0.2,
                vandalTier4: 0.25,
                thiefTier4: 0.25,
                ghostTier4: 0.35,
                fuserTier4: 0.35,
                pariahTier4: 0.35,
                crafterTier4: 0.35
            },
            dungeonNpcChance: 0.12,
            trapSpawnChance: 0.028,
            trapFailureChance: 0.5,
            cursedItemChance: 0.20,
            itemMinCount: 3,
            itemMaxCount: 6,
            itemTierWeights: [
                { tier: 1, weight: 38 },
                { tier: 2, weight: 36 },
                { tier: 3, weight: 20 },
                { tier: 4, weight: 6 }
            ],
            itemCategoryWeights: {
                money: 1,
                weapon: 0.55,
                armor: 0.5,
                shield: 0.5,
                accessory: 0.6,
                healing: 0.95,
                food: 0.9,
                pot: 2.2,
                statusConsumable: 1.25,
                scroll: 2,
                throwable: 1.1
            }
        },
        floorRanges: [
            {
                minDisplayFloor: 1,
                maxDisplayFloor: 5,
                enemyCount: 5,
                dungeonNpcChance: 0.14,
                trapSpawnChance: 0.024,
                trapFailureChance: 0.5,
                enemyTypeWeights: {
                    slimeTier2: 0.32,
                    beastTier2: 0.32,
                    aquaticTier2: 0.3,
                    floatingTier2: 0.3,
                    vandalTier2: 0.32,
                    thiefTier2: 0.32,
                    ghostTier2: 0.26,
                    fuserTier2: 0.26,
                    pariahTier2: 0.26,
                    crafterTier2: 0.26,
                    slimeTier3: 0.05,
                    beastTier3: 0.05,
                    aquaticTier3: 0.05,
                    floatingTier3: 0.05,
                    vandalTier3: 0.05,
                    thiefTier3: 0.05,
                    ghostTier3: 0.03,
                    fuserTier3: 0.03,
                    pariahTier3: 0.03,
                    crafterTier3: 0.03,
                    slimeTier4: 0,
                    beastTier4: 0,
                    aquaticTier4: 0,
                    floatingTier4: 0,
                    vandalTier4: 0,
                    thiefTier4: 0,
                    ghostTier4: 0,
                    fuserTier4: 0,
                    pariahTier4: 0,
                    crafterTier4: 0
                },
                itemMinCount: 3,
                itemMaxCount: 6
            },
            {
                minDisplayFloor: 6,
                maxDisplayFloor: 10,
                enemyCount: 6,
                dungeonNpcChance: 0.1,
                trapSpawnChance: 0.03,
                trapFailureChance: 0.5,
                enemyTypeWeights: {
                    slimeTier2: 0.78,
                    beastTier2: 0.8,
                    aquaticTier2: 0.78,
                    floatingTier2: 0.75,
                    vandalTier2: 0.8,
                    thiefTier2: 0.8,
                    ghostTier2: 0.7,
                    fuserTier2: 0.7,
                    pariahTier2: 0.7,
                    crafterTier2: 0.7,
                    slimeTier3: 0.24,
                    beastTier3: 0.24,
                    aquaticTier3: 0.24,
                    floatingTier3: 0.22,
                    vandalTier3: 0.24,
                    thiefTier3: 0.24,
                    ghostTier3: 0.2,
                    fuserTier3: 0.2,
                    pariahTier3: 0.2,
                    crafterTier3: 0.2,
                    slimeTier4: 0.05,
                    beastTier4: 0.05,
                    aquaticTier4: 0.05,
                    floatingTier4: 0.05,
                    vandalTier4: 0.05,
                    thiefTier4: 0.05,
                    ghostTier4: 0.04,
                    fuserTier4: 0.04,
                    pariahTier4: 0.04,
                    crafterTier4: 0.04
                },
                itemMinCount: 2,
                itemMaxCount: 3
            },
            {
                minDisplayFloor: 11,
                maxDisplayFloor: 15,
                enemyCount: 7,
                dungeonNpcChance: 0.07,
                trapSpawnChance: 0.036,
                trapFailureChance: 0.5,
                itemMinCount: 1,
                itemMaxCount: 2,
                itemTierWeights: [
                    { tier: 1, weight: 20 },
                    { tier: 2, weight: 35 },
                    { tier: 3, weight: 30 },
                    { tier: 4, weight: 15 }
                ]
            }
        ]
    }
});

const FLOOR_EVENT_GLOBAL_RULES = Object.freeze({
    randomEventChance: 0.02,
    guaranteedHoardFloors: []
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
        objective: ({ itemName }) => `Recover ${itemName} and return it to the Questgiver.`,
        appendTurnsRemaining: false
    },
    'material-delivery': {
        title: () => 'Quest: Material Delivery',
        objective: ({ engineerName, materialCount, materialName }) => `Bring ${materialCount} ${materialName}${materialCount === 1 ? '' : 's'} to ${engineerName}.`,
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
    return String(key);
}

function getConfigMapValue(configMap, key) {
    const normalizedKey = normalizeConfigKey(key);
    return configMap[normalizedKey];
}

function getConfigArrayEntries(configMap, key) {
    return getConfigMapValue(configMap, key);
}

function getAreaGenerationRule(areaType) {
    return getConfigMapValue(AREA_GENERATION_RULES, areaType);
}

function getCatacombsGenerationConfig() {
    return CATACOMBS_GENERATION_CONFIG;
}

function getOverworldGenerationConfig() {
    return OVERWORLD_GENERATION_CONFIG;
}

function getAreaRuntimeGenerationRule(areaType) {
    return getConfigMapValue(AREA_RUNTIME_GENERATION_RULES, areaType);
}

function getDungeonPathDefinitions() {
    return DUNGEON_PATH_DEFINITIONS;
}

function getDefaultDungeonPathId() {
    const pathIds = Object.keys(DUNGEON_PATH_DEFINITIONS);
    const initiallyUnlockedPathId = pathIds.find((pathId) => Boolean(DUNGEON_PATH_DEFINITIONS[pathId].startsUnlocked));
    return initiallyUnlockedPathId;
}

function getDungeonPathDefinition(pathId) {
    return getConfigMapValue(DUNGEON_PATH_DEFINITIONS, pathId);
}

function getInitiallyUnlockedDungeonPathIds() {
    const pathIds = Object.keys(DUNGEON_PATH_DEFINITIONS)
        .filter((pathId) => Boolean(DUNGEON_PATH_DEFINITIONS[pathId].startsUnlocked));
    return pathIds;
}

function getDungeonPathUnlocksOnComplete(pathId) {
    return getDungeonPathDefinition(pathId).unlocksOnComplete
        .filter((unlockPathId) => Boolean(getDungeonPathDefinition(unlockPathId)));
}

function getDungeonWorldEventRule(eventId) {
    return getConfigMapValue(DUNGEON_WORLD_EVENT_RULES, eventId);
}

function getDungeonWorldEventRequiredCompletedPaths(eventId) {
    return getDungeonWorldEventRule(eventId).requiredCompletedPaths
        .filter((pathId) => Boolean(getDungeonPathDefinition(pathId)));
}

function getDungeonWorldEventUnlockMessage(eventId) {
    return getDungeonWorldEventRule(eventId).unlockMessage;
}

function getDungeonPathMaxDepth(pathId) {
    const definition = getDungeonPathDefinition(pathId);
    return Math.floor(Number(definition.maxDepth));
}

function getDungeonPathDisallowedTiles(pathId) {
    const definition = getDungeonPathDefinition(pathId);
    return definition.disallowedTiles
        .filter((tileType) => Object.values(TILE_TYPES).includes(tileType));
}

function getDungeonAreaTypeForDepth(pathId, dungeonDepthIndex) {
    const definition = getDungeonPathDefinition(pathId);
    const sequence = definition.areaSequence.filter((areaType) => Object.values(AREA_TYPES).includes(areaType));
    const depthIndex = Math.max(0, Math.floor(Number(dungeonDepthIndex)));
    if (definition.loopSequence) {
        return sequence[depthIndex % sequence.length];
    }

    return sequence[Math.min(depthIndex, sequence.length - 1)];
}

function getQuestgiverQuestPool(poolKey) {
    return getConfigArrayEntries(QUESTGIVER_QUEST_POOLS, poolKey);
}

function getQuestgiverAdvanceQuestConfig(configKey) {
    return getConfigMapValue(QUESTGIVER_ADVANCE_QUEST_CONFIGS, configKey);
}

function getQuestgiverNamePoolEntries(poolKey) {
    return getConfigArrayEntries(QUESTGIVER_NAME_POOLS, poolKey);
}

function getQuestgiverQuestBuilderMethods() {
    return [...QUESTGIVER_QUEST_BUILDER_METHODS];
}

function getEnemyScalingRules() {
    return ENEMY_SCALING_RULES;
}

function getItemSpawnImprovementRules() {
    return ITEM_SPAWN_IMPROVEMENT_RULES;
}

function getItemRewardTierBoostChances() {
    return [...ITEM_REWARD_TIER_BOOST_CHANCES];
}

function getFloorEventGlobalRules() {
    return FLOOR_EVENT_GLOBAL_RULES;
}

function getFloorEventRule(eventType) {
    return getConfigMapValue(FLOOR_EVENT_RULES, eventType);
}

function getRandomFloorEventTypeKeys() {
    return [...RANDOM_FLOOR_EVENT_TYPES];
}

function getRandomFloorEventActivatorMethod(eventType) {
    return getConfigMapValue(RANDOM_FLOOR_EVENT_ACTIVATORS, eventType);
}

function getQuestFloorEventTypeKeys() {
    return [...QUEST_FLOOR_EVENT_TYPES];
}

function getQuestFloorEventActivatorMethods() {
    return [...QUEST_FLOOR_EVENT_ACTIVATOR_METHODS];
}

function getPremadeTerrainShape(shapeId) {
    return getConfigMapValue(PREMADE_TERRAIN_SHAPES, shapeId);
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
    if (!Array.isArray(entries)) {
        return [];
    }

    const normalizedFloor = Math.max(0, Math.floor(Number(floorIndex) || 0));

    return entries.filter((entry) => {
        const minFloorValue = Number(entry?.minFloor);
        const maxFloorValue = Number(entry?.maxFloor);
        const minFloor = Number.isFinite(minFloorValue) ? Math.floor(minFloorValue) : 0;
        const maxFloor = Number.isFinite(maxFloorValue) ? Math.floor(maxFloorValue) : Number.POSITIVE_INFINITY;
        return normalizedFloor >= minFloor && normalizedFloor <= maxFloor;
    });
}

function normalizeDisplayFloor(displayFloor) {
    return Math.max(1, Math.min(99, Math.floor(Number(displayFloor))));
}

function getDisplayFloorFromFloorIndex(floorIndex) {
    return normalizeDisplayFloor(Math.floor(Number(floorIndex)) + 1);
}

function createFallbackDungeonPathFloorSpawnRule() {
    return {
        enemyCount: 0,
        enemyTypeWeights: {},
        dungeonNpcChance: 0,
        trapSpawnChance: 0,
        trapFailureChance: 0,
        excludedTrapTypes: [],
        noCursedItems: false,
        cursedItemChance: 0,
        itemMinCount: 0,
        itemMaxCount: 0,
        itemTierWeights: [],
        itemCategoryWeights: {}
    };
}

function getDungeonPathFloorSpawnRuleSet(dungeonPathId) {
    const normalizedPathId = String(dungeonPathId || '').trim();
    if (normalizedPathId.length > 0) {
        const requestedRuleSet = getConfigMapValue(DUNGEON_PATH_FLOOR_SPAWN_RULES, normalizedPathId);
        if (requestedRuleSet) {
            return requestedRuleSet;
        }
    }

    const defaultPathId = getDefaultDungeonPathId();
    if (defaultPathId) {
        const defaultRuleSet = getConfigMapValue(DUNGEON_PATH_FLOOR_SPAWN_RULES, defaultPathId);
        if (defaultRuleSet) {
            return defaultRuleSet;
        }
    }

    const firstAvailableRuleSet = Object.values(DUNGEON_PATH_FLOOR_SPAWN_RULES)
        .find((ruleSet) => Boolean(ruleSet));

    if (firstAvailableRuleSet) {
        return firstAvailableRuleSet;
    }

    return {
        default: createFallbackDungeonPathFloorSpawnRule(),
        floorRanges: []
    };
}

function buildFloorSpawnRuleForDisplayFloor(ruleSet, normalizedFloor) {
    const fallbackRule = createFallbackDungeonPathFloorSpawnRule();
    const resolvedRuleSet = ruleSet && typeof ruleSet === 'object'
        ? ruleSet
        : {};
    const defaultRule = resolvedRuleSet.default && typeof resolvedRuleSet.default === 'object'
        ? resolvedRuleSet.default
        : {};
    const baseRule = {
        ...fallbackRule,
        ...defaultRule
    };
    const floorRanges = Array.isArray(resolvedRuleSet.floorRanges)
        ? resolvedRuleSet.floorRanges
        : [];

    for (const rangeRule of floorRanges) {
        if (!rangeRule || typeof rangeRule !== 'object') {
            continue;
        }

        const minDisplayFloor = normalizeDisplayFloor(Number(rangeRule.minDisplayFloor));
        const maxDisplayFloor = Math.max(minDisplayFloor, normalizeDisplayFloor(Number(rangeRule.maxDisplayFloor)));
        if (normalizedFloor < minDisplayFloor || normalizedFloor > maxDisplayFloor) {
            continue;
        }

        Object.assign(baseRule, rangeRule);
    }

    return baseRule;
}

function getDungeonPathFloorSpawnRuleForDisplayFloor(areaType, displayFloor, dungeonPathId = '') {
    const normalizedFloor = normalizeDisplayFloor(displayFloor);
    const dungeonRuleSet = getDungeonPathFloorSpawnRuleSet(dungeonPathId);
    return buildFloorSpawnRuleForDisplayFloor(dungeonRuleSet, normalizedFloor);
}

function getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId = '') {
    return getDungeonPathFloorSpawnRuleForDisplayFloor(areaType, getDisplayFloorFromFloorIndex(floorIndex), dungeonPathId);
}

function getDungeonPathFloorEnemySpawnCount(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const enemyCount = Number(rule.enemyCount);
    return Math.max(0, Math.floor(enemyCount));
}

function getDungeonPathFloorEnemyTypeWeightMap(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const configuredMap = rule.enemyTypeWeights;

    const normalizedMap = {};
    for (const [enemyTypeKey, weightMultiplier] of Object.entries(configuredMap)) {
        const normalizedTypeKey = String(enemyTypeKey).trim();
        const normalizedWeight = Number(weightMultiplier);
        if (normalizedTypeKey.length === 0 || !Number.isFinite(normalizedWeight) || normalizedWeight < 0) {
            continue;
        }

        normalizedMap[normalizedTypeKey] = normalizedWeight;
    }

    return normalizedMap;
}

function getDungeonPathFloorDungeonNpcSpawnChance(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const configuredChance = Number(rule.dungeonNpcChance);
    return Math.min(1, Math.max(0, configuredChance));
}

function getDungeonPathFloorTrapSpawnChance(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const configuredChance = Number(rule.trapSpawnChance);
    return Math.min(1, Math.max(0, configuredChance));
}

function getDungeonPathFloorTrapFailureChance(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const configuredChance = Number(rule.trapFailureChance);
    return Math.min(1, Math.max(0, configuredChance));
}

function getDungeonPathFloorAllowedTrapTypes(areaType, floorIndex, dungeonPathId = '', trapTypes) {
    const baseTrapTypes = trapTypes
        .filter((trapType) => typeof trapType === 'string' && trapType.length > 0);
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const excludedTrapTypes = new Set(rule.excludedTrapTypes
        .map((trapType) => String(trapType).trim())
        .filter((trapType) => trapType.length > 0));

    return baseTrapTypes.filter((trapType) => !excludedTrapTypes.has(trapType));
}

function getDungeonPathFloorCursedItemChance(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    if (rule.noCursedItems === true) {
        return 0;
    }

    const configuredChance = Number(rule.cursedItemChance);
    return Math.min(1, Math.max(0, configuredChance));
}

function getDungeonPathFloorItemSpawnCountRange(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const configuredMin = Number(rule.itemMinCount);
    const configuredMax = Number(rule.itemMaxCount);
    const minCount = Math.max(0, Math.floor(configuredMin));
    const maxCount = Math.max(minCount, Math.floor(configuredMax));

    return { minCount, maxCount };
}

function normalizeItemTierWeightEntries(weightEntries) {
    return weightEntries
        .map((entry) => ({
            tier: Math.max(1, Math.floor(Number(entry.tier))),
            weight: Math.max(0, Math.floor(Number(entry.weight)))
        }))
        .filter((entry) => entry.weight > 0)
        .sort((left, right) => left.tier - right.tier);
}

function getDungeonPathFloorItemTierWeights(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    return normalizeItemTierWeightEntries(rule.itemTierWeights);
}

function getDungeonPathFloorItemCategoryWeightMap(areaType, floorIndex, dungeonPathId = '') {
    const rule = getDungeonPathFloorSpawnRuleForFloorIndex(areaType, floorIndex, dungeonPathId);
    const configuredMap = rule.itemCategoryWeights;

    const normalizedMap = {};
    for (const [categoryKey, weightMultiplier] of Object.entries(configuredMap)) {
        const normalizedCategory = String(categoryKey).trim();
        const normalizedWeight = Number(weightMultiplier);
        if (normalizedCategory.length === 0 || !Number.isFinite(normalizedWeight) || normalizedWeight < 0) {
            continue;
        }

        normalizedMap[normalizedCategory] = normalizedWeight;
    }

    return normalizedMap;
}