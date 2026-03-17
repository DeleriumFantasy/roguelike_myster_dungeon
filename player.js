// Player class

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.facing = { dx: 0, dy: -1 };
        this.maxHealth = 20;
        this.health = 20;
        this.maxHunger = 100;
        this.hunger = 100;
        this.turns = 0;
        this.power = 1;
        this.armor = 0;
        this.conditions = new Map();
        this.equipment = new Map();
        this.inventory = [];
        this.allies = [];
        // EXP / level
        this.exp = 0;
        this.level = 1;
        this.expToNextLevel = this.getExpToNextLevel();
        this.money = 0;
        this.updateStats();
    }

    move(dx, dy, world) {
        const newX = this.x + dx;
        const newY = this.y + dy;

        if (world.canPlayerOccupy(newX, newY)) {
            this.x = newX;
            this.y = newY;
            this.checkHazards(world);
            return true;
        }
        return false;
    }

    setFacingDirection(dx, dy) {
        const normalizedFacing = normalizeDirection(dx, dy, this.getFacingDirection());
        if (normalizedFacing.dx === this.facing.dx && normalizedFacing.dy === this.facing.dy) {
            return;
        }

        this.facing = normalizedFacing;
    }

    getFacingDirection() {
        return normalizeDirection(this.facing?.dx, this.facing?.dy, { dx: 0, dy: -1 });
    }

    checkHazards(world) {
        const tile = world.getTile(this.x, this.y);
        if (tile === TILE_TYPES.PIT || tile === TILE_TYPES.WATER) {
            const armorEffectiveness = tile === TILE_TYPES.WATER ? 0 : 1;
            this.takeDamage(getEnvironmentalDamageForTile(tile, 5), null, { armorEffectiveness });
        }

        world.resolvePlayerHazardTransition(this, tile);
        this.applyEnvironmentEffects(world);
    }

    applyEnvironmentEffects(world) {
        const tile = world.getTile(this.x, this.y);
        const hazard = typeof world.getHazard === 'function' ? world.getHazard(this.x, this.y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        if (tileDamage > 0 && tile !== TILE_TYPES.PIT && tile !== TILE_TYPES.WATER) {
            const armorEffectiveness =
                tile === TILE_TYPES.LAVA ? 0
                    : tile === TILE_TYPES.SPIKE ? 0.5
                        : 1;
            this.takeDamage(tileDamage, null, { armorEffectiveness });
        }

        if (hazardDamage > 0) {
            const armorEffectiveness = hazard === HAZARD_TYPES.STEAM ? 0.5 : 1;
            this.takeDamage(hazardDamage, null, { armorEffectiveness });
        }
    }

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
    }

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
    }

    forEachEquippedItem(callback) {
        for (const item of this.equipment.values()) {
            callback(item);
        }
    }

    someEquippedItem(predicate) {
        for (const item of this.equipment.values()) {
            if (predicate(item)) {
                return true;
            }
        }

        return false;
    }

    getEquipmentMultiplier(methodName, arg) {
        let multiplier = 1;
        this.forEachEquippedItem((item) => {
            const multiplierMethod = item?.[methodName];
            if (typeof multiplierMethod === 'function') {
                multiplier *= multiplierMethod.call(item, arg);
            }
        });
        return multiplier;
    }

    hasPassiveHungerLossProtection() {
        return Array.from(this.conditions.keys()).some((condition) => conditionPreventsPassiveHungerLoss(condition));
    }

    isItemCursed(item) {
        if (!item) {
            return false;
        }

        if (typeof item.isCursed === 'function') {
            return item.isCursed();
        }

        return Boolean(item.properties?.cursed);
    }

    getIncomingDamageMultiplierAgainst(attacker) {
        const multiplier = this.getEquipmentMultiplier('getIncomingDamageMultiplierFrom', attacker);
        return Math.max(0.1, multiplier);
    }

    getAttackPowerAgainst(target) {
        let attackPower = this.power;
        const targetMultiplier = this.getEquipmentMultiplier('getDamageMultiplierAgainst', target);
        const attackerMultiplier = this.getEquipmentMultiplier('getDamageMultiplierForAttacker', this);
        const multiplier = targetMultiplier * attackerMultiplier;

        attackPower = Math.max(1, Math.round(attackPower * multiplier));

        return attackPower;
    }

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
    }

    getWeaponInflictedConditions() {
        const weapon = this.equipment.get(EQUIPMENT_SLOTS.WEAPON);
        if (!weapon || typeof weapon.getOnHitInflictedConditions !== 'function') {
            return [];
        }

        return weapon.getOnHitInflictedConditions(getRngRoll);
    }

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
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    restoreHunger(amount) {
        this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    }

    addCondition(condition, duration = getConditionDuration(condition, 1)) {
        if (this.shouldPreventConditionFromEquipment(condition)) {
            return false;
        }

        actorAddCondition(this, condition, duration);
        return true;
    }

    onAttacked() {
        actorResolveOnAttackedConditions(this);
    }

    removeCondition(condition) {
        this.conditions.delete(condition);
    }

    clearConditions() {
        this.conditions.clear();
    }

    hasCondition(condition) {
        return actorHasCondition(this, condition);
    }

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
    }

    getTempoMultiplier() {
        let multiplier = 1;
        if (this.hasCondition(CONDITIONS.HASTE)) {
            multiplier *= 0.5;
        }
        if (this.hasCondition(CONDITIONS.SLOW)) {
            multiplier *= 2;
        }
        return multiplier;
    }

    applyPerTurnRegen() {
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
    }

    equipItem(item) {
        const validSlots = Object.values(EQUIPMENT_SLOTS);
        if (!validSlots.includes(item.type)) {
            return false;
        }

        const currentlyEquipped = this.equipment.get(item.type);
        if (currentlyEquipped && !this.canUnequipItem(currentlyEquipped)) {
            return false;
        }

        this.unequipSlot(item.type);
        this.equipment.set(item.type, item);
        this.updateStats();
        return true;
    }

    _doUnequipSlot(slot, item) {
        if (!this.canUnequipItem(item)) return false;
        this.equipment.delete(slot);
        this.inventory.push(item);
        this.updateStats();
        return true;
    }

    unequipSlot(slot) {
        const item = this.equipment.get(slot);
        if (item && !this._doUnequipSlot(slot, item)) return false;
        return true;
    }

    unequipItem(item) {
        for (const [slot, equippedItem] of this.equipment) {
            if (equippedItem === item) {
                return this._doUnequipSlot(slot, item);
            }
        }
        return false;
    }

    canUnequipItem(item) {
        if (!item) return true;
        return !this.isItemCursed(item);
    }

    updateStats() {
        this.power = Math.max(1, Number(this.level) || 1);
        this.armor = 0;
        this.forEachEquippedItem((item) => {
            if (item.properties.power) this.power += item.properties.power;
            if (item.properties.armor) this.armor += item.properties.armor;
            if (typeof item.getEnchantmentPowerBonus === 'function') this.power += item.getEnchantmentPowerBonus();
            if (typeof item.getEnchantmentArmorBonus === 'function') this.armor += item.getEnchantmentArmorBonus();
        });
    }

    isStackableItem(item) {
        return Boolean(item) && item.type === ITEM_TYPES.THROWABLE;
    }

    getItemQuantity(item) {
        if (!item) {
            return 0;
        }

        if (typeof item.getQuantity === 'function') {
            return item.getQuantity();
        }

        return getRawItemQuantity(item.properties);
    }

    setItemQuantity(item, quantity) {
        if (!item) {
            return;
        }

        if (typeof item.setQuantity === 'function') {
            item.setQuantity(quantity);
            return;
        }

        if (!item.properties) {
            item.properties = {};
        }

        setRawItemQuantity(item.properties, quantity);
    }

    getStackKey(item) {
        if (!item) {
            return null;
        }

        const properties = { ...(item.properties || {}) };
        if (Object.prototype.hasOwnProperty.call(properties, 'quantity')) {
            delete properties.quantity;
        }

        const orderedProperties = {};
        Object.keys(properties).sort().forEach((key) => {
            orderedProperties[key] = properties[key];
        });

        return `${item.type}|${item.name}|${item.knowledgeState || ''}|${JSON.stringify(orderedProperties)}`;
    }

    findMatchingThrowableStack(item) {
        if (!this.isStackableItem(item)) {
            return null;
        }

        const stackKey = this.getStackKey(item);
        if (!stackKey) {
            return null;
        }

        return this.inventory.find((existingItem) => {
            if (!this.isStackableItem(existingItem)) {
                return false;
            }

            return this.getStackKey(existingItem) === stackKey;
        }) || null;
    }

    mergeThrowableStackQuantities(targetStack, sourceStack) {
        if (!targetStack || !sourceStack) {
            return;
        }

        const nextQuantity = this.getItemQuantity(targetStack) + this.getItemQuantity(sourceStack);
        this.setItemQuantity(targetStack, nextQuantity);
    }

    decrementThrowableStack(item, amount = 1) {
        if (!item || !this.isStackableItem(item) || amount <= 0) {
            return false;
        }

        const currentQuantity = this.getItemQuantity(item);
        if (currentQuantity < amount) {
            return false;
        }

        const nextQuantity = currentQuantity - amount;
        if (nextQuantity > 0) {
            this.setItemQuantity(item, nextQuantity);
        } else {
            this.removeItem(item);
        }

        return true;
    }

    addItem(item) {
        if (!item) {
            return;
        }

        if (this.isStackableItem(item)) {
            const existingStack = this.findMatchingThrowableStack(item);
            if (existingStack) {
                this.mergeThrowableStackQuantities(existingStack, item);
                return;
            }

            this.setItemQuantity(item, this.getItemQuantity(item));
        }

        this.inventory.push(item);
    }

    dequeueThrowItem(item) {
        if (!item) {
            return null;
        }

        if (this.isStackableItem(item)) {
            return this.consumeThrowableFromStack(item);
        }

        this.removeItem(item);
        return item;
    }

    consumeThrowableFromStack(item) {
        if (!item || !this.isStackableItem(item)) {
            return null;
        }

        const currentQuantity = this.getItemQuantity(item);
        if (currentQuantity <= 0) {
            return null;
        }

        const thrownItem = typeof item.createSingleUseClone === 'function'
            ? item.createSingleUseClone()
            : item;

        this.decrementThrowableStack(item);

        return thrownItem;
    }

    addAlly(enemy) {
        if (!this.allies.includes(enemy)) {
            this.allies.push(enemy);
        }
    }

    removeAlly(enemy) {
        const index = this.allies.indexOf(enemy);
        if (index > -1) {
            this.allies.splice(index, 1);
        }
    }

    equipItemOnAlly(ally, item) {
        if (!ally || !ally.isAlly) {
            return { success: false, reason: 'target is not an ally' };
        }
        if (!this.allies.includes(ally)) {
            return { success: false, reason: 'ally is not bound to player' };
        }
        if (typeof ally.equipItem !== 'function') {
            return { success: false, reason: 'ally equipment is not implemented' };
        }
        const equipped = ally.equipItem(item);
        return {
            success: Boolean(equipped),
            reason: equipped ? 'ok' : 'ally cannot equip item'
        };
    }

    removeItem(item) {
        const index = this.inventory.indexOf(item);
        if (index > -1) {
            this.inventory.splice(index, 1);
        }
    }

    getInventory() {
        return this.inventory;
    }

    getEquippedItems() {
        return Array.from(this.equipment.entries());
    }

    getExpToNextLevel() {
        return getExpRequiredForPlayerLevel(this.level + 1);
    }

    applyLevelUpRewards() {
        this.maxHealth += 5;
        this.health = this.maxHealth;
        this.power += 1;
    }

    levelUpOnce() {
        this.exp -= this.expToNextLevel;
        this.level += 1;
        this.expToNextLevel = this.getExpToNextLevel();
        this.applyLevelUpRewards();
    }

    addExp(amount) {
        if (typeof amount !== 'number' || amount <= 0) {
            return 0;
        }

        this.exp += amount;
        let levelUps = 0;

        while (this.exp >= this.expToNextLevel) {
            this.levelUpOnce();
            levelUps += 1;
        }

        return levelUps;
    }

    isAlive() {
        return this.health > 0;
    }
}