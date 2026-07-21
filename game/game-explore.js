// Auto-explore helpers for automatic cave exploration

Game.prototype.autoExploreActive = false;
Game.prototype.autoExploreTargetItem = null;
Game.prototype.autoExploreTargetTile = null;
Game.prototype.autoExploreTargetFloor = false;
Game.prototype.autoExploreLoopTimer = null;
Game.prototype.autoExploreLastPos = null;
Game.prototype.autoExploreStuckCount = 0;
Game.prototype.autoExploreRecentPositions = [];
Game.prototype.autoExploreForcedDetour = null;
Game.prototype.autoExploreNoProgressCount = 0;

Game.prototype.clearAutoExploreTargets = function() {
    this.autoExploreTargetItem = null;
    this.autoExploreTargetTile = null;
    this.autoExploreTargetFloor = false;
};

Game.prototype.resetAutoExploreState = function(options = {}) {
    const {
        clearTargets = true,
        resetStuckCount = true,
        resetRecentPositions = true,
        resetForcedDetour = true,
        resetNoProgressCount = true
    } = options;

    if (clearTargets) {
        this.clearAutoExploreTargets();
    }
    if (resetStuckCount) {
        this.autoExploreStuckCount = 0;
    }
    if (resetRecentPositions) {
        this.autoExploreRecentPositions = [];
    }
    if (resetForcedDetour) {
        this.autoExploreForcedDetour = null;
    }
    if (resetNoProgressCount) {
        this.autoExploreNoProgressCount = 0;
    }
};

Game.prototype.recordAutoExplorePosition = function(x, y) {
    if (!Array.isArray(this.autoExploreRecentPositions)) {
        this.autoExploreRecentPositions = [];
    }

    this.autoExploreRecentPositions.push({ x, y });
    if (this.autoExploreRecentPositions.length > 4) {
        this.autoExploreRecentPositions.shift();
    }
};

Game.prototype.resetAutoExploreRecentPositions = function() {
    this.autoExploreRecentPositions = [];
    this.recordAutoExplorePosition(this.player.x, this.player.y);
};

Game.prototype.handleAutoExploreNoProgress = function() {
    this.autoExploreNoProgressCount = (this.autoExploreNoProgressCount || 0) + 1;
    this.clearAutoExploreTargets();

    if (!this.autoExploreForcedDetour) {
        this.autoExploreForcedDetour = this.getAutoExploreForcedDetour();
    }

    if (this.autoExploreForcedDetour) {
        this.queueAutoExploreTick(0);
        return true;
    }

    if (this.autoExploreNoProgressCount >= 8) {
        this.ui.addMessage('Auto-explore stopped: no progress possible.');
        this.stopAutoExplore();
        return true;
    }

    this.queueAutoExploreTick();
    return true;
};

Game.prototype.resetAutoExploreProgressWatchdog = function() {
    this.autoExploreNoProgressCount = 0;
};

Game.prototype.ensureAutoExploreForcedDetour = function() {
    if (!this.autoExploreForcedDetour) {
        this.autoExploreForcedDetour = this.getAutoExploreForcedDetour();
    }

    return this.autoExploreForcedDetour;
};

Game.prototype.isAutoExploreOscillating = function() {
    const history = Array.isArray(this.autoExploreRecentPositions) ? this.autoExploreRecentPositions : [];
    if (history.length < 4) {
        return false;
    }

    const a = history[history.length - 4];
    const b = history[history.length - 3];
    const c = history[history.length - 2];
    const d = history[history.length - 1];
    return a.x === c.x
        && a.y === c.y
        && b.x === d.x
        && b.y === d.y
        && (a.x !== b.x || a.y !== b.y);
};

