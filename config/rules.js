// Condition, hazard, and traversal rule helpers

function getConditionRule(condition) {
    return CONDITION_RULES[condition] || null;
}

function getHazardDefinition(hazardType) {
    return HAZARD_DEFINITIONS[hazardType] || null;
}

function getTileEffectRule(tileType) {
    return TILE_EFFECT_RULES[tileType] || null;
}

function getConditionDuration(condition, fallback = 1) {
    const configuredDuration = getConditionRule(condition)?.duration;
    if (configuredDuration === Infinity || Number.isFinite(configuredDuration)) {
        return configuredDuration;
    }

    return fallback;
}

function getConditionTickDamage(condition, fallback = 0) {
    const tickDamage = getConditionRule(condition)?.tickDamage;
    return Number.isFinite(tickDamage) ? tickDamage : fallback;
}

function getConditionTickHunger(condition, fallback = 0) {
    const tickHunger = getConditionRule(condition)?.tickHunger;
    return Number.isFinite(tickHunger) ? tickHunger : fallback;
}

function shouldRemoveConditionOnFloorChange(condition) {
    return Boolean(getConditionRule(condition)?.removeOnFloorChange);
}

function shouldRemoveConditionOnAttacked(condition) {
    return Boolean(getConditionRule(condition)?.removeOnAttacked);
}

function conditionPreventsDamage(condition) {
    return Boolean(getConditionRule(condition)?.preventsDamage);
}

function conditionSurvivesFatalDamage(condition) {
    return Boolean(getConditionRule(condition)?.surviveFatalDamage);
}

function getConditionDamageMultiplier(condition, fallback = 1) {
    const multiplier = getConditionRule(condition)?.damageMultiplier;
    return Number.isFinite(multiplier) ? multiplier : fallback;
}

function conditionPreventsPassiveHungerLoss(condition) {
    return Boolean(getConditionRule(condition)?.preventsPassiveHungerLoss);
}

function getTrapDefinition(trapType) {
    const definition = getHazardDefinition(trapType);
    return definition?.category === 'trap' ? definition : null;
}

function getTrapTypes() {
    return Object.keys(HAZARD_DEFINITIONS).filter((hazardType) => getHazardDefinition(hazardType)?.category === 'trap');
}

function getHazardEffectRule(hazardType) {
    const definition = getHazardDefinition(hazardType);
    return definition?.category === 'effect' ? definition : null;
}

function getEnvironmentalDamageForTile(tileType, fallback = 0) {
    const damage = getTileEffectRule(tileType)?.damage;
    return Number.isFinite(damage) ? damage : fallback;
}

function getEnvironmentalDamageForHazard(hazardType, fallback = 0) {
    const damage = getHazardEffectRule(hazardType)?.damage;
    return Number.isFinite(damage) ? damage : fallback;
}

function doesTileBurnItems(tileType) {
    return Boolean(getTileEffectRule(tileType)?.itemBurns);
}

function canEnemyTypeTraverseTile(tileType, enemyTypes = []) {
    const rule = ENEMY_TILE_TRAVERSAL_RULES[tileType];
    if (!rule) {
        return true;
    }

    return rule.requiredTypes.some((enemyType) => enemyTypes.includes(enemyType));
}

function isEnemyTypeImmuneToTileEffect(tileType, enemyTypes = []) {
    const immuneTypes = getTileEffectRule(tileType)?.enemyImmuneTypes || [];
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