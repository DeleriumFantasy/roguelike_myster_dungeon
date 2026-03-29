// Enemy class

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
        this.allyExp = Math.max(0, Math.floor(Number(stats.allyExp) || 0));
        this.allyLevel = Math.max(1, Math.floor(Number(stats.allyLevel) || 1));
        this.allyExpToNextLevel = this.getAllyExpToNextLevel();
        this.fovRange = stats.fovRange || 10;
        this.tameThreshold = stats.tameThreshold || 4;
        this.speed = this.normalizeSpeed(stats.speed);
        this.actionCharge = typeof stats.actionCharge === 'number' ? Math.max(0, stats.actionCharge) : 0;
        this.conditions = new Map();
        this.sleepLockedUntilPlayerEntry = false;
        this.aiByStatus = new Map([
            [CONDITIONS.FRIGHTENED, AI_TYPES.FLEE],
            [CONDITIONS.SLEEP, AI_TYPES.GUARD]
        ]);
        this.lastHostilePos = null;
        this.targetX = null;
        this.targetY = null;
        this.unreachableItemTargets = new Map();
        this.isAlly = false;
        this.tamedBy = null;
        this.questEscortId = null;
        this.questEscortTargetFloor = null;
        this.questEscortPassive = false;
        this.equipment = new Map();
        this.swallowedItems = new Map();
        this.fuserFusionLocked = false;
        this.heldItem = null;
        this.shopOfferItem = null;
        this.shopOfferPrice = null;
        this.shopSoldOut = false;
        this.lastResolvedAi = this.baseAiType;
        this.turnCache = null;
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

    isNeutralNpc() {
        return this.hasEnemyType(ENEMY_TYPES.NPC);
    }

    isVandal() {
        return this.hasEnemyType(ENEMY_TYPES.VANDAL);
    }

    isThief() {
        return this.hasEnemyType(ENEMY_TYPES.THIEF);
    }

    isCrafter() {
        return this.hasEnemyType(ENEMY_TYPES.CRAFTER);
    }

}