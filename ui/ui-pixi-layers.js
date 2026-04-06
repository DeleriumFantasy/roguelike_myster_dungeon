// Pixi world layer rendering: terrain, items, depth cues, and shadows.
//
// Manages rendering of the world foundation layers including tile sprites,
// hazard overlays, item indicators, depth cues for walls, and actor shadows.

Object.assign(PixiSceneOverlay.prototype, {
    getTileMarkerStyle(kind, size, isMapView = false) {
        const safeSize = Math.max(1, Math.floor(Number(size) || 1));

        if (kind === 'shop') {
            return isMapView
                ? {
                    inset: Math.max(1, Math.round(safeSize * 0.1)),
                    lineWidth: Math.max(1, Math.round(safeSize * 0.05)),
                    fillAlphaVisible: 0.18,
                    fillAlphaHidden: 0.1,
                    fontSize: Math.max(2, Math.floor(safeSize * 0.28)),
                    fontWeight: '600',
                    yOffset: 0
                }
                : {
                    inset: 1,
                    lineWidth: Math.max(1, Math.round(safeSize * 0.08)),
                    fillAlphaVisible: 0.28,
                    fillAlphaHidden: 0.16,
                    fontSize: Math.max(10, Math.floor(safeSize * 0.72)),
                    fontWeight: '700',
                    yOffset: 0
                };
        }

        return isMapView
            ? {
                inset: Math.max(1, Math.round(safeSize * 0.12)),
                backdropAlphaMultiplier: 0.7,
                fontSize: Math.max(2, Math.floor(safeSize * 0.28)),
                fontWeight: '600',
                yOffset: Math.max(0, safeSize * 0.02)
            }
            : {
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
            fontWeight: style.fontWeight || '700',
            fill: style.fill || '#ffffff',
            align: 'center'
        }, label);
        text.anchor.set(0.5, 0.5);
        text.x = x + size / 2;
        text.y = y + size / 2 - Number(style.yOffset || 0);
        this.terrainLayer.addChild(text);
        return text;
    },

    renderShopTileMarker(x, y, size, isVisible, isMapView = false) {
        const style = this.getTileMarkerStyle('shop', size, isMapView);
        const shopOverlay = this.acquireGraphics();
        shopOverlay.lineStyle(style.lineWidth, 0xffd166, isVisible ? 0.9 : 0.55);
        shopOverlay.beginFill(0x7f1d1d, isVisible ? style.fillAlphaVisible : style.fillAlphaHidden);
        shopOverlay.drawRect(
            x + style.inset,
            y + style.inset,
            Math.max(2, size - style.inset * 2),
            Math.max(2, size - style.inset * 2)
        );
        shopOverlay.endFill();
        this.terrainLayer.addChild(shopOverlay);

        this.renderCenteredTileLabel('shop-tile', '$', x, y, size, {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fill: '#ffe08a',
            yOffset: style.yOffset
        });
    },

    renderTrapTileMarker(ui, trapType, x, y, size, isMapView = false) {
        const icon = ui.getTrapIcon(trapType);
        if (!icon) {
            return;
        }

        const style = this.getTileMarkerStyle('trap', size, isMapView);
        const trapBackdrop = this.acquireGraphics();
        const backdrop = this.parseCssColor(UI_VISUALS.trapBackdrop, 0x000000);
        trapBackdrop.beginFill(backdrop.color, backdrop.alpha * style.backdropAlphaMultiplier);
        trapBackdrop.drawRect(
            x + style.inset,
            y + style.inset,
            Math.max(2, size - style.inset * 2),
            Math.max(2, size - style.inset * 2)
        );
        trapBackdrop.endFill();
        this.terrainLayer.addChild(trapBackdrop);

        this.renderCenteredTileLabel('trap-icon', icon, x, y, size, {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fill: UI_VISUALS.trapIcon,
            yOffset: style.yOffset
        });
    },

    renderTerrain(renderState) {
        // ...existing code...
        const { ui, world, fov, tileSize, shouldUseFog, cameraBounds, projection } = renderState;
        if (!ui.tileset?.isReady?.() || !this.baseTexture) {
            return;
        }
        const { minX, maxX, minY, maxY } = cameraBounds;

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
                const wallLift = tile === TILE_TYPES.WALL ? (projection?.wallLift || 0) : 0;
                const wallOverhangHeight = tile === TILE_TYPES.WALL && wallLift > 0
                    ? Math.max(wallLift, Math.round(tileSize * 0.32))
                    : 0;
                const overdrawSourceHeight = metrics.overdrawTop > 0
                    ? metrics.overdrawTop
                    : (wallOverhangHeight > 0
                        ? Math.max(1, Math.min(metrics.sourceRect.height, Math.round(metrics.sourceRect.height * 0.35)))
                        : 0);
                const overdrawRenderHeight = overdrawSourceHeight > 0
                    ? Math.max(metrics.overdrawTop + wallLift, wallOverhangHeight)
                    : 0;
                const texture = this.getTextureForRect(metrics.sourceRect);
                if (texture) {
                    const sprite = this.acquireSprite(texture);
                    sprite.x = screenPos.x;
                    sprite.y = screenPos.y - metrics.drawOffsetY - wallLift;
                    sprite.width = tileSize;
                    sprite.height = metrics.drawHeight + wallLift;
                    sprite.tint = tile === TILE_TYPES.SHOP ? 0xd9485f : 0xffffff;
                    this.terrainLayer.addChild(sprite);
                } else {
                    // Fallback: draw a red rectangle if no texture is found
                    const fallback = this.acquireGraphics();
                    fallback.beginFill(0xff2222, 0.7);
                    fallback.drawRect(screenPos.x, screenPos.y - metrics.drawOffsetY - wallLift, tileSize, metrics.drawHeight + wallLift);
                    fallback.endFill();
                    this.terrainLayer.addChild(fallback);
                }

                if (tile === TILE_TYPES.SHOP) {
                    this.renderShopTileMarker(screenPos.x, screenPos.y, tileSize, isVisible, Boolean(ui.mapOpen));
                }

                this.renderTileOverlays(ui, overlays, screenPos.x, screenPos.y, tileSize);

                if (shouldUseFog && !isVisible && fov.isExplored(x, y)) {
                    const fogOverlay = this.acquireGraphics();
                    const fogColor = this.parseCssColor(COLORS.FOG_OVERLAY, 0x646464);
                    fogOverlay.beginFill(fogColor.color, fogColor.alpha);
                    fogOverlay.drawRect(screenPos.x, screenPos.y - metrics.drawOffsetY - wallLift, tileSize, metrics.drawHeight + wallLift);
                    fogOverlay.endFill();
                    this.terrainLayer.addChild(fogOverlay);
                }

                if (isVisible && overdrawRenderHeight > 0) {
                    const overdrawTexture = this.getTextureForRect({
                        x: metrics.sourceRect.x,
                        y: metrics.sourceRect.y,
                        width: metrics.sourceRect.width,
                        height: overdrawSourceHeight
                    });
                    if (overdrawTexture) {
                        const overdrawSprite = this.acquireSprite(overdrawTexture);
                        overdrawSprite.x = screenPos.x;
                        overdrawSprite.y = screenPos.y - metrics.drawOffsetY - wallLift;
                        overdrawSprite.width = tileSize;
                        overdrawSprite.height = overdrawRenderHeight;
                        this.overdrawLayer.addChild(overdrawSprite);
                    }
                }
            }
        }
    },

    renderTileOverlays(ui, overlays, x, y, size) {
        if (overlays?.hazard === HAZARD_TYPES.STEAM) {
            const steam = this.acquireGraphics();
            const steamColor = this.parseCssColor(COLORS.STEAM, 0xdcdcdc);
            steam.beginFill(steamColor.color, steamColor.alpha);
            const centers = [
                { x: x + size * 0.3, y: y + size * 0.35, r: size * 0.16 },
                { x: x + size * 0.55, y: y + size * 0.28, r: size * 0.18 },
                { x: x + size * 0.48, y: y + size * 0.55, r: size * 0.2 }
            ];
            for (const puff of centers) {
                steam.drawCircle(puff.x, puff.y, puff.r);
            }
            steam.endFill();
            this.terrainLayer.addChild(steam);
        }

        if (overlays?.trapType && overlays?.trapRevealed) {
            this.renderTrapTileMarker(ui, overlays.trapType, x, y, size, Boolean(ui.mapOpen));
        }
    },

    renderItems(renderState) {
        const { ui, world, tileSize, shouldUseFog, currentFloor } = renderState;
        const itemVisual = getEntityVisual('item');

        for (const [key] of currentFloor?.items || []) {
            const [x, y] = ui.parseGridKey(key);
            if (!ui.isInCameraBounds(x, y)) {
                continue;
            }

            const isVisible = this.isTileVisibleInState(renderState, x, y);
            if (!this.isTileRevealedInState(renderState, x, y)) {
                continue;
            }

            const screenPos = this.getScreenPositionFromState(renderState, x, y);
            const inset = ui.mapOpen
                ? Math.max(1, Math.round(tileSize * 0.28))
                : Math.max(1, Math.round(tileSize * 0.25));
            const itemType = ui.getItemTypeAt(world, x, y);
            const alpha = shouldUseFog ? ui.getVisibilityAlpha(isVisible) : 1;
            const item = this.acquireGraphics();
            item.beginFill(this.toPixiColor(getItemTypeColor(itemType, itemVisual.color)), alpha);
            item.drawRect(
                screenPos.x + inset,
                screenPos.y + inset,
                tileSize - inset * 2,
                tileSize - inset * 2
            );
            item.endFill();
            this.itemLayer.addChild(item);
        }
    },

    renderDepth(renderState) {
        const { world, tileSize, cameraBounds, projection } = renderState;
        const { minX, maxX, minY, maxY } = cameraBounds;
        const depthHeight = Math.max(4, Math.round(tileSize * 0.22 + (projection?.wallLift || 0) * 0.5));
        const sideWidth = Math.max(3, Math.round(tileSize * 0.18));

        this.depthLayer.beginFill(0x0f1720, 0.28);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (world.getTile(x, y) !== TILE_TYPES.WALL) {
                    continue;
                }

                if (!this.isTileRevealedInState(renderState, x, y)) {
                    continue;
                }

                const screen = this.getScreenPositionFromState(renderState, x, y);
                const rightTile = x + 1 < GRID_SIZE ? world.getTile(x + 1, y) : TILE_TYPES.WALL;
                const bottomTile = y + 1 < GRID_SIZE ? world.getTile(x, y + 1) : TILE_TYPES.WALL;

                if (rightTile !== TILE_TYPES.WALL) {
                    this.depthLayer.drawPolygon([
                        screen.x + tileSize, screen.y,
                        screen.x + tileSize + sideWidth, screen.y + depthHeight,
                        screen.x + tileSize + sideWidth, screen.y + tileSize + depthHeight,
                        screen.x + tileSize, screen.y + tileSize
                    ]);
                }

                if (bottomTile !== TILE_TYPES.WALL) {
                    this.depthLayer.drawPolygon([
                        screen.x, screen.y + tileSize,
                        screen.x + tileSize, screen.y + tileSize,
                        screen.x + tileSize + sideWidth, screen.y + tileSize + depthHeight,
                        screen.x + sideWidth, screen.y + tileSize + depthHeight
                    ]);
                }
            }
        }

        this.depthLayer.endFill();
    },

    renderActorShadows(renderState) {
        const { tileSize, visibleActors, projection } = renderState;
        const depthHeight = Math.max(4, Math.round(tileSize * 0.22 + (projection?.wallLift || 0) * 0.5));
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
                center.y + tileSize * 0.28 + depthHeight * 0.35,
                radiusX,
                radiusY
            );
        }
        this.shadowLayer.endFill();
    }
});
