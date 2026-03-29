// Player turn input and action resolution helpers

Game.prototype.processPlayerTurn = function(input) {
    if (this.player.hasCondition(CONDITIONS.SLEEP)) {
        this.player.tickConditions();
        this.ui.addMessage('You are asleep and miss your turn.');
        return this.createPlayerTurnResult({ consumed: true, actionType: 'sleep' });
    }

    if (this.player.hasCondition(CONDITIONS.BERSERK)) {
        return this.processPlayerBerserkTurn();
    }

    switch (input?.type) {
        case 'move':
            return this.processPlayerMoveTurn(input);
        case 'throw':
            return this.processPlayerThrowTurn(input);
        case 'attack':
            return this.processPlayerAttackTurn(input);
        default:
            this.player.tickConditions();
            return this.createPlayerTurnResult({ consumed: true, actionType: 'wait' });
    }
};

Game.prototype.processPlayerBoundMoveTurn = function() {
    this.player.tickConditions();
    this.ui.addMessage('You are bound and cannot move.');
    this.clearFailedMoveRecord();
    return this.createPlayerTurnResult({ consumed: true, applyEnvironmentAfterAction: false, actionType: 'bound-move' });
};

Game.prototype.getPlayerMoveTarget = function(input) {
    return {
        x: this.player.x + input.dx,
        y: this.player.y + input.dy
    };
};

Game.prototype.trySwapPlayerWithAlly = function(targetX, targetY) {
    const allyAtTarget = this.world.getEnemyAt(targetX, targetY);
    if (!allyAtTarget || !allyAtTarget.isAlly) {
        return null;
    }

    this.player.tickConditions();

    const prevPlayerX = this.player.x;
    const prevPlayerY = this.player.y;
    this.world.moveEnemy(allyAtTarget, prevPlayerX, prevPlayerY);
    this.player.x = targetX;
    this.player.y = targetY;
    this.clearFailedMoveRecord();
    this.tryWakeCatacombsHoardEvent?.();
    this.pickupItemsAfterMove(targetX, targetY);
    return this.createPlayerMoveResult({
        consumed: true,
        moved: true,
        swappedWithAlly: true
    });
};

Game.prototype.tryMovePlayerToTarget = function(input, targetX, targetY) {
    if (!this.world.canPlayerOccupy(targetX, targetY)) {
        this.recordFailedMove(input);
        return this.createPlayerMoveResult({ consumed: false, moved: false });
    }

    this.player.tickConditions();

    const floorBeforeMove = this.world.currentFloor;
    const moved = this.player.move(input.dx, input.dy, this.world);
    if (!moved) {
        this.recordFailedMove(input);
        return this.createPlayerMoveResult({ consumed: false, moved: false });
    }

    this.clearFailedMoveRecord();
    this.applyPlayerTrapAtCurrentPosition();

    if (this.world.currentFloor === floorBeforeMove) {
        this.tryWakeCatacombsHoardEvent?.();
        this.pickupItemsAfterMove(targetX, targetY);
    }

    return this.createPlayerMoveResult({
        consumed: true,
        moved: true
    });
};

Game.prototype.processPlayerMoveTurn = function(input) {
    if (this.player.hasCondition(CONDITIONS.BOUND)) {
        return this.processPlayerBoundMoveTurn();
    }

    const moveTarget = this.getPlayerMoveTarget(input);
    const allySwapResult = this.trySwapPlayerWithAlly(moveTarget.x, moveTarget.y);
    if (allySwapResult) {
        return this.createPlayerTurnResult({
            consumed: allySwapResult.consumed,
            applyEnvironmentAfterAction: false,
            actionType: allySwapResult.actionType
        });
    }

    const moveResult = this.tryMovePlayerToTarget(input, moveTarget.x, moveTarget.y);
    return this.createPlayerTurnResult({
        consumed: moveResult.consumed,
        applyEnvironmentAfterAction: false,
        actionType: moveResult.actionType
    });
};

Game.prototype.dequeuePlayerThrownItem = function(input) {
    if (!input.item) {
        return null;
    }

    return this.player.dequeueThrowItem(input.item);
};

Game.prototype.resolvePlayerThrow = function(input, thrownItem) {
    input.item.identify?.();
    thrownItem.identify?.();

    const throwResult = this.resolveThrow(thrownItem, input.dx, input.dy);
    if (Number.isFinite(throwResult?.x) && Number.isFinite(throwResult?.y)) {
        this.ui.playThrowTrailEffect?.(this.player.x, this.player.y, throwResult.x, throwResult.y);
    }
    this.announceThrowResult(thrownItem, throwResult);
    this.clearFailedMoveRecord();
    return this.createPlayerTurnResult({ consumed: true, actionType: 'throw' });
};