Game.prototype.getAutoExploreForcedDetour = function() {
    const history = Array.isArray(this.autoExploreRecentPositions) ? this.autoExploreRecentPositions : [];
    const blockedTargets = new Set(
        history.slice(-2).map((pos) => toGridKey(pos.x, pos.y))
    );
    const directions = Object.values(DIRECTIONS).slice();

    for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    for (const direction of directions) {
        const nx = this.player.x + direction.x;
        const ny = this.player.y + direction.y;
        if (blockedTargets.has(toGridKey(nx, ny))) {
            continue;
        }

        const tile = this.world.getTile(nx, ny);
        if (tile === TILE_TYPES.STAIRS_UP) {
            continue;
        }

        if (getEnvironmentalDamageForTile(tile, 0) > 0 && !this.player.isImmuneToTileEffect?.(tile)) {
            continue;
        }

        if (this.shouldAutoExploreAvoidTrapAt(nx, ny)) {
            continue;
        }

        if (this.world.canPlayerOccupy(nx, ny)) {
            return { type: 'move', dx: direction.x, dy: direction.y };
        }
    }

    return null;
};

Game.prototype.isAutoExploreBlockedByPopup = function() {
    return Boolean(
        this.inventoryOpen
        || this.ui.settingsOpen
        || this.ui.dungeonSelectionOpen
    );
};

Game.prototype.queueAutoExploreTick = function(delayMs = 60) {
    if (!this.autoExploreActive) {
        return;
    }

    if (this.autoExploreLoopTimer !== null) {
        return;
    }

    this.autoExploreLoopTimer = window.setTimeout(() => {
        this.autoExploreLoopTimer = null;
        this.runAutoExploreTick();
    }, Math.max(0, Number(delayMs) || 0));
};

Game.prototype.resolveAutoExploreStuckState = function(stopMessage) {
    this.clearAutoExploreTargets();
    this.autoExploreStuckCount = (this.autoExploreStuckCount || 0) + 1;

    if (this.ensureAutoExploreForcedDetour()) {
        this.queueAutoExploreTick(0);
        return true;
    }

    if (this.autoExploreStuckCount >= 5) {
        this.ui.addMessage(stopMessage);
        this.stopAutoExplore();
        return true;
    }

    return this.handleAutoExploreNoProgress();
};

Game.prototype.runAutoExploreTick = function() {
    if (!this.autoExploreActive || this.isGameOver) {
        return;
    }

    if (this.isAutoExploreBlockedByPopup()) {
        this.stopAutoExplore();
        return;
    }

    const autoMoveInput = this.performAutoExploreTurn();
    if (!autoMoveInput) {
        return this.resolveAutoExploreStuckState('Auto-explore stopped: no valid path found.');
    }

    if (autoMoveInput.type === 'move' || autoMoveInput.type === 'attack') {
        if (typeof this.player?.setFacingDirection === 'function') {
            this.player.setFacingDirection(autoMoveInput.dx, autoMoveInput.dy);
        } else {
            this.player.facing = { dx: autoMoveInput.dx, dy: autoMoveInput.dy };
        }
    }

    const prevX = this.player.x;
    const prevY = this.player.y;

    this.performTurn(autoMoveInput);

    if (autoMoveInput.type === 'move' && this.player.x === prevX && this.player.y === prevY) {
        return this.resolveAutoExploreStuckState('Auto-explore stopped: path blocked.');
    } else if (autoMoveInput.type === 'move') {
        this.recordAutoExplorePosition(this.player.x, this.player.y);
        this.resetAutoExploreProgressWatchdog();
        if (this.isAutoExploreOscillating()) {
            this.clearAutoExploreTargets();
            this.autoExploreForcedDetour = this.getAutoExploreForcedDetour();
            this.resetAutoExploreRecentPositions();
            this.autoExploreStuckCount = 0;
        } else {
            this.autoExploreStuckCount = 0;
        }
    } else {
        this.autoExploreStuckCount = 0;
        if (this.player.x === prevX && this.player.y === prevY) {
            return this.handleAutoExploreNoProgress();
        }
        this.resetAutoExploreProgressWatchdog();
    }

    if (this.autoExploreActive && !this.isGameOver) {
        this.queueAutoExploreTick();
    }
};

Game.prototype.hasCheaterEquipment = function() {
    if (!this.player?.equipment) {
        return false;
    }

    for (const item of this.player.equipment.values()) {
        if (item?.name && String(item.name).startsWith('Cheater ')) {
            return true;
        }
    }

    return false;
};

