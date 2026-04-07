// Player combat and status helpers

const PLAYER_PASSIVE_HUNGER_LOSS_INTERVAL = 10;

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
        const damageDealt = applyDamageToActor(this, adjustedIncomingDamage, effectiveArmor);
        applyCounterReflectDamage(this, attacker, damageDealt, options);
        return damageDealt;
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
        forEachEquippedActorItem(this, callback);
    },

    someEquippedItem(predicate) {
        return actorSomeEquippedItem(this, predicate);
    },

    getEquipmentMultiplier(methodName, arg) {
        return getActorEquipmentMultiplier(this, methodName, arg);
    },

    getEquipmentNumericSum(methodName, arg) {
        return getActorEquipmentNumericSum(this, methodName, arg);
    },

    getExpGainMultiplier() {
        return Math.max(1, this.getEquipmentMultiplier('getExpGainMultiplier'));
    },

    getModifiedExpGain(amount) {
        const baseAmount = Math.max(0, Math.floor(Number(amount) || 0));
        if (baseAmount <= 0) {
            return 0;
        }

        return Math.max(1, Math.round(baseAmount * this.getExpGainMultiplier()));
    },

    getPassiveHungerLossInterval() {
        const baseInterval = PLAYER_PASSIVE_HUNGER_LOSS_INTERVAL;
        const multiplier = Math.max(1, this.getEquipmentMultiplier('getPassiveHungerLossIntervalMultiplier'));
        return Math.max(1, Math.round(baseInterval * multiplier));
    },

    getPassiveHealingBonus() {
        return Math.max(0, this.getEquipmentNumericSum('getPassiveHealingBonus'));
    },

    revealsEnemiesOnMap() {
        return this.someEquippedItem((item) => typeof item?.revealsEnemiesOnMap === 'function' && item.revealsEnemiesOnMap());
    },

    revealsItemsOnMap() {
        return this.someEquippedItem((item) => typeof item?.revealsItemsOnMap === 'function' && item.revealsItemsOnMap());
    },

    revealsTraps() {
        return this.someEquippedItem((item) => typeof item?.revealsTraps === 'function' && item.revealsTraps());
    },

    getCounterReflectRatio() {
        return Math.max(0, this.getEquipmentNumericSum('getCounterReflectRatio'));
    },

    identifiesItemsOnPickup() {
        return this.someEquippedItem((item) => typeof item?.identifiesItemsOnPickup === 'function' && item.identifiesItemsOnPickup());
    },

    hasPassiveHungerLossProtection() {
        return Array.from(this.conditions.keys()).some((condition) => conditionPreventsPassiveHungerLoss(condition));
    },

    isItemCursed(item) {
        return getItemCursedState(item);
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
        this.equipmentGrantedConditions.clear();
        this.applyEquipmentGrantedConditions();
    },

    hasCondition(condition) {
        return actorHasCondition(this, condition);
    },

    tickConditions(options = {}) {
        const suppressHungerLoss = Boolean(options?.suppressHungerLoss ?? this.hungerLossDisabled);

        for (const [condition, duration] of this.conditions) {
            const tickDamage = getConditionTickDamage(condition, 0);
            const tickHunger = getConditionTickHunger(condition, 0);
            const preventsPassiveHungerLoss = this.hasPassiveHungerLossProtection();

            if (tickDamage > 0) {
                this.takeDamage(tickDamage);
            }

            if (tickHunger !== 0
                && !(tickHunger < 0 && preventsPassiveHungerLoss)
                && !(tickHunger < 0 && suppressHungerLoss)) {
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

    applyPerTurnRegen(options = {}) {
        this.applyEquipmentGrantedConditions();
        this.turns += 1;
        const disableHungerEffects = Boolean(options?.disableHungerEffects ?? this.hungerLossDisabled);
        const preventsPassiveHungerLoss = this.hasPassiveHungerLossProtection();
        const passiveHungerLossInterval = this.getPassiveHungerLossInterval();
        if (!disableHungerEffects && this.turns % passiveHungerLossInterval === 0 && !preventsPassiveHungerLoss) {
            this.hunger = Math.max(0, this.hunger - 1);
        }

        if (!disableHungerEffects && this.hunger <= 0) {
            this.takeDamage(1);
        } else {
            const regenAmount = (this.level >= 20 ? 3 : (this.level >= 10 ? 2 : 1)) + this.getPassiveHealingBonus();
            this.heal(regenAmount);
        }
    },

    getEquippedSetPieceCounts() {
        const counts = new Map();

        this.forEachEquippedItem((item) => {
            const setId = typeof item?.properties?.setId === 'string'
                ? item.properties.setId
                : '';
            if (!setId) {
                return;
            }

            counts.set(setId, (counts.get(setId) || 0) + 1);
        });

        return counts;
    },

    getActiveEquipmentSetBonuses() {
        const pieceCounts = this.getEquippedSetPieceCounts();
        const activeBonuses = [];

        for (const [setId, count] of pieceCounts.entries()) {
            const setDefinition = getEquipmentSetDefinition(setId);
            if (!setDefinition || !Array.isArray(setDefinition.bonuses)) {
                continue;
            }

            for (const bonus of setDefinition.bonuses) {
                const requiredPieces = Math.max(1, Math.floor(Number(bonus?.pieces) || 0));
                if (count < requiredPieces) {
                    continue;
                }

                activeBonuses.push(bonus);
            }
        }

        return activeBonuses;
    },

    getEquipmentSetStatBonuses() {
        const bonuses = this.getActiveEquipmentSetBonuses();
        let powerBonus = 0;
        let armorBonus = 0;

        for (const bonus of bonuses) {
            powerBonus += Math.max(0, Number(bonus?.powerBonus || 0));
            armorBonus += Math.max(0, Number(bonus?.armorBonus || 0));
        }

        return { powerBonus, armorBonus };
    },

    getEquipmentSetGrantedConditionEntries() {
        const entries = [];
        const seenConditions = new Set();

        for (const bonus of this.getActiveEquipmentSetBonuses()) {
            const condition = bonus?.grantsCondition;
            if (!condition || seenConditions.has(condition)) {
                continue;
            }

            const fallbackDuration = Number.isFinite(bonus?.grantsConditionDuration)
                ? bonus.grantsConditionDuration
                : Infinity;

            entries.push({
                condition,
                duration: getConditionDuration(condition, fallbackDuration)
            });
            seenConditions.add(condition);
        }

        return entries;
    },

    getEquipmentGrantedConditionEntries() {
        const entries = [];
        const seenConditions = new Set();

        this.forEachEquippedItem((item) => {
            if (!item || typeof item.getEnchantments !== 'function') {
                return;
            }

            for (const enchantmentId of item.getEnchantments()) {
                const definition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};
                const condition = definition.grantsCondition;
                if (!condition || seenConditions.has(condition)) {
                    continue;
                }

                const fallbackDuration = Number.isFinite(definition.grantsConditionDuration)
                    ? definition.grantsConditionDuration
                    : Infinity;
                entries.push({
                    condition,
                    duration: getConditionDuration(condition, fallbackDuration)
                });
                seenConditions.add(condition);
            }
        });

        for (const entry of this.getEquipmentSetGrantedConditionEntries()) {
            if (!entry?.condition || seenConditions.has(entry.condition)) {
                continue;
            }

            entries.push(entry);
            seenConditions.add(entry.condition);
        }

        return entries;
    },

    applyEquipmentGrantedConditions() {
        const grantedEntries = this.getEquipmentGrantedConditionEntries();
        const currentlyGrantedConditions = new Set(grantedEntries.map((entry) => entry.condition));

        for (const entry of grantedEntries) {
            const condition = entry.condition;
            this.equipmentGrantedConditions.add(condition);
            if (this.hasCondition(condition)) {
                this.conditions.set(condition, entry.duration);
                continue;
            }

            const added = this.addCondition(condition, entry.duration);
            if (added === false) {
                this.equipmentGrantedConditions.delete(condition);
            }
        }

        for (const condition of [...this.equipmentGrantedConditions]) {
            if (currentlyGrantedConditions.has(condition)) {
                continue;
            }

            this.removeCondition(condition);
            this.equipmentGrantedConditions.delete(condition);
        }
    },

    isAlive() {
        return this.health > 0;
    }
});
