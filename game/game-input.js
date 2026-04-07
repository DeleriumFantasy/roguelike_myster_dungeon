// Browser input controller for Game

class GameInputController {
    constructor(game) {
        this.game = game;
        this.pressedMoveKeys = new Set();
        this.pendingMoveTimer = null;
        this.moveRepeatInitialDelayMs = 40;
        this.moveRepeatIntervalMs = 80;
        this.handleWindowResize = () => {
            this.game.resizeCanvas();
            if (this.game.ui && this.game.world && this.game.player) {
                this.game.ui.render(this.game.world, this.game.player, this.game.fov);
            }
        };
        this.handleWindowBlur = () => {
            this.reset();
        };
    }

    attach() {
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));
        window.addEventListener('resize', this.handleWindowResize);
        window.addEventListener('blur', this.handleWindowBlur);
        this.bindCloseButton('close-inventory', () => this.game.ui.closeInventory());
        this.bindCloseButton('close-settings', () => {
            this.game.ui.closeSettings();
        });
        this.bindCloseButton('close-dungeon-selection', () => {
            this.game.ui.closeDungeonSelection();
        });
    }

    bindCloseButton(buttonId, closeAction) {
        const button = document.getElementById(buttonId);
        if (!button) {
            return;
        }

        button.addEventListener('click', () => {
            this.closeOverlayAndFocus(closeAction);
        });
    }

    focusPrimaryCanvas() {
        if (typeof this.game?.ui?.focusGameSurface === 'function') {
            this.game.ui.focusGameSurface();
            return;
        }

        const focusTarget = this.game?.canvas || null;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            focusTarget.focus();
        }
    }

    closeOverlayAndFocus(closeAction) {
        if (typeof closeAction === 'function') {
            closeAction();
        }

        this.reset();
        this.focusPrimaryCanvas();
    }

    handleEscapeKey() {
        const ui = this.game.ui;
        if (!ui) {
            return;
        }

        this.reset();
        if (ui.closeTopmostOverlay?.()) {
            return;
        }

        ui.openSettings();
    }

    toggleInventory() {
        if (this.game.inventoryOpen) {
            this.closeOverlayAndFocus(() => this.game.ui.closeInventory());
            return;
        }

        this.game.ui.openInventory(this.game.player);
    }

    reset() {
        this.cancelPendingMoveTimer();
        this.pressedMoveKeys.clear();
    }

    handleKeyDown(event) {
        const key = event.key;
        const lowerKey = key.toLowerCase();

        if (this.game.ui?.shouldBlockGameplayInput?.(key, lowerKey)) {
            event.preventDefault();
            return;
        }

        // Stop auto-explore on any key press
        if (this.game.autoExploreActive) {
            this.game.stopAutoExplore();
            event.preventDefault();
            return;
        }

        const normalizedMoveKey = normalizeMoveInputKey(key, lowerKey);
        if (normalizedMoveKey) {
            const wasPressed = this.pressedMoveKeys.has(normalizedMoveKey);
            this.pressedMoveKeys.add(normalizedMoveKey);
            if (wasPressed) {
                event.preventDefault();
                return;
            }

            const moveDirection = this.getDirectionFromPressedKeys();
            if (!moveDirection) {
                event.preventDefault();
                return;
            }

            if (event.shiftKey) {
                this.game.lookTowards(moveDirection.dx, moveDirection.dy);
            } else {
                this.startHeldMoveLoop();
            }
            event.preventDefault();
            return;
        }

        const lookDirection = getDirectionForInputKey(key, lowerKey);
        if (event.shiftKey && lookDirection) {
            this.game.lookTowards(lookDirection.dx, lookDirection.dy);
            event.preventDefault();
            return;
        }

        if (event.ctrlKey && lowerKey === 'z') {
            this.game.undoLastTurn?.();
            event.preventDefault();
            return;
        }

        let handled = true;
        switch (key) {
            case ' ':
                this.game.handleFacingAttackInput();
                break;
            case 'Escape':
                this.handleEscapeKey();
                break;
            default:
                handled = this.handleLetterKey(lowerKey);
        }

        if (handled) {
            event.preventDefault();
        }
    }

    handleKeyUp(event) {
        const key = event.key;
        const lowerKey = key.toLowerCase();
        const normalizedMoveKey = normalizeMoveInputKey(key, lowerKey);
        if (!normalizedMoveKey) {
            return;
        }

        this.pressedMoveKeys.delete(normalizedMoveKey);
        if (this.pressedMoveKeys.size === 0) {
            this.cancelPendingMoveTimer();
        }
    }

    handleLetterKey(lowerKey) {
        const action = getInputActionForKey(lowerKey);
        switch (action) {
            case 'open-inventory':
                this.toggleInventory();
                return true;
            case 'toggle-map':
                this.game.ui.toggleMapOverlay?.();
                return true;
            case 'toggle-stats':
                this.game.ui.toggleStatsOverlay?.();
                return true;
            case 'toggle-messages':
                this.game.ui.toggleMessagesOverlay?.();
                return true;
            case 'toggle-auto-explore':
                if (this.game.autoExploreActive) {
                    this.game.stopAutoExplore();
                } else {
                    this.game.startAutoExplore();
                }
                return true;
            case 'undo-last-turn':
                this.game.undoLastTurn?.();
                return true;
            case 'grant-debug-loadout':
                this.game.grantDebugCheaterLoadout?.();
                return true;
            default:
                return false;
        }
    }

    getDirectionFromPressedKeys() {
        let dx = 0;
        let dy = 0;

        for (const pressedKey of this.pressedMoveKeys) {
            const direction = getDirectionForInputKey(pressedKey, pressedKey);
            if (!direction) {
                continue;
            }

            dx += direction.dx;
            dy += direction.dy;
        }

        dx = Math.sign(dx);
        dy = Math.sign(dy);
        if (dx === 0 && dy === 0) {
            return null;
        }

        return { dx, dy };
    }

    startHeldMoveLoop() {
        this.queueCombinedMoveFromPressedKeys(this.moveRepeatInitialDelayMs);
    }

    cancelPendingMoveTimer() {
        if (this.pendingMoveTimer === null) {
            return;
        }

        window.clearTimeout(this.pendingMoveTimer);
        this.pendingMoveTimer = null;
    }

    queueCombinedMoveFromPressedKeys(delayMs = this.moveRepeatInitialDelayMs) {
        if (this.pendingMoveTimer !== null) {
            return;
        }

        this.pendingMoveTimer = window.setTimeout(() => {
            this.pendingMoveTimer = null;

            if (this.game.ui?.isBlockingOverlayOpen?.({ includeMap: true })) {
                this.reset();
                return;
            }

            const moveDirection = this.getDirectionFromPressedKeys();
            if (!moveDirection) {
                return;
            }

            this.game.handleMoveInput(moveDirection.dx, moveDirection.dy);

            if (this.pressedMoveKeys.size > 0) {
                this.queueCombinedMoveFromPressedKeys(this.moveRepeatIntervalMs);
            }
        }, Math.max(0, Number(delayMs) || 0));
    }
}