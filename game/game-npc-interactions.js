// NPC conversation, shop, and banking helpers

const QUESTGIVER_QUEST_POOLS = {
    hunt: [
        { targetTypeKey: 'slimeTier1', minFloor: 1, requiredCount: 4, rewardMoney: 40, rewardTier: 1 },
        { targetTypeKey: 'beastTier1', minFloor: 1, requiredCount: 3, rewardMoney: 55, rewardTier: 1 },
        { targetTypeKey: 'ghostTier1', minFloor: 1, requiredCount: 2, rewardMoney: 70, rewardTier: 2 },
        { targetTypeKey: 'thiefTier1', minFloor: 1, requiredCount: 2, rewardMoney: 80, rewardTier: 2 },
        { targetTypeKey: 'fuserTier1', minFloor: 2, requiredCount: 2, rewardMoney: 110, rewardTier: 2 },
        { targetTypeKey: 'pariahTier1', minFloor: 2, requiredCount: 2, rewardMoney: 120, rewardTier: 2 }
    ],
    allyRetrieval: [
        { targetTypeKey: 'slimeTier1', minAllyLevel: 2, rewardMoney: 65, rewardTier: 1 },
        { targetTypeKey: 'beastTier1', minAllyLevel: 2, rewardMoney: 85, rewardTier: 1 },
        { targetTypeKey: 'aquaticTier1', minAllyLevel: 3, rewardMoney: 95, rewardTier: 2 },
        { targetTypeKey: 'floatingTier1', minAllyLevel: 3, rewardMoney: 105, rewardTier: 2 }
    ],
    escort: [
        { minFloor: 1, targetAdvanceMin: 2, targetAdvanceMax: 3, rewardMoney: 90, rewardTier: 1 },
        { minFloor: 3, targetAdvanceMin: 3, targetAdvanceMax: 4, rewardMoney: 135, rewardTier: 2 },
        { minFloor: 6, targetAdvanceMin: 4, targetAdvanceMax: 5, rewardMoney: 200, rewardTier: 3 }
    ]
};

