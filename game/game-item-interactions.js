// Item announcements and interaction coordination helpers

Object.assign(Game.prototype, {
    announceCombatHit(attackerName, targetName, damage) {
        this.ui.addMessage(`${attackerName} hits ${targetName} for ${damage}.`);
    },

    announcePickupSummary(pickupResult, singleFormatter, multiFormatter) {
        if (!pickupResult || pickupResult.count === 0) {
            return;
        }

        if (pickupResult.count === 1) {
            this.ui.addMessage(singleFormatter(pickupResult.names[0]));
            return;
        }

        this.ui.addMessage(multiFormatter(pickupResult.count));
    },

    announceThrowHitResult(itemLabel, result) {
        this.ui.addMessage(`${itemLabel} hits ${result.enemy.name}.`);
        if ((result.damage || 0) > 0) {
            this.ui.addMessage(`${result.enemy.name} takes ${result.damage} throw damage.`);
        }
        if ((result.healing || 0) > 0) {
            this.ui.addMessage(`${result.enemy.name} recovers ${result.healing} health from the throw.`);
        }
        if (result.tameSucceeded) {
            this.ui.addMessage(`${result.enemy.name} has been tamed and is now your ally.`);
        } else if (result.tameAttempted) {
            this.ui.addMessage(`${result.enemy.name} resists the taming attempt.`);
        }
        this.ui.addMessage(`${itemLabel} shatters on impact.`);
        if (result.enemyDefeated) {
            this.ui.addMessage(`${result.enemy.name} is defeated.`);
        }
    },

    extractAttackResultData(attackResult) {
        return {
            damage: attackResult?.damage || 0,
            critical: Boolean(attackResult?.critical),
            inflictedConditions: Array.isArray(attackResult?.inflictedConditions)
                ? attackResult.inflictedConditions
                : []
        };
    },

    announceInflictedConditions(targetName, inflictedConditions) {
        for (const condition of inflictedConditions) {
            this.ui.addMessage(`${targetName} is ${condition}.`);
        }
    },

    announceDropOutcome(drop, itemLabel, options = {}) {
        const {
            actorName = '',
            action = '',
            includeCoordinates = false,
            burnedSuffix = 'it burns up in lava.'
        } = options;
        if (!drop) {
            return;
        }

        if (drop.burned) {
            if (actorName && action) {
                this.ui.addMessage(`${actorName} ${action} ${itemLabel}, but ${burnedSuffix}`);
                return;
            }

            this.ui.addMessage(`${itemLabel} burns up in lava.`);
            return;
        }

        if (actorName && action) {
            if (includeCoordinates) {
                this.ui.addMessage(`${actorName} ${action} ${itemLabel} at ${drop.x}, ${drop.y}.`);
                return;
            }

            this.ui.addMessage(`${actorName} ${action} ${itemLabel}.`);
            return;
        }

        this.ui.addMessage(`${itemLabel} drops at ${drop.x}, ${drop.y}.`);
    },

    announceDropList(drops, getItemName, options = {}) {
        for (const drop of drops || []) {
            const dropName = typeof getItemName === 'function'
                ? getItemName(drop)
                : getItemLabel(drop.item, 'item');
            this.announceDropOutcome(drop, dropName, options);
        }
    },

    announceSimpleDropList(drops, fallbackLabel = 'item') {
        this.announceDropList(drops, (drop) => getItemLabel(drop.item, fallbackLabel));
    },

    announceActorItemDisposition(actorName, action, itemLabel, drop, options = {}) {
        this.announceDropOutcome(drop, itemLabel, {
            actorName,
            action,
            ...options
        });
    },

    announceActorDropList(actorName, action, drops, options = {}) {
        this.announceDropList(drops, (drop) => getItemLabel(drop.item, 'item'), {
            actorName,
            action,
            ...options
        });
    },

    dropAndAnnounceEnemyItems(enemy, items, action, options = {}) {
        if (!enemy || !Array.isArray(items) || items.length === 0) {
            return [];
        }

        const dropResults = this.dropItemsNearEnemy(enemy, items);
        this.announceActorDropList(enemy.name, action, dropResults, options);
        return dropResults;
    },

    announceThrowResult(item, result) {
        const label = getItemLabel(item);
        if (result.type === 'swallowed') {
            this.ui.addMessage(`${result.enemy.name} swallows ${label}.`);
            if (result.ejectedBecauseDifferentTypes) {
                this.ui.addMessage(`${result.enemy.name} cannot fuse different item types and spits both items out.`);
                this.announceSimpleDropList(result.ejectedDrops, 'item');
                return;
            }

            if (result.combined) {
                if ((result.mergedEnchantmentCount || 0) > 0) {
                    this.ui.addMessage(`${result.enemy.name} fuses the item and gains ${result.mergedEnchantmentCount} enchantment(s).`);
                } else {
                    this.ui.addMessage(`${result.enemy.name} fuses the item, but no new enchantments are gained.`);
                }
            }
        } else if (result.type === 'fuser-reject') {
            this.ui.addMessage(`${result.enemy.name} refuses to swallow more items.`);
            this.announceSimpleDropList(result.drops, label);
        } else if (result.type === 'hit') {
            this.announceThrowHitResult(label, result);
        } else if (result.type === 'burned') {
            this.ui.addMessage(`${label} burns up in lava.`);
        } else {
            this.ui.addMessage(`${label} lands at ${result.x}, ${result.y}.`);
        }
    },

    pickupItemsAndAnnounceAtPosition(x, y, singleFormatter, multiFormatter) {
        const pickupResult = this.pickupItemsAtPosition(x, y);
        this.announcePickupSummary(pickupResult, singleFormatter, multiFormatter);
    },

    pickupItemsAtPlayerPosition() {
        this.pickupItemsAndAnnounceAtPosition(
            this.player.x,
            this.player.y,
            (name) => `Picked up ${name}.`,
            (count) => `Picked up ${count} items.`
        );
    },

    pickupItemsAfterMove(targetX, targetY) {
        const endedOnTargetTile = this.player.x === targetX && this.player.y === targetY;
        if (endedOnTargetTile) {
            this.pickupItemsAtPlayerPosition();
            return;
        }

        this.pickupItemsAndAnnounceAtPosition(
            targetX,
            targetY,
            (name) => `You grab ${name} as you are swept away.`,
            (count) => `You grab ${count} items as you are swept away.`
        );
    }
});
