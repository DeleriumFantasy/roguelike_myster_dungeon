// Enemy turn resolution, defeat handling, and EXP helpers

Game.prototype.resolveEnemyDefeatDrops = function(enemy) {
    const defeatDropItems = this.collectDefeatedEnemyDrops(enemy);

    if (defeatDropItems.heldItems.length > 0) {
        this.dropAndAnnounceEnemyItems(enemy, defeatDropItems.heldItems, 'drops');
    }

    if (defeatDropItems.swallowedItems.length > 0) {
        this.dropAndAnnounceEnemyItems(enemy, defeatDropItems.swallowedItems, 'releases');
    }
};

Game.prototype.getVandalPickupEffectMessage = function(enemyName, pickupEffect) {
    if (!pickupEffect || typeof pickupEffect.effect !== 'string') {
        return null;
    }

    const effectMessageBuilders = {
        'downgrade': (effect) => {
            if (!effect.item) {
                return null;
            }

            const itemLabel = getItemLabel(effect.item);
            return `${enemyName} degrades it into ${itemLabel}.`;
        },
        'transform-food': (effect) => {
            if (!effect.item) {
                return null;
            }

            const itemLabel = getItemLabel(effect.item);
            return `${enemyName} turns it into ${itemLabel}.`;
        },
        'destroy-item': () => `${enemyName} destroys the item.`
    };

    const messageBuilder = effectMessageBuilders[pickupEffect.effect];
    return typeof messageBuilder === 'function' ? messageBuilder(pickupEffect) : null;
};

Game.prototype.announceVandalPickupEvent = function(enemyName, result) {
    const pickedLabel = getItemLabel(result?.item);
    this.ui.addMessage(`${enemyName} picks up ${pickedLabel}.`);

    const effectMessage = this.getVandalPickupEffectMessage(enemyName, result?.itemEffect);
    if (effectMessage) {
        this.ui.addMessage(effectMessage);
    }
};

Game.prototype.announceThiefStealEvent = function(enemyName, result) {
    const stolenAmount = result?.stolenAmount || 0;
    const teleported = Boolean(result?.teleported);
    if (stolenAmount > 0) {
        this.ui.addMessage(`${enemyName} steals ${stolenAmount} money from you!`);
    } else {
        this.ui.addMessage(`${enemyName} tries to steal from you, but you have no money.`);
    }

    if (teleported) {
        this.ui.addMessage(`${enemyName} teleports away in panic.`);
    } else {
        this.ui.addMessage(`${enemyName} panics and tries to flee.`);
    }
};

Game.prototype.announceVandalRangedAttackEvent = function(enemyName, result) {
    const rockLabel = getItemLabel(result?.item, 'Sharp rock');
    this.ui.addMessage(`${enemyName} throws ${rockLabel} at you.`);
    this.ui.addMessage(`${enemyName} hits you for ${result?.damage || 0}.`);

    if (result?.dropOutcome?.burned) {
        this.ui.addMessage(`${rockLabel} burns up before it can land.`);
    } else if (result?.dropOutcome?.placedOnPlayerTile) {
        this.ui.addMessage(`${rockLabel} lands on your tile instead of shattering.`);
    } else {
        this.ui.addMessage(`${rockLabel} shatters on impact.`);
    }
};

Game.prototype.processEnemyAttackPlayerActionResult = function(enemy, result) {
    if (result.type !== 'attack-player') {
        return null;
    }

    this.announceCombatHit(enemy.name, 'you', result.damage);
    return this.createEnemyActionResult({
        handled: true,
        continueTurnFlow: this.player.isAlive(),
        actionType: result.type
    });
};

