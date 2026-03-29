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

const ENEMY_FAMILY_SPAWN_BALANCING = {
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
};

Object.assign(Game.prototype, {
    getPersistentOverworldNpcTypeKeys() {
        return ['npcBankerTier1', 'npcQuestgiverTier1', 'npcHandlerTier1'];
    },

    isBankerTypeKey(enemyTypeKey) {
        return enemyTypeKey === 'npcBankerTier1';
    },

    isOverworldNpcTypeKey(enemyTypeKey) {
        return enemyTypeKey === 'npcBankerTier1'
            || enemyTypeKey === 'npcQuestgiverTier1'
            || enemyTypeKey === 'npcHandlerTier1';
    },

    isDungeonNpcTypeKey(enemyTypeKey) {
        return enemyTypeKey === 'npcTier1'
            || enemyTypeKey === 'npcStarvingTier1'
            || enemyTypeKey === 'npcHomeboundTier1'
            || enemyTypeKey === 'npcShamanTier1';
    },

    getEnemyFamilyFromTypeKey(enemyTypeKey) {
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

    spawnPremadeLegendEnemies(rng, floorIndex = this.world.currentFloor) {
        const floor = this.world.getCurrentFloor();
        const premadeEnemySpawns = Array.isArray(floor?.meta?.premadeEnemySpawns)
            ? floor.meta.premadeEnemySpawns
            : [];
        const enemyEntries = this.getEnemySpawnEntriesForFloor(floorIndex);

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
            if (!this.world.canEnemyOccupy(x, y, this.player, null, enemy)) {
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

        for (const npc of this.persistentOverworldNpcs) {
            if (!npc?.isAlive?.()) {
                continue;
            }

            const spawn = this.world.findRandomOpenTile(rng, this.player, 200, npc);
            if (!spawn) {
                continue;
            }

            this.assignActorPosition(npc, spawn);
            this.addEnemyIfMissing(npc);
        }
    },

    getEnemySpawnCountForFloor(floorIndex) {
        return clamp(4 + Math.floor(floorIndex / 2), 4, 12);
    },

    getDungeonNpcSpawnChanceForFloor(floorIndex) {
        const displayFloor = clamp(Math.floor(Number(floorIndex) || 0) + 1, 1, 99);
        const progress = (displayFloor - 1) / 98;
        return 0.15 + (0.05 - 0.15) * progress;
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

        let remainingSpawns = enemyCount;

        // Dungeon floors can spawn at most one neutral NPC, with floor-scaled chance.
        if (remainingSpawns > 0 && npcEntries.length > 0 && this.shouldSpawnDungeonNpcForFloor(floorIndex, rng)) {
            const npcEntry = this.chooseWeightedEntry(rng, npcEntries);
            if (npcEntry) {
                const npc = this.createEnemyForType(0, 0, npcEntry.key, floorIndex);
                const npcSpawn = this.world.findRandomOpenTile(rng, this.player, 200, npc);
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
            const spawn = this.world.findRandomOpenTile(rng, this.player, 200, enemy);
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
        const match = String(monsterType || '').match(/slimeTier(\d+)/i);
        const tier = match ? Number(match[1]) : 1;

        switch (tier) {
            case 1:
                return 100;
            case 2:
                return 50;
            case 3:
                return 25;
            case 4:
                return 10;
            default:
                return 0;
        }
    },

    getNextEnemyTierTypeKey(monsterType) {
        const typeKey = String(monsterType || '');
        const tierMatch = typeKey.match(/^(.*Tier)(\d+)$/i);
        if (!tierMatch) {
            return null;
        }

        const baseKey = tierMatch[1];
        const currentTier = Number(tierMatch[2]);
        if (!Number.isFinite(currentTier) || currentTier < 1) {
            return null;
        }

        const nextTierKey = `${baseKey}${currentTier + 1}`;
        return ENEMY_TEMPLATES[nextTierKey] ? nextTierKey : null;
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