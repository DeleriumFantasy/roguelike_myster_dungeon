// Pixi-powered scene renderer: primary scene orchestrator.
//
// This layer owns the main scene whenever Pixi and the tileset are ready.
// Delegates rendering by subsystem (filters, sprites, layers, actors, effects, atmosphere)
// to focused extension files. PixiJS is now the sole renderer.

class PixiSceneOverlay {
    constructor(hostElement) {
        this.hostElement = hostElement;
        this.enabled = Boolean(hostElement && window.PIXI);
        this.app = null;
        this.scene = null;
        this.worldLayer = null;
        this.terrainLayer = null;
        this.itemLayer = null;
        this.shadowLayer = null;
        this.actorSpriteLayer = null;
        this.actorLayer = null;
        this.actorLabelLayer = null;
        this.gradingLayer = null;
        this.lightingLayer = null;
        this.atmosphereLayer = null;
        this.effectLayer = null;
        this.bannerLayer = null;
        this.minimapLayer = null;
        this.minimapBackdrop = null;
        this.minimapGraphics = null;
        this.baseTexture = null;
        this.textureCache = new Map();
        this.actorTextureCache = new Map();
        this.textStyleCache = new Map();
        this.worldColorMatrixFilter = null;
        this.atmosphereBlurFilter = null;
        this.lightingBlurFilter = null;
        this.currentWidth = 0;
        this.currentHeight = 0;

        if (!this.enabled) {
            return;
        }

        this.initialize();
    }

    applyCanvasStyles() {
        if (!this.app?.view) {
            return;
        }

        const viewStyle = this.app.view.style;
        viewStyle.position = 'fixed';
        viewStyle.top = '0';
        viewStyle.left = '0';
        viewStyle.width = '100%';
        viewStyle.height = '100%';
        viewStyle.zIndex = '2';
        viewStyle.pointerEvents = 'none';
        viewStyle.display = 'block';
        this.app.view.setAttribute('aria-hidden', 'true');
    }

    applyHostStyles() {
        if (!this.hostElement) {
            return;
        }

        const hostStyle = this.hostElement.style;
        hostStyle.position = 'absolute';
        hostStyle.top = '0';
        hostStyle.left = '0';
        hostStyle.width = '100%';
        hostStyle.height = '100%';
        hostStyle.zIndex = '2';
    }

    attachResizeHandler() {
        window.addEventListener('resize', () => {
            this.resize(window.innerWidth, window.innerHeight);
        });
    }

    createSceneLayers() {
        this.scene = new PIXI.Container();
        this.worldLayer = new PIXI.Container();
        this.terrainLayer = new PIXI.Container();
        this.itemLayer = new PIXI.Container();
        this.shadowLayer = new PIXI.Graphics();
        this.actorSpriteLayer = new PIXI.Container();
        this.actorLayer = new PIXI.Graphics();
        this.actorLabelLayer = new PIXI.Container();
        this.gradingLayer = new PIXI.Graphics();
        this.lightingLayer = new PIXI.Graphics();
        this.atmosphereLayer = new PIXI.Graphics();
        this.effectLayer = new PIXI.Graphics();
        this.bannerLayer = new PIXI.Container();
        this.minimapLayer = new PIXI.Container();
        this.minimapBackdrop = new PIXI.Graphics();
        this.minimapGraphics = new PIXI.Graphics();
    }

    appendSceneLayers() {
        this.worldLayer.addChild(this.terrainLayer);
        this.worldLayer.addChild(this.itemLayer);
        this.worldLayer.addChild(this.shadowLayer);
        this.worldLayer.addChild(this.actorSpriteLayer);
        this.worldLayer.addChild(this.actorLayer);
        this.worldLayer.addChild(this.actorLabelLayer);
        this.worldLayer.addChild(this.effectLayer);
        this.scene.addChild(this.worldLayer);
        this.scene.addChild(this.gradingLayer);
        this.scene.addChild(this.lightingLayer);
        this.scene.addChild(this.atmosphereLayer);
        this.scene.addChild(this.bannerLayer);
        this.minimapLayer.addChild(this.minimapBackdrop);
        this.minimapLayer.addChild(this.minimapGraphics);
        this.scene.addChild(this.minimapLayer);
        this.app.stage.addChild(this.scene);
        this.hostElement.appendChild(this.app.view);
    }

