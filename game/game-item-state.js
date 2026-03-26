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

    dropItemsNearEnemy(enemy, items) {
        if (!enemy || !Array.isArray(items) || items.length === 0) {
            return [];
        }

        const dropped = [];
        const candidates = this.getNearbyDropPositions(enemy.x, enemy.y, 3);

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

    resolveThrowHitEnemy(item, enemy, x, y) {
        const enemyHealthBeforeThrow = Number(enemy.health || 0);
        const throwImpact = item.throw(this.player, enemy) || { damage: 0, healing: 0 };
        const enemyDefeated = !enemy.isAlive();
        const tameRoll = enemyDefeated
            ? { attempted: false, chance: 0, succeeded: false }
            : this.tryTameEnemyWithThrownFood(enemy, item, enemyHealthBeforeThrow);
        if (enemyDefeated) {
            this.handleEnemyDefeat(enemy, { announceDefeat: false, killer: this.player });
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
            x,
            y
        };
    },

    resolveThrowAgainstEnemy(item, enemy, x, y) {
        const isFuser = typeof enemy.hasEnemyType === 'function' && enemy.hasEnemyType(ENEMY_TYPES.FUSER);
        if (isFuser) {
            return this.resolveThrowAgainstFuser(enemy, item, x, y);
        }

        return this.resolveThrowHitEnemy(item, enemy, x, y);
    },

    resolveThrowFinalPlacement(item, lastValidPosition) {
        const dropX = lastValidPosition ? lastValidPosition.x : this.player.x;
        const dropY = lastValidPosition ? lastValidPosition.y : this.player.y;
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
                return this.resolveThrowAgainstEnemy(item, enemy, x, y);
            }

            x += dx;
            y += dy;
        }

        return this.resolveThrowFinalPlacement(item, lastValid);
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
            this.player.addItem(item);
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
