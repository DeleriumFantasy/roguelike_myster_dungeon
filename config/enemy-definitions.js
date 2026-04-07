// Enemy templates and AI action mappings

const ENEMY_SPEED_MULTIPLIERS = deepFreezeConfig({
    [ENEMY_SPEEDS.SLOW]: 0.5,
    [ENEMY_SPEEDS.NORMAL]: 1,
    [ENEMY_SPEEDS.FAST]: 2
});

const ENEMY_AI_ACTION_METHODS = deepFreezeConfig({
    [AI_TYPES.CHASE]: 'performChaseAction',
    [AI_TYPES.FLEE]: 'flee',
    [AI_TYPES.AMBUSH]: 'performAmbushAction',
    [AI_TYPES.GUARD]: 'performGuardAction',
    [AI_TYPES.BERSERK]: 'performBerserkAction',
    [AI_TYPES.WANDER]: 'performWanderAction'
});

const ENEMY_FAMILY_SPAWN_BALANCING = deepFreezeConfig({
    floorRange: {
        min: 1,
        max: 99
    },
    groups: {
        core: {
            families: ['slime', 'beast', 'aquatic', 'floating'],
            startFloor: 1,
            startBudget: 3.2,
            endBudget: 1
        },
        mid: {
            families: ['ghost', 'crafter', 'thief'],
            startFloor: 20,
            startBudget: 0.12,
            endBudget: 1
        },
        late: {
            families: ['vandal', 'fuser', 'pariah'],
            startFloor: 45,
            startBudget: 0.05,
            endBudget: 1
        }
    }
});

const ENEMY_CONTENT_SPAWN_RULES = Object.freeze({
    enemyCount: {
        base: 4,
        perFloorDivisor: 2,
        min: 4,
        max: 12
    },
    dungeonNpcChance: {
        startDisplayFloor: 1,
        endDisplayFloor: 99,
        startChance: 0.15,
        endChance: 0.05
    },
    slimeTinctureDropDenominatorsByTier: {
        1: 100,
        2: 50,
        3: 25,
        4: 10
    }
});

