// UI stats panel and message helpers

Object.assign(UI.prototype, {
    applyOverlayVisibility() {
        if (this.statsDiv) {
            this.statsDiv.style.display = this.statsOpen ? 'block' : 'none';
            this.statsDiv.setAttribute('aria-hidden', this.statsOpen ? 'false' : 'true');
        }

        if (this.messagesDiv) {
            this.messagesDiv.style.display = this.messagesOpen ? 'block' : 'none';
            this.messagesDiv.setAttribute('aria-hidden', this.messagesOpen ? 'false' : 'true');
        }
    },

    haltPlayerMovementForPopup() {
        this.game?.stopAutoExplore?.();
        this.game?.inputController?.reset?.();
    },

    getGamePromptElements() {
        return {
            modal: this.getUiElement('game-prompt-modal'),
            title: this.getUiElement('game-prompt-title'),
            message: this.getUiElement('game-prompt-message'),
            input: this.getUiElement('game-prompt-input'),
            buttons: this.getUiElement('game-prompt-buttons')
        };
    },

    getSettingsElements() {
        return {
            modal: this.getUiElement('settings-modal'),
            descendImmediately: this.getUiElement('setting-descend-immediately'),
            alliesPassive: this.getUiElement('setting-allies-passive')
        };
    },

    getDungeonSelectionElements() {
        return {
            modal: this.getUiElement('dungeon-selection-modal'),
            list: this.getUiElement('dungeon-selection-list')
        };
    },

    closeGamePrompt(options = {}) {
        const { invokeCancel = false, value = null, skipFocusRestore = false } = options;
        const promptConfig = this.activeGamePromptConfig || null;
        this.activeGamePromptConfig = null;

        const { modal, title, message, input, buttons } = this.getGamePromptElements();
        if (modal && title && message && input && buttons) {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            title.textContent = '';
            message.textContent = '';
            input.style.display = 'none';
            input.value = '';
            input.onkeydown = null;
            buttons.innerHTML = '';
        }

        this.gamePromptOpen = false;

        if (invokeCancel && typeof promptConfig?.onCancel === 'function') {
            promptConfig.onCancel(value);
        }

        if (!skipFocusRestore && !this.gamePromptOpen) {
            this.focusGameSurface();
        }
    },

    openGamePrompt(options = {}) {
        const { modal, title, message, input, buttons } = this.getGamePromptElements();
        if (!modal || !title || !message || !input || !buttons) {
            return false;
        }

        if (this.gamePromptOpen) {
            this.closeGamePrompt({ invokeCancel: true, skipFocusRestore: true });
        }

        this.haltPlayerMovementForPopup();

        const {
            titleText = 'Prompt',
            messageText = '',
            defaultValue = '',
            useInput = false,
            placeholder = '',
            buttons: buttonOptions = [],
            onSubmit = null,
            onCancel = null
        } = options;

        this.activeGamePromptConfig = { onSubmit, onCancel };

        const finalize = (value = null, canceled = false) => {
            const promptConfig = this.activeGamePromptConfig || { onSubmit, onCancel };
            this.closeGamePrompt({ skipFocusRestore: true });
            if (canceled) {
                if (typeof promptConfig?.onCancel === 'function') {
                    promptConfig.onCancel(value);
                }
            } else if (typeof promptConfig?.onSubmit === 'function') {
                promptConfig.onSubmit(value);
            }

            if (!this.gamePromptOpen) {
                this.focusGameSurface();
            }
        };

        title.textContent = String(titleText || 'Prompt');
        message.textContent = String(messageText || '');
        buttons.innerHTML = '';

        input.style.display = useInput ? 'block' : 'none';
        input.value = String(defaultValue ?? '');
        input.placeholder = String(placeholder || '');
        input.onkeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finalize(input.value, false);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                finalize(null, true);
            }
        };

        const normalizedButtons = this.normalizeGamePromptButtons(buttonOptions, {
            useInput,
            defaultValue
        });
        const useListLayout = normalizedButtons.some((buttonOption) => Boolean(buttonOption?.listStyle || buttonOption?.description));

        buttons.style.flexDirection = useListLayout ? 'column' : 'row';
        buttons.style.alignItems = useListLayout ? 'stretch' : 'center';
        buttons.style.justifyContent = useListLayout ? 'flex-start' : 'flex-end';
        buttons.style.flexWrap = useListLayout ? 'nowrap' : 'wrap';

        for (const buttonOption of normalizedButtons) {
            const button = document.createElement('button');
            button.type = 'button';

            if (useListLayout) {
                button.style.width = '100%';
                button.style.display = 'flex';
                button.style.flexDirection = 'column';
                button.style.alignItems = 'flex-start';
                button.style.textAlign = 'left';
                button.style.whiteSpace = 'normal';
                button.style.gap = '2px';

                const labelSpan = document.createElement('span');
                labelSpan.textContent = String(buttonOption?.label || 'OK');
                button.appendChild(labelSpan);

                const descriptionText = String(buttonOption?.description || '').trim();
                if (descriptionText) {
                    const descriptionSpan = document.createElement('span');
                    descriptionSpan.textContent = descriptionText;
                    descriptionSpan.style.fontSize = '0.9em';
                    descriptionSpan.style.opacity = '0.8';
                    button.appendChild(descriptionSpan);
                }
            } else {
                button.textContent = String(buttonOption?.label || 'OK');
            }

            if (buttonOption?.primary) {
                button.classList.add('game-prompt-primary');
            }
            button.addEventListener('click', () => {
                const value = buttonOption?.value === '__INPUT__'
                    ? input.value
                    : buttonOption?.value;
                finalize(value, Boolean(buttonOption?.cancel));
            });
            buttons.appendChild(button);
        }

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        this.gamePromptOpen = true;

        window.requestAnimationFrame(() => {
            if (useInput) {
                input.focus();
                input.select();
                return;
            }

            const firstButton = buttons.querySelector('button');
            if (firstButton && typeof firstButton.focus === 'function') {
                firstButton.focus();
            }
        });

        return true;
    },

    normalizeGamePromptButtons(buttonOptions = [], options = {}) {
        const { useInput = false, defaultValue = '' } = options;
        if (Array.isArray(buttonOptions) && buttonOptions.length > 0) {
            return buttonOptions;
        }

        return [{
            label: 'OK',
            value: useInput ? String(defaultValue ?? '') : true,
            primary: true
        }];
    },

    openChoicePrompt(titleText, messageText, choices = [], onSelect = null, options = {}) {
        const normalizedChoices = Array.isArray(choices) ? choices.filter(Boolean) : [];
        return this.openGamePrompt({
            titleText,
            messageText,
            buttons: normalizedChoices,
            onSubmit: (value) => {
                if (typeof onSelect === 'function') {
                    onSelect(value);
                }
            },
            onCancel: () => {
                if (typeof options.onCancel === 'function') {
                    options.onCancel();
                }
            }
        });
    },

    openConfirmPrompt(titleText, messageText, onDecision = null, options = {}) {
        return this.openChoicePrompt(
            titleText,
            messageText,
            [
                { label: options.confirmLabel || 'Confirm', value: true, primary: true },
                { label: options.cancelLabel || 'Cancel', value: false, cancel: true }
            ],
            (value) => {
                if (typeof onDecision === 'function') {
                    onDecision(Boolean(value));
                }
            },
            {
                onCancel: () => {
                    if (typeof onDecision === 'function') {
                        onDecision(false);
                    }
                }
            }
        );
    },

    openTextPrompt(titleText, messageText, defaultValue = '', onSubmit = null, options = {}) {
        return this.openGamePrompt({
            titleText,
            messageText,
            useInput: true,
            defaultValue,
            placeholder: options.placeholder || '',
            buttons: [
                { label: options.confirmLabel || 'OK', value: '__INPUT__', primary: true },
                { label: options.cancelLabel || 'Cancel', value: null, cancel: true }
            ],
            onSubmit: (value) => {
                if (typeof onSubmit === 'function') {
                    onSubmit(value);
                }
            },
            onCancel: () => {
                if (typeof options.onCancel === 'function') {
                    options.onCancel();
                }
            }
        });
    },

    toggleStatsOverlay() {
        this.statsOpen = !this.statsOpen;
        this.applyOverlayVisibility();
    },

    toggleMessagesOverlay() {
        this.messagesOpen = !this.messagesOpen;
        this.applyOverlayVisibility();
    },

    toggleMapOverlay() {
        this.mapOpen = !this.mapOpen;
        if (this.mapOpen) {
            this.haltPlayerMovementForPopup();
        } else {
            this.focusGameSurface();
        }

        this.renderCurrentGameState();
    },

    isBlockingOverlayOpen(options = {}) {
        const { includeMap = false } = options;
        return Boolean(
            this.game?.inventoryOpen
            || this.gamePromptOpen
            || this.settingsOpen
            || this.dungeonSelectionOpen
            || (includeMap && this.mapOpen)
        );
    },

    shouldBlockGameplayInput(key, lowerKey) {
        const action = getInputActionForKey(lowerKey);

        if (this.game?.inventoryOpen) {
            return key !== 'Escape' && action !== 'open-inventory';
        }

        if (this.gamePromptOpen || this.settingsOpen || this.dungeonSelectionOpen) {
            return key !== 'Escape';
        }

        if (this.mapOpen) {
            return key !== 'Escape' && action !== 'toggle-map';
        }

        return false;
    },

    closeTopmostOverlay() {
        if (this.gamePromptOpen) {
            this.closeGamePrompt({ invokeCancel: true });
            return true;
        }

        if (this.game?.inventoryOpen) {
            this.closeInventory?.();
            return true;
        }

        if (this.settingsOpen) {
            this.closeSettings();
            return true;
        }

        if (this.dungeonSelectionOpen) {
            this.closeDungeonSelection();
            return true;
        }

        if (this.mapOpen) {
            this.mapOpen = false;
            this.renderCurrentGameState();
            this.focusGameSurface();
            return true;
        }

        return false;
    },

    closeAuxiliaryOverlays() {
        let closedAny = false;

        while (this.closeTopmostOverlay()) {
            closedAny = true;
        }

        if (this.statsOpen || this.messagesOpen) {
            this.statsOpen = false;
            this.messagesOpen = false;
            this.applyOverlayVisibility();
            closedAny = true;
        }

        return closedAny;
    },

    openSettings() {
        const { modal, descendImmediately, alliesPassive } = this.getSettingsElements();
        if (!modal) return;
        this.haltPlayerMovementForPopup();
        if (descendImmediately && this.game?.settings) {
            descendImmediately.checked = this.game.settings.autoExploreDescendImmediately;
        }
        if (alliesPassive && this.game?.settings) {
            alliesPassive.checked = this.game.settings.alliesPassive;
        }
        modal.style.display = 'block';
        this.settingsOpen = true;
    },

    openDungeonSelection(options = [], onSelect = null) {
        const { modal, list } = this.getDungeonSelectionElements();
        if (!modal || !list) {
            return;
        }

        this.haltPlayerMovementForPopup();

        const normalizedOptions = Array.isArray(options)
            ? options.filter((option) => option && typeof option.id === 'string')
            : [];

        list.innerHTML = '';
        for (const option of normalizedOptions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'dungeon-selection-option';
            button.textContent = String(option.name || option.id);
            button.addEventListener('click', () => {
                if (typeof onSelect === 'function') {
                    onSelect(option.id);
                }
                this.closeDungeonSelection();
            });
            list.appendChild(button);
        }

        modal.style.display = 'block';
        this.dungeonSelectionOpen = true;
    },

    closeDungeonSelection() {
        const { modal } = this.getDungeonSelectionElements();
        if (!modal) {
            return;
        }

        modal.style.display = 'none';
        this.dungeonSelectionOpen = false;
        this.focusGameSurface();
    },

    closeSettings() {
        const { modal, descendImmediately, alliesPassive } = this.getSettingsElements();
        if (!modal) return;

        this.game?.applySettingsChanges?.({
            autoExploreDescendImmediately: Boolean(descendImmediately?.checked),
            alliesPassive: Boolean(alliesPassive?.checked)
        });

        modal.style.display = 'none';
        this.settingsOpen = false;
        this.focusGameSurface();
    },

    getFocusRestoreTarget() {
        return this.game?.canvas
            || this.pixiOverlay?.app?.view
            || this.pixiOverlayHost
            || null;
    },

    focusGameSurface() {
        const focusTarget = this.getFocusRestoreTarget();
        if (!focusTarget || typeof focusTarget.focus !== 'function') {
            return;
        }

        if (typeof focusTarget.hasAttribute === 'function' && !focusTarget.hasAttribute('tabindex')) {
            focusTarget.setAttribute('tabindex', '0');
        }

        window.requestAnimationFrame(() => {
            focusTarget.focus();
        });
    },

    runNativePrompt(callback) {
        this.haltPlayerMovementForPopup();
        const result = typeof callback === 'function' ? callback() : null;
        this.game?.inputController?.reset?.();
        this.focusGameSurface();
        return result;
    },

    confirmPickupShopItem(item, price, message, onDecision = null) {
        const itemName = item?.getDisplayName?.() || item?.name || 'item';
        const promptText = message || `This item costs ${price} gold. Pick up ${itemName}?`;

        if (typeof onDecision === 'function') {
            this.openConfirmPrompt('Shop item', promptText, onDecision, {
                confirmLabel: 'Pick up',
                cancelLabel: 'Leave it'
            });
            return null;
        }

        return false;
    },

    buildShopSettlementPromptText(shopkeeperName, settlementSummary, buyTotal, sellTotal, balanceLine, footerLine) {
        const sections = [
            `${shopkeeperName}: Let's settle up.`,
            settlementSummary || 'No items selected.',
            `Buying total: ${buyTotal} money`,
            `Selling total: ${sellTotal} money`,
            balanceLine || 'This is an even trade.'
        ];

        if (footerLine) {
            sections.push(footerLine);
        }

        return sections.join('\n\n');
    },

    confirmShopSettlement(shopkeeperName, settlementSummary, buyTotal, sellTotal, balanceLine, onDecision = null) {
        const promptText = this.buildShopSettlementPromptText(
            shopkeeperName,
            settlementSummary,
            buyTotal,
            sellTotal,
            balanceLine,
            'Complete the transaction?'
        );

        if (typeof onDecision === 'function') {
            this.openConfirmPrompt(shopkeeperName || 'Shopkeeper', promptText, onDecision, {
                confirmLabel: 'Settle up',
                cancelLabel: 'Later'
            });
            return null;
        }

        return false;
    },

    promptShopExitDecision(shopkeeperName, settlementSummary, buyTotal, sellTotal, balanceLine, onDecision = null) {
        const promptText = this.buildShopSettlementPromptText(
            shopkeeperName,
            settlementSummary,
            buyTotal,
            sellTotal,
            balanceLine,
            'Choose what to do:'
        );

        if (typeof onDecision === 'function') {
            this.openChoicePrompt(
                shopkeeperName || 'Shopkeeper',
                promptText,
                [
                    { label: 'Pay now', value: 'yes', primary: true },
                    { label: 'Stay in shop', value: 'no', cancel: true },
                    { label: 'Run away', value: 'run-away' }
                ],
                (value) => onDecision(String(value || 'no')),
                {
                    onCancel: () => onDecision('no')
                }
            );
            return null;
        }

        return 'no';
    },

    updateInfoPanel(player, world, fov) {
        if (!world) return;
        const areaType = world.getAreaType(world.currentFloor);
        const playerBlind = this.isActorBlind(player);
        const conditionText = this.formatActorConditionText(player);
        const allies = this.getPlayerAllies(player, { aliveOnly: true });
        const visibleEnemyLines = [];
        if (!playerBlind) {
            for (const enemy of world.getEnemies()) {
                if (enemy?.isAlly) continue;
                if (!this.isEnemyVisibleInFov(enemy, fov)) continue;
                const aiState = enemy.lastResolvedAi || enemy.baseAiType || enemy.aiType || AI_TYPES.WANDER;
                const fuserSummary = this.getFuserFusionSummary(enemy);
                const displayName = this.getEnemyDisplayName(enemy);
                visibleEnemyLines.push(`${displayName} (${enemy.x},${enemy.y}) - ${aiState}${fuserSummary}`);
            }
        }

        const enemyDebugHtml = visibleEnemyLines.length > 0
            ? visibleEnemyLines.map((line) => `<p>${line}</p>`).join('')
            : '<p>(none visible)</p>';
        const allyDebugHtml = allies.length > 0
            ? allies.map((ally) => {
                const allyConditionText = this.formatActorConditionText(ally);
                const allyPower = typeof ally.getAttackPower === 'function' ? ally.getAttackPower() : ally.power;
                const allyArmor = typeof ally.getEffectiveArmor === 'function' ? ally.getEffectiveArmor() : ally.armor;
                return `<p>${ally.name}: HP ${ally.health}/${ally.maxHealth}, LV ${ally.allyLevel}, EXP ${ally.allyExp}/${ally.allyExpToNextLevel}, POW ${allyPower}, ARM ${allyArmor}, Conditions ${allyConditionText}</p>`;
            }).join('')
            : '<p>(none)</p>';

        const floorLabel = typeof this.game?.getDisplayFloorLabel === 'function'
            ? this.game.getDisplayFloorLabel(world.currentFloor)
            : String(world.currentFloor + 1);
        const activeQuest = player?.questgiverState?.activeQuest || null;
        const activeQuestText = activeQuest
            ? (typeof this.game?.describeQuestgiverQuest === 'function'
                ? this.game.describeQuestgiverQuest(activeQuest)
                : (activeQuest.display || 'Active quest'))
            : 'none';
        const undoCount = typeof this.game?.getAvailableUndoCount === 'function'
            ? this.game.getAvailableUndoCount()
            : 0;
        const undoCapacity = Math.max(1, Math.floor(Number(this.game?.maxUndoStates) || 5));
        const statsDiv = this.statsDiv;
        if (!statsDiv) return;
        const weatherName = this.getWeatherDisplayName(world);
        statsDiv.innerHTML = `
            <h3>Player Stats</h3>
            <p>Level: ${player.level}</p>
            <p>EXP: ${player.exp}/${player.expToNextLevel}</p>
            <p>Money: ${player.money || 0}</p>
            <p>Health: ${player.health}/${player.maxHealth}</p>
            <p>Hunger: ${player.hunger}/${player.maxHunger}</p>
            <p>Power: ${player.power}</p>
            <p>Armor: ${player.armor}</p>
            <p>Conditions: ${conditionText}</p>
            <p>Floor: ${floorLabel}</p>
            <p>Area: ${areaType}</p>
            <p>Weather: ${weatherName}</p>
            <p>Allies: ${allies.length}</p>
            <p>Position: ${player.x}, ${player.y}</p>
            <p>Quest: ${activeQuestText}</p>
            <p>Undos: ${undoCount}/${undoCapacity}</p>
            <h3>Allies</h3>
            ${allyDebugHtml}
            <h3>Visible Enemies</h3>
            ${enemyDebugHtml}
        `;

        this.renderMessages();
    },

    addMessage(message) {
        if (typeof message !== 'string' || message.length === 0) {
            return;
        }

        this.messages.push(message);
        this.renderMessages();
    },

    renderMessages() {
        if (!this.messagesDiv) {
            return;
        }

        this.messagesDiv.innerHTML = '<h3>Messages</h3>' + this.messages.slice(-10).reverse().map((msg) => `<p>${msg}</p>`).join('');
    }
});
