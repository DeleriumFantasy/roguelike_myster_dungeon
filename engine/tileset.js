// Tileset management

class Tileset {
    constructor() {
        const spriteSheetConfig = this.getSpriteSheetConfig();
        this.sourceTileWidth = spriteSheetConfig.tileWidth;
        this.sourceTileHeight = spriteSheetConfig.tileHeight;
        this.spriteSheet = null;
        this.spriteSheets = new Map();
    }

    getSpriteSheetConfig() {
        return this.getSpriteSheetConfigs().terrain;
    }

    getSpriteSheetConfigs() {
        const terrainTileWidth = typeof TERRAIN_SPRITESHEET_TILE_SIZE === 'number' && Number.isFinite(TERRAIN_SPRITESHEET_TILE_SIZE)
            ? TERRAIN_SPRITESHEET_TILE_SIZE
            : 16;
        const terrainTileHeight = typeof TERRAIN_SPRITESHEET_TILE_HEIGHT === 'number' && Number.isFinite(TERRAIN_SPRITESHEET_TILE_HEIGHT)
            ? TERRAIN_SPRITESHEET_TILE_HEIGHT
            : terrainTileWidth;

        const configs = {
            terrain: {
                key: 'terrain',
                path: typeof TERRAIN_SPRITESHEET_PATH === 'string' ? TERRAIN_SPRITESHEET_PATH : 'assets/terrain.png',
                version: typeof TERRAIN_SPRITESHEET_VERSION === 'string' ? TERRAIN_SPRITESHEET_VERSION : '1',
                tileWidth: terrainTileWidth,
                tileHeight: terrainTileHeight,
                spacing: typeof TERRAIN_SPRITESHEET_SPACING === 'number' && Number.isFinite(TERRAIN_SPRITESHEET_SPACING)
                    ? Math.max(0, Math.floor(TERRAIN_SPRITESHEET_SPACING))
                    : 0,
                margin: typeof TERRAIN_SPRITESHEET_MARGIN === 'number' && Number.isFinite(TERRAIN_SPRITESHEET_MARGIN)
                    ? Math.max(0, Math.floor(TERRAIN_SPRITESHEET_MARGIN))
                    : 0,
                enabled: true
            }
        };

        // Dynamically load sheet configs from situationed spritesheet families
        if (typeof SITUATIONED_SPRITESHEET_FAMILIES === 'object' && SITUATIONED_SPRITESHEET_FAMILIES !== null) {
            for (const [familyName, familyConfig] of Object.entries(SITUATIONED_SPRITESHEET_FAMILIES)) {
                if (!familyConfig || typeof familyConfig !== 'object') {
                    continue;
                }

                const tileSize = Number.isFinite(familyConfig.tileSize) ? familyConfig.tileSize : 24;
                const spacing = Number.isFinite(familyConfig.spacing) ? Math.max(0, Math.floor(familyConfig.spacing)) : 1;
                const margin = Number.isFinite(familyConfig.margin) ? Math.max(0, Math.floor(familyConfig.margin)) : 0;

                // Register wall sheet
                if (typeof familyConfig.wallSheetKey === 'string' && typeof familyConfig.wallSheetPath === 'string') {
                    configs[familyConfig.wallSheetKey] = {
                        key: familyConfig.wallSheetKey,
                        path: familyConfig.wallSheetPath,
                        version: typeof familyConfig.wallSheetVersion === 'string' ? familyConfig.wallSheetVersion : '1',
                        tileWidth: tileSize,
                        tileHeight: tileSize,
                        spacing: spacing,
                        margin: margin,
                        enabled: true
                    };
                }

                // Register ground sheet
                if (typeof familyConfig.groundSheetKey === 'string' && typeof familyConfig.groundSheetPath === 'string') {
                    configs[familyConfig.groundSheetKey] = {
                        key: familyConfig.groundSheetKey,
                        path: familyConfig.groundSheetPath,
                        version: typeof familyConfig.groundSheetVersion === 'string' ? familyConfig.groundSheetVersion : '1',
                        tileWidth: tileSize,
                        tileHeight: tileSize,
                        spacing: spacing,
                        margin: margin,
                        enabled: true
                    };
                }
            }
        }

        return configs;
    }

    isReady() {
        return this.spriteSheet !== null;
    }

    getSpriteSheet(key = 'terrain') {
        if (!this.spriteSheets.has(key)) {
            return null;
        }
        return this.spriteSheets.get(key);
    }

    getLoadedSpriteSheetEntries() {
        return Array.from(this.spriteSheets.entries());
    }

    resolveSpriteSheetConfig(key = 'terrain') {
        const configs = this.getSpriteSheetConfigs();
        return configs[key] || configs.terrain;
    }

