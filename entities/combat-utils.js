// Shared combat application helpers (mutable actor state)
//
// These helpers are intentionally outside config/ because they mutate actor
// state (health/conditions) and invoke actor runtime hooks.

function getActorConditionKeys(actor) {
    return Array.from(actor?.conditions?.keys?.() || []);
}

function getMitigatedDamageAmount(incomingDamage, defenseValue = 0) {
    const normalizedIncomingDamage = Math.max(0, Number(incomingDamage) || 0);
    const normalizedDefense = Math.max(0, Number(defenseValue) || 0);
    if (normalizedIncomingDamage <= 0) {
        return 0;
    }

    const mitigationMultiplier = 100 / (100 + normalizedDefense);
    return Math.max(1, Math.round(normalizedIncomingDamage * mitigationMultiplier));
}

function forEachEquippedActorItem(actor, callback) {
    if (!(actor?.equipment instanceof Map) || typeof callback !== 'function') {
        return;
    }

    for (const item of actor.equipment.values()) {
        if (item) {
            callback(item);
        }
    }
}

function actorSomeEquippedItem(actor, predicate) {
    if (typeof predicate !== 'function') {
        return false;
    }

    let foundMatch = false;
    forEachEquippedActorItem(actor, (item) => {
        if (!foundMatch && predicate(item)) {
            foundMatch = true;
        }
    });
    return foundMatch;
}

function getActorEquipmentMultiplier(actor, methodName, arg) {
    let multiplier = 1;
    forEachEquippedActorItem(actor, (item) => {
        const multiplierMethod = item?.[methodName];
        if (typeof multiplierMethod === 'function') {
            multiplier *= multiplierMethod.call(item, arg);
        }
    });
    return multiplier;
}

function getActorEquipmentNumericSum(actor, methodName, arg) {
    let total = 0;
    forEachEquippedActorItem(actor, (item) => {
        const valueMethod = item?.[methodName];
        if (typeof valueMethod !== 'function') {
            return;
        }

        const value = Number(valueMethod.call(item, arg) || 0);
        if (Number.isFinite(value)) {
            total += value;
        }
    });
    return total;
}

function getActorEquipmentPropertyTotal(actor, propertyKey) {
    let total = 0;
    forEachEquippedActorItem(actor, (item) => {
        const value = Number(item?.properties?.[propertyKey] || 0);
        if (Number.isFinite(value)) {
            total += value;
        }
    });
    return total;
}

function isEquippableItemType(itemType) {
    return Object.values(EQUIPMENT_SLOTS).includes(itemType);
}

function getItemCursedState(item) {
    if (!item) {
        return false;
    }

    if (typeof item.isCursed === 'function') {
        return item.isCursed();
    }

    return Boolean(item.properties?.cursed);
}

function applyDamageToActor(actor, incomingDamage, defenseValue = 0) {
    if (!actor) {
        return 0;
    }

    const normalizedIncomingDamage = Math.max(0, Number(incomingDamage) || 0);
    if (normalizedIncomingDamage <= 0) {
        return 0;
    }

    const activeConditions = getActorConditionKeys(actor);
    if (activeConditions.some((condition) => conditionPreventsDamage(condition))) {
        return 0;
    }

    const mitigatedDamage = getMitigatedDamageAmount(normalizedIncomingDamage, defenseValue);
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

function applyCounterReflectDamage(defender, attacker, damageTaken, options = {}) {
    if (!defender || !attacker || options?.isReflectedDamage) {
        return 0;
    }

    if (typeof attacker.isAlive === 'function' && !attacker.isAlive()) {
        return 0;
    }

    const ratio = typeof defender.getCounterReflectRatio === 'function'
        ? Math.max(0, Number(defender.getCounterReflectRatio() || 0))
        : 0;
    if (ratio <= 0) {
        return 0;
    }

    const reflectedDamage = Math.max(1, Math.floor(Math.max(0, Number(damageTaken) || 0) * ratio));
    if (reflectedDamage <= 0 || typeof attacker.takeDamage !== 'function') {
        return 0;
    }

    return attacker.takeDamage(reflectedDamage, defender, { isReflectedDamage: true });
}
