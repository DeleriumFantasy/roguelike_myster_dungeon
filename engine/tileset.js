// Tileset management

class Tileset {
    constructor() {
        const spriteSheetConfig = this.getSpriteSheetConfig();
        this.sourceTileWidth = spriteSheetConfig.tileWidth;
        this.sourceTileHeight = spriteSheetConfig.tileHeight;
        this.spriteSheet = null;
    }

    getSpriteSheetConfig() {
        return {
            path: typeof TERRAIN_SPRITESHEET_PATH === 'string' ? TERRAIN_SPRITESHEET_PATH : 'assets/terrain.png',
            version: typeof TERRAIN_SPRITESHEET_VERSION === 'string' ? TERRAIN_SPRITESHEET_VERSION : '1',
            tileWidth: typeof TERRAIN_SPRITESHEET_TILE_SIZE === 'number' && Number.isFinite(TERRAIN_SPRITESHEET_TILE_SIZE)
                ? TERRAIN_SPRITESHEET_TILE_SIZE
                : 16,
            tileHeight: typeof TERRAIN_SPRITESHEET_TILE_HEIGHT === 'number' && Number.isFinite(TERRAIN_SPRITESHEET_TILE_HEIGHT)
                ? TERRAIN_SPRITESHEET_TILE_HEIGHT
                : 16
        };
    }

    isReady() {
        return this.spriteSheet !== null;
    }

    tryLoadExternalSpriteSheet(onLoad = null) {
        const image = new Image();
        const spriteSheetConfig = this.getSpriteSheetConfig();
        const versionedPath = `${spriteSheetConfig.path}?v=${encodeURIComponent(spriteSheetConfig.version)}`;
        image.onload = () => {
            this.spriteSheet = image;
            if (onLoad) onLoad();
        };
        image.onerror = () => {
            throw new Error(`Failed to load terrain spritesheet at ${spriteSheetConfig.path}.`);
        };
        image.src = versionedPath;
    }

    getTileSpriteData(tileType, world = null, x = null, y = null) {
        const visual = typeof getTileVisualAt === 'function'
            ? getTileVisualAt(tileType, world, x, y)
            : getTileVisual(tileType);
        const pos = visual.sprite;
        if (!pos) {
            throw new Error(`Unknown tile type for spritesheet lookup: ${tileType}`);
        }

        const sourceHeight = visual.sourceHeight || this.sourceTileHeight;
        const overdrawTop = visual.overdrawTop || 0;
        const sourceOffsetY = Number.isFinite(visual.sourceOffsetY) ? visual.sourceOffsetY : 0;

        return {
            pos,
            sourceHeight,
            overdrawTop,
            sourceOffsetY
        };
    }

    getRenderMetrics(tileType, targetTileSize, world = null, x = null, y = null) {
        const sourceRect = this.getSourceRect(tileType, world, x, y);
        const { overdrawTop } = this.getTileSpriteData(tileType, world, x, y);
        const overdrawRatio = overdrawTop / this.sourceTileWidth;
        const drawOffsetY = Math.round(targetTileSize * overdrawRatio);
        return {
            sourceRect,
            overdrawTop,
            drawOffsetY,
            drawHeight: targetTileSize + drawOffsetY
        };
    }

    getMapSourceRect(tileType, world = null, x = null, y = null) {
        const sourceRect = this.getSourceRect(tileType, world, x, y);
        const { overdrawTop } = this.getTileSpriteData(tileType, world, x, y);
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

    getSourceRect(tileType, world = null, x = null, y = null) {
        const { pos, sourceHeight, sourceOffsetY } = this.getTileSpriteData(tileType, world, x, y);
        return {
            x: pos.x * this.sourceTileWidth,
            y: pos.y * this.sourceTileHeight + sourceOffsetY,
            width: this.sourceTileWidth,
            height: sourceHeight
        };
    }
}