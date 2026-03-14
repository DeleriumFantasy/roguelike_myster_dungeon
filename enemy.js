// Enemy class
console.log('enemy.js loaded');

class Enemy {
    constructor(x, y, name, aiType, stats = {}) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.monsterType = stats.monsterType || name.toLowerCase();
        this.creatureTypes = this.normalizeCreatureTypes(stats.creatureTypes);
        this.aiType = aiType;
        this.baseAiType = aiType || AI_TYPES.WANDER;
        this.maxHealth = stats.health || 20;
        this.health = this.maxHealth;
        this.power = stats.power || 5;
        this.armor = stats.armor || 0;
        this.exp = stats.exp || 0;
        this.fovRange = stats.fovRange || 10;
        this.tameThreshold = stats.tameThreshold || 4;
        this.speed = this.normalizeSpeed(stats.speed);
        this.actionCharge = typeof stats.actionCharge === 'number' ? Math.max(0, stats.actionCharge) : 0;
        this.conditions = new Map();
        this.aiByStatus = new Map([
            [CONDITIONS.FRIGHTENED, AI_TYPES.FLEE],
            [CONDITIONS.SLEEP, AI_TYPES.GUARD]
        ]);
        this.lastHostilePos = null;
        this.targetX = null;
        this.targetY = null;
        this.isAlly = false;
        this.tamingProgress = 0;
        this.tamedBy = null;
        this.equipment = new Map();
        this.lastResolvedAi = this.baseAiType;
    }

    normalizeCreatureTypes(creatureTypes) {
        if (!Array.isArray(creatureTypes) || creatureTypes.length === 0) {
            if (this.monsterType === 'ghost') {
                return [ENEMY_TYPES.GHOST, ENEMY_TYPES.FLOATING];
            }
            return [];
        }

        return [...new Set(creatureTypes.filter((type) => typeof type === 'string'))];
    }

    normalizeSpeed(speed) {
        if (Object.values(ENEMY_SPEEDS).includes(speed)) {
            return speed;
        }

        return ENEMY_SPEEDS.NORMAL;
    }

    hasEnemyType(enemyType) {
        return this.creatureTypes.includes(enemyType);
    }

    isPariahTarget(enemy) {
        return Boolean(
            enemy
            && enemy !== this
            && typeof enemy.isAlive === 'function'
            && enemy.isAlive()
            && typeof enemy.hasEnemyType === 'function'
            && enemy.hasEnemyType(ENEMY_TYPES.PARIAH)
        );
    }

    canSeeActor(world, actor) {
        if (!actor || typeof actor.isAlive !== 'function' || !actor.isAlive()) {
            return false;
        }

        if (typeof actor.hasCondition === 'function' && actor.hasCondition(CONDITIONS.INVISIBLE)) {
            return false;
        }

        return this.canSeePosition(world, actor.x, actor.y);
    }

    canSeePosition(world, x, y) {
        const distanceToTarget = distance(this.x, this.y, x, y);
        return distanceToTarget <= this.getFovRange() && this.hasLineOfSight(world, x, y);
    }

    getNearestVisiblePariah(world) {
        let nearest = null;
        let nearestDistance = Infinity;

        for (const enemy of world.getEnemies()) {
            if (!this.isPariahTarget(enemy)) {
                continue;
            }

            if (!this.canSeeActor(world, enemy)) {
                continue;
            }

            const enemyDistance = distance(this.x, this.y, enemy.x, enemy.y);
            if (enemyDistance < nearestDistance) {
                nearest = enemy;
                nearestDistance = enemyDistance;
            }
        }

        return nearest;
    }

    getVisibleHostileTarget(world, player) {
        const pariah = this.getNearestVisiblePariah(world);
        if (pariah) {
            return {
                kind: 'enemy',
                target: pariah,
                x: pariah.x,
                y: pariah.y
            };
        }

        if (this.canSeePlayer(world, player)) {
            return {
                kind: 'player',
                target: player,
                x: player.x,
                y: player.y
            };
        }

        return null;
    }

    getNearestBerserkTarget(world, player) {
        let nearest = null;
        let nearestDistance = Infinity;

        const candidates = [];
        if (player && player !== this) {
            candidates.push(player);
        }

        for (const enemy of world.getEnemies()) {
            if (enemy !== this && enemy.isAlive()) {
                candidates.push(enemy);
            }
        }

        for (const target of candidates) {
            if (!this.canSeeActor(world, target)) {
                continue;
            }

            const targetDistance = distance(this.x, this.y, target.x, target.y);
            if (targetDistance < nearestDistance) {
                nearest = target;
                nearestDistance = targetDistance;
            }
        }

        return nearest;
    }

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
    }

    consumeActionTurns(player) {
        this.actionCharge += this.getActionsPerPlayerTurn(player);
        const availableActions = Math.floor(this.actionCharge + Number.EPSILON);
        this.actionCharge = Math.max(0, this.actionCharge - availableActions);
        return availableActions;
    }

    takeTurn(world, player, fov) {
        if (this.conditions.has(CONDITIONS.SLEEP)) {
            this.tickConditions();
            this.applyEnvironmentEffects(world);
            return { type: 'sleep' };
        }

        // Pre-turn status tick
        this.tickConditions();

        if (!this.isAlive()) return;

        // Action
        const actionResult = this.performAction(world, player, fov);

        this.applyEnvironmentEffects(world);

        // Post-turn resolution (placeholder)
        // World advance (placeholder)
        return actionResult;
    }

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
    }

    performAction(world, player, fov) {
        if (this.conditions.has(CONDITIONS.BLIND)) {
            return this.performBlindAction(world, player);
        }

        if (this.conditions.has(CONDITIONS.BERSERK)) {
            this.lastResolvedAi = 'berserk';
            return this.performBerserkAction(world, player);
        }

        const resolvedAi = this.getAiTypeForTurn(world, player, fov);
        this.lastResolvedAi = resolvedAi;

        const methodName = getEnemyAiActionMethod(resolvedAi);
        if (typeof this[methodName] === 'function') {
            return this[methodName](world, player);
        }

        return this.performWanderAction(world, player);
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

        const visibleHostile = this.getVisibleHostileTarget(world, player);
        if (visibleHostile) {
            this.lastHostilePos = { x: visibleHostile.x, y: visibleHostile.y };
            return AI_TYPES.CHASE;
        }

        // If the enemy recently saw a hostile target, finish investigating the
        // last seen position before returning to its standard AI.
        if (this.lastHostilePos) {
            if (this.x === this.lastHostilePos.x && this.y === this.lastHostilePos.y) {
                this.lastHostilePos = null;
                return this.getStandardAiType();
            }
            return AI_TYPES.CHASE;
        }

        return this.getStandardAiType();
    }

    getStandardAiType() {
        // Placeholder for monster-type based AI tables.
        if (this.hasEnemyType(ENEMY_TYPES.GHOST)) {
            return AI_TYPES.AMBUSH;
        }

        return this.baseAiType;
    }

    canLookThroughWalls() {
        return this.hasEnemyType(ENEMY_TYPES.GHOST);
    }

    canTraverseTile(tile) {
        return canEnemyTypeTraverseTile(tile, this.creatureTypes);
    }

    applyEnvironmentEffects(world) {
        const tile = world.getTile(this.x, this.y);
        const hazard = typeof world.getHazard === 'function' ? world.getHazard(this.x, this.y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        if (tileDamage > 0 && !isEnemyTypeImmuneToTileEffect(tile, this.creatureTypes)) {
            this.takeDamage(tileDamage);
        }

        if (hazardDamage > 0) {
            this.takeDamage(hazardDamage);
        }
    }

    isDamagingPosition(world, x, y) {
        const tile = world.getTile(x, y);
        const hazard = typeof world.getHazard === 'function' ? world.getHazard(x, y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        if (hazardDamage > 0) {
            return true;
        }

        return tileDamage > 0 && !isEnemyTypeImmuneToTileEffect(tile, this.creatureTypes);
    }

    isWithinBounds(x, y) {
        return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
    }

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
    }

    canSeePlayer(world, player) {
        return this.canSeeActor(world, player);
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
        const visibleHostile = this.getVisibleHostileTarget(world, player);
        if (visibleHostile) {
            this.lastHostilePos = { x: visibleHostile.x, y: visibleHostile.y };

            const meleeRange = distance(this.x, this.y, visibleHostile.x, visibleHostile.y);
            if (meleeRange <= 1.5) {
                if (visibleHostile.kind === 'player') {
                    if (!this.isAlly) {
                        const damage = this.attackPlayer(player);
                        return { type: 'attack-player', damage };
                    }
                    return { type: 'blocked' };
                }

                const damage = this.attackEnemy(visibleHostile.target);
                return {
                    type: 'attack-enemy',
                    damage,
                    target: visibleHostile.target
                };
            }

            return this.tryMoveTowardTarget(world, visibleHostile.x, visibleHostile.y, player);
        }

        if (this.lastHostilePos) {
            const chaseResult = this.tryMoveTowardTarget(world, this.lastHostilePos.x, this.lastHostilePos.y, player);
            if (chaseResult?.type === 'blocked') {
                // If the last known location is unreachable, drop chase state.
                this.lastHostilePos = null;
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

    performBerserkAction(world, player) {
        const target = this.getNearestBerserkTarget(world, player);
        if (!target) {
            return { type: 'wait' };
        }

        const targetDistance = distance(this.x, this.y, target.x, target.y);
        if (targetDistance <= 1.5) {
            if (target === player) {
                const damage = this.attackPlayer(player);
                return { type: 'attack-player', damage };
            }

            const damage = this.attackEnemy(target);
            return { type: 'attack-enemy', damage, target };
        }

        this.lastHostilePos = { x: target.x, y: target.y };
        return this.tryMoveTowardTarget(world, target.x, target.y, player);
    }

    performBlindAction(world, player) {
        const neighbors = shuffle(getNeighbors(this.x, this.y).slice());

        if (this.conditions.has(CONDITIONS.BOUND)) {
            for (const neighbor of neighbors) {
                if (player && !this.isAlly && neighbor.x === player.x && neighbor.y === player.y) {
                    const damage = this.attackPlayer(player);
                    return { type: 'attack-player', damage };
                }

                const blockingEnemy = world.getEnemyAt(neighbor.x, neighbor.y, this);
                if (blockingEnemy) {
                    const damage = this.attackEnemy(blockingEnemy);
                    return { type: 'attack-enemy', damage, target: blockingEnemy };
                }
            }

            return { type: 'wait' };
        }

        for (const neighbor of neighbors) {
            if (player && !this.isAlly && neighbor.x === player.x && neighbor.y === player.y) {
                const damage = this.attackPlayer(player);
                return { type: 'attack-player', damage };
            }

            const blockingEnemy = world.getEnemyAt(neighbor.x, neighbor.y, this);
            if (blockingEnemy) {
                const damage = this.attackEnemy(blockingEnemy);
                return { type: 'attack-enemy', damage, target: blockingEnemy };
            }

            if (this.canOccupyTile(world, neighbor.x, neighbor.y, player)) {
                this.x = neighbor.x;
                this.y = neighbor.y;
                return { type: 'move' };
            }
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

        if (this.conditions.has(CONDITIONS.BOUND)) {
            return { type: 'wait' };
        }

        let path = this.findPath(world, targetX, targetY, { avoidDamagingTiles: true });
        if (!path) {
            path = this.findPath(world, targetX, targetY, { avoidDamagingTiles: false });
        }
        if (path && path.length > 1) {
            const next = path[1];

            if (player && next.x === player.x && next.y === player.y) {
                if (!this.isAlly) {
                    const damage = this.attackPlayer(player);
                    return { type: 'attack-player', damage };
                }
                return { type: 'blocked' };
            }

            if (!this.canOccupyTile(world, next.x, next.y, player, { avoidDamagingTiles: true })
                && !this.canOccupyTile(world, next.x, next.y, player, { avoidDamagingTiles: false })) {
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
        if (this.conditions.has(CONDITIONS.BOUND)) {
            return { type: 'wait' };
        }

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

    findPath(world, targetX, targetY, options = {}) {
        const { avoidDamagingTiles = false } = options;
        return findPathAStar(this.x, this.y, targetX, targetY, (nx, ny, isGoal) => {
            if (isGoal) return true;
            if (!this.canOccupyTile(world, nx, ny, null, { avoidDamagingTiles })) return false;
            if (world.getEnemyAt(nx, ny, this)) return false;
            return true;
        });
    }

    takeDamage(amount) {
        const activeConditions = Array.from(this.conditions.keys());
        if (activeConditions.some((condition) => conditionPreventsDamage(condition))) {
            return 0;
        }

        const actualDamage = Math.max(1, amount - this.getEffectiveArmor());
        const nextHealth = this.health - actualDamage;
        const fatalProtectionCondition = activeConditions.find((condition) => conditionSurvivesFatalDamage(condition));
        if (nextHealth <= 0 && fatalProtectionCondition) {
            const dealtDamage = Math.max(0, this.health - 1);
            this.health = Math.max(1, this.health - dealtDamage);
            this.conditions.delete(fatalProtectionCondition);
            return dealtDamage;
        }

        this.health = Math.max(0, nextHealth);
        if (this.health <= 0) {
            // Drop items
            // Placeholder
        }
        return Math.min(actualDamage, this.health + actualDamage);
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

    addCondition(condition, duration = getConditionDuration(condition, 1)) {
        this.conditions.set(condition, duration);
    }

    onAttacked() {
        for (const condition of [...this.conditions.keys()]) {
            if (shouldRemoveConditionOnAttacked(condition)) {
                this.conditions.delete(condition);
            }
        }
    }

    getAttackPower() {
        let basePower = this.power;
        for (const item of this.equipment.values()) {
            if (item.properties?.power) {
                basePower += item.properties.power;
            }
        }

        const damageMultiplier = Array.from(this.conditions.keys()).reduce((multiplier, condition) => {
            return multiplier * getConditionDamageMultiplier(condition, 1);
        }, 1);

        if (damageMultiplier !== 1) {
            basePower = Math.max(basePower, Math.round(basePower * damageMultiplier));
        }

        return basePower;
    }

    attackTarget(target) {
        if (!target || typeof target.takeDamage !== 'function') {
            return 0;
        }

        const damage = target.takeDamage(this.getAttackPower());
        if (damage > 0 && typeof target.onAttacked === 'function') {
            target.onAttacked();
        }
        return damage;
    }

    attackPlayer(player) {
        return this.attackTarget(player);
    }

    attackEnemy(targetEnemy) {
        if (!targetEnemy || !targetEnemy.isAlive()) {
            return 0;
        }

        return this.attackTarget(targetEnemy);
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

            if (!this.canLookThroughWalls() && world.getTile(x, y) === TILE_TYPES.WALL) {
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