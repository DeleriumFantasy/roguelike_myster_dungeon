// UI base class

class UI {
    constructor(canvas, infoPanel, inventoryModal, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.tabIndex = 0;
        this.canvas.focus();
        this.infoPanel = infoPanel;
        this.inventoryModal = inventoryModal;
        this.mapOverlay = document.getElementById('map-overlay');
        this.mapCanvas = document.getElementById('map-canvas');
        this.mapCtx = this.mapCanvas ? this.mapCanvas.getContext('2d') : null;
        this.game = game;
        this.messages = [];
        this.tileset = new Tileset();
        this.tileset.tryLoadExternalSpriteSheet(() => {
            if (this.game) {
                this.render(this.game.world, this.game.player, this.game.fov);
            }
        });
        this.statsDiv = this.infoPanel.querySelector('#stats');
        this.messagesDiv = this.infoPanel.querySelector('#messages');
        this.mapOpen = false;
        this.mapTileSize = 8;
        this.cameraBounds = {
            minX: 0,
            maxX: GRID_SIZE - 1,
            minY: 0,
            maxY: GRID_SIZE - 1
        };
        this.topDownOffsetX = 0;
        this.topDownOffsetY = 0;

        if (this.mapCanvas) {
            this.mapCanvas.width = GRID_SIZE * this.mapTileSize;
            this.mapCanvas.height = GRID_SIZE * this.mapTileSize;
        }

        this._mapExploredCanvas = document.createElement('canvas');
        this._mapExploredCanvas.width = GRID_SIZE * this.mapTileSize;
        this._mapExploredCanvas.height = GRID_SIZE * this.mapTileSize;
        this._mapExploredCtx = this._mapExploredCanvas.getContext('2d');
        this._mapExploredCacheFloor = -1;
        this._mapExploredCacheSize = 0;

        this.activeVisualEffects = [];
        this.pendingAnimationFrame = null;
    }

    getTileSize() {
        return Math.max(1, Math.floor(this.canvas.height / CAMERA_VISIBLE_TILE_ROWS));
    }

    getVisibleTileCounts() {
        const tileSize = this.getTileSize();
        return {
            x: Math.max(1, Math.floor(this.canvas.width / tileSize)),
            y: Math.max(1, Math.floor(this.canvas.height / tileSize))
        };
    }

    render(world, player, fov) {
        this.pruneExpiredVisualEffects(performance.now());
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.updateCamera(player);
        this.renderTopDownScene(world, player, fov);
        this.renderActiveEventBanner(world);
        this.updateInfoPanel(player, world, fov);

        if (this.mapOpen) {
            this.renderMapOverlay(world, player);
        }
    }

    scheduleVisualEffectRender() {
        if (this.pendingAnimationFrame !== null) {
            return;
        }

        this.pendingAnimationFrame = window.requestAnimationFrame(() => {
            this.pendingAnimationFrame = null;

            if (!this.hasActiveVisualEffects()) {
                return;
            }

            if (!this.game || !this.game.world || !this.game.player || !this.game.fov) {
                if (this.hasActiveVisualEffects()) {
                    this.scheduleVisualEffectRender();
                }
                return;
            }

            this.render(this.game.world, this.game.player, this.game.fov);

            if (this.hasActiveVisualEffects()) {
                this.scheduleVisualEffectRender();
            }
        });
    }
}