Game.prototype.getAutoExploreAttackInputTowardEnemy = function(enemy) {
    const dx = Math.sign(enemy.x - this.player.x);
    const dy = Math.sign(enemy.y - this.player.y);
    const dist = Math.max(Math.abs(enemy.x - this.player.x), Math.abs(enemy.y - this.player.y));

    if (dist <= 1) {
        return { type: 'attack', dx, dy };
    }

    const moveDir = this.getAutoExploreMoveDirection(enemy.x, enemy.y);
    if (moveDir) {
        return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
    }

    return null;
};

Game.prototype.findNearestAutoExploreEnemy = function(enemies) {
    if (!Array.isArray(enemies) || enemies.length === 0) {
        return null;
    }

    return enemies.reduce((bestEnemy, enemy) => {
        const enemyDistance = Math.max(Math.abs(enemy.x - this.player.x), Math.abs(enemy.y - this.player.y));
        const bestDistance = Math.max(Math.abs(bestEnemy.x - this.player.x), Math.abs(bestEnemy.y - this.player.y));
        return enemyDistance < bestDistance ? enemy : bestEnemy;
    });
};

Game.prototype.getAutoExploreMoveInputToward = function(targetX, targetY) {
    const moveDir = this.getAutoExploreMoveDirection(targetX, targetY);
    return moveDir ? { type: 'move', dx: moveDir.dx, dy: moveDir.dy } : null;
};

Game.prototype.getAutoExploreRandomWalkInput = function() {
    const directions = Object.values(DIRECTIONS).slice();
    for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    for (const direction of directions) {
        const nx = this.player.x + direction.x;
        const ny = this.player.y + direction.y;
        if (this.shouldAutoExploreAvoidTrapAt(nx, ny)) {
            continue;
        }

        if (this.world.canPlayerOccupy(nx, ny)) {
            return { type: 'move', dx: direction.x, dy: direction.y };
        }
    }

    return null;
};

Game.prototype.getEnemiesWithinDistance = function(x, y, distance) {
    const enemies = this.world.getHostileActors();

    return enemies.filter((enemy) => {
        if (!enemy.isAlive?.()) {
            return false;
        }

        if (enemy.isAlly) {
            return false;
        }

        // Exclude neutral NPCs
        if (enemy.isNeutralNpc()) {
            return false;
        }

        const dist = Math.max(Math.abs(enemy.x - x), Math.abs(enemy.y - y));
        if (dist > distance) {
            return false;
        }

        return enemy.hasLineOfSight(this.world, x, y);
    });
};

Game.prototype.startAutoExplore = function() {
    // Check if any enemy within 3 tiles (skip check with cheater equipment)
    if (!this.hasCheaterEquipment()) {
        const nearbyEnemies = this.getEnemiesWithinDistance(this.player.x, this.player.y, 3);
        if (nearbyEnemies.length > 0) {
            this.ui.addMessage('Cannot auto-explore: enemy detected nearby.');
            return false;
        }
    }

    this.autoExploreActive = true;
    this.resetAutoExploreState();
    this.resetAutoExploreRecentPositions();
    this.ui.addMessage('Auto-exploring...');
    this.queueAutoExploreTick(0);
    return true;
};

Game.prototype.stopAutoExplore = function() {
    if (this.autoExploreActive) {
        this.autoExploreActive = false;
        this.resetAutoExploreState();
        if (this.autoExploreLoopTimer !== null) {
            window.clearTimeout(this.autoExploreLoopTimer);
            this.autoExploreLoopTimer = null;
        }
        this.ui.addMessage('Auto-explore stopped.');
    }
};

Game.prototype.getUnexploredTiles = function() {
    if (!this.fov) {
        return [];
    }

    const floor = this.world.getCurrentFloor();
    const unexplored = [];

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (floor.grid[y][x] === TILE_TYPES.FLOOR && !this.fov.isExplored(x, y)) {
                unexplored.push({ x, y });
            }
        }
    }

    return unexplored;
};

