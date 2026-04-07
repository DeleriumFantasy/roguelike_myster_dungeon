// Shared floor content selection helpers

Object.assign(Game.prototype, {
    getFloorContentRng(floorIndex) {
        return new SeededRNG(this.seed + (floorIndex + 1) * 7919);
    },

    getPlayerInventoryItems() {
        const inventory = this.player?.getInventory?.();
        return Array.isArray(inventory) ? inventory : [];
    },

    getPlayerAllies(options = {}) {
        const { aliveOnly = false, filter = null } = options;
        const allies = Array.isArray(this.player?.allies) ? this.player.allies : [];
        return allies.filter((ally) => {
            if (!ally) {
                return false;
            }

            if (aliveOnly && !ally.isAlive?.()) {
                return false;
            }

            if (typeof filter === 'function' && !filter(ally)) {
                return false;
            }

            return true;
        });
    },

    getFloorMetaEntries(floor, key) {
        const entries = floor?.meta?.[key];
        return Array.isArray(entries) ? entries : [];
    },

    getWorldFloorCollections() {
        const collections = [];
        if (Array.isArray(this.world?.floors)) {
            collections.push(this.world.floors);
        }

        for (const floors of Object.values(this.world?.pathFloors || {})) {
            if (Array.isArray(floors)) {
                collections.push(floors);
            }
        }

        return collections;
    },

    forEachWorldFloor(callback) {
        if (typeof callback !== 'function') {
            return;
        }

        for (const floors of this.getWorldFloorCollections()) {
            for (const floor of floors) {
                callback(floor, floors);
            }
        }
    },

    getOverworldFloor() {
        return this.world?.getFloorAt?.(0, this.world?.getSelectedDungeonPathId?.())
            || (Array.isArray(this.world?.floors) ? this.world.floors[0] : null)
            || null;
    },

    findNpcByRole(npcRole, floor = this.getOverworldFloor()) {
        if (!npcRole || !floor) {
            return null;
        }

        const actorCollections = [floor.npcs, floor.enemies];
        for (const actors of actorCollections) {
            if (!Array.isArray(actors)) {
                continue;
            }

            const match = actors.find((actor) => {
                const actorRole = typeof actor?.npcRole === 'string' && actor.npcRole.length > 0
                    ? actor.npcRole
                    : (ENEMY_TEMPLATES?.[actor?.monsterType]?.npcRole || '');
                return actorRole === npcRole;
            });
            if (match) {
                return match;
            }
        }

        return null;
    },

    chooseWeightedEntry(rng, entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return null;
        }

        const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
        if (totalWeight <= 0) {
            return entries[0] || null;
        }

        let roll = getRngRoll(rng) * totalWeight;
        for (const entry of entries) {
            roll -= Math.max(0, Number(entry.weight) || 0);
            if (roll <= 0) {
                return entry;
            }
        }

        return entries[entries.length - 1] || null;
    }
});