    initialize() {
        const resolution = window.devicePixelRatio;
        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundAlpha: 1, // Opaque for debug
            backgroundColor: 0x222244, // Visible color for debug
            antialias: false,
            autoDensity: true,
            resolution,
            autoStart: false,
            sharedTicker: false
        });

        // Render only when the UI requests it; avoid a constant 60 FPS redraw loop.
        this.app.stop();

        this.app.renderer.roundPixels = true;

        this.applyCanvasStyles();
        this.applyHostStyles();
        this.attachResizeHandler();
        this.resize(window.innerWidth, window.innerHeight);
        this.createSceneLayers();
        this.appendSceneLayers();
    }

    resize(width, height) {
        if (!this.enabled || !this.app) {
            return;
        }

        const normalizedWidth = Math.max(1, Math.floor(Number(width)));
        const normalizedHeight = Math.max(1, Math.floor(Number(height)));
        if (this.currentWidth === normalizedWidth && this.currentHeight === normalizedHeight) {
            return;
        }

        this.currentWidth = normalizedWidth;
        this.currentHeight = normalizedHeight;
        this.app.renderer.resize(normalizedWidth, normalizedHeight);
        this.hostElement.style.width = `${normalizedWidth}px`;
        this.hostElement.style.height = `${normalizedHeight}px`;
    }

    clearDisplayContainer(container) {
        if (!container || typeof container.removeChildren !== 'function') {
            return;
        }

        for (const child of container.removeChildren()) {
            this.reclaimDisplayObject(child);
        }
    }

    reclaimDisplayObject(child) {
        if (!child || !window.PIXI) {
            child?.destroy?.();
            return;
        }

        child.destroy?.({ children: true });
    }

    acquireSprite(texture = PIXI.Texture.EMPTY) {
        const sprite = new PIXI.Sprite(texture);
        sprite.texture = texture;
        sprite.visible = true;
        sprite.alpha = 1;
        sprite.rotation = 0;
        sprite.tint = 0xffffff;
        sprite.scale?.set?.(1, 1);
        sprite.anchor?.set?.(0, 0);
        return sprite;
    }

    acquireGraphics() {
        const graphics = new PIXI.Graphics();
        graphics.clear();
        graphics.visible = true;
        graphics.alpha = 1;
        graphics.rotation = 0;
        graphics.scale?.set?.(1, 1);
        return graphics;
    }

    getTextStyle(styleKey, options = {}) {
        let cacheKey = String(styleKey);
        try {
            cacheKey = `${cacheKey}:${JSON.stringify(options)}`;
        } catch (_error) {
            // Fall back to the plain key if the options object cannot be serialized.
        }

        if (!this.textStyleCache.has(cacheKey)) {
            this.textStyleCache.set(cacheKey, new PIXI.TextStyle(options));
        }

        return this.textStyleCache.get(cacheKey);
    }

    acquireText(styleKey, options, text = '') {
        const textNode = new PIXI.Text('', this.getTextStyle(styleKey, options));
        textNode.style = this.getTextStyle(styleKey, options);
        textNode.text = text;
        textNode.visible = true;
        textNode.alpha = 1;
        textNode.rotation = 0;
        textNode.scale?.set?.(1, 1);
        textNode.anchor?.set?.(0, 0);
        return textNode;
    }

    render(ui, world, player, fov) {
        if (!this.enabled || !this.app) {
            return;
        }

        const { width, height } = this.getRenderViewportSize();
        this.resize(width, height);
        this.clearSceneLayers();

        this.syncBaseTexture(ui);
        const renderState = this.buildRenderState(ui, world, player, fov);
        this.renderTerrain(renderState);
        this.renderItems(renderState);
        this.renderActorShadows(renderState);
        this.renderActors(renderState);
        this.renderTransientEffects(renderState);
        this.renderMinimap(renderState);

        this.app.render();
    }
}