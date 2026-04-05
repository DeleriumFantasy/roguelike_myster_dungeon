// UI inventory helpers

Object.assign(UI.prototype, {
    refreshUiAfterInventoryMutation() {
        if (!this.game || !this.game.world || !this.game.player || !this.game.fov) {
            return;
        }

        this.render(this.game.world, this.game.player, this.game.fov);
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

    runManagedInventoryPrompt(callback) {
        return typeof this.runNativePrompt === 'function'
            ? this.runNativePrompt(callback)
            : (typeof callback === 'function' ? callback() : null);
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

    showInventoryItemDetails(item, event = null) {
        const detailsPanel = document.getElementById('inventory-item-details');
        const detailsContent = document.getElementById('inventory-item-details-content');
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
        const cursed = typeof item.isCursed === 'function' ? item.isCursed() : Boolean(item?.properties?.cursed);
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
        const detailsPanel = document.getElementById('inventory-item-details');
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
        const detailsPanel = document.getElementById('inventory-item-details');
        const detailsContent = document.getElementById('inventory-item-details-content');
        if (!detailsPanel || !detailsContent) {
            return;
        }

        detailsContent.innerHTML = '';
        detailsPanel.style.display = 'none';
    },

    reopenInventoryForCurrentPlayer() {
        this.openInventory(this.game.player);
    },

    openInventory(player) {
        this.game.inventoryOpen = true;
        const list = this.inventoryModal.querySelector('#inventory-list');
        list.innerHTML = '';

        // Equipped items first, including ally equipment
        const equippedItems = typeof player.getEquippedItems === 'function' ? player.getEquippedItems() : [];
        for (const [slot, item] of equippedItems) {
            const displayName = `[E] ${this.formatInventoryItemLabel(item)}`;
            list.appendChild(this.createInventoryListItem(
                displayName,
                () => this.handleEquippedItemClick(slot, item),
                getItemTypeColor(item?.type),
                item
            ));
        }

        const allies = Array.isArray(player?.allies) ? player.allies : [];
        for (const ally of allies) {
            if (!ally?.isAlive?.() || typeof ally.equipment?.entries !== 'function') {
                continue;
            }

            for (const [slot, item] of ally.equipment.entries()) {
                const displayName = `[E - ${ally.name}] ${this.formatInventoryItemLabel(item)}`;
                list.appendChild(this.createInventoryListItem(
                    displayName,
                    () => this.handleAllyEquippedItemClick(ally, slot, item),
                    getItemTypeColor(item?.type),
                    item
                ));
            }
        }

        // Backpack items below
        const sortedInventory = this.sortInventoryForDisplay(player.getInventory());
        sortedInventory.forEach((item) => {
            const displayName = this.formatInventoryItemLabel(item);
            list.appendChild(this.createInventoryListItem(
                displayName,
                () => this.handleInventoryClick(item),
                getItemTypeColor(item?.type),
                item
            ));
        });

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
        this.focusGameSurface?.();
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

    handleInventoryClick(item) {
        const itemLabel = this.formatInventoryItemLabel(item);
        const formatItemLabel = (target) => this.formatInventoryItemLabel(target);
        const actions = this.getAvailableInventoryActions(item);
        const choice = this.promptForInventoryAction(itemLabel, actions);
        if (!choice) {
            this.reopenInventoryForCurrentPlayer();
            return;
        }

        if (choice === 'use') {
            const useResult = this.game.useInventoryItem(item, {
                itemLabel,
                formatItemLabel,
                chooseTarget: (promptLabel, targets, promptOptions = {}) => this.promptForInventoryTarget(promptLabel, targets, promptOptions)
            });
            this.applyInventoryOutcome(useResult, {
                failureMessage: `Could not use ${itemLabel}`
            });
            return;
        }

        if (choice === 'equip') {
            const equipTarget = this.promptForEquipmentRecipient(itemLabel);
            if (!equipTarget) {
                this.reopenInventoryForCurrentPlayer();
                return;
            }

            const outcome = this.game.equipInventoryItem(item, equipTarget, {
                formatItemLabel
            });
            this.applyInventoryOutcome(outcome);
            return;
        }

        if (choice === 'throw') {
            this.closeInventory();
            this.game.beginThrowMode(item);
            return;
        }

        if (choice === 'drop') {
            const outcome = this.game.dropInventoryItem(item, {
                formatItemLabel
            });
            this.applyInventoryOutcome(outcome);
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

    promptForInventoryTarget(itemLabel, targets, options = {}) {
        if (!Array.isArray(targets) || targets.length === 0) {
            return null;
        }

        const header = typeof options.header === 'string'
            ? options.header
            : `Choose target for ${itemLabel}:`;
        const defaultValue = String(options.defaultValue ?? '1');
        const optionsText = targets
            .map((entry, index) => `${index + 1}. ${this.formatInventoryItemLabel(entry.item)} (${entry.locationLabel})`)
            .join('\n');
        const response = this.runManagedInventoryPrompt(
            () => window.prompt(`${header}\n${optionsText}`, defaultValue)
        );
        if (!response) {
            return null;
        }

        const selectedIndex = Number.parseInt(String(response).trim(), 10) - 1;
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= targets.length) {
            this.addMessage('Invalid selection.');
            return null;
        }

        return targets[selectedIndex].item;
    },

    promptForImprovementTarget(scrollLabel, targets) {
        return this.promptForInventoryTarget(scrollLabel, targets, {
            header: `Choose equipment to improve with ${scrollLabel}:`,
            defaultValue: '1'
        });
    },

    getAvailableInventoryActions(item) {
        return getInventoryActionsForItemType(item?.type);
    },

    promptForEquipmentRecipient(itemLabel) {
        const allies = Array.isArray(this.game?.player?.allies)
            ? this.game.player.allies.filter((ally) => ally?.isAlive?.())
            : [];

        if (allies.length === 0) {
            return { kind: 'player' };
        }

        const optionsText = ['0) yourself']
            .concat(allies.map((ally, index) => `${index + 1}) ${ally.name}`))
            .join('\n');
        const response = this.runManagedInventoryPrompt(
            () => window.prompt(`Who should equip ${itemLabel}?\n${optionsText}\nChoose number:`, '0')
        );
        if (response === null) {
            return null;
        }

        const selectedIndex = Math.floor(Number(response.trim()));
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex > allies.length) {
            this.addMessage('Invalid selection.');
            return null;
        }

        if (selectedIndex === 0) {
            return { kind: 'player' };
        }

        return { kind: 'ally', ally: allies[selectedIndex - 1] };
    },

    promptForInventoryAction(itemLabel, actions) {
        const optionsText = actions.join('/');
        const response = this.runManagedInventoryPrompt(
            () => window.prompt(`Choose action for ${itemLabel}: ${optionsText}`, actions[0])
        );
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
