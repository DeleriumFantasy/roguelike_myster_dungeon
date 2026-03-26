// Player inventory, equipment, and ally helpers

Object.assign(Player.prototype, {
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
    },

    _doUnequipSlot(slot, item) {
        if (!this.canUnequipItem(item)) return false;

        this.applyEquipmentGrantedConditions();

        this.equipment.delete(slot);
        this.inventory.push(item);
        this.updateStats();
        return true;
    },

    unequipSlot(slot) {
        const item = this.equipment.get(slot);
        if (item && !this._doUnequipSlot(slot, item)) return false;
        return true;
    },

    unequipItem(item) {
        for (const [slot, equippedItem] of this.equipment) {
            if (equippedItem === item) {
                return this._doUnequipSlot(slot, item);
            }
        }
        return false;
    },

    canUnequipItem(item) {
        if (!item) return true;
        return !this.isItemCursed(item);
    },

    updateStats() {
        this.power = Math.max(1, Number(this.level) || 1);
        this.armor = 0;
        this.forEachEquippedItem((item) => {
            if (item.properties.power) this.power += item.properties.power;
            if (item.properties.armor) this.armor += item.properties.armor;
            if (typeof item.getEnchantmentPowerBonus === 'function') this.power += item.getEnchantmentPowerBonus();
            if (typeof item.getEnchantmentArmorBonus === 'function') this.armor += item.getEnchantmentArmorBonus();
        });

        this.applyEquipmentGrantedConditions();
    },

    isStackableItem(item) {
        return Boolean(item) && item.type === ITEM_TYPES.THROWABLE;
    },

    getItemQuantity(item) {
        if (!item) {
            return 0;
        }

        if (typeof item.getQuantity === 'function') {
            return item.getQuantity();
        }

        return getRawItemQuantity(item.properties);
    },

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
    },

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
    },

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
    },

    mergeThrowableStackQuantities(targetStack, sourceStack) {
        if (!targetStack || !sourceStack) {
            return;
        }

        const nextQuantity = this.getItemQuantity(targetStack) + this.getItemQuantity(sourceStack);
        this.setItemQuantity(targetStack, nextQuantity);
    },

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
    },

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
    },

    dequeueThrowItem(item) {
        if (!item) {
            return null;
        }

        if (this.isStackableItem(item)) {
            return this.consumeThrowableFromStack(item);
        }

        this.removeItem(item);
        return item;
    },

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
    },

    addAlly(enemy) {
        if (!this.allies.includes(enemy)) {
            this.allies.push(enemy);
        }
    },

    removeAlly(enemy) {
        const index = this.allies.indexOf(enemy);
        if (index > -1) {
            this.allies.splice(index, 1);
        }
    },

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
    },

    removeItem(item) {
        const index = this.inventory.indexOf(item);
        if (index > -1) {
            this.inventory.splice(index, 1);
        }
    },

    getInventory() {
        return this.inventory;
    },

    getEquippedItems() {
        return Array.from(this.equipment.entries());
    }
});
