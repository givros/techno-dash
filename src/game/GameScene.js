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
      this.restartQueued = false;
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

      return {
        active,
        initializationBlocks,
        gameplayBlocks,
        loopBlocks,
        loopSet,
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
      this.levelGraphics = this.add.graphics();
      this.levelGraphics.setDepth(2);
      this.player = new window.TechnoDash.Player(this, this.playerX, this.groundY);
      this.syncProgramVisuals();
      this.keys = this.input.keyboard.addKeys({
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
        enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
        r: Phaser.Input.Keyboard.KeyCodes.R
      });
      this.input.keyboard.on("keydown-ENTER", (event) => {
        if (!this.shouldIgnoreKeyboardEvent(event)) {
          this.restartQueued = true;
        }
      });
      this.handleGlobalKeydown = (event) => this.onGlobalKeydown(event);
      window.addEventListener("keydown", this.handleGlobalKeydown);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener("keydown", this.handleGlobalKeydown);
      });

      this.created = true;
      this.reset(this.pendingPlay);
      this.pendingPlay = false;
    }

    setCallbacks(callbacks) {
      this.uiCallbacks = callbacks || {};
      this.publishState();
    }

    setProgramState(programState) {
      this.programFeatures = GameScene.createProgramFeatures(programState);

      if (!this.created) {
        return;
      }

      this.syncProgramVisuals();
      if (!this.isPlaying()) {
        this.reset(false);
      } else {
        this.renderWorld();
        this.publishState();
      }
    }

    syncProgramVisuals() {
      if (this.player && this.player.sprite) {
        this.player.sprite.setVisible(this.programFeatures.player);
      }
    }

    loadLevel(levelData, options = {}) {
      this.levelData = window.TechnoDash.Level.normalize(levelData);

      if (!this.created) {
        this.pendingPlay = Boolean(options.play);
        return;
      }

      this.level = new window.TechnoDash.Level(this.levelData);
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
      this.publishState();
    }

    stop() {
      this.running = false;
      this.status = this.ended ? this.status : "Paused";
      this.publishState();
    }

    reset(shouldPlay) {
      this.scrollX = 0;
      this.distance = 0;
      this.score = 0;
      this.reachedFinish = false;
      this.ended = false;
      this.running = Boolean(shouldPlay);
      this.status = shouldPlay ? "Playing" : "Ready";
      this.spaceWasDown = false;
      this.restartWasDown = false;
      this.jumpQueued = false;
      this.restartQueued = false;
      this.player.reset(this.getRuntimeSettings());
      this.renderWorld();
      this.publishState();
    }

    isPlaying() {
      return this.running && !this.ended;
    }

    update(time, deltaMs) {
      if (!this.created) {
        return;
      }

      const keyboardBlocked = this.shouldIgnoreGameKeyboard();
      if (keyboardBlocked) {
        this.restartQueued = false;
      }

      const restartDown = keyboardBlocked
        ? false
        : this.keys.r.isDown || this.keys.enter.isDown || (this.ended && this.keys.space.isDown);
      const restartTriggered = (restartDown && !this.restartWasDown) || this.restartQueued;
      if (restartTriggered) {
        this.restartFromInput(restartDown);
        return;
      }
      this.restartQueued = false;
      this.restartWasDown = restartDown;

      if (this.running && !this.ended) {
        const settings = this.getRuntimeSettings();
        const deltaSeconds = Math.min(deltaMs / 1000, 0.033);
        const spaceDown = keyboardBlocked ? false : this.keys.space.isDown;
        const inputContext = {
          spacePressed: (spaceDown && !this.spaceWasDown) || this.jumpQueued,
          playerGrounded: this.player.grounded
        };

        if (this.programFeatures.player && this.shouldRunAction("jump", inputContext)) {
          this.player.tryJump(settings.jumpForce);
        }

        const previousScrollX = this.scrollX;
        if (this.hasLoopBlock("moveLevel")) {
          this.scrollX += settings.speed * deltaSeconds;
        }

        const applyGravity = this.hasLoopBlock("applyGravity");
        const playerIsMoving = this.player.velocityY !== 0 || !this.player.grounded;
        if (this.programFeatures.player && (applyGravity || playerIsMoving)) {
          const previousPlayerBounds = this.player.getBounds();
          this.player.update(deltaSeconds, settings, { applyGravity });
          this.resolvePlatformCollisions(previousPlayerBounds);
        }
        const reachedFinish = this.checkFinishCollision(inputContext);
        const playerStoppedByLevel = reachedFinish
          ? false
          : this.resolveSolidBlockSideCollisions(previousScrollX);

        this.jumpQueued = false;
        this.spaceWasDown = spaceDown;
        this.distance = Math.max(0, Math.floor(this.scrollX));
        this.score = this.distance;
        if (reachedFinish) {
          // Victory has priority when the cube reaches the finish on the same frame as another collision.
        } else if (playerStoppedByLevel) {
          this.endGame("Game Over");
        } else {
          this.checkCollisions(inputContext);
        }
      } else {
        this.spaceWasDown = keyboardBlocked ? false : this.keys.space.isDown;
        this.jumpQueued = false;
      }

      this.renderWorld();
      this.publishState();
    }

    restartFromInput(restartDown) {
      this.restartQueued = false;
      this.reset(true);
      this.restartWasDown = Boolean(restartDown);
      this.spaceWasDown = Boolean(this.keys && this.keys.space && this.keys.space.isDown);
      this.jumpQueued = false;
    }

    getRuntimeSettings() {
      return this.level.getSettings();
    }

    hasLoopBlock(blockId) {
      return this.programFeatures.hasLoop && this.programFeatures.loopSet.has(blockId);
    }

    shouldRunAction(actionId, context = {}) {
      if (!this.programFeatures.hasLoop) {
        return false;
      }

      const actionIndex = this.programFeatures.loopBlocks.indexOf(actionId);
      if (actionIndex === -1) {
        return false;
      }

      const conditions = [];
      for (let index = actionIndex - 1; index >= 0; index -= 1) {
        const blockId = this.programFeatures.loopBlocks[index];
        if (!GameScene.isConditionBlock(blockId)) {
          break;
        }
        conditions.unshift(blockId);
      }

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
        event.preventDefault();
        if (this.ended) {
          this.restartQueued = true;
        } else {
          this.jumpQueued = true;
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
        event.preventDefault();
        this.restartQueued = true;
      }
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

    checkCollisions(inputContext = {}) {
      const screenObjects = this.level.getScreenObjects(this.scrollX, this.groundY);
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
        this.level.getScreenObjects(this.scrollX, this.groundY)
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
        return;
      }

      const screenObjects = this.level.getScreenObjects(this.scrollX, this.groundY);
      const platform = window.TechnoDash.CollisionManager.findPlatformLanding(
        this.player.getBounds(),
        previousPlayerBounds,
        screenObjects,
        this.player.velocityY
      );

      if (platform) {
        this.player.landOn(platform.top);
      }
    }

    resolveSolidBlockSideCollisions(previousScrollX) {
      if (!this.programFeatures.obstacles || !this.hasLoopBlock("moveLevel")) {
        return false;
      }

      const screenObjects = this.level.getScreenObjects(this.scrollX, this.groundY);
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
      return true;
    }

    endGame(status) {
      this.running = false;
      this.ended = true;
      this.status = status;
      this.publishState();
    }

    renderWorld() {
      if (!this.backgroundGraphics || !this.levelGraphics) {
        return;
      }

      const backgroundGraphics = this.backgroundGraphics;
      const graphics = this.levelGraphics;
      const settings = this.getRuntimeSettings();
      backgroundGraphics.clear();
      graphics.clear();
      backgroundGraphics.fillStyle(window.TechnoDash.Level.hexToNumber(settings.backgroundColor, 0x071322), 1);
      backgroundGraphics.fillRect(0, 0, this.worldWidth, this.worldHeight);

      if (this.programFeatures.background) {
        this.drawBackgroundGrid(backgroundGraphics);
      }
      if (this.programFeatures.ground) {
        this.drawGround(backgroundGraphics);
      }
      this.renderDecorations();
      this.drawLevelObjects(graphics);
      this.syncProgramVisuals();
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
      const decorations = this.level.getScreenDecorations(this.scrollX, this.groundY);
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
      const screenObjects = this.level.getScreenObjects(this.scrollX, this.groundY);

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

    publishState() {
      if (typeof this.uiCallbacks.onStats === "function") {
        this.uiCallbacks.onStats({
          status: this.status,
          distance: this.distance,
          score: this.score,
          ended: this.ended,
          showDistance: this.hasLoopBlock("showDistance"),
          showScore: this.hasLoopBlock("showScore"),
          reachedFinish: this.reachedFinish,
          grounded: this.player ? this.player.grounded : true,
          playerY: this.player ? Math.round(this.player.y) : 0
        });
      }
    }
  }

  window.TechnoDash.GameScene = GameScene;
})();
