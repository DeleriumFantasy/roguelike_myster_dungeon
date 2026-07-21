// Shared actor and item label helpers

function hasCallableMethod(target, methodName) {
    return Boolean(target && typeof target[methodName] === 'function');
}

function hasConditionMap(actor) {
    return Boolean(actor && actor.conditions instanceof Map);
}

function isNeutralNpcActor(actor) {
    if (!actor) {
        return false;
    }

    if (hasCallableMethod(actor, 'isNeutralNpc')) {
        return actor.isNeutralNpc();
    }

    if (hasCallableMethod(actor, 'hasEnemyType')) {
        return actor.hasEnemyType(ENEMY_TYPES.NPC);
    }

    return Array.isArray(actor.creatureTypes)
        && actor.creatureTypes.includes(ENEMY_TYPES.NPC);
}

function getItemLabel(item) {
    if (!item) {
        return '';
    }

    if (hasCallableMethod(item, 'getDisplayName')) {
        return item.getDisplayName();
    }

    if (typeof item.name === 'string' && item.name.length > 0) {
        return item.name;
    }

    return item.name;
}

function normalizeDirection(dx, dy) {
    const normalizedDx = Math.sign(Number(dx));
    const normalizedDy = Math.sign(Number(dy));
    return { dx: normalizedDx, dy: normalizedDy };
}

function getActorFacing(actor) {
    if (hasCallableMethod(actor, 'getFacingDirection')) {
        const facing = actor.getFacingDirection();
        return normalizeDirection(facing.dx, facing.dy);
    }

    return normalizeDirection(actor.facing.dx, actor.facing.dy);
}

function isActorAlive(actor) {
    return Boolean(hasCallableMethod(actor, 'isAlive') && actor.isAlive());
}

function actorAddCondition(actor, condition, duration = getConditionDuration(condition, 1)) {
    if (!hasConditionMap(actor)) {
        return;
    }

    actor.conditions.set(condition, duration);
}

function actorHasCondition(actor, condition) {
    return Boolean(hasConditionMap(actor) && actor.conditions.has(condition));
}

function actorResolveOnAttackedConditions(actor) {
    if (!hasConditionMap(actor)) {
        return;
    }

    for (const condition of [...actor.conditions.keys()]) {
        if (!shouldRemoveConditionOnAttacked(condition)) {
            continue;
        }

        if (hasCallableMethod(actor, 'removeCondition')) {
            actor.removeCondition(condition);
        } else {
            actor.conditions.delete(condition);
        }
    }
}
