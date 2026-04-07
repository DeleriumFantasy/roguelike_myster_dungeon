// Enemy ally progression and equipment helpers

Object.assign(Enemy.prototype, {
    canBeTamed() {
        return this.isAlive() && !this.isAlly && !this.isNeutralNpc();
    },

    getTameThreshold() {
        return this.tameThreshold;
    },

    getMonsterTier() {
        return this.getTierFromMonsterType(/Tier(\d+)/i, 1);
    },

    getAllyExpProgressionMultiplier() {
        const tier = this.getMonsterTier();
        if (tier <= 1) {
            return 1;
        }

        return 1 + (tier - 1) * 0.5;
    },

    getAllyExpToNextLevel() {
        const baseRequirement = getExpRequiredForPlayerLevel(this.allyLevel + 1);
        const scaledRequirement = Math.floor(baseRequirement * this.getAllyExpProgressionMultiplier());
        return Math.max(1, scaledRequirement);
    },

    applyAllyLevelUpRewards() {
        this.maxHealth += 3;
        this.health = Math.min(this.maxHealth, this.health + 3);
        this.power += 1;
        if (this.allyLevel % 3 === 0) {
            this.armor += 1;
        }
    },

    allyLevelUpOnce() {
        this.allyExp -= this.allyExpToNextLevel;
        this.allyLevel += 1;
        this.allyExpToNextLevel = this.getAllyExpToNextLevel();
        this.applyAllyLevelUpRewards();
    },

    addAllyExp(amount) {
        if (!this.isAlly) {
            return 0;
        }

        const expAmount = Math.max(0, Math.floor(Number(amount) || 0));
        if (expAmount <= 0) {
            return 0;
        }

        this.allyExp += expAmount;
        let levelUps = 0;
        while (this.allyExp >= this.allyExpToNextLevel) {
            this.allyLevelUpOnce();
            levelUps += 1;
        }

        return levelUps;
    },

    tame(tamer) {
        this.isAlly = true;
        this.tamedBy = tamer || null;
        this.baseAiType = AI_TYPES.GUARD;
        this.aiType = AI_TYPES.GUARD;
        this.allyLevel = Math.max(1, Math.floor(Number(this.allyLevel) || 1));
        this.allyExp = Math.max(0, Math.floor(Number(this.allyExp) || 0));
        this.allyExpToNextLevel = this.getAllyExpToNextLevel();
        this.conditions.delete(CONDITIONS.FRIGHTENED);
        if (tamer && typeof tamer.addAlly === 'function') {
            tamer.addAlly(this);
        }
    },

    untame() {
        if (this.tamedBy && typeof this.tamedBy.removeAlly === 'function') {
            this.tamedBy.removeAlly(this);
        }
        this.isAlly = false;
        this.tamedBy = null;
    },

    equipItem(item) {
        if (!this.isAlly || !item) {
            return false;
        }

        if (!isEquippableItemType(item.type)) {
            return false;
        }

        const currentItem = this.equipment.get(item.type);
        const currentItemIsCursed = getItemCursedState(currentItem);
        if (currentItem && currentItemIsCursed) {
            return false;
        }

        this.equipment.set(item.type, item);
        return true;
    },

    unequipSlot(slot) {
        const item = this.equipment.get(slot);
        if (!item) {
            return true;
        }

        if (getItemCursedState(item)) {
            return false;
        }

        this.equipment.delete(slot);
        return true;
    }
});