Game.prototype.processEnemyAttackEnemyActionResult = function(enemy, result) {
    if (result.type !== 'attack-enemy' || !result.target) {
        return null;
    }

    this.announceCombatHit(enemy.name, result.target.name, result.damage);
    if (!result.target.isAlive()) {
        if (enemy.isAlly) {
            this.handleEnemyDefeat(result.target, { announceDefeat: true, grantExp: true, killer: enemy });
        } else {
            this.handleEnemyDefeat(result.target, { announceDefeat: true, grantExp: false });
            const promotionResult = this.tryPromoteEnemyAfterKill(enemy);
            if (promotionResult) {
                this.ui.addMessage(`${enemy.name} grows stronger and becomes ${promotionResult.newName}.`);
                if (promotionResult.healthGain > 0) {
                    this.ui.addMessage(`${enemy.name} gains ${promotionResult.healthGain} HP from evolving.`);
                }
            }
        }
    }

    return this.createEnemyActionResult({
        handled: true,
        continueTurnFlow: this.player.isAlive(),
        actionType: result.type
    });
};

Game.prototype.processEnemyItemActionResult = function(enemy, result) {
    if (!result || !result.type) {
        return null;
    }

    if (result.type === 'vandal-ranged-attack') {
        this.announceVandalRangedAttackEvent(enemy.name, result);
        return this.createEnemyActionResult({ handled: true, continueTurnFlow: this.player.isAlive(), actionType: result.type });
    }

    if (result.type === 'thief-steal') {
        this.announceThiefStealEvent(enemy.name, result);
        return this.createEnemyActionResult({ handled: true, continueTurnFlow: this.player.isAlive(), actionType: result.type });
    }

    if (result.type === 'vandal-pickup-item' && result.item) {
        this.announceVandalPickupEvent(enemy.name, result);
        return this.createEnemyActionResult({ handled: true, continueTurnFlow: this.player.isAlive(), actionType: result.type });
    }

    if (result.type === 'vandal-dispose-item' && result.item) {
        const itemLabel = getItemLabel(result.item);
        const disposalResult = this.placeEnemyItemAtTileOrDropNearby(enemy, result.item, result.targetTile);
        if (disposalResult?.type === 'burned') {
            this.ui.addMessage(`${enemy.name} throws ${itemLabel} into lava and it burns up.`);
        } else if (disposalResult?.type === 'placed') {
            this.ui.addMessage(`${enemy.name} throws ${itemLabel} onto ${result.targetTile.tile}.`);
        } else if (disposalResult?.drop) {
            this.announceActorItemDisposition(enemy.name, 'drops', itemLabel, disposalResult.drop, { includeCoordinates: true });
        }
        return this.createEnemyActionResult({ handled: true, continueTurnFlow: this.player.isAlive(), actionType: result.type });
    }

    return null;
};

Game.prototype.resolveEnemyActionResult = function(enemy, result) {
    if (!result || !result.type) {
        return this.createEnemyActionResult({ continueTurnFlow: this.player.isAlive() });
    }

    const handlers = [
        this.processEnemyAttackPlayerActionResult,
        this.processEnemyItemActionResult,
        this.processEnemyAttackEnemyActionResult
    ];

    for (const handler of handlers) {
        const actionResult = handler.call(this, enemy, result);
        if (actionResult?.handled) {
            return actionResult;
        }
    }

    return this.createEnemyActionResult({
        handled: false,
        continueTurnFlow: this.player.isAlive(),
        actionType: result.type
    });
};


Game.prototype.processEnemyTurn = function(enemy) {
    const result = enemy.takeTurn(this.world, this.player);

    if (!enemy.isAlive()) {
        this.handleEnemyDefeat(enemy, { announceDefeat: true, killer: enemy.lastDamagingAttacker || null });
        return this.createEnemyActionResult({
            continueTurnFlow: this.player.isAlive(),
            actionType: 'self-defeat'
        });
    }

    return this.resolveEnemyActionResult(enemy, result);
};

Game.prototype.processEnemyTurns = function() {
    let processedEnemies = 0;

    for (const enemy of [...this.world.getEnemies()]) {
        const actionsToTake = enemy.consumeActionTurns(this.player);
        for (let actionIndex = 0; actionIndex < actionsToTake; actionIndex++) {
            const turnResult = this.processEnemyTurn(enemy);
            processedEnemies++;
            if (!enemy.isAlive()) {
                break;
            }

            if (!turnResult.continueTurnFlow) {
                return this.createEnemyTurnBatchResult({
                    playerAlive: false,
                    processedEnemies,
                    stoppedEarly: true
                });
            }
        }
    }

    return this.createEnemyTurnBatchResult({
        playerAlive: this.player.isAlive(),
        processedEnemies,
        stoppedEarly: false
    });
};

