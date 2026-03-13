// Enemy class
console.log('enemy.js loaded');

class Enemy {
    constructor(x, y, name, aiType, stats = {}) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.monsterType = stats.monsterType || name.toLowerCase();
        this.aiType = aiType;
        this.baseAiType = aiType || AI_TYPES.WANDER;
        this.maxHealth = stats.health || 20;
        this.health = this.maxHealth;
        this.power = stats.power || 5;
        this.armor = stats.armor || 0;
        this.exp = stats.exp || 0;
        this.fovRange = stats.fovRange || 10;
        this.tameThreshold = stats.tameThreshold || 4;
        this.conditions = new Map();
        this.aiByStatus = new Map([
            [CONDITIONS.FRIGHTENED, AI_TYPES.FLEE],
            [CONDITIONS.SLEEP, AI_TYPES.GUARD]
        ]);
        this.lastPlayerPos = null;
        this.targetX = null;
        this.targetY = null;
        this.isAlly = false;
        this.tamingProgress = 0;
        this.tamedBy = null;
        this.equipment = new Map();
        this.lastResolvedAi = this.baseAiType;
    }

    takeTurn(world, player, fov) {
        // Pre-turn status tick
        this.tickConditions();

        if (!this.isAlive()) return;

        // Action
        const actionResult = this.performAction(world, player, fov);

        // Post-turn resolution (placeholder)
        // World advance (placeholder)
        return actionResult;
    }

    tickConditions() {
        for (const [condition, duration] of this.conditions) {
            switch (condition) {
                case CONDITIONS.POISONED:
                    this.takeDamage(2);
                    break;
                case CONDITIONS.SLEEP:
                    if (duration < 6) {
                        this.conditions.set(condition, duration + 1);
                        return; // Skip turn
                    } else {
                        this.conditions.delete(condition);
                    }
                    break;
            }
            if (condition !== CONDITIONS.SLEEP && duration > 1) {
                this.conditions.set(condition, duration - 1);
            } else if (condition !== CONDITIONS.SLEEP) {
                this.conditions.delete(condition);
            }
        }
    }

    performAction(world, player, fov) {
        const resolvedAi = this.getAiTypeForTurn(world, player, fov);
        this.lastResolvedAi = resolvedAi;

        switch (resolvedAi) {
            case AI_TYPES.CHASE:
                return this.performChaseAction(world, player);
            case AI_TYPES.FLEE:
                return this.flee(world, player);
            case AI_TYPES.PATROL:
                return this.performPatrolAction(world, player);
            case AI_TYPES.AMBUSH:
                return this.performAmbushAction(world, player);
            case AI_TYPES.SUPPORT:
                return this.performSupportAction(world, player);
            case AI_TYPES.GUARD:
                return this.performGuardAction(world, player);
            case AI_TYPES.WANDER:
            default:
                return this.performWanderAction(world, player);
        }
    }

    getAiTypeForTurn(world, player, fov) {
        if (this.isAlly) {
            return AI_TYPES.SUPPORT;
        }

        for (const [condition, overrideAi] of this.aiByStatus) {
            if (this.conditions.has(condition)) {
                return overrideAi;
            }
        }

        if (this.canSeePlayer(world, player)) {
            this.lastPlayerPos = { x: player.x, y: player.y };
            return AI_TYPES.CHASE;
        }

        // If the enemy recently saw the player, finish investigating the
        // last seen position before returning to its standard AI.
        if (this.lastPlayerPos) {
            if (this.x === this.lastPlayerPos.x && this.y === this.lastPlayerPos.y) {
                this.lastPlayerPos = null;
                return this.getStandardAiType();
            }
            return AI_TYPES.CHASE;
        }

        return this.getStandardAiType();
    }

    getStandardAiType() {
        // Placeholder for monster-type based AI tables.
        if (this.monsterType === 'ghost') {
            return AI_TYPES.AMBUSH;
        }

        return this.baseAiType;
    }

    canPassThroughWalls() {
        return this.monsterType === 'ghost';
    }

    isWithinBounds(x, y) {
        return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
    }

    canOccupyTile(world, x, y, player = null) {
        if (!this.isWithinBounds(x, y)) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        if (world.getEnemyAt(x, y, this)) {
            return false;
        }

        if (this.canPassThroughWalls()) {
            return true;
        }

        return world.getTile(x, y) !== TILE_TYPES.WALL;
    }

    canSeePlayer(world, player) {
        const distanceToPlayer = distance(this.x, this.y, player.x, player.y);
        return distanceToPlayer <= this.getFovRange() && this.hasLineOfSight(world, player.x, player.y);
    }

    performWanderAction(world, player) {
        if (this.targetX === null || (this.x === this.targetX && this.y === this.targetY)) {
            const target = this.getRandomWalkableTarget(world);
            this.targetX = target.x;
            this.targetY = target.y;
        }

        return this.tryMoveTowardTarget(world, this.targetX, this.targetY, player);
    }

    performChaseAction(world, player) {
        const meleeRange = distance(this.x, this.y, player.x, player.y);
        if (meleeRange <= 1.5 && !this.isAlly) {
            const damage = this.attackPlayer(player);
            return { type: 'attack-player', damage };
        }

        if (this.canSeePlayer(world, player)) {
            this.lastPlayerPos = { x: player.x, y: player.y };
            this.targetX = player.x;
            this.targetY = player.y;
            return this.tryMoveTowardTarget(world, player.x, player.y, player);
        }

        if (this.lastPlayerPos) {
            const chaseResult = this.tryMoveTowardTarget(world, this.lastPlayerPos.x, this.lastPlayerPos.y, player);
            if (chaseResult?.type === 'blocked') {
                // If the last known location is unreachable, drop chase state.
                this.lastPlayerPos = null;
            }
            return chaseResult;
        }

        return { type: 'wait' };
    }

    performPatrolAction(world, player) {
        // Placeholder: future patrol logic will follow waypoints.
        return this.performWanderAction(world, player);
    }

    performAmbushAction(world, player) {
        const distanceToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distanceToPlayer <= Math.max(1, this.getFovRange() - 2) && this.hasLineOfSight(world, player.x, player.y)) {
            return this.performChaseAction(world, player);
        }

        return { type: 'wait' };
    }

    performSupportAction(world, player) {
        const distToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distToPlayer > 2) {
            return this.tryMoveTowardTarget(world, player.x, player.y, player);
        }

        return { type: 'wait' };
    }

    performGuardAction(world, player) {
        // Placeholder: guard AI will react to nearby threats once combat exists.
        const distanceToPlayer = distance(this.x, this.y, player.x, player.y);
        if (distanceToPlayer <= 1.5 && this.hasLineOfSight(world, player.x, player.y)) {
            return this.performChaseAction(world, player);
        }

        return { type: 'wait' };
    }

    getRandomWalkableTarget(world) {
        return {
            x: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1,
            y: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1
        };
    }

    tryMoveTowardTarget(world, targetX, targetY, player = null) {
        if (targetX === null || targetY === null) {
            return false;
        }

        const path = this.findPath(world, targetX, targetY);
        if (path && path.length > 1) {
            const next = path[1];

            if (player && next.x === player.x && next.y === player.y) {
                if (!this.isAlly) {
                    const damage = this.attackPlayer(player);
                    return { type: 'attack-player', damage };
                }
                return { type: 'blocked' };
            }

            if (!this.canOccupyTile(world, next.x, next.y, player)) {
                return { type: 'blocked' };
            }

            this.x = next.x;
            this.y = next.y;
            return { type: 'move' };
        }

        this.targetX = null;
        this.targetY = null;
        return { type: 'blocked' };
    }

    canBeTamed() {
        return this.isAlive() && !this.isAlly;
    }

    attemptTame(tamer, amount = 1) {
        if (!this.canBeTamed()) {
            return false;
        }

        this.tamingProgress += Math.max(1, amount);
        if (this.tamingProgress >= this.getTameThreshold()) {
            this.tame(tamer);
        }

        return true;
    }

    getTameThreshold() {
        return this.tameThreshold;
    }

    tame(tamer) {
        this.isAlly = true;
        this.tamedBy = tamer || null;
        this.aiType = AI_TYPES.SUPPORT;
        this.conditions.delete(CONDITIONS.FRIGHTENED);
        if (tamer && typeof tamer.addAlly === 'function') {
            tamer.addAlly(this);
        }
    }

    untame() {
        if (this.tamedBy && typeof this.tamedBy.removeAlly === 'function') {
            this.tamedBy.removeAlly(this);
        }
        this.isAlly = false;
        this.tamedBy = null;
        this.tamingProgress = 0;
    }

    equipItem(item) {
        if (!this.isAlly || !item) {
            return false;
        }

        const validSlots = Object.values(EQUIPMENT_SLOTS);
        if (!validSlots.includes(item.type)) {
            return false;
        }

        const currentItem = this.equipment.get(item.type);
        if (currentItem && this.itemIsCursed(currentItem)) {
            return false;
        }

        this.equipment.set(item.type, item);
        return true;
    }

    unequipSlot(slot) {
        const item = this.equipment.get(slot);
        if (!item) {
            return true;
        }

        if (this.itemIsCursed(item)) {
            return false;
        }

        this.equipment.delete(slot);
        return true;
    }

    itemIsCursed(item) {
        if (!item) return false;
        if (typeof item.isCursed === 'function') {
            return item.isCursed();
        }
        return Boolean(item.properties?.cursed);
    }

    flee(world, player) {
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            const dirX = Math.round(dx / dist);
            const dirY = Math.round(dy / dist);
            const newX = this.x + dirX;
            const newY = this.y + dirY;
            if (this.canOccupyTile(world, newX, newY, player)) {
                this.x = newX;
                this.y = newY;
                return { type: 'move' };
            }
        }

        return { type: 'blocked' };
    }

    findPath(world, targetX, targetY) {
        // Simple A* pathfinding
        const start = { x: this.x, y: this.y };
        const goal = { x: targetX, y: targetY };

        const openSet = [start];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        gScore.set(`${start.x},${start.y}`, 0);
        fScore.set(`${start.x},${start.y}`, distance(start.x, start.y, goal.x, goal.y));

        while (openSet.length > 0) {
            openSet.sort((a, b) => fScore.get(`${a.x},${a.y}`) - fScore.get(`${b.x},${b.y}`));
            const current = openSet.shift();

            if (current.x === goal.x && current.y === goal.y) {
                return this.reconstructPath(cameFrom, current);
            }

            for (const neighbor of getNeighbors(current.x, current.y)) {
                if (!this.canOccupyTile(world, neighbor.x, neighbor.y, null) && (neighbor.x !== goal.x || neighbor.y !== goal.y)) {
                    continue;
                }

                if (world.getEnemyAt(neighbor.x, neighbor.y, this) && (neighbor.x !== goal.x || neighbor.y !== goal.y)) {
                    continue;
                }

                const tentativeGScore = gScore.get(`${current.x},${current.y}`) + 1;
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    fScore.set(neighborKey, tentativeGScore + distance(neighbor.x, neighbor.y, goal.x, goal.y));

                    if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return null;
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        while (cameFrom.has(`${current.x},${current.y}`)) {
            current = cameFrom.get(`${current.x},${current.y}`);
            path.unshift(current);
        }
        return path;
    }

    takeDamage(amount) {
        const actualDamage = Math.max(1, amount - this.getEffectiveArmor());
        this.health = Math.max(0, this.health - actualDamage);
        if (this.health <= 0) {
            // Drop items
            // Placeholder
        }
    }

    heal(amount) {
        const value = Math.max(0, amount);
        this.health = Math.min(this.maxHealth, this.health + value);
    }

    getEffectiveArmor() {
        let armor = this.armor;
        for (const item of this.equipment.values()) {
            armor += item.properties?.armor || 0;
        }
        return armor;
    }

    addCondition(condition, duration = 1) {
        this.conditions.set(condition, duration);
    }

    attackPlayer(player) {
        let basePower = this.power;
        for (const item of this.equipment.values()) {
            if (item.properties?.power) {
                basePower += item.properties.power;
            }
        }
        player.takeDamage(basePower);
        return basePower;
    }

    isAlive() {
        return this.health > 0;
    }

    hasLineOfSight(world, targetX, targetY) {
        // Simple line-of-sight check using Bresenham's line algorithm
        const x0 = this.x, y0 = this.y;
        const x1 = targetX, y1 = targetY;
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0, y = y0;

        while (true) {
            if (!this.isWithinBounds(x, y)) {
                return false;
            }

            if (!this.canPassThroughWalls() && world.getTile(x, y) === TILE_TYPES.WALL) {
                return false;
            }

            if (x === x1 && y === y1) {
                return true;
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

    getFovRange() {
        return this.fovRange;
    }
}