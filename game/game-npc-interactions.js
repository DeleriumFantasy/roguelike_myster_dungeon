// NPC conversation, shop, and banking helpers

Object.assign(Game.prototype, {
    isFoodItemForNpcTrade(item) {
        return Boolean(
            item
            && item.type === ITEM_TYPES.CONSUMABLE
            && Number(item?.properties?.hunger || 0) > 0
        );
    },

    getFoodTierForNpcTrade(item) {
        const match = typeof getTieredItemMatch === 'function'
            ? getTieredItemMatch(item)
            : null;
        if (match?.category === 'food' && Number.isFinite(match.tier)) {
            return clamp(Math.floor(match.tier), 1, 4);
        }

        const hunger = Number(item?.properties?.hunger || 0);
        if (hunger >= 50) {
            return 4;
        }
        if (hunger >= 20) {
            return 3;
        }
        if (hunger >= 10) {
            return 2;
        }
        return 1;
    },

    promptForInventoryItem(enemy, header, itemFilter = () => true) {
        const inventory = Array.isArray(this.player.getInventory()) ? this.player.getInventory() : [];
        const filteredItems = inventory.filter((item) => itemFilter(item));

        if (filteredItems.length === 0) {
            return null;
        }

        const indexedList = filteredItems
            .map((item, index) => `${index + 1}) ${getItemLabel(item)}`)
            .join('\n');
        const choiceValue = window.prompt(`${enemy.name}: ${header}\n${indexedList}\nChoose item number:`, '1');
        const selectedIndex = Math.floor(Number(choiceValue)) - 1;
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= filteredItems.length) {
            return null;
        }

        return filteredItems[selectedIndex] || null;
    },

    createNpcRewardEquipmentForTier(tier, rng = null) {
        const rewardCategories = [
            ITEM_TYPES.WEAPON,
            ITEM_TYPES.ARMOR,
            ITEM_TYPES.SHIELD,
            ITEM_TYPES.ACCESSORY
        ];

        const availableCategories = rewardCategories.filter((category) => {
            return Boolean(TIERED_ITEM_DEFINITIONS?.[category]?.[tier]);
        });

        if (availableCategories.length === 0) {
            return null;
        }

        const category = pickRandom(availableCategories, rng || createMathRng());
        return createTieredItem(category, tier);
    },

    completeOneTimeNpcInteraction(enemy) {
        if (!enemy) {
            return;
        }

        enemy.shopSoldOut = true;
        enemy.shopOfferItem = null;
        enemy.shopOfferPrice = null;
    },

    interactWithStarvingNpc(enemy) {
        const selectedFood = this.promptForInventoryItem(
            enemy,
            'I am starving. Please offer one food item.',
            (item) => this.isFoodItemForNpcTrade(item)
        );

        if (!selectedFood) {
            this.ui.addMessage(`${enemy.name}: I can only accept food.`);
            return;
        }

        this.player.removeItem(selectedFood);
        const foodTier = this.getFoodTierForNpcTrade(selectedFood);
        const rewardItem = this.createNpcRewardEquipmentForTier(foodTier);
        if (rewardItem) {
            this.player.addItem(rewardItem);
            this.ui.addMessage(`${enemy.name}: Thank you. Please take ${getItemLabel(rewardItem)}.`);
        } else {
            this.ui.addMessage(`${enemy.name}: Thank you for the meal.`);
        }

        this.completeOneTimeNpcInteraction(enemy);
    },

    interactWithHomeboundNpc(enemy) {
        const selectedItem = this.promptForInventoryItem(
            enemy,
            'I can send one item safely to your bank.',
            () => true
        );

        if (!selectedItem) {
            this.ui.addMessage(`${enemy.name}: Choose one item if you want me to carry it home.`);
            return;
        }

        this.player.removeItem(selectedItem);
        this.player.bankItems.push(selectedItem);
        this.ui.addMessage(`${enemy.name}: ${getItemLabel(selectedItem)} is now stored in your bank.`);
        this.completeOneTimeNpcInteraction(enemy);
    },

    interactWithShamanNpc(enemy) {
        const inventory = Array.isArray(this.player.getInventory()) ? this.player.getInventory() : [];
        const cursedItems = inventory.filter((item) => {
            if (!item) {
                return false;
            }

            if (typeof item.isCursed === 'function') {
                return item.isCursed();
            }

            return Boolean(item?.properties?.cursed);
        });

        if (cursedItems.length === 0) {
            this.ui.addMessage(`${enemy.name}: Return when you carry a cursed item.`);
            return;
        }

        const targetItem = pickRandom(cursedItems, createMathRng());
        if (targetItem?.properties) {
            delete targetItem.properties.cursed;
        }

        this.ui.addMessage(`${enemy.name}: I have cleansed ${getItemLabel(targetItem)}.`);
        this.completeOneTimeNpcInteraction(enemy);
    },

    tryTalkToFacingNpc(facing) {
        const targetX = this.player.x + (Number(facing?.dx) || 0);
        const targetY = this.player.y + (Number(facing?.dy) || 0);
        const enemy = this.world.getEnemyAt(targetX, targetY);
        if (!this.isNeutralNpcEnemy(enemy)) {
            return false;
        }

        if (enemy.monsterType === 'npcBankerTier1') {
            this.interactWithBanker(enemy);
            return true;
        }

        if (enemy.monsterType === 'npcStarvingTier1') {
            this.interactWithStarvingNpc(enemy);
            return true;
        }

        if (enemy.monsterType === 'npcHomeboundTier1') {
            this.interactWithHomeboundNpc(enemy);
            return true;
        }

        if (enemy.monsterType === 'npcShamanTier1') {
            this.interactWithShamanNpc(enemy);
            return true;
        }

        if (enemy.shopSoldOut) {
            this.ui.addMessage(`${enemy.name}: Thanks.`);
            return true;
        }

        if (!enemy.shopOfferItem) {
            this.generateNpcOffer(enemy);
        }

        if (!enemy.shopOfferItem || !Number.isFinite(enemy.shopOfferPrice)) {
            this.ui.addMessage(`${enemy.name}: I have nothing to sell right now.`);
            return true;
        }

        const itemLabel = getItemLabel(enemy.shopOfferItem);
        const price = enemy.shopOfferPrice;
        const confirmed = window.confirm(`${enemy.name} offers ${itemLabel} for ${price} money. Buy it?`);
        if (!confirmed) {
            this.ui.addMessage(`${enemy.name}: Maybe next time.`);
            return true;
        }

        if ((this.player.money || 0) < price) {
            this.ui.addMessage(`${enemy.name}: You don't have enough money.`);
            return true;
        }

        this.player.money -= price;
        this.player.addItem(enemy.shopOfferItem);
        this.ui.addMessage(`You buy ${itemLabel} for ${price} money.`);
        enemy.shopOfferItem = null;
        enemy.shopOfferPrice = null;
        enemy.shopSoldOut = true;
        return true;
    },

    interactWithBanker(enemy) {
        const bankBalance = Math.max(0, Math.floor(Number(this.player.bankMoney) || 0));
        const options = [
            '1) Deposit money',
            `2) Withdraw money (${bankBalance})`,
            '3) Store item',
            '4) Withdraw item',
            '5) Cancel'
        ];
        const choice = window.prompt(`${enemy.name}: Welcome.\n${options.join('\n')}\nChoose an option (1-5):`, '5');
        const normalizedChoice = String(choice || '').trim();

        if (normalizedChoice === '1') {
            this.handleBankMoneyDeposit(enemy);
            return;
        }

        if (normalizedChoice === '2') {
            this.handleBankMoneyWithdraw(enemy);
            return;
        }

        if (normalizedChoice === '3') {
            this.handleBankItemDeposit(enemy);
            return;
        }

        if (normalizedChoice === '4') {
            this.handleBankItemWithdraw(enemy);
            return;
        }

        this.ui.addMessage(`${enemy.name}: Come back any time.`);
    },

    handleBankMoneyDeposit(enemy) {
        const available = Math.max(0, Math.floor(Number(this.player.money) || 0));
        if (available <= 0) {
            this.ui.addMessage(`${enemy.name}: You have no money to deposit.`);
            return;
        }

        const promptValue = window.prompt(`${enemy.name}: You carry ${available} money. Deposit how much?`, String(available));
        const amount = Math.floor(Number(promptValue));
        if (!Number.isFinite(amount) || amount <= 0) {
            this.ui.addMessage(`${enemy.name}: Deposit canceled.`);
            return;
        }

        const safeAmount = Math.min(amount, available);
        this.player.money -= safeAmount;
        this.player.bankMoney = Math.max(0, Math.floor(Number(this.player.bankMoney) || 0)) + safeAmount;
        this.ui.addMessage(`${enemy.name}: Stored ${safeAmount} money. Bank balance: ${this.player.bankMoney}.`);
    },

    handleBankMoneyWithdraw(enemy) {
        const available = Math.max(0, Math.floor(Number(this.player.bankMoney) || 0));
        if (available <= 0) {
            this.ui.addMessage(`${enemy.name}: Your bank account is empty.`);
            return;
        }

        const promptValue = window.prompt(`${enemy.name}: Your bank balance is ${available}. Withdraw how much?`, String(available));
        const amount = Math.floor(Number(promptValue));
        if (!Number.isFinite(amount) || amount <= 0) {
            this.ui.addMessage(`${enemy.name}: Withdrawal canceled.`);
            return;
        }

        const safeAmount = Math.min(amount, available);
        this.player.bankMoney -= safeAmount;
        this.player.money = Math.max(0, Math.floor(Number(this.player.money) || 0)) + safeAmount;
        this.ui.addMessage(`${enemy.name}: Withdrew ${safeAmount} money. Bank balance: ${this.player.bankMoney}.`);
    },

    handleBankItemDeposit(enemy) {
        const inventory = this.player.getInventory();
        if (!Array.isArray(inventory) || inventory.length === 0) {
            this.ui.addMessage(`${enemy.name}: You have no items to store.`);
            return;
        }

        const indexedList = inventory
            .map((item, index) => `${index + 1}) ${getItemLabel(item)}`)
            .join('\n');
        const choiceValue = window.prompt(`${enemy.name}: Which item should I store?\n${indexedList}\nChoose item number:`, '1');
        const selectedIndex = Math.floor(Number(choiceValue)) - 1;
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= inventory.length) {
            this.ui.addMessage(`${enemy.name}: Storage canceled.`);
            return;
        }

        const selectedItem = inventory[selectedIndex];
        this.player.removeItem(selectedItem);
        this.player.bankItems.push(selectedItem);
        this.ui.addMessage(`${enemy.name}: Stored ${getItemLabel(selectedItem)}.`);
    },

    handleBankItemWithdraw(enemy) {
        const storedItems = this.player.bankItems;
        if (!Array.isArray(storedItems) || storedItems.length === 0) {
            this.ui.addMessage(`${enemy.name}: You have no stored items.`);
            return;
        }

        const indexedList = storedItems
            .map((item, index) => `${index + 1}) ${getItemLabel(item)}`)
            .join('\n');
        const choiceValue = window.prompt(`${enemy.name}: Which stored item do you want back?\n${indexedList}\nChoose item number:`, '1');
        const selectedIndex = Math.floor(Number(choiceValue)) - 1;
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= storedItems.length) {
            this.ui.addMessage(`${enemy.name}: Withdrawal canceled.`);
            return;
        }

        const [selectedItem] = storedItems.splice(selectedIndex, 1);
        this.player.addItem(selectedItem);
        this.ui.addMessage(`${enemy.name}: Returned ${getItemLabel(selectedItem)}.`);
    },

    generateNpcOffer(enemy) {
        if (!enemy) {
            return;
        }

        const rng = createMathRng();

        let offeredItem = null;
        for (let attempt = 0; attempt < 8; attempt++) {
            const candidate = this.createRandomItemForFloor(rng, this.getDungeonDepthIndex());
            if (!candidate) {
                continue;
            }

            if (candidate.type === ITEM_TYPES.MONEY) {
                continue;
            }

            offeredItem = candidate;
            break;
        }

        if (!offeredItem) {
            return;
        }

        enemy.shopOfferItem = offeredItem;
        enemy.shopOfferPrice = randomInt(10, 100) * Math.max(1, this.world.currentFloor);
    }
});