Object.assign(Game.prototype, {
    ensureQuestgiverState() {
        if (!this.player.questgiverState) {
            this.player.questgiverState = {
                activeQuest: null,
                completedQuestCount: 0,
                nextQuestId: 1,
                deepestDungeonFloorReached: 0,
                deepestDungeonFloorReachedByPath: {}
            };
        }

        if (!this.player.questgiverState.deepestDungeonFloorReachedByPath || typeof this.player.questgiverState.deepestDungeonFloorReachedByPath !== 'object') {
            this.player.questgiverState.deepestDungeonFloorReachedByPath = {};
        }

        return this.player.questgiverState;
    },

    getQuestgiverTargetName(enemyTypeKey) {
        return ENEMY_TEMPLATES?.[enemyTypeKey]?.displayName || String(enemyTypeKey || 'target');
    },

    getQuestgiverTargetPathId(rng = createMathRng()) {
        const options = this.world?.getDungeonPathOptions?.() || [];
        const selectedPathId = this.world?.getSelectedDungeonPathId?.();
        const validSelectedPath = typeof selectedPathId === 'string' && options.some((option) => option?.id === selectedPathId)
            ? selectedPathId
            : null;

        if (!Array.isArray(options) || options.length === 0) {
            return validSelectedPath || getDefaultDungeonPathId();
        }

        const pickedOption = pickRandom(options, rng, options[0]);
        return pickedOption?.id || validSelectedPath || options[0].id;
    },

    getQuestgiverTargetPathName(pathId) {
        const definition = getDungeonPathDefinition(pathId);
        return typeof definition?.name === 'string' ? definition.name : String(pathId || 'Unknown path');
    },

    getQuestgiverTargetProgressFloor(pathId = this.world?.getSelectedDungeonPathId?.()) {
        const questState = this.ensureQuestgiverState();
        const key = typeof pathId === 'string' ? pathId : this.world?.getSelectedDungeonPathId?.();
        const byPath = questState.deepestDungeonFloorReachedByPath || {};
        return Math.max(1, Math.floor(Number(byPath[key]) || 0) + 1);
    },

    getQuestgiverEligibleEntries(poolKey, pathId = this.world?.getSelectedDungeonPathId?.()) {
        const questPool = QUESTGIVER_QUEST_POOLS[poolKey] || [];
        const progressFloor = this.getQuestgiverTargetProgressFloor(pathId);

        return questPool.filter((entry) => progressFloor >= Math.max(1, Number(entry.minFloor) || 1));
    },

    buildQuestgiverHuntQuest(rng) {
        const targetPathId = this.getQuestgiverTargetPathId(rng);
        const eligibleEntries = this.getQuestgiverEligibleEntries('hunt', targetPathId);
        const chosenEntry = pickRandom(eligibleEntries, rng, eligibleEntries[0]);
        if (!chosenEntry) {
            return null;
        }

        const targetFloor = Math.max(
            Math.max(1, Number(chosenEntry.minFloor) || 1),
            this.getQuestgiverTargetProgressFloor(targetPathId)
        );

        return {
            id: this.ensureQuestgiverState().nextQuestId++,
            type: 'hunt',
            targetPathId,
            targetFloor,
            targetTypeKey: chosenEntry.targetTypeKey,
            targetName: this.getQuestgiverTargetName(chosenEntry.targetTypeKey),
            requiredCount: Math.max(1, Math.floor(Number(chosenEntry.requiredCount) || 1)),
            currentCount: 0,
            rewardMoney: Math.max(0, Math.floor(Number(chosenEntry.rewardMoney) || 0)),
            rewardTier: Math.max(1, Math.floor(Number(chosenEntry.rewardTier) || 1))
        };
    },

    buildQuestgiverAllyRetrievalQuest(rng) {
        const eligibleEntries = QUESTGIVER_QUEST_POOLS.allyRetrieval || [];
        const chosenEntry = pickRandom(eligibleEntries, rng, eligibleEntries[0]);
        if (!chosenEntry) {
            return null;
        }

        return {
            id: this.ensureQuestgiverState().nextQuestId++,
            type: 'ally-retrieval',
            targetTypeKey: chosenEntry.targetTypeKey,
            targetName: this.getQuestgiverTargetName(chosenEntry.targetTypeKey),
            minAllyLevel: Math.max(1, Math.floor(Number(chosenEntry.minAllyLevel) || 1)),
            rewardMoney: Math.max(0, Math.floor(Number(chosenEntry.rewardMoney) || 0)),
            rewardTier: Math.max(1, Math.floor(Number(chosenEntry.rewardTier) || 1))
        };
    },

    buildQuestgiverExploreQuest(rng) {
        const questState = this.ensureQuestgiverState();
        const targetPathId = this.getQuestgiverTargetPathId(rng);
        const deepestReached = Math.max(0, this.getQuestgiverTargetProgressFloor(targetPathId) - 1);
        const pathMaxDepth = getDungeonPathMaxDepth(targetPathId);
        const maxTargetFloor = Number.isFinite(pathMaxDepth) ? pathMaxDepth : 99;
        const targetFloor = clamp(deepestReached + getRngRandomInt(rng, 1, 2), 1, maxTargetFloor);
        const rewardTier = clamp(Math.ceil(targetFloor / 3), 1, 4);

        return {
            id: questState.nextQuestId++,
            type: 'explore-floor',
            targetPathId,
            targetFloor,
            rewardMoney: 50 + targetFloor * 15,
            rewardTier
        };
    },

    buildQuestgiverEscortQuest(rng) {
        const targetPathId = this.getQuestgiverTargetPathId(rng);
        const eligibleEntries = this.getQuestgiverEligibleEntries('escort', targetPathId);
        const chosenEntry = pickRandom(eligibleEntries, rng, eligibleEntries[0]);
        if (!chosenEntry) {
            return null;
        }

        const progressFloor = this.getQuestgiverTargetProgressFloor(targetPathId);
        const pathMaxDepth = getDungeonPathMaxDepth(targetPathId);
        const targetAdvance = getRngRandomInt(
            rng,
            Math.max(0, Math.floor(Number(chosenEntry.targetAdvanceMin) || 0)),
            Math.max(0, Math.floor(Number(chosenEntry.targetAdvanceMax) || 0))
        );
        const maxTargetFloor = Number.isFinite(pathMaxDepth) ? pathMaxDepth : 99;
        const targetFloor = clamp(progressFloor + targetAdvance, 1, maxTargetFloor);

        return {
            id: this.ensureQuestgiverState().nextQuestId++,
            type: 'escort-npc',
            targetPathId,
            escortTypeKey: 'escortPassengerTier1',
            escortName: this.getQuestgiverTargetName('escortPassengerTier1'),
            targetFloor,
            completed: false,
            rewardMoney: Math.max(0, Math.floor(Number(chosenEntry.rewardMoney) || 0)) + targetFloor * 10,
            rewardTier: Math.max(1, Math.floor(Number(chosenEntry.rewardTier) || 1))
        };
    },

    getQuestEscortAlly(quest = this.ensureQuestgiverState().activeQuest) {
        if (!quest || quest.type !== 'escort-npc') {
            return null;
        }

        const allies = Array.isArray(this.player?.allies) ? this.player.allies : [];
        return allies.find((ally) => ally?.isAlive?.() && ally.questEscortId === quest.id) || null;
    },

    removeEnemyFromAllFloors(enemy) {
        if (!enemy || !Array.isArray(this.world?.floors)) {
            return;
        }

        for (const floor of this.world.floors) {
            if (!Array.isArray(floor?.enemies)) {
                continue;
            }

            const index = floor.enemies.indexOf(enemy);
            if (index < 0) {
                continue;
            }

            this.world.unindexEnemy?.(enemy, floor);
            floor.enemies.splice(index, 1);
        }
    },

    removeQuestEscortAlly(quest, options = {}) {
        const escortAlly = this.getQuestEscortAlly(quest);
        if (!escortAlly) {
            return null;
        }

        this.removeEnemyFromAllFloors(escortAlly);
        escortAlly.untame?.();
        escortAlly.questEscortId = null;
        escortAlly.questEscortTargetFloor = null;
        escortAlly.questEscortPassive = false;
        return escortAlly;
    },

    spawnQuestEscortAlly(quest) {
        if (!quest || quest.type !== 'escort-npc') {
            return null;
        }

        const escortAlly = this.createEnemyForType(0, 0, quest.escortTypeKey, 0);
        if (!escortAlly) {
            return null;
        }

        escortAlly.questEscortId = quest.id;
        escortAlly.questEscortTargetFloor = quest.targetFloor;
        escortAlly.questEscortPassive = true;
        escortAlly.tame(this.player);

        const spawn = this.findSpawnNearPlayer(escortAlly, createMathRng());
        this.assignActorPosition(escortAlly, spawn);
        this.addEnemyIfMissing(escortAlly);
        return escortAlly;
    },

    finalizeEscortQuestFloorArrival(quest) {
        if (!quest || quest.type !== 'escort-npc' || quest.completed) {
            return;
        }

        const escortAlly = this.getQuestEscortAlly(quest);
        if (!escortAlly) {
            return;
        }

        quest.completed = true;
        quest.display = this.describeQuestgiverQuest(quest);
        this.removeQuestEscortAlly(quest);
        this.ui.addMessage(`${escortAlly.name} safely arrives on floor ${quest.targetFloor}. Return to the Questgiver for your reward.`);
    },

    failEscortQuest(quest, escortAlly = null) {
        if (!quest || quest.type !== 'escort-npc') {
            return;
        }

        if (escortAlly) {
            this.removeEnemyFromAllFloors(escortAlly);
            escortAlly.untame?.();
            escortAlly.questEscortId = null;
            escortAlly.questEscortTargetFloor = null;
            escortAlly.questEscortPassive = false;
        }

        const questState = this.ensureQuestgiverState();
        if (questState.activeQuest?.id === quest.id) {
            questState.activeQuest = null;
            this.ui.addMessage('Your escort task has failed.');
        }
    },

    canStoreAllyWithHandler(ally) {
        return Boolean(ally?.isAlive?.() && !Number.isFinite(ally?.questEscortId));
    },

    createQuestgiverQuest() {
        const rng = createMathRng();
        const builders = [
            () => this.buildQuestgiverHuntQuest(rng),
            () => this.buildQuestgiverAllyRetrievalQuest(rng),
            () => this.buildQuestgiverExploreQuest(rng),
            () => this.buildQuestgiverEscortQuest(rng)
        ];

        const shuffledBuilders = [...builders];
        for (let i = shuffledBuilders.length - 1; i > 0; i--) {
            const j = getRngRandomInt(rng, 0, i);
            [shuffledBuilders[i], shuffledBuilders[j]] = [shuffledBuilders[j], shuffledBuilders[i]];
        }

        for (const buildQuest of shuffledBuilders) {
            const quest = buildQuest();
            if (quest) {
                quest.display = this.describeQuestgiverQuest(quest);
                return quest;
            }
        }

        return null;
    },

    describeQuestgiverQuest(quest) {
        if (!quest) {
            return 'No task available.';
        }

        const targetPathId = quest.targetPathId || getDefaultDungeonPathId();
        const targetPathName = this.getQuestgiverTargetPathName(targetPathId);
        const targetFloor = Math.max(1, Math.floor(Number(quest.targetFloor) || 1));

        if (quest.type === 'hunt') {
            return `Defeat ${quest.requiredCount} ${quest.targetName}${quest.requiredCount === 1 ? '' : 's'} on ${targetPathName}, floor ${targetFloor}+ (${quest.currentCount}/${quest.requiredCount}).`;
        }

        if (quest.type === 'ally-retrieval') {
            const minAllyLevel = Math.max(1, Math.floor(Number(quest.minAllyLevel) || 1));
            return `Bring me a loyal ${quest.targetName} ally at level ${minAllyLevel}+.`;
        }

        if (quest.type === 'explore-floor') {
            return `Reach ${targetPathName}, floor ${targetFloor} and return alive.`;
        }

        if (quest.type === 'escort-npc') {
            if (quest.completed) {
                return `${quest.escortName} reached ${targetPathName}, floor ${targetFloor}. Collect your reward.`;
            }

            return `Escort ${quest.escortName} safely to ${targetPathName}, floor ${targetFloor}.`;
        }

        return 'Complete the assigned task.';
    },

    getQuestgiverQuestRewardSummary(quest) {
        if (!quest) {
            return 'No reward.';
        }

        return `${quest.rewardMoney} money and one tier ${quest.rewardTier} equipment reward`;
    },

    isQuestgiverQuestComplete(quest) {
        if (!quest) {
            return false;
        }

        if (quest.type === 'hunt') {
            return Math.max(0, Math.floor(Number(quest.currentCount) || 0)) >= Math.max(1, Math.floor(Number(quest.requiredCount) || 1));
        }

        if (quest.type === 'ally-retrieval') {
            return Boolean(this.findMatchingQuestgiverAlly(quest));
        }

        if (quest.type === 'explore-floor') {
            const questState = this.ensureQuestgiverState();
            const byPath = questState.deepestDungeonFloorReachedByPath || {};
            const targetPathId = quest.targetPathId || getDefaultDungeonPathId();
            const reachedFloorOnPath = Math.max(0, Math.floor(Number(byPath[targetPathId]) || 0));
            return reachedFloorOnPath >= Math.max(1, Math.floor(Number(quest.targetFloor) || 1));
        }

        if (quest.type === 'escort-npc') {
            return Boolean(quest.completed);
        }

        return false;
    },

    findMatchingQuestgiverAlly(quest) {
        if (!quest || quest.type !== 'ally-retrieval') {
            return null;
        }

        const minAllyLevel = Math.max(1, Math.floor(Number(quest.minAllyLevel) || 1));
        const allies = Array.isArray(this.player?.allies) ? this.player.allies : [];
        return allies.find((ally) => {
            if (!ally?.isAlive?.() || ally.monsterType !== quest.targetTypeKey) {
                return false;
            }

            const allyLevel = Math.max(1, Math.floor(Number(ally?.allyLevel) || 1));
            return allyLevel >= minAllyLevel;
        }) || null;
    },

    consumeQuestgiverRetrievedAlly(quest) {
        const matchingAlly = this.findMatchingQuestgiverAlly(quest);
        if (!matchingAlly) {
            return null;
        }

        this.removeEnemyFromCurrentFloor?.(matchingAlly);
        matchingAlly.untame?.();
        return matchingAlly;
    },

    grantQuestgiverQuestReward(enemy, quest) {
        if (!quest) {
            return;
        }

        if (quest.type === 'ally-retrieval') {
            this.consumeQuestgiverRetrievedAlly(quest);
        }

        if (quest.type === 'escort-npc') {
            this.removeQuestEscortAlly(quest);
        }

        this.player.money = Math.max(0, Math.floor(Number(this.player.money) || 0)) + Math.max(0, Math.floor(Number(quest.rewardMoney) || 0));
        const rewardItem = this.createNpcRewardEquipmentForTier(quest.rewardTier, createMathRng());
        if (rewardItem) {
            this.player.addItem(rewardItem);
            this.ui.addMessage(`${enemy.name}: Excellent work. Take ${quest.rewardMoney} money and ${getItemLabel(rewardItem)}.`);
        } else {
            this.ui.addMessage(`${enemy.name}: Excellent work. Take ${quest.rewardMoney} money.`);
        }

        const questState = this.ensureQuestgiverState();
        questState.completedQuestCount = Math.max(0, Math.floor(Number(questState.completedQuestCount) || 0) + 1);
        questState.activeQuest = null;
    },

    offerQuestgiverQuest(enemy) {
        const questState = this.ensureQuestgiverState();
        const nextQuest = this.createQuestgiverQuest();
        if (!nextQuest) {
            this.ui.addMessage(`${enemy.name}: I have no fitting task for you right now.`);
            return;
        }

        const accepted = this.confirmNpcDialog(
            enemy,
            `${nextQuest.display}\nReward: ${this.getQuestgiverQuestRewardSummary(nextQuest)}.\nAccept this task?`
        );
        if (!accepted) {
            this.ui.addMessage(`${enemy.name}: Another time, then.`);
            return;
        }

        if (nextQuest.type === 'escort-npc' && !this.spawnQuestEscortAlly(nextQuest)) {
            this.ui.addMessage(`${enemy.name}: I cannot send anyone with you right now.`);
            return;
        }

        questState.activeQuest = nextQuest;
        this.ui.addMessage(`${enemy.name}: Task accepted. ${nextQuest.display}`);
    },

    interactWithQuestgiver(enemy) {
        const questState = this.ensureQuestgiverState();
        const activeQuest = questState.activeQuest;

        if (!activeQuest) {
            this.offerQuestgiverQuest(enemy);
            return;
        }

        activeQuest.display = this.describeQuestgiverQuest(activeQuest);
        if (this.isQuestgiverQuestComplete(activeQuest)) {
            this.grantQuestgiverQuestReward(enemy, activeQuest);
            return;
        }

        this.ui.addMessage(`${enemy.name}: Current task - ${activeQuest.display}`);
        this.ui.addMessage(`${enemy.name}: Reward on return - ${this.getQuestgiverQuestRewardSummary(activeQuest)}.`);
    },

    trackQuestProgressForFloorVisit(floorIndex) {
        if (this.isOverworldFloor?.(floorIndex)) {
            return;
        }

        const questState = this.ensureQuestgiverState();
        const normalizedFloor = Math.max(0, Math.floor(Number(floorIndex) || 0));
        if (normalizedFloor > questState.deepestDungeonFloorReached) {
            questState.deepestDungeonFloorReached = normalizedFloor;
        }

        const currentPathId = this.world?.getSelectedDungeonPathId?.() || getDefaultDungeonPathId();
        const byPath = questState.deepestDungeonFloorReachedByPath || {};
        const currentPathDeepest = Math.max(0, Math.floor(Number(byPath[currentPathId]) || 0));
        if (normalizedFloor > currentPathDeepest) {
            byPath[currentPathId] = normalizedFloor;
            questState.deepestDungeonFloorReachedByPath = byPath;
        }

        const activeQuest = questState.activeQuest;
        const activeQuestTargetPath = activeQuest?.targetPathId || getDefaultDungeonPathId();
        if (activeQuest?.type === 'escort-npc'
            && activeQuestTargetPath === currentPathId
            && normalizedFloor >= Math.max(1, Math.floor(Number(activeQuest.targetFloor) || 1))) {
            this.finalizeEscortQuestFloorArrival(activeQuest);
        }
    },

    trackQuestProgressForEnemyDefeat(enemy, options = {}) {
        const activeQuest = this.ensureQuestgiverState().activeQuest;
        if (activeQuest?.type === 'escort-npc' && enemy?.questEscortId === activeQuest.id) {
            this.failEscortQuest(activeQuest, enemy);
            return;
        }

        if (!enemy || enemy.isAlly || this.isNeutralNpcEnemy(enemy)) {
            return;
        }

        const killer = options?.killer || null;
        if (killer !== this.player && !killer?.isAlly) {
            return;
        }

        if (!activeQuest || activeQuest.type !== 'hunt') {
            return;
        }

        const currentPathId = this.world?.getSelectedDungeonPathId?.() || getDefaultDungeonPathId();
        const targetPathId = activeQuest.targetPathId || getDefaultDungeonPathId();
        if (targetPathId !== currentPathId) {
            return;
        }

        if (Math.max(0, Math.floor(Number(this.world?.currentFloor) || 0)) < Math.max(1, Math.floor(Number(activeQuest.targetFloor) || 1))) {
            return;
        }

        if (enemy.monsterType !== activeQuest.targetTypeKey) {
            return;
        }

        activeQuest.currentCount = clamp(Math.floor(Number(activeQuest.currentCount) || 0) + 1, 0, activeQuest.requiredCount);
        activeQuest.display = this.describeQuestgiverQuest(activeQuest);
    },

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

    runNpcDialog(callback) {
        if (typeof this.ui?.runNativePrompt === 'function') {
            return this.ui.runNativePrompt(callback);
        }

        return typeof callback === 'function' ? callback() : null;
    },

    confirmNpcDialog(enemy, message) {
        return Boolean(this.runNpcDialog(() => window.confirm(`${enemy.name}: ${message}`)));
    },

    promptNpcDialog(enemy, message, defaultValue = '') {
        return this.runNpcDialog(() => window.prompt(`${enemy.name}: ${message}`, String(defaultValue ?? '')));
    },

    promptForListSelection(enemy, header, entries, getLabel, promptLabel = 'Choose number:') {
        const availableEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
        if (availableEntries.length === 0) {
            return null;
        }

        const indexedList = availableEntries
            .map((entry, index) => `${index + 1}) ${getLabel(entry, index)}`)
            .join('\n');
        const choiceValue = this.promptNpcDialog(enemy, `${header}\n${indexedList}\n${promptLabel}`, '1');
        const selectedIndex = Math.floor(Number(choiceValue)) - 1;
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= availableEntries.length) {
            return null;
        }

        return availableEntries[selectedIndex] || null;
    },

    promptForNumericAmount(enemy, message, defaultValue = 0) {
        const promptValue = this.promptNpcDialog(enemy, message, defaultValue);
        const amount = Math.floor(Number(promptValue));
        return Number.isFinite(amount) ? amount : null;
    },

    promptForInventoryItem(enemy, header, itemFilter = () => true) {
        const inventory = Array.isArray(this.player.getInventory()) ? this.player.getInventory() : [];
        const filteredItems = inventory.filter((item) => itemFilter(item));
        return this.promptForListSelection(enemy, header, filteredItems, (item) => getItemLabel(item), 'Choose item number:');
    },

    promptForAlly(enemy, header, allies) {
        const availableAllies = Array.isArray(allies)
            ? allies.filter((ally) => ally?.isAlive?.())
            : [];
        return this.promptForListSelection(enemy, header, availableAllies, (ally) => ally.name, 'Choose ally number:');
    },

    getHandlerStoredAllies(enemy) {
        if (!enemy) {
            return [];
        }

        if (!Array.isArray(enemy.stalledAllies)) {
            enemy.stalledAllies = [];
        }

        return enemy.stalledAllies;
    },

    interactWithHandler(enemy) {
        const stalledCount = this.getHandlerStoredAllies(enemy).length;
        const options = [
            '1) Stall ally',
            `2) Retrieve ally (${stalledCount})`,
            '3) Cancel'
        ];
        const choice = this.promptNpcDialog(
            enemy,
            `I can stall one ally for later or return one I've kept safe.\n${options.join('\n')}\nChoose an option (1-3):`,
            '3'
        );
        const normalizedChoice = String(choice || '').trim();

        if (normalizedChoice === '1') {
            this.handleAllyStall(enemy);
            return;
        }

        if (normalizedChoice === '2') {
            this.handleAllyRetrieve(enemy);
            return;
        }

        this.ui.addMessage(`${enemy.name}: Come back when you need a hand with your allies.`);
    },

    handleAllyStall(enemy) {
        const allies = Array.isArray(this.player.allies)
            ? this.player.allies.filter((ally) => this.canStoreAllyWithHandler(ally))
            : [];
        if (allies.length === 0) {
            this.ui.addMessage(`${enemy.name}: You have no allies to stall.`);
            return;
        }

        const selectedAlly = this.promptForAlly(enemy, 'Which ally should I keep safe for you?', allies);
        if (!selectedAlly) {
            this.ui.addMessage(`${enemy.name}: Stalling canceled.`);
            return;
        }

        const storedAllies = this.getHandlerStoredAllies(enemy);

        this.player.removeAlly(selectedAlly);
        storedAllies.push(selectedAlly);
        this.world.removeEnemy(selectedAlly);
        this.ui.addMessage(`${enemy.name}: I'll keep ${selectedAlly.name} safe until you return.`);
    },

    handleAllyRetrieve(enemy) {
        const stalledAllies = this.getHandlerStoredAllies(enemy);
        if (stalledAllies.length === 0) {
            this.ui.addMessage(`${enemy.name}: I am not holding any of your allies.`);
            return;
        }

        const selectedAlly = this.promptForAlly(enemy, 'Which ally do you want back?', stalledAllies);
        if (!selectedAlly) {
            this.ui.addMessage(`${enemy.name}: Retrieval canceled.`);
            return;
        }

        const allyIndex = stalledAllies.indexOf(selectedAlly);
        if (allyIndex < 0) {
            this.ui.addMessage(`${enemy.name}: I can't find that ally right now.`);
            return;
        }

        stalledAllies.splice(allyIndex, 1);
        selectedAlly.isAlly = true;
        selectedAlly.tamedBy = this.player;
        // Restore full health when retrieved
        selectedAlly.health = selectedAlly.maxHealth || selectedAlly.health;
        this.player.addAlly(selectedAlly);

        const spawn = this.findSpawnNearPlayer(selectedAlly, createMathRng());
        this.assignActorPosition(selectedAlly, spawn);
        this.addEnemyIfMissing(selectedAlly);
        this.ui.addMessage(`${enemy.name}: ${selectedAlly.name} is back by your side, fully healed.`);
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

    getSpecialNpcInteraction(enemy) {
        if (!enemy) {
            return null;
        }

        if (enemy.isShopkeeper && !enemy.shopkeeperHostileTriggered) {
            return () => this.interactWithShopkeeper(enemy);
        }

        const interactionMap = {
            npcBankerTier1: () => this.interactWithBanker(enemy),
            npcStarvingTier1: () => this.interactWithStarvingNpc(enemy),
            npcHomeboundTier1: () => this.interactWithHomeboundNpc(enemy),
            npcShamanTier1: () => this.interactWithShamanNpc(enemy),
            npcQuestgiverTier1: () => this.interactWithQuestgiver(enemy),
            npcHandlerTier1: () => this.interactWithHandler(enemy)
        };

        return interactionMap[enemy.monsterType] || null;
    },

    interactWithMerchantNpc(enemy) {
        if (enemy.shopSoldOut) {
            this.ui.addMessage(`${enemy.name}: Thanks.`);
            return;
        }

        if (!enemy.shopOfferItem) {
            this.generateNpcOffer(enemy);
        }

        if (!enemy.shopOfferItem || !Number.isFinite(enemy.shopOfferPrice)) {
            this.ui.addMessage(`${enemy.name}: I have nothing to sell right now.`);
            return;
        }

        const itemLabel = getItemLabel(enemy.shopOfferItem);
        const price = enemy.shopOfferPrice;
        const confirmed = this.confirmNpcDialog(enemy, `I offer ${itemLabel} for ${price} money. Buy it?`);
        if (!confirmed) {
            this.ui.addMessage(`${enemy.name}: Maybe next time.`);
            return;
        }

        if ((this.player.money || 0) < price) {
            this.ui.addMessage(`${enemy.name}: You don't have enough money.`);
            return;
        }

        this.player.money -= price;
        this.player.addItem(enemy.shopOfferItem);
        this.ui.addMessage(`You buy ${itemLabel} for ${price} money.`);
        enemy.shopOfferItem = null;
        enemy.shopOfferPrice = null;
        enemy.shopSoldOut = true;
    },

    tryTalkToFacingNpc(facing) {
        const targetX = this.player.x + (Number(facing?.dx) || 0);
        const targetY = this.player.y + (Number(facing?.dy) || 0);
        const enemy = this.world.getActorAt(targetX, targetY);
        if (!this.isNeutralNpcEnemy(enemy)) {
            return false;
        }

        const specialInteraction = this.getSpecialNpcInteraction(enemy);
        if (typeof specialInteraction === 'function') {
            specialInteraction();
            return true;
        }

        this.interactWithMerchantNpc(enemy);
        return true;
    },

    getPendingShopSaleEntries(shopkeeper = null) {
        const currentFloor = this.world?.getCurrentFloor?.();
        if (!(currentFloor?.items instanceof Map)) {
            return [];
        }

        const entries = [];
        for (const [key, items] of currentFloor.items.entries()) {
            const position = fromGridKey(key);
            if (!position) {
                continue;
            }

            for (const item of items) {
                if (!item?.properties?.shopPendingSale) {
                    continue;
                }

                entries.push({
                    item,
                    x: position.x,
                    y: position.y,
                    price: this.getShopSellPrice(item),
                    shopkeeper
                });
            }
        }

        return entries;
    },

    getActiveShopkeeper() {
        const actors = typeof this.world?.getAllActors === 'function'
            ? this.world.getAllActors()
            : [...(this.world?.getEnemies?.() || []), ...(this.world?.getNpcs?.() || [])];
        return actors.find((actor) => actor?.isShopkeeper && !actor?.shopkeeperHostileTriggered) || null;
    },

    getShopSettlementState(shopkeeper = null) {
        const unpaidItems = typeof this.getUnpaidShopItems === 'function'
            ? this.getUnpaidShopItems()
            : (this.player.inventory || []).filter((item) => item?.properties?.shopUnpaid);
        const pendingSales = this.getPendingShopSaleEntries(shopkeeper);
        const buyTotal = unpaidItems.reduce((sum, item) => sum + this.getShopItemPrice(item), 0);
        const sellTotal = pendingSales.reduce((sum, entry) => sum + entry.price, 0);
        const netTotal = buyTotal - sellTotal;
        const sections = [];

        if (unpaidItems.length > 0) {
            sections.push(`Buying:\n${unpaidItems
                .map((item) => `- ${getItemLabel(item)} (${this.getShopItemPrice(item)} money)`)
                .join('\n')}`);
        }

        if (pendingSales.length > 0) {
            sections.push(`Selling:\n${pendingSales
                .map((entry) => `- ${getItemLabel(entry.item)} (${entry.price} money)`)
                .join('\n')}`);
        }

        const balanceLine = netTotal > 0
            ? `Total due: ${netTotal} money.`
            : netTotal < 0
                ? `You will receive ${Math.abs(netTotal)} money.`
                : 'This is an even trade.';

        return {
            unpaidItems,
            pendingSales,
            buyTotal,
            sellTotal,
            netTotal,
            sections,
            summaryText: sections.join('\n\n'),
            balanceLine
        };
    },

    completeShopSettlement(enemy, settlement = null) {
        const state = settlement || this.getShopSettlementState(enemy);
        if (!state || (state.unpaidItems.length === 0 && state.pendingSales.length === 0)) {
            return { completed: false, reason: 'nothing-to-settle' };
        }

        const playerMoney = Math.max(0, Math.floor(Number(this.player.money) || 0));
        if (state.netTotal > playerMoney) {
            return {
                completed: false,
                reason: 'insufficient-funds',
                requiredMoney: state.netTotal
            };
        }

        if (state.buyTotal > 0) {
            for (const item of state.unpaidItems) {
                if (!item?.properties) {
                    continue;
                }
                item.properties.shopUnpaid = false;
                item.properties.shopOwned = false;
                delete item.properties.shopkeeperId;
            }
        }

        if (state.sellTotal > 0) {
            for (const entry of state.pendingSales) {
                if (entry.item?.properties) {
                    delete entry.item.properties.shopPendingSale;
                    delete entry.item.properties.shopSellPrice;
                }
                this.world.removeItem(entry.x, entry.y, entry.item);
            }
        }

        this.player.money = Math.max(0, Math.floor(playerMoney - state.netTotal));

        if (state.buyTotal > 0 && state.sellTotal > 0) {
            this.ui.addMessage(`You settle up with ${enemy.name}: bought goods for ${state.buyTotal} money and sold goods for ${state.sellTotal} money.`);
        } else if (state.buyTotal > 0) {
            this.ui.addMessage(`You pay ${state.buyTotal} money for ${state.unpaidItems.length} item(s).`);
        } else {
            this.ui.addMessage(`${enemy.name} pays you ${state.sellTotal} money for ${state.pendingSales.length} item(s).`);
        }

        return {
            completed: true,
            ...state
        };
    },

    attemptShopSettlement(enemy, settlement = null) {
        const result = this.completeShopSettlement(enemy, settlement);
        if (!result.completed && result.reason === 'insufficient-funds') {
            this.ui.addMessage(`${enemy.name}: You need ${result.requiredMoney} money to cover the difference.`);
        }
        return result;
    },

    interactWithShopkeeper(enemy) {
        const settlement = this.getShopSettlementState(enemy);

        if (settlement.unpaidItems.length === 0 && settlement.pendingSales.length === 0) {
            this.ui.addMessage(`${enemy.name}: Feel free to browse. Pick up an item to see its price, or drop one of yours on a shop tile to offer it for sale.`);
            return;
        }

        const confirmed = typeof this.ui?.confirmShopSettlement === 'function'
            ? this.ui.confirmShopSettlement(
                enemy.name,
                settlement.summaryText,
                settlement.buyTotal,
                settlement.sellTotal,
                settlement.balanceLine
            )
            : window.confirm(
                `${enemy.name}: Let's settle up.\n\n${settlement.summaryText}\n\nBuying total: ${settlement.buyTotal} money\nSelling total: ${settlement.sellTotal} money\n${settlement.balanceLine}\n\nComplete the transaction?`
            );

        if (!confirmed) {
            this.ui.addMessage(`${enemy.name}: Take your time. We can settle up whenever you're ready.`);
            return;
        }

        this.attemptShopSettlement(enemy, settlement);
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
        const choice = this.promptNpcDialog(enemy, `Welcome.\n${options.join('\n')}\nChoose an option (1-5):`, '5');
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

        const amount = this.promptForNumericAmount(enemy, `You carry ${available} money. Deposit how much?`, available);
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

        const amount = this.promptForNumericAmount(enemy, `Your bank balance is ${available}. Withdraw how much?`, available);
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

        const selectedItem = this.promptForInventoryItem(enemy, 'Which item should I store?', () => true);
        if (!selectedItem) {
            this.ui.addMessage(`${enemy.name}: Storage canceled.`);
            return;
        }

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

        const selectedItem = this.promptForListSelection(
            enemy,
            'Which stored item do you want back?',
            storedItems,
            (item) => getItemLabel(item),
            'Choose item number:'
        );
        if (!selectedItem) {
            this.ui.addMessage(`${enemy.name}: Withdrawal canceled.`);
            return;
        }

        const selectedIndex = storedItems.indexOf(selectedItem);
        if (selectedIndex < 0) {
            this.ui.addMessage(`${enemy.name}: I cannot find that item right now.`);
            return;
        }

        const [returnedItem] = storedItems.splice(selectedIndex, 1);
        this.player.addItem(returnedItem);
        this.ui.addMessage(`${enemy.name}: Returned ${getItemLabel(returnedItem)}.`);
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
