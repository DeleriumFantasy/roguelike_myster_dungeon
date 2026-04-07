// Combat math and player EXP progression helpers

function getPlayerExpProgressionTable() {
    return PLAYER_LEVEL_TOTAL_EXP;
}

function getAttackVarianceConfig() {
    return ATTACK_VARIANCE;
}

function getSortedDefinedPlayerExpLevels() {
    return Object.keys(getPlayerExpProgressionTable())
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
}

function getPlayerTotalExpForLevel(level) {
    if (level <= 1) {
        return 0;
    }

    const expTable = getPlayerExpProgressionTable();
    if (Number.isFinite(expTable[level])) {
        return expTable[level];
    }

    const definedLevels = getSortedDefinedPlayerExpLevels();
    const highestDefinedLevel = definedLevels[definedLevels.length - 1];
    if (!Number.isFinite(highestDefinedLevel)) {
        return Math.max(0, level - 1) * 10;
    }

    const previousDefinedLevel = definedLevels.length > 1
        ? definedLevels[definedLevels.length - 2]
        : 1;
    const highestDefinedTotal = expTable[highestDefinedLevel];
    const previousDefinedTotal = previousDefinedLevel > 1
        ? expTable[previousDefinedLevel]
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
    const varianceConfig = getAttackVarianceConfig();
    return varianceConfig.MIN + (varianceConfig.MAX - varianceConfig.MIN) * normalizedRoll;
}

function calculateStandardAttackDamage(attackPower, randomFn = Math.random) {
    const normalizedPower = Math.max(0, Number(attackPower) || 0);
    const variance = getAttackVarianceMultiplier(randomFn);
    return Math.max(1, Math.round(normalizedPower * variance) + 1);
}