    tryLoadExternalSpriteSheet(onLoad = null) {
        const allConfigs = Object.values(this.getSpriteSheetConfigs());
        const activeConfigs = allConfigs.filter((config) => config.enabled !== false);
        if (activeConfigs.length === 0) {
            if (onLoad) {
                onLoad();
            }
            return;
        }

        let pendingLoads = activeConfigs.length;
        const markLoaded = () => {
            pendingLoads -= 1;
            if (pendingLoads <= 0 && onLoad) {
                onLoad();
            }
        };

        for (const spriteSheetConfig of activeConfigs) {
            const image = new Image();
            const versionedPath = `${spriteSheetConfig.path}?v=${encodeURIComponent(spriteSheetConfig.version)}`;
            image.onload = () => {
                this.spriteSheets.set(spriteSheetConfig.key, image);
                if (spriteSheetConfig.key === 'terrain') {
                    this.spriteSheet = image;
                }
                markLoaded();
            };
            image.onerror = () => {
                if (spriteSheetConfig.key === 'terrain') {
                    throw new Error(`Failed to load terrain spritesheet at ${spriteSheetConfig.path}.`);
                }

                console.warn(`Failed to load optional spritesheet at ${spriteSheetConfig.path}.`);
                markLoaded();
            };
            image.src = versionedPath;
        }
    }

    getTileSpriteData(tileType, world = null, x = null, y = null) {
        const visual = typeof getTileVisualAt === 'function'
            ? getTileVisualAt(tileType, world, x, y)
            : getTileVisual(tileType);
        const pos = visual.sprite;
        if (!pos) {
            throw new Error(`Unknown tile type for spritesheet lookup: ${tileType}`);
        }

        const spriteSheetKey = typeof visual.spriteSheetKey === 'string' && visual.spriteSheetKey.length > 0
            ? visual.spriteSheetKey
            : 'terrain';
        const spriteSheetConfig = this.resolveSpriteSheetConfig(spriteSheetKey);
        const sourceTileWidth = Number.isFinite(spriteSheetConfig.tileWidth) ? spriteSheetConfig.tileWidth : this.sourceTileWidth;
        const sourceTileHeight = Number.isFinite(spriteSheetConfig.tileHeight) ? spriteSheetConfig.tileHeight : this.sourceTileHeight;

        const sourceHeight = visual.sourceHeight || sourceTileHeight;
        const overdrawTop = visual.overdrawTop || 0;
        const sourceOffsetY = Number.isFinite(visual.sourceOffsetY) ? visual.sourceOffsetY : 0;

        return {
            pos,
            sourceHeight,
            overdrawTop,
            sourceOffsetY,
            sourceTileWidth,
            sourceTileHeight,
            spriteSheetKey,
            spacing: Number.isFinite(spriteSheetConfig.spacing) ? spriteSheetConfig.spacing : 0,
            margin: Number.isFinite(spriteSheetConfig.margin) ? spriteSheetConfig.margin : 0
        };
    }

    getRenderMetrics(tileType, targetTileSize, world = null, x = null, y = null) {
        const sourceRect = this.getSourceRect(tileType, world, x, y);
        const tileSpriteData = this.getTileSpriteData(tileType, world, x, y);
        const { overdrawTop } = tileSpriteData;
        const overdrawRatio = overdrawTop / Math.max(1, tileSpriteData.sourceTileWidth);
        const drawOffsetY = Math.round(targetTileSize * overdrawRatio);
        return {
            sourceRect,
            overdrawTop,
            drawOffsetY,
            drawHeight: targetTileSize + drawOffsetY,
            spriteSheetKey: tileSpriteData.spriteSheetKey
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
        const {
            pos,
            sourceHeight,
            sourceOffsetY,
            sourceTileWidth,
            sourceTileHeight,
            spriteSheetKey,
            spacing,
            margin
        } = this.getTileSpriteData(tileType, world, x, y);

        // Detect if this is a situationed spritesheet (wall or ground variant)
        // by checking if the key starts with 'wall' or 'ground' (for family-based sheets)
        // or the legacy 'wallRuin'/'groundRuin' prefixes
        let isSituationedSheet = false;
        if (typeof spriteSheetKey === 'string') {
            isSituationedSheet = (
                spriteSheetKey.startsWith('wall') || 
                spriteSheetKey.startsWith('ground') ||
                spriteSheetKey.startsWith('wallRuin') || 
                spriteSheetKey.startsWith('groundRuin')
            );
            // Exclude 'terrain' sheets even if they start with 'ground' (e.g., groundRuin)
            if (spriteSheetKey === 'terrain') {
                isSituationedSheet = false;
            }
        }

        const bleedInset = isSituationedSheet ? 0.5 : 0;
        return {
            x: margin + pos.x * (sourceTileWidth + spacing) + bleedInset,
            y: margin + pos.y * (sourceTileHeight + spacing) + sourceOffsetY + bleedInset,
            width: Math.max(1, sourceTileWidth - bleedInset * 2),
            height: Math.max(1, sourceHeight - bleedInset * 2),
            spriteSheetKey
        };
    }
}