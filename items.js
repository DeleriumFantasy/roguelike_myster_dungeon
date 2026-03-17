// Item system

class Item {
    constructor(name, type, properties = {}) {
        this.name = name;
        this.type = type;
        this.properties = properties;
        this.knowledgeState = this.requiresIdentification() ? ITEM_KNOWLEDGE.UNKNOWN : ITEM_KNOWLEDGE.IDENTIFIED;
    }

    use(user, target) {
        if (this.type === ITEM_TYPES.CONSUMABLE) {
            this.consume(user);
        }
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
            const enchantmentNames = this.getVisibleEnchantmentNames();
            if (enchantmentNames.length === 0) {
                return this.name;
            }

            return `${this.name} [${enchantmentNames.join(', ')}]`;
        }
        return this.properties.hiddenName || `unknown ${this.type}`;
    }

    getEnchantments() {
        if (!Array.isArray(this.properties?.enchantments)) {
            return [];
        }

        const uniqueEnchantments = [];
        for (const enchantmentKey of this.properties.enchantments) {
            if (typeof enchantmentKey !== 'string') {
                continue;
            }

            if (!Object.prototype.hasOwnProperty.call(ENCHANTMENT_DEFINITIONS, enchantmentKey)) {
                continue;
            }

            const definition = ENCHANTMENT_DEFINITIONS[enchantmentKey];
            const validTypes = definition.validItemTypes || [];
            if (Array.isArray(validTypes) && validTypes.length > 0 && !validTypes.includes(this.type)) {
                continue;
            }

            if (!uniqueEnchantments.includes(enchantmentKey)) {
                uniqueEnchantments.push(enchantmentKey);
            }
        }

        return uniqueEnchantments;
    }

    getVisibleEnchantmentNames() {
        return this.getEnchantments()
            .map((enchantmentId) => ENCHANTMENT_DEFINITIONS[enchantmentId]?.name)
            .filter((name) => typeof name === 'string' && name.length > 0);
    }

    getEnchantmentPowerBonus() {
        return sumEnchantmentBonus(this.getEnchantments(), 'powerBonus');
    }

    getEnchantmentArmorBonus() {
        return sumEnchantmentBonus(this.getEnchantments(), 'armorBonus');
    }

    getDamageMultiplierAgainst(target) {
        if (!target) {
            return 1;
        }

        let multiplier = 1;
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};

            const genericDamageMultiplier = getPositiveFiniteNumber(enchantmentDefinition.damageMultiplier);
            if (genericDamageMultiplier > 0) {
                multiplier *= genericDamageMultiplier;
            }

            multiplier = applyEnemyTypeMultipliers(
                multiplier,
                target,
                enchantmentDefinition.damageMultiplierByEnemyType,
                (value, enemyTypeMultiplier) => value * enemyTypeMultiplier
            );
        }

        return multiplier;
    }

    getDamageMultiplierForAttacker(attacker) {
        if (!attacker) {
            return 1;
        }

        let multiplier = 1;
        const attackerHunger = Number(attacker.hunger || 0);
        const attackerMaxHunger = Math.max(1, Number(attacker.maxHunger || 1));
        const attackerHealth = Number(attacker.health || 0);
        const attackerMaxHealth = Math.max(1, Number(attacker.maxHealth || 1));

        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};

            const hungerMultiplier = getPositiveFiniteNumber(enchantmentDefinition.hungerPowerMultiplier);
            if (hungerMultiplier > 0 && attackerHunger / attackerMaxHunger <= 0.2) {
                multiplier *= hungerMultiplier;
            }

            const bloodyMultiplier = getPositiveFiniteNumber(enchantmentDefinition.bloodyPowerMultiplier);
            if (bloodyMultiplier > 0 && attackerHealth / attackerMaxHealth <= 0.2) {
                multiplier *= bloodyMultiplier;
            }
        }

        return multiplier;
    }

    getOnHitInflictedConditions(randomFn = Math.random) {
        if (typeof randomFn !== 'function') {
            randomFn = Math.random;
        }

        const inflictedConditions = [];
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};
            const inflictedCondition = enchantmentDefinition.inflictsCondition;
            const inflictChance = getPositiveFiniteNumber(enchantmentDefinition.inflictChance);

            if (!inflictedCondition) {
                continue;
            }

            if (inflictChance <= 0) {
                continue;
            }

            if (randomFn() < inflictChance) {
                inflictedConditions.push(inflictedCondition);
            }
        }

        return inflictedConditions;
    }

    getConditionPreventionChance(condition) {
        if (!condition) {
            return 0;
        }

        let highestChance = 0;
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};
            if (enchantmentDefinition.preventsCondition !== condition) {
                continue;
            }

            const preventionChance = getPositiveFiniteNumber(enchantmentDefinition.preventionChance);
            if (preventionChance > highestChance) {
                highestChance = preventionChance;
            }
        }

        return highestChance;
    }

    getIncomingDamageMultiplierFrom(attacker) {
        if (!attacker) {
            return 1;
        }

        let multiplier = 1;
        for (const enchantmentId of this.getEnchantments()) {
            const enchantmentDefinition = ENCHANTMENT_DEFINITIONS[enchantmentId] || {};

            const genericShieldMultiplier = getPositiveFiniteNumber(enchantmentDefinition.shieldMultiplier);
            if (genericShieldMultiplier > 0) {
                multiplier /= genericShieldMultiplier;
            }

            multiplier = applyEnemyTypeMultipliers(
                multiplier,
                attacker,
                enchantmentDefinition.shieldMultiplierByEnemyType,
                (value, enemyTypeMultiplier) => value / enemyTypeMultiplier
            );
        }

        return Math.max(0.1, multiplier);
    }

    getQuantity() {
        return getRawItemQuantity(this.properties);
    }

    setQuantity(quantity) {
        setRawItemQuantity(this.properties, quantity);
    }

    createSingleUseClone() {
        const clonedProperties = { ...this.properties };
        if (Object.prototype.hasOwnProperty.call(clonedProperties, 'quantity')) {
            delete clonedProperties.quantity;
        }

        const clonedItem = new Item(this.name, this.type, clonedProperties);
        clonedItem.knowledgeState = this.knowledgeState;
        return clonedItem;
    }

    isCursed() {
        return Boolean(this.properties.cursed);
    }

    consume(user) {
        const health = Number(this.properties.health || 0);
        const hunger = Number(this.properties.hunger || 0);
        const { condition, duration } = resolveConditionDuration(this.properties);
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
        const { condition, duration } = resolveConditionDuration(this.properties);
        let actualDamage = damage;

        if (damage > 0 && typeof target.takeDamage === 'function') {
            actualDamage = target.takeDamage(damage) || 0;
            if (actualDamage > 0 && typeof target.onAttacked === 'function') {
                target.onAttacked();
            }
        }

        if (healing > 0 && typeof target.heal === 'function') {
            target.heal(healing);
        }

        if (condition && typeof target.addCondition === 'function') {
            target.addCondition(condition, duration);
        }

        return { damage: actualDamage || 0, healing };
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

const ENCHANTMENT_DEFINITIONS = {
    sweepingAttack: {
        id: 'sweepingAttack',
        name: 'Sweeping attack',
        validItemTypes: [ITEM_TYPES.WEAPON],
    },
    sideAttack: {
        id: 'sideAttack',
        name: 'Side attack',
        validItemTypes: [ITEM_TYPES.WEAPON],
    },
    backAttack: {
        id: 'backAttack',
        name: 'Back attack',
        validItemTypes: [ITEM_TYPES.WEAPON],
    },
    rapidStrike: {
        id: 'rapidStrike',
        name: 'Rapid strike',
        validItemTypes: [ITEM_TYPES.WEAPON],
    },
    critical: {
        id: 'critical',
        name: 'Critical',
        validItemTypes: [ITEM_TYPES.WEAPON],
    },
    knockback: {
        id: 'knockback',
        name: 'Knockback',
        validItemTypes: [ITEM_TYPES.WEAPON],
    },
    hungerPower: {
        id: 'hungerPower',
        name: 'Hunger power',
        validItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ACCESSORY],
        hungerPowerMultiplier: 1.3
    },
    bloodyPower: {
        id: 'bloodyPower',
        name: 'Bloody power',
        validItemTypes: [ITEM_TYPES.WEAPON, ITEM_TYPES.ACCESSORY],
        bloodyPowerMultiplier: 1.3
    },
    ruinTraps: {
        id: 'ruinTraps',
        name: 'Ruin traps',
        validItemTypes: [ITEM_TYPES.WEAPON],
    },
    inflictPoison: {
        id: 'inflictPoison',
        name: 'Poison',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.POISONED,
        inflictChance: 0.2
    },
    inflictSlow: {
        id: 'inflictSlow',
        name: 'Slow',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.SLOW,
        inflictChance: 0.2
    },
    inflictSleep: {
        id: 'inflictSleep',
        name: 'Sleep',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.SLEEP,
        inflictChance: 0.2
    },
    inflictFrightened: {
        id: 'inflictFrightened',
        name: 'Frightened',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.FRIGHTENED,
        inflictChance: 0.2
    },
    inflictBlind: {
        id: 'inflictBlind',
        name: 'Blind',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.BLIND,
        inflictChance: 0.2
    },
    inflictBound: {
        id: 'inflictBound',
        name: 'Bound',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.BOUND,
        inflictChance: 0.2
    },
    inflictBerserk: {
        id: 'inflictBerserk',
        name: 'Berserk',
        validItemTypes: [ITEM_TYPES.WEAPON],
        inflictsCondition: CONDITIONS.BERSERK,
        inflictChance: 0.2
    },
    preventPoison: {
        id: 'preventPoison',
        name: 'Poison ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.POISONED,
        preventionChance: 0.75
    },
    preventSlow: {
        id: 'preventSlow',
        name: 'Slow ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.SLOW,
        preventionChance: 0.75
    },
    preventSleep: {
        id: 'preventSleep',
        name: 'Sleep ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.SLEEP,
        preventionChance: 0.75
    },
    preventFrightened: {
        id: 'preventFrightened',
        name: 'Fear ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.FRIGHTENED,
        preventionChance: 0.75
    },
    preventBlind: {
        id: 'preventBlind',
        name: 'Blind ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.BLIND,
        preventionChance: 0.75
    },
    preventBound: {
        id: 'preventBound',
        name: 'Bind ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.BOUND,
        preventionChance: 0.75
    },
    preventBerserk: {
        id: 'preventBerserk',
        name: 'Berserk ward',
        validItemTypes: [ITEM_TYPES.ARMOR],
        preventsCondition: CONDITIONS.BERSERK,
        preventionChance: 0.75
    },
    slayer: {
        id: 'slayer',
        name: 'Slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplier: 1.1
    },
    beastSlayer: {
        id: 'beastSlayer',
        name: 'Beast slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.BEAST]: 1.1
        }
    },
    slimeSlayer: {
        id: 'slimeSlayer',
        name: 'Slime slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.SLIME]: 1.1
        }
    }, 
    aquaticSlayer: {
        id: 'aquaticSlayer',
        name: 'Aquatic slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.AQUATIC]: 1.1
        }
    }, 
    floatingSlayer: {
        id: 'floatingSlayer',
        name: 'Floating slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.FLOATING]: 1.1
        }
    }, 
    ghostSlayer: {
        id: 'ghostSlayer',
        name: 'Ghost slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.GHOST]: 1.1
        }
    },
    vandalSlayer: {
        id: 'vandalSlayer',
        name: 'Vandal slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.VANDAL]: 1.1
        }
    }, 
    fuserSlayer: {
        id: 'fuserSlayer',
        name: 'Fuser slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.FUSER]: 1.1
        }
    }, 
    pariahSlayer: {
        id: 'pariahSlayer',
        name: 'Pariah slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.PARIAH]: 1.1
        }
    }, 
    crafterSlayer: {
        id: 'crafterSlayer',
        name: 'Crafter slayer',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.WEAPON],
        damageMultiplierByEnemyType: {
            [ENEMY_TYPES.CRAFTER]: 1.1
        }
    }, 
    defender: {
        id: 'defender',
        name: 'Defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplier: 1.1
    },
    beastDefender: {
        id: 'beastDefender',
        name: 'Beast defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.BEAST]: 1.1
        }
    },
    slimeDefender: {
        id: 'slimeDefender',
        name: 'Slime defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.SLIME]: 1.1
        }
    }, 
    aquaticDefender: {
        id: 'aquaticDefender',
        name: 'Aquatic defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.AQUATIC]: 1.1
        }
    }, 
    floatingDefender: {
        id: 'floatingDefender',
        name: 'Floating defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.FLOATING]: 1.1
        }
    }, 
    ghostDefender: {
        id: 'ghostDefender',
        name: 'Ghost defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.GHOST]: 1.1
        }
    },
    vandalDefender: {
        id: 'vandalDefender',
        name: 'Vandal defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.VANDAL]: 1.1
        }
    }, 
    fuserDefender: {
        id: 'fuserDefender',
        name: 'Fuser defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.FUSER]: 1.1
        }
    }, 
    pariahDefender: {
        id: 'pariahDefender',
        name: 'Pariah defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.PARIAH]: 1.1
        }
    }, 
    crafterDefender: {
        id: 'crafterDefender',
        name: 'Crafter defender',
        validItemTypes: [ITEM_TYPES.ACCESSORY, ITEM_TYPES.ARMOR, ITEM_TYPES.SHIELD],
        shieldMultiplierByEnemyType: {
            [ENEMY_TYPES.CRAFTER]: 1.1
        }
    }, 
};

