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
            const consumeResult = this.consume(user, target);
            this.identify();
            return consumeResult;
        }

        this.identify();
        return { consumed: false, reason: 'not-consumable' };
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
            const improvementSuffix = this.getImprovementSuffix();

            if (this.type === ITEM_TYPES.POT) {
                const remainingSpace = this.getRemainingPotSpace();
                const capacity = this.getPotCapacity();
                const storedSuffix = ` [space ${remainingSpace}/${capacity}]`;
                return `${this.name}${storedSuffix}${improvementSuffix}`;
            }

            const enchantmentNames = this.getVisibleEnchantmentNames();
            if (enchantmentNames.length === 0) {
                return `${this.name}${improvementSuffix}`;
            }

            const enchantmentCount = enchantmentNames.length;
            const enchantmentLabel = enchantmentCount === 1 ? 'enchantment' : 'enchantments';
            return `${this.name} [${enchantmentCount} ${enchantmentLabel}]${improvementSuffix}`;
        }
        return this.properties.hiddenName || `unknown ${this.type}`;
    }

    getImprovementLevel() {
        const level = Number(this.properties?.improvementLevel || 0);
        return Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
    }

    getImprovementSuffix() {
        const level = this.getImprovementLevel();
        return level > 0 ? ` +${level}` : '';
    }

    isPotItem() {
        return this.type === ITEM_TYPES.POT;
    }

    getPotType() {
        return typeof this.properties?.potType === 'string'
            ? this.properties.potType
            : 'basic';
    }

    getStoredItems() {
        return Array.isArray(this.properties?.storedItems)
            ? this.properties.storedItems.filter(Boolean)
            : [];
    }

    getStoredItemCount() {
        return this.getStoredItems().length;
    }

    getUsedPotSpace() {
        if (!this.isPotItem()) {
            return 0;
        }

        const explicitUsed = Number(this.properties?.usedPotSpace);
        const storedCount = this.getStoredItemCount();
        if (Number.isFinite(explicitUsed) && explicitUsed >= 0) {
            return Math.max(storedCount, Math.floor(explicitUsed));
        }

        return storedCount;
    }

    getPotCapacity() {
        if (!this.isPotItem()) {
            return 0;
        }

        this.properties = this.properties || {};
        const configuredCapacity = Number(this.properties.potCapacity);
        if (Number.isFinite(configuredCapacity) && configuredCapacity > 0) {
            return Math.max(1, Math.floor(configuredCapacity));
        }

        const minCapacity = Number(this.properties.minCapacity);
        const maxCapacity = Number(this.properties.maxCapacity);
        const safeMin = Number.isFinite(minCapacity) && minCapacity > 0
            ? Math.floor(minCapacity)
            : 1;
        const safeMax = Number.isFinite(maxCapacity) && maxCapacity > 0
            ? Math.max(safeMin, Math.floor(maxCapacity))
            : safeMin;

        const rolledCapacity = typeof getRngRandomInt === 'function'
            ? getRngRandomInt(null, safeMin, safeMax)
            : safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
        this.properties.potCapacity = Math.max(1, Math.floor(rolledCapacity));
        return this.properties.potCapacity;
    }

    getRemainingPotSpace() {
        return Math.max(0, this.getPotCapacity() - this.getUsedPotSpace());
    }

    consumePotSpace(amount = 1) {
        if (!this.isPotItem()) {
            return 0;
        }

        const capacity = this.getPotCapacity();
        const used = this.getUsedPotSpace();
        const nextUsed = clamp(used + Math.max(0, Math.floor(Number(amount) || 0)), 0, capacity);
        this.properties = this.properties || {};
        this.properties.usedPotSpace = nextUsed;
        return nextUsed - used;
    }

    isPotFull() {
        return this.isPotItem() && this.getRemainingPotSpace() <= 0;
    }

    storeItemInPot(item) {
        if (!this.isPotItem() || !item || item === this) {
            return { stored: false, reason: 'invalid-item' };
        }

        if (item?.isPotItem?.()) {
            return { stored: false, reason: 'pot-not-allowed' };
        }

        if (this.isPotFull()) {
            return { stored: false, reason: 'full' };
        }

        this.properties = this.properties || {};
        if (!Array.isArray(this.properties.storedItems)) {
            this.properties.storedItems = [];
        }

        this.properties.storedItems.push(item);
        this.consumePotSpace(1);
        return { stored: true, item };
    }

    releaseStoredItems() {
        const storedItems = this.getStoredItems();
        if (this.properties && Object.prototype.hasOwnProperty.call(this.properties, 'storedItems')) {
            delete this.properties.storedItems;
        }
        return storedItems;
    }

    hasEnchantment(enchantmentId) {
        return this.getEnchantments().includes(enchantmentId);
    }

    loseImprovement(amount = 1) {
        const improvementLoss = Math.max(0, Math.floor(Number(amount) || 0));
        const currentLevel = this.getImprovementLevel();
        if (improvementLoss <= 0 || currentLevel <= 0 || this.hasEnchantment('gilded')) {
            return 0;
        }

        const actualLoss = Math.min(currentLevel, improvementLoss);
        const powerBonus = Math.max(0, Math.floor(Number(this.properties?.improvementPowerBonus || 0)));
        const armorBonus = Math.max(0, Math.floor(Number(this.properties?.improvementArmorBonus || 0)));

        if (powerBonus > 0) {
            const powerLoss = Math.min(powerBonus, actualLoss);
            this.properties.power = Math.max(0, Number(this.properties.power || 0) - powerLoss);
            const nextPowerBonus = powerBonus - powerLoss;
            if (nextPowerBonus > 0) {
                this.properties.improvementPowerBonus = nextPowerBonus;
            } else {
                delete this.properties.improvementPowerBonus;
            }
        }

        if (armorBonus > 0) {
            const armorLoss = Math.min(armorBonus, actualLoss);
            this.properties.armor = Math.max(0, Number(this.properties.armor || 0) - armorLoss);
            const nextArmorBonus = armorBonus - armorLoss;
            if (nextArmorBonus > 0) {
                this.properties.improvementArmorBonus = nextArmorBonus;
            } else {
                delete this.properties.improvementArmorBonus;
            }
        }

        const nextLevel = currentLevel - actualLoss;
        if (nextLevel > 0) {
            this.properties.improvementLevel = nextLevel;
        } else {
            delete this.properties.improvementLevel;
        }

        return actualLoss;
    }

    tryLoseImprovement(chance = 1, amount = 1, randomFn = getRngRoll) {
        if (this.getImprovementLevel() <= 0 || this.hasEnchantment('gilded')) {
            return 0;
        }

        const lossChance = clamp(Number(chance) || 0, 0, 1);
        if (lossChance <= 0) {
            return 0;
        }

        const roll = typeof randomFn === 'function' ? randomFn() : Math.random();
        if (roll >= lossChance) {
            return 0;
        }

        return this.loseImprovement(amount);
    }

    getImprovementTargetTypes() {
        const configuredTypes = this.properties?.improvesItemTypes;
        if (!Array.isArray(configuredTypes)) {
            return [];
        }

        return configuredTypes.filter((type) => typeof type === 'string' && type.length > 0);
    }

    isEquipmentImprovementScroll() {
        return this.type === ITEM_TYPES.CONSUMABLE && this.getImprovementTargetTypes().length > 0;
    }

    getScrollEffect() {
        return typeof this.properties?.scrollEffect === 'string'
            ? this.properties.scrollEffect
            : '';
    }

    getTargetItemTypes() {
        const configuredTypes = this.properties?.targetItemTypes;
        if (!Array.isArray(configuredTypes)) {
            return [];
        }

        return configuredTypes.filter((type) => typeof type === 'string' && type.length > 0);
    }

    isEquipmentItem(item) {
        if (!item) {
            return false;
        }

        return isEquippableItemType(item.type);
    }

    canTargetItemForScroll(item) {
        if (!item) {
            return false;
        }

        if (this.isEquipmentImprovementScroll()) {
            return this.canImproveEquipmentItem(item);
        }

        const validTypes = this.getTargetItemTypes();
        if (validTypes.length > 0) {
            return validTypes.includes(item.type);
        }

        return false;
    }

    getMaxEnchantmentSlots() {
        const slots = Number(this.properties?.slots || 0);
        return Number.isFinite(slots) && slots > 0 ? Math.floor(slots) : 0;
    }

    addEnchantment(enchantmentId) {
        if (typeof enchantmentId !== 'string' || enchantmentId.length === 0) {
            return { added: false, reason: 'invalid-enchantment' };
        }

        const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId];
        if (!enchantmentDefinition) {
            return { added: false, reason: 'unknown-enchantment' };
        }

        const validItemTypes = Array.isArray(enchantmentDefinition.validItemTypes)
            ? enchantmentDefinition.validItemTypes
            : [];
        if (validItemTypes.length > 0 && !validItemTypes.includes(this.type)) {
            return { added: false, reason: 'invalid-item-type' };
        }

        if (!Array.isArray(this.properties.enchantments)) {
            this.properties.enchantments = [];
        }

        if (this.properties.enchantments.includes(enchantmentId)) {
            return { added: false, reason: 'already-present' };
        }

        const maxSlots = this.getMaxEnchantmentSlots();
        if (maxSlots > 0 && this.getEnchantments().length >= maxSlots) {
            return { added: false, reason: 'slot-limit' };
        }

        this.properties.enchantments.push(enchantmentId);
        return { added: true };
    }

    applyScrollTargetEffect(target) {
        if (!target) {
            return { consumed: false, effect: this.getScrollEffect(), reason: 'missing-target' };
        }

        const scrollEffect = this.getScrollEffect();
        if (scrollEffect === 'add-slot') {
            if (!this.canTargetItemForScroll(target) || !this.isEquipmentItem(target)) {
                return { consumed: false, effect: scrollEffect, target, reason: 'invalid-target' };
            }

            target.properties = target.properties || {};
            const slots = Number(target.properties.slots || 0);
            const nextSlots = Math.max(0, Math.floor(slots)) + 1;
            target.properties.slots = nextSlots;
            return { consumed: true, effect: scrollEffect, target, slots: nextSlots };
        }

        if (scrollEffect === 'purify-item') {
            if (!this.canTargetItemForScroll(target)) {
                return { consumed: false, effect: scrollEffect, target, reason: 'invalid-target' };
            }

            const wasCursed = Boolean(target.properties?.cursed);
            if (target.properties && Object.prototype.hasOwnProperty.call(target.properties, 'cursed')) {
                delete target.properties.cursed;
            }
            return { consumed: true, effect: scrollEffect, target, wasCursed };
        }

        if (scrollEffect === 'identify-item') {
            if (!this.canTargetItemForScroll(target)) {
                return { consumed: false, effect: scrollEffect, target, reason: 'invalid-target' };
            }

            target.identify?.();
            return { consumed: true, effect: scrollEffect, target, isCursed: Boolean(target.properties?.cursed) };
        }

        if (scrollEffect === 'add-gilded') {
            if (!this.canTargetItemForScroll(target) || !this.isEquipmentItem(target)) {
                return { consumed: false, effect: scrollEffect, target, reason: 'invalid-target' };
            }

            const added = typeof target.addEnchantment === 'function'
                ? target.addEnchantment('gilded')
                : { added: false, reason: 'target-cannot-enchant' };
            return {
                consumed: Boolean(added?.added),
                effect: scrollEffect,
                target,
                reason: added?.reason || ''
            };
        }

        return { consumed: false, effect: scrollEffect, target, reason: 'unsupported-target-effect' };
    }

    canImproveEquipmentItem(item) {
        const equipmentTypes = [ITEM_TYPES.WEAPON, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD, ITEM_TYPES.ACCESSORY];
        if (!item || !equipmentTypes.includes(item.type)) {
            return false;
        }

        const validTypes = this.getImprovementTargetTypes();
        return validTypes.includes(item.type);
    }

    applyEquipmentImprovement(item) {
        if (!this.canImproveEquipmentItem(item)) {
            return { applied: false };
        }

        if (!item.properties) {
            item.properties = {};
        }

        const incrementProperty = (propertyName, bonusPropertyName) => {
            const currentValue = Number(item.properties[propertyName] || 0);
            item.properties[propertyName] = currentValue + 1;

            const currentBonus = Number(item.properties[bonusPropertyName] || 0);
            item.properties[bonusPropertyName] = currentBonus + 1;
        };

        let improvedProperty = null;
        if (item.type === ITEM_TYPES.ARMOR || item.type === ITEM_TYPES.SHIELD) {
            improvedProperty = 'armor';
            incrementProperty('armor', 'improvementArmorBonus');
        } else if (item.type === ITEM_TYPES.WEAPON) {
            improvedProperty = 'power';
            incrementProperty('power', 'improvementPowerBonus');
        } else if (item.type === ITEM_TYPES.ACCESSORY) {
            const accessoryPower = Number(item.properties.power || 0);
            if (accessoryPower > 0) {
                improvedProperty = 'power';
                incrementProperty('power', 'improvementPowerBonus');
            } else {
                improvedProperty = 'armor';
                incrementProperty('armor', 'improvementArmorBonus');
            }
        }

        if (!improvedProperty) {
            return { applied: false };
        }

        const currentLevel = Number(item.properties.improvementLevel || 0);
        item.properties.improvementLevel = Math.max(0, Math.floor(currentLevel)) + 1;

        return {
            applied: true,
            property: improvedProperty,
            level: item.properties.improvementLevel
        };
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

    getEnchantmentMultiplier(bonusKey) {
        let multiplier = 1;
        for (const enchantmentId of this.getEnchantments()) {
            const configuredMultiplier = getPositiveFiniteNumber(ENCHANTMENT_DEFINITIONS[enchantmentId]?.[bonusKey]);
            if (configuredMultiplier > 0) {
                multiplier *= configuredMultiplier;
            }
        }

        return multiplier;
    }

    getEnchantmentNumericSum(bonusKey) {
        let total = 0;
        for (const enchantmentId of this.getEnchantments()) {
            const configuredValue = Number(ENCHANTMENT_DEFINITIONS[enchantmentId]?.[bonusKey] || 0);
            if (Number.isFinite(configuredValue)) {
                total += configuredValue;
            }
        }

        return total;
    }

    hasEnchantmentFlag(flagKey) {
        return this.getEnchantments().some((enchantmentId) => Boolean(ENCHANTMENT_DEFINITIONS[enchantmentId]?.[flagKey]));
    }

    getExpGainMultiplier() {
        return this.getEnchantmentMultiplier('expGainMultiplier');
    }

    getPassiveHungerLossIntervalMultiplier() {
        return this.getEnchantmentMultiplier('passiveHungerLossIntervalMultiplier');
    }

    getPassiveHealingBonus() {
        return this.getEnchantmentNumericSum('passiveHealingBonus');
    }

    revealsEnemiesOnMap() {
        return this.hasEnchantmentFlag('revealsEnemiesOnMap');
    }

    revealsItemsOnMap() {
        return this.hasEnchantmentFlag('revealsItemsOnMap');
    }

    revealsTraps() {
        return this.hasEnchantmentFlag('revealsTraps');
    }

    identifiesItemsOnPickup() {
        return this.hasEnchantmentFlag('identifiesItemsOnPickup');
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

    getCounterReflectRatio() {
        return Math.max(0, this.getEnchantmentNumericSum('counterReflectRatio'));
    }

    getQuantity() {
        return getRawItemQuantity(this.properties);
    }

    setQuantity(quantity) {
        setRawItemQuantity(this.properties, quantity);
    }

    createSingleUseClone() {
        const clonedProperties = { ...this.properties };
        if (Array.isArray(clonedProperties.enchantments)) {
            clonedProperties.enchantments = [...clonedProperties.enchantments];
        }
        if (Array.isArray(clonedProperties.storedItems)) {
            clonedProperties.storedItems = clonedProperties.storedItems
                .map((storedItem) => typeof storedItem?.createSingleUseClone === 'function'
                    ? storedItem.createSingleUseClone()
                    : storedItem)
                .filter(Boolean);
        }
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

    consume(user, target = null) {
        if (this.isEquipmentImprovementScroll()) {
            const improvementResult = this.applyEquipmentImprovement(target);
            return {
                consumed: improvementResult.applied,
                effect: 'equipment-improvement',
                target,
                ...improvementResult
            };
        }

        if (target && this.getScrollEffect()) {
            return this.applyScrollTargetEffect(target);
        }

        if (this.properties.questReturnOnly || this.properties.useBlocked) {
            return {
                consumed: false,
                effect: 'blocked-use',
                reason: this.properties.questReturnOnly ? 'quest-return-only' : 'blocked-use',
                message: typeof this.properties.useBlockMessage === 'string'
                    ? this.properties.useBlockMessage
                    : 'This item cannot be used right now.'
            };
        }

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

        return { consumed: true };
    }

    throw(user, target) {
        if (!target) {
            return { damage: 0, healing: 0, inflictedConditions: [] };
        }

        const damage = Math.max(0, Number(this.properties.power || 0) + Number(this.properties.armor || 0));
        const healing = Math.max(0, Number(this.properties.health || 0) + Number(this.properties.hunger || 0));
        const { condition, duration } = resolveConditionDuration(this.properties);
        const inflictedConditions = [];
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

        if (condition && typeof target.addCondition === 'function' && target.isAlive?.() !== false) {
            const applied = target.addCondition(condition, duration);
            if (applied !== false) {
                inflictedConditions.push(condition);
            }
        }

        return { damage: actualDamage || 0, healing, inflictedConditions };
    }

    equip(user) {
        if (!isEquippableItemType(this.type)) {
            return false;
        }

        const equipped = user.equipItem(this);
        if (equipped) {
            this.identify();
        }
        return equipped;
    }

    unequip(user) {
        return user.unequipItem(this);
    }
}
