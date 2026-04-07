// Inventory action resolution helpers
//
// Keep gameplay mutation in game/ so ui/ can stay presentation-focused.

const FLOOR_SCROLL_EFFECT_HANDLERS = Object.freeze({
    'map-floor': (game, item) => {
        game.fov?.showAll?.();
        game.player.removeItem(item);
        return { handled: true, consumed: true, effect: 'map-floor' };
    },
    'erase-traps': (game, item) => {
        const removedCount = game.world?.removeAllTrapsOnCurrentFloor?.() || 0;
        game.player.removeItem(item);
        return { handled: true, consumed: true, effect: 'erase-traps', removedCount };
    },
    'warp-player': (game, item) => {
        const destination = game.findWarpDestinationForPlayer();
        if (!destination) {
            return { handled: true, consumed: false, effect: 'warp-player' };
        }

        game.player.x = destination.x;
        game.player.y = destination.y;
        game.player.removeItem(item);
        game.updateFOV?.();
        return {
            handled: true,
            consumed: true,
            effect: 'warp-player',
            destination
        };
    }
});

Object.assign(Game.prototype, {
    tryAddItemToPlayerInventory(item, options = {}) {
        if (!item || !this.player || typeof this.player.addItem !== 'function') {
            return { added: false, dropped: false, reason: 'unavailable' };
        }

        if (this.player.addItem(item)) {
            return { added: true, dropped: false, reason: 'added' };
        }

        if (options.dropIfFull && this.world && this.player) {
            const dropResult = this.world.addItem(this.player.x, this.player.y, item);
            if (dropResult?.placed || dropResult?.burned) {
                return {
                    added: false,
                    dropped: Boolean(dropResult?.placed),
                    burned: Boolean(dropResult?.burned),
                    reason: 'inventory-full'
                };
            }
        }

        return { added: false, dropped: false, reason: 'inventory-full' };
    },

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
        const handler = FLOOR_SCROLL_EFFECT_HANDLERS[scrollEffect];
        return typeof handler === 'function'
            ? handler(this, item)
            : { handled: false, consumed: false, effect: '' };
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
            const inventoryItems = this.getPlayerInventoryItems();

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
            (candidate) => candidate !== potItem
                && !candidate?.properties?.shopUnpaid
                && !candidate?.isPotItem?.(),
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

        if (targetItem?.isPotItem?.()) {
            return { stored: false, messages: ["Pots can't contain other pots."] };
        }

        if (targetItem?.properties?.shopUnpaid) {
            return { stored: false, messages: [`You can't hide unpaid shop goods inside ${potLabel}.`] };
        }

        if (targetItem?.properties?.questReturnOnly || targetItem?.properties?.questDeliveryOnly) {
            const blockedMessage = typeof targetItem?.properties?.storageBlockMessage === 'string'
                ? targetItem.properties.storageBlockMessage
                : (targetItem?.properties?.questReturnOnly
                    ? `${formatItemLabel(targetItem)} must be brought back to the Questgiver.`
                    : `${formatItemLabel(targetItem)} must stay with you for its quest.`);
            return { stored: false, messages: [blockedMessage] };
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

    createInventoryUseContext(item, options = {}) {
        return {
            item,
            itemLabel: String(options.itemLabel || getItemLabel(item) || 'item'),
            formatItemLabel: typeof options.formatItemLabel === 'function'
                ? options.formatItemLabel
                : (target) => String(getItemLabel(target) || 'item'),
            chooseTarget: typeof options.chooseTarget === 'function'
                ? options.chooseTarget
                : (_label, targets) => (Array.isArray(targets) && targets.length > 0 ? targets[0].item : null),
            messages: []
        };
    },

    pushInventoryUseMessage(context, message) {
        if (typeof message === 'string' && message.length > 0) {
            context.messages.push(message);
        }
    },

    finalizeInventoryUse(context, consumed = false, handled = true) {
        if (typeof this.player?.updateStats === 'function') {
            this.player.updateStats();
        }

        return {
            handled,
            consumed,
            messages: context.messages
        };
    },

    handlePotInventoryUse(context) {
        const { item, itemLabel, formatItemLabel, chooseTarget } = context;
        if (item?.isPotFull?.()) {
            this.pushInventoryUseMessage(context, `${itemLabel} is full.`);
            return this.finalizeInventoryUse(context, false);
        }

        const targets = this.buildPotTargetsForPlayer(item);
        if (targets.length === 0) {
            this.pushInventoryUseMessage(context, `No valid item can be placed into ${itemLabel}.`);
            return this.finalizeInventoryUse(context, false);
        }

        const chosenTarget = chooseTarget(itemLabel, targets, {
            header: `Choose item to place into ${itemLabel}:`,
            defaultValue: '1'
        });
        if (!chosenTarget) {
            return this.finalizeInventoryUse(context, false);
        }

        const storageResult = this.storeInventoryItemInPot(item, chosenTarget, {
            potLabel: itemLabel,
            formatItemLabel
        });
        for (const message of storageResult.messages || []) {
            this.pushInventoryUseMessage(context, message);
        }

        return this.finalizeInventoryUse(context, false);
    },

    handleImprovementScrollInventoryUse(context) {
        const { item, itemLabel, formatItemLabel, chooseTarget } = context;
        const targets = this.buildImprovementTargetsForPlayer(item);
        if (targets.length === 0) {
            this.pushInventoryUseMessage(context, `No valid equipment can be improved by ${itemLabel}.`);
            return this.finalizeInventoryUse(context, false);
        }

        const chosenTarget = chooseTarget(itemLabel, targets);
        if (!chosenTarget) {
            return this.finalizeInventoryUse(context, false);
        }

        const useResult = item.use(this.player, chosenTarget) || { consumed: false };
        if (!useResult?.consumed) {
            this.pushInventoryUseMessage(context, `Could not use ${itemLabel}`);
            return this.finalizeInventoryUse(context, false);
        }

        const targetLabel = formatItemLabel(useResult.target);
        this.pushInventoryUseMessage(context, `Used ${itemLabel} on ${targetLabel}.`);
        this.pushInventoryUseMessage(context, `${targetLabel} is now +${useResult.level}.`);
        this.player.removeItem(item);
        return this.finalizeInventoryUse(context, Boolean(useResult.consumed));
    },

    handleTargetedScrollInventoryUse(context) {
        const { item, itemLabel, formatItemLabel, chooseTarget } = context;
        const targets = this.buildGenericScrollTargetsForPlayer(item);
        if (targets.length === 0) {
            this.pushInventoryUseMessage(context, `No valid target for ${itemLabel}.`);
            return this.finalizeInventoryUse(context, false);
        }

        const chosenTarget = chooseTarget(itemLabel, targets);
        if (!chosenTarget) {
            return this.finalizeInventoryUse(context, false);
        }

        const useResult = item.use(this.player, chosenTarget) || { consumed: false };
        if (!useResult?.consumed) {
            this.pushInventoryUseMessage(context, `Could not use ${itemLabel}`);
            return this.finalizeInventoryUse(context, false);
        }

        const targetLabel = formatItemLabel(useResult.target);
        const effect = useResult.effect;
        this.pushInventoryUseMessage(context, `Used ${itemLabel} on ${targetLabel}.`);

        if (effect === 'add-slot') {
            this.pushInventoryUseMessage(context, `${targetLabel} now has ${useResult.slots} enchantment slot(s).`);
        } else if (effect === 'purify-item') {
            this.pushInventoryUseMessage(
                context,
                useResult.wasCursed
                    ? `${targetLabel} is no longer cursed.`
                    : `${targetLabel} had no curse, but is now purified.`
            );
        } else if (effect === 'identify-item') {
            this.pushInventoryUseMessage(
                context,
                useResult.isCursed
                    ? `${targetLabel} is cursed.`
                    : `${targetLabel} is not cursed.`
            );
        } else if (effect === 'add-gilded') {
            this.pushInventoryUseMessage(context, `${targetLabel} is now gilded.`);
        }

        this.player.removeItem(item);
        return this.finalizeInventoryUse(context, Boolean(useResult.consumed));
    },

    handleDefaultInventoryUse(context) {
        const { item, itemLabel } = context;
        const useResult = item.use(this.player) || { consumed: true };
        if (useResult.consumed !== false) {
            this.player.removeItem(item);
            this.pushInventoryUseMessage(context, `Used ${itemLabel}`);
            return this.finalizeInventoryUse(context, true);
        }

        this.pushInventoryUseMessage(
            context,
            typeof useResult?.message === 'string' && useResult.message.length > 0
                ? useResult.message
                : `Could not use ${itemLabel}.`
        );
        return this.finalizeInventoryUse(context, false);
    },

    useInventoryItem(item, options = {}) {
        const context = this.createInventoryUseContext(item, options);
        const { itemLabel } = context;

        if (item?.type === ITEM_TYPES.POT) {
            return this.handlePotInventoryUse(context);
        }

        const floorEffectResult = this.useFloorEffectScroll(item);
        if (floorEffectResult.handled) {
            if (floorEffectResult.effect === 'map-floor' && floorEffectResult.consumed) {
                this.pushInventoryUseMessage(context, `Used ${itemLabel}.`);
                this.pushInventoryUseMessage(context, 'The entire floor is revealed.');
            } else if (floorEffectResult.effect === 'erase-traps' && floorEffectResult.consumed) {
                this.pushInventoryUseMessage(context, `Used ${itemLabel}.`);
                this.pushInventoryUseMessage(context, `Erased ${floorEffectResult.removedCount || 0} trap(s) on this floor.`);
            } else if (floorEffectResult.effect === 'warp-player') {
                if (floorEffectResult.consumed && floorEffectResult.destination) {
                    this.pushInventoryUseMessage(context, `Used ${itemLabel}.`);
                    this.pushInventoryUseMessage(context, `Warped to ${floorEffectResult.destination.x}, ${floorEffectResult.destination.y}.`);
                } else {
                    this.pushInventoryUseMessage(context, `Could not use ${itemLabel}.`);
                }
            }

            return this.finalizeInventoryUse(context, floorEffectResult.consumed);
        }

        const isImprovementScroll = typeof item?.isEquipmentImprovementScroll === 'function' && item.isEquipmentImprovementScroll();
        if (isImprovementScroll) {
            return this.handleImprovementScrollInventoryUse(context);
        }

        const hasTargetedScrollEffect = typeof item?.getScrollEffect === 'function'
            && ['add-slot', 'purify-item', 'identify-item', 'add-gilded'].includes(item.getScrollEffect());

        if (hasTargetedScrollEffect) {
            return this.handleTargetedScrollInventoryUse(context);
        }

        return this.handleDefaultInventoryUse(context);
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

        if (typeof this.player?.canUnequipItem === 'function' && !this.player.canUnequipItem(item)) {
            return { success: false, messages: [`${itemLabel} is cursed and cannot be unequipped`] };
        }

        if (typeof this.player?.hasInventorySpaceFor === 'function' && !this.player.hasInventorySpaceFor(item)) {
            return { success: false, messages: [`Inventory is full. Cannot unequip ${itemLabel}.`] };
        }

        return { success: false, messages: [`Could not unequip ${itemLabel}`] };
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
            if (typeof this.player?.hasInventorySpaceFor === 'function' && !this.player.hasInventorySpaceFor(item)) {
                return { success: false, messages: [`Inventory is full. Cannot take ${itemLabel} from ${ally.name}.`] };
            }
            return { success: false, messages: [`${ally.name} cannot unequip ${itemLabel}`] };
        }

        if (typeof this.player?.addItem === 'function' && !this.player.addItem(item)) {
            ally.equipItem?.(item);
            return { success: false, messages: [`Inventory is full. Cannot take ${itemLabel} from ${ally.name}.`] };
        }

        return { success: true, messages: [`${ally.name} unequipped ${itemLabel}`] };
    },

    equipInventoryItem(item, equipTarget, options = {}) {
        const formatItemLabel = typeof options.formatItemLabel === 'function'
            ? options.formatItemLabel
            : (target) => String(getItemLabel(target) || 'item');

        let equipped = false;
        let replacedItem = null;
        let failureReason = '';

        if (equipTarget.kind === 'player') {
            equipped = item.equip(this.player);
        } else {
            const equipResult = this.player.equipItemOnAlly(equipTarget.ally, item);
            equipped = Boolean(equipResult?.success);
            replacedItem = equipResult?.replacedItem || null;
            failureReason = String(equipResult?.reason || '');
        }

        if (!equipped) {
            if (equipTarget.kind === 'player') {
                return {
                    success: false,
                    replacedItem: null,
                    messages: [`Could not equip ${formatItemLabel(item)}`]
                };
            }

            const allyMessage = failureReason === 'inventory full for replaced item'
                ? `Inventory is full. ${equipTarget.ally.name} cannot return their replaced gear.`
                : `${equipTarget.ally.name} could not equip ${formatItemLabel(item)}`;

            return {
                success: false,
                replacedItem: null,
                messages: [allyMessage]
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

        if (standingOnShopTile && (item?.properties?.questReturnOnly || item?.properties?.questDeliveryOnly)) {
            const blockedMessage = typeof item?.properties?.saleBlockMessage === 'string'
                ? item.properties.saleBlockMessage
                : (item?.properties?.questReturnOnly
                    ? `${itemLabel} must be returned to the Questgiver, not sold.`
                    : `${itemLabel} must be kept for its quest, not sold.`);
            return { burned: false, messages: [blockedMessage] };
        }

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
