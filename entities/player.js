// Player class

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.facing = { dx: 0, dy: -1 };
        this.lastMoveDirection = { dx: 0, dy: -1 };
        this.maxHealth = 20;
        this.health = 20;
        this.maxHunger = 100;
        this.hunger = 100;
        this.turns = 0;
        this.power = 1;
        this.armor = 0;
        this.conditions = new Map();
        this.equipmentGrantedConditions = new Set();
        this.equipment = new Map();
        this.inventory = [];
        this.maxInventoryItems = 30;
        this.allies = [];
        // EXP / level
        this.exp = 0;
        this.level = 1;
        this.expToNextLevel = this.getExpToNextLevel();
        this.money = 0;
        this.bankMoney = 0;
        this.bankItems = [];
        this.questgiverState = {
            activeQuest: null,
            completedQuestCount: 0,
            nextQuestId: 1,
            deepestDungeonFloorReached: 0,
            deepestDungeonFloorReachedByPath: {}
        };
        this.updateStats();
    }

    move(dx, dy, world, options = {}) {
        const { applyHazards = true } = options;
        const newX = this.x + dx;
        const newY = this.y + dy;

        if (world.canPlayerOccupy(newX, newY)) {
            this.lastMoveDirection = normalizeDirection(dx, dy, this.lastMoveDirection);
            this.x = newX;
            this.y = newY;
            if (applyHazards) {
                this.checkHazards(world);
            }
            return true;
        }
        return false;
    }

    setFacingDirection(dx, dy) {
        const normalizedFacing = normalizeDirection(dx, dy, this.getFacingDirection());
        if (normalizedFacing.dx === this.facing.dx && normalizedFacing.dy === this.facing.dy) {
            return;
        }

        this.facing = normalizedFacing;
    }

    getFacingDirection() {
        return normalizeDirection(this.facing?.dx, this.facing?.dy, { dx: 0, dy: -1 });
    }

    checkHazards(world) {
        const tile = world.getTile(this.x, this.y);
        if ((tile === TILE_TYPES.PIT || tile === TILE_TYPES.WATER) && !this.isImmuneToTileEffect(tile)) {
            const armorEffectiveness = tile === TILE_TYPES.WATER ? 0 : 1;
            this.takeDamage(getEnvironmentalDamageForTile(tile, 5), null, { armorEffectiveness });
        }

        const hazardTransition = world.resolvePlayerHazardTransition(this, tile);
        this.applyEnvironmentEffects(world);
        return hazardTransition;
    }

    applyEnvironmentEffects(world) {
        const tile = world.getTile(this.x, this.y);
        const hazard = typeof world.getHazard === 'function' ? world.getHazard(this.x, this.y) : null;
        const tileDamage = getEnvironmentalDamageForTile(tile, 0);
        const hazardDamage = getEnvironmentalDamageForHazard(hazard, 0);

        if (tileDamage > 0 && tile !== TILE_TYPES.PIT && tile !== TILE_TYPES.WATER && !this.isImmuneToTileEffect(tile)) {
            const armorEffectiveness =
                tile === TILE_TYPES.LAVA ? 0
                    : tile === TILE_TYPES.SPIKE ? 0.5
                        : 1;
            this.takeDamage(tileDamage, null, { armorEffectiveness });
        }

        if (hazardDamage > 0) {
            const armorEffectiveness = hazard === HAZARD_TYPES.STEAM ? 0.5 : 1;
            this.takeDamage(hazardDamage, null, { armorEffectiveness });
        }
    }

    getTraversalEnchantments() {
        return getTraversalEnchantmentsForActor(
            this,
            (enchantmentKey) => this.hasEquippedEnchantment(enchantmentKey)
        );
    }

    canTraverseHazardTile(tile) {
        return canActorTraverseTile(tile, [], this.getTraversalEnchantments());
    }

    isImmuneToTileEffect(tile) {
        return isActorImmuneToTileEffect(tile, [], this.getTraversalEnchantments());
    }
}