const ENEMY_FAMILY_DEFINITIONS = deepFreezeConfig({
    slime: {
        defaults: { types: [ENEMY_TYPES.SLIME], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 9 },
        tiers: {
            1: { key: 'slimeTier1', displayName: 'Green slime', health: 8, power: 3, armor: 4, exp: 2, tameThreshold: 3, spawnWeight: 12, minFloor: 0 },
            2: { key: 'slimeTier2', displayName: 'Blue slime', health: 11, power: 5, armor: 8, exp: 5, tameThreshold: 4, spawnWeight: 10, minFloor: 1 },
            3: { key: 'slimeTier3', displayName: 'Rare slime', health: 5, power: 100, armor: 100, exp: 2000, tameThreshold: 5, aiType: AI_TYPES.GUARD, spawnWeight: 1, minFloor: 4 },
            4: { key: 'slimeTier4', displayName: 'Shiny slime', health: 20, power: 100, armor: 999, exp: 3333, tameThreshold: 6, aiType: AI_TYPES.GUARD, speed: ENEMY_SPEEDS.FAST, spawnWeight: 1, minFloor: 6, guaranteedMoneyDrop: 2500 }
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
            1: { key: 'beastTier1', displayName: 'Hyena', health: 15, power: 9, armor: 4, exp: 12, tameThreshold: 3, spawnWeight: 12, minFloor: 1 },
            2: { key: 'beastTier2', displayName: 'Wolf', health: 45, power: 23, armor: 10, exp: 27, tameThreshold: 4, spawnWeight: 8, minFloor: 3 },
            3: { key: 'beastTier3', displayName: 'Dire wolf', health: 85, power: 40, armor: 33, exp: 350, tameThreshold: 5, spawnWeight: 3, minFloor: 5 },
            4: { key: 'beastTier4', displayName: 'Lion', health: 185, power: 60, armor: 40, exp: 1350, tameThreshold: 6, spawnWeight: 1, minFloor: 7, speed: ENEMY_SPEEDS.FAST }
        }
    },
    aquatic: {
        defaults: { types: [ENEMY_TYPES.AQUATIC], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 10 },
        tiers: {
            1: { key: 'aquaticTier1', displayName: 'Large frog', health: 16, power: 8, armor: 3, exp: 14, tameThreshold: 3, spawnWeight: 10, minFloor: 1 },
            2: { key: 'aquaticTier2', displayName: 'Snake', health: 40, power: 20, armor: 9, exp: 70, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'aquaticTier3', displayName: 'Crocodile', health: 92, power: 38, armor: 22, exp: 360, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'aquaticTier4', displayName: 'Hippo', health: 165, power: 58, armor: 34, exp: 1450, tameThreshold: 6, spawnWeight: 2, minFloor: 7 }
        }
    },
    floating: {
        defaults: { types: [ENEMY_TYPES.FLOATING], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 11 },
        tiers: {
            1: { key: 'floatingTier1', displayName: 'Raven', health: 12, power: 9, armor: 2, exp: 16, tameThreshold: 3, spawnWeight: 9, minFloor: 1 },
            2: { key: 'floatingTier2', displayName: 'Hawk', health: 34, power: 22, armor: 8, exp: 78, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'floatingTier3', displayName: 'Giant Eagle', health: 74, power: 41, armor: 17, exp: 390, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'floatingTier4', displayName: 'Roc', health: 135, power: 60, armor: 28, exp: 1500, tameThreshold: 6, spawnWeight: 2, minFloor: 7 }
        }
    },
    vandal: {
        defaults: { types: [ENEMY_TYPES.VANDAL], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.CHASE, fovRange: 10 },
        tiers: {
            1: { key: 'vandalTier1', displayName: 'Mischief maker', health: 18, power: 10, armor: 5, exp: 18, tameThreshold: 3, spawnWeight: 10, minFloor: 1 },
            2: { key: 'vandalTier2', displayName: 'Ruffian', health: 48, power: 24, armor: 12, exp: 95, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'vandalTier3', displayName: 'Scoundrel', health: 95, power: 44, armor: 24, exp: 430, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'vandalTier4', displayName: 'Brute', health: 170, power: 65, armor: 36, exp: 1600, tameThreshold: 6, spawnWeight: 2, minFloor: 7 }
        }
    },
    thief: {
        defaults: { types: [ENEMY_TYPES.THIEF], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.CHASE, fovRange: 12 },
        tiers: {
            1: { key: 'thiefTier1', displayName: 'Pickpocket', health: 12, power: 9, armor: 3, exp: 15, tameThreshold: 3, spawnWeight: 9, minFloor: 1 },
            2: { key: 'thiefTier2', displayName: 'Snatcher', health: 35, power: 21, armor: 9, exp: 80, tameThreshold: 4, spawnWeight: 7, minFloor: 3 },
            3: { key: 'thiefTier3', displayName: 'Bandit', health: 70, power: 36, armor: 18, exp: 320, tameThreshold: 5, spawnWeight: 4, minFloor: 5 },
            4: { key: 'thiefTier4', displayName: 'Master thief', health: 120, power: 55, armor: 28, exp: 1200, tameThreshold: 6, spawnWeight: 2, minFloor: 7 }
        }
    },
    fuser: {
        defaults: { types: [ENEMY_TYPES.FUSER], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.WANDER, fovRange: 11 },
        tiers: {
            1: { key: 'fuserTier1', displayName: 'Pixy', health: 17, power: 10, armor: 4, exp: 20, tameThreshold: 3, spawnWeight: 8, minFloor: 2 },
            2: { key: 'fuserTier2', displayName: 'Boggart', health: 45, power: 25, armor: 11, exp: 105, tameThreshold: 4, spawnWeight: 6, minFloor: 4 },
            3: { key: 'fuserTier3', displayName: 'Fae', health: 88, power: 43, armor: 23, exp: 500, tameThreshold: 5, spawnWeight: 4, minFloor: 6 },
            4: { key: 'fuserTier4', displayName: 'Homunculus', health: 155, power: 62, armor: 34, exp: 1750, tameThreshold: 6, spawnWeight: 2, minFloor: 8 }
        }
    },
    pariah: {
        defaults: { types: [ENEMY_TYPES.PARIAH], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.AMBUSH, fovRange: 11 },
        tiers: {
            1: { key: 'pariahTier1', displayName: 'Leper', health: 14, power: 11, armor: 3, exp: 22, tameThreshold: 3, spawnWeight: 8, minFloor: 2 },
            2: { key: 'pariahTier2', displayName: 'Reject', health: 42, power: 27, armor: 9, exp: 115, tameThreshold: 4, spawnWeight: 6, minFloor: 4 },
            3: { key: 'pariahTier3', displayName: 'Outcast', health: 82, power: 46, armor: 20, exp: 540, tameThreshold: 5, spawnWeight: 4, minFloor: 6 },
            4: { key: 'pariahTier4', displayName: 'Exile', health: 145, power: 66, armor: 31, exp: 1900, tameThreshold: 6, spawnWeight: 2, minFloor: 8 }
        }
    },
    crafter: {
        defaults: { types: [ENEMY_TYPES.CRAFTER], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.GUARD, fovRange: 10 },
        tiers: {
            1: { key: 'crafterTier1', displayName: 'Snarer', health: 20, power: 8, armor: 6, exp: 25, tameThreshold: 3, spawnWeight: 8, minFloor: 2 },
            2: { key: 'crafterTier2', displayName: 'Trapper', health: 55, power: 22, armor: 16, exp: 130, tameThreshold: 4, spawnWeight: 6, minFloor: 4 },
            3: { key: 'crafterTier3', displayName: 'Schemer', health: 100, power: 38, armor: 30, exp: 620, tameThreshold: 5, spawnWeight: 4, minFloor: 6 },
            4: { key: 'crafterTier4', displayName: 'Illaqueator', health: 175, power: 54, armor: 44, exp: 2100, tameThreshold: 6, spawnWeight: 2, minFloor: 8 }
        }
    },
    escort: {
        defaults: { types: [], speed: ENEMY_SPEEDS.NORMAL, aiType: AI_TYPES.GUARD, fovRange: 8, spawnContexts: ['quest'] },
        tiers: {
            1: { key: 'escortPassengerTier1', displayName: 'Pilgrim', health: 50, power: 0, armor: 2, exp: 0, tameThreshold: 9999, spawnWeight: 0, minFloor: 0, npcRole: 'escort-passenger' }
        }
    },
    npc: {
        defaults: { types: [ENEMY_TYPES.NPC], speed: ENEMY_SPEEDS.SLOW, aiType: AI_TYPES.WANDER, fovRange: 8, spawnContexts: ['dungeon'] },
        tiers: {
            1: { key: 'npcTier1', displayName: 'Wandering merchant', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 1, minFloor: 1, npcRole: 'merchant', spawnContexts: ['dungeon'] },
            2: { key: 'npcBankerTier1', displayName: 'Banker', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 0, minFloor: 0, npcRole: 'banker', spawnContexts: ['overworld'], persistentNpc: true },
            3: { key: 'npcStarvingTier1', displayName: 'Starving traveler', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 1, minFloor: 1, npcRole: 'starving', spawnContexts: ['dungeon'] },
            4: { key: 'npcHomeboundTier1', displayName: 'Homebound courier', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 1, minFloor: 1, npcRole: 'homebound', spawnContexts: ['dungeon'] },
            5: { key: 'npcShamanTier1', displayName: 'Shaman', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 1, minFloor: 1, npcRole: 'shaman', spawnContexts: ['dungeon'] },
            6: { key: 'npcQuestgiverTier1', displayName: 'Questgiver', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 0, minFloor: 0, npcRole: 'questgiver', spawnContexts: ['overworld'], persistentNpc: true },
            7: { key: 'npcHandlerTier1', displayName: 'Handler', health: 9999, power: 0, armor: 0, exp: 0, tameThreshold: 9999, spawnWeight: 0, minFloor: 0, npcRole: 'handler', spawnContexts: ['overworld'], persistentNpc: true }
        }
    }
});

