// Item throw resolution, drop placement, and pickup state helpers
//
// Keep this file focused on state mutation only:
// - resolving thrown-item outcomes
// - mutating tile/item state after throws, drops, pickups, and defeats
// - computing raw drop placement results consumed by other game files
//
// Do not add UI messaging here. Announcements belong in game-item-interactions.js.
// Do not add random item generation here. Generation belongs in game-item-generation.js.
//
// The broad method grouping in this file is:
// 1. Nearby drop placement helpers
// 2. Thrown-food taming helpers
// 3. Throw result constructors and resolution flow
// 4. Enemy defeat drop collection and pickup mutation helpers

Object.assign(Game.prototype, {
    getNearbyDropPositions(x, y, maxRadius = 3) {
        const positions = [];
        const seen = new Set();

        for (let radius = 1; radius <= maxRadius; radius++) {
            for (let offsetY = -radius; offsetY <= radius; offsetY++) {
                for (let offsetX = -radius; offsetX <= radius; offsetX++) {
                    if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) {
                        continue;
                    }

                    const px = x + offsetX;
                    const py = y + offsetY;
                    if (px < 0 || px >= GRID_SIZE || py < 0 || py >= GRID_SIZE) {
                        continue;
                    }

                    const key = `${px},${py}`;
                    if (seen.has(key)) {
                        continue;
                    }

                    seen.add(key);
                    positions.push({ x: px, y: py });
                }
            }
        }

        return positions;
    },

    dropItemsNearPosition(centerX, centerY, items, maxRadius = 3) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const dropped = [];
        const candidates = [{ x: centerX, y: centerY }, ...this.getNearbyDropPositions(centerX, centerY, maxRadius)];

        for (const item of items) {
            let placed = false;

            for (const candidate of candidates) {
                if (!this.world.canSpawnItemAt(candidate.x, candidate.y, this.player)) {
                    continue;
                }

                const dropResult = this.world.addItem(candidate.x, candidate.y, item);
                if (dropResult?.placed) {
                    dropped.push({ item, x: candidate.x, y: candidate.y, burned: false });
                    placed = true;
                    break;
                }
            }

            if (placed) {
                continue;
            }

            const fallbackResult = this.world.addItem(this.player.x, this.player.y, item);
            if (fallbackResult?.burned) {
                dropped.push({ item, x: this.player.x, y: this.player.y, burned: true });
            } else if (fallbackResult?.placed) {
                dropped.push({ item, x: this.player.x, y: this.player.y, burned: false });
            }
        }

        return dropped;
    },

    dropItemsNearEnemy(enemy, items) {
        if (!enemy) {
            return [];
        }

        return this.dropItemsNearPosition(enemy.x, enemy.y, items, 3);
    },

    releasePotContentsAtPosition(potItem, x, y) {
        if (!potItem?.isPotItem?.()) {
            return [];
        }

        const storedItems = potItem.releaseStoredItems?.() || [];
        return this.dropItemsNearPosition(x, y, storedItems, 3);
    },

    createPotShatterResult(item, x, y, enemy = null) {
        return {
            type: 'pot-shatter',
            outcome: 'pot-shatter',
            item,
            enemy,
            drops: this.releasePotContentsAtPosition(item, x, y),
            x,
            y
        };
    },

    isFoodItemForTaming(item) {
        if (!item) {
            return false;
        }

        const tierMatch = typeof getTieredItemMatch === 'function'
            ? getTieredItemMatch(item)
            : null;

        if (tierMatch?.category === 'food') {
            return true;
        }

        return Number(item?.properties?.hunger || 0) > 0;
    },

    getItemTierForTaming(item) {
        const tierMatch = typeof getTieredItemMatch === 'function'
            ? getTieredItemMatch(item)
            : null;
        const tier = Number(tierMatch?.tier);
        return Number.isFinite(tier) ? clamp(tier, 1, 4) : 1;
    },

    calculateThrownFoodTameChance(enemy, item, enemyHealthBeforeThrow) {
        const rules = THROW_FOOD_TAMING_RULES;
        const threshold = Math.max(1, Number(enemy?.getTameThreshold?.() ?? enemy?.tameThreshold ?? 1));
        const maxHealth = Math.max(1, Number(enemy?.maxHealth || 1));
        const currentHealth = clamp(Number(enemyHealthBeforeThrow) || 0, 0, maxHealth);
        const missingHealthRatio = 1 - (currentHealth / maxHealth);
        const itemTier = this.getItemTierForTaming(item);
        const playerLevel = Math.max(1, Number(this.player?.level || 1));

        const thresholdPenalty = Math.max(0, threshold - rules.thresholdBaseline) * rules.thresholdPenaltyPerPoint;
        const lowHpBonus = missingHealthRatio * rules.lowHpBonusScale;
        const itemTierBonus = Math.max(0, itemTier - 1) * rules.itemTierBonusPerTier;
        const playerLevelBonus = Math.min(rules.playerLevelBonusCap, Math.max(0, playerLevel - 1) * rules.playerLevelBonusPerLevel);

        const chance = rules.baseChance - thresholdPenalty + lowHpBonus + itemTierBonus + playerLevelBonus;
        return chance;
    },

    tryTameEnemyWithThrownFood(enemy, item, enemyHealthBeforeThrow) {
        if (!enemy || !enemy.canBeTamed?.() || !this.isFoodItemForTaming(item)) {
            return { attempted: false, chance: 0, succeeded: false };
        }

        const chance = this.calculateThrownFoodTameChance(enemy, item, enemyHealthBeforeThrow);
        const succeeded = getRngRoll() < chance;
        if (succeeded) {
            enemy.tame(this.player);
        }

        return {
            attempted: true,
            chance,
            succeeded
        };
    },

    createBurnedThrowResult(x, y) {
        return {
            type: 'burned',
            x,
            y
        };
    },

    createDroppedThrowResult(x, y) {
        return {
            type: 'drop',
            x,
            y
        };
    },

    getThrowableEffect(item) {
        return typeof item?.properties?.throwEffect === 'string'
            ? item.properties.throwEffect
            : '';
    },

    swapPlayerWithEnemy(enemy) {
        if (!enemy || !enemy.isAlive?.()) {
            return false;
        }

        const playerX = this.player.x;
        const playerY = this.player.y;
        const enemyX = enemy.x;
        const enemyY = enemy.y;

        this.world.moveEnemy(enemy, playerX, playerY);
        this.player.x = enemyX;
        this.player.y = enemyY;
        return true;
    },

    tryTeleportPlayerToPosition(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return false;
        }

        if (!this.world.canPlayerOccupy(x, y)) {
            return false;
        }

        this.player.x = x;
        this.player.y = y;
        return true;
    },

    resolveThrowAgainstFuser(enemy, item, x, y) {
        if (typeof enemy.canSwallowThrownItems === 'function' && enemy.canSwallowThrownItems()) {
            const swallowResult = typeof enemy.swallowThrownItem === 'function'
                ? enemy.swallowThrownItem(item)
                : null;

            if (swallowResult) {
                const ejectedItems = Array.isArray(swallowResult.ejectedItems)
                    ? swallowResult.ejectedItems
                    : [];
                const ejectedDrops = ejectedItems.length > 0
                    ? this.dropItemsNearEnemy(enemy, ejectedItems)
                    : [];

                return {
                    type: 'swallowed',
                    enemy,
                    combined: Boolean(swallowResult.combined),
                    mergedEnchantmentCount: Number(swallowResult.mergedEnchantmentCount || 0),
                    storedItem: swallowResult.storedItem || null,
                    ejectedBecauseDifferentTypes: Boolean(swallowResult.ejectedBecauseDifferentTypes),
                    ejectedDrops,
                    x,
                    y
                };
            }
        }

        const droppedByFuser = this.dropItemsNearEnemy(enemy, [item]);
        return {
            type: 'fuser-reject',
            enemy,
            drops: droppedByFuser,
            x,
            y
        };
    },

    resolveThrowHitEnemy(item, enemy, x, y, dx = 0, dy = 0) {
        const enemyHealthBeforeThrow = Number(enemy.health || 0);
        const throwEffect = this.getThrowableEffect(item);
        const throwImpact = item.throw(this.player, enemy) || { damage: 0, healing: 0 };
        const enemyDefeated = !enemy.isAlive();
        const tameRoll = enemyDefeated
            ? { attempted: false, chance: 0, succeeded: false }
            : this.tryTameEnemyWithThrownFood(enemy, item, enemyHealthBeforeThrow);
        let switchedPositions = false;
        let pushedDistance = 0;

        if (!enemyDefeated && throwEffect === 'switch') {
            switchedPositions = this.swapPlayerWithEnemy(enemy);
        }

        if (!enemyDefeated && throwEffect === 'pushback') {
            pushedDistance = this.tryPushEnemy(enemy, dx, dy, 2);
        }

        if (enemyDefeated) {
            this.handleEnemyDefeat(enemy, { announceDefeat: false, killer: this.player, defeatSource: 'player-throw' });
        }

        return {
            type: 'hit',
            enemy,
            enemyDefeated,
            damage: throwImpact.damage || 0,
            healing: throwImpact.healing || 0,
            tameAttempted: tameRoll.attempted,
            tameChance: tameRoll.chance,
            tameSucceeded: tameRoll.succeeded,
            switchedPositions,
            pushedDistance,
            x,
            y
        };
    },

    resolveThrowAgainstEnemy(item, enemy, x, y, dx = 0, dy = 0) {
        if (item?.type === ITEM_TYPES.POT) {
            return this.createPotShatterResult(item, x, y, enemy);
        }

        const isFuser = typeof enemy.hasEnemyType === 'function' && enemy.hasEnemyType(ENEMY_TYPES.FUSER);
        if (isFuser) {
            return this.resolveThrowAgainstFuser(enemy, item, x, y);
        }

        return this.resolveThrowHitEnemy(item, enemy, x, y, dx, dy);
    },

    resolveThrowFinalPlacement(item, lastValidPosition) {
        const dropX = lastValidPosition ? lastValidPosition.x : this.player.x;
        const dropY = lastValidPosition ? lastValidPosition.y : this.player.y;
        if (item?.type === ITEM_TYPES.POT) {
            return this.createPotShatterResult(item, dropX, dropY, null);
        }

        if (this.getThrowableEffect(item) === 'blink') {
            const teleported = this.tryTeleportPlayerToPosition(dropX, dropY);
            return {
                type: 'blink',
                x: dropX,
                y: dropY,
                playerTeleported: teleported
            };
        }

        const dropResult = this.world.addItem(dropX, dropY, item);
        if (dropResult?.burned) {
            return this.createBurnedThrowResult(dropX, dropY);
        }

        return this.createDroppedThrowResult(dropX, dropY);
    },

    resolveThrow(item, dx, dy) {
        const grid = this.world.getCurrentFloor().grid;
        let x = this.player.x + dx;
        let y = this.player.y + dy;
        let lastValid = null;
        const burnable = Boolean(item?.properties?.burnable);

        while (isValidPosition(x, y, grid)) {
            lastValid = { x, y };

            const tile = this.world.getTile(x, y);
            if (burnable && doesTileBurnItems(tile)) {
                return this.createBurnedThrowResult(x, y);
            }

            const enemy = this.world.getEnemyAt(x, y);
            if (enemy && !enemy.isAlly) {
                return this.resolveThrowAgainstEnemy(item, enemy, x, y, dx, dy);
            }

            x += dx;
            y += dy;
        }

        return this.resolveThrowFinalPlacement(item, lastValid);
    },

    resolveEnemyThrowHitPlayer(enemy, item, x, y) {
        if (item?.type === ITEM_TYPES.POT) {
            return {
                ...this.createPotShatterResult(item, x, y, this.player),
                target: this.player
            };
        }

        const throwImpact = item.throw(enemy, this.player) || { damage: 0, healing: 0 };
        return {
            outcome: 'hit-player',
            item,
            target: this.player,
            damage: throwImpact.damage || 0,
            healing: throwImpact.healing || 0,
            x,
            y
        };
    },

    resolveEnemyThrowHitEnemy(enemy, item, targetEnemy, x, y) {
        if (item?.type === ITEM_TYPES.POT) {
            return {
                ...this.createPotShatterResult(item, x, y, targetEnemy),
                target: targetEnemy,
                targetDefeated: false
            };
        }

        const throwImpact = item.throw(enemy, targetEnemy) || { damage: 0, healing: 0 };
        const targetDefeated = !targetEnemy.isAlive();
        if (targetDefeated) {
            if (enemy.isAlly) {
                this.handleEnemyDefeat(targetEnemy, { announceDefeat: false, grantExp: true, killer: enemy });
            } else {
                this.handleEnemyDefeat(targetEnemy, { announceDefeat: false, grantExp: false, killer: enemy });
            }
        }

        return {
            outcome: 'hit-enemy',
            item,
            target: targetEnemy,
            targetDefeated,
            damage: throwImpact.damage || 0,
            healing: throwImpact.healing || 0,
            x,
            y
        };
    },

    resolveEnemyThrowFinalPlacement(item, lastValidPosition) {
        const dropX = lastValidPosition ? lastValidPosition.x : this.player.x;
        const dropY = lastValidPosition ? lastValidPosition.y : this.player.y;
        if (item?.type === ITEM_TYPES.POT) {
            return this.createPotShatterResult(item, dropX, dropY, null);
        }

        const dropResult = this.world.addItem(dropX, dropY, item);
        if (dropResult?.burned) {
            return {
                outcome: 'burned',
                item,
                x: dropX,
                y: dropY
            };
        }

        return {
            outcome: 'drop',
            item,
            x: dropX,
            y: dropY
        };
    },

    resolveEnemyRangedThrow(enemy, item, dx, dy) {
        if (!enemy || !item) {
            return null;
        }

        const throwDx = Math.sign(Number(dx) || 0);
        const throwDy = Math.sign(Number(dy) || 0);
        if (throwDx === 0 && throwDy === 0) {
            return null;
        }

        const grid = this.world.getCurrentFloor().grid;
        let x = enemy.x + throwDx;
        let y = enemy.y + throwDy;
        let lastValid = null;
        const burnable = Boolean(item?.properties?.burnable);

        while (isValidPosition(x, y, grid)) {
            lastValid = { x, y };

            const tile = this.world.getTile(x, y);
            if (burnable && doesTileBurnItems(tile)) {
                return {
                    outcome: 'burned',
                    item,
                    x,
                    y
                };
            }

            if (this.player.x === x && this.player.y === y) {
                return this.resolveEnemyThrowHitPlayer(enemy, item, x, y);
            }

            const enemyTarget = this.world.getEnemyAt(x, y, enemy);
            if (enemyTarget && enemyTarget.isAlly !== enemy.isAlly) {
                return this.resolveEnemyThrowHitEnemy(enemy, item, enemyTarget, x, y);
            }

            x += throwDx;
            y += throwDy;
        }

        return this.resolveEnemyThrowFinalPlacement(item, lastValid);
    },

    placeEnemyItemAtTileOrDropNearby(enemy, item, tile) {
        if (!enemy || !item || !tile) {
            return null;
        }

        const placementResult = this.world.addItem(tile.x, tile.y, item);
        if (placementResult?.burned) {
            return {
                type: 'burned',
                item,
                tile
            };
        }

        if (placementResult?.placed) {
            return {
                type: 'placed',
                item,
                tile
            };
        }

        const fallbackDrops = this.dropItemsNearEnemy(enemy, [item]);
        return {
            type: 'fallback-drop',
            item,
            drop: fallbackDrops[0] || null
        };
    },

    collectDefeatedEnemyDrops(enemy) {
        if (!enemy) {
            return {
                heldItems: [],
                swallowedItems: []
            };
        }

        return enemy.collectCarriedItems();
    },

    pickupItemsAtPosition(x, y) {
        const items = this.world.getItems(x, y);
        if (!items.length) {
            return { count: 0, names: [] };
        }

        const pickedNames = [];
        for (const item of [...items]) {
            if (item.type === ITEM_TYPES.MONEY) {
                const value = this.getValidMoneyValue(item);
                this.player.money = (this.player.money || 0) + value;
                this.world.removeItem(x, y, item);
                pickedNames.push(`${value} money`);
                continue;
            }

            if (typeof this.player?.identifiesItemsOnPickup === 'function' && this.player.identifiesItemsOnPickup()) {
                item.identify?.();
            }

            const added = this.player.addItem(item);
            if (!added) {
                this.ui?.addMessage?.(`Inventory is full. ${getItemLabel(item)} stays on the ground.`);
                continue;
            }

            this.world.removeItem(x, y, item);
            const itemName = getItemLabel(item);
            pickedNames.push(itemName);
        }

        return {
            count: pickedNames.length,
            names: pickedNames
        };
    }
});
