(() => {
  window.TechnoDash = window.TechnoDash || {};

  class Level {
    constructor(levelData) {
      this.data = Level.normalize(levelData);
    }

    static getDefaultData() {
      return {
        length: 8000,
        settings: {
          speed: 280,
          gravity: 1350,
          jumpForce: 560
        },
        obstacles: [],
        decorations: []
      };
    }

    static normalize(levelData) {
      const source = levelData && typeof levelData === "object" ? levelData : Level.getDefaultData();
      const defaults = Level.getDefaultData();
      const settings = {
        speed: Level.clampNumber(source.settings && source.settings.speed, 120, 520, defaults.settings.speed),
        gravity: Level.clampNumber(source.settings && source.settings.gravity, 600, 2400, defaults.settings.gravity),
        jumpForce: Level.clampNumber(source.settings && source.settings.jumpForce, 260, 900, defaults.settings.jumpForce)
      };

      const length = Level.clampNumber(source.length, 1200, 60000, defaults.length);
      const rawObstacles = Array.isArray(source.obstacles) ? source.obstacles : defaults.obstacles;
      const obstacles = rawObstacles
        .filter((obstacle) => obstacle && ["triangle", "block", "platform", "solidBlock", "finish"].includes(obstacle.type))
        .map((obstacle, index) => Level.normalizeObstacle(obstacle, index, length));
      const rawDecorations = Array.isArray(source.decorations) ? source.decorations : defaults.decorations;
      const decorations = rawDecorations
        .filter((decoration) => decoration && Level.getDecorationForType(decoration.type))
        .map((decoration, index) => Level.normalizeDecoration(decoration, index, length));

      return {
        length,
        settings,
        obstacles,
        decorations
      };
    }

    static normalizeObstacle(obstacle, index, length) {
      const type = obstacle.type;
      const dimensions = Level.getDimensionsForType(type);
      const maxWidth = type === "platform" ? 220 : 90;
      return {
        id: obstacle.id || `${type}-${Date.now()}-${index}`,
        type,
        x: Level.clampNumber(obstacle.x, 260, length - 120, 600),
        y: Level.clampNumber(obstacle.y, 0, 300, 0),
        width: Level.clampNumber(obstacle.width, 18, maxWidth, dimensions.width),
        height: Level.clampNumber(obstacle.height, 24, 140, dimensions.height)
      };
    }

    static normalizeDecoration(decoration, index, length) {
      const type = decoration.type;
      const dimensions = Level.getDecorationDimensionsForType(type);
      return {
        id: decoration.id || `decor-${type}-${Date.now()}-${index}`,
        type,
        x: Level.clampNumber(decoration.x, 120, length - 80, 400),
        y: Level.clampNumber(decoration.y, 0, 320, 0),
        width: Level.clampNumber(decoration.width, 24, 180, dimensions.width),
        height: Level.clampNumber(decoration.height, 24, 220, dimensions.height)
      };
    }

    static getDimensionsForType(type) {
      if (type === "block") {
        return { width: 50, height: 50 };
      }

      if (type === "platform") {
        return { width: 120, height: 32 };
      }

      if (type === "solidBlock") {
        return { width: 52, height: 52 };
      }

      if (type === "finish") {
        return { width: 28, height: 112 };
      }

      return { width: 44, height: 44 };
    }

    static getDecorationTypes() {
      return Array.isArray(window.TechnoDash.DecorCatalog)
        ? window.TechnoDash.DecorCatalog
        : [];
    }

    static getDecorationForType(type) {
      return Level.getDecorationTypes().find((decoration) => decoration.type === type) || null;
    }

    static getDecorationDimensionsForType(type) {
      const decoration = Level.getDecorationForType(type);
      return decoration
        ? { width: decoration.width, height: decoration.height }
        : { width: 52, height: 52 };
    }

    static clampNumber(value, min, max, fallback) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return fallback;
      }

      return Math.min(max, Math.max(min, number));
    }

    getSettings() {
      return this.data.settings;
    }

    getObstacles() {
      return this.data.obstacles;
    }

    getDecorations() {
      return this.data.decorations;
    }

    getFinish() {
      return this.data.obstacles.find((obstacle) => obstacle.type === "finish");
    }

    getScreenObjects(scrollX, playerAnchorX, groundY) {
      return this.data.obstacles.map((obstacle) => {
        const screenX = playerAnchorX + obstacle.x - scrollX;
        const bottom = groundY - obstacle.y;
        return {
          ...obstacle,
          screenX,
          groundY,
          left: screenX - obstacle.width / 2,
          right: screenX + obstacle.width / 2,
          top: bottom - obstacle.height,
          bottom
        };
      });
    }

    getScreenDecorations(scrollX, playerAnchorX, groundY) {
      return this.data.decorations.map((decoration) => {
        const screenX = playerAnchorX + decoration.x - scrollX;
        const bottom = groundY - decoration.y;
        return {
          ...decoration,
          screenX,
          groundY,
          left: screenX - decoration.width / 2,
          right: screenX + decoration.width / 2,
          top: bottom - decoration.height,
          bottom
        };
      });
    }

    toJSON() {
      return JSON.parse(JSON.stringify(this.data));
    }
  }

  window.TechnoDash.Level = Level;
})();
