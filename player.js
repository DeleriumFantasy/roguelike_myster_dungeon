// Player class
console.log('player.js loaded');

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
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

    checkHazards(world) {
        const tile = world.getTile(this.x, this.y);
        if (tile === TILE_TYPES.PIT || tile === TILE_TYPES.WATER) {
            this.takeDamage(5);
            const safePos = findNearestSafeTile(this.x, this.y, world.getCurrentFloor().grid, world.currentFloor);
            this.x = safePos.x;
            this.y = safePos.y;
            if (tile === TILE_TYPES.PIT && world.currentFloor > 0) {
                // Save the pit location before ascending
                const pitX = this.x;
                const pitY = this.y;
                world.ascendFloor();
                // Find nearest safe tile to the pit's x,y on the previous floor
                const safePosPrevFloor = findNearestSafeTile(pitX, pitY, world.getCurrentFloor().grid, world.currentFloor);
                this.x = safePosPrevFloor.x;
                this.y = safePosPrevFloor.y;
            }
        } else if (tile === TILE_TYPES.SPIKE) {
            this.takeDamage(3);
        } else if (tile === TILE_TYPES.STAIRS_DOWN) {
            world.descendFloor();
            // Find up stairs on new floor
            let found = false;
            for (let y = 0; y < GRID_SIZE && !found; y++) {
                for (let x = 0; x < GRID_SIZE && !found; x++) {
                    if (world.getTile(x, y) === TILE_TYPES.STAIRS_UP) {
                        this.x = x;
                        this.y = y;
                        found = true;
                    }
                }
            }
        } else if (tile === TILE_TYPES.STAIRS_UP && world.currentFloor > 0) {
            world.ascendFloor();
            // Find down stairs on previous floor
            let found = false;
            for (let y = 0; y < GRID_SIZE && !found; y++) {
                for (let x = 0; x < GRID_SIZE && !found; x++) {
                    if (world.getTile(x, y) === TILE_TYPES.STAIRS_DOWN) {
                        this.x = x;
                        this.y = y;
                        found = true;
                    }
                }
            }
        }
    }

    takeDamage(amount) {
        const actualDamage = Math.max(1, amount - this.armor);
        this.health = Math.max(0, this.health - actualDamage);
    }

    attackEnemy(enemy) {
        if (!enemy || !enemy.isAlive()) {
            return 0;
        }
        const baseDamage = Math.max(1, this.power);
        enemy.takeDamage(baseDamage);
        return baseDamage;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    restoreHunger(amount) {
        this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    }

    addCondition(condition, duration = 1) {
        this.conditions.set(condition, duration);
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
            switch (condition) {
                case CONDITIONS.POISONED:
                    this.takeDamage(2);
                    break;
                case CONDITIONS.HUNGRY:
                    this.hunger = Math.max(0, this.hunger - 5);
                    break;
            }
            if (duration > 1) {
                this.conditions.set(condition, duration - 1);
            } else {
                this.conditions.delete(condition);
            }
        }
    }

    applyPerTurnRegen() {
        this.turns += 1;
        this.heal(1);
        if (this.turns % 5 === 0) {
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