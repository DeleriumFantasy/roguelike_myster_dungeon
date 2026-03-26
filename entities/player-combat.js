// Player combat and status helpers

Object.assign(Player.prototype, {
    takeDamage(amount, attacker = null, options = {}) {
        const incomingDamage = Math.max(0, Number(amount) || 0);
        if (incomingDamage <= 0) {
            return 0;
        }

        const armorEffectiveness = clamp(Number(options?.armorEffectiveness ?? 1), 0, 1);

        const mitigationMultiplier = this.getIncomingDamageMultiplierAgainst(attacker);
        const adjustedIncomingDamage = Math.max(1, Math.round(incomingDamage * mitigationMultiplier));
        const effectiveArmor = this.armor * armorEffectiveness;
        return applyDamageToActor(this, adjustedIncomingDamage, effectiveArmor);
    },

    attackEnemy(enemy) {
        if (!enemy || !enemy.isAlive()) {
            return { damage: 0, critical: false, inflictedConditions: [] };
        }

        if (typeof enemy.isNeutralNpc === 'function' && enemy.isNeutralNpc()) {
            return { damage: 0, critical: false, inflictedConditions: [] };
        }

        let attackPower = this.getAttackPowerAgainst(enemy);
        const critical = this.hasEquippedEnchantment('critical') && getRngRoll() < 0.25;
        if (critical) {
            attackPower = Math.max(1, Math.round(attackPower * 1.5));
        }

        const damage = applyStandardAttackToTarget(enemy, attackPower, Math.random, this);
        const inflictedConditions = [];
        if (damage > 0 && enemy.isAlive() && typeof enemy.addCondition === 'function') {
            for (const condition of this.getWeaponInflictedConditions()) {
                const applied = enemy.addCondition(condition, getConditionDuration(condition, 10));
                if (applied !== false) {
                    inflictedConditions.push(condition);
                }
            }
        }

        return { damage, critical, inflictedConditions };
    },

    forEachEquippedItem(callback) {
        for (const item of this.equipment.values()) {
            callback(item);
        }
    },

    someEquippedItem(predicate) {
        for (const item of this.equipment.values()) {
            if (predicate(item)) {
                return true;
            }
        }

        return false;
    },

    getEquipmentMultiplier(methodName, arg) {
        let multiplier = 1;
        this.forEachEquippedItem((item) => {
            const multiplierMethod = item?.[methodName];
            if (typeof multiplierMethod === 'function') {
                multiplier *= multiplierMethod.call(item, arg);
            }
        });
        return multiplier;
    },

    hasPassiveHungerLossProtection() {
        return Array.from(this.conditions.keys()).some((condition) => conditionPreventsPassiveHungerLoss(condition));
    },

    isItemCursed(item) {
        if (!item) {
            return false;
        }

        if (typeof item.isCursed === 'function') {
            return item.isCursed();
        }

        return Boolean(item.properties?.cursed);
    },

    getIncomingDamageMultiplierAgainst(attacker) {
        const multiplier = this.getEquipmentMultiplier('getIncomingDamageMultiplierFrom', attacker);
        return Math.max(0.1, multiplier);
    },

    getAttackPowerAgainst(target) {
        let attackPower = this.power;
        const targetMultiplier = this.getEquipmentMultiplier('getDamageMultiplierAgainst', target);
        const attackerMultiplier = this.getEquipmentMultiplier('getDamageMultiplierForAttacker', this);
        const multiplier = targetMultiplier * attackerMultiplier;

        attackPower = Math.max(1, Math.round(attackPower * multiplier));

        return attackPower;
    },

    hasEquippedEnchantment(enchantmentKey) {
        if (!enchantmentKey) {
            return false;
        }

        return this.someEquippedItem((item) => {
            if (!item || typeof item.getEnchantments !== 'function') {
                return false;
            }

            return item.getEnchantments().includes(enchantmentKey);
        });
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

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    },

    restoreHunger(amount) {
        this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    },

    addCondition(condition, duration = getConditionDuration(condition, 1)) {
        if (this.shouldPreventConditionFromEquipment(condition)) {
            return false;
        }

        actorAddCondition(this, condition, duration);
        return true;
    },

    onAttacked() {
        actorResolveOnAttackedConditions(this);
    },

    removeCondition(condition) {
        this.conditions.delete(condition);
    },

    clearConditions() {
        this.conditions.clear();
    },

    hasCondition(condition) {
        return actorHasCondition(this, condition);
    },

    tickConditions() {
        for (const [condition, duration] of this.conditions) {
            const tickDamage = getConditionTickDamage(condition, 0);
            const tickHunger = getConditionTickHunger(condition, 0);
            const preventsPassiveHungerLoss = this.hasPassiveHungerLossProtection();

            if (tickDamage > 0) {
                this.takeDamage(tickDamage);
            }

            if (tickHunger !== 0 && !(tickHunger < 0 && preventsPassiveHungerLoss)) {
                this.hunger = clamp(this.hunger + tickHunger, 0, this.maxHunger);
            }

            if (duration > 1) {
                this.conditions.set(condition, duration - 1);
            } else {
                this.conditions.delete(condition);
            }
        }
    },

    getTempoMultiplier() {
        let multiplier = 1;
        if (this.hasCondition(CONDITIONS.HASTE)) {
            multiplier *= 0.5;
        }
        if (this.hasCondition(CONDITIONS.SLOW)) {
            multiplier *= 2;
        }
        return multiplier;
    },

    applyPerTurnRegen() {
        this.applyEquipmentGrantedConditions();
        this.turns += 1;
        const preventsPassiveHungerLoss = this.hasPassiveHungerLossProtection();
        if (this.turns % 5 === 0 && !preventsPassiveHungerLoss) {
            this.hunger = Math.max(0, this.hunger - 1);
        }

        if (this.hunger <= 0) {
            this.takeDamage(1);
        } else {
            const regenAmount = this.level >= 20 ? 3 : (this.level >= 10 ? 2 : 1);
            this.heal(regenAmount);
        }
    },

    applyEquipmentGrantedConditions() {
        if (this.hasEquippedEnchantment('fasting') && !this.hasCondition(CONDITIONS.SATIATED)) {
            this.addCondition(CONDITIONS.SATIATED, getConditionDuration(CONDITIONS.SATIATED, Infinity));
        }
    },

    isAlive() {
        return this.health > 0;
    }
});
