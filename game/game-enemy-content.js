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
        const npcCount = 3;
        for (let index = 0; index < npcCount; index++) {
            const npcTypeKey = index === 0 ? 'npcBankerTier1' : 'npcTier1';
            const npc = this.createEnemyForType(0, 0, npcTypeKey, 0);
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

    spawnEnemiesForCurrentFloor(rng, floorIndex = this.world.currentFloor) {
        const enemyCount = this.getEnemySpawnCountForFloor(floorIndex);
        const enemyEntries = this.getEnemySpawnEntriesForFloor(floorIndex);
        for (let i = 0; i < enemyCount; i++) {
            const chosenEntry = this.chooseWeightedEntry(rng, enemyEntries);
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
            weight: template.spawnWeight || 1,
            minFloor: template.minFloor,
            maxFloor: template.maxFloor
        }));
        return getWeightedEntriesForFloor(entries, floorIndex);
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