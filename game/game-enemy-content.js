// Enemy spawning, creation, and promotion helpers
//
// This file is responsible for enemy-side content setup only:
// - choosing spawn entries for the current floor
// - building enemy instances from ENEMY_TEMPLATES
// - assigning initial held items that are part of enemy generation
// - promoting existing enemies to their next tier after kill-resolution events
//
// Keep turn-by-turn enemy behavior out of this file. Runtime enemy decisions belong
// in enemy-ai.js and game-enemy-turns.js. Shared weighted content helpers belong in
// game-content-utils.js.

Object.assign(Game.prototype, {
    getEnemyTemplateMetadata(enemyTypeKey) {
        const normalizedTypeKey = typeof enemyTypeKey === 'string' ? enemyTypeKey : '';
        return normalizedTypeKey && ENEMY_TEMPLATES[normalizedTypeKey]
            ? ENEMY_TEMPLATES[normalizedTypeKey]
            : null;
    },

    getPersistentOverworldNpcTypeKeys() {
        return Object.values(ENEMY_TEMPLATES)
            .filter((template) => Array.isArray(template?.spawnContexts)
                && template.spawnContexts.includes('overworld')
                && Boolean(template.persistentNpc))
            .map((template) => template.templateId || template.key || template.monsterType)
            .filter((templateId, index, allTemplateIds) => typeof templateId === 'string'
                && templateId.length > 0
                && allTemplateIds.indexOf(templateId) === index);
    },

    shouldUnlockSecondQuestgiver() {
        const requiredCompletedPaths = getDungeonWorldEventRequiredCompletedPaths('secondQuestgiver');
        return requiredCompletedPaths.length > 0
            && requiredCompletedPaths.every((pathId) => this.world?.hasCompletedDungeonPath?.(pathId));
    },

    ensureSecondQuestgiverAvailability() {
        if (!Array.isArray(this.persistentOverworldNpcs)) {
            this.persistentOverworldNpcs = [];
        }

        if (!this.shouldUnlockSecondQuestgiver()) {
            this.persistentOverworldNpcs = this.persistentOverworldNpcs.filter((npc) => !npc?.isSecondQuestgiver);
            return null;
        }

        const existingSecond = this.persistentOverworldNpcs.find((npc) => npc?.isSecondQuestgiver);
        if (existingSecond) {
            return existingSecond;
        }

        const eventRule = getDungeonWorldEventRule('secondQuestgiver') || {};
        const npcTypeKey = typeof eventRule.npcTypeKey === 'string' ? eventRule.npcTypeKey : 'npcQuestgiverTier1';
        const secondQuestgiver = this.createEnemyForType(0, 0, npcTypeKey, 0);
        if (!secondQuestgiver) {
            return null;
        }

        secondQuestgiver.isSecondQuestgiver = true;
        secondQuestgiver.name = typeof eventRule.npcName === 'string' ? eventRule.npcName : 'Questgiver (second)';
        this.persistentOverworldNpcs.push(secondQuestgiver);
        return secondQuestgiver;
    },

    isBankerTypeKey(enemyTypeKey) {
        return this.getEnemyTemplateMetadata(enemyTypeKey)?.npcRole === 'banker';
    },

    isOverworldNpcTypeKey(enemyTypeKey) {
        const template = this.getEnemyTemplateMetadata(enemyTypeKey);
        return Array.isArray(template?.spawnContexts)
            && template.spawnContexts.includes('overworld');
    },

    isDungeonNpcTypeKey(enemyTypeKey) {
        const template = this.getEnemyTemplateMetadata(enemyTypeKey);
        return Array.isArray(template?.spawnContexts)
            && template.spawnContexts.includes('dungeon');
    },

    getEnemyFamilyFromTypeKey(enemyTypeKey) {
        const familyId = this.getEnemyTemplateMetadata(enemyTypeKey)?.familyId;
        if (typeof familyId === 'string' && familyId.length > 0) {
            return familyId;
        }

        const match = String(enemyTypeKey || '').match(/^([a-zA-Z]+)Tier\d+$/);
        return match ? match[1] : String(enemyTypeKey || '');
    },

    getEnemySpawnGroupForFamily(enemyFamily) {
        const groups = ENEMY_FAMILY_SPAWN_BALANCING.groups;
        for (const [groupName, groupConfig] of Object.entries(groups)) {
            if (Array.isArray(groupConfig?.families) && groupConfig.families.includes(enemyFamily)) {
                return groupName;
            }
        }

        return null;
    },

    getEnemySpawnGroupFamilyBudget(spawnGroup, floorIndex) {
        const groupConfig = ENEMY_FAMILY_SPAWN_BALANCING.groups[spawnGroup];
        if (!groupConfig) {
            return 1;
        }

        const floorMin = ENEMY_FAMILY_SPAWN_BALANCING.floorRange.min;
        const floorMax = ENEMY_FAMILY_SPAWN_BALANCING.floorRange.max;
        const displayFloor = clamp(Math.floor(Number(floorIndex) || 0) + 1, floorMin, floorMax);
        const startFloor = clamp(Number(groupConfig.startFloor) || floorMin, floorMin, floorMax);
        const startBudget = Number(groupConfig.startBudget) || 1;
        const endBudget = Number(groupConfig.endBudget) || 1;

        const progress = clamp((displayFloor - startFloor) / Math.max(1, floorMax - startFloor), 0, 1);
        return startBudget + (endBudget - startBudget) * progress;
    },

    applyEnemyFamilySpawnBalancing(entries, floorIndex) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }

        const familyBaseWeightTotals = new Map();

        for (const entry of entries) {
            const family = this.getEnemyFamilyFromTypeKey(entry.key);
            const spawnGroup = this.getEnemySpawnGroupForFamily(family);
            if (!spawnGroup) {
                continue;
            }

            const weight = Math.max(0, Number(entry.weight) || 0);
            const currentTotal = familyBaseWeightTotals.get(family) || 0;
            familyBaseWeightTotals.set(family, currentTotal + weight);
        }

        return entries.map((entry) => {
            const family = this.getEnemyFamilyFromTypeKey(entry.key);
            const spawnGroup = this.getEnemySpawnGroupForFamily(family);
            if (!spawnGroup) {
                return entry;
            }

            const familyTotal = familyBaseWeightTotals.get(family) || 0;
            if (familyTotal <= 0) {
                return {
                    ...entry,
                    weight: 0
                };
            }

            const familyBudget = this.getEnemySpawnGroupFamilyBudget(spawnGroup, floorIndex);
            const entryShare = Math.max(0, Number(entry.weight) || 0) / familyTotal;

            return {
                ...entry,
                weight: familyBudget * entryShare
            };
        });
    },

    getNewFloorEnemySpawnSafetyRadius() {
        return 4;
    },

    clearNearbyHostileEnemiesFromPlayerSpawn(radius = this.getNewFloorEnemySpawnSafetyRadius()) {
        const safeRadius = Math.max(0, Math.floor(Number(radius) || 0));
        if (safeRadius <= 0 || !this.player || !this.world?.getEnemies) {
            return 0;
        }

        const enemiesToRemove = (this.world.getEnemies() || [])
            .filter((enemy) => enemy?.isAlive?.() && !enemy.isAlly)
            .filter((enemy) => Math.max(
                Math.abs(Number(enemy.x) - Number(this.player.x)),
                Math.abs(Number(enemy.y) - Number(this.player.y))
            ) <= safeRadius);

        for (const enemy of enemiesToRemove) {
            this.world.removeEnemy(enemy);
        }

        return enemiesToRemove.length;
    },

    spawnPremadeLegendEnemies(rng, floorIndex = this.world.currentFloor) {
        const floor = this.world.getCurrentFloor();
        const premadeEnemySpawns = Array.isArray(floor?.meta?.premadeEnemySpawns)
            ? floor.meta.premadeEnemySpawns
            : [];
        const enemyEntries = this.getEnemySpawnEntriesForFloor(floorIndex);
        const spawnSafetyRadius = this.getNewFloorEnemySpawnSafetyRadius();

        for (const spawn of premadeEnemySpawns) {
            const x = Number(spawn?.x);
            const y = Number(spawn?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue;
            }

            const chosenEntry = this.chooseWeightedEntry(rng, enemyEntries);
            if (!chosenEntry) {
                continue;
            }

            const enemy = this.createEnemyForType(0, 0, chosenEntry.key, floorIndex);
            if (!this.world.canEnemyOccupy(x, y, this.player, null, enemy, {
                minDistanceFromPlayer: spawnSafetyRadius
            })) {
                continue;
            }

            this.assignActorPosition(enemy, { x, y });
            this.addEnemyIfMissing(enemy);
        }
    },

    spawnOverworldNpcs(rng) {
        if (!Array.isArray(this.persistentOverworldNpcs)) {
            this.persistentOverworldNpcs = [];
        }

        if (this.persistentOverworldNpcs.length === 0) {
            this.persistentOverworldNpcs = this.getPersistentOverworldNpcTypeKeys()
                .map((npcTypeKey) => this.createEnemyForType(0, 0, npcTypeKey, 0))
                .filter(Boolean);
        }

        this.ensureSecondQuestgiverAvailability();
        const spawnSafetyRadius = this.getNewFloorEnemySpawnSafetyRadius();

        for (const npc of this.persistentOverworldNpcs) {
            if (!npc?.isAlive?.()) {
                continue;
            }

            const spawn = this.world.findRandomOpenTile(rng, this.player, 200, npc, {
                minDistanceFromPlayer: spawnSafetyRadius
            });
            if (!spawn) {
                continue;
            }

            this.assignActorPosition(npc, spawn);
            this.addEnemyIfMissing(npc);
        }
    },

    getEnemySpawnCountForFloor(floorIndex) {
        return typeof getEnemySpawnCountForDepth === 'function'
            ? getEnemySpawnCountForDepth(floorIndex)
            : clamp(4 + Math.floor(floorIndex / 2), 4, 12);
    },

    getDungeonNpcSpawnChanceForFloor(floorIndex) {
        return typeof getDungeonNpcSpawnChanceForFloorIndex === 'function'
            ? getDungeonNpcSpawnChanceForFloorIndex(floorIndex)
            : 0.15;
    },

    shouldSpawnDungeonNpcForFloor(floorIndex, rng) {
        const chance = this.getDungeonNpcSpawnChanceForFloor(floorIndex);
        return getRngRoll(rng) < chance;
    },

    spawnEnemiesForCurrentFloor(rng, floorIndex = this.world.currentFloor) {
        const enemyCount = this.getEnemySpawnCountForFloor(floorIndex);
        const enemyEntries = this.getEnemySpawnEntriesForFloor(floorIndex);
        const npcEntries = enemyEntries.filter((entry) => this.isDungeonNpcTypeKey(entry.key));
        const nonNpcEntries = enemyEntries.filter((entry) => !this.isDungeonNpcTypeKey(entry.key));
        const spawnSafetyRadius = this.getNewFloorEnemySpawnSafetyRadius();

        let remainingSpawns = enemyCount;

        // Dungeon floors can spawn at most one neutral NPC, with floor-scaled chance.
        if (remainingSpawns > 0 && npcEntries.length > 0 && this.shouldSpawnDungeonNpcForFloor(floorIndex, rng)) {
            const npcEntry = this.chooseWeightedEntry(rng, npcEntries);
            if (npcEntry) {
                const npc = this.createEnemyForType(0, 0, npcEntry.key, floorIndex);
                const npcSpawn = this.world.findRandomOpenTile(rng, this.player, 200, npc, {
                    minDistanceFromPlayer: spawnSafetyRadius
                });
                if (npcSpawn) {
                    this.assignActorPosition(npc, npcSpawn);
                    this.addEnemyIfMissing(npc);
                    remainingSpawns -= 1;
                }
            }
        }

        const defaultEntries = nonNpcEntries.length > 0 ? nonNpcEntries : enemyEntries;
        for (let i = 0; i < remainingSpawns; i++) {
            const chosenEntry = this.chooseWeightedEntry(rng, defaultEntries);
            if (!chosenEntry) {
                continue;
            }

            const enemyTypeKey = chosenEntry.key;
            const enemy = this.createEnemyForType(0, 0, enemyTypeKey, floorIndex);
            const spawn = this.world.findRandomOpenTile(rng, this.player, 200, enemy, {
                minDistanceFromPlayer: spawnSafetyRadius
            });
            if (!spawn) {
                continue;
            }

            this.assignActorPosition(enemy, spawn);
            this.addEnemyIfMissing(enemy);
        }
    },

    getEnemySpawnEntriesForFloor(floorIndex) {
        const entries = Object.entries(ENEMY_TEMPLATES).map(([key, template]) => ({
            key,
            weight: Number.isFinite(template.spawnWeight) ? template.spawnWeight : 1,
            minFloor: template.minFloor,
            maxFloor: template.maxFloor
        })).filter((entry) => entry.weight > 0);

        const floorEntries = getWeightedEntriesForFloor(entries, floorIndex);
        const isOverworld = this.world.getAreaType() === AREA_TYPES.OVERWORLD;
        if (isOverworld) {
            return floorEntries.filter((entry) => !this.isDungeonNpcTypeKey(entry.key));
        }

        const dungeonEntries = floorEntries.filter((entry) => !this.isOverworldNpcTypeKey(entry.key));
        return this.applyEnemyFamilySpawnBalancing(dungeonEntries, floorIndex);
    },

    createEnemyForType(x, y, enemyTypeKey, floorIndex = this.world.currentFloor) {
        const template = this.getEnemyTemplateForType(enemyTypeKey);
        const scaledStats = this.createScaledEnemyStats(template, enemyTypeKey, floorIndex);

        const enemy = new Enemy(x, y, template.displayName, template.aiType, scaledStats);
        this.assignInitialEnemyHeldItem(enemy);
        return enemy;
    },

    assignInitialEnemyHeldItem(enemy) {
        if (!enemy || typeof enemy.hasEnemyType !== 'function') {
            return;
        }

        this.assignSlimeHeldDrop(enemy);
    },

    assignSlimeHeldDrop(enemy) {
        if (!enemy || typeof enemy.hasEnemyType !== 'function' || !enemy.hasEnemyType(ENEMY_TYPES.SLIME)) {
            return;
        }

        const tierRollDenominator = this.getSlimeTinctureHeldDropChance(enemy.monsterType);
        if (!Number.isFinite(tierRollDenominator) || tierRollDenominator <= 0) {
            return;
        }

        const roll = randomInt(1, tierRollDenominator);
        if (roll !== 1) {
            return;
        }

        const tincture = createStatusConsumable(CONDITIONS.SLOW);
        if (tincture) {
            enemy.heldItem = tincture;
        }
    },

    getSlimeTinctureHeldDropChance(monsterType) {
        const template = this.getEnemyTemplateMetadata(monsterType);
        if (template?.familyId !== 'slime') {
            return 0;
        }

        const tier = Number.isFinite(Number(template?.tier))
            ? Math.max(1, Math.floor(Number(template.tier)))
            : 1;

        return typeof getSlimeTinctureDropDenominatorForTier === 'function'
            ? getSlimeTinctureDropDenominatorForTier(tier)
            : 0;
    },

    getNextEnemyTierTypeKey(monsterType) {
        const template = this.getEnemyTemplateMetadata(monsterType);
        if (!template) {
            return null;
        }

        const currentTier = Number.isFinite(Number(template.tier))
            ? Math.max(1, Math.floor(Number(template.tier)))
            : null;
        const familyId = typeof template.familyId === 'string' ? template.familyId : '';
        if (!Number.isFinite(currentTier) || !familyId) {
            return null;
        }

        const nextTemplate = Object.values(ENEMY_TEMPLATES).find((candidate) => (
            candidate?.familyId === familyId
            && Number(candidate?.tier) === currentTier + 1
        ));
        return typeof nextTemplate?.templateId === 'string' ? nextTemplate.templateId : null;
    },

    tryPromoteEnemyAfterKill(enemy) {
        if (!enemy || typeof enemy.isAlive !== 'function' || !enemy.isAlive()) {
            return null;
        }

        const nextTierTypeKey = this.getNextEnemyTierTypeKey(enemy.monsterType);
        if (!nextTierTypeKey) {
            return null;
        }

        const currentHealth = Math.max(0, Math.floor(Number(enemy.health) || 0));
        const promotedEnemy = this.createEnemyForType(enemy.x, enemy.y, nextTierTypeKey, this.getDungeonDepthIndex());

        enemy.name = promotedEnemy.name;
        enemy.monsterType = promotedEnemy.monsterType;
        enemy.templateId = promotedEnemy.templateId;
        enemy.familyId = promotedEnemy.familyId;
        enemy.tier = promotedEnemy.tier;
        enemy.npcRole = promotedEnemy.npcRole;
        enemy.spawnContexts = Array.isArray(promotedEnemy.spawnContexts) ? [...promotedEnemy.spawnContexts] : [];
        enemy.persistentNpc = Boolean(promotedEnemy.persistentNpc);
        enemy.creatureTypes = [...promotedEnemy.creatureTypes];
        if (!enemy.isAlly) {
            enemy.aiType = promotedEnemy.aiType;
            enemy.baseAiType = promotedEnemy.baseAiType;
        }
        enemy.maxHealth = promotedEnemy.maxHealth;
        enemy.power = promotedEnemy.power;
        enemy.armor = promotedEnemy.armor;
        enemy.exp = promotedEnemy.exp;
        enemy.fovRange = promotedEnemy.fovRange;
        enemy.tameThreshold = promotedEnemy.tameThreshold;
        enemy.speed = promotedEnemy.speed;

        const healthGain = Math.floor(enemy.maxHealth / 2);
        enemy.health = Math.min(enemy.maxHealth, currentHealth + healthGain);

        return {
            newName: enemy.name,
            newTierTypeKey: nextTierTypeKey,
            healthGain
        };
    }
});