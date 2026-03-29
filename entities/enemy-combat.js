// Enemy combat, status, and line-of-sight helpers

Object.assign(Enemy.prototype, {
    takeDamage(amount, attacker = null, options = {}) {
        const incomingDamage = Math.max(0, Number(amount) || 0);
        if (incomingDamage <= 0) {
            return 0;
        }

        const armorEffectiveness = clamp(Number(options?.armorEffectiveness ?? 1), 0, 1);

        const mitigationMultiplier = this.getIncomingDamageMultiplierAgainst(attacker);
        const adjustedIncomingDamage = Math.max(1, Math.round(incomingDamage * mitigationMultiplier));
        const effectiveArmor = this.getEffectiveArmor() * armorEffectiveness;
        const damageDealt = applyDamageToActor(this, adjustedIncomingDamage, effectiveArmor);
        return damageDealt;
    },

    heal(amount) {
        const value = Math.max(0, amount);
        this.health = Math.min(this.maxHealth, this.health + value);
    },

    getEffectiveArmor() {
        let armor = this.armor;
        for (const item of this.equipment.values()) {
            armor += item.properties?.armor || 0;
            if (typeof item.getEnchantmentArmorBonus === 'function') {
                armor += item.getEnchantmentArmorBonus();
            }
        }
        return armor;
    },

    getIncomingDamageMultiplierAgainst(attacker) {
        let multiplier = 1;
        for (const item of this.equipment.values()) {
            if (typeof item.getIncomingDamageMultiplierFrom === 'function') {
                multiplier *= item.getIncomingDamageMultiplierFrom(attacker);
            }
        }

        return Math.max(0.1, multiplier);
    },

    addCondition(condition, duration = getConditionDuration(condition, 1)) {
        if (this.shouldPreventConditionFromEquipment(condition)) {
            return false;
        }

        actorAddCondition(this, condition, duration);
        return true;
    },

    hasCondition(condition) {
        return actorHasCondition(this, condition);
    },

    onAttacked() {
        actorResolveOnAttackedConditions(this);
    },

    removeCondition(condition) {
        this.conditions.delete(condition);
        if (condition === CONDITIONS.SLEEP) {
            this.sleepLockedUntilPlayerEntry = false;
        }
    },

    getAttackPower() {
        let basePower = this.power;
        for (const item of this.equipment.values()) {
            if (item.properties?.power) {
                basePower += item.properties.power;
            }
            if (typeof item.getEnchantmentPowerBonus === 'function') {
                basePower += item.getEnchantmentPowerBonus();
            }
        }

        let damageMultiplier = 1;
        for (const condition of this.conditions.keys()) {
            damageMultiplier *= getConditionDamageMultiplier(condition, 1);
        }

        if (damageMultiplier !== 1) {
            basePower = Math.max(basePower, Math.round(basePower * damageMultiplier));
        }

        return basePower;
    },

    getAttackPowerAgainst(target) {
        let basePower = this.getAttackPower();
        const weapon = this.equipment.get(EQUIPMENT_SLOTS.WEAPON);
        if (weapon && typeof weapon.getDamageMultiplierAgainst === 'function') {
            basePower = Math.max(1, Math.round(basePower * weapon.getDamageMultiplierAgainst(target)));
        }

        return basePower;
    },

    getWeaponInflictedConditions() {
        const weapon = this.equipment.get(EQUIPMENT_SLOTS.WEAPON);
        if (!weapon || typeof weapon.getOnHitInflictedConditions !== 'function') {
            return [];
        }

        return weapon.getOnHitInflictedConditions(getRngRoll);
    },

    shouldPreventConditionFromEquipment(condition) {
        if (!condition) {
            return false;
        }

        const armor = this.equipment.get(EQUIPMENT_SLOTS.ARMOR);
        if (!armor || typeof armor.getConditionPreventionChance !== 'function') {
            return false;
        }

        const preventionChance = armor.getConditionPreventionChance(condition);
        return preventionChance > 0 && getRngRoll() < preventionChance;
    },

    createAttackEnemyResult(targetEnemy) {
        const damage = this.attackEnemy(targetEnemy);
        return { type: 'attack-enemy', damage, target: targetEnemy };
    },

    createAttackPlayerResult(targetPlayer) {
        const damage = this.attackTarget(targetPlayer);
        return { type: 'attack-player', damage };
    },

    attackTarget(target) {
        const damage = applyStandardAttackToTarget(target, this.getAttackPowerAgainst(target), Math.random, this);
        if (damage > 0 && target && target.isAlive?.() && typeof target.addCondition === 'function') {
            for (const condition of this.getWeaponInflictedConditions()) {
                target.addCondition(condition, getConditionDuration(condition, 10));
            }
        }

        return damage;
    },

    attackEnemy(targetEnemy) {
        if (!targetEnemy || !targetEnemy.isAlive()) {
            return 0;
        }

        if (isNeutralNpcActor(targetEnemy)) {
            return 0;
        }

        return this.attackTarget(targetEnemy);
    },

    isAlive() {
        return this.health > 0;
    },

    hasLineOfSight(world, targetX, targetY) {
        const x0 = this.x;
        const y0 = this.y;
        const x1 = targetX;
        const y1 = targetY;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        while (true) {
            if (!world.isWithinBounds(x, y)) {
                return false;
            }

            if (!this.canLookThroughWalls() && world.getTile(x, y) === TILE_TYPES.WALL) {
                return false;
            }

            if (x === x1 && y === y1) {
                return true;
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }
});
