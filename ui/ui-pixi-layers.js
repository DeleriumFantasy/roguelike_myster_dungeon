// Pixi world layer rendering: terrain, items, depth cues, and shadows.
//
// Manages rendering of the world foundation layers including tile sprites,
// hazard overlays, item indicators, depth cues for walls, and actor shadows.

Object.assign(PixiSceneOverlay.prototype, {
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
                    const shopOverlay = this.acquireGraphics();
                    shopOverlay.lineStyle(Math.max(1, Math.round(tileSize * 0.08)), 0xffd166, isVisible ? 0.9 : 0.55);
                    shopOverlay.beginFill(0x7f1d1d, isVisible ? 0.28 : 0.16);
                    shopOverlay.drawRect(screenPos.x + 1, screenPos.y + 1, Math.max(2, tileSize - 2), Math.max(2, tileSize - 2));
                    shopOverlay.endFill();
                    this.terrainLayer.addChild(shopOverlay);

                    const shopText = this.acquireText('shop-tile', {
                        fontFamily: 'monospace',
                        fontSize: Math.max(8, Math.floor(tileSize * 0.58)),
                        fontWeight: '700',
                        fill: '#ffe08a',
                        align: 'center'
                    }, '$');
                    shopText.anchor.set(0.5, 0.5);
                    shopText.x = screenPos.x + tileSize / 2;
                    shopText.y = screenPos.y + tileSize / 2;
                    this.terrainLayer.addChild(shopText);
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
            const trapBackdrop = this.acquireGraphics();
            const backdrop = this.parseCssColor(UI_VISUALS.trapBackdrop, 0x000000);
            trapBackdrop.beginFill(backdrop.color, backdrop.alpha);
            trapBackdrop.drawRect(x + 1, y + 1, size - 2, size - 2);
            trapBackdrop.endFill();
            this.terrainLayer.addChild(trapBackdrop);

            const icon = ui.getTrapIcon(overlays.trapType);
            if (icon) {
                const text = this.acquireText('trap-icon', {
                    fontFamily: 'monospace',
                    fontSize: Math.max(8, Math.floor(size * 0.55)),
                    fontWeight: '700',
                    fill: UI_VISUALS.trapIcon,
                    align: 'center'
                }, icon);
                text.anchor.set(0.5, 0.5);
                text.x = x + size / 2;
                text.y = y + size / 2;
                this.terrainLayer.addChild(text);
            }
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
            const inset = Math.max(1, Math.round(tileSize * 0.25));
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
