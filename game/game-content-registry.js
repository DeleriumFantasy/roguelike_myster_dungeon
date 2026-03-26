// Content registry helpers for enemy and item generation

Object.assign(Game.prototype, {
    getEnemyTemplateForType(enemyTypeKey) {
        const templateKeys = Object.keys(ENEMY_TEMPLATES);
        const fallbackTemplate = ENEMY_TEMPLATES[templateKeys[0]];
        return ENEMY_TEMPLATES[enemyTypeKey] || fallbackTemplate;
    },

    createScaledEnemyStats(template, enemyTypeKey, floorIndex = this.world.currentFloor) {
        const depth = Math.max(0, floorIndex);

        return {
            health: template.health + depth * 3,
            power: template.power + Math.floor(depth / 2),
            armor: template.armor + Math.floor(depth / 4),
            exp: template.exp + depth * 2,
            fovRange: template.fovRange,
            tameThreshold: template.tameThreshold,
            monsterType: enemyTypeKey,
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