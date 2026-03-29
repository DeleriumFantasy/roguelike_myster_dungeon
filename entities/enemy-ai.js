// Enemy perception, AI, and movement helpers

Object.assign(Enemy.prototype, {
    isPariahTarget(enemy) {
        return Boolean(
            enemy
            && enemy !== this
            && isActorAlive(enemy)
            && typeof enemy.hasEnemyType === 'function'
            && enemy.hasEnemyType(ENEMY_TYPES.PARIAH)
        );
    },

    canSeeActor(world, actor) {
        if (!isActorAlive(actor)) {
            return false;
        }

        if (typeof actor.hasCondition === 'function' && actor.hasCondition(CONDITIONS.INVISIBLE)) {
            return false;
        }

        return this.canSeePosition(world, actor.x, actor.y);
    },

    canSeePosition(world, x, y) {
        const cacheKey = toGridKey(x, y);
        if (this.turnCache?.visibility.has(cacheKey)) {
            return this.turnCache.visibility.get(cacheKey);
        }

        const distanceToTarget = distance(this.x, this.y, x, y);
        const canSee = distanceToTarget <= this.fovRange && this.hasLineOfSight(world, x, y);

        if (this.turnCache) {
            this.turnCache.visibility.set(cacheKey, canSee);
        }

        return canSee;
    },

    getNearestTargetFromCandidates(candidates, shouldConsiderTarget) {
        return getNearestByDistance(
            this.x,
            this.y,
            candidates,
            shouldConsiderTarget
        );
    },

    getNearestVisiblePariah(world) {
        if (this.turnCache?.nearestVisiblePariah !== undefined) {
            return this.turnCache.nearestVisiblePariah;
        }

        const nearest = this.getNearestTargetFromCandidates(
            world.getEnemies(),
            (enemy) => this.isPariahTarget(enemy) && this.canSeeActor(world, enemy)
        );

        if (this.turnCache) {
            this.turnCache.nearestVisiblePariah = nearest;
        }

        return nearest;
    },

    getPlayerSideActorAt(world, player, x, y) {
        if (player && player.x === x && player.y === y) {
            return { kind: 'player', target: player };
        }
        const actorAtPos = world.getEnemyAt(x, y, this);
        if (actorAtPos && actorAtPos.isAlly) {
            return { kind: 'ally', target: actorAtPos };
        }
        return null;
    },

    getVisibleHostileTarget(world, player) {
        if (this.turnCache?.visibleHostileTarget !== undefined) {
            return this.turnCache.visibleHostileTarget;
        }

        const candidates = [];

        const pariah = this.getNearestVisiblePariah(world);
        if (pariah) {
            candidates.push({ kind: 'enemy', target: pariah, x: pariah.x, y: pariah.y });
        }

        if (this.canSeeActor(world, player)) {
            candidates.push({ kind: 'player', target: player, x: player.x, y: player.y });
        }

        if (!this.isAlly && world && typeof world.getEnemies === 'function') {
            for (const enemy of world.getEnemies()) {
                if (!enemy || enemy === this || !enemy.isAlly || !isActorAlive(enemy)) {
                    continue;
                }
                if (!this.canSeeActor(world, enemy)) {
                    continue;
                }
                candidates.push({ kind: 'ally', target: enemy, x: enemy.x, y: enemy.y });
            }
        }

        const nearest = getNearestByDistance(this.x, this.y, candidates);

        if (this.turnCache) {
            this.turnCache.visibleHostileTarget = nearest;
        }

        return nearest;
    },

    getGuardFollowTarget(world, player) {
        if (this.isAlly) {
            return isActorAlive(player) ? player : null;
        }

        if (!world || typeof world.getEnemies !== 'function') {
            return null;
        }

        return this.getNearestTargetFromCandidates(
            world.getEnemies(),
            (enemy) => enemy
                && enemy !== this
                && isActorAlive(enemy)
                && !this.isNeutralNpcActor(enemy)
                && !enemy.isAlly
        );
    },

    getNearestVisibleGuardEnemy(world, player) {
        const candidates = [];

        const addCandidateTarget = (kind, target) => {
            if (!target || typeof target.isAlive !== 'function' || !target.isAlive()) {
                return;
            }

            if (this.isNeutralNpcActor(target)) {
                return;
            }

            if (!this.canSeeActor(world, target)) {
                return;
            }

            candidates.push({ kind, target, x: target.x, y: target.y });
        };

        if (this.isAlly) {
            if (world && typeof world.getEnemies === 'function') {
                for (const enemy of world.getEnemies()) {
                    if (!enemy || enemy === this || enemy.isAlly) {
                        continue;
                    }

                    addCandidateTarget('enemy', enemy);
                }
            }

            return getNearestByDistance(this.x, this.y, candidates);
        }

        addCandidateTarget('player', player);

        if (world && typeof world.getEnemies === 'function') {
            for (const enemy of world.getEnemies()) {
                if (!enemy || enemy === this || !enemy.isAlly) {
                    continue;
                }
                addCandidateTarget('ally', enemy);
            }
        }

        return getNearestByDistance(this.x, this.y, candidates);
    },

    isBerserkTargetCandidate(target) {
        return Boolean(
            target
            && target !== this
            && isActorAlive(target)
            && !this.isNeutralNpcActor(target)
        );
    },

    getBerserkMeleeAction(target, player, world, targetDistance) {
        if (target === player && !this.isAlly && this.isVandal() && targetDistance <= this.getVandalAttackRange()) {
            return this.performVandalRangedAttack(world, player);
        }

        if (targetDistance > 1.5) {
            return null;
        }

        if (target === player) {
            return this.performPlayerAttackOrThiefSteal(world, player);
        }

        return this.createAttackEnemyResult(target);
    },

    getNearestBerserkTarget(world, player) {
        const candidates = [];

        if (player && player !== this) {
            candidates.push(player);
        }

        for (const enemy of world.getEnemies()) {
            if (!this.isBerserkTargetCandidate(enemy)) {
                continue;
            }

            candidates.push(enemy);
        }

        return this.getNearestTargetFromCandidates(candidates, (target) => this.canSeeActor(world, target));
    },

    getActionsPerPlayerTurn(player) {
        let actionsPerTurn = getEnemySpeedMultiplier(this.speed);

        if (this.conditions.has(CONDITIONS.HASTE)) {
            actionsPerTurn *= 2;
        }

        if (this.conditions.has(CONDITIONS.SLOW)) {
            actionsPerTurn *= 0.5;
        }

        if (player?.hasCondition?.(CONDITIONS.HASTE)) {
            actionsPerTurn *= 0.5;
        }

        if (player?.hasCondition?.(CONDITIONS.SLOW)) {
            actionsPerTurn *= 2;
        }

        return actionsPerTurn;
    },

    consumeActionTurns(player) {
        this.actionCharge += this.getActionsPerPlayerTurn(player);
        const availableActions = Math.floor(this.actionCharge + Number.EPSILON);
        this.actionCharge = Math.max(0, this.actionCharge - availableActions);
        return availableActions;
    },

    resetTurnCache() {
        this.turnCache = {
            visibility: new Map(),
            nearestVisiblePariah: undefined,
            visibleHostileTarget: undefined,
            nearestVisibleGroundItem: undefined,
            nearestVisibleDisposalTile: undefined
        };
    },

    tickUnreachableItemTargetCooldowns() {
        if (!(this.unreachableItemTargets instanceof Map) || this.unreachableItemTargets.size === 0) {
            return;
        }

        for (const [targetKey, turnsRemaining] of this.unreachableItemTargets.entries()) {
            if (turnsRemaining <= 1) {
                this.unreachableItemTargets.delete(targetKey);
                continue;
            }

            this.unreachableItemTargets.set(targetKey, turnsRemaining - 1);
        }
    },

    rememberUnreachableItemTarget(x, y, turns = 8) {
        if (!(this.unreachableItemTargets instanceof Map)) {
            this.unreachableItemTargets = new Map();
        }

        this.unreachableItemTargets.set(toGridKey(x, y), turns);
    },

    isUnreachableItemTarget(x, y) {
        if (!(this.unreachableItemTargets instanceof Map) || this.unreachableItemTargets.size === 0) {
            return false;
        }

        return this.unreachableItemTargets.has(toGridKey(x, y));
    },

    findNearestReachableTarget(world, candidates) {
        if (!world || !Array.isArray(candidates) || candidates.length === 0) {
            return null;
        }

        const sortedCandidates = candidates
            .slice()
            .sort((left, right) => distance(this.x, this.y, left.x, left.y) - distance(this.x, this.y, right.x, right.y));

        for (const candidate of sortedCandidates) {
            if (!candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
                continue;
            }

            if (this.isUnreachableItemTarget(candidate.x, candidate.y)) {
                continue;
            }

            if (candidate.x === this.x && candidate.y === this.y) {
                return candidate;
            }

            const path = this.findPath(world, candidate.x, candidate.y, { avoidDamagingTiles: true });
            if (Array.isArray(path) && path.length > 1) {
                return candidate;
            }

            this.rememberUnreachableItemTarget(candidate.x, candidate.y);
        }

        return null;
    },

    takeTurn(world, player) {
        this.tickUnreachableItemTargetCooldowns();
        this.resetTurnCache();

        if (this.conditions.has(CONDITIONS.SLEEP)) {
            if (this.sleepLockedUntilPlayerEntry) {
                const sleepResult = { type: 'sleep' };
                this.regenerateOnNonAttackTurn(sleepResult);
                this.applyEnvironmentEffects(world);
                return sleepResult;
            }

            this.tickConditions();
            const sleepResult = { type: 'sleep' };
            this.regenerateOnNonAttackTurn(sleepResult);
            this.applyEnvironmentEffects(world);
            return sleepResult;
        }

        this.tickConditions();

        if (!this.isAlive()) return;

        const actionResult = this.performAction(world, player);
        this.regenerateOnNonAttackTurn(actionResult);

        this.applyEnvironmentEffects(world);

        return actionResult;
    },

    didAttackThisTurn(actionResult) {
        const resultType = actionResult?.type;
        if (typeof resultType !== 'string') {
            return false;
        }

        if (resultType.startsWith('attack-')) {
            return true;
        }

        return resultType === 'vandal-ranged-attack' || resultType === 'thief-steal';
    },

    regenerateOnNonAttackTurn(actionResult) {
        if (!this.isAlive()) {
            return;
        }

        if (this.didAttackThisTurn(actionResult)) {
            return;
        }

        if (this.health >= this.maxHealth) {
            return;
        }

        this.heal(1);
    },

    tickConditions() {
        for (const [condition, duration] of this.conditions) {
            const tickDamage = getConditionTickDamage(condition, 0);
            if (tickDamage > 0) {
                this.takeDamage(tickDamage);
            }
            if (duration > 1) {
                this.conditions.set(condition, duration - 1);
            } else {
                this.conditions.delete(condition);
            }
        }
    },

    performAction(world, player) {
        if (this.isNeutralNpc()) {
            this.lastResolvedAi = AI_TYPES.WANDER;
            return this.performWanderAction(world, player);
        }

        if (this.isPassiveQuestEscort()) {
            this.lastResolvedAi = AI_TYPES.GUARD;
            return this.performPassiveQuestEscortAction(world, player);
        }

        if (this.conditions.has(CONDITIONS.BLIND)) {
            return this.performBlindAction(world, player);
        }

        if (this.conditions.has(CONDITIONS.BERSERK)) {
            this.lastResolvedAi = AI_TYPES.BERSERK;
            return this.performBerserkAction(world, player);
        }

        const vandalAction = this.performVandalAction(world, player);
        if (vandalAction) {
            return vandalAction;
        }

        const crafterAction = this.performCrafterAction(world);
        if (crafterAction) {
            return crafterAction;
        }

        const resolvedAi = this.getAiTypeForTurn(world, player);
        this.lastResolvedAi = resolvedAi;

        const methodName = getEnemyAiActionHandlerName(resolvedAi);
        if (typeof this[methodName] === 'function') {
            return this[methodName](world, player);
        }

        return this.performWanderAction(world, player);
    },

    getAiTypeForTurn(world, player) {
        const statusAiOverride = this.getStatusAiOverride();

        if (this.isAlly) {
            if (statusAiOverride) {
                return statusAiOverride;
            }
            return AI_TYPES.GUARD;
        }

        if (this.isVandal() && this.hasHeldItem() && this.getVandalTier() === 2) {
            return AI_TYPES.FLEE;
        }

        if (statusAiOverride) {
            return statusAiOverride;
        }

        const visibleHostile = this.getVisibleHostileTarget(world, player);
        if (visibleHostile) {
            this.rememberLastHostilePos(visibleHostile);
            return AI_TYPES.CHASE;
        }

        if (this.lastHostilePos) {
            if (this.x === this.lastHostilePos.x && this.y === this.lastHostilePos.y) {
                this.lastHostilePos = null;
                return this.baseAiType;
            }
            return AI_TYPES.CHASE;
        }

        return this.baseAiType;
    },

    rememberLastHostilePos(target) {
        if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
            return;
        }

        this.lastHostilePos = { x: target.x, y: target.y };
    },

    getStatusAiOverride() {
        for (const [condition, overrideAi] of this.aiByStatus) {
            if (this.conditions.has(condition)) {
                return overrideAi;
            }
        }

        return null;
    },

    canLookThroughWalls() {
        return this.hasEnemyType(ENEMY_TYPES.GHOST);
    },

    canTraverseTile(tile) {
        return canActorTraverseTile(tile, this.creatureTypes);
    },

    isValidVandalPickupTile(world, x, y) {
        if (!world) {
            return false;
        }

        return world.getTile(x, y) === TILE_TYPES.FLOOR;
    },

    getNearestVisibleGroundItem(world) {
        if (!world || this.hasHeldItem()) {
            return null;
        }

        if (this.turnCache?.nearestVisibleGroundItem !== undefined) {
            return this.turnCache.nearestVisibleGroundItem;
        }

        const candidates = [];
        for (const [key, items] of world.getCurrentFloor().items.entries()) {
            if (!Array.isArray(items) || items.length === 0) {
                continue;
            }

            const [x, y] = fromGridKey(key);
            if (!this.canSeePosition(world, x, y)) {
                continue;
            }

            if (this.isVandal() && !this.isValidVandalPickupTile(world, x, y)) {
                continue;
            }

            candidates.push({ x, y, item: items[0] });
        }

        const nearest = this.findNearestReachableTarget(world, candidates);

        if (this.turnCache) {
            this.turnCache.nearestVisibleGroundItem = nearest;
        }

        return nearest;
    },

    getNearestVisibleVandalDisposalTile(world) {
        if (!world || !this.hasHeldItem()) {
            return null;
        }

        if (this.turnCache?.nearestVisibleDisposalTile !== undefined) {
            return this.turnCache.nearestVisibleDisposalTile;
        }

        const disposalTiles = typeof world.getDisposalTiles === 'function'
            ? world.getDisposalTiles()
            : [];

        const visibleDisposalTiles = disposalTiles.filter((disposalTile) => this.canSeePosition(world, disposalTile.x, disposalTile.y));
        const nearest = this.findNearestReachableTarget(world, visibleDisposalTiles);

        if (this.turnCache) {
            this.turnCache.nearestVisibleDisposalTile = nearest;
        }

        return nearest;
    },

    pickupGroundItem(world) {
        if (!world || this.hasHeldItem()) {
            return null;
        }

        if (this.isVandal() && !this.isValidVandalPickupTile(world, this.x, this.y)) {
            return null;
        }

        const items = world.getItems(this.x, this.y);
        if (!Array.isArray(items) || items.length === 0) {
            return null;
        }

        const item = items[0];
        world.removeItem(this.x, this.y, item);
        this.setHeldItem(item);
        return item;
    },

    applyVandalPickupEffect() {
        const heldItem = this.getHeldItem();
        if (!this.isVandal() || !heldItem) {
            return null;
        }

        const vandalTier = this.getVandalTier();
        if (vandalTier === 2) {
            const nextHeldItem = createLowerTierVersionOfItem(heldItem) || heldItem;
            this.setHeldItem(nextHeldItem);
            return { effect: 'downgrade', item: nextHeldItem };
        }

        if (vandalTier === 3) {
            const nextHeldItem = createBitterSeedsItemFrom(heldItem) || heldItem;
            this.setHeldItem(nextHeldItem);
            return { effect: 'transform-food', item: nextHeldItem };
        }

        if (vandalTier === 4) {
            const destroyedItem = this.takeHeldItem();
            return { effect: 'destroy-item', item: destroyedItem };
        }

        return { effect: 'hold-item', item: heldItem };
    },

    performVandalAction(world, player) {
        if (!this.isVandal()) {
            return null;
        }

        if (!this.hasHeldItem()) {
            const pickedUpItem = this.pickupGroundItem(world);
            if (pickedUpItem) {
                const pickupEffect = this.applyVandalPickupEffect();
                return this.createEnemyActionResult('vandal-pickup-item', {
                    item: pickedUpItem,
                    itemEffect: pickupEffect
                });
            }

            const visibleItem = this.getNearestVisibleGroundItem(world);
            if (visibleItem) {
                this.targetX = visibleItem.x;
                this.targetY = visibleItem.y;
                return this.tryMoveTowardTarget(world, visibleItem.x, visibleItem.y, player);
            }

            return null;
        }

        if (this.getVandalTier() === 1) {
            const disposalTile = this.getNearestVisibleVandalDisposalTile(world);
            if (disposalTile) {
                const thrownItem = this.takeHeldItem();
                return this.createEnemyActionResult('vandal-dispose-item', {
                    item: thrownItem,
                    targetTile: disposalTile
                });
            }
        }

        return null;
    },

    performCrafterAction(world) {
        if (!this.isCrafter() || !world || typeof world.getTrap !== 'function') {
            return null;
        }

        if (world.getTrap(this.x, this.y)) {
            return null;
        }

        if (getRngRoll() >= 0.05) {
            return null;
        }

        const trapTypes = getTrapTypes();
        if (!Array.isArray(trapTypes) || trapTypes.length === 0) {
            return null;
        }

        const trapType = pickRandom(trapTypes);
        const placed = typeof world.setTrap === 'function'
            ? world.setTrap(this.x, this.y, trapType, true)
            : false;

        if (!placed) {
            return null;
        }

        return {
            type: 'crafter-create-trap',
            trapType,
            x: this.x,
            y: this.y
        };
    },

    applyEnvironmentEffects(world) {
        const { tile, hazard, tileDamage, hazardDamage } = this.getEnvironmentalDamageProfile(world, this.x, this.y);

        if (tileDamage > 0 && !isActorImmuneToTileEffect(tile, this.creatureTypes)) {
            const armorEffectiveness =
                tile === TILE_TYPES.WATER || tile === TILE_TYPES.LAVA ? 0
                    : tile === TILE_TYPES.SPIKE ? 0.5
                        : 1;
            this.takeDamage(tileDamage, null, { armorEffectiveness });
        }

        if (hazardDamage > 0) {
            const armorEffectiveness = hazard === HAZARD_TYPES.STEAM ? 0.5 : 1;
            this.takeDamage(hazardDamage, null, { armorEffectiveness });
        }
    },

    getEnvironmentalDamageProfile(world, x, y) {
        const tile = world.getTile(x, y);
        const hazard = typeof world.getHazard === 'function' ? world.getHazard(x, y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        return { tile, hazard, tileDamage, hazardDamage };
    },

    isDamagingPosition(world, x, y) {
        const { tile, tileDamage, hazardDamage } = this.getEnvironmentalDamageProfile(world, x, y);

        if (hazardDamage > 0) {
            return true;
        }

        return tileDamage > 0 && !isActorImmuneToTileEffect(tile, this.creatureTypes);
    },

    isWithinBounds(x, y) {
        return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
    },

    canOccupyTile(world, x, y, player = null, options = {}) {
        const { avoidDamagingTiles = false } = options;

        if (!this.isWithinBounds(x, y)) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        if (world.getEnemyAt(x, y, this)) {
            return false;
        }

        const tile = world.getTile(x, y);
        if (!this.canTraverseTile(tile)) {
            return false;
        }

        if (avoidDamagingTiles && this.isDamagingPosition(world, x, y)) {
            return false;
        }

        return true;
    },

    performWanderAction(world, player) {
        if (this.targetX === null || (this.x === this.targetX && this.y === this.targetY)) {
            const target = this.getRandomWalkableTarget(world);
            this.targetX = target.x;
            this.targetY = target.y;
        }

        return this.tryMoveTowardTarget(world, this.targetX, this.targetY, player);
    },

    performChaseAction(world, player) {
        const visibleHostile = this.getVisibleHostileTarget(world, player);
        if (visibleHostile) {
            this.rememberLastHostilePos(visibleHostile);

            const meleeRange = distance(this.x, this.y, visibleHostile.x, visibleHostile.y);
            if (visibleHostile.kind === 'player' && !this.isAlly && this.isVandal() && meleeRange <= this.getVandalAttackRange()) {
                return this.performVandalRangedAttack(world, player);
            }

            if (meleeRange <= 1.5) {
                if (visibleHostile.kind === 'player') {
                    if (!this.isAlly) {
                        return this.performPlayerAttackOrThiefSteal(world, player);
                    }
                    return { type: 'blocked' };
                }

                return this.createAttackEnemyResult(visibleHostile.target);
            }

            return this.tryMoveTowardTarget(world, visibleHostile.x, visibleHostile.y, player);
        }

        if (this.lastHostilePos) {
            const chaseResult = this.tryMoveTowardTarget(world, this.lastHostilePos.x, this.lastHostilePos.y, player);
            if (chaseResult?.type === 'blocked') {
                this.lastHostilePos = null;
            }
            return chaseResult;
        }

        return { type: 'wait' };
    },

    performAmbushAction(world, player) {
        const distanceToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distanceToPlayer <= Math.max(1, this.fovRange - 2) && this.hasLineOfSight(world, player.x, player.y)) {
            return this.performChaseAction(world, player);
        }

        return { type: 'wait' };
    },

    performGuardAction(world, player) {
        const visibleEnemy = this.getNearestVisibleGuardEnemy(world, player);
        if (visibleEnemy) {
            const targetDistance = distance(this.x, this.y, visibleEnemy.x, visibleEnemy.y);
            if (targetDistance <= 1.5) {
                if (visibleEnemy.kind === 'player') {
                    return this.createAttackPlayerResult(visibleEnemy.target);
                }

                return this.createAttackEnemyResult(visibleEnemy.target);
            }

            return this.tryMoveTowardTarget(world, visibleEnemy.x, visibleEnemy.y, player);
        }

        const followTarget = this.getGuardFollowTarget(world, player);
        if (!followTarget) {
            return { type: 'wait' };
        }

        const distanceToAlly = distance(this.x, this.y, followTarget.x, followTarget.y);
        if (distanceToAlly > 1.5) {
            return this.tryMoveTowardTarget(world, followTarget.x, followTarget.y, player);
        }

        return { type: 'wait' };
    },

    isPassiveQuestEscort() {
        return Boolean(this.isAlly && this.questEscortPassive && Number.isFinite(this.questEscortId));
    },

    getAdjacentQuestEscortThreats(world) {
        if (!world || typeof world.getEnemies !== 'function') {
            return [];
        }

        const threats = [];
        for (const enemy of world.getEnemies()) {
            if (!enemy || enemy === this || !enemy.isAlive?.() || enemy.isAlly || this.isNeutralNpcActor(enemy)) {
                continue;
            }

            if (distance(this.x, this.y, enemy.x, enemy.y) <= 1.5) {
                threats.push(enemy);
            }
        }

        return threats;
    },

    performQuestEscortRetreat(world, player, threats) {
        const hostileThreats = Array.isArray(threats) ? threats : [];
        if (hostileThreats.length === 0) {
            return { type: 'wait' };
        }

        const currentMinDistance = hostileThreats.reduce((nearest, threat) => {
            return Math.min(nearest, distance(this.x, this.y, threat.x, threat.y));
        }, Infinity);

        let bestStep = null;
        for (const avoidDamagingTiles of [true, false]) {
            for (const step of shuffle(getNeighbors(this.x, this.y).slice())) {
                if (!this.canOccupyTile(world, step.x, step.y, player, { avoidDamagingTiles })) {
                    continue;
                }

                const nearestThreatDistance = hostileThreats.reduce((nearest, threat) => {
                    return Math.min(nearest, distance(step.x, step.y, threat.x, threat.y));
                }, Infinity);
                const distanceToPlayer = player ? distance(step.x, step.y, player.x, player.y) : Infinity;
                const stepScore = {
                    x: step.x,
                    y: step.y,
                    nearestThreatDistance,
                    distanceToPlayer
                };

                if (!bestStep
                    || stepScore.nearestThreatDistance > bestStep.nearestThreatDistance
                    || (stepScore.nearestThreatDistance === bestStep.nearestThreatDistance
                        && stepScore.distanceToPlayer < bestStep.distanceToPlayer)) {
                    bestStep = stepScore;
                }
            }

            if (bestStep) {
                break;
            }
        }

        if (!bestStep || bestStep.nearestThreatDistance <= currentMinDistance) {
            return { type: 'wait' };
        }

        world.moveEnemy(this, bestStep.x, bestStep.y);
        return { type: 'move' };
    },

    performPassiveQuestEscortAction(world, player) {
        if (this.conditions.has(CONDITIONS.BOUND)) {
            return { type: 'wait' };
        }

        const adjacentThreats = this.getAdjacentQuestEscortThreats(world);
        if (adjacentThreats.length > 0) {
            return this.performQuestEscortRetreat(world, player, adjacentThreats);
        }

        if (!player || !player.isAlive?.()) {
            return { type: 'wait' };
        }

        const distanceToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distanceToPlayer > 1.5) {
            return this.tryMoveTowardTarget(world, player.x, player.y, player);
        }

        return { type: 'wait' };
    },

    performBerserkAction(world, player) {
        const target = this.getNearestBerserkTarget(world, player);
        if (!target) {
            return { type: 'wait' };
        }

        const targetDistance = distance(this.x, this.y, target.x, target.y);
        const meleeAction = this.getBerserkMeleeAction(target, player, world, targetDistance);
        if (meleeAction) {
            return meleeAction;
        }

        this.rememberLastHostilePos(target);
        return this.tryMoveTowardTarget(world, target.x, target.y, player);
    },

    getAdjacentHostileAction(world, player, neighbor) {
        const isBerserk = this.conditions.has(CONDITIONS.BERSERK);

        if (player && (isBerserk || !this.isAlly) && neighbor.x === player.x && neighbor.y === player.y) {
            return this.performPlayerAttackOrThiefSteal(world, player);
        }

        const blockingEnemy = world.getEnemyAt(neighbor.x, neighbor.y, this);
        if (blockingEnemy && !this.isNeutralNpcActor(blockingEnemy) && (isBerserk || this.isAlly !== blockingEnemy.isAlly)) {
            return this.createAttackEnemyResult(blockingEnemy);
        }

        return null;
    },

    performBlindAction(world, player) {
        const neighbors = shuffle(getNeighbors(this.x, this.y).slice());

        if (this.conditions.has(CONDITIONS.BOUND)) {
            for (const neighbor of neighbors) {
                const adjacentHostileAction = this.getAdjacentHostileAction(world, player, neighbor);
                if (adjacentHostileAction) {
                    return adjacentHostileAction;
                }
            }

            return { type: 'wait' };
        }

        for (const neighbor of neighbors) {
            const adjacentHostileAction = this.getAdjacentHostileAction(world, player, neighbor);
            if (adjacentHostileAction) {
                return adjacentHostileAction;
            }

            if (this.canOccupyTile(world, neighbor.x, neighbor.y, player)) {
                world.moveEnemy(this, neighbor.x, neighbor.y);
                return { type: 'move' };
            }
        }

        return { type: 'wait' };
    },

    getRandomWalkableTarget(world) {
        if (!world || typeof world.getTile !== 'function') {
            return { x: this.x, y: this.y };
        }

        if (typeof world.findRandomFloorTile === 'function') {
            const rng = createMathRng();
            const tile = world.findRandomFloorTile(rng, 200);
            return tile || { x: this.x, y: this.y };
        }

        if (typeof world.findRandomTile === 'function') {
            const rng = createMathRng();
            const tile = world.findRandomTile(rng, 200, (x, y) => world.getTile(x, y) === TILE_TYPES.FLOOR);
            return tile || { x: this.x, y: this.y };
        }

        for (let attempt = 0; attempt < 200; attempt++) {
            const x = randomInt(1, GRID_SIZE - 2);
            const y = randomInt(1, GRID_SIZE - 2);
            if (world.getTile(x, y) !== TILE_TYPES.FLOOR) {
                continue;
            }

            return { x, y };
        }

        return { x: this.x, y: this.y };
    },

    getPreferredMoveSteps(targetX, targetY) {
        const dx = Math.sign(targetX - this.x);
        const dy = Math.sign(targetY - this.y);
        const steps = [];
        const pushUniqueStep = (x, y) => {
            if (!steps.some((step) => step.x === x && step.y === y)) {
                steps.push({ x, y });
            }
        };

        if (dx !== 0 || dy !== 0) {
            pushUniqueStep(this.x + dx, this.y + dy);
        }
        if (dx !== 0) {
            pushUniqueStep(this.x + dx, this.y);
        }
        if (dy !== 0) {
            pushUniqueStep(this.x, this.y + dy);
        }

        return steps;
    },

    shouldNeutralNpcYieldToOccupiedStep(world, player, x, y) {
        if (!this.isNeutralNpc()) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return true;
        }

        return Boolean(world.getEnemyAt(x, y, this));
    },

    tryDirectMoveTowardTarget(world, targetX, targetY, player = null) {
        const candidateSteps = this.getPreferredMoveSteps(targetX, targetY);

        for (const avoidDamagingTiles of [true, false]) {
            for (const step of candidateSteps) {
                if (this.shouldNeutralNpcYieldToOccupiedStep(world, player, step.x, step.y)) {
                    return { type: 'wait' };
                }

                const playerSideActor = this.getPlayerSideActorAt(world, player, step.x, step.y);
                if (playerSideActor) {
                    if (!this.isAlly) {
                        if (playerSideActor.kind === 'player') {
                            return this.performPlayerAttackOrThiefSteal(world, player);
                        }
                        return this.createAttackEnemyResult(playerSideActor.target);
                    }
                    continue;
                }

                if (!this.canOccupyTile(world, step.x, step.y, player, { avoidDamagingTiles })) {
                    continue;
                }

                world.moveEnemy(this, step.x, step.y);
                return { type: 'move' };
            }
        }

        return null;
    },

    tryMoveTowardTarget(world, targetX, targetY, player = null) {
        if (targetX === null || targetY === null) {
            return false;
        }

        if (this.conditions.has(CONDITIONS.BOUND)) {
            return { type: 'wait' };
        }

        const directMove = this.tryDirectMoveTowardTarget(world, targetX, targetY, player);
        if (directMove) {
            return directMove;
        }

        const path = this.findPath(world, targetX, targetY, { avoidDamagingTiles: true });
        if (path && path.length > 1) {
            const next = path[1];

            if (this.shouldNeutralNpcYieldToOccupiedStep(world, player, next.x, next.y)) {
                return { type: 'wait' };
            }

            const playerSideActor = this.getPlayerSideActorAt(world, player, next.x, next.y);
            if (playerSideActor) {
                if (!this.isAlly) {
                    if (playerSideActor.kind === 'player') {
                        return this.performPlayerAttackOrThiefSteal(world, player);
                    }
                    return this.createAttackEnemyResult(playerSideActor.target);
                }
                return { type: 'blocked' };
            }

            if (!this.canOccupyTile(world, next.x, next.y, player, { avoidDamagingTiles: true })
                && !this.canOccupyTile(world, next.x, next.y, player, { avoidDamagingTiles: false })) {
                return { type: 'blocked' };
            }

            world.moveEnemy(this, next.x, next.y);
            return { type: 'move' };
        }

        this.targetX = null;
        this.targetY = null;
        return { type: 'blocked' };
    },

    flee(world, player) {
        if (this.conditions.has(CONDITIONS.BOUND)) {
            return { type: 'wait' };
        }

        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = distance(this.x, this.y, player.x, player.y);
        if (dist > 0) {
            const dirX = Math.round(dx / dist);
            const dirY = Math.round(dy / dist);
            const newX = this.x + dirX;
            const newY = this.y + dirY;
            if (this.canOccupyTile(world, newX, newY, player)) {
                world.moveEnemy(this, newX, newY);
                return { type: 'move' };
            }
        }

        return { type: 'blocked' };
    },

    findPath(world, targetX, targetY, options = {}) {
        const { avoidDamagingTiles = false } = options;
        const edgeCostFn = avoidDamagingTiles
            ? (nx, ny) => this.canOccupyTile(world, nx, ny, null, { avoidDamagingTiles: true }) ? 1 : 20
            : null;
        return findPathAStar(this.x, this.y, targetX, targetY, (nx, ny, isGoal) => {
            if (isGoal) return true;
            return !!this.canOccupyTile(world, nx, ny, null, { avoidDamagingTiles: false });
        }, edgeCostFn);
    }
});
