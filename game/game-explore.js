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

        if (this.world.canPlayerOccupy(nx, ny)) {
            return { type: 'move', dx: direction.x, dy: direction.y };
        }
    }

    return null;
};

Game.prototype.isAutoExploreBlockedByPopup = function() {
    return Boolean(
        this.inventoryOpen
        || this.ui?.settingsOpen
        || this.ui?.dungeonSelectionOpen
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
        this.clearAutoExploreTargets();
        this.autoExploreStuckCount = (this.autoExploreStuckCount || 0) + 1;

        if (!this.autoExploreForcedDetour) {
            this.autoExploreForcedDetour = this.getAutoExploreForcedDetour();
        }

        if (this.autoExploreForcedDetour) {
            this.queueAutoExploreTick(0);
            return;
        }

        if (this.autoExploreStuckCount >= 5) {
            this.ui.addMessage('Auto-explore stopped: no valid path found.');
            this.stopAutoExplore();
            return;
        }

        return this.handleAutoExploreNoProgress();
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
        // Player didn't move — invalidate sticky targets and count the failure
        this.clearAutoExploreTargets();
        this.autoExploreStuckCount = (this.autoExploreStuckCount || 0) + 1;

        if (!this.autoExploreForcedDetour) {
            this.autoExploreForcedDetour = this.getAutoExploreForcedDetour();
        }

        if (this.autoExploreForcedDetour) {
            this.queueAutoExploreTick(0);
            return;
        }

        if (this.autoExploreStuckCount >= 5) {
            this.ui.addMessage('Auto-explore stopped: path blocked.');
            this.stopAutoExplore();
            return;
        }
        return this.handleAutoExploreNoProgress();
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

Game.prototype.getEnemiesWithinDistance = function(x, y, distance) {
    const enemies = typeof this.world.getHostileEnemies === 'function'
        ? this.world.getHostileEnemies()
        : this.world.getEnemies();

    return enemies.filter((enemy) => {
        if (!enemy.isAlive?.()) {
            return false;
        }

        if (enemy.isAlly) {
            return false;
        }

        // Exclude neutral NPCs
        if (typeof enemy.isNeutralNpc === 'function' && enemy.isNeutralNpc()) {
            return false;
        }

        const dist = Math.max(Math.abs(enemy.x - x), Math.abs(enemy.y - y));
        if (dist > distance) {
            return false;
        }

        if (typeof enemy.hasLineOfSight === 'function') {
            return enemy.hasLineOfSight(this.world, x, y);
        }

        return true;
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
    this.clearAutoExploreTargets();
    this.autoExploreStuckCount = 0;
    this.autoExploreForcedDetour = null;
    this.autoExploreNoProgressCount = 0;
    this.resetAutoExploreRecentPositions();
    this.ui.addMessage('Auto-exploring...');
    this.queueAutoExploreTick(0);
    return true;
};

Game.prototype.stopAutoExplore = function() {
    if (this.autoExploreActive) {
        this.autoExploreActive = false;
        this.clearAutoExploreTargets();
        this.autoExploreStuckCount = 0;
        this.autoExploreRecentPositions = [];
        this.autoExploreForcedDetour = null;
        this.autoExploreNoProgressCount = 0;
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

Game.prototype.getVisiblePickupTargets = function() {
    const targets = this.getPickupTargets();
    if (!this.fov || typeof this.fov.isVisible !== 'function') {
        return [];
    }

    return targets.filter((target) => this.fov.isVisible(target.x, target.y));
};

Game.prototype.findNearestUnexploredTile = function() {
    const unexplored = this.getUnexploredTiles();
    if (unexplored.length === 0) {
        return null;
    }

    // Reuse sticky target if it's still unexplored and reachable
    if (this.autoExploreTargetTile) {
        const still = unexplored.find(
            (t) => t.x === this.autoExploreTargetTile.x && t.y === this.autoExploreTargetTile.y
        );
        if (still) {
            const path = this.findPathForAutoExplore(still.x, still.y);
            if (path && path.length >= 2) {
                return still;
            }
        }
        this.autoExploreTargetTile = null;
    }

    let nearest = unexplored[0];
    let nearestDist = Math.hypot(
        nearest.x - this.player.x,
        nearest.y - this.player.y
    );

    for (let i = 1; i < unexplored.length; i++) {
        const tile = unexplored[i];
        const dist = Math.hypot(tile.x - this.player.x, tile.y - this.player.y);
        if (dist < nearestDist) {
            nearest = tile;
            nearestDist = dist;
        }
    }

    this.autoExploreTargetTile = { x: nearest.x, y: nearest.y };
    return nearest;
};

Game.prototype.findNearestPickupTarget = function(targetsOverride = null) {
    const targets = Array.isArray(targetsOverride) ? targetsOverride : this.getPickupTargets();
    if (targets.length === 0) {
        return null;
    }

    // Reuse sticky target if it's still on the floor and reachable
    if (this.autoExploreTargetItem) {
        const still = targets.find(
            (t) => t.x === this.autoExploreTargetItem.x && t.y === this.autoExploreTargetItem.y
        );
        if (still) {
            const path = this.findPathForAutoExplore(still.x, still.y);
            if (path && path.length >= 2) {
                return still;
            }
        }
        this.autoExploreTargetItem = null;
    }

    let nearest = targets[0];
    let nearestDist = Math.hypot(
        nearest.x - this.player.x,
        nearest.y - this.player.y
    );

    for (let i = 1; i < targets.length; i++) {
        const target = targets[i];
        const dist = Math.hypot(target.x - this.player.x, target.y - this.player.y);
        if (dist < nearestDist) {
            nearest = target;
            nearestDist = dist;
        }
    }

    this.autoExploreTargetItem = { x: nearest.x, y: nearest.y };
    return nearest;
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

        return isGoal || this.world.canPlayerOccupy(nx, ny);
    });
};

Game.prototype.performAutoExploreTurn = function() {
    if (!this.autoExploreActive) {
        return null;
    }

    // Disoriented: return a random walkable move direction
    const isBlind = this.player.hasCondition?.(CONDITIONS.BLIND);
    const isConfused = this.player.hasCondition?.(CONDITIONS.CONFUSED);
    if (isBlind || isConfused) {
        const dirs = Object.values(DIRECTIONS);
        // Shuffle
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }
        for (const dir of dirs) {
            const nx = this.player.x + dir.x;
            const ny = this.player.y + dir.y;
            if (this.world.canPlayerOccupy(nx, ny)) {
                return { type: 'move', dx: dir.x, dy: dir.y };
            }
        }
        return null;
    }

    // Check if any enemy within 3 tiles
    const nearbyEnemies = this.getEnemiesWithinDistance(this.player.x, this.player.y, 3);
    if (nearbyEnemies.length > 0) {
        if (this.hasCheaterEquipment()) {
            const nearest = nearbyEnemies.reduce((best, enemy) => {
                const d = Math.max(Math.abs(enemy.x - this.player.x), Math.abs(enemy.y - this.player.y));
                const bd = Math.max(Math.abs(best.x - this.player.x), Math.abs(best.y - this.player.y));
                return d < bd ? enemy : best;
            });
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
            const moveDir = this.getAutoExploreMoveDirection(visiblePickupTarget.x, visiblePickupTarget.y);
            if (moveDir) {
                return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
            }
        }

        const floor = this.world.getCurrentFloor();
        const stairs = floor?.meta?.stairPositions?.down;
        if (stairs) {
            const moveDir = this.getAutoExploreMoveDirection(stairs.x, stairs.y);
            if (moveDir) {
                return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
            }
        }
    }

    // Priority 1: Pick up nearby items
    const pickupTarget = this.findNearestPickupTarget();
    if (pickupTarget) {
        const distToItem = Math.max(Math.abs(pickupTarget.x - this.player.x), Math.abs(pickupTarget.y - this.player.y));
        if (distToItem <= 1) {
            // Adjacent to item, move to it
            const moveDir = this.getAutoExploreMoveDirection(pickupTarget.x, pickupTarget.y);
            if (moveDir) {
                return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
            }
        } else {
            // Move toward nearest item
            const moveDir = this.getAutoExploreMoveDirection(pickupTarget.x, pickupTarget.y);
            if (moveDir) {
                return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
            }
        }
    }

    // Priority 2: Move to unexplored tiles
    const unexploredTile = this.findNearestUnexploredTile();
    if (unexploredTile) {
        const moveDir = this.getAutoExploreMoveDirection(unexploredTile.x, unexploredTile.y);
        if (moveDir) {
            return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
        }
    }

    // Priority 3: Descend if everything explored and no items left
    const allExplored = this.getUnexploredTiles().length === 0;
    const noItems = this.getPickupTargets().length === 0;

    if (allExplored && noItems) {
        // Find stairs and move toward them
        const floor = this.world.getCurrentFloor();
        const stairs = floor?.meta?.stairPositions?.down;
        
        if (stairs) {
            const distToStairs = Math.max(Math.abs(stairs.x - this.player.x), Math.abs(stairs.y - this.player.y));
            if (distToStairs <= 1) {
                // Move onto stairs to descend
                const moveDir = this.getAutoExploreMoveDirection(stairs.x, stairs.y);
                if (moveDir) {
                    return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
                }
            } else {
                // Move toward stairs
                const moveDir = this.getAutoExploreMoveDirection(stairs.x, stairs.y);
                if (moveDir) {
                    return { type: 'move', dx: moveDir.dx, dy: moveDir.dy };
                }
            }
        }
        
        // No stairs found or stuck, stop exploring
        this.ui.addMessage('Auto-explore complete: all areas explored and items collected.');
        this.stopAutoExplore();
    }

    return null;
};