function getEnemySpeedMultiplier(speed) {
    return ENEMY_SPEED_MULTIPLIERS[speed] ?? ENEMY_SPEED_MULTIPLIERS[ENEMY_SPEEDS.NORMAL];
}

function getEnemyAiActionHandlerName(aiType) {
    return ENEMY_AI_ACTION_METHODS[aiType] || ENEMY_AI_ACTION_METHODS[AI_TYPES.WANDER];
}

function getEnemyContentSpawnRules() {
    return ENEMY_CONTENT_SPAWN_RULES;
}

function getEnemySpawnCountForDepth(floorIndex) {
    const rules = getEnemyContentSpawnRules()?.enemyCount || {};
    const base = Math.max(0, Math.floor(Number(rules.base) || 4));
    const perFloorDivisor = Math.max(1, Math.floor(Number(rules.perFloorDivisor) || 2));
    const minCount = Math.max(0, Math.floor(Number(rules.min) || base));
    const maxCount = Math.max(minCount, Math.floor(Number(rules.max) || minCount));
    const normalizedFloor = Math.max(0, Math.floor(Number(floorIndex) || 0));
    return Math.max(minCount, Math.min(maxCount, base + Math.floor(normalizedFloor / perFloorDivisor)));
}

function getDungeonNpcSpawnChanceForFloorIndex(floorIndex) {
    const rules = getEnemyContentSpawnRules()?.dungeonNpcChance || {};
    const displayFloor = Math.max(1, Math.min(99, Math.floor(Number(floorIndex) || 0) + 1));
    const startDisplayFloor = Math.max(1, Math.floor(Number(rules.startDisplayFloor) || 1));
    const endDisplayFloor = Math.max(startDisplayFloor, Math.floor(Number(rules.endDisplayFloor) || startDisplayFloor));
    const startChance = Math.min(1, Math.max(0, Number(rules.startChance) || 0.15));
    const endChance = Math.min(1, Math.max(0, Number(rules.endChance) || 0.05));
    const progress = endDisplayFloor === startDisplayFloor
        ? 0
        : (displayFloor - startDisplayFloor) / (endDisplayFloor - startDisplayFloor);
    return startChance + (endChance - startChance) * Math.min(1, Math.max(0, progress));
}

