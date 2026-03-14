// Player class
console.log('player.js loaded');

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
        this.lastKnownPlayerPos = { x, y };

        // EXP / level
        this.exp = 0;
        this.level = 1;
        this.expToNextLevel = this.getExpToNextLevel();
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
        const normalizedDx = Math.sign(dx);
        const normalizedDy = Math.sign(dy);
        if (normalizedDx === 0 && normalizedDy === 0) {
            return;
        }

        this.facing = { dx: normalizedDx, dy: normalizedDy };
    }

    getFacingDirection() {
        if (!this.facing || (this.facing.dx === 0 && this.facing.dy === 0)) {
            return { dx: 0, dy: -1 };
        }

        return { dx: this.facing.dx, dy: this.facing.dy };
    }

    checkHazards(world) {
        const tile = world.getTile(this.x, this.y);
        if (tile === TILE_TYPES.PIT || tile === TILE_TYPES.WATER) {
            this.takeDamage(getEnvironmentalDamageForTile(tile, 5));
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
            this.takeDamage(tileDamage);
        }

        if (hazardDamage > 0) {
            this.takeDamage(hazardDamage);
        }
    }

    takeDamage(amount) {
        return applyDamageToActor(this, amount, this.armor);
    }

    attackEnemy(enemy) {
        if (!enemy || !enemy.isAlive()) {
            return 0;
        }
        return applyStandardAttackToTarget(enemy, this.power);
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    restoreHunger(amount) {
        this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    }

    addCondition(condition, duration = getConditionDuration(condition, 1)) {
        this.conditions.set(condition, duration);
    }

    onAttacked() {
        for (const condition of [...this.conditions.keys()]) {
            if (shouldRemoveConditionOnAttacked(condition)) {
                this.removeCondition(condition);
            }
        }
    }

    removeCondition(condition) {
        this.conditions.delete(condition);
    }

    clearConditions() {
        this.conditions.clear();
    }

    hasCondition(condition) {
        return this.conditions.has(condition);
    }

    tickConditions() {
        for (const [condition, duration] of this.conditions) {
            const tickDamage = getConditionTickDamage(condition, 0);
            const tickHunger = getConditionTickHunger(condition, 0);
            const preventsPassiveHungerLoss = Array.from(this.conditions.keys()).some((activeCondition) => conditionPreventsPassiveHungerLoss(activeCondition));

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
        const regenAmount = this.level >= 20 ? 3 : (this.level >= 10 ? 2 : 1);
        this.heal(regenAmount);
        const preventsPassiveHungerLoss = Array.from(this.conditions.keys()).some((condition) => conditionPreventsPassiveHungerLoss(condition));
        if (this.turns % 5 === 0 && !preventsPassiveHungerLoss) {
            this.hunger = Math.max(0, this.hunger - 1);
            return true;
        }
        return false;
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

    unequipSlot(slot) {
        const item = this.equipment.get(slot);
        if (item) {
            if (!this.canUnequipItem(item)) {
                return false;
            }
            this.equipment.delete(slot);
            this.inventory.push(item);
            this.updateStats();
        }
        return true;
    }

    unequipItem(item) {
        for (const [slot, equippedItem] of this.equipment) {
            if (equippedItem === item) {
                if (!this.canUnequipItem(equippedItem)) {
                    return false;
                }
                this.equipment.delete(slot);
                this.inventory.push(item);
                this.updateStats();
                return true;
            }
        }
        return false;
    }

    canUnequipItem(item) {
        if (!item) return true;
        if (typeof item.isCursed === 'function' && item.isCursed()) {
            return false;
        }
        return !item.properties?.cursed;
    }

    updateStats() {
        this.power = Math.max(1, Number(this.level) || 1);
        this.armor = 0;
        for (const item of this.equipment.values()) {
            if (item.properties.power) this.power += item.properties.power;
            if (item.properties.armor) this.armor += item.properties.armor;
        }
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

        const quantity = Number(item.properties?.quantity);
        return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
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

        const nextQuantity = Number(quantity);
        if (Number.isFinite(nextQuantity) && nextQuantity > 1) {
            item.properties.quantity = Math.floor(nextQuantity);
            return;
        }

        if (Object.prototype.hasOwnProperty.call(item.properties, 'quantity')) {
            delete item.properties.quantity;
        }
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

        for (const existingItem of this.inventory) {
            if (!this.isStackableItem(existingItem)) {
                continue;
            }

            if (this.getStackKey(existingItem) === stackKey) {
                return existingItem;
            }
        }

        return null;
    }

    addItem(item) {
        if (!item) {
            return;
        }

        if (this.isStackableItem(item)) {
            const existingStack = this.findMatchingThrowableStack(item);
            if (existingStack) {
                const nextQuantity = this.getItemQuantity(existingStack) + this.getItemQuantity(item);
                this.setItemQuantity(existingStack, nextQuantity);
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

        if (currentQuantity > 1) {
            this.setItemQuantity(item, currentQuantity - 1);
        } else {
            this.removeItem(item);
        }

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