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
      this.restartQueued = false;
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
      this.staticWorldDirty = true;
      this.staticWorldSignature = "";
      this.lastStatsPublishTime = 0;
      this.statsPublishIntervalMs = 80;
      this.lastPublishedStats = null;
      this.keyState = {
        space: false,
        enter: false,
        r: false
      };
      this.pendingPlay = false;
      this.programFeatures = GameScene.createProgramFeatures({ activeBlockIds: [] });
      this.decorSprites = new Map();
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

    preload() {
      window.TechnoDash.Level.getDecorationTypes().forEach((decoration) => {
        this.load.image(GameScene.getDecorationTextureKey(decoration.type), `assets/decor/${decoration.file}`);
      });
    }

    static getDecorationTextureKey(type) {
      return `decor-${type}`;
    }

    create() {
      this.worldWidth = this.scale.width;
      this.worldHeight = this.scale.height;
      this.tileSize = window.TechnoDash.Level.getTileSize();
      this.groundY = this.worldHeight - this.tileSize;
      this.playerX = this.tileSize * 3 + this.tileSize / 2;
      this.level = new window.TechnoDash.Level(this.levelData);
      this.backgroundGraphics = this.add.graphics();
      this.backgroundGraphics.setDepth(0);
      this.gridGraphics = this.add.graphics();
      this.gridGraphics.setDepth(0.5);
      this.levelGraphics = this.add.graphics();
      this.levelGraphics.setDepth(2);
      this.player = new window.TechnoDash.Player(this, this.playerX, this.groundY);
      this.syncProgramVisuals();
      this.handleGlobalKeydown = (event) => this.onGlobalKeydown(event);
      this.handleGlobalKeyup = (event) => this.onGlobalKeyup(event);
      window.addEventListener("keydown", this.handleGlobalKeydown);
      window.addEventListener("keyup", this.handleGlobalKeyup);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener("keydown", this.handleGlobalKeydown);
        window.removeEventListener("keyup", this.handleGlobalKeyup);
      });

      this.created = true;
      this.reset(this.pendingPlay);
      this.pendingPlay = false;
    }

    setCallbacks(callbacks) {
      this.uiCallbacks = callbacks || {};
      this.publishState({ force: true });
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
        this.player.sprite.setVisible(this.programFeatures.player);
      }
    }

    loadLevel(levelData, options = {}) {
      this.levelData = window.TechnoDash.Level.normalize(levelData);
      this.staticWorldDirty = true;

      if (!this.created) {
        this.pendingPlay = Boolean(options.play);
        return;
      }

      this.level = new window.TechnoDash.Level(this.levelData);
      this.invalidateFrameCache();
      this.reset(Boolean(options.play));
    }

    play() {
      if (!this.created) {
        return;
      }

      if (this.ended) {
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
      this.distance = 0;
      this.score = 0;
      this.reachedFinish = false;
      this.ended = false;
      this.running = Boolean(shouldPlay);
      this.status = shouldPlay ? "Playing" : "Ready";
      this.spaceWasDown = false;
      this.restartWasDown = false;
      this.clearJumpRequest();
      this.restartQueued = false;
      this.frameHadJumpPress = false;
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
      this.beginFrameCache();

      const keyboardBlocked = this.shouldIgnoreGameKeyboard();
      if (keyboardBlocked) {
        this.restartQueued = false;
        this.clearJumpRequest();
        this.clearKeyState();
      }

      const restartDown = keyboardBlocked
        ? false
        : this.keyState.r || this.keyState.enter || (this.ended && this.keyState.space);
      const restartTriggered = (restartDown && !this.restartWasDown) || this.restartQueued;
      if (restartTriggered) {
        this.restartFromInput(restartDown);
        return;
      }
      this.restartQueued = false;
      this.restartWasDown = restartDown;

      const spaceDown = keyboardBlocked ? false : this.keyState.space;
      if (!this.running || this.ended) {
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
          this.scrollX += settings.speed * stepSeconds;
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
      this.frameHadJumpPress = false;
      this.renderWorld();
      this.publishState({ time });
    }

    restartFromInput(restartDown) {
      this.restartQueued = false;
      this.reset(true);
      this.restartWasDown = Boolean(restartDown);
      this.spaceWasDown = Boolean(this.keyState.space);
      this.clearJumpRequest();
    }

    queueJump() {
      if (!this.created) {
        return;
      }

      if (this.ended) {
        this.restartQueued = true;
        return;
      }

      this.requestJump(this.getCurrentTimeMs());
    }

    queueRestart() {
      if (!this.created) {
        return;
      }

      this.restartQueued = true;
    }

    getCurrentTimeMs() {
      if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
      }

      return Number.isFinite(this.lastUpdateTime) ? this.lastUpdateTime : 0;
    }

    requestJump(timeMs = this.getCurrentTimeMs()) {
      this.jumpQueued = true;
      this.jumpQueuedAt = Number.isFinite(timeMs) ? timeMs : this.getCurrentTimeMs();
    }

    clearJumpRequest() {
      this.jumpQueued = false;
      this.jumpQueuedAt = 0;
    }

    hasBufferedJump(timeMs = this.getCurrentTimeMs()) {
      if (!this.jumpQueued) {
        return false;
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

      const allowCoyoteJump = !this.player.grounded && this.isWithinCoyoteTime(timeMs);
      const playerGrounded = this.player.grounded || allowCoyoteJump;
      if (!playerGrounded || !this.shouldRunAction("jump", { spacePressed: true, playerGrounded })) {
        return false;
      }

      const didJump = this.player.tryJump(settings.jumpForce, { allowAirborne: allowCoyoteJump });
      if (didJump) {
        this.clearJumpRequest();
      }

      return didJump;
    }

    getRuntimeSettings() {
      return this.level.getSettings();
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
          this.restartQueued = true;
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
          this.restartQueued = true;
        }
      }
    }

    onGlobalKeyup(event) {
      if (event.code === "Space" || event.key === " ") {
        this.keyState.space = false;
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
        return;
      }

      if (event.code === "KeyR" || event.key === "r" || event.key === "R") {
        this.keyState.r = false;
      }
    }

    clearKeyState() {
      this.keyState.space = false;
      this.keyState.enter = false;
      this.keyState.r = false;
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
        });
        this.frameScreenObjectsScrollX = this.scrollX;
      }

      return this.frameScreenObjects;
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
      const platform = window.TechnoDash.CollisionManager.findPlatformLanding(
        this.player.getBounds(),
        previousPlayerBounds,
        screenObjects,
        this.player.velocityY
      );

      if (platform) {
        this.player.landOn(platform.top);
        return true;
      }

      return false;
    }

    resolveSolidBlockSideCollisions(previousScrollX) {
      if (!this.programFeatures.obstacles || !this.hasLoopBlock("moveLevel")) {
        return false;
      }

      const screenObjects = this.getFrameScreenObjects();
      const solidBlock = window.TechnoDash.CollisionManager.findSolidBlockSideCollision(
        this.player.getBounds(),
        screenObjects
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
      this.running = false;
      this.ended = true;
      this.status = status;
      this.publishState({ force: true });
    }

    renderWorld() {
      if (!this.backgroundGraphics || !this.gridGraphics || !this.levelGraphics) {
        return;
      }

      const gridGraphics = this.gridGraphics;
      const graphics = this.levelGraphics;
      const settings = this.getRuntimeSettings();
      this.renderStaticWorld(settings);
      gridGraphics.clear();
      graphics.clear();

      if (this.programFeatures.background) {
        this.drawBackgroundGrid(gridGraphics);
      }
      this.renderDecorations();
      this.drawLevelObjects(graphics);
      this.syncProgramVisuals();
    }

    renderStaticWorld(settings) {
      const signature = [
        settings.backgroundColor,
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
      if (this.programFeatures.ground) {
        this.drawGround(backgroundGraphics);
      }

      this.staticWorldDirty = false;
      this.staticWorldSignature = signature;
    }

    renderDecorations() {
      if (!this.decorSprites) {
        return;
      }

      if (!this.programFeatures.decorations) {
        this.decorSprites.forEach((sprite) => sprite.setVisible(false));
        return;
      }

      const visibleIds = new Set();
      const decorations = this.getFrameDecorations();
      decorations.forEach((decoration) => {
        const key = GameScene.getDecorationTextureKey(decoration.type);
        const isNearScreen = decoration.right > -160 && decoration.left < this.worldWidth + 160;
        if (!isNearScreen || !this.textures.exists(key)) {
          return;
        }

        let sprite = this.decorSprites.get(decoration.id);
        if (!sprite) {
          sprite = this.add.image(decoration.screenX, decoration.bottom, key);
          sprite.setOrigin(0.5, 1);
          sprite.setDepth(1);
          this.decorSprites.set(decoration.id, sprite);
        } else if (sprite.texture.key !== key) {
          sprite.setTexture(key);
        }

        sprite.setPosition(decoration.screenX, decoration.bottom);
        sprite.setDisplaySize(decoration.width, decoration.height);
        sprite.setVisible(true);
        visibleIds.add(decoration.id);
      });

      this.decorSprites.forEach((sprite, id) => {
        if (!visibleIds.has(id)) {
          sprite.setVisible(false);
        }
      });
    }

    drawBackgroundGrid(graphics) {
      graphics.lineStyle(1, 0x253045, 0.75);
      const tileSize = this.tileSize || window.TechnoDash.Level.getTileSize();
      const offset = Math.floor(this.scrollX % tileSize);
      for (let x = -offset; x < this.worldWidth + tileSize; x += tileSize) {
        graphics.lineBetween(x, 0, x, this.worldHeight);
      }
      for (let y = this.groundY % tileSize; y < this.groundY; y += tileSize) {
        graphics.lineBetween(0, y, this.worldWidth, y);
      }
    }

    drawGround(graphics) {
      graphics.fillStyle(0x2f3747, 1);
      graphics.fillRect(0, this.groundY, this.worldWidth, this.worldHeight - this.groundY);
      graphics.lineStyle(4, 0xf0c04a, 1);
      graphics.lineBetween(0, this.groundY, this.worldWidth, this.groundY);
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

        if (object.type === "triangle") {
          graphics.fillStyle(0xd9433e, 1);
          graphics.fillTriangle(object.left, object.bottom, object.screenX, object.top, object.right, object.bottom);
          graphics.lineStyle(2, 0xffffff, 0.7);
          graphics.strokeTriangle(object.left, object.bottom, object.screenX, object.top, object.right, object.bottom);
          return;
        }

        if (object.type === "block") {
          const colors = window.TechnoDash.Level.getObstacleColorStyle(object.type, object.color);
          graphics.fillStyle(window.TechnoDash.Level.hexToNumber(colors.color, 0xf0b429), 1);
          graphics.fillRect(object.left, object.top, object.width, object.height);
          graphics.fillStyle(window.TechnoDash.Level.hexToNumber(colors.danger, 0xc7352f), 1);
          graphics.fillRect(object.left, object.top + 6, Math.min(12, object.width * 0.24), object.height - 12);
          graphics.lineStyle(2, window.TechnoDash.Level.hexToNumber(colors.stroke, 0x4d3500), 0.8);
          graphics.strokeRect(object.left, object.top, object.width, object.height);
          return;
        }

        if (window.TechnoDash.Level.isSolidBlockType(object.type)) {
          const colors = window.TechnoDash.Level.getObstacleColorStyle(object.type, object.color);
          graphics.fillStyle(window.TechnoDash.Level.hexToNumber(colors.color, 0x5aa7e8), 1);
          graphics.fillRect(object.left, object.top, object.width, object.height);
          return;
        }

        if (object.type === "platform") {
          const colors = window.TechnoDash.Level.getObstacleColorStyle(object.type, object.color);
          graphics.fillStyle(window.TechnoDash.Level.hexToNumber(colors.color, 0x35b6a6), 1);
          graphics.fillRect(object.left, object.top, object.width, object.height);
          return;
        }

        this.drawFinish(graphics, object);
      });
    }

    drawFinish(graphics, object) {
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
