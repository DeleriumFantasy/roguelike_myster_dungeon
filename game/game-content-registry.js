// Content registry helpers for enemy and item generation

Object.assign(Game.prototype, {
    getEnemyTemplateForType(enemyTypeKey) {
        return ENEMY_TEMPLATES[enemyTypeKey];
    },

    createScaledEnemyStats(template, enemyTypeKey, floorIndex = this.world.currentFloor) {
        const depth = Math.max(0, floorIndex);
        const scalingRules = typeof getEnemyScalingRules === 'function'
            ? getEnemyScalingRules()
            : {};
        const scalingEnabled = scalingRules?.enabled !== false;
        const healthPerDepth = Math.max(0, Math.floor(Number(scalingRules?.healthPerDepth) || 0));
        const powerPerDepthInterval = Math.max(1, Math.floor(Number(scalingRules?.powerPerDepthInterval) || 1));
        const armorPerDepthInterval = Math.max(1, Math.floor(Number(scalingRules?.armorPerDepthInterval) || 1));
        const expPerDepth = Math.max(0, Math.floor(Number(scalingRules?.expPerDepth) || 0));

        return {
            health: scalingEnabled ? template.health + depth * healthPerDepth : template.health,
            power: scalingEnabled ? template.power + Math.floor(depth / powerPerDepthInterval) : template.power,
            armor: scalingEnabled ? template.armor + Math.floor(depth / armorPerDepthInterval) : template.armor,
            exp: scalingEnabled ? template.exp + depth * expPerDepth : template.exp,
            fovRange: template.fovRange,
            tameThreshold: template.tameThreshold,
            monsterType: enemyTypeKey,
            templateId: template.templateId || enemyTypeKey,
            familyId: template.familyId || enemyTypeKey,
            tier: Number.isFinite(Number(template.tier)) ? Number(template.tier) : null,
            npcRole: typeof template.npcRole === 'string' ? template.npcRole : '',
            spawnContexts: Array.isArray(template.spawnContexts) ? [...template.spawnContexts] : [],
            persistentNpc: Boolean(template.persistentNpc),
            creatureTypes: template.types,
            speed: template.speed
        };
    },

    getWeightedItemEntriesForFloor(rng, floorIndex = this.world.currentFloor) {
        const tier = this.rollItemTierForFloor(floorIndex, rng);
        const tierEntries = getWeightedItemEntriesForTier(tier);
        const areaType = this.world.getAreaType(floorIndex);
        const dungeonPathId = areaType !== AREA_TYPES.OVERWORLD
            ? this.world.getSelectedDungeonPathId()
            : '';
        const categoryWeightMap = typeof getDungeonPathFloorItemCategoryWeightMap === 'function'
            ? getDungeonPathFloorItemCategoryWeightMap(areaType, floorIndex, dungeonPathId)
            : null;

        const weightedEntries = categoryWeightMap
            ? tierEntries
                .map((entry) => {
                    const baseWeight = Math.max(1, Math.floor(Number(entry?.weight) || 1));
                    const categoryMultiplier = Number(categoryWeightMap?.[entry?.category]);
                    if (!Number.isFinite(categoryMultiplier)) {
                        return entry;
                    }

                    return {
                        ...entry,
                        weight: Math.max(0, Math.round(baseWeight * Math.max(0, categoryMultiplier)))
                    };
                })
                .filter((entry) => Number(entry?.weight) > 0)
            : tierEntries;

        return this.chooseWeightedEntry(rng, weightedEntries.length > 0 ? weightedEntries : tierEntries);
    }
});