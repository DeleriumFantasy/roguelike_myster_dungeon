// Structured turn flow result helpers

Object.assign(Game.prototype, {
    createPlayerTurnResult(options = {}) {
        return {
            consumed: Boolean(options.consumed),
            applyEnvironmentAfterAction: options.applyEnvironmentAfterAction !== false,
            skipEnemyPhase: Boolean(options.skipEnemyPhase),
            actionType: options.actionType || null
        };
    },

    createPlayerMoveResult(options = {}) {
        return {
            consumed: Boolean(options.consumed),
            moved: Boolean(options.moved),
            swappedWithAlly: Boolean(options.swappedWithAlly),
            actionType: options.actionType || 'move'
        };
    },

    createEnemyActionResult(options = {}) {
        return {
            handled: Boolean(options.handled),
            continueTurnFlow: options.continueTurnFlow !== false,
            actionType: options.actionType || null
        };
    },

    createEnemyTurnBatchResult(options = {}) {
        return {
            playerAlive: options.playerAlive !== false,
            processedEnemies: Number(options.processedEnemies || 0),
            stoppedEarly: Boolean(options.stoppedEarly)
        };
    }
});