Game.prototype.shouldAutoExplorePickupItem = function(item, x = null, y = null) {
    if (!item) {
        return false;
    }

    if (typeof this.player?.hasInventorySpaceFor === 'function' && !this.player.hasInventorySpaceFor()) {
        return false;
    }

    const properties = item.properties || {};
    if (
        properties.shopOwned
        || properties.shopUnpaid
        || properties.shopPendingSale
        || Number.isFinite(Number(properties.shopPrice))
        || properties.shopkeeperId !== undefined
    ) {
        return false;
    }

    if (Number.isFinite(x) && Number.isFinite(y) && this.world.getTile(x, y) === TILE_TYPES.SHOP) {
        return false;
    }

    return true;
};

Game.prototype.getPickupTargets = function() {
    const floor = this.world.getCurrentFloor();
    const targets = [];

    for (const [key, items] of floor.items.entries()) {
        if (!Array.isArray(items) || items.length === 0) {
            continue;
        }

        const [x, y] = fromGridKey(key);
        const targetItem = items.find((item) => this.shouldAutoExplorePickupItem(item, x, y));
        if (!targetItem) {
            continue;
        }

        targets.push({ x, y, item: targetItem });
    }

    return targets;
};

Game.prototype.findNearestAutoExploreTarget = function(targets, stickyTarget, stickyTargetKey) {
    if (!Array.isArray(targets) || targets.length === 0) {
        if (stickyTargetKey) {
            this[stickyTargetKey] = null;
        }
        return null;
    }

    if (stickyTarget && Number.isFinite(stickyTarget.x) && Number.isFinite(stickyTarget.y)) {
        const persistedTarget = targets.find((target) => target.x === stickyTarget.x && target.y === stickyTarget.y);
        if (persistedTarget) {
            const path = this.findPathForAutoExplore(persistedTarget.x, persistedTarget.y);
            if (path && path.length >= 2) {
                return persistedTarget;
            }
        }
    }

    let nearestTarget = targets[0];
    let nearestDistance = Math.hypot(
        nearestTarget.x - this.player.x,
        nearestTarget.y - this.player.y
    );

    for (let i = 1; i < targets.length; i++) {
        const target = targets[i];
        const distance = Math.hypot(target.x - this.player.x, target.y - this.player.y);
        if (distance < nearestDistance) {
            nearestTarget = target;
            nearestDistance = distance;
        }
    }

    if (stickyTargetKey) {
        this[stickyTargetKey] = { x: nearestTarget.x, y: nearestTarget.y };
    }

    return nearestTarget;
};

Game.prototype.getVisiblePickupTargets = function() {
    const targets = this.getPickupTargets();
    if (!this.fov || typeof this.fov.isVisible !== 'function') {
        return [];
    }

    return targets.filter((target) => this.fov.isVisible(target.x, target.y));
};

Game.prototype.findNearestUnexploredTile = function() {
    const unexplored = this.getUnexploredTiles();
    return this.findNearestAutoExploreTarget(unexplored, this.autoExploreTargetTile, 'autoExploreTargetTile');
};

Game.prototype.findNearestPickupTarget = function(targetsOverride = null) {
    const targets = Array.isArray(targetsOverride) ? targetsOverride : this.getPickupTargets();
    return this.findNearestAutoExploreTarget(targets, this.autoExploreTargetItem, 'autoExploreTargetItem');
};

Game.prototype.getAutoExploreMoveDirection = function(targetX, targetY) {
    const path = this.findPathForAutoExplore(targetX, targetY);
    if (!path || path.length < 2) {
        return null;
    }

    const nextStep = path[1];
    const dx = Math.sign(nextStep.x - this.player.x);
    const dy = Math.sign(nextStep.y - this.player.y);

    return { dx, dy };
};

Game.prototype.shouldAutoExploreAvoidTrapAt = function(x, y) {
    const trapType = this.world.getTrap(x, y);
    if (!trapType) {
        return false;
    }

    const playerHasTrapSight = typeof this.player?.revealsTraps === 'function'
        && this.player.revealsTraps();
    const trapIsVisible = playerHasTrapSight
        || this.world.isTrapRevealed(x, y);
    return trapIsVisible;
};