Game.prototype.processPlayerThrowTurn = function(input) {
    this.player.tickConditions();

    const thrownItem = this.dequeuePlayerThrownItem(input);
    if (!thrownItem) {
        return this.createPlayerTurnResult({ consumed: false, actionType: 'throw' });
    }

    return this.resolvePlayerThrow(input, thrownItem);
};

Game.prototype.createAttackPassSummary = function() {
    return {
        attackedAnyEnemyInPass: false,
        destroyedAnyWallInPass: false,
        destroyedWallCount: 0,
        lostPickaxeImprovementCount: 0,
        revealedAnyTrapInPass: false,
        ruinedAnyTrapInPass: false
    };
};

Game.prototype.getPlayerAttackTarget = function(offset) {
    return {
        x: this.player.x + offset.dx,
        y: this.player.y + offset.dy
    };
};

Game.prototype.applyAttackPassTrapEffects = function(targetX, targetY, hasRuinTraps) {
    const trapOutcome = {
        revealedTrap: false,
        ruinedTrap: false
    };

    if (typeof this.world.getTrap !== 'function') {
        return trapOutcome;
    }

    const trapType = this.world.getTrap(targetX, targetY);
    if (!trapType) {
        return trapOutcome;
    }

    if (hasRuinTraps && typeof this.world.removeTrap === 'function') {
        this.world.removeTrap(targetX, targetY);
        trapOutcome.ruinedTrap = true;
        return trapOutcome;
    }

    if (typeof this.world.revealTrap === 'function') {
        const alreadyRevealed = typeof this.world.isTrapRevealed === 'function'
            ? this.world.isTrapRevealed(targetX, targetY)
            : false;
        this.world.revealTrap(targetX, targetY);
        trapOutcome.revealedTrap = !alreadyRevealed;
    }

    return trapOutcome;
};

Game.prototype.getAttackableEnemyAt = function(targetX, targetY, attackedEnemyKeys) {
    const enemyOnTarget = this.world.getEnemyAt(targetX, targetY);
    if (!enemyOnTarget || enemyOnTarget.isAlly) {
        return null;
    }

    const enemyKey = `${enemyOnTarget.x},${enemyOnTarget.y},${enemyOnTarget.name}`;
    if (attackedEnemyKeys.has(enemyKey)) {
        return null;
    }

    attackedEnemyKeys.add(enemyKey);
    return enemyOnTarget;
};

Game.prototype.tryApplyPlayerAttackKnockback = function(enemy, damage, hasKnockback) {
    if (!hasKnockback || damage <= 0 || !enemy.isAlive() || Math.random() >= 0.25) {
        return;
    }

    const knockedBack = this.tryKnockbackEnemy(enemy, this.player.x, this.player.y);
    if (knockedBack) {
        this.ui.addMessage(`${enemy.name} is knocked back.`);
    }
};

Game.prototype.resolvePlayerAttackAgainstEnemy = function(enemy, hasKnockback) {
    const targetX = enemy.x;
    const targetY = enemy.y;
    const attackResult = this.player.attackEnemy(enemy);
    const { damage, critical, inflictedConditions } = this.extractAttackResultData(attackResult);
    this.ui.playHitPulseEffect?.(targetX, targetY, { targetSide: 'enemy' });
    const criticalPrefix = critical ? 'Critical! ' : '';
    this.ui.addMessage(`${criticalPrefix}You attack ${enemy.name} for ${damage}.`);
    this.announceInflictedConditions(enemy.name, inflictedConditions);
    this.tryApplyPlayerAttackKnockback(enemy, damage, hasKnockback);

    if (!enemy.isAlive()) {
        this.handleEnemyDefeat(enemy, { announceDefeat: true, killer: this.player });
    }
};

Game.prototype.getPlayerMiningWeapon = function() {
    const weapon = this.player?.equipment?.get(EQUIPMENT_SLOTS.WEAPON) || null;
    return weapon?.properties?.breaksWalls ? weapon : null;
};