function getSlimeTinctureDropDenominatorForTier(tier) {
    const rules = getEnemyContentSpawnRules()?.slimeTinctureDropDenominatorsByTier || {};
    const normalizedTier = Math.max(1, Math.floor(Number(tier) || 1));
    const denominator = Number(rules[normalizedTier]);
    return Number.isFinite(denominator) ? Math.max(0, Math.floor(denominator)) : 0;
}

function normalizeEnemySpawnContexts(spawnContexts) {
    if (!Array.isArray(spawnContexts)) {
        return [];
    }

    return [...new Set(spawnContexts.filter((context) => typeof context === 'string' && context.length > 0))];
}

function buildEnemyTemplateDefinition(familyId, family, tierKey, tierDefinition) {
    const normalizedTier = Number.isFinite(Number(tierKey))
        ? Math.max(1, Math.floor(Number(tierKey)))
        : 1;

    return {
        ...family.defaults,
        ...tierDefinition,
        templateId: tierDefinition.key,
        familyId,
        tier: normalizedTier,
        npcRole: typeof tierDefinition.npcRole === 'string' ? tierDefinition.npcRole : '',
        spawnContexts: normalizeEnemySpawnContexts(tierDefinition.spawnContexts || family.defaults.spawnContexts),
        persistentNpc: Boolean(tierDefinition.persistentNpc),
        types: tierDefinition.types || family.defaults.types || []
    };
}

function buildEnemyTemplates() {
    const templates = {};
    for (const [familyId, family] of Object.entries(ENEMY_FAMILY_DEFINITIONS)) {
        for (const [tierKey, tierDefinition] of Object.entries(family.tiers || {})) {
            templates[tierDefinition.key] = buildEnemyTemplateDefinition(familyId, family, tierKey, tierDefinition);
        }
    }
    return deepFreezeConfig(templates);
}

const ENEMY_TEMPLATES = buildEnemyTemplates();