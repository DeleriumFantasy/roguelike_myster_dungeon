// UI inventory helpers

Object.assign(UI.prototype, {
    createInventoryListItem(text, onClick = null, textColor = null) {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.textContent = text;
        if (textColor) {
            div.style.color = textColor;
        }
        if (typeof onClick === 'function') {
            div.onclick = onClick;
        }
        return div;
    },

    reopenInventoryForCurrentPlayer() {
        this.openInventory(this.game.player);
    },

    openInventory(player) {
        this.game.inventoryOpen = true;
        const list = this.inventoryModal.querySelector('#inventory-list');
        list.innerHTML = '';

        list.appendChild(this.createInventoryListItem('Equipped'));

        const equippedItems = typeof player.getEquippedItems === 'function' ? player.getEquippedItems() : [];
        if (equippedItems.length === 0) {
            list.appendChild(this.createInventoryListItem('(none)'));
        } else {
            for (const [slot, item] of equippedItems) {
                const displayName = `[${slot}] ${this.formatInventoryItemLabel(item)}`;
                list.appendChild(this.createInventoryListItem(
                    displayName,
                    () => this.handleEquippedItemClick(slot, item),
                    getItemTypeColor(item?.type)
                ));
            }
        }

        list.appendChild(this.createInventoryListItem('Backpack'));

        const sortedInventory = this.sortInventoryForDisplay(player.getInventory());
        sortedInventory.forEach((item) => {
            const displayName = this.formatInventoryItemLabel(item);
            list.appendChild(this.createInventoryListItem(
                displayName,
                () => this.handleInventoryClick(item),
                getItemTypeColor(item?.type)
            ));
        });
        this.inventoryModal.style.display = 'block';
    },

    sortInventoryForDisplay(inventory) {
        if (!Array.isArray(inventory) || inventory.length === 0) {
            return [];
        }

        const categoryOrder = [
            'healing',
            'food',
            'throwable',
            'statusconsumable',
            'accessory',
            'weapon',
            'armor',
            'shield'
        ];
        const categoryRank = new Map(categoryOrder.map((category, index) => [category, index]));

        return inventory
            .map((item, index) => ({ item, index }))
            .sort((left, right) => {
                const leftCategory = this.getInventorySortCategory(left.item);
                const rightCategory = this.getInventorySortCategory(right.item);
                const leftRank = categoryRank.has(leftCategory) ? categoryRank.get(leftCategory) : Number.MAX_SAFE_INTEGER;
                const rightRank = categoryRank.has(rightCategory) ? categoryRank.get(rightCategory) : Number.MAX_SAFE_INTEGER;

                if (leftRank !== rightRank) {
                    return leftRank - rightRank;
                }

                const leftName = String(getItemLabel(left.item) || '').toLowerCase();
                const rightName = String(getItemLabel(right.item) || '').toLowerCase();
                const byName = leftName.localeCompare(rightName);
                if (byName !== 0) {
                    return byName;
                }

                return left.index - right.index;
            })
            .map((entry) => entry.item);
    },

    getInventorySortCategory(item) {
        const type = item?.type;
        if (type === ITEM_TYPES.THROWABLE) {
            return 'throwable';
        }
        if (type === ITEM_TYPES.ACCESSORY) {
            return 'accessory';
        }
        if (type === ITEM_TYPES.WEAPON) {
            return 'weapon';
        }
        if (type === ITEM_TYPES.ARMOR) {
            return 'armor';
        }
        if (type === ITEM_TYPES.SHIELD) {
            return 'shield';
        }

        if (type === ITEM_TYPES.CONSUMABLE) {
            if (Number.isFinite(item?.properties?.health)) {
                return 'healing';
            }
            if (Number.isFinite(item?.properties?.hunger)) {
                return 'food';
            }
            if (item?.properties?.condition) {
                return 'statusconsumable';
            }
        }

        return '';
    },

    closeInventory() {
        this.game.inventoryOpen = false;
        this.inventoryModal.style.display = 'none';
    },

    handleEquippedItemClick(slot, item) {
        const unequipped = this.game.player.unequipSlot(slot);
        if (unequipped) {
            this.addMessage(`Unequipped ${item.name}`);
        } else {
            this.addMessage(`${item.name} is cursed and cannot be unequipped`);
        }

        this.reopenInventoryForCurrentPlayer();
    },

    handleInventoryClick(item) {
        const itemLabel = this.formatInventoryItemLabel(item);
        const actions = this.getAvailableInventoryActions(item);
        const choice = this.promptForInventoryAction(itemLabel, actions);
        if (!choice) {
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'use') {
            item.use(this.game.player);
            this.game.player.removeItem(item);
            this.addMessage(`Used ${itemLabel}`);
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'equip') {
            const equipped = item.equip(this.game.player);
            if (equipped) {
                this.game.player.removeItem(item);
                this.addMessage(`Equipped ${item.name}`);
            } else {
                this.addMessage(`Could not equip ${itemLabel}`);
            }
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'throw') {
            this.closeInventory();
            this.game.beginThrowMode(item);
            return;
        }

        if (choice === 'drop') {
            this.game.player.removeItem(item);
            const dropResult = this.game.world.addItem(this.game.player.x, this.game.player.y, item);
            if (dropResult?.burned) {
                this.addMessage(`${itemLabel} burns up in lava.`);
            } else {
                this.addMessage(`Dropped ${itemLabel}`);
            }
            this.reopenInventoryForCurrentPlayer();
        }
    },

    pluralizeItemLabel(label) {
        const name = String(label || '').trim();
        if (!name) {
            return name;
        }

        if (/[^aeiou]y$/i.test(name)) {
            return `${name.slice(0, -1)}ies`;
        }

        if (/(s|x|z|ch|sh)$/i.test(name)) {
            return `${name}es`;
        }

        return `${name}s`;
    },

    formatInventoryItemLabel(item) {
        const baseLabel = getItemLabel(item);
        const identified = typeof item.isIdentified === 'function' ? item.isIdentified() : true;
        const cursed = typeof item.isCursed === 'function' ? item.isCursed() : Boolean(item?.properties?.cursed);
        const quantity = typeof item.getQuantity === 'function' ? item.getQuantity() : 1;

        let label = baseLabel;
        if (item?.type === ITEM_TYPES.THROWABLE && quantity > 1) {
            label = `${this.pluralizeItemLabel(baseLabel)} x${quantity}`;
        }

        if (identified && cursed) {
            label = `${label} *cursed`;
        }

        return label;
    },

    getAvailableInventoryActions(item) {
        return getInventoryActionsForItemType(item?.type);
    },

    promptForInventoryAction(itemLabel, actions) {
        const optionsText = actions.join('/');
        const response = window.prompt(`Choose action for ${itemLabel}: ${optionsText}`, actions[0]);
        if (!response) {
            return null;
        }

        const normalized = response.trim().toLowerCase();
        if (!actions.includes(normalized)) {
            this.addMessage(`Invalid action. Choose one of: ${optionsText}`);
            return null;
        }

        return normalized;
    }
});
