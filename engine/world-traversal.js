// World hazard transitions and traversal helpers
//
// This file owns movement rules that are more specific than generic occupancy:
// - stairs and floor transitions
// - pit and water hazard transitions
// - landing selection and ally displacement during traversal
//
// Keep passive tile state out of this file. Trap, hazard, and item-on-tile state
// belongs in world-tile-state.js. Keep generic actor lookup and occupancy rules in
// world-actors.js.
//
// Water crossing is the trickiest flow here. It depends on:
// - the player's last movement direction or facing
// - connected-water-region discovery
// - prioritized far-shore landing selection
// - optional ally pushing when an ally occupies the landing tile

Object.assign(World.prototype, {
    resolvePlayerHazardTransition(player, tileType) {
        if (!player) {
            return false;
        }

        if (tileType === TILE_TYPES.WATER) {
            return this.resolvePlayerWaterTransition(player);
        }

        if (tileType === TILE_TYPES.PIT) {
            return this.resolvePlayerPitTransition(player);
        }

        if (tileType === TILE_TYPES.STAIRS_DOWN) {
            this.descendFloor();
            return this.moveActorToTile(player, TILE_TYPES.STAIRS_UP);
        }

        if (tileType === TILE_TYPES.STAIRS_UP && this.currentFloor > 0) {
            this.ascendFloor();
            return this.moveActorToTile(player, TILE_TYPES.STAIRS_DOWN);
        }

        return false;
    },

    resolvePlayerWaterTransition(player) {
        if (this.actorCanTraverseHazardTile(player, TILE_TYPES.WATER)) {
            return false;
        }

        const origin = { x: player.x, y: player.y };
        const crossed = this.movePlayerAcrossWater(player);
        if (!crossed || (player.x === origin.x && player.y === origin.y)) {
            this.moveActorToNearestOpenTileExcluding(player, origin.x, origin.y, origin.x, origin.y);
        }

        return true;
    },

    resolvePlayerPitTransition(player) {
        if (this.actorCanTraverseHazardTile(player, TILE_TYPES.PIT)) {
            return false;
        }

        const safePos = findNearestSafeTile(player.x, player.y, this.getCurrentFloor().grid, this.currentFloor);
        player.x = safePos.x;
        player.y = safePos.y;

        if (this.currentFloor > 0) {
            const pitX = player.x;
            const pitY = player.y;
            this.ascendFloor();
            const safePrevFloor = findNearestSafeTile(pitX, pitY, this.getCurrentFloor().grid, this.currentFloor);
            player.x = safePrevFloor.x;
            player.y = safePrevFloor.y;
        }

        return true;
    },

    actorCanTraverseHazardTile(actor, tileType) {
        if (!actor) {
            return false;
        }

        return canActorTraverseTile(tileType, [], getTraversalEnchantmentsForActor(actor));
    },

    moveActorToNearestOpenTileExcluding(actor, originX, originY, excludeX, excludeY) {
        if (!actor) {
            return false;
        }

        const fallbackPos = this.findNearestOpenTileExcluding(originX, originY, excludeX, excludeY);
        if (!fallbackPos) {
            return false;
        }

        actor.x = fallbackPos.x;
        actor.y = fallbackPos.y;
        return true;
    },

    movePlayerAcrossWater(player) {
        const grid = this.getCurrentFloor().grid;
        const waterBody = this.getConnectedWaterRegion(player.x, player.y, grid);
        if (waterBody.length === 0) {
            return false;
        }

        const moveDx = Number.isFinite(player.lastMoveDirection?.dx) ? player.lastMoveDirection.dx : player.facing?.dx;
        const moveDy = Number.isFinite(player.lastMoveDirection?.dy) ? player.lastMoveDirection.dy : player.facing?.dy;
        const movementDirection = normalizeDirection(moveDx, moveDy, { dx: 0, dy: 0 });
        const hasDirection = movementDirection.dx !== 0 || movementDirection.dy !== 0;
        if (!hasDirection) {
            return false;
        }

        const exitProbe = this.findForwardWaterExit(player.x, player.y, movementDirection.dx, movementDirection.dy, grid);
        const farSideCandidates = this.findWaterFarSideLandingTiles(
            waterBody,
            movementDirection.dx,
            movementDirection.dy,
            grid,
            player
        );
        if (farSideCandidates.length === 0) {
            return false;
        }

        const prioritizedCandidates = this.getPrioritizedWaterLandingCandidates(
            farSideCandidates,
            exitProbe,
            player
        );
        for (const candidate of prioritizedCandidates) {
            if (candidate.x === player.x && candidate.y === player.y) {
                continue;
            }

            const occupant = this.getEnemyAt(candidate.x, candidate.y);
            if (!occupant) {
                player.x = candidate.x;
                player.y = candidate.y;
                return true;
            }

            if (!occupant.isAlly) {
                continue;
            }

            const pushed = this.pushAllyAwayFromPlayerCrossing(
                occupant,
                candidate.x,
                candidate.y,
                movementDirection.dx,
                movementDirection.dy,
                player
            );
            if (!pushed) {
                continue;
            }

            player.x = candidate.x;
            player.y = candidate.y;
            return true;
        }

        return false;
    },

    getPrioritizedWaterLandingCandidates(candidates, exitProbe, player) {
        const unique = [];
        const seen = new Set();

        const preferred = candidates.find((candidate) =>
            candidate.x === exitProbe.x && candidate.y === exitProbe.y
        );
        if (preferred) {
            unique.push(preferred);
            seen.add(toGridKey(preferred.x, preferred.y));
        }

        const nearestToExitProbe = [...candidates].sort((left, right) => {
            const leftDistance = distance(exitProbe.x, exitProbe.y, left.x, left.y);
            const rightDistance = distance(exitProbe.x, exitProbe.y, right.x, right.y);
            if (leftDistance !== rightDistance) {
                return leftDistance - rightDistance;
            }

            const leftToPlayer = distance(player.x, player.y, left.x, left.y);
            const rightToPlayer = distance(player.x, player.y, right.x, right.y);
            return leftToPlayer - rightToPlayer;
        });

        for (const candidate of nearestToExitProbe) {
            const key = toGridKey(candidate.x, candidate.y);
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            unique.push(candidate);
        }

        return unique;
    },

    getConnectedWaterRegion(startX, startY, grid) {
        if (!this.isWithinBounds(startX, startY) || grid[startY][startX] !== TILE_TYPES.WATER) {
            return [];
        }

        const queue = [{ x: startX, y: startY }];
        const visited = new Set([toGridKey(startX, startY)]);
        const region = [];
        const cardinalDirs = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];

        while (queue.length > 0) {
            const current = queue.shift();
            region.push(current);

            for (const dir of cardinalDirs) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                if (!this.isWithinBounds(nx, ny) || grid[ny][nx] !== TILE_TYPES.WATER) {
                    continue;
                }

                const key = toGridKey(nx, ny);
                if (visited.has(key)) {
                    continue;
                }

                visited.add(key);
                queue.push({ x: nx, y: ny });
            }
        }

        return region;
    },

    findForwardWaterExit(startX, startY, dx, dy, grid) {
        let x = startX;
        let y = startY;

        while (this.isWithinBounds(x, y) && grid[y][x] === TILE_TYPES.WATER) {
            x += dx;
            y += dy;
        }

        return { x, y };
    },

    findWaterFarSideLandingTiles(waterBody, dx, dy, grid, player) {
        const candidates = [];
        const candidateKeys = new Set();

        for (const tile of waterBody) {
            const shorelineX = tile.x + dx;
            const shorelineY = tile.y + dy;
            if (!this.isWithinBounds(shorelineX, shorelineY) || grid[shorelineY][shorelineX] === TILE_TYPES.WATER) {
                continue;
            }

            const key = toGridKey(shorelineX, shorelineY);
            if (candidateKeys.has(key)) {
                continue;
            }

            if (!this.isShorelineLandingCandidate(shorelineX, shorelineY, player, grid)) {
                continue;
            }

            candidateKeys.add(key);
            candidates.push({ x: shorelineX, y: shorelineY });
        }

        return candidates;
    },

    isShorelineLandingCandidate(x, y, player, grid) {
        if (!this.isWithinBounds(x, y)) {
            return false;
        }

        if (grid[y][x] === TILE_TYPES.WALL || grid[y][x] === TILE_TYPES.WATER) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        return true;
    },

    pushAllyAwayFromPlayerCrossing(ally, allyX, allyY, pushDx, pushDy, player) {
        const candidatePositions = this.getAllyPushDestinationCandidates(allyX, allyY, pushDx, pushDy);
        for (const candidate of candidatePositions) {
            if (!this.canEnemyOccupy(candidate.x, candidate.y, player, ally, ally)) {
                continue;
            }

            this.moveEnemy(ally, candidate.x, candidate.y);
            return true;
        }

        return false;
    },

    getAllyPushDestinationCandidates(originX, originY, pushDx, pushDy) {
        const candidates = [];
        const seen = new Set();

        const addCandidate = (x, y) => {
            if (!this.isWithinBounds(x, y)) {
                return;
            }

            const key = toGridKey(x, y);
            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            candidates.push({ x, y });
        };

        addCandidate(originX + pushDx, originY + pushDy);

        for (let radius = 1; radius <= 4; radius++) {
            const ring = [];
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
                        continue;
                    }

                    const x = originX + dx;
                    const y = originY + dy;
                    if (!this.isWithinBounds(x, y)) {
                        continue;
                    }

                    ring.push({ x, y, dx, dy });
                }
            }

            ring.sort((left, right) => {
                const leftForwardness = left.dx * pushDx + left.dy * pushDy;
                const rightForwardness = right.dx * pushDx + right.dy * pushDy;
                if (leftForwardness !== rightForwardness) {
                    return rightForwardness - leftForwardness;
                }

                const leftDistance = Math.abs(left.dx) + Math.abs(left.dy);
                const rightDistance = Math.abs(right.dx) + Math.abs(right.dy);
                return leftDistance - rightDistance;
            });

            for (const candidate of ring) {
                addCandidate(candidate.x, candidate.y);
            }
        }

        return candidates;
    },

    findNearestOpenTileExcluding(originX, originY, excludeX, excludeY) {
        const floor = this.getCurrentFloor();
        const grid = floor.grid;
        const candidates = [];

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (x === excludeX && y === excludeY) {
                    continue;
                }

                if (!this.isOpenLandingTile(x, y, null, grid)) {
                    continue;
                }

                candidates.push({ x, y });
            }
        }

        if (candidates.length === 0) {
            return null;
        }

        return getNearestByDistance(originX, originY, candidates);
    },

    isOpenLandingTile(x, y, player, grid) {
        if (!this.isWithinBounds(x, y)) {
            return false;
        }

        if (grid[y][x] === TILE_TYPES.WALL || grid[y][x] === TILE_TYPES.WATER) {
            return false;
        }

        if (this.getEnemyAt(x, y)) {
            return false;
        }

        if (player && player.x === x && player.y === y) {
            return false;
        }

        return true;
    }
});