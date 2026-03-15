// Tileset management

class Tileset {
    constructor() {
        this.sourceTileWidth = TERRAIN_SPRITESHEET_TILE_SIZE;
        this.sourceTileHeight = TERRAIN_SPRITESHEET_TILE_HEIGHT;
        this.tiles = Object.fromEntries(Object.entries(TILE_VISUALS).map(([tileType, visual]) => [tileType, visual.sprite]));
        this.spriteSheet = null;
    }

    isReady() {
        return this.spriteSheet !== null;
    }

    tryLoadExternalSpriteSheet(onLoad = null) {
        const image = new Image();
        const versionedPath = `${TERRAIN_SPRITESHEET_PATH}?v=${encodeURIComponent(TERRAIN_SPRITESHEET_VERSION)}`;
        image.onload = () => {
            this.spriteSheet = image;
            if (onLoad) onLoad();
        };
        image.onerror = () => {
            throw new Error(`Failed to load terrain spritesheet at ${TERRAIN_SPRITESHEET_PATH}.`);
        };
        image.src = versionedPath;
    }

    getTileSpriteData(tileType) {
        const pos = this.tiles[tileType];
        if (!pos) {
            throw new Error(`Unknown tile type for spritesheet lookup: ${tileType}`);
        }

        const visual = getTileVisual(tileType);
        const sourceHeight = visual.sourceHeight || this.sourceTileWidth;
        const overdrawTop = visual.overdrawTop || 0;
        const sourceOffsetY = Number.isFinite(visual.sourceOffsetY) ? visual.sourceOffsetY : 0;

        return {
            pos,
            sourceHeight,
            overdrawTop,
            sourceOffsetY
        };
    }

    getRenderMetrics(tileType, targetTileSize) {
        const sourceRect = this.getSourceRect(tileType);
        const { overdrawTop } = this.getTileSpriteData(tileType);
        const overdrawRatio = overdrawTop / this.sourceTileWidth;
        const drawOffsetY = Math.round(targetTileSize * overdrawRatio);
        return {
            sourceRect,
            overdrawTop,
            drawOffsetY,
            drawHeight: targetTileSize + drawOffsetY
        };
    }

    getMapSourceRect(tileType) {
        const sourceRect = this.getSourceRect(tileType);
        const { overdrawTop } = this.getTileSpriteData(tileType);
        if (overdrawTop <= 0) {
            return sourceRect;
        }
        return {
            x: sourceRect.x,
            y: sourceRect.y + overdrawTop,
            width: sourceRect.width,
            height: sourceRect.height - overdrawTop
        };
    }

    getSourceRect(tileType) {
        const { pos, sourceHeight, sourceOffsetY } = this.getTileSpriteData(tileType);
        return {
            x: pos.x * this.sourceTileWidth,
            y: pos.y * this.sourceTileHeight + sourceOffsetY,
            width: this.sourceTileWidth,
            height: sourceHeight
        };
    }
}