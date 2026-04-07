// NPC conversation, shop, and banking helpers

const NPC_INTERACTION_HANDLER_BY_ROLE = Object.freeze({
    merchant: 'interactWithMerchantNpc',
    banker: 'interactWithBanker',
    starving: 'interactWithStarvingNpc',
    homebound: 'interactWithHomeboundNpc',
    shaman: 'interactWithShamanNpc',
    questgiver: 'interactWithQuestgiver',
    handler: 'interactWithHandler'
});

const QUESTGIVER_EXTRA_FIELD_BUILDERS = Object.freeze({
    escortPassenger: 'buildQuestgiverEscortExtraFields',
    retrieveItemName: 'buildQuestgiverRetrieveItemExtraFields',
    materialDelivery: 'buildQuestgiverMaterialDeliveryExtraFields'
});

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

    getQuestgiverQuestTargetContext(quest) {
        const targetPathId = quest?.targetPathId || getDefaultDungeonPathId();
        return {
            targetPathId,
            targetPathName: this.getQuestgiverTargetPathName(targetPathId),
            targetFloor: Math.max(1, Math.floor(Number(quest?.targetFloor) || 1))
        };
    },

    pickQuestgiverNameFromPool(poolKey, rng, fallback = '') {
        const entries = typeof getQuestgiverNamePoolEntries === 'function'
            ? getQuestgiverNamePoolEntries(poolKey)
            : [];
        return pickRandom(entries, rng, entries[0] || fallback);
    },

    buildQuestgiverEscortExtraFields(config) {
        const escortTypeKey = typeof config?.escortTypeKey === 'string'
            ? config.escortTypeKey
            : 'escortPassengerTier1';
        return {
            escortTypeKey,
            escortName: this.getQuestgiverTargetName(escortTypeKey)
        };
    },

    buildQuestgiverRetrieveItemExtraFields(config, _entry, _targetFloor, rng) {
        return {
            itemName: this.pickQuestgiverNameFromPool(config?.itemNamePoolKey, rng, 'Sealed relic')
        };
    },

    buildQuestgiverMaterialDeliveryExtraFields(config, entry, _targetFloor, rng) {
        const materialCountMin = Math.max(3, Math.floor(Number(entry?.materialCountMin) || 3));
        const materialCountMax = Math.max(materialCountMin, Math.floor(Number(entry?.materialCountMax) || materialCountMin));
        const materialCount = getRngRandomInt(rng, materialCountMin, materialCountMax);

        return {
            materialName: this.pickQuestgiverNameFromPool(config?.materialNamePoolKey, rng, 'Reinforcement crate'),
            materialCount,
            requiredCount: materialCount,
            engineerName: this.pickQuestgiverNameFromPool(config?.engineerNamePoolKey, rng, 'Engineer Hale')
        };
    },

    buildQuestgiverExtraFields(config, entry, targetFloor, rng) {
        const builderKey = typeof config?.extraFieldBuilder === 'string'
            ? config.extraFieldBuilder
            : '';
        const builderMethod = QUESTGIVER_EXTRA_FIELD_BUILDERS[builderKey];
        if (!builderMethod || typeof this[builderMethod] !== 'function') {
            return {};
        }

        return this[builderMethod](config, entry, targetFloor, rng) || {};
    },

    updateQuestgiverQuestDisplay(quest) {
        if (!quest) {
            return 'No task available.';
        }

        const display = this.describeQuestgiverQuest(quest);
        quest.display = display;
        return display;
    },

    getQuestgiverEligibleEntries(poolKey, pathId = this.world?.getSelectedDungeonPathId?.()) {
        const questPool = typeof getQuestgiverQuestPool === 'function'
            ? getQuestgiverQuestPool(poolKey)
            : [];
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
        const eligibleEntries = typeof getQuestgiverQuestPool === 'function'
            ? getQuestgiverQuestPool('allyRetrieval')
            : [];
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

    getQuestgiverPathTargeting(rng, targetPathId = this.getQuestgiverTargetPathId(rng)) {
        const normalizedPathId = typeof targetPathId === 'string'
            ? targetPathId
            : this.getQuestgiverTargetPathId(rng);
        const progressFloor = this.getQuestgiverTargetProgressFloor(normalizedPathId);
        const pathMaxDepth = getDungeonPathMaxDepth(normalizedPathId);
        const maxTargetFloor = Number.isFinite(pathMaxDepth) ? pathMaxDepth : 99;

        return {
            targetPathId: normalizedPathId,
            progressFloor,
            maxTargetFloor
        };
    },

    buildQuestgiverAdvanceFloorQuest(rng, poolKey, questType, options = {}) {
        const { rewardFloorMultiplier = 0, minimumAdvance = 0, config = null } = options;
        const targeting = this.getQuestgiverPathTargeting(rng);
        const eligibleEntries = this.getQuestgiverEligibleEntries(poolKey, targeting.targetPathId);
        const chosenEntry = pickRandom(eligibleEntries, rng, eligibleEntries[0]);
        if (!chosenEntry) {
            return null;
        }

        const minAdvance = Math.max(minimumAdvance, Math.floor(Number(chosenEntry.targetAdvanceMin) || 0));
        const maxAdvance = Math.max(minAdvance, Math.floor(Number(chosenEntry.targetAdvanceMax) || minAdvance));
        const targetAdvance = getRngRandomInt(rng, minAdvance, maxAdvance);
        const targetFloor = clamp(targeting.progressFloor + targetAdvance, 1, targeting.maxTargetFloor);

        return {
            id: this.ensureQuestgiverState().nextQuestId++,
            type: questType,
            targetPathId: targeting.targetPathId,
            targetFloor,
            completed: false,
            rewardMoney: Math.max(0, Math.floor(Number(chosenEntry.rewardMoney) || 0)) + targetFloor * rewardFloorMultiplier,
            rewardTier: Math.max(1, Math.floor(Number(chosenEntry.rewardTier) || 1)),
            ...this.buildQuestgiverExtraFields(config, chosenEntry, targetFloor, rng)
        };
    },

    buildQuestgiverExploreQuest(rng) {
        const questState = this.ensureQuestgiverState();
        const targeting = this.getQuestgiverPathTargeting(rng);
        const deepestReached = Math.max(0, targeting.progressFloor - 1);
        const targetFloor = clamp(deepestReached + getRngRandomInt(rng, 1, 2), 1, targeting.maxTargetFloor);
        const rewardTier = clamp(Math.ceil(targetFloor / 3), 1, 4);

        return {
            id: questState.nextQuestId++,
            type: 'explore-floor',
            targetPathId: targeting.targetPathId,
            targetFloor,
            rewardMoney: 50 + targetFloor * 15,
            rewardTier
        };
    },

    buildConfiguredQuestgiverAdvanceQuest(configKey, rng) {
        const config = typeof getQuestgiverAdvanceQuestConfig === 'function'
            ? getQuestgiverAdvanceQuestConfig(configKey)
            : null;
        if (!config) {
            return null;
        }

        return this.buildQuestgiverAdvanceFloorQuest(rng, config.poolKey, config.questType, {
            rewardFloorMultiplier: config.rewardFloorMultiplier,
            minimumAdvance: config.minimumAdvance,
            config
        });
    },

    buildQuestgiverEscortQuest(rng) {
        return this.buildConfiguredQuestgiverAdvanceQuest('escort', rng);
    },

    buildQuestgiverLostExplorerQuest(rng) {
        return this.buildConfiguredQuestgiverAdvanceQuest('saveLostExplorer', rng);
    },

    buildQuestgiverRetrieveItemQuest(rng) {
        return this.buildConfiguredQuestgiverAdvanceQuest('retrieveItem', rng);
    },

    buildQuestgiverMaterialDeliveryQuest(rng) {
        return this.buildConfiguredQuestgiverAdvanceQuest('materialDelivery', rng);
    },

    getQuestEscortAlly(quest = this.ensureQuestgiverState().activeQuest) {
        if (!quest || quest.type !== 'escort-npc') {
            return null;
        }

        return this.getPlayerAllies({ aliveOnly: true })
            .find((ally) => ally.questEscortId === quest.id) || null;
    },

    removeEnemyFromAllFloors(enemy) {
        if (!enemy || !this.world) {
            return;
        }

        this.forEachWorldFloor((floor) => {
            if (!Array.isArray(floor?.enemies)) {
                return;
            }

            const index = floor.enemies.indexOf(enemy);
            if (index < 0) {
                return;
            }

            this.world.unindexEnemy?.(enemy, floor);
            floor.enemies.splice(index, 1);
        });
    },

    clearQuestEventById(questId, eventType = '') {
        if (!this.world || !Number.isFinite(Number(questId))) {
            return;
        }

        const normalizedQuestId = Math.floor(Number(questId));
        this.forEachWorldFloor((floor) => {
            const activeEvent = floor?.meta?.activeEvent;
            if (!activeEvent) {
                return;
            }

            const activeQuestId = Math.floor(Number(activeEvent.questId));
            if (activeQuestId !== normalizedQuestId) {
                return;
            }

            if (eventType && activeEvent.type !== eventType) {
                return;
            }

            floor.meta.activeEvent = null;
        });
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

        this.removeQuestEscortAlly(quest);
        this.completeQuestgiverObjective(quest, {
            message: `${escortAlly.name} safely arrives on floor ${quest.targetFloor}. Return to the Questgiver for your reward.`
        });
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

    failMaterialDeliveryQuest(quest, engineer = null, failureMessage = 'The material delivery quest has failed.') {
        if (!quest || quest.type !== 'material-delivery') {
            return;
        }

        if (engineer) {
            this.removeEnemyFromAllFloors(engineer);
        }

        this.consumeMaterialDeliveryQuestItems(quest);
        this.clearQuestEventById?.(quest.id, 'material-delivery');

        const questState = this.ensureQuestgiverState();
        if (questState.activeQuest?.id === quest.id) {
            questState.activeQuest = null;
            this.ui.addMessage(failureMessage);
        }
    },

    canStoreAllyWithHandler(ally) {
        return Boolean(ally?.isAlive?.() && !Number.isFinite(ally?.questEscortId));
    },

    getQuestgiverQuestBuilders(rng = createMathRng()) {
        const questBuilderMethods = typeof getQuestgiverQuestBuilderMethods === 'function'
            ? getQuestgiverQuestBuilderMethods()
            : [];

        return questBuilderMethods
            .map((methodName) => this[methodName])
            .filter((buildQuest) => typeof buildQuest === 'function')
            .map((buildQuest) => () => buildQuest.call(this, rng));
    },

    createQuestgiverQuest() {
        const rng = createMathRng();
        const shuffledBuilders = [...this.getQuestgiverQuestBuilders(rng)];
        for (let i = shuffledBuilders.length - 1; i > 0; i--) {
            const j = getRngRandomInt(rng, 0, i);
            [shuffledBuilders[i], shuffledBuilders[j]] = [shuffledBuilders[j], shuffledBuilders[i]];
        }

        for (const buildQuest of shuffledBuilders) {
            const quest = buildQuest();
            if (quest) {
                this.updateQuestgiverQuestDisplay(quest);
                return quest;
            }
        }

        return null;
    },

    describeQuestgiverQuest(quest) {
        if (!quest) {
            return 'No task available.';
        }

        const { targetPathName, targetFloor } = this.getQuestgiverQuestTargetContext(quest);

        switch (quest.type) {
            case 'hunt':
                return `Defeat ${quest.requiredCount} ${quest.targetName}${quest.requiredCount === 1 ? '' : 's'} on ${targetPathName}, floor ${targetFloor}+ (${quest.currentCount}/${quest.requiredCount}).`;

            case 'ally-retrieval': {
                const minAllyLevel = Math.max(1, Math.floor(Number(quest.minAllyLevel) || 1));
                return `Bring me a loyal ${quest.targetName} ally at level ${minAllyLevel}+.`;
            }

            case 'explore-floor':
                return `Reach ${targetPathName}, floor ${targetFloor} and return alive.`;

            case 'escort-npc':
                return quest.completed
                    ? `${quest.escortName} reached ${targetPathName}, floor ${targetFloor}. Collect your reward.`
                    : `Escort ${quest.escortName} safely to ${targetPathName}, floor ${targetFloor}.`;

            case 'save-lost-explorer':
                return quest.completed
                    ? `The lost explorer from ${targetPathName}, floor ${targetFloor}, is safe. Collect your reward.`
                    : `Save the lost explorer trapped on ${targetPathName}, floor ${targetFloor}. Expect a guarded room full of sleeping enemies.`;

            case 'retrieve-item':
                return `Retrieve ${quest.itemName || 'the quest item'} from ${targetPathName}, floor ${targetFloor}, and bring it back to me.`;

            case 'material-delivery': {
                const materialCount = Math.max(1, Math.floor(Number(quest.materialCount || quest.requiredCount) || 1));
                const materialName = quest.materialName || 'delivery material';
                const engineerName = quest.engineerName || 'the engineer';
                const quantityLabel = `${materialCount} ${materialName}${materialCount === 1 ? '' : 's'}`;
                return quest.completed
                    ? `${engineerName} received ${quantityLabel} on ${targetPathName}, floor ${targetFloor}. Collect your reward.`
                    : `Deliver ${quantityLabel} to ${engineerName} on ${targetPathName}, floor ${targetFloor}. Speak to the engineer only when you carry the full shipment.`;
            }

            default:
                return 'Complete the assigned task.';
        }
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

        switch (quest.type) {
            case 'hunt':
                return Math.max(0, Math.floor(Number(quest.currentCount) || 0)) >= Math.max(1, Math.floor(Number(quest.requiredCount) || 1));

            case 'ally-retrieval':
                return Boolean(this.findMatchingQuestgiverAlly(quest));

            case 'explore-floor': {
                const questState = this.ensureQuestgiverState();
                const byPath = questState.deepestDungeonFloorReachedByPath || {};
                const { targetPathId, targetFloor } = this.getQuestgiverQuestTargetContext(quest);
                const reachedFloorOnPath = Math.max(0, Math.floor(Number(byPath[targetPathId]) || 0));
                return reachedFloorOnPath >= targetFloor;
            }

            case 'retrieve-item':
                return Boolean(this.findQuestgiverRetrieveItem(quest));

            case 'escort-npc':
            case 'save-lost-explorer':
            case 'material-delivery':
                return Boolean(quest.completed);

            default:
                return false;
        }
    },

    findMatchingQuestgiverAlly(quest) {
        if (!quest || quest.type !== 'ally-retrieval') {
            return null;
        }

        const minAllyLevel = Math.max(1, Math.floor(Number(quest.minAllyLevel) || 1));
        return this.getPlayerAllies({ aliveOnly: true }).find((ally) => {
            if (ally.monsterType !== quest.targetTypeKey) {
                return false;
            }

            const allyLevel = Math.max(1, Math.floor(Number(ally?.allyLevel) || 1));
            return allyLevel >= minAllyLevel;
        }) || null;
    },

    findQuestgiverRetrieveItem(quest) {
        if (!quest || quest.type !== 'retrieve-item') {
            return null;
        }

        const normalizedQuestId = Math.floor(Number(quest.id));
        return this.getPlayerInventoryItems().find((item) => {
            const properties = item?.properties || {};
            return Boolean(
                properties.questReturnOnly
                && properties.questType === 'retrieve-item'
                && Math.floor(Number(properties.questId)) === normalizedQuestId
            );
        }) || null;
    },

    findMaterialDeliveryQuestItems(quest) {
        if (!quest || quest.type !== 'material-delivery') {
            return [];
        }

        const normalizedQuestId = Math.floor(Number(quest.id));
        return this.getPlayerInventoryItems().filter((item) => {
            const properties = item?.properties || {};
            return Boolean(
                properties.questDeliveryOnly
                && properties.questType === 'material-delivery'
                && Math.floor(Number(properties.questId)) === normalizedQuestId
            );
        });
    },

    createMaterialDeliveryQuestItems(quest) {
        if (!quest || quest.type !== 'material-delivery') {
            return [];
        }

        const materialName = typeof quest.materialName === 'string' && quest.materialName.trim().length > 0
            ? quest.materialName.trim()
            : 'delivery material';
        const engineerName = typeof quest.engineerName === 'string' && quest.engineerName.trim().length > 0
            ? quest.engineerName.trim()
            : 'the engineer';
        const materialCount = Math.max(1, Math.floor(Number(quest.materialCount || quest.requiredCount) || 1));
        const items = [];

        for (let i = 0; i < materialCount; i++) {
            const item = new Item(materialName, ITEM_TYPES.CONSUMABLE, {
                requiresIdentification: false,
                hiddenName: materialName,
                questItem: true,
                questDeliveryOnly: true,
                questType: 'material-delivery',
                questId: quest?.id ?? null,
                burnable: false,
                inventoryActions: ['drop'],
                useBlocked: true,
                throwBlocked: true,
                useBlockMessage: `${materialName} is too heavy to use. It must be delivered to ${engineerName}.`,
                throwBlockMessage: `${materialName} is too heavy to throw.`,
                storageBlockMessage: `${materialName} must stay with you until it is delivered to ${engineerName}.`,
                saleBlockMessage: `${materialName} is reserved for ${engineerName}, not for sale.`
            });
            item.identify?.();
            items.push(item);
        }

        return items;
    },

    issueMaterialDeliveryQuestItems(quest, enemy) {
        if (!quest || quest.type !== 'material-delivery') {
            return true;
        }

        const materials = this.createMaterialDeliveryQuestItems(quest);
        const requiredSlots = materials.length;
        const carriedCount = typeof this.player?.getInventoryItemCount === 'function'
            ? this.player.getInventoryItemCount()
            : this.getPlayerInventoryItems().length;
        const maxItems = typeof this.player?.getMaxInventoryItems === 'function'
            ? this.player.getMaxInventoryItems()
            : 20;

        if (carriedCount + requiredSlots > maxItems) {
            this.ui.addMessage(`${enemy.name}: Clear ${requiredSlots} inventory slot${requiredSlots === 1 ? '' : 's'} before taking this shipment.`);
            return false;
        }

        for (const item of materials) {
            if (!this.player.addItem(item)) {
                for (const addedItem of materials) {
                    this.player.removeItem?.(addedItem);
                }
                this.ui.addMessage(`${enemy.name}: You need ${requiredSlots} open inventory slot${requiredSlots === 1 ? '' : 's'} for these materials.`);
                return false;
            }
        }

        this.ui.addMessage(`${enemy.name}: Take these ${requiredSlots} ${quest.materialName}${requiredSlots === 1 ? '' : 's'} to ${quest.engineerName} on floor ${quest.targetFloor}. They are too heavy to use or throw.`);
        return true;
    },

    consumeMaterialDeliveryQuestItems(quest) {
        const materials = this.findMaterialDeliveryQuestItems(quest);
        for (const item of materials) {
            this.player.removeItem(item);
        }
        return materials;
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

    completeQuestgiverObjective(quest, options = {}) {
        if (!quest) {
            return false;
        }

        quest.completed = true;
        this.updateQuestgiverQuestDisplay(quest);

        if (options.eventType) {
            this.clearQuestEventById?.(quest.id, options.eventType);
        }

        if (options.removeEnemy) {
            this.removeEnemyFromAllFloors(options.removeEnemy);
        }

        const messages = Array.isArray(options.messages)
            ? options.messages
            : [options.message];
        for (const message of messages) {
            if (typeof message === 'string' && message.length > 0) {
                this.ui.addMessage(message);
            }
        }

        return true;
    },

    prepareAcceptedQuestgiverQuest(enemy, quest) {
        if (!quest) {
            return false;
        }

        if (quest.type === 'escort-npc' && !this.spawnQuestEscortAlly(quest)) {
            this.ui.addMessage(`${enemy.name}: I cannot send anyone with you right now.`);
            return false;
        }

        if (quest.type === 'material-delivery' && !this.issueMaterialDeliveryQuestItems(quest, enemy)) {
            return false;
        }

        return true;
    },

    resolveQuestgiverQuestTurnIn(quest) {
        if (!quest) {
            return;
        }

        switch (quest.type) {
            case 'ally-retrieval':
                this.consumeQuestgiverRetrievedAlly(quest);
                break;

            case 'escort-npc':
                this.removeQuestEscortAlly(quest);
                break;

            case 'retrieve-item': {
                const retrievedItem = this.findQuestgiverRetrieveItem(quest);
                if (retrievedItem) {
                    this.player.removeItem(retrievedItem);
                }
                this.clearQuestEventById?.(quest.id, 'retrieve-item');
                break;
            }

            case 'material-delivery':
                this.consumeMaterialDeliveryQuestItems(quest);
                this.clearQuestEventById?.(quest.id, 'material-delivery');
                break;

            default:
                break;
        }
    },

    grantQuestgiverQuestReward(enemy, quest) {
        if (!quest) {
            return;
        }

        this.resolveQuestgiverQuestTurnIn(quest);

        this.player.money = Math.max(0, Math.floor(Number(this.player.money) || 0)) + Math.max(0, Math.floor(Number(quest.rewardMoney) || 0));
        const rewardItem = this.createNpcRewardEquipmentForTier(quest.rewardTier, createMathRng());
        if (rewardItem) {
            const rewardResult = this.tryAddItemToPlayerInventory?.(rewardItem, { dropIfFull: true });
            if (rewardResult?.added) {
                this.ui.addMessage(`${enemy.name}: Excellent work. Take ${quest.rewardMoney} money and ${getItemLabel(rewardItem)}.`);
            } else {
                this.ui.addMessage(`${enemy.name}: Excellent work. Take ${quest.rewardMoney} money. ${getItemLabel(rewardItem)} is left at your feet because your inventory is full.`);
            }
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

        this.openNpcConfirmDialog(
            enemy,
            `${nextQuest.display}\nReward: ${this.getQuestgiverQuestRewardSummary(nextQuest)}.\nAccept this task?`,
            (accepted) => {
                if (!accepted) {
                    this.ui.addMessage(`${enemy.name}: Another time, then.`);
                    return;
                }

                if (!this.prepareAcceptedQuestgiverQuest(enemy, nextQuest)) {
                    return;
                }

                questState.activeQuest = nextQuest;
                this.ui.addMessage(`${enemy.name}: Task accepted. ${nextQuest.display}`);
            },
            { confirmLabel: 'Accept', cancelLabel: 'Decline' }
        );
    },

    interactWithQuestgiver(enemy) {
        const questState = this.ensureQuestgiverState();
        const activeQuest = questState.activeQuest;

        if (!activeQuest) {
            this.offerQuestgiverQuest(enemy);
            return;
        }

        this.updateQuestgiverQuestDisplay(activeQuest);
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
        const questState = this.ensureQuestgiverState();
        const activeQuest = questState.activeQuest;
        if (activeQuest?.type === 'escort-npc' && enemy?.questEscortId === activeQuest.id) {
            this.failEscortQuest(activeQuest, enemy);
            return;
        }

        if (activeQuest?.type === 'save-lost-explorer' && enemy?.lostExplorerQuestId === activeQuest.id) {
            this.clearQuestEventById?.(activeQuest.id, 'save-lost-explorer');
            questState.activeQuest = null;
            this.ui.addMessage('The lost explorer has perished. The rescue task has failed.');
            return;
        }

        if (activeQuest?.type === 'material-delivery' && enemy?.materialDeliveryQuestId === activeQuest.id) {
            this.failMaterialDeliveryQuest(activeQuest, enemy, 'The engineer is gone. The delivery contract has failed.');
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
        this.updateQuestgiverQuestDisplay(activeQuest);
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

    invokeNpcSelectionCallback(callback, value = null) {
        if (typeof callback === 'function') {
            callback(value);
        }
    },

    resolveNpcSelectionByIndex(value, entries = []) {
        const selectedIndex = Math.floor(Number(value));
        if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= entries.length) {
            return null;
        }

        return entries[selectedIndex] || null;
    },

    getNpcPromptTitle(enemy) {
        return String(enemy?.name || 'NPC');
    },

    getNpcItemChoiceDisplay(item) {
        const label = typeof this.ui?.formatInventoryItemLabel === 'function'
            ? this.ui.formatInventoryItemLabel(item)
            : getItemLabel(item);
        const typeLabel = String(item?.type || 'item');
        const prettyTypeLabel = typeLabel
            ? `${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)}`
            : 'Item';
        const details = [prettyTypeLabel];
        const power = Math.floor(Number(item?.properties?.power));
        const armor = Math.floor(Number(item?.properties?.armor));
        const quantity = typeof item?.getQuantity === 'function'
            ? Math.max(1, Math.floor(Number(item.getQuantity()) || 1))
            : Math.max(1, Math.floor(Number(item?.properties?.quantity) || 1));

        if (Number.isFinite(power) && power !== 0) {
            details.push(`POW ${power}`);
        }
        if (Number.isFinite(armor) && armor !== 0) {
            details.push(`ARM ${armor}`);
        }
        if (item?.type === ITEM_TYPES.THROWABLE && quantity > 1) {
            details.push(`Qty ${quantity}`);
        }
        if (item?.type === ITEM_TYPES.POT) {
            const storedItems = typeof item?.getStoredItems === 'function' ? item.getStoredItems() : [];
            const potCapacity = typeof item?.getPotCapacity === 'function'
                ? item.getPotCapacity()
                : Math.max(1, Math.floor(Number(item?.properties?.potCapacity) || 1));
            details.push(`${storedItems.length}/${potCapacity} stored`);
        }

        return {
            label: String(label || 'Item'),
            description: details.join(' • ')
        };
    },

    getNpcAllyChoiceDisplay(ally) {
        const level = Math.max(1, Math.floor(Number(ally?.allyLevel) || 1));
        const health = Math.max(0, Math.floor(Number(ally?.health) || 0));
        const maxHealth = Math.max(1, Math.floor(Number(ally?.maxHealth) || 1));
        return {
            label: String(ally?.name || 'Ally'),
            description: `Ally • Lv ${level} • HP ${health}/${maxHealth}`
        };
    },

    openNpcActionPrompt(enemy, messageText, buttons = [], onSubmit = null, options = {}) {
        const titleText = this.getNpcPromptTitle(enemy);
        const normalizedButtons = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
        const cancelMessage = typeof options.cancelMessage === 'string' ? options.cancelMessage : '';
        const hasCancelValue = Object.prototype.hasOwnProperty.call(options, 'cancelValue');

        return this.ui?.openGamePrompt?.({
            titleText,
            messageText: String(messageText || ''),
            buttons: normalizedButtons,
            onSubmit: (choice) => {
                if (hasCancelValue && choice === options.cancelValue) {
                    if (cancelMessage) {
                        this.ui.addMessage(`${titleText}: ${cancelMessage}`);
                    }
                    return;
                }

                if (typeof onSubmit === 'function') {
                    onSubmit(choice);
                }
            },
            onCancel: () => {
                if (typeof options.onCancel === 'function') {
                    options.onCancel();
                    return;
                }

                if (cancelMessage) {
                    this.ui.addMessage(`${titleText}: ${cancelMessage}`);
                }
            }
        }) || false;
    },

    openNpcConfirmDialog(enemy, message, onDecision = null, options = {}) {
        return this.ui?.openConfirmPrompt?.(
            this.getNpcPromptTitle(enemy),
            String(message || ''),
            onDecision,
            options
        );
    },

    openNpcListSelection(enemy, header, entries, getLabel, onSelect = null, options = {}) {
        const availableEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
        if (availableEntries.length === 0) {
            this.invokeNpcSelectionCallback(onSelect, null);
            return false;
        }

        const titleText = this.getNpcPromptTitle(enemy);
        const labelBuilder = typeof getLabel === 'function'
            ? getLabel
            : (entry) => String(entry?.name || entry || 'Option');
        const choices = availableEntries.map((entry, index) => {
            const labelData = labelBuilder(entry, index);
            const normalizedLabel = labelData && typeof labelData === 'object' && !Array.isArray(labelData)
                ? labelData
                : { label: labelData };

            return {
                label: String(normalizedLabel.label || normalizedLabel.title || entry?.name || `Option ${index + 1}`),
                description: typeof normalizedLabel.description === 'string' ? normalizedLabel.description : '',
                value: index,
                primary: index === 0,
                listStyle: true
            };
        });
        choices.push({ label: options.cancelLabel || 'Cancel', value: -1, cancel: true, listStyle: true });

        return this.ui?.openChoicePrompt?.(
            titleText,
            String(header || 'Choose an option:'),
            choices,
            (value) => {
                this.invokeNpcSelectionCallback(
                    onSelect,
                    this.resolveNpcSelectionByIndex(value, availableEntries)
                );
            },
            {
                onCancel: () => {
                    this.invokeNpcSelectionCallback(onSelect, null);
                }
            }
        ) || false;
    },

    openNpcNumericPrompt(enemy, message, defaultValue = 0, onSubmit = null, options = {}) {
        return this.ui?.openTextPrompt?.(
            this.getNpcPromptTitle(enemy),
            String(message || ''),
            String(defaultValue ?? ''),
            (value) => {
                const amount = Math.floor(Number(value));
                this.invokeNpcSelectionCallback(onSubmit, Number.isFinite(amount) ? amount : null);
            },
            {
                placeholder: options.placeholder || 'Enter a number',
                confirmLabel: options.confirmLabel || 'OK',
                cancelLabel: options.cancelLabel || 'Cancel',
                onCancel: () => {
                    this.invokeNpcSelectionCallback(onSubmit, null);
                }
            }
        );
    },

    openNpcInventoryItemPrompt(enemy, header, itemFilter = () => true, onSelect = null) {
        const inventory = this.getPlayerInventoryItems();
        const filteredItems = inventory.filter((item) => itemFilter(item));
        return this.openNpcListSelection(enemy, header, filteredItems, (item) => this.getNpcItemChoiceDisplay(item), onSelect, {
            cancelLabel: 'Cancel'
        });
    },

    openNpcAllyPrompt(enemy, header, allies, onSelect = null, options = {}) {
        const { includeDefeated = false } = options;
        const availableAllies = Array.isArray(allies)
            ? allies.filter((ally) => Boolean(ally) && (includeDefeated || ally?.isAlive?.()))
            : [];
        return this.openNpcListSelection(enemy, header, availableAllies, (ally) => this.getNpcAllyChoiceDisplay(ally), onSelect, {
            cancelLabel: 'Cancel'
        });
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
        this.openNpcActionPrompt(
            enemy,
            'I can stall one ally for later or return one I\'ve kept safe.',
            [
                { label: 'Stall ally', value: 'stall', primary: true },
                { label: `Retrieve ally (${stalledCount})`, value: 'retrieve' },
                { label: 'Cancel', value: 'cancel', cancel: true }
            ],
            (choice) => {
                if (choice === 'stall') {
                    this.handleAllyStall(enemy);
                    return;
                }

                if (choice === 'retrieve') {
                    this.handleAllyRetrieve(enemy);
                }
            },
            {
                cancelValue: 'cancel',
                cancelMessage: 'Come back when you need a hand with your allies.'
            }
        );
    },

    handleAllyStall(enemy) {
        const allies = this.getPlayerAllies({
            filter: (ally) => this.canStoreAllyWithHandler(ally)
        });
        if (allies.length === 0) {
            this.ui.addMessage(`${enemy.name}: You have no allies to stall.`);
            return;
        }

        this.openNpcAllyPrompt(enemy, 'Which ally should I keep safe for you?', allies, (selectedAlly) => {
            if (!selectedAlly) {
                this.ui.addMessage(`${enemy.name}: Stalling canceled.`);
                return;
            }

            const storedAllies = this.getHandlerStoredAllies(enemy);

            this.player.removeAlly(selectedAlly);
            storedAllies.push(selectedAlly);
            this.world.removeEnemy(selectedAlly);
            this.ui.addMessage(`${enemy.name}: I'll keep ${selectedAlly.name} safe until you return.`);
        });
    },

    handleAllyRetrieve(enemy) {
        const stalledAllies = this.getHandlerStoredAllies(enemy);
        if (stalledAllies.length === 0) {
            this.ui.addMessage(`${enemy.name}: I am not holding any of your allies.`);
            return;
        }

        this.openNpcAllyPrompt(enemy, 'Which ally do you want back?', stalledAllies, (selectedAlly) => {
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
            selectedAlly.health = selectedAlly.maxHealth || selectedAlly.health;
            this.player.addAlly(selectedAlly);

            const spawn = this.findSpawnNearPlayer(selectedAlly, createMathRng());
            this.assignActorPosition(selectedAlly, spawn);
            this.addEnemyIfMissing(selectedAlly);
            this.ui.addMessage(`${enemy.name}: ${selectedAlly.name} is back by your side, fully healed.`);
        }, { includeDefeated: true });
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
        this.openNpcInventoryItemPrompt(
            enemy,
            'I am starving. Please offer one food item.',
            (item) => this.isFoodItemForNpcTrade(item),
            (selectedFood) => {
                if (!selectedFood) {
                    this.ui.addMessage(`${enemy.name}: I can only accept food.`);
                    return;
                }

                this.player.removeItem(selectedFood);
                const foodTier = this.getFoodTierForNpcTrade(selectedFood);
                const rewardItem = this.createNpcRewardEquipmentForTier(foodTier);
                if (rewardItem) {
                    const rewardResult = this.tryAddItemToPlayerInventory?.(rewardItem, { dropIfFull: true });
                    if (rewardResult?.added) {
                        this.ui.addMessage(`${enemy.name}: Thank you. Please take ${getItemLabel(rewardItem)}.`);
                    } else {
                        this.ui.addMessage(`${enemy.name}: Thank you. ${getItemLabel(rewardItem)} is left at your feet because your inventory is full.`);
                    }
                } else {
                    this.ui.addMessage(`${enemy.name}: Thank you for the meal.`);
                }

                this.completeOneTimeNpcInteraction(enemy);
            }
        );
    },

    interactWithHomeboundNpc(enemy) {
        this.openNpcInventoryItemPrompt(
            enemy,
            'I can send one item safely to your bank.',
            () => true,
            (selectedItem) => {
                if (!selectedItem) {
                    this.ui.addMessage(`${enemy.name}: Choose one item if you want me to carry it home.`);
                    return;
                }

                this.player.removeItem(selectedItem);
                this.player.bankItems.push(selectedItem);
                this.ui.addMessage(`${enemy.name}: ${getItemLabel(selectedItem)} is now stored in your bank.`);
                this.completeOneTimeNpcInteraction(enemy);
            }
        );
    },

    interactWithShamanNpc(enemy) {
        const inventory = this.getPlayerInventoryItems();
        const cursedItems = inventory.filter((item) => getItemCursedState(item));

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

    interactWithLostExplorerNpc(enemy) {
        const activeQuest = this.ensureQuestgiverState().activeQuest;
        if (!activeQuest || activeQuest.type !== 'save-lost-explorer' || activeQuest.id !== enemy?.lostExplorerQuestId) {
            this.ui.addMessage(`${enemy.name}: Please help me find the way back out.`);
            return;
        }

        if (activeQuest.completed) {
            this.ui.addMessage(`${enemy.name}: Thank you again for the rescue.`);
            return;
        }

        this.completeQuestgiverObjective(activeQuest, {
            eventType: 'save-lost-explorer',
            removeEnemy: enemy,
            messages: [
                `${enemy.name}: You found me! I'll head back to safety from here.`,
                'The lost explorer has been saved. Return to the Questgiver for your reward.'
            ]
        });
    },

    interactWithMaterialEngineerNpc(enemy) {
        const activeQuest = this.ensureQuestgiverState().activeQuest;
        if (!activeQuest || activeQuest.type !== 'material-delivery' || activeQuest.id !== enemy?.materialDeliveryQuestId) {
            this.ui.addMessage(`${enemy.name}: I'm waiting on a shipment from the Questgiver.`);
            return;
        }

        if (activeQuest.completed) {
            this.ui.addMessage(`${enemy.name}: The delivery is already complete. Thank you.`);
            return;
        }

        const materialCount = Math.max(1, Math.floor(Number(activeQuest.materialCount || activeQuest.requiredCount) || 1));
        const carriedMaterials = this.findMaterialDeliveryQuestItems(activeQuest);
        if (carriedMaterials.length < materialCount) {
            this.failMaterialDeliveryQuest(activeQuest, enemy, 'You arrived without the full shipment. The material delivery quest has failed.');
            return;
        }

        for (const item of carriedMaterials.slice(0, materialCount)) {
            this.player.removeItem(item);
        }

        this.completeQuestgiverObjective(activeQuest, {
            eventType: 'material-delivery',
            removeEnemy: enemy,
            messages: [
                `${enemy.name}: Perfect. These materials are exactly what I needed.`,
                'The materials are delivered. Return to the Questgiver for your reward.'
            ]
        });
    },

    getSpecialNpcInteraction(enemy) {
        if (!enemy) {
            return null;
        }

        if (enemy.isShopkeeper && !enemy.shopkeeperHostileTriggered) {
            return () => this.interactWithShopkeeper(enemy);
        }

        if (enemy.isLostExplorerNpc || enemy.monsterType === 'npcLostExplorerTier1') {
            return () => this.interactWithLostExplorerNpc(enemy);
        }

        if (enemy.isMaterialDeliveryEngineerNpc || enemy.materialDeliveryQuestId) {
            return () => this.interactWithMaterialEngineerNpc(enemy);
        }

        const npcRole = typeof enemy?.npcRole === 'string' && enemy.npcRole.length > 0
            ? enemy.npcRole
            : (ENEMY_TEMPLATES?.[enemy?.monsterType]?.npcRole || '');
        const handlerName = NPC_INTERACTION_HANDLER_BY_ROLE[npcRole];

        return typeof handlerName === 'string' && typeof this[handlerName] === 'function'
            ? () => this[handlerName](enemy)
            : null;
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
        this.openNpcConfirmDialog(enemy, `I offer ${itemLabel} for ${price} money. Buy it?`, (confirmed) => {
            if (!confirmed) {
                this.ui.addMessage(`${enemy.name}: Maybe next time.`);
                return;
            }

            if ((this.player.money || 0) < price) {
                this.ui.addMessage(`${enemy.name}: You don't have enough money.`);
                return;
            }

            if (typeof this.player?.hasInventorySpaceFor === 'function' && !this.player.hasInventorySpaceFor(enemy.shopOfferItem)) {
                this.ui.addMessage(`${enemy.name}: Your inventory is full.`);
                return;
            }

            this.player.money -= price;
            this.player.addItem(enemy.shopOfferItem);
            this.ui.addMessage(`You buy ${itemLabel} for ${price} money.`);
            enemy.shopOfferItem = null;
            enemy.shopOfferPrice = null;
            enemy.shopSoldOut = true;
        }, { confirmLabel: 'Buy', cancelLabel: 'Leave' });
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
            const [x, y] = fromGridKey(key);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue;
            }

            for (const item of items) {
                if (!item?.properties?.shopPendingSale) {
                    continue;
                }

                entries.push({
                    item,
                    x,
                    y,
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

        this.openNpcActionPrompt(
            enemy,
            this.ui.buildShopSettlementPromptText(
                enemy.name,
                settlement.summaryText,
                settlement.buyTotal,
                settlement.sellTotal,
                settlement.balanceLine,
                'Complete the transaction?'
            ),
            [
                { label: 'Settle up', value: true, primary: true },
                { label: 'Later', value: false, cancel: true }
            ],
            () => {
                this.attemptShopSettlement(enemy, settlement);
            },
            {
                cancelValue: false,
                cancelMessage: 'Take your time. We can settle up whenever you\'re ready.'
            }
        );
    },

    interactWithBanker(enemy) {
        const bankBalance = Math.max(0, Math.floor(Number(this.player.bankMoney) || 0));
        this.openNpcActionPrompt(
            enemy,
            'Welcome. Choose a banking service:',
            [
                { label: 'Deposit money', value: 'deposit', primary: true },
                { label: `Withdraw money (${bankBalance})`, value: 'withdraw-money' },
                { label: 'Store item', value: 'store-item' },
                { label: 'Withdraw item', value: 'withdraw-item' },
                { label: 'Cancel', value: 'cancel', cancel: true }
            ],
            (choice) => {
                if (choice === 'deposit') {
                    this.handleBankMoneyDeposit(enemy);
                    return;
                }

                if (choice === 'withdraw-money') {
                    this.handleBankMoneyWithdraw(enemy);
                    return;
                }

                if (choice === 'store-item') {
                    this.handleBankItemDeposit(enemy);
                    return;
                }

                if (choice === 'withdraw-item') {
                    this.handleBankItemWithdraw(enemy);
                }
            },
            {
                cancelValue: 'cancel',
                cancelMessage: 'Come back any time.'
            }
        );
    },

    runBankItemSelectionLoop(enemy, options = {}) {
        const {
            emptyMessage = '',
            promptHeader = 'Choose an item:',
            onCancelMessage = '',
            getEntries = () => [],
            onSelection = null
        } = options;
        let completedSelection = false;

        const openSelection = () => {
            const sourceEntries = Array.isArray(getEntries()) ? getEntries() : [];
            const entries = sourceEntries.filter(Boolean);
            if (entries.length === 0) {
                if (!completedSelection && emptyMessage) {
                    this.ui.addMessage(`${enemy.name}: ${emptyMessage}`);
                }
                return;
            }

            this.openNpcListSelection(
                enemy,
                promptHeader,
                entries,
                (item) => this.getNpcItemChoiceDisplay(item),
                (selectedItem) => {
                    if (!selectedItem) {
                        if (onCancelMessage) {
                            this.ui.addMessage(`${enemy.name}: ${onCancelMessage}`);
                        }
                        return;
                    }

                    completedSelection = true;
                    const shouldContinue = typeof onSelection === 'function'
                        ? onSelection(selectedItem, sourceEntries, entries) !== false
                        : false;
                    if (shouldContinue) {
                        openSelection();
                    }
                }
            );
        };

        openSelection();
    },

    handleBankMoneyDeposit(enemy) {
        const available = Math.max(0, Math.floor(Number(this.player.money) || 0));
        if (available <= 0) {
            this.ui.addMessage(`${enemy.name}: You have no money to deposit.`);
            return;
        }

        this.openNpcNumericPrompt(enemy, `You carry ${available} money. Deposit how much?`, available, (amount) => {
            if (!Number.isFinite(amount) || amount <= 0) {
                this.ui.addMessage(`${enemy.name}: Deposit canceled.`);
                return;
            }

            const safeAmount = Math.min(amount, available);
            this.player.money -= safeAmount;
            this.player.bankMoney = Math.max(0, Math.floor(Number(this.player.bankMoney) || 0)) + safeAmount;
            this.ui.addMessage(`${enemy.name}: Stored ${safeAmount} money. Bank balance: ${this.player.bankMoney}.`);
        });
    },
    handleBankMoneyWithdraw(enemy) {
        const available = Math.max(0, Math.floor(Number(this.player.bankMoney) || 0));
        if (available <= 0) {
            this.ui.addMessage(`${enemy.name}: Your bank account is empty.`);
            return;
        }

        this.openNpcNumericPrompt(enemy, `Your bank balance is ${available}. Withdraw how much?`, available, (amount) => {
            if (!Number.isFinite(amount) || amount <= 0) {
                this.ui.addMessage(`${enemy.name}: Withdrawal canceled.`);
                return;
            }

            const safeAmount = Math.min(amount, available);
            this.player.bankMoney -= safeAmount;
            this.player.money = Math.max(0, Math.floor(Number(this.player.money) || 0)) + safeAmount;
            this.ui.addMessage(`${enemy.name}: Withdrew ${safeAmount} money. Bank balance: ${this.player.bankMoney}.`);
        });
    },

    handleBankItemDeposit(enemy) {
        this.runBankItemSelectionLoop(enemy, {
            emptyMessage: 'You have no items to store.',
            promptHeader: 'Which item should I store?',
            onCancelMessage: 'Storage canceled.',
            getEntries: () => this.getPlayerInventoryItems(),
            onSelection: (selectedItem) => {
                this.player.removeItem(selectedItem);
                this.player.bankItems.push(selectedItem);
                this.ui.addMessage(`${enemy.name}: Stored ${getItemLabel(selectedItem)}.`);
                return true;
            }
        });
    },

    handleBankItemWithdraw(enemy) {
        this.runBankItemSelectionLoop(enemy, {
            emptyMessage: 'You have no stored items.',
            promptHeader: 'Which stored item do you want back?',
            onCancelMessage: 'Withdrawal canceled.',
            getEntries: () => this.player.bankItems,
            onSelection: (selectedItem, storedItems) => {
                const selectedIndex = storedItems.indexOf(selectedItem);
                if (selectedIndex < 0) {
                    this.ui.addMessage(`${enemy.name}: I cannot find that item right now.`);
                    return false;
                }

                const [returnedItem] = storedItems.splice(selectedIndex, 1);
                if (!this.player.addItem(returnedItem)) {
                    storedItems.splice(selectedIndex, 0, returnedItem);
                    this.ui.addMessage(`${enemy.name}: Your inventory is full.`);
                    return false;
                }

                this.ui.addMessage(`${enemy.name}: Returned ${getItemLabel(returnedItem)}.`);
                return true;
            }
        });
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
