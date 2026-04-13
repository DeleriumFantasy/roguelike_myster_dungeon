// UI inventory helpers

Object.assign(UI.prototype, {
    refreshUiAfterInventoryMutation() {
        this.renderCurrentGameState();
    },

    addMessagesFromList(messages = []) {
        for (const message of Array.isArray(messages) ? messages : []) {
            if (typeof message === 'string' && message.length > 0) {
                this.addMessage(message);
            }
        }
    },

    applyInventoryOutcome(outcome, options = {}) {
        const failureMessage = typeof options.failureMessage === 'string'
            ? options.failureMessage
            : '';

        if (outcome?.handled === false && failureMessage) {
            this.addMessage(failureMessage);
        }

        this.addMessagesFromList(outcome?.messages || []);
        this.refreshUiAfterInventoryMutation();

        if (options.reopen !== false) {
            this.reopenInventoryForCurrentPlayer();
        }

        return outcome;
    },


    createInventoryListItem(text, onClick = null, textColor = null, item = null) {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.textContent = text;
        if (textColor) {
            div.style.color = textColor;
        }
        if (typeof onClick === 'function') {
            div.onclick = onClick;
        }
        if (item) {
            div.addEventListener('mouseenter', (event) => this.showInventoryItemDetails(item, event));
            div.addEventListener('mousemove', (event) => this.updateInventoryItemDetailsPosition(event));
            div.addEventListener('mouseleave', () => this.hideInventoryItemDetails());
        }
        return div;
    },

    getInventoryDetailsElements() {
        return {
            detailsPanel: this.getUiElement('inventory-item-details'),
            detailsContent: this.getUiElement('inventory-item-details-content')
        };
    },

    showInventoryItemDetails(item, event = null) {
        const { detailsPanel, detailsContent } = this.getInventoryDetailsElements();
        if (!detailsPanel || !detailsContent || !item) {
            return;
        }

        const isIdentified = typeof item.isIdentified === 'function' ? item.isIdentified() : true;
        if (!isIdentified) {
            detailsContent.innerHTML = '<p>This item is unknown.</p>';
            detailsPanel.style.display = 'block';
            this.updateInventoryItemDetailsPosition(event);
            return;
        }

        const enchantments = typeof item.getVisibleEnchantmentNames === 'function'
            ? item.getVisibleEnchantmentNames()
            : [];
        const slots = Number(item?.properties?.slots || 0);
        const power = Number(item?.properties?.power || 0);
        const armor = Number(item?.properties?.armor || 0);
        const improvement = typeof item.getImprovementLevel === 'function'
            ? item.getImprovementLevel()
            : Number(item?.properties?.improvementLevel || 0);
        const quantity = typeof item.getQuantity === 'function' ? item.getQuantity() : 1;
        const cursed = getItemCursedState(item);
        const potType = typeof item?.getPotType === 'function' ? item.getPotType() : String(item?.properties?.potType || '');
        const storedItems = typeof item?.getStoredItems === 'function' ? item.getStoredItems() : [];
        const potCapacity = typeof item?.getPotCapacity === 'function'
            ? item.getPotCapacity()
            : Math.max(1, Math.floor(Number(item?.properties?.potCapacity) || 1));
        const remainingPotSpace = typeof item?.getRemainingPotSpace === 'function'
            ? item.getRemainingPotSpace()
            : Math.max(0, potCapacity - storedItems.length);

        const lines = [
            `<p>Name: ${this.formatInventoryItemLabel(item)}</p>`,
            `<p>Type: ${String(item?.type || 'unknown')}</p>`
        ];

        if (Number.isFinite(power) && power !== 0) {
            lines.push(`<p>Power: ${power}</p>`);
        }
        if (Number.isFinite(armor) && armor !== 0) {
            lines.push(`<p>Armor: ${armor}</p>`);
        }
        if (Number.isFinite(slots)) {
            lines.push(`<p>Slots: ${Math.max(0, Math.floor(slots))}</p>`);
        }
        if (Number.isFinite(improvement) && improvement > 0) {
            lines.push(`<p>Improvement: +${Math.floor(improvement)}</p>`);
        }
        if (item?.type === ITEM_TYPES.THROWABLE) {
            lines.push(`<p>Quantity: ${Math.max(1, Math.floor(Number(quantity) || 1))}</p>`);
        }
        if (item?.type === ITEM_TYPES.POT) {
            const prettyPotType = potType
                ? `${potType.charAt(0).toUpperCase()}${potType.slice(1)}`
                : 'Basic';
            const contentPreview = storedItems.slice(0, 4).map((storedItem) => getItemLabel(storedItem)).join(', ');
            lines.push(`<p>Pot type: ${prettyPotType}</p>`);
            lines.push(`<p>Space remaining: ${remainingPotSpace} / ${potCapacity}</p>`);
            lines.push(`<p>Stored items: ${storedItems.length}</p>`);
            if (contentPreview) {
                lines.push(`<p>Contents: ${contentPreview}${storedItems.length > 4 ? ', ...' : ''}</p>`);
            }
        }
        lines.push(`<p>Cursed: ${cursed ? 'yes' : 'no'}</p>`);
        lines.push(`<p>Enchantments: ${enchantments.length > 0 ? enchantments.join(', ') : 'none'}</p>`);

        detailsContent.innerHTML = lines.join('');
        detailsPanel.style.display = 'block';
        this.updateInventoryItemDetailsPosition(event);
    },

    updateInventoryItemDetailsPosition(event = null) {
        const { detailsPanel } = this.getInventoryDetailsElements();
        if (!detailsPanel || detailsPanel.style.display === 'none') {
            return;
        }

        const panelWidth = detailsPanel.offsetWidth || 280;
        const panelHeight = detailsPanel.offsetHeight || 180;
        const margin = 14;

        let anchorX = Number(event?.clientX);
        let anchorY = Number(event?.clientY);

        if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
            const modalRect = this.inventoryModal?.getBoundingClientRect?.();
            anchorX = Number(modalRect?.right) || 24;
            anchorY = Number(modalRect?.top) || 24;
        }

        let nextLeft = anchorX + margin;
        let nextTop = anchorY + margin;

        if (nextLeft + panelWidth > window.innerWidth - 8) {
            nextLeft = Math.max(8, anchorX - panelWidth - margin);
        }

        if (nextTop + panelHeight > window.innerHeight - 8) {
            nextTop = Math.max(8, window.innerHeight - panelHeight - 8);
        }

        detailsPanel.style.left = `${Math.round(nextLeft)}px`;
        detailsPanel.style.top = `${Math.round(nextTop)}px`;
    },

    hideInventoryItemDetails() {
        const { detailsPanel, detailsContent } = this.getInventoryDetailsElements();
        if (!detailsPanel || !detailsContent) {
            return;
        }

        detailsContent.innerHTML = '';
        detailsPanel.style.display = 'none';
    },

    reopenInventoryForCurrentPlayer() {
        this.openInventory(this.game.player);
    },

    updateInventoryTitle(player) {
        const title = this.inventoryModal?.querySelector('#inventory-title')
            || this.inventoryModal?.querySelector('h3');
        if (!title) {
            return;
        }

        const itemCount = typeof player?.getInventoryItemCount === 'function'
            ? player.getInventoryItemCount()
            : this.getPlayerInventoryItems(player).length;
        const maxItems = typeof player?.getMaxInventoryItems === 'function'
            ? player.getMaxInventoryItems()
            : 20;

        title.textContent = `Inventory [${itemCount}/${maxItems}]`;
    },

    buildInventoryDisplayEntries(player) {
        const entries = [];
        const equippedItems = typeof player?.getEquippedItems === 'function' ? player.getEquippedItems() : [];
        for (const [slot, item] of equippedItems) {
            entries.push({
                displayName: `[E] ${this.formatInventoryItemLabel(item)}`,
                onClick: () => this.handleEquippedItemClick(slot, item),
                textColor: getItemTypeColor(item?.type),
                item
            });
        }

        const allies = this.getPlayerAllies(player, { aliveOnly: true });
        for (const ally of allies) {
            if (!ally?.isAlive?.() || typeof ally.equipment?.entries !== 'function') {
                continue;
            }

            for (const [slot, item] of ally.equipment.entries()) {
                entries.push({
                    displayName: `[E - ${ally.name}] ${this.formatInventoryItemLabel(item)}`,
                    onClick: () => this.handleAllyEquippedItemClick(ally, slot, item),
                    textColor: getItemTypeColor(item?.type),
                    item
                });
            }
        }

        const sortedInventory = this.sortInventoryForDisplay(this.getPlayerInventoryItems(player));
        for (const item of sortedInventory) {
            entries.push({
                displayName: this.formatInventoryItemLabel(item),
                onClick: () => this.handleInventoryClick(item),
                textColor: getItemTypeColor(item?.type),
                item
            });
        }

        return entries;
    },

    appendInventoryDisplayEntries(list, entries = []) {
        for (const entry of entries) {
            list.appendChild(this.createInventoryListItem(
                entry.displayName,
                entry.onClick,
                entry.textColor,
                entry.item
            ));
        }
    },

    openInventory(player) {
        this.haltPlayerMovementForPopup();
        this.game.inventoryOpen = true;
        this.updateInventoryTitle(player);
        const list = this.inventoryModal.querySelector('#inventory-list');
        if (!list) {
            return;
        }

        list.innerHTML = '';

        const entries = this.buildInventoryDisplayEntries(player);
        this.appendInventoryDisplayEntries(list, entries);

        this.hideInventoryItemDetails();
        this.inventoryModal.style.display = 'block';
    },

    sortInventoryForDisplay(inventory) {
        if (!Array.isArray(inventory) || inventory.length === 0) {
            return [];
        }

        const categoryOrder = [
            'money',
            'healing',
            'food',
            'pot',
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
        if (type === ITEM_TYPES.MONEY) {
            return 'money';
        }
        if (type === ITEM_TYPES.THROWABLE) {
            return 'throwable';
        }
        if (type === ITEM_TYPES.POT) {
            return 'pot';
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
        this.hideInventoryItemDetails();
        this.inventoryModal.style.display = 'none';
        this.focusGameSurface();
    },

    handleEquippedItemClick(slot, item) {
        const outcome = this.game.unequipPlayerInventorySlot(slot, item, {
            formatItemLabel: (target) => this.formatInventoryItemLabel(target)
        });
        this.applyInventoryOutcome(outcome);
    },

    handleAllyEquippedItemClick(ally, slot, item) {
        const outcome = this.game.unequipAllyInventorySlot(ally, slot, item, {
            formatItemLabel: (target) => this.formatInventoryItemLabel(target)
        });
        this.applyInventoryOutcome(outcome);
    },

    openInventoryChoicePrompt(titleText, messageText, choices = [], onSelect = null, options = {}) {
        const normalizedChoices = Array.isArray(choices) ? choices.filter(Boolean) : [];
        if (normalizedChoices.length === 0) {
            if (typeof onSelect === 'function') {
                onSelect(null);
            }
            return;
        }

        this.openChoicePrompt(titleText, messageText, normalizedChoices, onSelect, {
            onCancel: typeof options.onCancel === 'function'
                ? options.onCancel
                : (() => {
                    if (typeof onSelect === 'function') {
                        onSelect(null);
                    }
                })
        });
    },

    getActiveInventoryAllies() {
        return this.getPlayerAllies(this.game?.player, { aliveOnly: true });
    },

    runInventoryAction(choice, item, actionContext = {}) {
        const itemLabel = actionContext.itemLabel || this.formatInventoryItemLabel(item);
        const formatItemLabel = typeof actionContext.formatItemLabel === 'function'
            ? actionContext.formatItemLabel
            : (target) => this.formatInventoryItemLabel(target);

        const actionHandlers = {
            use: () => {
                const runUseSelection = (selectedTarget = undefined) => {
                    let selectionPending = false;
                    const useResult = this.game.useInventoryItem(item, {
                        itemLabel,
                        formatItemLabel,
                        chooseTarget: (promptLabel, targets, promptOptions = {}) => {
                            const normalizedTargets = Array.isArray(targets)
                                ? targets.filter((entry) => entry?.item)
                                : [];

                            if (selectedTarget !== undefined) {
                                return selectedTarget;
                            }

                            if (normalizedTargets.length === 1) {
                                return normalizedTargets[0].item;
                            }

                            selectionPending = true;
                            this.openInventoryTargetPrompt(promptLabel, normalizedTargets, promptOptions, (targetItem) => {
                                if (!targetItem) {
                                    this.reopenInventoryForCurrentPlayer();
                                    return;
                                }

                                runUseSelection(targetItem);
                            });
                            return null;
                        }
                    });

                    if (selectionPending) {
                        return;
                    }

                    this.applyInventoryOutcome(useResult, {
                        failureMessage: `Could not use ${itemLabel}`
                    });
                };

                runUseSelection();
            },
            equip: () => {
                const allies = this.getActiveInventoryAllies();
                if (allies.length === 0) {
                    const outcome = this.game.equipInventoryItem(item, { kind: 'player' }, {
                        formatItemLabel
                    });
                    this.applyInventoryOutcome(outcome);
                    return;
                }

                const buttons = [{ label: 'Equip yourself', value: 'player', primary: true }]
                    .concat(allies.map((ally, index) => ({ label: `Equip ${ally.name}`, value: index })));
                buttons.push({ label: 'Cancel', value: 'cancel', cancel: true });

                this.openInventoryChoicePrompt('Choose recipient', `Who should equip ${itemLabel}?`, buttons, (choice) => {
                    if (choice === null || choice === 'cancel') {
                        this.reopenInventoryForCurrentPlayer();
                        return;
                    }

                    const equipTarget = choice === 'player'
                        ? { kind: 'player' }
                        : { kind: 'ally', ally: allies[Math.floor(Number(choice))] || null };
                    if (equipTarget.kind === 'ally' && !equipTarget.ally) {
                        this.addMessage('Invalid selection.');
                        this.reopenInventoryForCurrentPlayer();
                        return;
                    }

                    const outcome = this.game.equipInventoryItem(item, equipTarget, {
                        formatItemLabel
                    });
                    this.applyInventoryOutcome(outcome);
                }, {
                    onCancel: () => this.reopenInventoryForCurrentPlayer()
                });
            },
            throw: () => {
                this.closeInventory();
                this.game.beginThrowMode(item);
            },
            drop: () => {
                const outcome = this.game.dropInventoryItem(item, {
                    formatItemLabel
                });
                this.applyInventoryOutcome(outcome);
            }
        };

        const handler = actionHandlers[choice];
        if (typeof handler !== 'function') {
            return false;
        }

        handler();
        return true;
    },

    handleInventoryClick(item) {
        const itemLabel = this.formatInventoryItemLabel(item);
        const formatItemLabel = (target) => this.formatInventoryItemLabel(target);
        const actions = this.getAvailableInventoryActions(item);
        const buttons = actions.map((action, index) => ({
            label: action.charAt(0).toUpperCase() + action.slice(1),
            value: action,
            primary: index === 0
        }));
        buttons.push({ label: 'Cancel', value: 'cancel', cancel: true });

        this.openInventoryChoicePrompt('Inventory action', `Choose action for ${itemLabel}:`, buttons, (choice) => {
            if (!choice || choice === 'cancel') {
                this.reopenInventoryForCurrentPlayer();
                return;
            }

            this.runInventoryAction(choice, item, { itemLabel, formatItemLabel });
        }, {
            onCancel: () => this.reopenInventoryForCurrentPlayer()
        });
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
        const cursed = getItemCursedState(item);
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

    openInventoryTargetPrompt(itemLabel, targets, options = {}, onSelect = null) {
        const normalizedTargets = Array.isArray(targets)
            ? targets.filter((entry) => entry?.item)
            : [];
        if (normalizedTargets.length === 0) {
            if (typeof onSelect === 'function') {
                onSelect(null);
            }
            return;
        }

        if (normalizedTargets.length === 1) {
            if (typeof onSelect === 'function') {
                onSelect(normalizedTargets[0].item);
            }
            return;
        }

        const header = typeof options.header === 'string'
            ? options.header
            : `Choose target for ${itemLabel}:`;
        const buttons = normalizedTargets.map((entry, index) => ({
            label: `${index + 1}) ${this.formatInventoryItemLabel(entry.item)} (${entry.locationLabel})`,
            value: index,
            primary: index === 0
        }));
        buttons.push({ label: 'Cancel', value: -1, cancel: true });

        this.openInventoryChoicePrompt('Choose target', header, buttons, (value) => {
            const selectedIndex = Number.parseInt(String(value).trim(), 10);
            if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= normalizedTargets.length) {
                if (typeof onSelect === 'function') {
                    onSelect(null);
                }
                return;
            }

            if (typeof onSelect === 'function') {
                onSelect(normalizedTargets[selectedIndex].item);
            }
        }, {
            onCancel: () => {
                if (typeof onSelect === 'function') {
                    onSelect(null);
                }
            }
        });
    },


    getAvailableInventoryActions(item) {
        const configuredActions = Array.isArray(item?.properties?.inventoryActions)
            ? item.properties.inventoryActions.filter((action) => ['use', 'equip', 'throw', 'drop'].includes(action))
            : null;
        const baseActions = (configuredActions && configuredActions.length > 0)
            ? configuredActions
            : getInventoryActionsForItemType(item?.type);

        return baseActions.filter((action) => {
            if (action === 'use' && item?.properties?.useBlocked) {
                return false;
            }
            if (action === 'throw' && item?.properties?.throwBlocked) {
                return false;
            }
            return true;
        });
    },

});
