// Player progression helpers

Object.assign(Player.prototype, {
    getExpToNextLevel() {
        return getExpRequiredForPlayerLevel(this.level + 1);
    },

    applyLevelUpRewards() {
        this.maxHealth += 5;
        this.health = this.maxHealth;
        this.power += 1;
    },

    levelUpOnce() {
        this.exp -= this.expToNextLevel;
        this.level += 1;
        this.expToNextLevel = this.getExpToNextLevel();
        this.applyLevelUpRewards();
    },

    addExp(amount) {
        if (typeof amount !== 'number' || amount <= 0) {
            return 0;
        }

        this.exp += amount;
        let levelUps = 0;

        while (this.exp >= this.expToNextLevel) {
            this.levelUpOnce();
            levelUps += 1;
        }

        return levelUps;
    }
});
