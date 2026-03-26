// Item system base class

class Item {
    constructor(name, type, properties = {}) {
        this.name = name;
        this.type = type;
        this.properties = properties;
        this.knowledgeState = this.requiresIdentification() ? ITEM_KNOWLEDGE.UNKNOWN : ITEM_KNOWLEDGE.IDENTIFIED;
    }

    use(user, target) {
        if (this.type === ITEM_TYPES.CONSUMABLE) {
            this.consume(user);
        }
        this.identify();
    }

    requiresIdentification() {
        if (typeof this.properties.requiresIdentification === 'boolean') {
            return this.properties.requiresIdentification;
        }

        const unidentifiedByDefault = [
            ITEM_TYPES.CONSUMABLE,
            ITEM_TYPES.THROWABLE,
            ITEM_TYPES.WEAPON,
            ITEM_TYPES.ARMOR,
            ITEM_TYPES.SHIELD,
            ITEM_TYPES.ACCESSORY
        ];
        return unidentifiedByDefault.includes(this.type);
    }

    identify() {
        this.knowledgeState = ITEM_KNOWLEDGE.IDENTIFIED;
    }

    isIdentified() {
        return this.knowledgeState === ITEM_KNOWLEDGE.IDENTIFIED;
    }

    getDisplayName() {
        if (this.isIdentified()) {
            const enchantmentNames = this.getVisibleEnchantmentNames();
            if (enchantmentNames.length === 0) {
                return this.name;
            }

            return `${this.name} [${enchantmentNames.join(', ')}]`;
        }
        return this.properties.hiddenName || `unknown ${this.type}`;
    }

    getEnchantments() {
        if (!Array.isArray(this.properties?.enchantments)) {
            return [];
        }

        const uniqueEnchantments = [];
        for (const enchantmentKey of this.properties.enchantments) {
            if (typeof enchantmentKey !== 'string') {
                continue;
            }

            if (!Object.prototype.hasOwnProperty.call(ENCHANTMENT_DEFINITIONS, enchantmentKey)) {
                continue;
            }

            const definition = ENCHANTMENT_DEFINITIONS[enchantmentKey];
            const validTypes = definition.validItemTypes || [];
            if (Array.isArray(validTypes) && validTypes.length > 0 && !validTypes.includes(this.type)) {
                continue;
            }

            if (!uniqueEnchantments.includes(enchantmentKey)) {
                uniqueEnchantments.push(enchantmentKey);
            }
        }

        return uniqueEnchantments;
    }

    getVisibleEnchantmentNames() {
        return this.getEnchantments()
            .map((enchantmentId) => ENCHANTMENT_DEFINITIONS[enchantmentId]?.name)
            .filter((name) => typeof name === 'string' && name.length > 0);
    }

    getEnchantmentPowerBonus() {
        return sumEnchantmentBonus(this.getEnchantments(), 'powerBonus');
    }

    getEnchantmentArmorBonus() {
        return sumEnchantmentBonus(this.getEnchantments(), 'armorBonus');
    }

    getDamageMultiplierAgainst(target) {
        if (!target) {
            return 1;
        }

        let multiplier = 1;
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};

            const genericDamageMultiplier = getPositiveFiniteNumber(enchantmentDefinition.damageMultiplier);
            if (genericDamageMultiplier > 0) {
                multiplier *= genericDamageMultiplier;
            }

