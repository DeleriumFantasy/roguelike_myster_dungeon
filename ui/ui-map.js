// UI map overlay helpers

Object.assign(UI.prototype, {
    toggleMap(world, player) {
        if (this.mapOpen) {
            this.closeMap();
            return;
        }
        this.openMap(world, player);
    },

    openMap(world, player) {
        this.mapOpen = true;
        this.renderMapOverlay(world, player);
        this.mapOverlay.style.display = 'block';
        this.mapOverlay.setAttribute('aria-hidden', 'false');
    },

    closeMap() {
        this.mapOpen = false;
        this.mapOverlay.style.display = 'none';
        this.mapOverlay.setAttribute('aria-hidden', 'true');
    },

    renderMapOverlay(world, player) {
        if (!this.mapOpen) return;
        if (!this.mapCtx || !this.mapCanvas) return;
        if (!this.tileset.isReady()) return;

        if (this.isActorBlind(player)) {
            this.mapCtx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
            const tileSize = this.mapTileSize;
            this.renderPlayerMarker(this.mapCtx, player.x * tileSize, player.y * tileSize, tileSize, player);
            return;
        }

        const mapCtx = this.mapCtx;
        const mapFov = world.getCurrentFloor().fov;
        const tileSize = this.mapTileSize;
        const shouldUseFog = this.shouldUseFogForFloor(world.currentFloor);
        const shouldHideUnseenTiles = this.shouldHideUnseenTilesForFloor(world.currentFloor);
        const revealItemsOnMap = typeof player?.revealsItemsOnMap === 'function' && player.revealsItemsOnMap();
        const revealEnemiesOnMap = typeof player?.revealsEnemiesOnMap === 'function' && player.revealsEnemiesOnMap();

        if (!shouldUseFog || this._mapExploredCacheFloor !== world.currentFloor || this._mapExploredCacheSize !== mapFov.explored.size) {
            const eCtx = this._mapExploredCtx;
            eCtx.clearRect(0, 0, this._mapExploredCanvas.width, this._mapExploredCanvas.height);
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    if (!this.isTileRevealed(x, y, mapFov, shouldHideUnseenTiles)) continue;
                    const tile = world.getTile(x, y);
                    const srcRect = this.tileset.getMapSourceRect(tile, world, x, y);
                    eCtx.drawImage(
                        this.tileset.spriteSheet,
                        srcRect.x, srcRect.y, srcRect.width, srcRect.height,
                        x * tileSize, y * tileSize, tileSize, tileSize
                    );
                }
            }
            this._mapExploredCacheFloor = world.currentFloor;
            this._mapExploredCacheSize = shouldUseFog ? mapFov.explored.size : GRID_SIZE * GRID_SIZE;
        }

        mapCtx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
        mapCtx.drawImage(this._mapExploredCanvas, 0, 0);

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (!this.isTileRevealed(x, y, mapFov, shouldHideUnseenTiles)) continue;

                const overlays = this.getTileOverlayData(world, x, y);
                this.renderTileOverlays(mapCtx, overlays.hazard, overlays.trapType, overlays.trapRevealed, x * tileSize, y * tileSize, tileSize);

                if (shouldUseFog && !mapFov.isVisible(x, y)) {
                    mapCtx.fillStyle = COLORS.FOG_OVERLAY;
                    mapCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }
            }
        }

        for (const [key] of world.getCurrentFloor().items) {
            const [x, y] = this.parseGridKey(key);
            if (!revealItemsOnMap && !this.isTileRevealed(x, y, mapFov, shouldHideUnseenTiles)) continue;

            const itemVisual = getEntityVisual('item');
            const itemType = this.getItemTypeAt(world, x, y);
            const alpha = revealItemsOnMap && !this.isTileRevealed(x, y, mapFov, shouldHideUnseenTiles)
                ? 1
                : (shouldUseFog ? this.getVisibilityAlpha(mapFov.isVisible(x, y)) : 1);
            this.withTemporaryAlpha(mapCtx, alpha, () => {
                mapCtx.fillStyle = getItemTypeColor(itemType, itemVisual.color);
                mapCtx.fillRect(
                    x * tileSize + itemVisual.miniMapInsetMap,
                    y * tileSize + itemVisual.miniMapInsetMap,
                    Math.max(2, tileSize - itemVisual.miniMapInsetMap * 2),
                    Math.max(2, tileSize - itemVisual.miniMapInsetMap * 2)
                );
            });
        }

        for (const enemy of world.getAllActors?.() || world.getEnemies?.() || []) {
            const shouldShowEnemy = revealEnemiesOnMap
                ? this.shouldRenderEnemy(enemy, () => true)
                : this.isEnemyVisibleInFov(enemy, mapFov);
            if (!shouldShowEnemy) {
                continue;
            }
            mapCtx.fillStyle = getEntityVisual('enemy', enemy).color;
            mapCtx.fillRect(enemy.x * tileSize, enemy.y * tileSize, tileSize, tileSize);
        }

        this.renderPlayerMarker(mapCtx, player.x * tileSize, player.y * tileSize, tileSize, player);

        mapCtx.strokeStyle = UI_VISUALS.mapPlayerOutline;
        mapCtx.beginPath();
        mapCtx.arc(player.x * tileSize + tileSize / 2, player.y * tileSize + tileSize / 2, Math.max(1, tileSize / 2 - 0.5), 0, Math.PI * 2);
        mapCtx.stroke();
    }
});
