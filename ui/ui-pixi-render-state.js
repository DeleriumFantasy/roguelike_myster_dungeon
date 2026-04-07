// Shared Pixi render-state helpers.
//
// Builds one per-frame view of camera, floor, visibility, and actor state so
// individual render passes can stay focused on drawing rather than recomputing
// the same scene metadata repeatedly.

Object.assign(PixiSceneOverlay.prototype, {
    getRenderViewportSize() {
        let width = window.innerWidth;
        let height = window.innerHeight;

        if (this.hostElement?.parentElement) {
            width = this.hostElement.parentElement.offsetWidth || width;
            height = this.hostElement.parentElement.offsetHeight || height;
        }

        return { width, height };
    },

    buildRenderState(ui, world, player, fov, now = performance.now()) {
        const currentFloor = world.getCurrentFloor?.() || null;
        const tileSize = ui.getTileSize();
        const shouldUseFog = ui.shouldUseFogForFloor(world);
        const shouldHideUnseenTiles = ui.shouldHideUnseenTilesForFloor(world.currentFloor);

        return {
            ui,
            world,
            player,
            fov,
            now,
            currentFloor,
            tileSize,
            projection: ui.getPerspectiveMetrics(tileSize),
            shouldUseFog,
            shouldHideUnseenTiles,
            playerBlind: ui.isActorBlind(player),
            cameraBounds: { ...ui.cameraBounds },
            visibleActors: this.getVisibleActors(ui, world, player, fov)
        };
    },

    getVisibleActors(ui, world, player, fov) {
        if (ui.isActorBlind(player)) {
            return [];
        }

        const visibleActors = [player];
        for (const actor of world.getAllActors?.() || world.getEnemies?.() || []) {
            if (!actor || actor === player || !ui.isEnemyVisibleInFov(actor, fov)) {
                continue;
            }

            visibleActors.push(actor);
        }

        return visibleActors;
    },

    isTileRevealedInState(renderState, x, y) {
        return renderState.ui.isTileRevealed(x, y, renderState.fov, renderState.shouldHideUnseenTiles);
    },

    isTileVisibleInState(renderState, x, y) {
        return renderState.ui.isTileCurrentlyVisible(x, y, renderState.fov, renderState.shouldHideUnseenTiles);
    },

    getScreenPositionFromState(renderState, x, y) {
        return renderState.ui.worldToTopDownScreen(x, y);
    },

    getScreenCenterFromState(renderState, x, y) {
        const screenPos = this.getScreenPositionFromState(renderState, x, y);
        return {
            x: screenPos.x + renderState.tileSize / 2,
            y: screenPos.y + renderState.tileSize / 2
        };
    },

    clearSceneLayers() {
        this.clearDisplayContainer(this.terrainLayer);
        this.clearDisplayContainer(this.itemLayer);
        this.clearDisplayContainer(this.actorSpriteLayer);
        this.depthLayer.clear();
        this.shadowLayer.clear();
        this.actorLayer.clear();
        this.clearDisplayContainer(this.actorLabelLayer);
        this.clearDisplayContainer(this.overdrawLayer);
        this.gradingLayer.clear();
        this.lightingLayer.clear();
        this.atmosphereLayer.clear();
        this.effectLayer.clear();
        this.clearDisplayContainer(this.bannerLayer);
        this.minimapBackdrop.clear();
        this.minimapGraphics.clear();
        this.minimapLayer.visible = false;
    }
});