            multiplier = applyEnemyTypeMultipliers(
                multiplier,
                target,
                enchantmentDefinition.damageMultiplierByEnemyType,
                (value, enemyTypeMultiplier) => value * enemyTypeMultiplier
            );
        }

        return multiplier;
    }

    getDamageMultiplierForAttacker(attacker) {
        if (!attacker) {
            return 1;
        }

        let multiplier = 1;
        const attackerHunger = Number(attacker.hunger || 0);
        const attackerMaxHunger = Math.max(1, Number(attacker.maxHunger || 1));
        const attackerHealth = Number(attacker.health || 0);
        const attackerMaxHealth = Math.max(1, Number(attacker.maxHealth || 1));

        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};

            const hungerMultiplier = getPositiveFiniteNumber(enchantmentDefinition.hungerPowerMultiplier);
            if (hungerMultiplier > 0 && attackerHunger / attackerMaxHunger <= 0.2) {
                multiplier *= hungerMultiplier;
            }

            const bloodyMultiplier = getPositiveFiniteNumber(enchantmentDefinition.bloodyPowerMultiplier);
            if (bloodyMultiplier > 0 && attackerHealth / attackerMaxHealth <= 0.2) {
                multiplier *= bloodyMultiplier;
            }
        }

        return multiplier;
    }

    getOnHitInflictedConditions(randomFn = Math.random) {
        if (typeof randomFn !== 'function') {
            randomFn = Math.random;
        }

        const inflictedConditions = [];
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};
            const inflictedCondition = enchantmentDefinition.inflictsCondition;
            const inflictChance = getPositiveFiniteNumber(enchantmentDefinition.inflictChance);

            if (!inflictedCondition) {
                continue;
            }

            if (inflictChance <= 0) {
                continue;
            }

            if (randomFn() < inflictChance) {
                inflictedConditions.push(inflictedCondition);
            }
        }

        return inflictedConditions;
    }

    getConditionPreventionChance(condition) {
        if (!condition) {
            return 0;
        }

        let highestChance = 0;
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};
            if (enchantmentDefinition.preventsCondition !== condition) {
                continue;
            }

            const preventionChance = getPositiveFiniteNumber(enchantmentDefinition.preventionChance);
            if (preventionChance > highestChance) {
                highestChance = preventionChance;
            }
        }

        return highestChance;
    }

    getIncomingDamageMultiplierFrom(attacker) {
        if (!attacker) {
            return 1;
        }

        let multiplier = 1;
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};

            const genericShieldMultiplier = getPositiveFiniteNumber(enchantmentDefinition.shieldMultiplier);
            if (genericShieldMultiplier > 0) {
                multiplier /= genericShieldMultiplier;
            }

            multiplier = applyEnemyTypeMultipliers(
                multiplier,
                attacker,
                enchantmentDefinition.shieldMultiplierByEnemyType,
                (value, enemyTypeMultiplier) => value / enemyTypeMultiplier
            );
        }

        return Math.max(0.1, multiplier);
    }

    getQuantity() {
        return getRawItemQuantity(this.properties);
    }

    setQuantity(quantity) {
        setRawItemQuantity(this.properties, quantity);
    }

    createSingleUseClone() {
        const clonedProperties = { ...this.properties };
        if (Object.prototype.hasOwnProperty.call(clonedProperties, 'quantity')) {
            delete clonedProperties.quantity;
        }

        const clonedItem = new Item(this.name, this.type, clonedProperties);
        clonedItem.knowledgeState = this.knowledgeState;
        return clonedItem;
    }

    isCursed() {
        return Boolean(this.properties.cursed);
    }

    consume(user) {
        const health = Number(this.properties.health || 0);
        const hunger = Number(this.properties.hunger || 0);
        const { condition, duration } = resolveConditionDuration(this.properties);
        if (health > 0) {
            user.heal(health);
        }
        if (hunger > 0) {
            user.restoreHunger(hunger);
        }
        if (condition && typeof user.addCondition === 'function') {
            user.addCondition(condition, duration);
        }
        if (this.properties.clearConditions) {
            user.clearConditions();
        }
    }

    throw(user, target) {
        if (!target) {
            return { damage: 0, healing: 0 };
        }

        const damage = Math.max(0, Number(this.properties.power || 0) + Number(this.properties.armor || 0));
        const healing = Math.max(0, Number(this.properties.health || 0) + Number(this.properties.hunger || 0));
        const { condition, duration } = resolveConditionDuration(this.properties);
        let actualDamage = damage;

        if (damage > 0 && typeof target.takeDamage === 'function') {
            actualDamage = target.takeDamage(damage) || 0;
            if (actualDamage > 0 && typeof target.onAttacked === 'function') {
                target.onAttacked();
            }
        }

        if (healing > 0 && typeof target.heal === 'function') {
            target.heal(healing);
        }

        if (condition && typeof target.addCondition === 'function') {
            target.addCondition(condition, duration);
        }

        return { damage: actualDamage || 0, healing };
    }

    equip(user) {
        if (this.type !== ITEM_TYPES.CONSUMABLE && this.type !== ITEM_TYPES.THROWABLE) {
            const equipped = user.equipItem(this);
            if (equipped) {
                this.identify();
            }
            return equipped;
        }
        return false;
    }

    unequip(user) {
        return user.unequipItem(this);
    }
}
