// Item system
console.log('items.js loaded');

class Item {
    constructor(name, type, properties = {}) {
        this.name = name;
        this.type = type;
        this.properties = properties;
        this.knowledgeState = this.requiresIdentification() ? ITEM_KNOWLEDGE.UNKNOWN : ITEM_KNOWLEDGE.IDENTIFIED;
    }

    use(user, target) {
        // Placeholder for item use logic
        switch (this.type) {
            case ITEM_TYPES.CONSUMABLE:
                this.consume(user);
                break;
            case ITEM_TYPES.THROWABLE:
                this.throw(user, target);
                break;
        }

        // Consumables and one-use throwables are identified once used.
        this.identify();
    }

    requiresIdentification() {
        if (typeof this.properties.requiresIdentification === 'boolean') {
            return this.properties.requiresIdentification;
        }

        const unidentifiedByDefault = [
            ITEM_TYPES.CONSUMABLE,
            ITEM_TYPES.THROWABLE,
            ITEM_TYPES.WEAPON,
            ITEM_TYPES.ARMOR,
            ITEM_TYPES.SHIELD,
            ITEM_TYPES.ACCESSORY
        ];
        return unidentifiedByDefault.includes(this.type);
    }

    identify() {
        this.knowledgeState = ITEM_KNOWLEDGE.IDENTIFIED;
    }

    isIdentified() {
        return this.knowledgeState === ITEM_KNOWLEDGE.IDENTIFIED;
    }

    getDisplayName() {
        if (this.isIdentified()) {
            return this.name;
        }
        return this.properties.hiddenName || `unknown ${this.type}`;
    }

    isCursed() {
        return Boolean(this.properties.cursed);
    }

    consume(user) {
        const health = Number(this.properties.health || 0);
        const hunger = Number(this.properties.hunger || 0);
        const condition = this.properties.condition;
        const configuredDuration = getConditionDuration(condition, 10);
        const duration = Number(this.properties.duration ?? configuredDuration);
        if (health > 0) {
            user.heal(health);
        }
        if (hunger > 0) {
            user.restoreHunger(hunger);
        }
        if (condition && typeof user.addCondition === 'function') {
            user.addCondition(condition, duration);
        }
        if (this.properties.clearConditions) {
            user.clearConditions();
        }
    }

    throw(user, target) {
        if (!target) {
            return { damage: 0, healing: 0 };
        }

        const damage = Math.max(0, Number(this.properties.power || 0) + Number(this.properties.armor || 0));
        const healing = Math.max(0, Number(this.properties.health || 0) + Number(this.properties.hunger || 0));

        if (damage > 0 && typeof target.takeDamage === 'function') {
            const actualDamage = target.takeDamage(damage);
            if (actualDamage > 0 && typeof target.onAttacked === 'function') {
                target.onAttacked();
            }
            return { damage: actualDamage || 0, healing };
        }

        if (healing > 0 && typeof target.heal === 'function') {
            target.heal(healing);
        }

        return { damage, healing };
    }

    equip(user) {
        // Implement equip logic
        if (this.type !== ITEM_TYPES.CONSUMABLE && this.type !== ITEM_TYPES.THROWABLE) {
            const equipped = user.equipItem(this);
            if (equipped) {
                this.identify();
            }
            return equipped;
        }
        return false;
    }

    unequip(user) {
        // Implement unequip logic
        return user.unequipItem(this);
    }
}

// Item creation functions
const hiddenConsumable = 'Unknown consumable';
const hiddenThrowable = 'Mysterious throwable';
const hiddenSword = 'Mysterious blade';
const hiddenArmor = 'Unknown armor';
const hiddenShield = 'Mysterious shield';
const hiddenAccessory = 'Unknown ring';

