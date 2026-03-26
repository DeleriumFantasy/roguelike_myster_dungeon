// Shared combat and targeting helpers

Object.assign(Game.prototype, {
    playerHasEquippedEnchantment(enchantmentKey) {
        if (!enchantmentKey || !this.player) {
            return false;
        }

        if (typeof this.player.hasEquippedEnchantment === 'function') {
            return this.player.hasEquippedEnchantment(enchantmentKey);
        }

        return false;
    },

    tryKnockbackEnemy(enemy, fromX, fromY) {
        if (!enemy) {
            return false;
        }

        const pushDx = Math.sign(enemy.x - fromX);
        const pushDy = Math.sign(enemy.y - fromY);
        if (pushDx === 0 && pushDy === 0) {
            return false;
        }

        const targetX = enemy.x + pushDx;
        const targetY = enemy.y + pushDy;

        if (this.player.x === targetX && this.player.y === targetY) {
            return false;
        }

        const occupyingEnemy = this.world.getEnemyAt(targetX, targetY, enemy);
        if (occupyingEnemy) {
            return false;
        }

        if (typeof enemy.canOccupyTile === 'function' && !enemy.canOccupyTile(this.world, targetX, targetY, this.player)) {
            return false;
        }

        this.world.moveEnemy(enemy, targetX, targetY);
        return true;
    },

    getAttackOffsetsForFacing(dx, dy) {
        const normalizedDx = Math.sign(Number(dx) || 0);
        const normalizedDy = Math.sign(Number(dy) || 0);
        if (normalizedDx === 0 && normalizedDy === 0) {
            return [];
        }

        const offsets = [{ dx: normalizedDx, dy: normalizedDy }];
        const hasSweepingAttack = this.playerHasEquippedEnchantment('sweepingAttack');
        const hasSideAttack = this.playerHasEquippedEnchantment('sideAttack');
        const hasBackAttack = this.playerHasEquippedEnchantment('backAttack');

        if (hasSweepingAttack) {
            if (normalizedDx === 0) {
                offsets.push({ dx: -1, dy: normalizedDy });
                offsets.push({ dx: 1, dy: normalizedDy });
            } else if (normalizedDy === 0) {
                offsets.push({ dx: normalizedDx, dy: -1 });
                offsets.push({ dx: normalizedDx, dy: 1 });
            } else {
                offsets.push({ dx: normalizedDx, dy: 0 });
                offsets.push({ dx: 0, dy: normalizedDy });
            }
        }

        if (hasSideAttack) {
            offsets.push({ dx: -normalizedDy, dy: normalizedDx });
            offsets.push({ dx: normalizedDy, dy: -normalizedDx });
        }

        if (hasBackAttack) {
            offsets.push({ dx: -normalizedDx, dy: -normalizedDy });
        }

        const uniqueOffsets = [];
        const seenKeys = new Set();
        for (const offset of offsets) {
            const key = `${offset.dx},${offset.dy}`;
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            uniqueOffsets.push(offset);
        }

        return uniqueOffsets;
    }
});
