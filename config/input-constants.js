// Input bindings and action lookup helpers

const INPUT_DIRECTION_BINDINGS = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 },
    s: { dx: 0, dy: 1 },
    a: { dx: -1, dy: 0 },
    d: { dx: 1, dy: 0 }
};

const INPUT_ACTION_BINDINGS = {
    b: 'grant-debug-loadout',
    i: 'open-inventory',
    n: 'toggle-messages',
    m: 'toggle-map',
    p: 'toggle-stats',
    x: 'toggle-auto-explore'
};

const INVENTORY_ACTIONS_BY_TYPE = {
    [ITEM_TYPES.THROWABLE]: ['throw', 'drop'],
    [ITEM_TYPES.POT]: ['use', 'throw', 'drop'],
    [ITEM_TYPES.WEAPON]: ['equip', 'throw', 'drop'],
    [ITEM_TYPES.ARMOR]: ['equip', 'throw', 'drop'],
    [ITEM_TYPES.SHIELD]: ['equip', 'throw', 'drop'],
    [ITEM_TYPES.ACCESSORY]: ['equip', 'throw', 'drop'],
    default: ['use', 'throw', 'drop']
};

function normalizeMoveInputKey(key, lowerKey = String(key).toLowerCase()) {
    if (Object.prototype.hasOwnProperty.call(INPUT_DIRECTION_BINDINGS, key)) {
        return key;
    }
    if (Object.prototype.hasOwnProperty.call(INPUT_DIRECTION_BINDINGS, lowerKey)) {
        return lowerKey;
    }
    return null;
}

function getDirectionForInputKey(key, lowerKey = String(key).toLowerCase()) {
    const normalizedKey = normalizeMoveInputKey(key, lowerKey);
    return normalizedKey ? INPUT_DIRECTION_BINDINGS[normalizedKey] : null;
}

function getInputActionForKey(lowerKey) {
    return INPUT_ACTION_BINDINGS[lowerKey] || null;
}

function getInventoryActionsForItemType(itemType) {
    return INVENTORY_ACTIONS_BY_TYPE[itemType] || INVENTORY_ACTIONS_BY_TYPE.default;
}