Game.prototype.tryBreakWallWithPickaxe = function(targetX, targetY, weapon) {
    if (!weapon || this.world.getTile(targetX, targetY) !== TILE_TYPES.WALL) {
        return { destroyed: false, lostImprovement: 0 };
    }

    this.world.setTile(targetX, targetY, TILE_TYPES.FLOOR);
    this.fovCache = null;

    const hasMinerAccessory = typeof this.player?.hasEquippedEnchantment === 'function'
        ? this.player.hasEquippedEnchantment('miner')
        : false;
    const degradationChance = hasMinerAccessory ? 0.05 : 0.6;

    return {
        destroyed: true,
        lostImprovement: typeof weapon.tryLoseImprovement === 'function'
            ? weapon.tryLoseImprovement(degradationChance, 1, getRngRoll)
            : 0
    };
};

Game.prototype.combineAttackPassSummaries = function(baseSummary, nextSummary) {
    return {
        attackedAnyEnemyInPass: baseSummary.attackedAnyEnemyInPass || nextSummary.attackedAnyEnemyInPass,
        destroyedAnyWallInPass: baseSummary.destroyedAnyWallInPass || nextSummary.destroyedAnyWallInPass,
        destroyedWallCount: baseSummary.destroyedWallCount + nextSummary.destroyedWallCount,
        lostPickaxeImprovementCount: baseSummary.lostPickaxeImprovementCount + nextSummary.lostPickaxeImprovementCount,
        revealedAnyTrapInPass: baseSummary.revealedAnyTrapInPass || nextSummary.revealedAnyTrapInPass,
        ruinedAnyTrapInPass: baseSummary.ruinedAnyTrapInPass || nextSummary.ruinedAnyTrapInPass
    };
};

Game.prototype.announcePlayerAttackPassSummary = function(passSummary) {
    if (passSummary.destroyedAnyWallInPass) {
        this.ui.addMessage(`You break ${passSummary.destroyedWallCount} wall(s) with the Pickaxe.`);
        if (passSummary.lostPickaxeImprovementCount > 0) {
            this.ui.addMessage(`The Pickaxe loses ${passSummary.lostPickaxeImprovementCount} improvement.`);
        }
    }

    if (passSummary.revealedAnyTrapInPass) {
        this.ui.addMessage('You reveal a hidden trap.');
    }

    if (passSummary.ruinedAnyTrapInPass) {
        this.ui.addMessage('You destroy a trap with Ruin traps.');
    }

    if (!passSummary.attackedAnyEnemyInPass && !passSummary.destroyedAnyWallInPass) {
        this.ui.addMessage('You swing at empty space.');
    }
};

Game.prototype.executePlayerAttackPass = function(offsets, options = {}) {
    const { hasKnockback = false, hasRuinTraps = false } = options;
    const attackedEnemyKeys = new Set();
    const passSummary = this.createAttackPassSummary();
    const miningWeapon = this.getPlayerMiningWeapon();

    for (const offset of offsets) {
        const attackTarget = this.getPlayerAttackTarget(offset);
        this.ui.playMeleeStrikeEffect?.(this.player.x, this.player.y, attackTarget.x, attackTarget.y, {
            attackerSide: 'player',
            durationMs: 200
        });
        const trapOutcome = this.applyAttackPassTrapEffects(attackTarget.x, attackTarget.y, hasRuinTraps);
        passSummary.revealedAnyTrapInPass = passSummary.revealedAnyTrapInPass || trapOutcome.revealedTrap;
        passSummary.ruinedAnyTrapInPass = passSummary.ruinedAnyTrapInPass || trapOutcome.ruinedTrap;

        const wallBreakResult = this.tryBreakWallWithPickaxe(attackTarget.x, attackTarget.y, miningWeapon);
        if (wallBreakResult.destroyed) {
            passSummary.destroyedAnyWallInPass = true;
            passSummary.destroyedWallCount += 1;
            passSummary.lostPickaxeImprovementCount += wallBreakResult.lostImprovement;
            continue;
        }

        const enemyOnTarget = this.getAttackableEnemyAt(attackTarget.x, attackTarget.y, attackedEnemyKeys);
        if (!enemyOnTarget) {
            continue;
        }

        passSummary.attackedAnyEnemyInPass = true;
        this.resolvePlayerAttackAgainstEnemy(enemyOnTarget, hasKnockback);
    }

    return passSummary;
};