Game.prototype.findPathForAutoExplore = function(targetX, targetY) {
    return findPathAStar(this.player.x, this.player.y, targetX, targetY, (nx, ny, isGoal) => {
        const tile = this.world.getTile(nx, ny);

        if (!isGoal && (tile === TILE_TYPES.STAIRS_UP || tile === TILE_TYPES.SHOP)) {
            return false;
        }

        // Avoid tiles that deal damage unless the player is immune
        if (!isGoal && getEnvironmentalDamageForTile(tile, 0) > 0) {
            if (!this.player.isImmuneToTileEffect?.(tile)) {
                return false;
            }
        }

        if (!isGoal && this.shouldAutoExploreAvoidTrapAt(nx, ny)) {
            return false;
        }

        return isGoal || this.world.canPlayerOccupy(nx, ny);
    });
};

Game.prototype.getAutoExploreDownstairsMove = function() {
    const stairs = this.world.getCurrentFloor?.()?.meta?.stairPositions?.down;
    return stairs ? this.getAutoExploreMoveInputToward(stairs.x, stairs.y) : null;
};

Game.prototype.performAutoExploreTurn = function() {
    if (!this.autoExploreActive) {
        return null;
    }

    // Disoriented: return a random walkable move direction
    const isBlind = this.player.hasCondition?.(CONDITIONS.BLIND);
    const isConfused = this.player.hasCondition?.(CONDITIONS.CONFUSED);
    if (isBlind || isConfused) {
        return this.getAutoExploreRandomWalkInput();
    }

    // Check if any enemy within 3 tiles
    const nearbyEnemies = this.getEnemiesWithinDistance(this.player.x, this.player.y, 3);
    if (nearbyEnemies.length > 0) {
        if (this.hasCheaterEquipment()) {
            const nearest = this.findNearestAutoExploreEnemy(nearbyEnemies);
            const attackInput = this.getAutoExploreAttackInputTowardEnemy(nearest);
            if (attackInput) {
                return attackInput;
            }
        } else {
            this.ui.addMessage('Auto-explore stopped: enemy detected nearby.');
            this.stopAutoExplore();
            return null;
        }
    }

    if (this.autoExploreForcedDetour) {
        const detourMove = this.autoExploreForcedDetour;
        this.autoExploreForcedDetour = null;
        return detourMove;
    }

    // Priority 0: Descend immediately if that setting is enabled
    if (this.settings?.autoExploreDescendImmediately) {
        const visiblePickupTarget = this.findNearestPickupTarget(this.getVisiblePickupTargets());
        if (visiblePickupTarget) {
            return this.getAutoExploreMoveInputToward(visiblePickupTarget.x, visiblePickupTarget.y);
        }

        const downstairsMove = this.getAutoExploreDownstairsMove();
        if (downstairsMove) {
            return downstairsMove;
        }
    }

    // Priority 1: Pick up nearby items
    const pickupTarget = this.findNearestPickupTarget();
    if (pickupTarget) {
        const pickupMove = this.getAutoExploreMoveInputToward(pickupTarget.x, pickupTarget.y);
        if (pickupMove) {
            return pickupMove;
        }
    }

    // Priority 2: Move to unexplored tiles
    const unexploredTile = this.findNearestUnexploredTile();
    if (unexploredTile) {
        const unexploredMove = this.getAutoExploreMoveInputToward(unexploredTile.x, unexploredTile.y);
        if (unexploredMove) {
            return unexploredMove;
        }
    }

    // Priority 3: Descend if everything explored and no items left
    const allExplored = this.getUnexploredTiles().length === 0;
    const noItems = this.getPickupTargets().length === 0;

    if (allExplored && noItems) {
        const downstairsMove = this.getAutoExploreDownstairsMove();
        if (downstairsMove) {
            return downstairsMove;
        }
        
        // No stairs found or stuck, stop exploring
        this.ui.addMessage('Auto-explore complete: all areas explored and items collected.');
        this.stopAutoExplore();
    }

    return null;
};