const TIERED_ITEM_DEFINITIONS = {
    money :{
        1: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 10, valueMax: 50, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } },
        2: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 50, valueMax: 100, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } },
        3: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 100, valueMax: 200, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } },
        4: { name: 'Money', type: ITEM_TYPES.MONEY, properties: { valueMin: 200, valueMax: 300, hiddenName: 'Unknown currency', burnable: true, requiresIdentification: false } },
    },
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
        1: { name: 'Rusted sword', type: ITEM_TYPES.WEAPON, properties: { power: 3, slots: 7, enchantments: ['slayer'], hiddenName: hiddenSword, burnable: false } },
        2: { name: 'Bronze sword', type: ITEM_TYPES.WEAPON, properties: { power: 4, slots: 6, hiddenName: hiddenSword, burnable: false } },
        3: { name: 'Iron sword', type: ITEM_TYPES.WEAPON, properties: { power: 5, slots: 5, hiddenName: hiddenSword, burnable: false } },
        4: { name: 'Fancy sword', type: ITEM_TYPES.WEAPON, properties: { power: 8, slots: 4, hiddenName: hiddenSword, burnable: false } }
    },
    armor: {
        1: { name: 'Rags', type: ITEM_TYPES.ARMOR, properties: { armor: 3, slots: 7, hiddenName: hiddenArmor, burnable: true } },
        2: { name: 'Leather armor', type: ITEM_TYPES.ARMOR, properties: { armor: 4, slots: 6, hiddenName: hiddenArmor, burnable: true } },
        3: { name: 'Chainmail armor', type: ITEM_TYPES.ARMOR, properties: { armor: 6, slots: 5, hiddenName: hiddenArmor, burnable: false } },
        4: { name: 'Plate armor', type: ITEM_TYPES.ARMOR, properties: { armor: 8, slots: 4, hiddenName: hiddenArmor, burnable: false } }
    },
    shield: {
        1: { name: 'Rotten shield', type: ITEM_TYPES.SHIELD, properties: { armor: 3, slots: 7, hiddenName: hiddenShield, burnable: true } },
        2: { name: 'Wooden shield', type: ITEM_TYPES.SHIELD, properties: { armor: 4, slots: 6, hiddenName: hiddenShield, burnable: true } },
        3: { name: 'Kite shield', type: ITEM_TYPES.SHIELD, properties: { armor: 6, slots: 5, hiddenName: hiddenShield, burnable: false } },
        4: { name: 'Tower shield', type: ITEM_TYPES.SHIELD, properties: { armor: 8, slots: 4, hiddenName: hiddenShield, burnable: false } }
    },
    accessory: {
        1: [{ name: 'Copper ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 5, slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Copper bracelet', type: ITEM_TYPES.ACCESSORY, properties: { armor: 5, slots: 3, hiddenName: hiddenAccessory, burnable: false } }
        ],
        2: [{ name: 'Bronze ring', type: ITEM_TYPES.ACCESSORY, properties: { power: 10, slots: 3, hiddenName: hiddenAccessory, burnable: false } },
            { name: 'Bronze bracelet', type: ITEM_TYPES.ACCESSORY, properties: { armor: 10, slots: 3, hiddenName: hiddenAccessory, burnable: false } }
        ]
    },
    statusConsumable: {
        1: [
            { name: 'Poison brew', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.POISONED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Sleeping draught', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SLEEP, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Fright powder', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.FRIGHTENED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Spoiled milk', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.HUNGRY, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        2: [
            { name: 'Viscous slime tincture', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SLOW, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false, dropOnlyEnemyTypes: [ENEMY_TYPES.SLIME] } },
            { name: 'Haste potion', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.HASTE, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        3: [
            { name: 'Methanol jug', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BLIND, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Invisibility salve', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.INVISIBLE, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Shard of madness', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BERSERK, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ],
        4: [
            { name: 'Petrification salts', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BOUND, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Holy water', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.BLESSED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Invincibility elixir', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.INVINCIBILITY, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } },
            { name: 'Garlic chicken pizza', type: ITEM_TYPES.CONSUMABLE, properties: { condition: CONDITIONS.SATIATED, hiddenName: hiddenConsumable, burnable: true, requiresIdentification: false } }
        ]
    }
};

function sumEnchantmentBonus(enchantments, bonusKey) {
    return enchantments.reduce((sum, enchantmentId) => {
        const bonus = Number(ENCHANTMENT_DEFINITIONS[enchantmentId]?.[bonusKey] || 0);
        return sum + (Number.isFinite(bonus) ? bonus : 0);
    }, 0);
}

function actorMatchesEnemyType(actor, enemyType) {
    return typeof actor.hasEnemyType === 'function'
        ? actor.hasEnemyType(enemyType)
        : Array.isArray(actor.creatureTypes) && actor.creatureTypes.includes(enemyType);
}

function getPositiveFiniteNumber(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function applyEnemyTypeMultipliers(currentValue, actor, multiplierMap, applyMultiplier) {
    if (!multiplierMap || typeof applyMultiplier !== 'function') {
        return currentValue;
    }

    let nextValue = currentValue;
    for (const [enemyType, configuredMultiplier] of Object.entries(multiplierMap)) {
        const enemyTypeMultiplier = getPositiveFiniteNumber(configuredMultiplier);
        if (enemyTypeMultiplier <= 0) {
            continue;
        }

        if (actorMatchesEnemyType(actor, enemyType)) {
            nextValue = applyMultiplier(nextValue, enemyTypeMultiplier);
        }
    }

    return nextValue;
}

function normalizeConditionKey(condition) {
    return Object.values(CONDITIONS).includes(condition) ? condition : null;
}

function resolveConditionDuration(properties) {
    const condition = properties.condition;
    const configuredDuration = getConditionDuration(condition, 10);
    const duration = Number(properties.duration ?? configuredDuration);
    return { condition, duration };
}

function getRawItemQuantity(properties) {
    const quantity = Number(properties?.quantity);
    return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function setRawItemQuantity(properties, quantity) {
    const nextQuantity = Number(quantity);
    if (Number.isFinite(nextQuantity) && nextQuantity > 1) {
        properties.quantity = Math.floor(nextQuantity);
        return;
    }
    if (Object.prototype.hasOwnProperty.call(properties, 'quantity')) {
        delete properties.quantity;
    }
}

function getStatusConsumableDefinitions() {
    const statusByTier = TIERED_ITEM_DEFINITIONS.statusConsumable || {};
    const definitions = [];

    for (const [tier, tierDefinition] of Object.entries(statusByTier)) {
        if (!tierDefinition) {
            continue;
        }

        const normalizedTier = Number(tier);
        const normalizedDefinitions = normalizeTierDefinitions(tierDefinition);

        for (const definition of normalizedDefinitions) {
            if (!definition || typeof definition !== 'object') {
                continue;
            }

            const condition = normalizeConditionKey(definition.properties?.condition);
            if (!condition) {
                continue;
            }
            definitions.push({
                name: definition.name,
                type: ITEM_TYPES.CONSUMABLE,
                properties: {
                    ...(definition.properties || {}),
                    condition,
                    tier: Number.isFinite(normalizedTier) ? normalizedTier : undefined
                }
            });
        }
    }

    return definitions;
}

function normalizeTierDefinitions(tierDefinition) {
    if (!tierDefinition) {
        return [];
    }

    return Array.isArray(tierDefinition)
        ? tierDefinition
        : [tierDefinition];
}

const ITEM_SPAWN_POOL_BY_TIER = {
    1: [
        { category: 'money', tier: 1, weight: 4 },
        { category: 'healing', tier: 1, weight: 4 },
        { category: 'food', tier: 1, weight: 4 },
        { category: 'statusConsumable', tier: 1, weight: 2 },
        { category: 'throwable', tier: 1, weight: 3 },
        { category: 'weapon', tier: 1, weight: 2 },
        { category: 'armor', tier: 1, weight: 2 },
        { category: 'shield', tier: 1, weight: 2 },
        { category: 'accessory', tier: 1, weight: 1 },
    ],
    2: [
        { category: 'money', tier: 2, weight: 4 },
        { category: 'healing', tier: 2, weight: 4 },
        { category: 'food', tier: 2, weight: 4 },
        { category: 'statusConsumable', tier: 2, weight: 2 },
        { category: 'throwable', tier: 2, weight: 3 },
        { category: 'weapon', tier: 2, weight: 2 },
        { category: 'armor', tier: 2, weight: 2 },
        { category: 'shield', tier: 2, weight: 2 },
        { category: 'accessory', tier: 2, weight: 1 },
    ],
    3: [
        { category: 'money', tier: 3, weight: 4 },
        { category: 'healing', tier: 3, weight: 4 },
        { category: 'food', tier: 3, weight: 4 },
        { category: 'statusConsumable', tier: 3, weight: 2 },
        { category: 'throwable', tier: 3, weight: 3 },
        { category: 'weapon', tier: 3, weight: 2 },
        { category: 'armor', tier: 3, weight: 2 },
        { category: 'shield', tier: 3, weight: 2 },
        { category: 'accessory', tier: 2, weight: 1 },
    ],
    4: [
        { category: 'money', tier: 4, weight: 4 },
        { category: 'healing', tier: 4, weight: 4 },
        { category: 'food', tier: 4, weight: 4 },
        { category: 'statusConsumable', tier: 4, weight: 2 },
        { category: 'throwable', tier: 4, weight: 3 },
        { category: 'weapon', tier: 4, weight: 2 },
        { category: 'armor', tier: 4, weight: 2 },
        { category: 'shield', tier: 4, weight: 2 },
        { category: 'accessory', tier: 2, weight: 1 },
    ]
};

function createItemFromDefinition(definition) {
    if (!definition) {
        return null;
    }

    return new Item(definition.name, definition.type, { ...definition.properties });
}

function getTieredItemMatch(item) {
    if (!item) {
        return null;
    }

    for (const [category, tierDefinitions] of Object.entries(TIERED_ITEM_DEFINITIONS)) {
        for (const [tierKey, tierDefinition] of Object.entries(tierDefinitions || {})) {
            const normalizedDefinitions = normalizeTierDefinitions(tierDefinition);

            for (const definition of normalizedDefinitions) {
                if (!definition) {
                    continue;
                }

                if (definition.name === item.name && definition.type === item.type) {
                    return {
                        category,
                        tier: Number(tierKey),
                        definition
                    };
                }
            }
        }
    }

    return null;
}

function copyItemPersistentState(sourceItem, targetItem, options = {}) {
    if (!sourceItem || !targetItem) {
        return targetItem;
    }

    const {
        preserveEnchantments = true,
        preserveCurse = true,
        preserveKnowledgeState = true,
        preserveQuantity = true
    } = options;

    if (preserveEnchantments) {
        const enchantments = typeof sourceItem.getEnchantments === 'function'
            ? sourceItem.getEnchantments()
            : (Array.isArray(sourceItem.properties?.enchantments) ? [...sourceItem.properties.enchantments] : []);
        if (enchantments.length > 0) {
            targetItem.properties.enchantments = [...enchantments];
        }
    }

    if (preserveCurse && typeof sourceItem.isCursed === 'function' && sourceItem.isCursed()) {
        targetItem.properties.cursed = true;
    }

    if (preserveQuantity && typeof sourceItem.getQuantity === 'function') {
        const quantity = sourceItem.getQuantity();
        if (quantity > 1 && typeof targetItem.setQuantity === 'function') {
            targetItem.setQuantity(quantity);
        }
    }

    if (preserveKnowledgeState && typeof sourceItem.knowledgeState === 'string') {
        targetItem.knowledgeState = sourceItem.knowledgeState;
    }

    return targetItem;
}

function createLowerTierVersionOfItem(item) {
    const match = getTieredItemMatch(item);
    if (!match) {
        return typeof item?.createSingleUseClone === 'function' ? item.createSingleUseClone() : null;
    }

    const targetTier = Math.max(1, match.tier - 1);
    const targetTierDefinition = TIERED_ITEM_DEFINITIONS[match.category]?.[targetTier];
    const normalizedDefinitions = normalizeTierDefinitions(targetTierDefinition);

    let chosenDefinition = normalizedDefinitions.find((definition) => definition?.type === item.type) || normalizedDefinitions[0] || null;
    if (Array.isArray(targetTierDefinition) && match.definition?.properties?.condition) {
        chosenDefinition = normalizedDefinitions.find((definition) => definition?.properties?.condition === match.definition.properties.condition)
            || chosenDefinition;
    }

    const transformedItem = createItemFromDefinition(chosenDefinition || match.definition);
    return copyItemPersistentState(item, transformedItem, {
        preserveEnchantments: true,
        preserveCurse: true,
        preserveKnowledgeState: true,
        preserveQuantity: true
    });
}

function createBitterSeedsItemFrom(sourceItem = null) {
    const bitterSeeds = createTieredItem('food', 1);
    if (!bitterSeeds) {
        return null;
    }

    if (sourceItem && typeof sourceItem.knowledgeState === 'string') {
        bitterSeeds.knowledgeState = sourceItem.knowledgeState;
    }

    return bitterSeeds;
}

function isEnemyDropRestrictedItem(item) {
    const restrictedTypes = item?.properties?.dropOnlyEnemyTypes;
    return Array.isArray(restrictedTypes) && restrictedTypes.length > 0;
}

function canEnemyDropItem(item, enemy) {
    if (!isEnemyDropRestrictedItem(item)) {
        return true;
    }

    if (!enemy || typeof enemy.hasEnemyType !== 'function') {
        return false;
    }

    return item.properties.dropOnlyEnemyTypes.some((enemyType) => enemy.hasEnemyType(enemyType));
}

function createTieredItem(category, tier) {
    let definition = TIERED_ITEM_DEFINITIONS[category]?.[tier] || null;
    if (Array.isArray(definition)) {
        definition = pickRandom(definition);
    }
    return createItemFromDefinition(definition);
}

function createStatusConsumable(condition) {
    const definitions = getStatusConsumableDefinitions();
    const normalizedCondition = normalizeConditionKey(condition);

    if (!normalizedCondition) {
        return null;
    }

    const matchingDefinitions = definitions.filter((definition) => definition.properties.condition === normalizedCondition);
    if (matchingDefinitions.length === 0) {
        return null;
    }

    const chosenDefinition = pickRandom(matchingDefinitions);

    return createItemFromDefinition({
        name: chosenDefinition.name,
        type: chosenDefinition.type,
        properties: {
            ...chosenDefinition.properties,
            condition: normalizedCondition
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
    const conditions = [...new Set(getStatusConsumableDefinitions().map((definition) => definition.properties.condition))];
    return conditions
        .map((condition) => createStatusConsumable(condition))
        .filter((item) => Boolean(item));
}


/**
 * Creates a set of starter items, one for each category, all at tier 1.
 */
function createTieredStarterItems() {
    return [
        createTieredItem('healing', 1),
        createTieredItem('food', 1),
        createTieredItem('throwable', 1),
        createTieredItem('weapon', 1),
        createTieredItem('shield', 1),
        createTieredItem('armor', 1),
        createTieredItem('accessory', 1)
    ];
}

function canItemBeCursed(item) {
    if (!item) return false;
    return item.type === ITEM_TYPES.WEAPON ||
        item.type === ITEM_TYPES.ARMOR ||
        item.type === ITEM_TYPES.SHIELD ||
        item.type === ITEM_TYPES.ACCESSORY;
}

function prepareRollableEquipmentItem(item) {
    if (!item || !canItemBeCursed(item)) {
        return null;
    }

    if (!item.properties) {
        item.properties = {};
    }

    return item;
}

function getMaxEnchantmentCountForItem(item) {
    const slotCount = Number(item?.properties?.slots || 0);
    if (!Number.isFinite(slotCount) || slotCount <= 0) {
        return 0;
    }

    return Math.max(0, Math.floor(slotCount));
}

function getEnchantmentPoolForItem(item) {
    return Object.entries(ENCHANTMENT_DEFINITIONS)
        .filter(([, definition]) => Array.isArray(definition.validItemTypes) && definition.validItemTypes.includes(item.type))
        .map(([key]) => key);
}

function applyWorldEnchantmentRoll(item, rng = null, chance = 0.15) {
    const rollableItem = prepareRollableEquipmentItem(item);
    if (!rollableItem) {
        return item;
    }

    const maxEnchantmentCount = getMaxEnchantmentCountForItem(rollableItem);
    if (maxEnchantmentCount <= 0) {
        return rollableItem;
    }

    const roll = getRngRoll(rng);
    if (roll >= chance) {
        return rollableItem;
    }

    const pool = getEnchantmentPoolForItem(rollableItem);
    if (pool.length === 0) {
        return rollableItem;
    }

    const availableEnchantments = [...pool];
    const maxSelectableEnchantments = Math.min(maxEnchantmentCount, availableEnchantments.length);
    const desiredCountRoll = getRngRoll(rng);
    const desiredCount = Math.max(1, Math.ceil(desiredCountRoll * maxSelectableEnchantments));

    const chosenEnchantments = [];
    while (chosenEnchantments.length < desiredCount && availableEnchantments.length > 0) {
        const index = getRngRandomInt(rng, 0, availableEnchantments.length - 1);
        const [chosen] = availableEnchantments.splice(index, 1);
        if (typeof chosen === 'string') {
            chosenEnchantments.push(chosen);
        }
    }

    if (chosenEnchantments.length > 0) {
        rollableItem.properties.enchantments = chosenEnchantments;
    }

    return rollableItem;
}

function applyWorldCurseRoll(item, rng = null, chance = 0.2) {
    const rollableItem = prepareRollableEquipmentItem(item);
    if (!rollableItem) {
        return item;
    }

    const roll = getRngRoll(rng);
    rollableItem.properties.cursed = roll < chance;
    return rollableItem;
}