Game.prototype.processPlayerAttackTurn = function(input) {
    const attackDx = Number(input.dx) || 0;
    const attackDy = Number(input.dy) || 0;
    if (attackDx === 0 && attackDy === 0) {
        return this.createPlayerTurnResult({ consumed: false, actionType: 'attack' });
    }

    this.lookTowards(attackDx, attackDy);
    this.player.tickConditions();

    const offsets = this.getAttackOffsetsForFacing(attackDx, attackDy);
    const hasKnockback = this.playerHasEquippedEnchantment('knockback');
    const hasRuinTraps = this.playerHasEquippedEnchantment('ruinTraps');

    let passSummary = this.executePlayerAttackPass(offsets, { hasKnockback, hasRuinTraps });

    const rapidStrikeTriggered = this.playerHasEquippedEnchantment('rapidStrike') && Math.random() < 0.25;
    if (rapidStrikeTriggered) {
        this.ui.addMessage('Rapid strike triggers!');
        const extraPass = this.executePlayerAttackPass(offsets, { hasKnockback, hasRuinTraps });
        passSummary = this.combineAttackPassSummaries(passSummary, extraPass);
    }

    this.announcePlayerAttackPassSummary(passSummary);

    this.clearFailedMoveRecord();
    return this.createPlayerTurnResult({ consumed: true, actionType: 'attack' });
};

Game.prototype.processPlayerBerserkTurn = function() {
    const target = this.getNearestPlayerBerserkTarget();

    if (!target) {
        this.player.tickConditions();
        this.ui.addMessage('You rage, but there is nothing to attack.');
        return this.createPlayerTurnResult({ consumed: true, actionType: 'berserk-wait' });
    }
    const dx = Math.sign(target.x - this.player.x);
    const dy = Math.sign(target.y - this.player.y);

    this.player.tickConditions();
    this.lookTowards(dx, dy);

    if (distance(this.player.x, this.player.y, target.x, target.y) <= 1.5) {
        this.resolvePlayerBerserkMeleeAttack(target);
        return this.createPlayerTurnResult({ consumed: true, actionType: 'berserk-attack' });
    }

    if (this.player.hasCondition(CONDITIONS.BOUND)) {
        this.ui.addMessage('You rage in place, unable to move while bound.');
        return this.createPlayerTurnResult({ consumed: true, actionType: 'berserk-bound' });
    }

    const path = this.findPathForPlayer(target.x, target.y);
    if (!path || path.length <= 1) {
        this.ui.addMessage('You rage, but cannot reach a target.');
        return this.createPlayerTurnResult({ consumed: true, actionType: 'berserk-wait' });
    }

    const next = path[1];
    const moved = this.player.move(next.x - this.player.x, next.y - this.player.y, this.world);
    if (moved) {
        this.applyPlayerTrapAtCurrentPosition();
        this.tryWakeCatacombsHoardEvent?.();
        this.pickupItemsAfterMove(next.x, next.y);
        return this.createPlayerTurnResult({ consumed: true, applyEnvironmentAfterAction: false, actionType: 'berserk-move' });
    }

    this.ui.addMessage('You rage, but your path is blocked.');
    return this.createPlayerTurnResult({ consumed: true, actionType: 'berserk-blocked' });
};

Game.prototype.isPlayerBerserkTarget = function(enemy) {
    if (!enemy || !enemy.isAlive()) {
        return false;
    }

    if (this.isNeutralNpcEnemy(enemy)) {
        return false;
    }

    return !(typeof enemy.hasCondition === 'function' && enemy.hasCondition(CONDITIONS.INVISIBLE));
};

Game.prototype.getNearestPlayerBerserkTarget = function() {
    const candidates = this.world.getEnemies().filter((enemy) => this.isPlayerBerserkTarget(enemy));

    return getNearestByDistance(this.player.x, this.player.y, candidates);
};

Game.prototype.resolvePlayerBerserkMeleeAttack = function(target) {
    if (!target || target.isAlly) {
        this.ui.addMessage('You hesitate and avoid striking your ally.');
        return;
    }

    const targetX = target.x;
    const targetY = target.y;
    const attackResult = this.player.attackEnemy(target);
    const { damage, critical, inflictedConditions } = this.extractAttackResultData(attackResult);
    this.ui.playMeleeStrikeEffect?.(this.player.x, this.player.y, targetX, targetY, { attackerSide: 'player' });
    this.ui.playHitPulseEffect?.(targetX, targetY, { targetSide: 'enemy' });
    const criticalPrefix = critical ? 'Critical! ' : '';
    this.ui.addMessage(`${criticalPrefix}You berserk attack ${target.name} for ${damage}.`);
    this.announceInflictedConditions(target.name, inflictedConditions);
    if (!target.isAlive()) {
        this.handleEnemyDefeat(target, { announceDefeat: true, killer: this.player });
    }
};

Game.prototype.findPathForPlayer = function(targetX, targetY) {
    return findPathAStar(this.player.x, this.player.y, targetX, targetY, (nx, ny, isGoal) => {
        return isGoal || this.world.canPlayerOccupy(nx, ny);
    });
};
