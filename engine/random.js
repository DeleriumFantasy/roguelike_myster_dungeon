// Random number helpers

class SeededRNG {
    constructor(seed) {
        this.seed = seed;
        this.state = seed;
    }

    next() {
        this.state = (this.state * 1103515245 + 12345) % 2147483648;
        return this.state / 2147483648;
    }

    randomInt(min, max) {
        return randomIntFromUnitRoll(this.next(), min, max);
    }
}

function randomIntFromUnitRoll(unitRoll, min, max) {
    return Math.floor(unitRoll * (max - min + 1)) + min;
}

function randomInt(min, max) {
    return randomIntFromUnitRoll(Math.random(), min, max);
}

function getRngRoll(rng = null) {
    if (rng && typeof rng.next === 'function') {
        return rng.next();
    }

    return Math.random();
}

function getRngRandomInt(rng, min, max) {
    if (rng && typeof rng.randomInt === 'function') {
        return rng.randomInt(min, max);
    }

    return randomInt(min, max);
}

function createMathRng() {
    return {
        next: () => Math.random(),
        randomInt: (min, max) => randomInt(min, max)
    };
}

function pickRandom(list, rng = null, fallback = null) {
    if (!Array.isArray(list) || list.length === 0) {
        return fallback;
    }

    const index = getRngRandomInt(rng, 0, list.length - 1);
    return list[index];
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
