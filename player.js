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
        this.power = 5;
        this.armor = 0;
        this.conditions = new Map();
        this.equipment = new Map();
        this.inventory = [];
        this.allies = [];
        this.lastKnownPlayerPos = { x, y };

        // EXP / level
        this.exp = 0;
        this.level = 1;
        this.expToNextLevel = 50;
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
        const activeConditions = Array.from(this.conditions.keys());
        if (activeConditions.some((condition) => conditionPreventsDamage(condition))) {
            return 0;
        }

        const actualDamage = Math.max(1, amount - this.armor);
        const nextHealth = this.health - actualDamage;
        const fatalProtectionCondition = activeConditions.find((condition) => conditionSurvivesFatalDamage(condition));
        if (nextHealth <= 0 && fatalProtectionCondition) {
            const dealtDamage = Math.max(0, this.health - 1);
            this.health = Math.max(1, this.health - dealtDamage);
            this.removeCondition(fatalProtectionCondition);
            return dealtDamage;
        }

        this.health = Math.max(0, nextHealth);
        return Math.min(actualDamage, this.health + actualDamage);
    }

    attackEnemy(enemy) {
        if (!enemy || !enemy.isAlive()) {
            return 0;
        }
        const baseDamage = Math.max(1, this.power);
        const damage = enemy.takeDamage(baseDamage);
        if (damage > 0 && typeof enemy.onAttacked === 'function') {
            enemy.onAttacked();
        }
        return damage;
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
        this.heal(1);
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
        this.power = 10;
        this.armor = 0;
        for (const item of this.equipment.values()) {
            if (item.properties.power) this.power += item.properties.power;
            if (item.properties.armor) this.armor += item.properties.armor;
        }
    }

    addItem(item) {
        this.inventory.push(item);
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

    addExp(amount) {
        if (typeof amount !== 'number' || amount <= 0) {
            return 0;
        }

        this.exp += amount;
        let levelUps = 0;

        while (this.exp >= this.expToNextLevel) {
            this.exp -= this.expToNextLevel;
            this.level += 1;
            this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
            this.maxHealth += 5;
            this.health = this.maxHealth;
            this.power += 1;
            levelUps += 1;
        }

        return levelUps;
    }

    isAlive() {
        return this.health > 0;
    }
}