Game.prototype.removeEnemyFromCurrentFloor = function(enemy) {
    if (!enemy) {
        return;
    }

    const floorEnemies = this.world.getEnemies();
    if (floorEnemies.includes(enemy)) {
        this.world.removeEnemy(enemy);
    }
};

Game.prototype.shouldAwardEnemyDefeatExp = function(enemy, grantExp) {
    const defeatedExp = Math.max(0, Math.floor(Number(enemy?.exp) || 0));
    const shouldAwardExp = grantExp && defeatedExp > 0 && !enemy?.isAlly && !this.isNeutralNpcEnemy(enemy);

    return {
        defeatedExp,
        shouldAwardExp
    };
};

Game.prototype.announcePlayerExpGain = function(expGain) {
    const playerLevelUps = this.player.addExp(expGain);
    this.ui.addMessage(`Gained ${expGain} EXP.`);
    if (playerLevelUps > 0) {
        this.ui.addMessage(`Leveled up to ${this.player.level}!`);
    }
};

Game.prototype.announceAllyExpGain = function(ally, expGain) {
    if (!ally || typeof ally.addAllyExp !== 'function') {
        return;
    }

    const allyLevelUps = ally.addAllyExp(expGain);
    this.ui.addMessage(`${ally.name} gains ${expGain} EXP.`);
    if (allyLevelUps > 0) {
        this.ui.addMessage(`${ally.name} leveled up to Lv ${ally.allyLevel}!`);
    }
};

Game.prototype.awardPlayerKillExp = function(killer, defeatedExp) {
    const killerIsPlayer = killer === this.player;
    const playerExpGain = killerIsPlayer
        ? Math.max(0, Math.ceil(defeatedExp * 0.75))
        : defeatedExp;
    const allyExpShare = killerIsPlayer
        ? Math.max(0, defeatedExp - playerExpGain)
        : 0;

    this.announcePlayerExpGain(playerExpGain);

    if (allyExpShare <= 0) {
        return;
    }

    const allies = Array.isArray(this.player?.allies) ? this.player.allies : [];
    for (const ally of allies) {
        if (!ally || !ally.isAlive?.() || typeof ally.addAllyExp !== 'function') {
            continue;
        }

        this.announceAllyExpGain(ally, allyExpShare);
    }
};

Game.prototype.awardAllyKillExp = function(killer, defeatedExp) {
    const killerShare = Math.max(0, Math.ceil(defeatedExp * 0.75));
    const playerShare = Math.max(0, defeatedExp - killerShare);

    this.announceAllyExpGain(killer, killerShare);
    if (playerShare > 0) {
        this.announcePlayerExpGain(playerShare);
    }
};

Game.prototype.awardEnemyDefeatExp = function(enemy, grantExp, killer) {
    const expOutcome = this.shouldAwardEnemyDefeatExp(enemy, grantExp);
    if (!expOutcome.shouldAwardExp) {
        return;
    }

    const killerIsPlayer = killer === this.player;
    const killerIsAlly = Boolean(killer?.isAlly);
    if (killerIsPlayer || !killerIsAlly) {
        this.awardPlayerKillExp(killer, expOutcome.defeatedExp);
        return;
    }

    this.awardAllyKillExp(killer, expOutcome.defeatedExp);
};

Game.prototype.handleEnemyDefeat = function(enemy, options = {}) {
    if (!enemy) {
        return;
    }

    const { announceDefeat = false, grantExp = true, killer = null } = options;
    this.removeEnemyFromCurrentFloor(enemy);
    this.resolveEnemyDefeatDrops(enemy);
    this.awardEnemyDefeatExp(enemy, grantExp, killer);

    if (announceDefeat) {
        this.ui.addMessage(`${enemy.name} is defeated.`);
    }
};
