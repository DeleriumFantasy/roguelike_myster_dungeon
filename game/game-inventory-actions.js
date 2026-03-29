// Inventory action resolution helpers
//
// Keep gameplay mutation in game/ so ui/ can stay presentation-focused.

Object.assign(Game.prototype, {
    findWarpDestinationForPlayer() {
        const world = this.world;
        const player = this.player;
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

    useFloorEffectScroll(item) {
        const scrollEffect = typeof item?.getScrollEffect === 'function' ? item.getScrollEffect() : '';

        if (scrollEffect === 'map-floor') {
            this.fov?.showAll?.();
            this.player.removeItem(item);
            return { handled: true, consumed: true, effect: 'map-floor' };
        }

        if (scrollEffect === 'erase-traps') {
            const removedCount = this.world?.removeAllTrapsOnCurrentFloor?.() || 0;
            this.player.removeItem(item);
            return { handled: true, consumed: true, effect: 'erase-traps', removedCount };
        }

        if (scrollEffect === 'warp-player') {
            const destination = this.findWarpDestinationForPlayer();
            if (!destination) {
                return { handled: true, consumed: false, effect: 'warp-player' };
            }

            this.player.x = destination.x;
            this.player.y = destination.y;
            this.player.removeItem(item);
            this.updateFOV?.();
            return {
                handled: true,
                consumed: true,
                effect: 'warp-player',
                destination
            };
        }

        return { handled: false, consumed: false, effect: '' };
    },

    buildImprovementTargetsForPlayer(scrollItem) {
        if (!this.player || typeof scrollItem?.canImproveEquipmentItem !== 'function') {
            return [];
        }

        const targets = [];
        const equippedItems = typeof this.player.getEquippedItems === 'function'
            ? this.player.getEquippedItems()
            : [];

        for (const [slot, equippedItem] of equippedItems) {
            if (!scrollItem.canImproveEquipmentItem(equippedItem)) {
                continue;
            }

            targets.push({
                item: equippedItem,
                locationLabel: `equipped ${slot}`
            });
        }

        const inventoryItems = typeof this.player.getInventory === 'function'
            ? this.player.getInventory()
            : [];

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
        if (!this.player || typeof scrollItem?.canTargetItemForScroll !== 'function') {
            return [];
        }

        const targets = [];
        const equippedItems = typeof this.player.getEquippedItems === 'function'
            ? this.player.getEquippedItems()
            : [];

        for (const [slot, equippedItem] of equippedItems) {
            if (!scrollItem.canTargetItemForScroll(equippedItem)) {
                continue;
            }

            targets.push({
                item: equippedItem,
                locationLabel: `equipped ${slot}`
            });
        }

        const inventoryItems = typeof this.player.getInventory === 'function'
            ? this.player.getInventory()
            : [];

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

    useInventoryItem(item, options = {}) {
        const itemLabel = String(options.itemLabel || getItemLabel(item) || 'item');
        const formatItemLabel = typeof options.formatItemLabel === 'function'
            ? options.formatItemLabel
            : (target) => String(getItemLabel(target) || 'item');
        const chooseTarget = typeof options.chooseTarget === 'function'
            ? options.chooseTarget
            : (_label, targets) => (Array.isArray(targets) && targets.length > 0 ? targets[0].item : null);

        const messages = [];
        const addMessage = (message) => {
            if (typeof message === 'string' && message.length > 0) {
                messages.push(message);
            }
        };

        const floorEffectResult = this.useFloorEffectScroll(item);
        if (floorEffectResult.handled) {
            if (floorEffectResult.effect === 'map-floor' && floorEffectResult.consumed) {
                addMessage(`Used ${itemLabel}.`);
                addMessage('The entire floor is revealed.');
            } else if (floorEffectResult.effect === 'erase-traps' && floorEffectResult.consumed) {
                addMessage(`Used ${itemLabel}.`);
                addMessage(`Erased ${floorEffectResult.removedCount || 0} trap(s) on this floor.`);
            } else if (floorEffectResult.effect === 'warp-player') {
                if (floorEffectResult.consumed && floorEffectResult.destination) {
                    addMessage(`Used ${itemLabel}.`);
                    addMessage(`Warped to ${floorEffectResult.destination.x}, ${floorEffectResult.destination.y}.`);
                } else {
                    addMessage(`Could not use ${itemLabel}.`);
                }
            }

            if (typeof this.player.updateStats === 'function') {
                this.player.updateStats();
            }

            return { handled: true, consumed: floorEffectResult.consumed, messages };
        }

        const isImprovementScroll = typeof item?.isEquipmentImprovementScroll === 'function' && item.isEquipmentImprovementScroll();
        if (isImprovementScroll) {
            const targets = this.buildImprovementTargetsForPlayer(item);
            if (targets.length === 0) {
                addMessage(`No valid equipment can be improved by ${itemLabel}.`);
                return { handled: true, consumed: false, messages };
            }

            const chosenTarget = chooseTarget(itemLabel, targets);
            if (!chosenTarget) {
                return { handled: true, consumed: false, messages };
            }

            const useResult = item.use(this.player, chosenTarget) || { consumed: false };
            if (!useResult?.consumed) {
                addMessage(`Could not use ${itemLabel}`);
            } else {
                const targetLabel = formatItemLabel(useResult.target);
                addMessage(`Used ${itemLabel} on ${targetLabel}.`);
                addMessage(`${targetLabel} is now +${useResult.level}.`);
                this.player.removeItem(item);
            }

            if (typeof this.player.updateStats === 'function') {
                this.player.updateStats();
            }

            return { handled: true, consumed: Boolean(useResult.consumed), messages };
        }

        const hasTargetedScrollEffect = typeof item?.getScrollEffect === 'function'
            && ['add-slot', 'purify-item', 'identify-item', 'add-gilded'].includes(item.getScrollEffect());

        if (hasTargetedScrollEffect) {
            const targets = this.buildGenericScrollTargetsForPlayer(item);
            if (targets.length === 0) {
                addMessage(`No valid target for ${itemLabel}.`);
                return { handled: true, consumed: false, messages };
            }

            const chosenTarget = chooseTarget(itemLabel, targets);
            if (!chosenTarget) {
                return { handled: true, consumed: false, messages };
            }

            const useResult = item.use(this.player, chosenTarget) || { consumed: false };
            if (!useResult?.consumed) {
                addMessage(`Could not use ${itemLabel}`);
            } else {
                const targetLabel = formatItemLabel(useResult.target);
                const effect = useResult.effect;
                addMessage(`Used ${itemLabel} on ${targetLabel}.`);

                if (effect === 'add-slot') {
                    addMessage(`${targetLabel} now has ${useResult.slots} enchantment slot(s).`);
                } else if (effect === 'purify-item') {
                    addMessage(useResult.wasCursed
                        ? `${targetLabel} is no longer cursed.`
                        : `${targetLabel} had no curse, but is now purified.`);
                } else if (effect === 'identify-item') {
                    addMessage(useResult.isCursed
                        ? `${targetLabel} is cursed.`
                        : `${targetLabel} is not cursed.`);
                } else if (effect === 'add-gilded') {
                    addMessage(`${targetLabel} is now gilded.`);
                }

                this.player.removeItem(item);
            }

            if (typeof this.player.updateStats === 'function') {
                this.player.updateStats();
            }

            return { handled: true, consumed: Boolean(useResult.consumed), messages };
        }

        const useResult = item.use(this.player) || { consumed: true };
        if (useResult.consumed !== false) {
            this.player.removeItem(item);
            addMessage(`Used ${itemLabel}`);
        }

        if (typeof this.player.updateStats === 'function') {
            this.player.updateStats();
        }

        return { handled: true, consumed: useResult.consumed !== false, messages };
    },

    unequipPlayerInventorySlot(slot, item, options = {}) {
        const formatItemLabel = typeof options.formatItemLabel === 'function'
            ? options.formatItemLabel
            : (target) => String(getItemLabel(target) || 'item');
        const itemLabel = formatItemLabel(item);

        const unequipped = this.player.unequipSlot(slot);
        if (unequipped) {
            return { success: true, messages: [`Unequipped ${itemLabel}`] };
        }

        return { success: false, messages: [`${itemLabel} is cursed and cannot be unequipped`] };
    },

    unequipAllyInventorySlot(ally, slot, item, options = {}) {
        const formatItemLabel = typeof options.formatItemLabel === 'function'
            ? options.formatItemLabel
            : (target) => String(getItemLabel(target) || 'item');
        const itemLabel = formatItemLabel(item);

        if (!ally || typeof ally.unequipSlot !== 'function') {
            return { success: false, messages: [`Could not unequip ${itemLabel}`] };
        }

        const unequipped = ally.unequipSlot(slot);
        if (!unequipped) {
            return { success: false, messages: [`${ally.name} cannot unequip ${itemLabel}`] };
        }

        if (typeof this.player?.addItem === 'function') {
            this.player.addItem(item);
        }

        return { success: true, messages: [`${ally.name} unequipped ${itemLabel}`] };
    },

    equipInventoryItem(item, equipTarget, options = {}) {
        const formatItemLabel = typeof options.formatItemLabel === 'function'
            ? options.formatItemLabel
            : (target) => String(getItemLabel(target) || 'item');

        let equipped = false;
        let replacedItem = null;

        if (equipTarget.kind === 'player') {
            equipped = item.equip(this.player);
        } else {
            const equipResult = this.player.equipItemOnAlly(equipTarget.ally, item);
            equipped = Boolean(equipResult?.success);
            replacedItem = equipResult?.replacedItem || null;
        }

        if (!equipped) {
            if (equipTarget.kind === 'player') {
                return {
                    success: false,
                    replacedItem: null,
                    messages: [`Could not equip ${formatItemLabel(item)}`]
                };
            }

            return {
                success: false,
                replacedItem: null,
                messages: [`${equipTarget.ally.name} could not equip ${formatItemLabel(item)}`]
            };
        }

        this.player.removeItem(item);

        if (equipTarget.kind === 'player') {
            return {
                success: true,
                replacedItem: null,
                messages: [`Equipped ${formatItemLabel(item)}`]
            };
        }

        const messages = [`Equipped ${formatItemLabel(item)} on ${equipTarget.ally.name}.`];
        if (replacedItem) {
            messages.push(`${equipTarget.ally.name} returned ${formatItemLabel(replacedItem)} to your inventory.`);
        }

        return {
            success: true,
            replacedItem,
            messages
        };
    },

    dropInventoryItem(item, options = {}) {
        const formatItemLabel = typeof options.formatItemLabel === 'function'
            ? options.formatItemLabel
            : (target) => String(getItemLabel(target) || 'item');
        const itemLabel = formatItemLabel(item);

        this.player.removeItem(item);
        const dropResult = this.world.addItem(this.player.x, this.player.y, item);
        if (dropResult?.burned) {
            return { burned: true, messages: [`${itemLabel} burns up in lava.`] };
        }

        return { burned: false, messages: [`Dropped ${itemLabel}`] };
    }
});
