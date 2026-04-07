// Content registry helpers for enemy and item generation

Object.assign(Game.prototype, {
    getEnemyTemplateForType(enemyTypeKey) {
        const templateKeys = Object.keys(ENEMY_TEMPLATES);
        const fallbackTemplate = ENEMY_TEMPLATES[templateKeys[0]];
        return ENEMY_TEMPLATES[enemyTypeKey] || fallbackTemplate;
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
        return this.chooseWeightedEntry(rng, tierEntries);
    }
});