// Shared floor content selection helpers

Object.assign(Game.prototype, {
    getFloorContentRng(floorIndex) {
        return new SeededRNG(this.seed + (floorIndex + 1) * 7919);
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