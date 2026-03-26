// Combat math and player EXP progression helpers

function getSortedDefinedPlayerExpLevels() {
    return Object.keys(PLAYER_LEVEL_TOTAL_EXP)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
}

function getPlayerTotalExpForLevel(level) {
    if (level <= 1) {
        return 0;
    }

    if (Number.isFinite(PLAYER_LEVEL_TOTAL_EXP[level])) {
        return PLAYER_LEVEL_TOTAL_EXP[level];
    }

    const definedLevels = getSortedDefinedPlayerExpLevels();
    const highestDefinedLevel = definedLevels[definedLevels.length - 1];
    if (!Number.isFinite(highestDefinedLevel)) {
        return Math.max(0, level - 1) * 10;
    }

    const previousDefinedLevel = definedLevels.length > 1
        ? definedLevels[definedLevels.length - 2]
        : 1;
    const highestDefinedTotal = PLAYER_LEVEL_TOTAL_EXP[highestDefinedLevel];
    const previousDefinedTotal = previousDefinedLevel > 1
        ? PLAYER_LEVEL_TOTAL_EXP[previousDefinedLevel]
        : 0;

    let stepRequirement = Math.max(1, highestDefinedTotal - previousDefinedTotal);
    let total = highestDefinedTotal;
    for (let nextLevel = highestDefinedLevel + 1; nextLevel <= level; nextLevel++) {
        stepRequirement = Math.max(1, Math.floor(stepRequirement * 1.5));
        total += stepRequirement;
    }

    return total;
}

function getExpRequiredForPlayerLevel(level) {
    const targetTotal = getPlayerTotalExpForLevel(level);
    const previousTotal = getPlayerTotalExpForLevel(level - 1);
    const required = targetTotal - previousTotal;
    return Number.isFinite(required) && required > 0 ? required : 10;
}

function getAttackVarianceMultiplier(randomFn = Math.random) {
    const roll = typeof randomFn === 'function' ? randomFn() : Math.random();
    const normalizedRoll = Number.isFinite(roll) ? clamp(roll, 0, 1) : Math.random();
    return ATTACK_VARIANCE.MIN + (ATTACK_VARIANCE.MAX - ATTACK_VARIANCE.MIN) * normalizedRoll;
}

function calculateStandardAttackDamage(attackPower, randomFn = Math.random) {
    const normalizedPower = Math.max(0, Number(attackPower) || 0);
    const variance = getAttackVarianceMultiplier(randomFn);
    return Math.max(1, Math.round(normalizedPower * variance) + 1);
}

function applyDamageToActor(actor, incomingDamage, defenseValue = 0) {
    if (!actor) {
        return 0;
    }

    const normalizedIncomingDamage = Math.max(0, Number(incomingDamage) || 0);
    const normalizedDefense = Math.max(0, Number(defenseValue) || 0);
    if (normalizedIncomingDamage <= 0) {
        return 0;
    }

    const activeConditions = Array.from(actor.conditions?.keys?.() || []);
    if (activeConditions.some((condition) => conditionPreventsDamage(condition))) {
        return 0;
    }

    const mitigationMultiplier = 100 / (100 + normalizedDefense);
    const mitigatedDamage = Math.max(1, Math.round(normalizedIncomingDamage * mitigationMultiplier));
    const nextHealth = actor.health - mitigatedDamage;
    const fatalProtectionCondition = activeConditions.find((condition) => conditionSurvivesFatalDamage(condition));

    if (nextHealth <= 0 && fatalProtectionCondition) {
        const dealtDamage = Math.max(0, actor.health - 1);
        actor.health = Math.max(1, actor.health - dealtDamage);
        if (typeof actor.removeCondition === 'function') {
            actor.removeCondition(fatalProtectionCondition);
        } else if (actor.conditions instanceof Map) {
            actor.conditions.delete(fatalProtectionCondition);
        }
        return dealtDamage;
    }

    actor.health = Math.max(0, nextHealth);
    return Math.min(mitigatedDamage, actor.health + mitigatedDamage);
}

function applyStandardAttackToTarget(target, attackPower, randomFn = Math.random, attacker = null) {
    if (!target) {
        return 0;
    }

    const rolledDamage = calculateStandardAttackDamage(attackPower, randomFn);

    const damage = typeof target.takeDamage === 'function'
        ? target.takeDamage(rolledDamage, attacker)
        : applyDamageToActor(target, rolledDamage);

    if (damage > 0 && typeof target.onAttacked === 'function') {
        target.onAttacked();
    }

    return damage || 0;
}