// Player inventory, equipment, and ally helpers

Object.assign(Player.prototype, {
    getMaxInventoryItems() {
        const configuredLimit = Number(this.maxInventoryItems);
        return Number.isFinite(configuredLimit) && configuredLimit > 0
            ? Math.floor(configuredLimit)
            : 30;
    },

    getBackpackItems() {
        return Array.isArray(this.inventory) ? this.inventory : [];
    },

    getBackpackItemCount() {
        return this.getBackpackItems().length;
    },

    getEquippedInventoryItemCount() {
        return this.equipment instanceof Map ? this.equipment.size : 0;
    },

    getTotalCarriedItemCount() {
        return this.getBackpackItemCount() + this.getEquippedInventoryItemCount();
    },

    getInventoryItemCount() {
        return this.getTotalCarriedItemCount();
    },

    hasInventorySpaceFor(item = null, options = {}) {
        if (item?.type === ITEM_TYPES.MONEY) {
            return true;
        }

        if (item && this.isStackableItem(item) && this.findMatchingThrowableStack(item)) {
            return true;
        }

        const reservedSlots = Math.max(0, Math.floor(Number(options?.reservedSlots) || 0));
        const effectiveCount = Math.max(0, this.getInventoryItemCount() - reservedSlots);
        return effectiveCount < this.getMaxInventoryItems();
    },

    equipItem(item) {
        if (!item || !isEquippableItemType(item.type)) {
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
        this.addItem(item);
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
        return !getItemCursedState(item);
    },

    getEquippedStatTotal(propertyKey, enchantmentMethodName) {
        const baseTotal = getActorEquipmentPropertyTotal(this, propertyKey);
        if (!enchantmentMethodName) {
            return baseTotal;
        }

        return baseTotal + this.getEquipmentNumericSum(enchantmentMethodName);
    },

    updateStats() {
        this.power = Math.max(1, Number(this.level) || 1) + this.getEquippedStatTotal('power', 'getEnchantmentPowerBonus');
        this.armor = this.getEquippedStatTotal('armor', 'getEnchantmentArmorBonus');

        const setStatBonuses = typeof this.getEquipmentSetStatBonuses === 'function'
            ? this.getEquipmentSetStatBonuses()
            : { powerBonus: 0, armorBonus: 0 };
        this.power += Math.max(0, Number(setStatBonuses.powerBonus || 0));
        this.armor += Math.max(0, Number(setStatBonuses.armorBonus || 0));

        this.applyEquipmentGrantedConditions();
    },

    isStackableItem(item) {
        return Boolean(item) && item.type === ITEM_TYPES.THROWABLE;
    },

    getMoneyItemValue(item) {
        const configuredValue = Number(item?.properties?.value);
        if (Number.isFinite(configuredValue) && configuredValue > 0) {
            return Math.max(1, Math.floor(configuredValue));
        }

        const minValue = Number(item?.properties?.valueMin);
        const maxValue = Number(item?.properties?.valueMax);
        if (Number.isFinite(minValue) || Number.isFinite(maxValue)) {
            const fallbackValue = Number.isFinite(maxValue) ? maxValue : minValue;
            return Math.max(1, Math.floor(fallbackValue));
        }

        return 1;
    },

    collectMoneyItem(item) {
        if (!item || item.type !== ITEM_TYPES.MONEY) {
            return 0;
        }

        const value = this.getMoneyItemValue(item);
        this.money = Math.max(0, Math.floor(Number(this.money) || 0)) + value;
        return value;
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

        return this.getBackpackItems().find((existingItem) => {
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
            return false;
        }

        if (item.type === ITEM_TYPES.MONEY) {
            this.collectMoneyItem(item);
            return true;
        }

        if (this.isStackableItem(item)) {
            const existingStack = this.findMatchingThrowableStack(item);
            if (existingStack) {
                this.mergeThrowableStackQuantities(existingStack, item);
                return true;
            }

            this.setItemQuantity(item, this.getItemQuantity(item));
        }

        if (!this.hasInventorySpaceFor(item)) {
            return false;
        }

        this.inventory.push(item);
        return true;
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
        if (!item || !isEquippableItemType(item.type)) {
            return { success: false, reason: 'item cannot be equipped' };
        }

        const replacedItem = ally.equipment?.get?.(item.type) || null;
        const reservedSlots = this.getBackpackItems().includes(item) ? 1 : 0;
        if (replacedItem && replacedItem !== item && !this.hasInventorySpaceFor(replacedItem, { reservedSlots })) {
            return { success: false, reason: 'inventory full for replaced item', replacedItem };
        }

        const equipped = typeof ally.equipItem === 'function' ? ally.equipItem(item) : false;
        if (equipped) {
            if (typeof item.identify === 'function') {
                item.identify();
            }

            if (replacedItem && replacedItem !== item) {
                const added = this.addItem(replacedItem);
                if (!added) {
                    return { success: false, reason: 'inventory full for replaced item', replacedItem };
                }
            }
        }

        return {
            success: Boolean(equipped),
            reason: equipped ? 'ok' : 'ally cannot equip item',
            replacedItem
        };
    },

    removeItem(item) {
        const index = this.inventory.indexOf(item);
        if (index > -1) {
            this.inventory.splice(index, 1);
        }
    },

    getInventory() {
        return this.getBackpackItems();
    },

    getEquippedItems() {
        return Array.from(this.equipment.entries());
    }
});