const TIERED_ITEM_DEFINITIONS = {
    healing: {
        1: { name: 'Old bandage', type: ITEM_TYPES.CONSUMABLE, properties: { health: 5, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        2: { name: 'Diluted potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 10, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        3: { name: 'Healing potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 20, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        4: { name: 'Greater healing potion', type: ITEM_TYPES.CONSUMABLE, properties: { health: 50, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
    },
    food: {
        1: { name: 'Bitter seeds', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 5, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        2: { name: 'Apple', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 10, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        3: { name: 'Bread', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 20, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
        4: { name: 'Stew', type: ITEM_TYPES.CONSUMABLE, properties: { hunger: 50, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
    },
    throwable: {
        1: { name: 'Pebble', type: ITEM_TYPES.THROWABLE, properties: { power: 5, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
        2: { name: 'Sharp rock', type: ITEM_TYPES.THROWABLE, properties: { power: 10, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
        3: { name: 'Ninja star', type: ITEM_TYPES.THROWABLE, properties: { power: 15, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } },
        4: { name: 'Javelin', type: ITEM_TYPES.THROWABLE, properties: { power: 20, hiddenName: hiddenThrowable, burnable: true, requiresIdentification: false } }
    },
    weapon: {
        1: { name: 'Rusted sword', type: ITEM_TYPES.WEAPON, properties: { power: 5, hiddenName: hiddenSword, burnable: false } },
        2: { name: 'Bronze sword', type: ITEM_TYPES.WEAPON, properties: { power: 5, hiddenName: hiddenSword, burnable: false } },
        3: { name: 'Iron sword', type: ITEM_TYPES.WEAPON, properties: { power: 5, hiddenName: hiddenSword, burnable: false } },
        4: { name: 'Fancy sword', type: ITEM_TYPES.WEAPON, properties: { power: 5, hiddenName: hiddenSword, burnable: false } }
    },
    armor: {
        1: { name: 'Rags', type: ITEM_TYPES.ARMOR, properties: { armor: 1, hiddenName: hiddenArmor, burnable: true } },
        2: { name: 'Leather armor', type: ITEM_TYPES.ARMOR, properties: { armor: 3, hiddenName: hiddenArmor, burnable: true } },
        3: { name: 'Chainmail armor', type: ITEM_TYPES.ARMOR, properties: { armor: 5, hiddenName: hiddenArmor, burnable: false } },
        4: { name: 'Plate armor', type: ITEM_TYPES.ARMOR, properties: { armor: 8, hiddenName: hiddenArmor, burnable: false } }
    },
    shield: {
        1: { name: 'Rotten shield', type: ITEM_TYPES.SHIELD, properties: { armor: 1, hiddenName: hiddenShield, burnable: true } },
        2: { name: 'Wooden shield', type: ITEM_TYPES.SHIELD, properties: { armor: 3, hiddenName: hiddenShield, burnable: true } },
        3: { name: 'Kite shield', type: ITEM_TYPES.SHIELD, properties: { armor: 5, hiddenName: hiddenShield, burnable: false } },
        4: { name: 'Tower shield', type: ITEM_TYPES.SHIELD, properties: { armor: 8, hiddenName: hiddenShield, burnable: false } }
    },
    accessoryAttack: {
        1: { name: 'Copper ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 1, hiddenName: hiddenAccessory, burnable: false } },
        2: { name: 'Copper ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 2, hiddenName: hiddenAccessory, burnable: false } }
    },
    accessoryDefense: {
        1: { name: 'Copper ring', type: ITEM_TYPES.ACCESSORY, properties: { armor: 1, hiddenName: hiddenAccessory, burnable: false } },
        2: { name: 'Copper ring', type: ITEM_TYPES.ACCESSORY, properties: { armor: 2, hiddenName: hiddenAccessory, burnable: false } }
    }
};

const STATUS_CONSUMABLE_DEFINITIONS = {
    [CONDITIONS.POISONED]: { name: 'Poison brew', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.SLOW]: { name: 'Viscous slime tincture', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.HASTE]: { name: 'Haste potion', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.SLEEP]: { name: 'Sleeping draught', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.FRIGHTENED]: { name: 'Fright powder', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.BLIND]: { name: 'Methanol jug', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.INVISIBLE]: { name: 'Invisibility salve', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.BERSERK]: { name: 'Shard of madness', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.BOUND]: { name: 'Petrification salts', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.BLESSED]: { name: 'Holy water', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.INVINCIBILITY]: { name: 'Invincibility elixir', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.SATIATED]: { name: 'Garlic chicken pizza', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
    [CONDITIONS.HUNGRY]: { name: 'Spoiled milk', properties: { hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
};

const ITEM_SPAWN_POOL_BY_TIER = {
    1: [
        { category: 'healing', tier: 1, weight: 4 },
        { category: 'food', tier: 1, weight: 4 },
        { category: 'throwable', tier: 1, weight: 3 },
        { category: 'weapon', tier: 1, weight: 2 },
        { category: 'armor', tier: 1, weight: 2 },
        { category: 'shield', tier: 1, weight: 2 },
        { category: 'accessoryAttack', tier: 1, weight: 1 },
        { category: 'accessoryDefense', tier: 1, weight: 1 }
    ],
    2: [
        { category: 'healing', tier: 2, weight: 4 },
        { category: 'food', tier: 2, weight: 4 },
        { category: 'throwable', tier: 2, weight: 3 },
        { category: 'weapon', tier: 2, weight: 2 },
        { category: 'armor', tier: 2, weight: 2 },
        { category: 'shield', tier: 2, weight: 2 },
        { category: 'accessoryAttack', tier: 2, weight: 1 },
        { category: 'accessoryDefense', tier: 2, weight: 1 }
    ],
    3: [
        { category: 'healing', tier: 3, weight: 4 },
        { category: 'food', tier: 3, weight: 4 },
        { category: 'throwable', tier: 3, weight: 3 },
        { category: 'weapon', tier: 3, weight: 2 },
        { category: 'armor', tier: 3, weight: 2 },
        { category: 'shield', tier: 3, weight: 2 },
        { category: 'accessoryAttack', tier: 2, weight: 1 },
        { category: 'accessoryDefense', tier: 2, weight: 1 }
    ],
    4: [
        { category: 'healing', tier: 4, weight: 4 },
        { category: 'food', tier: 4, weight: 4 },
        { category: 'throwable', tier: 4, weight: 3 },
        { category: 'weapon', tier: 4, weight: 2 },
        { category: 'armor', tier: 4, weight: 2 },
        { category: 'shield', tier: 4, weight: 2 },
        { category: 'accessoryAttack', tier: 2, weight: 1 },
        { category: 'accessoryDefense', tier: 2, weight: 1 }
    ]
};

function createItemFromDefinition(definition) {
    if (!definition) {
        return null;
    }

    return new Item(definition.name, definition.type, { ...definition.properties });
}

function createTieredItem(category, tier) {
    const definition = TIERED_ITEM_DEFINITIONS[category]?.[tier] || null;
    return createItemFromDefinition(definition);
}

function createStatusConsumable(condition) {
    const definition = STATUS_CONSUMABLE_DEFINITIONS[condition];
    if (!definition) {
        return null;
    }

    return createItemFromDefinition({
        name: definition.name,
        type: ITEM_TYPES.CONSUMABLE,
        properties: {
            ...definition.properties,
            condition
        }
    });
}

function getWeightedItemEntriesForTier(tier) {
    const normalizedTier = clamp(tier, 1, 4);
    const entries = ITEM_SPAWN_POOL_BY_TIER[normalizedTier] || ITEM_SPAWN_POOL_BY_TIER[1];

    return entries.map((entry) => ({
        weight: entry.weight,
        create: () => createTieredItem(entry.category, entry.tier)
    }));
}

function createAllStatusConsumables() {
    return Object.keys(STATUS_CONSUMABLE_DEFINITIONS).map((condition) => createStatusConsumable(condition));
}

function createTieredStarterItems() {
    return [
        createTieredItem('healing', 1),
        createTieredItem('food', 1),
        createTieredItem('throwable', 1),
        createTieredItem('weapon', 1),
        createTieredItem('shield', 1),
        createTieredItem('armor', 1),
        createTieredItem('accessoryDefense', 1)
    ];
}

function canItemBeCursed(item) {
    if (!item) return false;
    return item.type === ITEM_TYPES.WEAPON ||
        item.type === ITEM_TYPES.ARMOR ||
        item.type === ITEM_TYPES.SHIELD ||
        item.type === ITEM_TYPES.ACCESSORY;
}

function applyWorldCurseRoll(item, rng = null, chance = 0.2) {
    if (!item || !canItemBeCursed(item)) {
        return item;
    }

    if (!item.properties) {
        item.properties = {};
    }

    const roll = rng && typeof rng.next === 'function' ? rng.next() : Math.random();
    item.properties.cursed = roll < chance;
    return item;
}