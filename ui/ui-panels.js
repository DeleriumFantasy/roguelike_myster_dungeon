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

    toggleStatsOverlay() {
        this.statsOpen = !this.statsOpen;
        this.applyOverlayVisibility();
    },

    toggleMessagesOverlay() {
        this.messagesOpen = !this.messagesOpen;
        this.applyOverlayVisibility();
    },

    closeAuxiliaryOverlays() {
        let closedAny = false;

        if (this.mapOpen) {
            this.closeMap();
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

    updateInfoPanel(player, world, fov) {
        const areaType = world.getAreaType(world.currentFloor);
        const playerBlind = this.isActorBlind(player);
        const conditionEntries = Array.from(player.conditions.entries());
        const conditionText = conditionEntries.length > 0
            ? conditionEntries.map(([condition, duration]) => `${condition} (${duration})`).join(', ')
            : 'none';
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

        const floorLabel = typeof this.game?.getDisplayFloorLabel === 'function'
            ? this.game.getDisplayFloorLabel(world.currentFloor)
            : String(world.currentFloor + 1);
        const activeQuest = player?.questgiverState?.activeQuest || null;
        const activeQuestText = activeQuest
            ? (typeof this.game?.describeQuestgiverQuest === 'function'
                ? this.game.describeQuestgiverQuest(activeQuest)
                : (activeQuest.display || 'Active quest'))
            : 'none';
        const statsDiv = this.statsDiv;
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
            <p>Allies: ${player.allies.length}</p>
            <p>Position: ${player.x}, ${player.y}</p>
            <p>Quest: ${activeQuestText}</p>
            <h3>Visible Enemies</h3>
            ${enemyDebugHtml}
        `;

        this.renderMessages();
    },

    addMessage(message) {
        this.messages.push(message);
        this.renderMessages();
    },

    renderMessages() {
        this.messagesDiv.innerHTML = '<h3>Messages</h3>' + this.messages.slice(-10).map((msg) => `<p>${msg}</p>`).join('');
    }
});
