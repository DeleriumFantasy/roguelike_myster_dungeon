// Pixi world layer rendering: terrain, items, and shadows.
//
// Manages rendering of the world foundation layers including tile sprites,
// hazard overlays, item indicators, and actor shadows.

Object.assign(PixiSceneOverlay.prototype, {
    getMinimapLayout() {
        const minimapVisuals = getMinimapVisuals();
        const viewportMin = Math.max(1, Math.min(this.currentWidth, this.currentHeight));
        const targetSize = Math.max(
            minimapVisuals.minSize,
            Math.min(
                minimapVisuals.maxSize,
                Math.floor(viewportMin * minimapVisuals.viewportScale)
            )
        );
        const cellSize = Math.max(2, Math.floor(targetSize / GRID_SIZE));
        const mapSize = cellSize * GRID_SIZE;
        const outerPadding = Math.max(0, minimapVisuals.outerPadding);
        const framePadding = Math.max(0, minimapVisuals.framePadding);

        return {
            cellSize,
            mapSize,
            framePadding,
            x: outerPadding,
            y: outerPadding
        };
    },

    isWalkableForMinimap(tileType, player) {
        if (!tileType || tileType === TILE_TYPES.WALL) {
            return false;
        }

        return Boolean(player.canTraverseHazardTile(tileType));
    },

    drawMinimapActorMarker(layout, actor, color) {
        if (!actor || !Number.isFinite(actor.x) || !Number.isFinite(actor.y)) {
            return;
        }

        const markerSize = Math.max(2, layout.cellSize);
        const origin = this.getMinimapTileOrigin(layout, actor.x, actor.y);
        this.minimapGraphics.beginFill(color, 1);
        this.minimapGraphics.drawRect(
            origin.x,
            origin.y,
            markerSize,
            markerSize
        );
        this.minimapGraphics.endFill();
    },

    getMinimapTileOrigin(layout, x, y) {
        return {
            x: layout.x + layout.framePadding + x * layout.cellSize,
            y: layout.y + layout.framePadding + y * layout.cellSize
        };
    },

    drawMinimapCell(layout, x, y, color, alpha) {
        const origin = this.getMinimapTileOrigin(layout, x, y);
        this.minimapGraphics.beginFill(color, alpha);
        this.minimapGraphics.drawRect(origin.x, origin.y, layout.cellSize, layout.cellSize);
        this.minimapGraphics.endFill();
    },

    drawMinimapCellMarker(layout, x, y, color, alpha = 0.95, scale = 0.7) {
        const origin = this.getMinimapTileOrigin(layout, x, y);
        const markerSize = Math.max(1, Math.ceil(layout.cellSize * scale));
        this.minimapGraphics.beginFill(color, alpha);
        this.minimapGraphics.drawRect(origin.x, origin.y, markerSize, markerSize);
        this.minimapGraphics.endFill();
    },

    drawMinimapTrapMarker(layout, x, y, color) {
        const trapMarker = getMinimapVisuals().markers.trap;
        const origin = this.getMinimapTileOrigin(layout, x, y);
        const inset = Math.max(trapMarker.minInset, layout.cellSize * trapMarker.insetScale);
        const minX = origin.x + inset;
        const minY = origin.y + inset;
        const maxX = origin.x + layout.cellSize - inset;
        const maxY = origin.y + layout.cellSize - inset;

        this.minimapGraphics.lineStyle(trapMarker.lineWidth, color, trapMarker.alpha);
        this.minimapGraphics.moveTo(minX, minY);
        this.minimapGraphics.lineTo(maxX, maxY);
        this.minimapGraphics.moveTo(maxX, minY);
        this.minimapGraphics.lineTo(minX, maxY);
        this.minimapGraphics.lineStyle(0, 0, 0);
    },

    drawMinimapStairMarker(layout, x, y, tileType) {
        const stairMarker = getMinimapVisuals().markers.stairs;
        const origin = this.getMinimapTileOrigin(layout, x, y);
        const centerX = origin.x + layout.cellSize / 2;
        const inset = Math.max(stairMarker.minInset, layout.cellSize * stairMarker.insetScale);
        const minX = origin.x + inset;
        const maxX = origin.x + layout.cellSize - inset;
        const minY = origin.y + inset;
        const maxY = origin.y + layout.cellSize - inset;
        const points = tileType === TILE_TYPES.STAIRS_DOWN
            ? [
                minX, minY,
                maxX, minY,
                centerX, maxY
            ]
            : [
                centerX, minY,
                minX, maxY,
                maxX, maxY
            ];

        this.minimapGraphics.beginFill(stairMarker.color, stairMarker.alpha);
        this.minimapGraphics.drawPolygon(points);
        this.minimapGraphics.endFill();
    },

    isSeenOpenMinimapNeighbor(renderState, world, x, y) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
            return false;
        }

        if (!this.isTileRevealedInState(renderState, x, y)) {
            return false;
        }

        return world.getTile(x, y) !== TILE_TYPES.WALL;
    },

    drawMinimapWallEdges(renderState, world, layout) {
        const wallVisuals = getMinimapVisuals().walls;
        this.minimapGraphics.lineStyle(wallVisuals.lineWidth, wallVisuals.color, wallVisuals.alpha);
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (!this.isTileRevealedInState(renderState, x, y) || world.getTile(x, y) !== TILE_TYPES.WALL) {
                    continue;
                }

                const leftIsOpen = this.isSeenOpenMinimapNeighbor(renderState, world, x - 1, y);
                const rightIsOpen = this.isSeenOpenMinimapNeighbor(renderState, world, x + 1, y);
                const topIsOpen = this.isSeenOpenMinimapNeighbor(renderState, world, x, y - 1);
                const bottomIsOpen = this.isSeenOpenMinimapNeighbor(renderState, world, x, y + 1);

                const origin = this.getMinimapTileOrigin(layout, x, y);
                const left = origin.x;
                const top = origin.y;
                const right = left + layout.cellSize;
                const bottom = top + layout.cellSize;

                if (leftIsOpen) {
                    this.minimapGraphics.moveTo(left + 0.5, top + 0.5);
                    this.minimapGraphics.lineTo(left + 0.5, bottom + 0.5);
                }

                if (rightIsOpen) {
                    this.minimapGraphics.moveTo(right - 0.5, top + 0.5);
                    this.minimapGraphics.lineTo(right - 0.5, bottom + 0.5);
                }

                if (topIsOpen) {
                    this.minimapGraphics.moveTo(left + 0.5, top + 0.5);
                    this.minimapGraphics.lineTo(right + 0.5, top + 0.5);
                }

                if (bottomIsOpen) {
                    this.minimapGraphics.moveTo(left + 0.5, bottom - 0.5);
                    this.minimapGraphics.lineTo(right + 0.5, bottom - 0.5);
                }
            }
        }
        this.minimapGraphics.lineStyle(0, 0, 0);
    },

    renderMinimapTerrain(renderState, world, player, layout, minimapVisuals) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (!this.isTileRevealedInState(renderState, x, y)) {
                    continue;
                }

                const tileType = world.getTile(x, y);
                if (!this.isWalkableForMinimap(tileType, player)) {
                    continue;
                }

                const isVisible = this.isTileVisibleInState(renderState, x, y);
                const tileColor = isVisible ? minimapVisuals.tileColors.visible : minimapVisuals.tileColors.explored;
                const tileAlpha = isVisible ? minimapVisuals.visibleTileAlpha : minimapVisuals.exploredTileAlpha;
                this.drawMinimapCell(layout, x, y, tileColor, tileAlpha);

                if (tileType === TILE_TYPES.STAIRS_DOWN || tileType === TILE_TYPES.STAIRS_UP) {
                    this.drawMinimapStairMarker(layout, x, y, tileType);
                }
            }
        }
    },

    renderMinimapItems(renderState, layout, markerVisuals) {
        const floorItems = renderState.currentFloor.items;
        if (!floorItems) {
            return;
        }

        for (const [key] of floorItems) {
            const [x, y] = fromGridKey(key);
            if (!this.isTileRevealedInState(renderState, x, y)) {
                continue;
            }

            this.drawMinimapCellMarker(layout, x, y, markerVisuals.color, markerVisuals.alpha, markerVisuals.scale);
        }
    },

    shouldRenderMinimapTrap(renderState, world, playerHasTrapSight, x, y) {
        return playerHasTrapSight
            ? this.isTileRevealedInState(renderState, x, y)
            : world.isTrapRevealed(x, y);
    },

    renderMinimapTraps(renderState, world, layout, markerVisuals, playerHasTrapSight) {
        const floorTraps = renderState.currentFloor.traps;
        if (!floorTraps) {
            return;
        }

        for (const [key] of floorTraps) {
            const [x, y] = fromGridKey(key);
            if (!this.shouldRenderMinimapTrap(renderState, world, playerHasTrapSight, x, y)) {
                continue;
            }

            this.drawMinimapTrapMarker(layout, x, y, markerVisuals.color);
        }
    },

    renderMinimapWalkedTiles(renderState, world, layout, minimapVisuals, phase = 'after') {
        if (world.getAreaType(world.currentFloor) === AREA_TYPES.OVERWORLD) {
            return;
        }

        const walkedTiles = world.getFloorSet('walkedTiles');
        if (!(walkedTiles instanceof Set) || walkedTiles.size === 0) {
            return;
        }

        const walkedColor = minimapVisuals.tileColors.walked;
        for (const key of walkedTiles) {
            const [x, y] = fromGridKey(key);
            if (!this.isTileRevealedInState(renderState, x, y)) {
                continue;
            }

            const isVisible = this.isTileVisibleInState(renderState, x, y);
            if (phase === 'before' && !isVisible) {
                continue;
            }
            if (phase === 'after' && isVisible) {
                continue;
            }

            const tileType = world.getTile(x, y);
            if (!this.isWalkableForMinimap(tileType, renderState.player)) {
                continue;
            }

            this.drawMinimapCell(layout, x, y, walkedColor, minimapVisuals.walkedTileAlpha);
        }
    },

    renderMinimapActors(renderState, layout, minimapVisuals) {
        const { ui, world, player, fov } = renderState;
        const markers = minimapVisuals.markers;

        const enemies = world.getEnemies();
        if (Array.isArray(enemies)) {
            for (const enemy of enemies) {
                if (!enemy || enemy.isAlly || !ui.isEnemyVisibleInFov(enemy, fov)) {
                    continue;
                }

                this.drawMinimapActorMarker(layout, enemy, markers.enemy.color);
            }
        }

        const allies = ui.getPlayerAllies(player, { aliveOnly: true });
        if (Array.isArray(allies)) {
            for (const ally of allies) {
                if (!ally) {
                    continue;
                }

                this.drawMinimapActorMarker(layout, ally, markers.ally.color);
            }
        }

        this.drawMinimapActorMarker(layout, player, markers.player.color);
    },

    renderMinimap(renderState) {
        if (!this.minimapLayer || !this.minimapGraphics) {
            return;
        }

        const { world, player } = renderState;
        const layout = this.getMinimapLayout();
        if (this.minimapBackdrop) {
            this.minimapBackdrop.visible = false;
        }

        const minimapVisuals = getMinimapVisuals();
        const playerHasTrapSight = player.revealsTraps();

        this.renderMinimapWalkedTiles(renderState, world, layout, minimapVisuals, 'before');
        this.renderMinimapTerrain(renderState, world, player, layout, minimapVisuals);
        this.renderMinimapWalkedTiles(renderState, world, layout, minimapVisuals, 'after');
        this.drawMinimapWallEdges(renderState, world, layout);
        this.renderMinimapItems(renderState, layout, minimapVisuals.markers.item);
        this.renderMinimapTraps(renderState, world, layout, minimapVisuals.markers.trap, playerHasTrapSight);
        this.renderMinimapActors(renderState, layout, minimapVisuals);
        this.minimapLayer.visible = true;
    },

    getTileMarkerStyle(kind, size) {
        const safeSize = Math.max(1, Math.floor(Number(size)));

        if (kind === 'shop') {
            return {
                inset: 1,
                lineWidth: Math.max(1, Math.round(safeSize * 0.08)),
                fillAlphaVisible: 0.28,
                fillAlphaHidden: 0.16,
                fontSize: Math.max(10, Math.floor(safeSize * 0.72)),
                fontWeight: '700',
                yOffset: 0
            };
        }

        return {
            inset: 1,
            backdropAlphaMultiplier: 1,
            fontSize: Math.max(8, Math.floor(safeSize * 0.55)),
            fontWeight: '700',
            yOffset: 0
        };
    },

    renderCenteredTileLabel(cacheKey, label, x, y, size, style = {}) {
        const text = this.acquireText(cacheKey, {
            fontFamily: 'monospace',
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fill: style.fill,
            align: 'center'
        }, label);
        text.anchor.set(0.5, 0.5);
        text.x = x + size / 2;
        text.y = y + size / 2 - Number(style.yOffset);
        this.terrainLayer.addChild(text);
        return text;
    },

    getInsetRectBounds(x, y, size, inset, minimumSize = 2) {
        return {
            x: x + inset,
            y: y + inset,
            width: Math.max(minimumSize, size - inset * 2),
            height: Math.max(minimumSize, size - inset * 2)
        };
    },

    renderOverlayRect(layer, options = {}) {
        const graphics = this.acquireGraphics();
        const {
            x = 0,
            y = 0,
            width = 0,
            height = 0,
            fillColor = null,
            fillAlpha = 1,
            lineColor = null,
            lineAlpha = 1,
            lineWidth = 0
        } = options;

        if (lineColor !== null && lineWidth > 0) {
            graphics.lineStyle(lineWidth, lineColor, lineAlpha);
        }
        if (fillColor !== null) {
            graphics.beginFill(fillColor, fillAlpha);
        }

        graphics.drawRect(x, y, width, height);

        if (fillColor !== null) {
            graphics.endFill();
        }
        layer.addChild(graphics);
        return graphics;
    },

    getOrCreateFilledBatch(existingBatch, cssColor) {
        if (existingBatch) {
            return existingBatch;
        }

        const batch = this.acquireGraphics();
        const parsedColor = this.parseCssColor(cssColor);
        batch.beginFill(parsedColor.color, parsedColor.alpha);
        return batch;
    },

    createTerrainTileSprite(tile, metrics, screenPos, tileSize, texture) {
        const sprite = this.acquireSprite(texture);
        sprite.x = screenPos.x;
        sprite.y = screenPos.y - metrics.drawOffsetY;
        sprite.width = tileSize;
        sprite.height = metrics.drawHeight;
        sprite.tint = tile === TILE_TYPES.SHOP ? 0xd9485f : 0xffffff;
        return sprite;
    },

    drawSteamPuffs(steamGraphics, x, y, size) {
        const centers = [
            { x: x + size * 0.3, y: y + size * 0.35, r: size * 0.16 },
            { x: x + size * 0.55, y: y + size * 0.28, r: size * 0.18 },
            { x: x + size * 0.48, y: y + size * 0.55, r: size * 0.2 }
        ];

        for (const puff of centers) {
            steamGraphics.drawCircle(puff.x, puff.y, puff.r);
        }
    },

    drawItemBatchMarker(itemBatch, bounds, color, alpha) {
        itemBatch.beginFill(color, alpha);
        itemBatch.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
        itemBatch.endFill();
    },

    renderShopTileMarker(x, y, size, isVisible) {
        const style = this.getTileMarkerStyle('shop', size);
        const bounds = this.getInsetRectBounds(x, y, size, style.inset);
        this.renderOverlayRect(this.terrainLayer, {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            fillColor: 0x7f1d1d,
            fillAlpha: isVisible ? style.fillAlphaVisible : style.fillAlphaHidden,
            lineColor: 0xffd166,
            lineAlpha: isVisible ? 0.9 : 0.55,
            lineWidth: style.lineWidth
        });

        this.renderCenteredTileLabel('shop-tile', '$', x, y, size, {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fill: '#ffe08a',
            yOffset: style.yOffset
        });
    },

    renderTrapTileMarker(ui, trapType, x, y, size) {
        const icon = getTrapDefinition(trapType).icon;
        if (!icon) {
            return;
        }

        const style = this.getTileMarkerStyle('trap', size);
        const backdrop = this.parseCssColor(UI_VISUALS.trapBackdrop);
        const bounds = this.getInsetRectBounds(x, y, size, style.inset);
        this.renderOverlayRect(this.terrainLayer, {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            fillColor: backdrop.color,
            fillAlpha: backdrop.alpha * style.backdropAlphaMultiplier
        });

        this.renderCenteredTileLabel('trap-icon', icon, x, y, size, {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fill: UI_VISUALS.trapIcon,
            yOffset: style.yOffset
        });
    },

    renderTerrain(renderState) {
        const { ui, world, fov, tileSize, shouldUseFog, cameraBounds } = renderState;
        if (!ui.tileset.isReady() || !this.baseTexture) {
            return;
        }
        const { minX, maxX, minY, maxY } = cameraBounds;
        let fogOverlayBatch = null;
        let steamOverlayBatch = null;

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (!this.isTileRevealedInState(renderState, x, y)) {
                    continue;
                }

                const tile = world.getTile(x, y);
                const overlays = ui.getTileOverlayData(world, x, y);
                const metrics = ui.tileset.getRenderMetrics(tile, tileSize, world, x, y);
                const screenPos = this.getScreenPositionFromState(renderState, x, y);
                const isVisible = this.isTileVisibleInState(renderState, x, y);
                const spriteSheetKey = metrics.sourceRect.spriteSheetKey;
                const texture = this.getTextureForRect(metrics.sourceRect, spriteSheetKey);
                if (!texture) {
                    continue;
                }

                const sprite = this.createTerrainTileSprite(tile, metrics, screenPos, tileSize, texture);
                this.terrainLayer.addChild(sprite);

                if (tile === TILE_TYPES.SHOP) {
                    this.renderShopTileMarker(screenPos.x, screenPos.y, tileSize, isVisible);
                }

                this.renderTileOverlays(ui, overlays, screenPos.x, screenPos.y, tileSize, {
                    steamOverlayBatch: () => {
                        steamOverlayBatch = this.getOrCreateFilledBatch(steamOverlayBatch, COLORS.STEAM);
                        return steamOverlayBatch;
                    }
                });

                if (shouldUseFog && !isVisible && fov.isExplored(x, y)) {
                    fogOverlayBatch = this.getOrCreateFilledBatch(fogOverlayBatch, COLORS.FOG_OVERLAY);
                    fogOverlayBatch.drawRect(screenPos.x, screenPos.y - metrics.drawOffsetY, tileSize, metrics.drawHeight);
                }
            }
        }

        if (fogOverlayBatch) {
            fogOverlayBatch.endFill();
            this.terrainLayer.addChild(fogOverlayBatch);
        }

        if (steamOverlayBatch) {
            steamOverlayBatch.endFill();
            this.terrainLayer.addChild(steamOverlayBatch);
        }
    },

    renderTileOverlays(ui, overlays, x, y, size, overlayBatches = null) {
        if (overlays.hazard === HAZARD_TYPES.STEAM) {
            const isBatchedSteam = Boolean(overlayBatches && typeof overlayBatches.steamOverlayBatch === 'function');
            const steam = isBatchedSteam
                ? overlayBatches.steamOverlayBatch()
                : this.acquireGraphics();

            if (!isBatchedSteam) {
                const steamColor = this.parseCssColor(COLORS.STEAM);
                steam.beginFill(steamColor.color, steamColor.alpha);
            }

            this.drawSteamPuffs(steam, x, y, size);

            if (!isBatchedSteam) {
                steam.endFill();
                this.terrainLayer.addChild(steam);
            }
        }

        if (overlays.trapType && overlays.trapRevealed) {
            this.renderTrapTileMarker(ui, overlays.trapType, x, y, size, false);
        }
    },

    renderItems(renderState) {
        const { ui, world, tileSize, shouldUseFog, currentFloor } = renderState;
        const itemVisual = getEntityVisual('item');
        let itemBatch = null;

        const floorItems = currentFloor.items;
        if (!floorItems) {
            return;
        }

        for (const [key] of floorItems) {
            const [x, y] = fromGridKey(key);
            if (!ui.isInCameraBounds(x, y)) {
                continue;
            }

            const isVisible = this.isTileVisibleInState(renderState, x, y);
            if (!this.isTileRevealedInState(renderState, x, y)) {
                continue;
            }

            const screenPos = this.getScreenPositionFromState(renderState, x, y);
            const inset = Math.max(1, Math.round(tileSize * 0.25));
            const bounds = this.getInsetRectBounds(screenPos.x, screenPos.y, tileSize, inset);
            const itemType = ui.getItemTypeAt(world, x, y);
            const alpha = shouldUseFog ? (isVisible ? COLORS.VISIBLE : COLORS.EXPLORED) : 1;
            if (!itemBatch) {
                itemBatch = this.acquireGraphics();
            }

            this.drawItemBatchMarker(
                itemBatch,
                bounds,
                this.toPixiColor(getItemTypeColor(itemType, itemVisual.color)),
                alpha
            );
        }

        if (itemBatch) {
            this.itemLayer.addChild(itemBatch);
        }
    },

    renderActorShadows(renderState) {
        const { tileSize, visibleActors } = renderState;
        const sideWidth = Math.max(3, Math.round(tileSize * 0.18));

        this.shadowLayer.beginFill(0x0f1720, 0.22);
        for (const actor of visibleActors) {
            if (!renderState.ui.isInCameraBounds(actor.x, actor.y)) {
                continue;
            }

            const center = this.getScreenCenterFromState(renderState, actor.x, actor.y);
            const radiusX = Math.max(2, tileSize * 0.3 + sideWidth * 0.12);
            const radiusY = Math.max(2, tileSize * 0.14);
            this.shadowLayer.drawEllipse(
                center.x + sideWidth * 0.55,
                center.y + tileSize * 0.3,
                radiusX,
                radiusY
            );
        }
        this.shadowLayer.endFill();
    }
});
