// Condition, hazard, and traversal rule helpers

function getConditionDuration(condition, fallback = 1) {
    const configuredDuration = CONDITION_RULES[condition]?.duration;
    if (configuredDuration === Infinity || Number.isFinite(configuredDuration)) {
        return configuredDuration;
    }

    return fallback;
}

function getConditionTickDamage(condition, fallback = 0) {
    const tickDamage = CONDITION_RULES[condition]?.tickDamage;
    return Number.isFinite(tickDamage) ? tickDamage : fallback;
}

function getConditionTickHunger(condition, fallback = 0) {
    const tickHunger = CONDITION_RULES[condition]?.tickHunger;
    return Number.isFinite(tickHunger) ? tickHunger : fallback;
}

function shouldRemoveConditionOnFloorChange(condition) {
    return Boolean(CONDITION_RULES[condition]?.removeOnFloorChange);
}

function shouldRemoveConditionOnAttacked(condition) {
    return Boolean(CONDITION_RULES[condition]?.removeOnAttacked);
}

function conditionPreventsDamage(condition) {
    return Boolean(CONDITION_RULES[condition]?.preventsDamage);
}

function conditionSurvivesFatalDamage(condition) {
    return Boolean(CONDITION_RULES[condition]?.surviveFatalDamage);
}

function getConditionDamageMultiplier(condition, fallback = 1) {
    const multiplier = CONDITION_RULES[condition]?.damageMultiplier;
    return Number.isFinite(multiplier) ? multiplier : fallback;
}

function conditionPreventsPassiveHungerLoss(condition) {
    return Boolean(CONDITION_RULES[condition]?.preventsPassiveHungerLoss);
}

function getTrapDefinition(trapType) {
    const definition = HAZARD_DEFINITIONS[trapType] || null;
    return definition?.category === 'trap' ? definition : null;
}

function getTrapTypes() {
    return Object.keys(HAZARD_DEFINITIONS).filter((hazardType) => HAZARD_DEFINITIONS[hazardType]?.category === 'trap');
}

function getHazardEffectRule(hazardType) {
    const definition = HAZARD_DEFINITIONS[hazardType] || null;
    return definition?.category === 'effect' ? definition : null;
}

function getEnvironmentalDamageForTile(tileType, fallback = 0) {
    const damage = TILE_EFFECT_RULES[tileType]?.damage;
    return Number.isFinite(damage) ? damage : fallback;
}

function getEnvironmentalDamageForHazard(hazardType, fallback = 0) {
    const damage = getHazardEffectRule(hazardType)?.damage;
    return Number.isFinite(damage) ? damage : fallback;
}

function doesTileBurnItems(tileType) {
    return Boolean(TILE_EFFECT_RULES[tileType]?.itemBurns);
}

function canEnemyTypeTraverseTile(tileType, enemyTypes = []) {
    const rule = ENEMY_TILE_TRAVERSAL_RULES[tileType];
    if (!rule) {
        return true;
    }

    return rule.requiredTypes.some((enemyType) => enemyTypes.includes(enemyType));
}

function isEnemyTypeImmuneToTileEffect(tileType, enemyTypes = []) {
    const immuneTypes = TILE_EFFECT_RULES[tileType]?.enemyImmuneTypes || [];
    const traversalRequiredTypes = ENEMY_TILE_TRAVERSAL_RULES[tileType]?.requiredTypes || [];
    const combinedImmuneTypes = [...new Set([...immuneTypes, ...traversalRequiredTypes])];
    return combinedImmuneTypes.some((enemyType) => enemyTypes.includes(enemyType));
}

function canActorTraverseTile(tileType, enemyTypes = [], traversalEnchantments = []) {
    if (canEnemyTypeTraverseTile(tileType, enemyTypes)) {
        return true;
    }

    if (traversalEnchantments.includes('fly')) {
        return canEnemyTypeTraverseTile(tileType, [ENEMY_TYPES.FLOATING]);
    }

    if (traversalEnchantments.includes('waterwalk') && tileType === TILE_TYPES.WATER) {
        return true;
    }

    if (traversalEnchantments.includes('lavawalk') && tileType === TILE_TYPES.LAVA) {
        return true;
    }

    return false;
}

function isActorImmuneToTileEffect(tileType, enemyTypes = [], traversalEnchantments = []) {
    if (isEnemyTypeImmuneToTileEffect(tileType, enemyTypes)) {
        return true;
    }

    if (traversalEnchantments.includes('fly')) {
        return isEnemyTypeImmuneToTileEffect(tileType, [ENEMY_TYPES.FLOATING]);
    }

    if (traversalEnchantments.includes('waterwalk') && tileType === TILE_TYPES.WATER) {
        return true;
    }

    if (traversalEnchantments.includes('lavawalk') && tileType === TILE_TYPES.LAVA) {
        return true;
    }

    return false;
}

function hasActorEnchantment(actor, enchantmentKey, hasEnchantmentFn = null) {
    if (!actor || !enchantmentKey) {
        return false;
    }

    if (typeof hasEnchantmentFn === 'function') {
        return Boolean(hasEnchantmentFn(enchantmentKey));
    }

    if (typeof actor.hasEquippedEnchantment === 'function') {
        return Boolean(actor.hasEquippedEnchantment(enchantmentKey));
    }

    if (actor.equipment instanceof Map) {
        for (const item of actor.equipment.values()) {
            if (!item || typeof item.getEnchantments !== 'function') {
                continue;
            }

            if (item.getEnchantments().includes(enchantmentKey)) {
                return true;
            }
        }
    }

    return false;
}

function getTraversalEnchantmentsForActor(actor, hasEnchantmentFn = null) {
    const traversalEnchantments = [];

    if (hasActorEnchantment(actor, 'fly', hasEnchantmentFn)) {
        traversalEnchantments.push('fly');
    }

    if (hasActorEnchantment(actor, 'waterwalk', hasEnchantmentFn)) {
        traversalEnchantments.push('waterwalk');
    }

    if (hasActorEnchantment(actor, 'lavawalk', hasEnchantmentFn)) {
        traversalEnchantments.push('lavawalk');
    }

    return traversalEnchantments;
}