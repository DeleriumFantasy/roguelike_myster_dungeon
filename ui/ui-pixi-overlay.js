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
        this.depthLayer = null;
        this.shadowLayer = null;
        this.actorSpriteLayer = null;
        this.actorLayer = null;
        this.actorLabelLayer = null;
        this.overdrawLayer = null;
        this.gradingLayer = null;
        this.lightingLayer = null;
        this.atmosphereLayer = null;
        this.effectLayer = null;
        this.bannerLayer = null;
        this.minimapLayer = null;
        this.minimapBackdrop = null;
        this.minimapGraphics = null;
        this.baseTexture = null;
        this.boundSpriteSheet = null;
        this.textureCache = new Map();
        this.actorTextureCache = new Map();
        this.textStyleCache = new Map();
        this.spritePool = [];
        this.graphicsPool = [];
        this.textPool = [];
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

    initialize() {
        const resolution = window.devicePixelRatio || 1;
        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundAlpha: 1, // Opaque for debug
            backgroundColor: 0x222244, // Visible color for debug
            antialias: true,
            autoDensity: true,
            resolution
        });

        // Make sure the canvas and host always fill the viewport
        this.app.view.style.position = 'fixed';
        this.app.view.style.top = '0';
        this.app.view.style.left = '0';
        this.app.view.style.width = '100vw';
        this.app.view.style.height = '100vh';
        this.app.view.style.zIndex = '2';

        if (this.hostElement) {
            this.hostElement.style.position = 'fixed';
            this.hostElement.style.top = '0';
            this.hostElement.style.left = '0';
            this.hostElement.style.width = '100vw';
            this.hostElement.style.height = '100vh';
            this.hostElement.style.zIndex = '2';
        }

        this.app.view.setAttribute('aria-hidden', 'true');
        this.app.view.style.pointerEvents = 'none';
        this.app.view.style.display = 'block';
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
        // Ensure #pixi-overlay fills the parent
        if (this.hostElement) {
            this.hostElement.style.position = 'absolute';
            this.hostElement.style.top = '0';
            this.hostElement.style.left = '0';
            this.hostElement.style.width = '100%';
            this.hostElement.style.height = '100%';
            this.hostElement.style.zIndex = '2';
        }

        // Add window resize event to always fill the window
        window.addEventListener('resize', () => {
            // Always use the full viewport
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.resize(width, height);
        });

        // Force initial resize
        let width = window.innerWidth, height = window.innerHeight;
        // Always use the full viewport
        this.resize(width, height);

        this.scene = new PIXI.Container();
        this.worldLayer = new PIXI.Container();
        this.terrainLayer = new PIXI.Container();
        this.itemLayer = new PIXI.Container();
        this.depthLayer = new PIXI.Graphics();
        this.shadowLayer = new PIXI.Graphics();
        this.actorSpriteLayer = new PIXI.Container();
        this.actorLayer = new PIXI.Graphics();
        this.actorLabelLayer = new PIXI.Container();
        this.overdrawLayer = new PIXI.Container();
        this.gradingLayer = new PIXI.Graphics();
        this.lightingLayer = new PIXI.Graphics();
        this.atmosphereLayer = new PIXI.Graphics();
        this.effectLayer = new PIXI.Graphics();
        this.bannerLayer = new PIXI.Container();
        this.minimapLayer = new PIXI.Container();
        this.minimapBackdrop = new PIXI.Graphics();
        this.minimapGraphics = new PIXI.Graphics();

        this.worldLayer.addChild(this.terrainLayer);
        this.worldLayer.addChild(this.itemLayer);
        this.worldLayer.addChild(this.depthLayer);
        this.worldLayer.addChild(this.shadowLayer);
        this.worldLayer.addChild(this.actorSpriteLayer);
        this.worldLayer.addChild(this.actorLayer);
        this.worldLayer.addChild(this.actorLabelLayer);
        this.worldLayer.addChild(this.overdrawLayer);
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

    resize(width, height) {
        if (!this.enabled || !this.app) {
            return;
        }

        const normalizedWidth = Math.max(1, Math.floor(Number(width) || 1));
        const normalizedHeight = Math.max(1, Math.floor(Number(height) || 1));
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

        if (child instanceof PIXI.Text) {
            child.text = '';
            child.visible = true;
            child.alpha = 1;
            child.rotation = 0;
            child.scale?.set?.(1, 1);
            child.anchor?.set?.(0, 0);
            this.textPool.push(child);
            return;
        }

        if (child instanceof PIXI.Sprite) {
            child.texture = PIXI.Texture.EMPTY;
            child.visible = true;
            child.alpha = 1;
            child.rotation = 0;
            child.tint = 0xffffff;
            child.width = 0;
            child.height = 0;
            child.scale?.set?.(1, 1);
            child.anchor?.set?.(0, 0);
            this.spritePool.push(child);
            return;
        }

        if (child instanceof PIXI.Graphics) {
            child.clear();
            child.visible = true;
            child.alpha = 1;
            child.rotation = 0;
            child.scale?.set?.(1, 1);
            this.graphicsPool.push(child);
            return;
        }

        child.destroy?.({ children: true });
    }

    acquireSprite(texture = PIXI.Texture.EMPTY) {
        const sprite = this.spritePool.pop() || new PIXI.Sprite(texture);
        sprite.texture = texture || PIXI.Texture.EMPTY;
        sprite.visible = true;
        sprite.alpha = 1;
        sprite.rotation = 0;
        sprite.tint = 0xffffff;
        sprite.scale?.set?.(1, 1);
        sprite.anchor?.set?.(0, 0);
        return sprite;
    }

    acquireGraphics() {
        const graphics = this.graphicsPool.pop() || new PIXI.Graphics();
        graphics.clear();
        graphics.visible = true;
        graphics.alpha = 1;
        graphics.rotation = 0;
        graphics.scale?.set?.(1, 1);
        return graphics;
    }

    getTextStyle(styleKey, options) {
        if (!this.textStyleCache.has(styleKey)) {
            this.textStyleCache.set(styleKey, new PIXI.TextStyle(options));
        }

        return this.textStyleCache.get(styleKey);
    }

    acquireText(styleKey, options, text = '') {
        const textNode = this.textPool.pop() || new PIXI.Text('', this.getTextStyle(styleKey, options));
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
        // ...existing code...
        if (!this.enabled || !this.app || !ui || !world || !player || !fov || !ui.shouldRenderSceneWithPixi()) {
            return;
        }

        const { width, height } = this.getRenderViewportSize();
        this.resize(width, height);
        this.clearSceneLayers();

        this.syncBaseTexture(ui);
        const renderState = this.buildRenderState(ui, world, player, fov);
        this.renderTerrain(renderState);
        this.renderItems(renderState);
        this.renderDepth(renderState);
        this.renderActorShadows(renderState);
        this.renderActors(renderState);
        this.renderTransientEffects(renderState);
    }
}