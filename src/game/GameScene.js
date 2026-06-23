(() => {
  window.TechnoDash = window.TechnoDash || {};

  class GameScene extends Phaser.Scene {
    constructor() {
      super({ key: "GameScene" });
      this.levelData = window.TechnoDash.Level.getDefaultData();
      this.uiCallbacks = {};
      this.created = false;
      this.running = false;
      this.ended = false;
      this.status = "Ready";
      this.distance = 0;
      this.score = 0;
      this.reachedFinish = false;
      this.spaceWasDown = false;
      this.restartWasDown = false;
      this.jumpQueued = false;
      this.jumpQueuedAt = 0;
      this.jumpQueuedFrameId = 0;
      this.jumpLockedUntil = 0;
      this.restartQueued = false;
      this.restartQueuedInput = "";
      this.restartLockedUntil = 0;
      this.restartHeldAtEnd = { space: false, enter: false, r: false };
      this.jumpBufferMs = 120;
      this.coyoteMs = 70;
      this.maxFrameDeltaMs = 50;
      this.maxPhysicsStepMs = 1000 / 60;
      this.lastGroundedTime = 0;
      this.lastUpdateTime = 0;
      this.frameHadJumpPress = false;
      this.frameScreenObjects = null;
      this.frameDecorations = null;
      this.frameScreenObjectsScrollX = null;
      this.frameDecorationsScrollX = null;
      this.updateFrameId = 0;
      this.staticWorldDirty = true;
      this.staticWorldSignature = "";
      this.lastStatsPublishTime = 0;
      this.statsPublishIntervalMs = 80;
      this.lastPublishedStats = null;
      this.performanceProfile = GameScene.createPerformanceProfile();
      this.levelLoadToken = 0;
      this.keyState = {
        space: false,
        enter: false,
        r: false
      };
      this.pendingPlay = false;
      this.programFeatures = GameScene.createProgramFeatures({ activeBlockIds: [] });
      this.decorSprites = new Map();
      this.blockTextureSprites = new Map();
      this.groundTextureSprite = null;
      this.effectParticles = [];
      this.endAnimationPlayed = false;
      this.endPlayerHidden = false;
      this.activatedGravitySwitchIds = new Set();
      this.activatedObjectIds = new Set();
      this.disabledObjectIds = new Set();
      this.speedBoostUntil = 0;
      this.speedMultiplier = 1;
      this.runElapsedMs = 0;
      this.adaptiveQualityLevel = 0;
      this.slowFrameMs = 0;
      this.fastFrameMs = 0;
      this.inputListenersAttached = false;
      this.handleGlobalKeydown = null;
      this.handleGlobalKeyup = null;
      this.handleGlobalBlur = null;
      this.handleGlobalVisibilityChange = null;
      this.handleGlobalPageHide = null;
    }

    static createProgramFeatures(programState) {
      const blockIds = programState && Array.isArray(programState.activeBlockIds)
        ? programState.activeBlockIds
        : [];
      const blockSections = programState && programState.blockSections && typeof programState.blockSections === "object"
        ? programState.blockSections
        : {};
      const active = new Set(blockIds);
      const initializationBlocks = blockIds.filter((id) => GameScene.getProgramSection(id, blockSections) === "initialization");
      const gameplayBlocks = blockIds.filter((id) => GameScene.getProgramSection(id, blockSections) === "gameplay");
      const loopIndex = gameplayBlocks.indexOf("loop");
      const loopBlocks = loopIndex === -1 ? [] : gameplayBlocks.slice(loopIndex + 1);
      const loopSet = new Set(loopBlocks);
      const actionConditions = {};
      loopBlocks.forEach((blockId, actionIndex) => {
        if (GameScene.isConditionBlock(blockId) || actionConditions[blockId]) {
          return;
        }

        const conditions = [];
        for (let index = actionIndex - 1; index >= 0; index -= 1) {
          const conditionId = loopBlocks[index];
          if (!GameScene.isConditionBlock(conditionId)) {
            break;
          }

          conditions.unshift(conditionId);
        }

        actionConditions[blockId] = conditions;
      });

      return {
        active,
        initializationBlocks,
        gameplayBlocks,
        loopBlocks,
        loopSet,
        actionConditions,
        hasLoop: loopIndex !== -1,
        background: active.has("addBackground"),
        player: active.has("addPlayer"),
        ground: active.has("addGround"),
        obstacles: active.has("addObstacles"),
        decorations: active.has("addDecorations"),
        finish: active.has("addFinish")
      };
    }

    static getProgramSection(blockId, blockSections) {
      if (blockSections[blockId]) {
        return blockSections[blockId];
      }

      return GameScene.isInitializationBlock(blockId) ? "initialization" : "gameplay";
    }

    static isInitializationBlock(blockId) {
      return ["setSpeed", "setGravity", "setJumpForce", "addBackground", "addPlayer", "addGround", "addObstacles", "addDecorations", "addFinish"].includes(blockId);
    }

    static isConditionBlock(blockId) {
      return ["spacePressed", "playerGrounded", "hitObstacle", "reachFinish"].includes(blockId);
    }

    static createPerformanceProfile(profile = {}) {
      const lowDetail = Boolean(profile.lowDetail);
      return {
        lowDetail,
        showGrid: Object.prototype.hasOwnProperty.call(profile, "showGrid") ? Boolean(profile.showGrid) : true,
        renderDecorations: Object.prototype.hasOwnProperty.call(profile, "renderDecorations") ? Boolean(profile.renderDecorations) : true,
        maxVisibleDecorations: Number.isFinite(Number(profile.maxVisibleDecorations))
          ? Math.max(0, Math.floor(Number(profile.maxVisibleDecorations)))
          : Infinity,
        gridStep: Number.isFinite(Number(profile.gridStep))
          ? Math.max(1, Math.floor(Number(profile.gridStep)))
          : 1,
        renderScale: Number.isFinite(Number(profile.renderScale))
          ? Math.min(1, Math.max(0.25, Number(profile.renderScale)))
          : 1,
        logicalWidth: Number.isFinite(Number(profile.logicalWidth)) ? Number(profile.logicalWidth) : 0,
        logicalHeight: Number.isFinite(Number(profile.logicalHeight)) ? Number(profile.logicalHeight) : 0,
        useDecorationAtlas: Boolean(profile.useDecorationAtlas),
        adaptiveQuality: Boolean(profile.adaptiveQuality)
      };
    }

    static getBlockTextureKey(type) {
      return `block-texture-${type}`;
    }

    static getBlockTexturePath(type) {
      const paths = {
        solidBlock: "assets/tiles/metal-block-32.png?v=generated-metal-block-1",
        dirtBlock: "assets/tiles/dirt-block-32.png?v=generated-grass-dirt-2",
        iceBlock: "assets/tiles/ice-block-32.png?v=generated-ice-1"
      };
      return paths[type] || "";
    }

    static getGroundTextureKey(theme = "dirt") {
      return `ground-texture-${window.TechnoDash.Level.normalizeGroundTheme(theme)}`;
    }

    static getGroundTexturePath(theme = "dirt") {
      const paths = {
        dirt: "assets/tiles/ground-dirt-32.png?v=generated-ground-dirt-1",
        ice: "assets/tiles/ground-ice-32.png?v=generated-ground-ice-1",
        metal: "assets/tiles/ground-metal-32.png?v=generated-ground-metal-1"
      };
      return paths[window.TechnoDash.Level.normalizeGroundTheme(theme)] || paths.dirt;
    }

    static isTexturedBlockType(type) {
      return Boolean(GameScene.getBlockTexturePath(type));
    }

    preload() {
      ["solidBlock", "dirtBlock", "iceBlock"].forEach((type) => {
        this.load.image(GameScene.getBlockTextureKey(type), GameScene.getBlockTexturePath(type));
      });
      window.TechnoDash.Level.getGroundThemes().forEach((theme) => {
        this.load.image(GameScene.getGroundTextureKey(theme.id), GameScene.getGroundTexturePath(theme.id));
      });
    }

    static getDecorationTextureKey(type) {
      return `decor-${type}`;
    }

    static getDecorationAtlasKey(theme) {
      return `decor-atlas-${theme}`;
    }

    static getDecorationAtlasPath(theme, extension) {
      return `assets/decor-atlas/decor-${theme}.${extension}`;
    }

    create() {
      this.worldWidth = this.performanceProfile.logicalWidth || this.scale.width;
      this.worldHeight = this.performanceProfile.logicalHeight || this.scale.height;
      this.tileSize = window.TechnoDash.Level.getTileSize();
      this.ceilingY = 0;
      this.groundY = this.worldHeight - this.tileSize;
      this.playerX = this.tileSize * 3 + this.tileSize / 2;
      this.cameras.main.setZoom(this.performanceProfile.renderScale);
      this.level = new window.TechnoDash.Level(this.levelData);
      this.backgroundGraphics = this.add.graphics();
      this.backgroundGraphics.setDepth(0);
      this.gridGraphics = this.add.graphics();
      this.gridGraphics.setDepth(0.5);
      this.levelGraphics = this.add.graphics();
      this.levelGraphics.setDepth(2);
      this.effectsGraphics = this.add.graphics();
      this.effectsGraphics.setDepth(12);
      this.player = new window.TechnoDash.Player(this, this.playerX, this.groundY, this.ceilingY);
      this.syncProgramVisuals();
      this.attachGlobalInputListeners();
      const disposeSceneResources = () => {
        this.detachGlobalInputListeners();
        this.clearDecorationSprites();
        this.clearBlockTextureSprites();
        this.clearGroundTextureSprite();
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, disposeSceneResources);
      this.events.once(Phaser.Scenes.Events.DESTROY || "destroy", disposeSceneResources);

      this.created = true;
      const levelLoadToken = this.levelLoadToken;
      this.loadMissingDecorationTextures(this.levelData, () => {
        if (levelLoadToken !== this.levelLoadToken) {
          return;
        }

        this.reset(this.pendingPlay);
        this.pendingPlay = false;
      });
    }

    setCallbacks(callbacks) {
      this.uiCallbacks = callbacks || {};
      this.publishState({ force: true });
    }

    attachGlobalInputListeners() {
      if (this.inputListenersAttached) {
        return;
      }

      this.handleGlobalKeydown = (event) => this.onGlobalKeydown(event);
      this.handleGlobalKeyup = (event) => this.onGlobalKeyup(event);
      this.handleGlobalBlur = () => this.resetInputState();
      this.handleGlobalVisibilityChange = () => {
        if (document.hidden) {
          this.resetInputState();
        }
      };
      this.handleGlobalPageHide = () => this.resetInputState();

      window.addEventListener("keydown", this.handleGlobalKeydown);
      window.addEventListener("keyup", this.handleGlobalKeyup);
      window.addEventListener("blur", this.handleGlobalBlur);
      window.addEventListener("pagehide", this.handleGlobalPageHide);
      document.addEventListener("visibilitychange", this.handleGlobalVisibilityChange);
      this.inputListenersAttached = true;
    }

    detachGlobalInputListeners() {
      if (!this.inputListenersAttached) {
        this.resetInputState();
        return;
      }

      window.removeEventListener("keydown", this.handleGlobalKeydown);
      window.removeEventListener("keyup", this.handleGlobalKeyup);
      window.removeEventListener("blur", this.handleGlobalBlur);
      window.removeEventListener("pagehide", this.handleGlobalPageHide);
      document.removeEventListener("visibilitychange", this.handleGlobalVisibilityChange);
      this.inputListenersAttached = false;
      this.resetInputState();
    }

    setPerformanceProfile(profile = {}) {
      this.performanceProfile = GameScene.createPerformanceProfile(profile);
      this.adaptiveQualityLevel = 0;
      this.slowFrameMs = 0;
      this.fastFrameMs = 0;
      this.staticWorldDirty = true;
    }

    setProgramState(programState) {
      this.programFeatures = GameScene.createProgramFeatures(programState);
      this.staticWorldDirty = true;
      this.invalidateFrameCache();

      if (!this.created) {
        return;
      }

      this.syncProgramVisuals();
      if (!this.isPlaying()) {
        this.reset(false);
      } else {
        this.renderWorld();
        this.publishState({ force: true });
      }
    }

    syncProgramVisuals() {
      if (this.player && this.player.sprite) {
        this.player.sprite.setVisible(this.programFeatures.player && !this.endPlayerHidden);
      }
    }

    loadLevel(levelData, options = {}) {
      this.levelData = window.TechnoDash.Level.normalize(levelData);
      this.staticWorldDirty = true;
      this.levelLoadToken += 1;
      const levelLoadToken = this.levelLoadToken;

      if (!this.created) {
        this.pendingPlay = Boolean(options.play);
        return;
      }

      this.level = new window.TechnoDash.Level(this.levelData);
      this.invalidateFrameCache();
      this.loadMissingDecorationTextures(this.levelData, () => {
        if (levelLoadToken !== this.levelLoadToken) {
          return;
        }

        this.reset(Boolean(options.play));
      });
    }

    getDecorationTypesForLevel(levelData = this.levelData) {
      if (!this.performanceProfile.renderDecorations) {
        return [];
      }

      const data = window.TechnoDash.Level.normalize(levelData);
      const types = new Set();
      data.decorations.forEach((decoration) => {
        if (decoration && window.TechnoDash.Level.getDecorationForType(decoration.type)) {
          types.add(decoration.type);
        }
      });

      return [...types];
    }

    getDecorationThemesForLevel(levelData = this.levelData) {
      const themes = new Set();
      this.getDecorationTypesForLevel(levelData).forEach((type) => {
        const decoration = window.TechnoDash.Level.getDecorationForType(type);
        if (decoration && decoration.theme) {
          themes.add(decoration.theme);
        }
      });

      return [...themes];
    }

    loadMissingDecorationTextures(levelData, onReady) {
      const ready = typeof onReady === "function" ? onReady : () => {};
      if (!this.load || !this.performanceProfile.renderDecorations) {
        ready();
        return;
      }

      if (typeof this.load.isLoading === "function" && this.load.isLoading()) {
        this.load.once("complete", () => this.loadMissingDecorationTextures(levelData, ready));
        return;
      }

      const missingDecorations = this.getMissingDecorationAssets(levelData);

      if (!missingDecorations.length) {
        ready();
        return;
      }

      const onError = (file) => {
        const src = file && file.src ? file.src : file;
        console.warn("Decoration texture failed to load", src);
      };

      const onComplete = () => {
        this.load.off("loaderror", onError);
        ready();
      };

      this.load.once("complete", onComplete);
      this.load.on("loaderror", onError);
      missingDecorations.forEach((asset) => {
        if (asset.kind === "atlas") {
          this.load.atlas(asset.key, asset.imagePath, asset.dataPath);
          return;
        }

        this.load.image(asset.key, asset.imagePath);
      });
      this.load.start();
    }

    getMissingDecorationAssets(levelData) {
      if (this.performanceProfile.useDecorationAtlas) {
        return this.getDecorationThemesForLevel(levelData)
          .map((theme) => ({
            kind: "atlas",
            key: GameScene.getDecorationAtlasKey(theme),
            imagePath: GameScene.getDecorationAtlasPath(theme, "png"),
            dataPath: GameScene.getDecorationAtlasPath(theme, "json")
          }))
          .filter((asset) => !this.textures.exists(asset.key));
      }

      return this.getDecorationTypesForLevel(levelData)
        .map((type) => window.TechnoDash.Level.getDecorationForType(type))
        .filter((decoration) => decoration && !this.textures.exists(GameScene.getDecorationTextureKey(decoration.type)))
        .map((decoration) => ({
          kind: "image",
          key: GameScene.getDecorationTextureKey(decoration.type),
          imagePath: `assets/decor/${decoration.file}`
        }));
    }

    play() {
      if (!this.created) {
        return;
      }

      if (this.ended) {
        if (this.isRestartInputLocked()) {
          return;
        }
        this.reset(true);
        return;
      }

      this.running = true;
      this.status = "Playing";
      this.publishState({ force: true });
    }

    stop() {
      this.running = false;
      this.status = this.ended ? this.status : "Paused";
      this.publishState({ force: true });
    }

    reset(shouldPlay) {
      this.scrollX = 0;
      this.invalidateFrameCache();
      this.clearDecorationSprites();
      this.distance = 0;
      this.score = 0;
      this.reachedFinish = false;
      this.ended = false;
      this.running = Boolean(shouldPlay);
      this.status = shouldPlay ? "Playing" : "Ready";
      this.activatedGravitySwitchIds.clear();
      this.activatedObjectIds.clear();
      this.disabledObjectIds.clear();
      this.speedBoostUntil = 0;
      this.speedMultiplier = 1;
      this.runElapsedMs = 0;
      this.effectParticles = [];
      this.endAnimationPlayed = false;
      this.endPlayerHidden = false;
      this.spaceWasDown = false;
      this.restartWasDown = false;
      this.restartQueuedInput = "";
      this.restartLockedUntil = 0;
      this.jumpLockedUntil = 0;
      this.clearRestartHeldInputs();
      this.resetInputState();
      this.lastGroundedTime = this.getCurrentTimeMs();
      this.staticWorldDirty = true;
      this.player.reset(this.getRuntimeSettings());
      this.renderWorld();
      this.publishState({ force: true });
    }

    isPlaying() {
      return this.running && !this.ended;
    }

    update(time, deltaMs) {
      if (!this.created) {
        return;
      }

      this.lastUpdateTime = time;
      this.updateFrameId += 1;
      this.beginFrameCache();

      const keyboardBlocked = this.shouldIgnoreGameKeyboard();
      if (keyboardBlocked) {
        this.restartQueued = false;
        this.clearJumpRequest();
        this.clearKeyState();
      }

      this.updateRestartInputLock(time);

      const restartInput = keyboardBlocked ? "" : this.getActiveRestartInputId();
      const restartDown = Boolean(restartInput);
      const queuedRestartReady = this.restartQueued
        && this.canAcceptRestartInput(this.restartQueuedInput, time);
      if (this.restartQueued && !queuedRestartReady && this.isRestartCooldownLocked(time)) {
        this.restartQueued = false;
        this.restartQueuedInput = "";
      }
      const edgeRestartReady = restartDown
        && !this.restartWasDown
        && this.canAcceptRestartInput(restartInput, time);
      const restartTriggered = edgeRestartReady || queuedRestartReady;
      if (restartTriggered) {
        this.restartFromInput(restartDown, queuedRestartReady ? this.restartQueuedInput : restartInput);
        return;
      }
      this.restartQueued = false;
      this.restartWasDown = restartDown;

      const spaceDown = keyboardBlocked ? false : this.keyState.space;
      if (!this.running || this.ended) {
        const idleDeltaMs = Math.max(0, Math.min(Number(deltaMs) || 0, this.maxFrameDeltaMs));
        this.updateEffectParticles(idleDeltaMs);
        if (this.effectParticles.length) {
          this.renderWorld();
        }
        this.spaceWasDown = spaceDown;
        this.expireJumpRequest(time);
        this.frameHadJumpPress = false;
        return;
      }

      const settings = this.getRuntimeSettings();
      if (spaceDown && !this.spaceWasDown) {
        this.requestJump(time);
      }
      this.frameHadJumpPress = this.hasBufferedJump(time);

      const totalDeltaMs = Math.max(0, Math.min(Number(deltaMs) || 0, this.maxFrameDeltaMs));
      this.updateAdaptivePerformance(totalDeltaMs);
      this.runElapsedMs += totalDeltaMs;
      const stepCount = Math.max(1, Math.ceil(totalDeltaMs / this.maxPhysicsStepMs));
      const stepMs = totalDeltaMs / stepCount;
      const stepSeconds = stepMs / 1000;

      for (let step = 0; step < stepCount; step += 1) {
        if (!this.running || this.ended) {
          break;
        }

        const stepTime = time - totalDeltaMs + stepMs * (step + 1);
        if (this.player.grounded) {
          this.lastGroundedTime = stepTime;
        }

        this.tryRunBufferedJump(settings, stepTime);

        const previousScrollX = this.scrollX;
        if (this.hasLoopBlock("moveLevel")) {
          this.scrollX += this.getCurrentRunSpeed(settings, stepTime) * stepSeconds;
          this.invalidateFrameCache();
        }

        const applyGravity = this.hasLoopBlock("applyGravity");
        const playerIsMoving = this.player.velocityY !== 0 || !this.player.grounded;
        if (this.programFeatures.player && (applyGravity || playerIsMoving)) {
          const previousPlayerBounds = this.player.getBounds();
          this.player.update(stepSeconds, settings, { applyGravity });
          if (this.resolvePlatformCollisions(previousPlayerBounds) || this.player.grounded) {
            this.lastGroundedTime = stepTime;
          }
          this.applyGameplayInteractions(settings, stepTime);
          this.tryRunBufferedJump(settings, stepTime);
        }

        const inputContext = this.getInputContext(stepTime);
        const reachedFinish = this.checkFinishCollision(inputContext);
        const playerStoppedByLevel = reachedFinish
          ? false
          : this.resolveSolidBlockSideCollisions(previousScrollX);

        if (reachedFinish) {
          // Victory has priority when the cube reaches the finish on the same frame as another collision.
          break;
        }

        if (playerStoppedByLevel) {
          this.endGame("Game Over");
          break;
        }

        this.checkCollisions(inputContext);
      }

      this.expireJumpRequest(time);
      this.spaceWasDown = spaceDown;
      this.distance = Math.max(0, Math.floor(this.scrollX));
      this.score = this.distance;
      this.updateEffectParticles(totalDeltaMs);
      this.frameHadJumpPress = false;
      this.renderWorld();
      this.publishState({ time });
    }

    restartFromInput(restartDown, inputId = "") {
      if (this.ended && !this.canAcceptRestartInput(inputId)) {
        this.restartQueued = false;
        this.restartQueuedInput = "";
        return;
      }

      const spaceDown = Boolean(this.keyState.space);
      this.restartQueued = false;
      this.restartQueuedInput = "";
      this.reset(true);
      this.restartWasDown = Boolean(restartDown);
      this.spaceWasDown = spaceDown;
      this.keyState.space = spaceDown;
      this.clearJumpRequest();
    }

    queueJump() {
      if (!this.created) {
        return;
      }

      if (this.ended) {
        this.queueRestart("pointer");
        return;
      }

      this.requestJump(this.getCurrentTimeMs());
    }

    queueRestart(inputId = "button") {
      if (!this.created) {
        return;
      }

      if (this.ended && !this.canAcceptRestartInput(inputId)) {
        return;
      }

      this.restartQueued = true;
      this.restartQueuedInput = inputId;
    }

    getCurrentTimeMs() {
      if (Number.isFinite(this.lastUpdateTime) && this.lastUpdateTime > 0) {
        return this.lastUpdateTime;
      }

      const loopNow = this.game && this.game.loop ? Number(this.game.loop.now) : 0;
      return Number.isFinite(loopNow) ? loopNow : 0;
    }

    requestJump(timeMs = this.getCurrentTimeMs()) {
      if (this.isJumpInputLocked(timeMs)) {
        return false;
      }

      this.jumpQueued = true;
      this.jumpQueuedAt = Number.isFinite(timeMs) ? timeMs : this.getCurrentTimeMs();
      this.jumpQueuedFrameId = this.updateFrameId;
      return true;
    }

    clearJumpRequest() {
      this.jumpQueued = false;
      this.jumpQueuedAt = 0;
      this.jumpQueuedFrameId = 0;
    }

    hasBufferedJump(timeMs = this.getCurrentTimeMs()) {
      if (!this.jumpQueued) {
        return false;
      }

      if (this.updateFrameId <= this.jumpQueuedFrameId + 1) {
        return true;
      }

      return timeMs - this.jumpQueuedAt <= this.jumpBufferMs;
    }

    expireJumpRequest(timeMs = this.getCurrentTimeMs()) {
      if (this.jumpQueued && !this.hasBufferedJump(timeMs)) {
        this.clearJumpRequest();
      }
    }

    isWithinCoyoteTime(timeMs = this.getCurrentTimeMs()) {
      return timeMs - this.lastGroundedTime <= this.coyoteMs;
    }

    isJumpInputLocked(timeMs = this.getCurrentTimeMs()) {
      return Number.isFinite(this.jumpLockedUntil) && timeMs < this.jumpLockedUntil;
    }

    getInputContext(timeMs = this.getCurrentTimeMs()) {
      return {
        spacePressed: this.frameHadJumpPress || this.hasBufferedJump(timeMs),
        playerGrounded: this.player.grounded || this.isWithinCoyoteTime(timeMs)
      };
    }

    tryRunBufferedJump(settings, timeMs = this.getCurrentTimeMs()) {
      if (!this.programFeatures.player || !this.hasBufferedJump(timeMs)) {
        return false;
      }

      if (this.isJumpInputLocked(timeMs)) {
        this.clearJumpRequest();
        return false;
      }

      const allowCoyoteJump = !this.player.grounded && this.isWithinCoyoteTime(timeMs);
      const playerGrounded = this.player.grounded || allowCoyoteJump;
      if (!playerGrounded || !this.shouldRunAction("jump", { spacePressed: true, playerGrounded })) {
        return false;
      }

      const didJump = this.player.tryJump(settings.jumpForce, { allowAirborne: allowCoyoteJump });
      if (didJump) {
        this.clearJumpRequest();
        this.triggerHaptic(12);
      }

      return didJump;
    }

    forcePlayerJump(multiplier = 1.15) {
      const settings = this.getRuntimeSettings();
      this.player.tryJump(settings.jumpForce * multiplier, { allowAirborne: true });
      this.clearJumpRequest();
      this.lastGroundedTime = this.getCurrentTimeMs();
      this.triggerHaptic(22);
      return true;
    }

    updateAdaptivePerformance(deltaMs) {
      if (!this.performanceProfile.adaptiveQuality || !this.running) {
        return;
      }

      if (deltaMs > 34) {
        this.slowFrameMs += deltaMs;
        this.fastFrameMs = 0;
      } else if (deltaMs < 22) {
        this.fastFrameMs += deltaMs;
        this.slowFrameMs = Math.max(0, this.slowFrameMs - deltaMs);
      }

      if (this.slowFrameMs > 900 && this.adaptiveQualityLevel < 2) {
        this.adaptiveQualityLevel += 1;
        this.applyAdaptiveQualityLevel();
        this.slowFrameMs = 0;
        return;
      }

      if (this.fastFrameMs > 7000 && this.adaptiveQualityLevel > 0) {
        this.adaptiveQualityLevel -= 1;
        this.applyAdaptiveQualityLevel();
        this.fastFrameMs = 0;
      }
    }

    applyAdaptiveQualityLevel() {
      if (this.adaptiveQualityLevel >= 1) {
        this.performanceProfile.lowDetail = true;
        this.performanceProfile.showGrid = false;
        this.performanceProfile.gridStep = Math.max(this.performanceProfile.gridStep, 2);
      }
      if (this.adaptiveQualityLevel >= 2) {
        this.performanceProfile.gridStep = Math.max(this.performanceProfile.gridStep, 3);
      }
      if (this.adaptiveQualityLevel === 0) {
        this.performanceProfile.lowDetail = false;
        this.performanceProfile.gridStep = Math.max(1, this.performanceProfile.gridStep);
      }
      this.staticWorldDirty = true;
    }

    getRuntimeSettings() {
      return this.level.getSettings();
    }

    getCurrentRunSpeed(settings = this.getRuntimeSettings(), timeMs = this.getCurrentTimeMs()) {
      const zoneMultiplier = this.getActiveSpeedZoneMultiplier();
      const portalMultiplier = timeMs < this.speedBoostUntil ? this.speedMultiplier : 1;
      return settings.speed * zoneMultiplier * portalMultiplier;
    }

    getActiveSpeedZoneMultiplier() {
      if (!this.player) {
        return 1;
      }

      const playerBounds = this.player.getBounds();
      const overlaps = window.TechnoDash.CollisionManager.findOverlappingObjects(
        playerBounds,
        this.getFrameScreenObjects(),
        ["slowZone", "fastZone", "slipperyBlock"]
      );
      if (overlaps.some((object) => object.type === "fastZone")) {
        return 1.35;
      }
      if (overlaps.some((object) => object.type === "slowZone")) {
        return 0.62;
      }
      if (overlaps.some((object) => object.type === "slipperyBlock") && this.player.grounded) {
        return 1.18;
      }
      return 1;
    }

    hasLoopBlock(blockId) {
      return this.programFeatures.hasLoop && this.programFeatures.loopSet.has(blockId);
    }

    shouldRunAction(actionId, context = {}) {
      if (!this.programFeatures.hasLoop || !this.programFeatures.loopSet.has(actionId)) {
        return false;
      }

      const conditions = this.programFeatures.actionConditions[actionId] || [];
      return conditions.every((conditionId) => this.conditionPasses(conditionId, context));
    }

    conditionPasses(conditionId, context) {
      const checks = {
        spacePressed: Boolean(context.spacePressed),
        playerGrounded: Boolean(context.playerGrounded),
        hitObstacle: Boolean(context.hitObstacle),
        reachFinish: Boolean(context.reachFinish)
      };
      return checks[conditionId] || false;
    }

    onGlobalKeydown(event) {
      if (this.shouldIgnoreKeyboardEvent(event)) {
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        this.keyState.space = true;
        event.preventDefault();
        if (this.ended && !event.repeat) {
          this.queueRestart("space");
        } else if (!event.repeat) {
          this.requestJump(this.getCurrentTimeMs());
        }
        return;
      }

      const isEnter = event.code === "Enter"
        || event.code === "NumpadEnter"
        || event.key === "Enter"
        || event.key === "Return"
        || event.keyCode === 13
        || event.which === 13;
      if (isEnter || event.code === "KeyR" || event.key === "r" || event.key === "R") {
        if (isEnter) {
          this.keyState.enter = true;
        } else {
          this.keyState.r = true;
        }
        event.preventDefault();
        if (!event.repeat) {
          this.queueRestart(isEnter ? "enter" : "r");
        }
      }
    }

    onGlobalKeyup(event) {
      if (event.code === "Space" || event.key === " ") {
        this.keyState.space = false;
        this.restartHeldAtEnd.space = false;
        return;
      }

      const isEnter = event.code === "Enter"
        || event.code === "NumpadEnter"
        || event.key === "Enter"
        || event.key === "Return"
        || event.keyCode === 13
        || event.which === 13;
      if (isEnter) {
        this.keyState.enter = false;
        this.restartHeldAtEnd.enter = false;
        return;
      }

      if (event.code === "KeyR" || event.key === "r" || event.key === "R") {
        this.keyState.r = false;
        this.restartHeldAtEnd.r = false;
      }
    }

    clearKeyState() {
      this.keyState.space = false;
      this.keyState.enter = false;
      this.keyState.r = false;
    }

    resetInputState() {
      this.clearKeyState();
      this.spaceWasDown = false;
      this.restartWasDown = false;
      this.clearJumpRequest();
      this.restartQueued = false;
      this.restartQueuedInput = "";
      this.frameHadJumpPress = false;
    }

    clearRestartHeldInputs() {
      this.restartHeldAtEnd.space = false;
      this.restartHeldAtEnd.enter = false;
      this.restartHeldAtEnd.r = false;
    }

    captureRestartHeldInputs() {
      this.restartHeldAtEnd.space = Boolean(this.keyState.space);
      this.restartHeldAtEnd.enter = Boolean(this.keyState.enter);
      this.restartHeldAtEnd.r = Boolean(this.keyState.r);
    }

    getActiveRestartInputId() {
      if (this.keyState.r) {
        return "r";
      }

      if (this.keyState.enter) {
        return "enter";
      }

      if (this.ended && this.keyState.space) {
        return "space";
      }

      return "";
    }

    updateRestartInputLock(timeMs = this.getCurrentTimeMs()) {
      if (!this.ended) {
        this.clearRestartHeldInputs();
        return;
      }

      if (this.restartHeldAtEnd.space && !this.keyState.space) {
        this.restartHeldAtEnd.space = false;
      }
      if (this.restartHeldAtEnd.enter && !this.keyState.enter) {
        this.restartHeldAtEnd.enter = false;
      }
      if (this.restartHeldAtEnd.r && !this.keyState.r) {
        this.restartHeldAtEnd.r = false;
      }
    }

    isRestartCooldownLocked(timeMs = this.getCurrentTimeMs()) {
      return this.ended && timeMs < this.restartLockedUntil;
    }

    canAcceptRestartInput(inputId = "", timeMs = this.getCurrentTimeMs()) {
      if (!this.ended) {
        return true;
      }

      this.updateRestartInputLock(timeMs);
      if (this.isRestartCooldownLocked(timeMs)) {
        return false;
      }

      return !inputId || !this.restartHeldAtEnd[inputId];
    }

    isRestartInputLocked(timeMs = this.getCurrentTimeMs()) {
      if (!this.ended) {
        return false;
      }

      this.updateRestartInputLock(timeMs);
      return this.isRestartCooldownLocked(timeMs);
    }

    shouldIgnoreKeyboardEvent(event) {
      return Boolean(event && event.defaultPrevented) || this.shouldIgnoreGameKeyboard(event && event.target);
    }

    shouldIgnoreGameKeyboard(target = document.activeElement) {
      if (this.isTypingTarget(target)) {
        return true;
      }

      return Boolean(document.querySelector(
        ".maker-modal:not([hidden]), .stats-modal:not([hidden]), .validation-success-screen:not([hidden])"
      ));
    }

    isTypingTarget(target) {
      if (!target || typeof target.closest !== "function") {
        return false;
      }

      return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
    }

    beginFrameCache() {
      this.frameScreenObjects = null;
      this.frameDecorations = null;
      this.frameScreenObjectsScrollX = null;
      this.frameDecorationsScrollX = null;
    }

    invalidateFrameCache() {
      this.frameScreenObjects = null;
      this.frameDecorations = null;
      this.frameScreenObjectsScrollX = null;
      this.frameDecorationsScrollX = null;
    }

    getFrameScreenObjects() {
      if (!this.frameScreenObjects || this.frameScreenObjectsScrollX !== this.scrollX) {
        this.frameScreenObjects = this.level.getScreenObjects(this.scrollX, this.groundY, {
          viewportWidth: this.worldWidth,
          margin: this.tileSize * 5
        })
          .filter((object) => !this.disabledObjectIds.has(object.id))
          .map((object) => this.applyDynamicObjectState(object));
        this.frameScreenObjectsScrollX = this.scrollX;
      }

      return this.frameScreenObjects;
    }

    applyDynamicObjectState(object) {
      const next = { ...object };
      if (next.type === "movingPlatform") {
        const phase = (this.runElapsedMs / 1000) * 1.6 + next.column * 0.45;
        const offsetY = Math.round(Math.sin(phase) * this.tileSize * 1.5);
        next.top += offsetY;
        next.bottom += offsetY;
      }

      if (next.type === "laser") {
        next.isActive = Math.floor((this.runElapsedMs + next.column * 90) / 850) % 2 === 0;
      }

      return next;
    }

    getFrameDecorations() {
      if (!this.frameDecorations || this.frameDecorationsScrollX !== this.scrollX) {
        this.frameDecorations = this.level.getScreenDecorations(this.scrollX, this.groundY, {
          viewportWidth: this.worldWidth,
          margin: this.tileSize * 8
        });
        this.frameDecorationsScrollX = this.scrollX;
      }

      return this.frameDecorations;
    }

    checkCollisions(inputContext = {}) {
      const screenObjects = this.getFrameScreenObjects();
      const playerBounds = this.player.getBounds();
      const finish = this.programFeatures.player && this.programFeatures.finish
        ? window.TechnoDash.CollisionManager.findFinishCollision(playerBounds, screenObjects)
        : null;
      const hit = this.programFeatures.player && this.programFeatures.obstacles
        ? window.TechnoDash.CollisionManager.findObstacleCollision(playerBounds, screenObjects)
        : null;
      this.reachedFinish = Boolean(finish);
      const context = {
        ...inputContext,
        hitObstacle: Boolean(hit),
        reachFinish: Boolean(finish)
      };

      if (finish && this.shouldRunAction("showVictory", context)) {
        this.endGame("Victory");
        return;
      }

      if (this.shouldRunAction("showGameOver", context)) {
        this.endGame("Game Over");
        return;
      }

    }

    checkFinishCollision(inputContext = {}) {
      if (!this.programFeatures.player || !this.programFeatures.finish) {
        this.reachedFinish = false;
        return false;
      }

      const finish = window.TechnoDash.CollisionManager.findFinishCollision(
        this.player.getBounds(),
        this.getFrameScreenObjects()
      );
      this.reachedFinish = Boolean(finish);
      if (!finish) {
        return false;
      }

      const context = {
        ...inputContext,
        hitObstacle: false,
        reachFinish: true
      };
      if (!this.shouldRunAction("showVictory", context)) {
        return false;
      }

      this.endGame("Victory");
      return true;
    }

    resolvePlatformCollisions(previousPlayerBounds) {
      if (!this.programFeatures.obstacles) {
        return false;
      }

      const screenObjects = this.getFrameScreenObjects();
      const verticalCollision = window.TechnoDash.CollisionManager.findVerticalSurfaceCollision(
        this.player.getBounds(),
        previousPlayerBounds,
        screenObjects,
        this.player.velocityY,
        this.player.gravityDirection
      );

      if (verticalCollision) {
        const platform = verticalCollision.object;
        if (verticalCollision.kind === "landing") {
          this.player.landOn(verticalCollision.surfaceY, this.player.gravityDirection);
        } else {
          this.player.blockAt(verticalCollision.surfaceY, verticalCollision.placementDirection);
        }

        if (platform.type === "trampolineBlock") {
          this.forcePlayerJump(1.28);
        }
        if (verticalCollision.kind === "landing" && platform.type === "breakableBlock") {
          this.disabledObjectIds.add(platform.id);
          this.invalidateFrameCache();
        }
        return verticalCollision.kind === "landing";
      }

      return false;
    }

    onGravityDirectionChanged(timeMs = this.getCurrentTimeMs()) {
      this.clearJumpRequest();
      this.jumpLockedUntil = Math.max(this.jumpLockedUntil || 0, timeMs + 120);
      this.lastGroundedTime = timeMs - this.coyoteMs - 1;
    }

    applyGravitySwitches(timeMs = this.getCurrentTimeMs()) {
      if (!this.programFeatures.obstacles || !this.player) {
        return false;
      }

      const gravitySwitch = window.TechnoDash.CollisionManager.findGravitySwitchCollision(
        this.player.getBounds(),
        this.getFrameScreenObjects()
      );
      if (!gravitySwitch || this.activatedGravitySwitchIds.has(gravitySwitch.id)) {
        return false;
      }

      this.activatedGravitySwitchIds.add(gravitySwitch.id);
      if (this.player.flipGravity()) {
        this.onGravityDirectionChanged(timeMs);
      }
      this.showGravityFeedback();
      return true;
    }

    applyGameplayInteractions(settings, timeMs = this.getCurrentTimeMs()) {
      if (!this.programFeatures.obstacles || !this.player) {
        return false;
      }

      let changed = this.applyGravitySwitches(timeMs);
      const playerBounds = this.player.getBounds();
      const screenObjects = this.getFrameScreenObjects();

      const forcedGravity = window.TechnoDash.CollisionManager.findOverlappingObjects(
        playerBounds,
        screenObjects,
        ["gravityUpPortal", "gravityDownPortal", "gravityUpZone", "gravityDownZone"]
      )[0];
      if (forcedGravity) {
        const nextDirection = ["gravityUpPortal", "gravityUpZone"].includes(forcedGravity.type) ? -1 : 1;
        const oneShotPortal = forcedGravity.type.endsWith("Portal");
        if (!oneShotPortal || !this.activatedObjectIds.has(forcedGravity.id)) {
          if (oneShotPortal) {
            this.activatedObjectIds.add(forcedGravity.id);
          }
          if (this.player.setGravityDirection(nextDirection)) {
            this.onGravityDirectionChanged(timeMs);
            this.showGravityFeedback();
            changed = true;
          }
        }
      }

      const speedPortal = window.TechnoDash.CollisionManager.findOverlappingObjects(playerBounds, screenObjects, "speedPortal")[0];
      if (speedPortal && !this.activatedObjectIds.has(speedPortal.id)) {
        this.activatedObjectIds.add(speedPortal.id);
        this.speedMultiplier = 1.45;
        this.speedBoostUntil = timeMs + 2400;
        this.triggerHaptic(12);
        changed = true;
      }

      const jumpPad = window.TechnoDash.CollisionManager.findOverlappingObjects(playerBounds, screenObjects, "jumpPad")[0];
      if (jumpPad && !this.activatedObjectIds.has(jumpPad.id)) {
        this.activatedObjectIds.add(jumpPad.id);
        this.forcePlayerJump(1.18);
        changed = true;
      }

      const disposable = window.TechnoDash.CollisionManager.findOverlappingObjects(
        playerBounds,
        screenObjects,
        "breakableBlock"
      )[0];
      if (disposable && !this.disabledObjectIds.has(disposable.id)) {
        this.disabledObjectIds.add(disposable.id);
        this.triggerHaptic(18);
        changed = true;
      }

      if (changed) {
        this.invalidateFrameCache();
      }
      return changed;
    }

    showGravityFeedback() {
      this.triggerHaptic(18);
      this.spawnGravityParticles();
      if (this.cameras && this.cameras.main && typeof this.cameras.main.flash === "function") {
        this.cameras.main.flash(110, 139, 92, 246, false);
      }
      if (this.cameras && this.cameras.main && typeof this.cameras.main.shake === "function") {
        this.cameras.main.shake(70, 0.004);
      }
    }

    spawnGravityParticles() {
      if (!this.player || this.performanceProfile.lowDetail) {
        return;
      }

      const direction = this.player.gravityDirection === -1 ? -1 : 1;
      for (let index = 0; index < 18; index += 1) {
        const angle = (Math.PI * 2 * index) / 18;
        const speed = 70 + (index % 5) * 18;
        this.effectParticles.push({
          kind: "gravity",
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - direction * 55,
          age: 0,
          life: 360 + (index % 4) * 55,
          size: 2 + (index % 3)
        });
      }
    }

    spawnEndParticles(status) {
      if (!this.player) {
        return;
      }

      const color = status === "Victory" ? 0x5eead4 : 0xff4d5a;
      const count = this.performanceProfile.lowDetail ? 12 : 26;
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count;
        const speed = 90 + (index % 6) * 22;
        this.effectParticles.push({
          kind: "end",
          color,
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          life: status === "Victory" ? 620 : 460,
          size: status === "Victory" ? 3 + (index % 2) : 2 + (index % 4)
        });
      }
    }

    updateEffectParticles(deltaMs) {
      if (!this.effectParticles.length) {
        return;
      }

      const dt = Math.max(0, Number(deltaMs) || 0);
      const seconds = dt / 1000;
      this.effectParticles = this.effectParticles
        .map((particle) => ({
          ...particle,
          age: particle.age + dt,
          x: particle.x + particle.vx * seconds,
          y: particle.y + particle.vy * seconds,
          vy: particle.vy + 180 * seconds
        }))
        .filter((particle) => particle.age < particle.life);
    }

    triggerHaptic(duration = 12) {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(duration);
      }
    }

    resolveSolidBlockSideCollisions(previousScrollX) {
      if (!this.programFeatures.obstacles || !this.hasLoopBlock("moveLevel")) {
        return false;
      }

      const screenObjects = this.getFrameScreenObjects();
      const solidBlock = window.TechnoDash.CollisionManager.findSolidBlockSideCollision(
        this.player.getBounds(),
        screenObjects,
        this.player.gravityDirection
      );

      if (!solidBlock) {
        return false;
      }

      const penetration = this.player.getBounds().right - solidBlock.left;
      if (penetration <= 0) {
        return false;
      }

      // Geometry Dash rule: landing on top is safe, being blocked from the side ends the run.
      this.scrollX = Math.max(previousScrollX, this.scrollX - penetration - 0.5);
      this.invalidateFrameCache();
      return true;
    }

    endGame(status) {
      if (this.ended) {
        return;
      }

      this.running = false;
      this.ended = true;
      this.status = status;
      this.clearJumpRequest();
      this.restartQueued = false;
      this.restartQueuedInput = "";
      if (status === "Game Over") {
        this.restartLockedUntil = this.getCurrentTimeMs() + 360;
        this.captureRestartHeldInputs();
      } else {
        this.restartLockedUntil = this.getCurrentTimeMs() + 120;
        this.clearRestartHeldInputs();
      }
      this.playEndAnimation(status);
      this.triggerHaptic(status === "Game Over" ? 42 : 24);
      this.renderWorld();
      this.publishState({ force: true });
    }

    playEndAnimation(status) {
      if (this.endAnimationPlayed || !this.player || !this.player.sprite) {
        return;
      }

      this.endAnimationPlayed = true;
      this.spawnEndParticles(status);
      const sprite = this.player.sprite;
      if (status === "Victory") {
        sprite.setVisible(true);
        sprite.setFillStyle(0x5eead4, 1);
        this.tweens.add({
          targets: sprite,
          scaleX: 1.35,
          scaleY: 1.35,
          angle: sprite.angle + 360,
          duration: 520,
          ease: "Back.Out"
        });
        return;
      }

      const style = this.levelData && this.levelData.settings
        ? this.levelData.settings.deathAnimation
        : "burst";
      if (style === "fade") {
        this.tweens.add({
          targets: sprite,
          alpha: 0,
          scaleX: 0.35,
          scaleY: 0.35,
          duration: 320,
          ease: "Quad.Out"
        });
        return;
      }

      if (style === "shatter") {
        this.tweens.add({
          targets: sprite,
          angle: sprite.angle + 160,
          scaleX: 0.7,
          scaleY: 1.35,
          alpha: 0.35,
          duration: 260,
          yoyo: true,
          ease: "Cubic.Out"
        });
        return;
      }

      this.endPlayerHidden = true;
      sprite.setVisible(false);
    }

    renderWorld() {
      if (!this.backgroundGraphics || !this.gridGraphics || !this.levelGraphics) {
        return;
      }

      const gridGraphics = this.gridGraphics;
      const graphics = this.levelGraphics;
      const effectsGraphics = this.effectsGraphics;
      const settings = this.getRuntimeSettings();
      this.renderStaticWorld(settings);
      this.syncGroundTexture(settings);
      gridGraphics.clear();
      graphics.clear();
      if (effectsGraphics) {
        effectsGraphics.clear();
      }

      if (this.programFeatures.background && this.performanceProfile.showGrid) {
        this.drawBackgroundGrid(gridGraphics);
      }
      this.renderDecorations();
      this.renderTexturedBlocks();
      this.drawLevelObjects(graphics);
      this.drawEffectParticles(effectsGraphics);
      this.syncProgramVisuals();
    }

    renderStaticWorld(settings) {
      const signature = [
        settings.backgroundColor,
        settings.groundTheme,
        this.programFeatures.ground,
        this.worldWidth,
        this.worldHeight,
        this.groundY
      ].join("|");
      if (!this.staticWorldDirty && this.staticWorldSignature === signature) {
        return;
      }

      const backgroundGraphics = this.backgroundGraphics;
      backgroundGraphics.clear();
      backgroundGraphics.fillStyle(window.TechnoDash.Level.hexToNumber(settings.backgroundColor, 0x071322), 1);
      backgroundGraphics.fillRect(0, 0, this.worldWidth, this.worldHeight);
      this.drawThemeAtmosphere(backgroundGraphics, settings.backgroundColor);
      if (this.programFeatures.ground && !this.shouldRenderGroundTexture(settings.groundTheme)) {
        this.drawGround(backgroundGraphics, settings);
      }

      this.staticWorldDirty = false;
      this.staticWorldSignature = signature;
    }

    renderDecorations() {
      if (!this.decorSprites) {
        return;
      }

      if (!this.programFeatures.decorations || !this.performanceProfile.renderDecorations) {
        this.clearDecorationSprites();
        return;
      }

      const visibleIds = new Set();
      const decorations = this.getFrameDecorations();
      const maxDecorations = this.performanceProfile.maxVisibleDecorations;
      for (const decoration of decorations) {
        if (visibleIds.size >= maxDecorations) {
          break;
        }

        const texture = this.getDecorationTextureRef(decoration.type);
        const isNearScreen = decoration.right > -160 && decoration.left < this.worldWidth + 160;
        if (!texture || !isNearScreen || !this.textures.exists(texture.key)) {
          continue;
        }

        let sprite = this.decorSprites.get(decoration.id);
        if (!sprite) {
          sprite = this.add.image(decoration.screenX, decoration.bottom, texture.key, texture.frame);
          sprite.setOrigin(0.5, 1);
          sprite.setDepth(1);
          this.decorSprites.set(decoration.id, sprite);
        } else if (this.shouldUpdateDecorationTexture(sprite, texture)) {
          sprite.setTexture(texture.key, texture.frame);
        }

        sprite.setPosition(decoration.screenX, decoration.bottom);
        sprite.setDisplaySize(decoration.width, decoration.height);
        sprite.setVisible(true);
        visibleIds.add(decoration.id);
      }

      this.decorSprites.forEach((sprite, id) => {
        if (!visibleIds.has(id)) {
          sprite.destroy();
          this.decorSprites.delete(id);
        }
      });
    }

    getDecorationTextureRef(type) {
      const decoration = window.TechnoDash.Level.getDecorationForType(type);
      if (!decoration) {
        return null;
      }

      if (this.performanceProfile.useDecorationAtlas && decoration.theme) {
        return {
          key: GameScene.getDecorationAtlasKey(decoration.theme),
          frame: decoration.type
        };
      }

      return {
        key: GameScene.getDecorationTextureKey(decoration.type),
        frame: null
      };
    }

    shouldUpdateDecorationTexture(sprite, texture) {
      if (sprite.texture.key !== texture.key) {
        return true;
      }

      if (!texture.frame) {
        return false;
      }

      return !sprite.frame || sprite.frame.name !== texture.frame;
    }

    clearDecorationSprites() {
      if (!this.decorSprites) {
        return;
      }

      this.decorSprites.forEach((sprite) => sprite.destroy());
      this.decorSprites.clear();
    }

    renderTexturedBlocks() {
      if (!this.blockTextureSprites) {
        return;
      }

      if (!this.programFeatures.obstacles) {
        this.clearBlockTextureSprites();
        return;
      }

      const visibleIds = new Set();
      this.getFrameScreenObjects().forEach((object) => {
        if (!this.shouldRenderBlockTexture(object)) {
          return;
        }

        if (object.right < -40 || object.left > this.worldWidth + 80) {
          return;
        }

        const key = GameScene.getBlockTextureKey(object.type);
        let sprite = this.blockTextureSprites.get(object.id);
        if (!sprite) {
          sprite = this.add.tileSprite(object.left, object.top, object.width, object.height, key);
          sprite.setOrigin(0, 0);
          sprite.setDepth(2.5);
          this.blockTextureSprites.set(object.id, sprite);
        } else if (sprite.texture.key !== key) {
          sprite.setTexture(key);
        }

        sprite.setPosition(object.left, object.top);
        sprite.setSize(object.width, object.height);
        sprite.setDisplaySize(object.width, object.height);
        sprite.setVisible(true);
        visibleIds.add(object.id);
      });

      this.blockTextureSprites.forEach((sprite, id) => {
        if (!visibleIds.has(id)) {
          sprite.destroy();
          this.blockTextureSprites.delete(id);
        }
      });
    }

    shouldRenderBlockTexture(object) {
      if (!object || !GameScene.isTexturedBlockType(object.type)) {
        return false;
      }

      const key = GameScene.getBlockTextureKey(object.type);
      return this.textures && this.textures.exists(key);
    }

    clearBlockTextureSprites() {
      if (!this.blockTextureSprites) {
        return;
      }

      this.blockTextureSprites.forEach((sprite) => sprite.destroy());
      this.blockTextureSprites.clear();
    }

    drawBackgroundGrid(graphics) {
      graphics.lineStyle(1, 0x253045, 0.75);
      const tileSize = this.tileSize || window.TechnoDash.Level.getTileSize();
      const gridStep = Math.max(1, this.performanceProfile.gridStep);
      const gridSize = tileSize * gridStep;
      const offset = Math.floor(this.scrollX % gridSize);
      for (let x = -offset; x < this.worldWidth + gridSize; x += gridSize) {
        graphics.lineBetween(x, 0, x, this.worldHeight);
      }
      for (let y = this.groundY % gridSize; y < this.groundY; y += gridSize) {
        graphics.lineBetween(0, y, this.worldWidth, y);
      }
    }

    drawGround(graphics, settings = {}) {
      const theme = window.TechnoDash.Level.getGroundTheme(settings.groundTheme);
      graphics.fillStyle(window.TechnoDash.Level.hexToNumber(theme.color, 0x2f3747), 1);
      graphics.fillRect(0, this.groundY, this.worldWidth, this.worldHeight - this.groundY);
      graphics.lineStyle(2, window.TechnoDash.Level.hexToNumber(theme.lineColor, 0x21150d), 0.9);
      graphics.lineBetween(0, this.groundY, this.worldWidth, this.groundY);
    }

    shouldRenderGroundTexture(theme = "dirt") {
      const key = GameScene.getGroundTextureKey(theme);
      return this.textures && this.textures.exists(key);
    }

    syncGroundTexture(settings = {}) {
      const theme = window.TechnoDash.Level.normalizeGroundTheme(settings.groundTheme);
      if (!this.programFeatures.ground || !this.shouldRenderGroundTexture(theme)) {
        this.clearGroundTextureSprite();
        return;
      }

      const key = GameScene.getGroundTextureKey(theme);
      const height = Math.max(1, this.worldHeight - this.groundY);
      if (!this.groundTextureSprite) {
        this.groundTextureSprite = this.add.tileSprite(0, this.groundY, this.worldWidth, height, key);
        this.groundTextureSprite.setOrigin(0, 0);
        this.groundTextureSprite.setDepth(0.25);
      } else if (this.groundTextureSprite.texture.key !== key) {
        this.groundTextureSprite.setTexture(key);
      }

      this.groundTextureSprite.setPosition(0, this.groundY);
      this.groundTextureSprite.setSize(this.worldWidth, height);
      this.groundTextureSprite.setDisplaySize(this.worldWidth, height);
      this.groundTextureSprite.tilePositionX = Math.floor(this.scrollX || 0);
      this.groundTextureSprite.setVisible(true);
    }

    clearGroundTextureSprite() {
      if (!this.groundTextureSprite) {
        return;
      }

      this.groundTextureSprite.destroy();
      this.groundTextureSprite = null;
    }

    drawThemeAtmosphere(graphics, color) {
      const accent = window.TechnoDash.Level.hexToNumber(color, 0x2db8ff) ^ 0x5eead4;
      graphics.fillStyle(0xffffff, 0.035);
      graphics.fillRect(0, 0, this.worldWidth, Math.max(24, this.worldHeight * 0.18));
      graphics.fillStyle(accent, 0.08);
      for (let index = 0; index < 4; index += 1) {
        const y = Math.round((index + 1) * this.worldHeight * 0.16);
        graphics.fillRect(0, y, this.worldWidth, 2);
      }
    }

    drawEffectParticles(graphics) {
      if (!graphics || !this.effectParticles.length) {
        return;
      }

      this.effectParticles.forEach((particle) => {
        const progress = Math.min(1, particle.age / particle.life);
        const alpha = Math.max(0, 1 - progress);
        const color = particle.color || 0x8b5cf6;
        graphics.fillStyle(color, alpha * 0.82);
        graphics.fillCircle(particle.x, particle.y, particle.size * (1 + progress * 0.65));
      });
    }

    drawLevelObjects(graphics) {
      const screenObjects = this.getFrameScreenObjects();

      screenObjects.forEach((object) => {
        if (object.type === "finish" && !this.programFeatures.finish) {
          return;
        }

        if (object.type !== "finish" && !this.programFeatures.obstacles) {
          return;
        }

        if (object.right < -40 || object.left > this.worldWidth + 80) {
          return;
        }

        if (object.type === "triangle" || object.type === "animatedSpike") {
          this.drawTriangleObstacle(graphics, object);
          return;
        }

        if (object.type === "block") {
          this.drawDangerBlock(graphics, object);
          return;
        }

        if (window.TechnoDash.Level.isSolidBlockType(object.type)) {
          if (this.shouldRenderBlockTexture(object)) {
            return;
          }

          this.drawSolidBlock(graphics, object);
          return;
        }

        if (window.TechnoDash.Level.isPlatformType(object.type)) {
          this.drawPlatformObject(graphics, object);
          return;
        }

        if (window.TechnoDash.Level.isModifierType(object.type)) {
          this.drawModifierObject(graphics, object);
          return;
        }

        if (object.type === "laser") {
          this.drawLaser(graphics, object);
          return;
        }

        this.drawFinish(graphics, object);
      });
    }

    drawSolidBlock(graphics, object) {
      const colors = window.TechnoDash.Level.getObstacleColorStyle(object.type, object.color) || { color: "#5aa7e8", accent: "#9bd0ff", stroke: "#1f5f93" };
      graphics.fillStyle(window.TechnoDash.Level.hexToNumber(colors.color, 0x5aa7e8), 1);
      graphics.fillRect(object.left, object.top, object.width, object.height);
      if (object.type === "breakableBlock") {
        graphics.lineStyle(2, 0x3d2415, 0.72);
        graphics.lineBetween(object.left + 6, object.top + 6, object.right - 8, object.bottom - 7);
        graphics.lineBetween(object.left + 10, object.bottom - 5, object.left + 20, object.top + 8);
      } else if (object.type === "slipperyBlock") {
        graphics.lineStyle(2, 0xd7f8ff, 0.82);
        graphics.lineBetween(object.left + 5, object.top + 9, object.right - 5, object.top + 9);
        graphics.lineBetween(object.left + 5, object.bottom - 9, object.right - 5, object.bottom - 9);
      }
    }

    drawPlatformObject(graphics, object) {
      const colors = window.TechnoDash.Level.getObstacleColorStyle(object.type, object.color) || window.TechnoDash.Level.getObstacleColorStyle("platform", object.color);
      const fill = object.type === "trampolineBlock" ? 0xf97316 : window.TechnoDash.Level.hexToNumber(colors.color, 0x35b6a6);
      graphics.fillStyle(fill, 1);
      graphics.fillRect(object.left, object.top, object.width, object.height);
      if (object.type === "oneWayPlatform") {
        graphics.fillStyle(0xf4f7fb, 0.9);
        graphics.fillTriangle(object.screenX, object.top + 7, object.screenX - 8, object.bottom - 7, object.screenX + 8, object.bottom - 7);
      } else if (object.type === "movingPlatform") {
        graphics.lineStyle(2, 0xf4f7fb, 0.8);
        graphics.lineBetween(object.left + 7, object.top + object.height / 2, object.right - 7, object.top + object.height / 2);
        graphics.fillTriangle(object.left + 8, object.top + object.height / 2, object.left + 17, object.top + 8, object.left + 17, object.bottom - 8);
        graphics.fillTriangle(object.right - 8, object.top + object.height / 2, object.right - 17, object.top + 8, object.right - 17, object.bottom - 8);
      } else if (object.type === "trampolineBlock") {
        graphics.lineStyle(3, 0xfed7aa, 1);
        graphics.lineBetween(object.left + 5, object.bottom - 8, object.left + 12, object.top + 8);
        graphics.lineBetween(object.left + 12, object.top + 8, object.left + 19, object.bottom - 8);
        graphics.lineBetween(object.left + 19, object.bottom - 8, object.right - 5, object.top + 8);
      }
    }

    drawModifierObject(graphics, object) {
      if (object.type === "gravitySwitch") {
        this.drawGravitySwitch(graphics, object);
        return;
      }

      const centerX = object.screenX;
      const centerY = (object.top + object.bottom) / 2;
      const isZone = object.type.endsWith("Zone");
      const isGravity = object.type.startsWith("gravity");
      const isSpeed = object.type === "speedPortal" || object.type === "slowZone" || object.type === "fastZone";
      const fill = isGravity ? 0x8b5cf6 : isSpeed ? 0x2dd4bf : 0xf97316;
      graphics.fillStyle(fill, isZone ? 0.24 : 0.95);
      graphics.fillRect(object.left, object.top, object.width, object.height);
      graphics.lineStyle(2, fill, 0.9);
      graphics.strokeRect(object.left, object.top, object.width, object.height);
      graphics.fillStyle(0xf4f7fb, 1);

      if (object.type === "slowZone") {
        graphics.fillRect(centerX - 9, centerY - 3, 18, 6);
        return;
      }

      if (object.type === "fastZone" || object.type === "speedPortal") {
        graphics.fillTriangle(centerX - 9, centerY - 11, centerX + 11, centerY, centerX - 9, centerY + 11);
        return;
      }

      const up = object.type.includes("Up") || object.type === "jumpPad";
      graphics.fillTriangle(
        centerX,
        up ? object.top + 7 : object.bottom - 7,
        centerX - 9,
        up ? object.bottom - 8 : object.top + 8,
        centerX + 9,
        up ? object.bottom - 8 : object.top + 8
      );
    }

    drawLaser(graphics, object) {
      const alpha = object.isActive === false ? 0.22 : 0.92;
      graphics.fillStyle(0xef4444, alpha);
      graphics.fillRect(object.left + object.width * 0.35, object.top, object.width * 0.3, object.height);
      graphics.fillStyle(0xfca5a5, Math.min(1, alpha + 0.08));
      graphics.fillRect(object.left + object.width * 0.43, object.top, object.width * 0.14, object.height);
      graphics.fillStyle(0x111827, 1);
      graphics.fillRect(object.left, object.top, object.width, 8);
      graphics.fillRect(object.left, object.bottom - 8, object.width, 8);
    }

    drawTriangleObstacle(graphics, object) {
      const points = this.getTriangleDrawPoints(object);
      const alpha = object.type === "animatedSpike"
        ? 0.78 + Math.sin(this.runElapsedMs / 130 + object.column) * 0.18
        : 1;
      graphics.fillStyle(0xd9433e, alpha);
      graphics.fillTriangle(points[0].x, points[0].y, points[1].x, points[1].y, points[2].x, points[2].y);
      if (!this.performanceProfile.lowDetail) {
        graphics.lineStyle(2, 0xffffff, 0.7);
        graphics.strokeTriangle(points[0].x, points[0].y, points[1].x, points[1].y, points[2].x, points[2].y);
      }
    }

    getTriangleDrawPoints(object) {
      const rotation = window.TechnoDash.Level.normalizeRotation(object.rotation, object.type);
      const middleX = (object.left + object.right) / 2;
      const middleY = (object.top + object.bottom) / 2;
      if (rotation === 90) {
        return [
          { x: object.left, y: object.top },
          { x: object.right, y: middleY },
          { x: object.left, y: object.bottom }
        ];
      }

      if (rotation === 180) {
        return [
          { x: object.left, y: object.top },
          { x: object.right, y: object.top },
          { x: middleX, y: object.bottom }
        ];
      }

      if (rotation === 270) {
        return [
          { x: object.right, y: object.top },
          { x: object.right, y: object.bottom },
          { x: object.left, y: middleY }
        ];
      }

      return [
        { x: object.left, y: object.bottom },
        { x: middleX, y: object.top },
        { x: object.right, y: object.bottom }
      ];
    }

    drawDangerBlock(graphics, object) {
      const colors = window.TechnoDash.Level.getObstacleColorStyle(object.type, object.color);
      const rotation = window.TechnoDash.Level.normalizeRotation(object.rotation, object.type);
      const faceSize = Math.min(12, Math.max(8, (rotation === 90 || rotation === 270 ? object.height : object.width) * 0.24));
      graphics.fillStyle(window.TechnoDash.Level.hexToNumber(colors.color, 0xf0b429), 1);
      graphics.fillRect(object.left, object.top, object.width, object.height);
      graphics.fillStyle(window.TechnoDash.Level.hexToNumber(colors.danger, 0xc7352f), 1);

      if (rotation === 90) {
        graphics.fillRect(object.left + 6, object.top, object.width - 12, faceSize);
      } else if (rotation === 180) {
        graphics.fillRect(object.right - faceSize, object.top + 6, faceSize, object.height - 12);
      } else if (rotation === 270) {
        graphics.fillRect(object.left + 6, object.bottom - faceSize, object.width - 12, faceSize);
      } else {
        graphics.fillRect(object.left, object.top + 6, faceSize, object.height - 12);
      }

      if (!this.performanceProfile.lowDetail) {
        graphics.lineStyle(2, window.TechnoDash.Level.hexToNumber(colors.stroke, 0x4d3500), 0.8);
        graphics.strokeRect(object.left, object.top, object.width, object.height);
      }
    }

    drawGravitySwitch(graphics, object) {
      const centerX = object.screenX;
      const centerY = (object.top + object.bottom) / 2;
      const radius = Math.min(object.width, object.height) / 2 - 3;
      graphics.fillStyle(0x8b5cf6, 1);
      graphics.fillCircle(centerX, centerY, radius);
      graphics.lineStyle(2, 0xffffff, 0.8);
      graphics.strokeCircle(centerX, centerY, radius);
      graphics.fillStyle(0xf4f7fb, 1);
      graphics.fillTriangle(
        centerX,
        object.top + 7,
        centerX - 7,
        centerY + 2,
        centerX + 7,
        centerY + 2
      );
      graphics.fillTriangle(
        centerX,
        object.bottom - 7,
        centerX - 7,
        centerY - 2,
        centerX + 7,
        centerY - 2
      );
    }

    drawFinish(graphics, object) {
      const poleX = object.screenX;
      const poleTop = 0;
      const poleBottom = Number.isFinite(object.groundY) ? object.groundY : this.groundY;
      graphics.lineStyle(8, 0x111827, 0.9);
      graphics.lineBetween(poleX, poleTop, poleX, poleBottom);
      graphics.lineStyle(4, 0xf4f7fb, 1);
      graphics.lineBetween(poleX, poleTop, poleX, poleBottom);

      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(object.left, object.top, object.width, object.height);
      const stripeSize = 8;
      for (let y = object.top; y < object.bottom; y += stripeSize) {
        for (let x = object.left; x < object.right; x += stripeSize) {
          const column = Math.floor((x - object.left) / stripeSize);
          const row = Math.floor((y - object.top) / stripeSize);
          if ((column + row) % 2 === 0) {
            graphics.fillStyle(0x111827, 1);
            graphics.fillRect(x, y, stripeSize, stripeSize);
          }
        }
      }
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeRect(object.left, object.top, object.width, object.height);
    }

    publishState(options = {}) {
      if (typeof this.uiCallbacks.onStats !== "function") {
        return;
      }

      const stats = {
        status: this.status,
        distance: this.distance,
        score: this.score,
        ended: this.ended,
        showDistance: this.hasLoopBlock("showDistance"),
        showScore: this.hasLoopBlock("showScore"),
        reachedFinish: this.reachedFinish,
        grounded: this.player ? this.player.grounded : true,
        playerY: this.player ? Math.round(this.player.y) : 0
      };
      const timeMs = Number.isFinite(options.time) ? options.time : this.getCurrentTimeMs();
      const force = Boolean(options.force) || this.shouldForceStatsPublish(stats);
      if (!force && timeMs - this.lastStatsPublishTime < this.statsPublishIntervalMs) {
        return;
      }

      this.lastStatsPublishTime = timeMs;
      this.lastPublishedStats = stats;
      this.uiCallbacks.onStats(stats);
    }

    shouldForceStatsPublish(stats) {
      const previous = this.lastPublishedStats;
      if (!previous) {
        return true;
      }

      return previous.status !== stats.status
        || previous.ended !== stats.ended
        || previous.reachedFinish !== stats.reachedFinish
        || previous.grounded !== stats.grounded
        || previous.showDistance !== stats.showDistance
        || previous.showScore !== stats.showScore;
    }
  }

  window.TechnoDash.GameScene = GameScene;
})();
