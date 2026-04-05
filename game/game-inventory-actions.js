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

    buildPlayerInventoryTargets(predicate, options = {}) {
        if (!this.player || typeof predicate !== 'function') {
            return [];
        }

        const includeEquipped = options.includeEquipped !== false;
        const includeInventory = options.includeInventory !== false;
        const excludedItems = new Set(
            Array.isArray(options.excludeItems)
                ? options.excludeItems.filter(Boolean)
                : []
        );
        const targets = [];

        if (includeEquipped) {
            const equippedItems = typeof this.player.getEquippedItems === 'function'
                ? this.player.getEquippedItems()
                : [];

            for (const [slot, equippedItem] of equippedItems) {
                if (!equippedItem || excludedItems.has(equippedItem) || !predicate(equippedItem, { source: 'equipped', slot })) {
                    continue;
                }

                targets.push({
                    item: equippedItem,
                    locationLabel: `equipped ${slot}`
                });
            }
        }

        if (includeInventory) {
            const inventoryItems = typeof this.player.getInventory === 'function'
                ? this.player.getInventory()
                : [];

            for (const inventoryItem of inventoryItems) {
                if (!inventoryItem || excludedItems.has(inventoryItem) || !predicate(inventoryItem, { source: 'inventory' })) {
                    continue;
                }

                targets.push({
                    item: inventoryItem,
                    locationLabel: 'backpack'
                });
            }
        }

        return targets;
    },

    buildImprovementTargetsForPlayer(scrollItem) {
        if (typeof scrollItem?.canImproveEquipmentItem !== 'function') {
            return [];
        }

        return this.buildPlayerInventoryTargets(
            (candidate) => scrollItem.canImproveEquipmentItem(candidate),
            { excludeItems: [scrollItem] }
        );
    },

    buildGenericScrollTargetsForPlayer(scrollItem) {
        if (typeof scrollItem?.canTargetItemForScroll !== 'function') {
            return [];
        }

        return this.buildPlayerInventoryTargets(
            (candidate) => scrollItem.canTargetItemForScroll(candidate),
            { excludeItems: [scrollItem] }
        );
    },

    buildPotTargetsForPlayer(potItem) {
        return this.buildPlayerInventoryTargets(
            (candidate) => candidate !== potItem && !candidate?.properties?.shopUnpaid,
            {
                includeEquipped: false,
                excludeItems: [potItem]
            }
        );
    },

    buildPotStorageMessage(potType, targetLabel, transformedItem, transformedLabel, potLabel) {
        if (potType === 'banking') {
            return `${targetLabel} is banked by ${potLabel}.`;
        }

        if (potType === 'money') {
            const moneyValue = typeof this.getValidMoneyValue === 'function'
                ? this.getValidMoneyValue(transformedItem)
                : Math.max(1, Math.floor(Number(transformedItem?.properties?.value) || 1));
            return `${targetLabel} turns into ${moneyValue} money inside ${potLabel}.`;
        }

        if (potType === 'food') {
            return `${targetLabel} changes into ${transformedLabel} inside ${potLabel}.`;
        }

        if (potType === 'randomizer') {
            return `${targetLabel} is randomized into ${transformedLabel} inside ${potLabel}.`;
        }

        return `Placed ${targetLabel} into ${potLabel}.`;
    },

    storeInventoryItemInPot(potItem, targetItem, options = {}) {
        const potLabel = String(options.potLabel || getItemLabel(potItem) || 'pot');
        const formatItemLabel = typeof options.formatItemLabel === 'function'
            ? options.formatItemLabel
            : (value) => String(getItemLabel(value) || 'item');

        if (!potItem?.isPotItem?.() || !targetItem || targetItem === potItem) {
            return { stored: false, messages: [`Could not place an item into ${potLabel}.`] };
        }

        if (targetItem?.properties?.shopUnpaid) {
            return { stored: false, messages: [`You can't hide unpaid shop goods inside ${potLabel}.`] };
        }

        if (potItem?.isPotFull?.()) {
            return { stored: false, messages: [`${potLabel} is full.`] };
        }

        const transformedItem = typeof transformItemForPot === 'function'
            ? transformItemForPot(targetItem, potItem, {
                floorIndex: this.world?.currentFloor,
                rng: createMathRng()
            })
            : targetItem;

        if (!transformedItem) {
            return { stored: false, messages: [`Could not place ${formatItemLabel(targetItem)} into ${potLabel}.`] };
        }

        this.player.removeItem(targetItem);

        const targetLabel = formatItemLabel(targetItem);
        const transformedLabel = formatItemLabel(transformedItem);
        const potType = potItem.getPotType?.() || 'basic';

        if (potType === 'banking') {
            this.player.bankItems = Array.isArray(this.player.bankItems) ? this.player.bankItems : [];
            const spaceUsed = typeof potItem.consumePotSpace === 'function' ? potItem.consumePotSpace(1) : 0;
            if (spaceUsed <= 0) {
                this.player.addItem(targetItem);
                return { stored: false, messages: [`${potLabel} is full.`] };
            }

            this.player.bankItems.push(transformedItem);
            return {
                stored: true,
                transformedItem,
                messages: [this.buildPotStorageMessage(potType, targetLabel, transformedItem, transformedLabel, potLabel)]
            };
        }

        const storeResult = potItem.storeItemInPot(transformedItem);
        if (!storeResult?.stored) {
            this.player.addItem(targetItem);
            if (storeResult?.reason === 'full') {
                return { stored: false, messages: [`${potLabel} is full.`] };
            }
            return { stored: false, messages: [`Could not place ${formatItemLabel(targetItem)} into ${potLabel}.`] };
        }

        return {
            stored: true,
            transformedItem,
            messages: [this.buildPotStorageMessage(potType, targetLabel, transformedItem, transformedLabel, potLabel)]
        };
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

        if (item?.type === ITEM_TYPES.POT) {
            if (item?.isPotFull?.()) {
                addMessage(`${itemLabel} is full.`);
                return { handled: true, consumed: false, messages };
            }

            const targets = this.buildPotTargetsForPlayer(item);
            if (targets.length === 0) {
                addMessage(`No valid item can be placed into ${itemLabel}.`);
                return { handled: true, consumed: false, messages };
            }

            const chosenTarget = chooseTarget(itemLabel, targets, {
                header: `Choose item to place into ${itemLabel}:`,
                defaultValue: '1'
            });
            if (!chosenTarget) {
                return { handled: true, consumed: false, messages };
            }

            const storageResult = this.storeInventoryItemInPot(item, chosenTarget, {
                potLabel: itemLabel,
                formatItemLabel
            });
            for (const message of storageResult.messages || []) {
                addMessage(message);
            }

            if (typeof this.player.updateStats === 'function') {
                this.player.updateStats();
            }

            return { handled: true, consumed: false, messages };
        }

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
        const standingOnShopTile = this.world.getTile(this.player.x, this.player.y) === TILE_TYPES.SHOP;
        const shopkeeper = standingOnShopTile && typeof this.getActiveShopkeeper === 'function'
            ? this.getActiveShopkeeper()
            : null;

        this.player.removeItem(item);
        const dropResult = this.world.addItem(this.player.x, this.player.y, item);
        if (dropResult?.burned) {
            return { burned: true, messages: [`${itemLabel} burns up in lava.`] };
        }

        if (!dropResult?.placed) {
            this.player.addItem(item);
            return { burned: false, messages: [`Could not drop ${itemLabel}.`] };
        }

        const droppedFromShopArea = Boolean(shopkeeper && standingOnShopTile);

        item.properties = item.properties || {};

        if (droppedFromShopArea && item.properties.shopUnpaid) {
            item.properties.shopOwned = true;
            item.properties.shopUnpaid = false;
            item.properties.shopPrice = this.getShopItemPrice(item);
            delete item.properties.shopPendingSale;
            delete item.properties.shopSellPrice;
            return { burned: false, messages: [`You set down ${itemLabel} to return it to ${shopkeeper.name}.`] };
        }

        if (droppedFromShopArea) {
            item.properties.shopPendingSale = true;
            item.properties.shopSellPrice = this.getShopSellPrice(item);
            return { burned: false, messages: [`Set down ${itemLabel} for sale to ${shopkeeper.name}. Talk to them to finalize the deal.`] };
        }

        delete item.properties.shopPendingSale;
        delete item.properties.shopSellPrice;
        return { burned: false, messages: [`Dropped ${itemLabel}`] };
    }
});
