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
        if (health > 0) {
            user.heal(health);
        }
        if (hunger > 0) {
            user.restoreHunger(hunger);
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
            target.takeDamage(damage);
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
var hiddenConsumable = 'Unknown consumable';
var hiddenThrowable = 'Mysterious throwable';
var hiddenSword = 'Mysterious blade';
var hiddenArmor = 'Unknown armor';
var hiddenShield = 'Mysterious shield';
var hiddenAccessory = 'Unknown ring';

/*Healing items*/
function createHealingTier1() {
    return new Item('Old bandage', ITEM_TYPES.CONSUMABLE, {  health: 5, hiddenName: hiddenConsumable, requiresIdentification: false });
}
function createHealingTier2() {
    return new Item('Diluted potion', ITEM_TYPES.CONSUMABLE, { health: 10, hiddenName: hiddenConsumable, requiresIdentification: false });
}
function createHealingTier3() {
    return new Item('Healing potion', ITEM_TYPES.CONSUMABLE, {  health: 20, hiddenName: hiddenConsumable, requiresIdentification: false });
}
function createHealingTier4() {
    return new Item('Greater healing potion', ITEM_TYPES.CONSUMABLE, { health: 50, hiddenName: hiddenConsumable, requiresIdentification: false });
}
/*Food items*/
function createFoodTier1() {
    return new Item('Bitter seeds', ITEM_TYPES.CONSUMABLE, {  hunger: 5, hiddenName: hiddenConsumable, requiresIdentification: false });
}
function createFoodTier2() {
    return new Item('Apple', ITEM_TYPES.CONSUMABLE, {  hunger: 10, hiddenName: hiddenConsumable, requiresIdentification: false });
}
function createFoodTier3() {
    return new Item('Bread', ITEM_TYPES.CONSUMABLE, {  hunger: 20, hiddenName: hiddenConsumable, requiresIdentification: false });
}
function createFoodTier4() {
    return new Item('Stew', ITEM_TYPES.CONSUMABLE, {  hunger: 50, hiddenName: hiddenConsumable, requiresIdentification: false });
}
/*Throwables*/
function createThrowableTier1() {
    return new Item('Pebble', ITEM_TYPES.THROWABLE, { power: 5, hiddenName: hiddenThrowable, requiresIdentification: false });
}
function createThrowableTier2() {
    return new Item('Sharp rock', ITEM_TYPES.THROWABLE, { power: 10, hiddenName: hiddenThrowable, requiresIdentification: false });
}
function createThrowableTier3() {
    return new Item('Ninja star', ITEM_TYPES.THROWABLE, { power: 15, hiddenName: hiddenThrowable, requiresIdentification: false });
}
function createThrowableTier4() {
    return new Item('Javelin', ITEM_TYPES.THROWABLE, { power: 25, hiddenName: hiddenThrowable, requiresIdentification: false });
}
/*Weapons*/
function createWeaponTier1() {
    return new Item('Rusted sword', ITEM_TYPES.WEAPON, { power: 5, hiddenName: hiddenSword });
}
function createWeaponTier2() {
    return new Item('Bronze sword', ITEM_TYPES.WEAPON, { power: 5, hiddenName: hiddenSword });
}
function createWeaponTier3() {
    return new Item('Iron sword', ITEM_TYPES.WEAPON, { power: 5, hiddenName: hiddenSword });
}
function createWeaponTier4() {
    return new Item('Fancy sword', ITEM_TYPES.WEAPON, { power: 5, hiddenName: hiddenSword });
}
/*Armors*/
function createArmorTier1() {
    return new Item('Rags', ITEM_TYPES.ARMOR, { armor: 1, hiddenName: hiddenArmor });
}
function createArmorTier2() {
    return new Item('Leather armor', ITEM_TYPES.ARMOR, { armor: 3, hiddenName: hiddenArmor });
}
function createArmorTier3() {
    return new Item('Chainmail armor', ITEM_TYPES.ARMOR, { armor: 5, hiddenName: hiddenArmor });
}
function createArmorTier4() {
    return new Item('Plate armor', ITEM_TYPES.ARMOR, { armor: 8, hiddenName: hiddenArmor });
}
/*Shields*/
function createShieldTier1() {
    return new Item('Rotten shield', ITEM_TYPES.SHIELD, { armor: 1, hiddenName: hiddenShield });
}
function createShieldTier2() {
    return new Item('Wooden shield', ITEM_TYPES.SHIELD, { armor: 3, hiddenName: hiddenShield });
}
function createShieldTier3() {
    return new Item('Kite shield', ITEM_TYPES.SHIELD, { armor: 5, hiddenName: hiddenShield });
}
function createShieldTier4() {
    return new Item('Tower shield', ITEM_TYPES.SHIELD, { armor: 8, hiddenName: hiddenShield });
}
/*Accessories*/
function createAccessoryAttackTier1() {
    return new Item('Copper ring', ITEM_TYPES.ACCESSORY, { power: 1, hiddenName: hiddenAccessory });
}
function createAccessoryDefenseTier1() {
    return new Item('Copper ring', ITEM_TYPES.ACCESSORY, { armor: 1, hiddenName: hiddenAccessory });
}
function createAccessoryAttackTier2() {
    return new Item('Copper ring', ITEM_TYPES.ACCESSORY, { power: 2, hiddenName: hiddenAccessory });
}
function createAccessoryDefenseTier2() {
    return new Item('Copper ring', ITEM_TYPES.ACCESSORY, { armor: 2, hiddenName: hiddenAccessory });
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