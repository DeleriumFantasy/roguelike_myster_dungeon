// UI inventory helpers

Object.assign(UI.prototype, {
    refreshUiAfterInventoryMutation() {
        if (!this.game || !this.game.world || !this.game.player || !this.game.fov) {
            return;
        }

        this.render(this.game.world, this.game.player, this.game.fov);
    },

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
            if (typeof item?.properties?.scrollEffect === 'string') {
                return 'statusconsumable';
            }
            if (Array.isArray(item?.properties?.improvesItemTypes)) {
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
        const itemLabel = this.formatInventoryItemLabel(item);
        if (unequipped) {
            this.addMessage(`Unequipped ${itemLabel}`);
        } else {
            this.addMessage(`${itemLabel} is cursed and cannot be unequipped`);
        }

        this.refreshUiAfterInventoryMutation();
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
            const useResult = this.tryUseInventoryItem(item, itemLabel);
            if (!useResult?.handled) {
                this.addMessage(`Could not use ${itemLabel}`);
            }
            this.refreshUiAfterInventoryMutation();
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'equip') {
            const equipped = item.equip(this.game.player);
            if (equipped) {
                this.game.player.removeItem(item);
                this.addMessage(`Equipped ${this.formatInventoryItemLabel(item)}`);
            } else {
                this.addMessage(`Could not equip ${itemLabel}`);
            }
            this.refreshUiAfterInventoryMutation();
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
            this.refreshUiAfterInventoryMutation();
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

    buildImprovementTargetsForPlayer(scrollItem) {
        const player = this.game?.player;
        if (!player || typeof scrollItem?.canImproveEquipmentItem !== 'function') {
            return [];
        }

        const targets = [];
        const equippedItems = typeof player.getEquippedItems === 'function' ? player.getEquippedItems() : [];
        for (const [slot, equippedItem] of equippedItems) {
            if (!scrollItem.canImproveEquipmentItem(equippedItem)) {
                continue;
            }

            targets.push({
                item: equippedItem,
                locationLabel: `equipped ${slot}`
            });
        }

        const inventoryItems = typeof player.getInventory === 'function' ? player.getInventory() : [];
        for (const inventoryItem of inventoryItems) {
            if (inventoryItem === scrollItem || !scrollItem.canImproveEquipmentItem(inventoryItem)) {
                continue;
            }

            targets.push({
                item: inventoryItem,
                locationLabel: 'backpack'
            });
        }

        return targets;
    },

    buildGenericScrollTargetsForPlayer(scrollItem) {
        const player = this.game?.player;
        if (!player || typeof scrollItem?.canTargetItemForScroll !== 'function') {
            return [];
        }

        const targets = [];
        const equippedItems = typeof player.getEquippedItems === 'function' ? player.getEquippedItems() : [];
        for (const [slot, equippedItem] of equippedItems) {
            if (!scrollItem.canTargetItemForScroll(equippedItem)) {
                continue;
            }

            targets.push({
                item: equippedItem,
                locationLabel: `equipped ${slot}`
            });
        }

        const inventoryItems = typeof player.getInventory === 'function' ? player.getInventory() : [];
        for (const inventoryItem of inventoryItems) {
            if (inventoryItem === scrollItem || !scrollItem.canTargetItemForScroll(inventoryItem)) {
                continue;
            }

            targets.push({
                item: inventoryItem,
                locationLabel: 'backpack'
            });
        }

        return targets;
    },

    promptForImprovementTarget(scrollLabel, targets) {
        if (!Array.isArray(targets) || targets.length === 0) {
            return null;
        }

        const optionsText = targets
            .map((entry, index) => `${index + 1}. ${this.formatInventoryItemLabel(entry.item)} (${entry.locationLabel})`)
            .join('\n');
        const response = window.prompt(`Choose equipment to improve with ${scrollLabel}:\n${optionsText}`, '1');
        if (!response) {
            return null;
        }

        const selectedIndex = Number.parseInt(response.trim(), 10) - 1;
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= targets.length) {
            this.addMessage('Invalid selection.');
            return null;
        }

        return targets[selectedIndex].item;
    },

    announceImprovementUse(itemLabel, useResult) {
        if (!useResult?.consumed) {
            this.addMessage(`Could not use ${itemLabel}`);
            return;
        }

        const targetLabel = this.formatInventoryItemLabel(useResult.target);
        this.addMessage(`Used ${itemLabel} on ${targetLabel}.`);
        this.addMessage(`${targetLabel} is now +${useResult.level}.`);
    },

    announceGenericScrollUse(itemLabel, useResult) {
        if (!useResult?.consumed) {
            this.addMessage(`Could not use ${itemLabel}`);
            return;
        }

        const targetLabel = this.formatInventoryItemLabel(useResult.target);
        const effect = useResult.effect;

        if (effect === 'add-slot') {
            this.addMessage(`Used ${itemLabel} on ${targetLabel}.`);
            this.addMessage(`${targetLabel} now has ${useResult.slots} enchantment slot(s).`);
            return;
        }

        if (effect === 'purify-item') {
            this.addMessage(`Used ${itemLabel} on ${targetLabel}.`);
            this.addMessage(useResult.wasCursed
                ? `${targetLabel} is no longer cursed.`
                : `${targetLabel} had no curse, but is now purified.`);
            return;
        }

        if (effect === 'identify-item') {
            this.addMessage(`Used ${itemLabel} on ${targetLabel}.`);
            this.addMessage(useResult.isCursed
                ? `${targetLabel} is cursed.`
                : `${targetLabel} is not cursed.`);
            return;
        }

        if (effect === 'add-gilded') {
            this.addMessage(`Used ${itemLabel} on ${targetLabel}.`);
            this.addMessage(`${targetLabel} is now gilded.`);
            return;
        }

        this.addMessage(`Used ${itemLabel} on ${targetLabel}.`);
    },

    findWarpDestinationForPlayer() {
        const world = this.game?.world;
        const player = this.game?.player;
        if (!world || !player || typeof world.canPlayerOccupy !== 'function') {
            return null;
        }

        const minDistance = Math.max(6, Math.floor(GRID_SIZE * 0.25));
        for (let attempt = 0; attempt < 300; attempt++) {
            const x = randomInt(1, GRID_SIZE - 2);
            const y = randomInt(1, GRID_SIZE - 2);
            if (!world.canPlayerOccupy(x, y)) {
                continue;
            }

            const distance = Math.abs(x - player.x) + Math.abs(y - player.y);
            if (distance < minDistance) {
                continue;
            }

            return { x, y };
        }

        return null;
    },

    useFloorEffectScroll(item, itemLabel) {
        const scrollEffect = typeof item?.getScrollEffect === 'function' ? item.getScrollEffect() : '';

        if (scrollEffect === 'map-floor') {
            this.game.fov?.showAll?.();
            this.game.player.removeItem(item);
            this.addMessage(`Used ${itemLabel}.`);
            this.addMessage('The entire floor is revealed.');
            return { handled: true, consumed: true };
        }

        if (scrollEffect === 'erase-traps') {
            const removedCount = this.game.world?.removeAllTrapsOnCurrentFloor?.() || 0;
            this.game.player.removeItem(item);
            this.addMessage(`Used ${itemLabel}.`);
            this.addMessage(`Erased ${removedCount} trap(s) on this floor.`);
            return { handled: true, consumed: true };
        }

        if (scrollEffect === 'warp-player') {
            const destination = this.findWarpDestinationForPlayer();
            if (!destination) {
                this.addMessage(`Could not use ${itemLabel}.`);
                return { handled: true, consumed: false };
            }

            this.game.player.x = destination.x;
            this.game.player.y = destination.y;
            this.game.player.removeItem(item);
            this.game.updateFOV?.();
            this.addMessage(`Used ${itemLabel}.`);
            this.addMessage(`Warped to ${destination.x}, ${destination.y}.`);
            return { handled: true, consumed: true };
        }

        return null;
    },

    tryUseInventoryItem(item, itemLabel) {
        const floorEffectResult = this.useFloorEffectScroll(item, itemLabel);
        if (floorEffectResult) {
            if (typeof this.game.player.updateStats === 'function') {
                this.game.player.updateStats();
            }
            return floorEffectResult;
        }

        const isImprovementScroll = typeof item?.isEquipmentImprovementScroll === 'function' && item.isEquipmentImprovementScroll();
        if (isImprovementScroll) {
            const targets = this.buildImprovementTargetsForPlayer(item);
            if (targets.length === 0) {
                this.addMessage(`No valid equipment can be improved by ${itemLabel}.`);
                return { handled: true, consumed: false };
            }

            const chosenTarget = this.promptForImprovementTarget(itemLabel, targets);
            if (!chosenTarget) {
                return { handled: true, consumed: false };
            }

            const useResult = item.use(this.game.player, chosenTarget) || { consumed: false };
            this.announceImprovementUse(itemLabel, useResult);
            if (useResult.consumed) {
                this.game.player.removeItem(item);
            }

            if (typeof this.game.player.updateStats === 'function') {
                this.game.player.updateStats();
            }

            return { handled: true, consumed: Boolean(useResult.consumed) };
        }

        const hasTargetedScrollEffect = typeof item?.getScrollEffect === 'function'
            && ['add-slot', 'purify-item', 'identify-item', 'add-gilded'].includes(item.getScrollEffect());
        if (hasTargetedScrollEffect) {
            const targets = this.buildGenericScrollTargetsForPlayer(item);
            if (targets.length === 0) {
                this.addMessage(`No valid target for ${itemLabel}.`);
                return { handled: true, consumed: false };
            }

            const chosenTarget = this.promptForImprovementTarget(itemLabel, targets);
            if (!chosenTarget) {
                return { handled: true, consumed: false };
            }

            const useResult = item.use(this.game.player, chosenTarget) || { consumed: false };
            this.announceGenericScrollUse(itemLabel, useResult);
            if (useResult.consumed) {
                this.game.player.removeItem(item);
            }

            if (typeof this.game.player.updateStats === 'function') {
                this.game.player.updateStats();
            }

            return { handled: true, consumed: Boolean(useResult.consumed) };
        }

        const useResult = item.use(this.game.player) || { consumed: true };
        if (useResult.consumed !== false) {
            this.game.player.removeItem(item);
            this.addMessage(`Used ${itemLabel}`);
        }

        if (typeof this.game.player.updateStats === 'function') {
            this.game.player.updateStats();
        }

        return { handled: true, consumed: useResult.consumed !== false };
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
