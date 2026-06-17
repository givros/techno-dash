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
          jumpForce: 560,
          backgroundColor: "#121722"
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
        jumpForce: Level.clampNumber(source.settings && source.settings.jumpForce, 260, 900, defaults.settings.jumpForce),
        backgroundColor: Level.normalizeHexColor(source.settings && source.settings.backgroundColor, defaults.settings.backgroundColor)
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
      const normalized = {
        id: obstacle.id || `${type}-${Date.now()}-${index}`,
        type,
        x: Level.clampNumber(obstacle.x, 260, length - 120, 600),
        y: Level.clampNumber(obstacle.y, 0, 300, 0),
        width: Level.clampNumber(obstacle.width, 18, maxWidth, dimensions.width),
        height: Level.clampNumber(obstacle.height, 24, 140, dimensions.height)
      };

      const color = Level.normalizeObstacleColor(type, obstacle.color);
      if (color) {
        normalized.color = color;
      }

      return normalized;
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

    static getColorPalettes() {
      return {
        block: [
          { name: "or", color: "#f0b429", accent: "#c7352f", stroke: "#8f6500", danger: "#c7352f" },
          { name: "rouge", color: "#ef4444", accent: "#fca5a5", stroke: "#991b1b", danger: "#7f1d1d" },
          { name: "violet", color: "#8b5cf6", accent: "#c4b5fd", stroke: "#5b21b6", danger: "#ef4444" },
          { name: "bleu", color: "#3b82f6", accent: "#93c5fd", stroke: "#1d4ed8", danger: "#ef4444" },
          { name: "vert", color: "#22c55e", accent: "#86efac", stroke: "#15803d", danger: "#ef4444" }
        ],
        platform: [
          { name: "turquoise", color: "#35b6a6", accent: "#7ee4d6", stroke: "#0f5f59" },
          { name: "bleu", color: "#3b82f6", accent: "#93c5fd", stroke: "#1d4ed8" },
          { name: "vert", color: "#22c55e", accent: "#86efac", stroke: "#15803d" },
          { name: "violet", color: "#8b5cf6", accent: "#c4b5fd", stroke: "#5b21b6" },
          { name: "orange", color: "#f97316", accent: "#fed7aa", stroke: "#c2410c" }
        ],
        solidBlock: [
          { name: "bleu", color: "#5aa7e8", accent: "#9bd0ff", stroke: "#1f5f93" },
          { name: "acier", color: "#64748b", accent: "#cbd5e1", stroke: "#334155" },
          { name: "violet", color: "#8b5cf6", accent: "#c4b5fd", stroke: "#5b21b6" },
          { name: "vert", color: "#10b981", accent: "#a7f3d0", stroke: "#047857" },
          { name: "rose", color: "#ec4899", accent: "#fbcfe8", stroke: "#be185d" }
        ]
      };
    }

    static isColorableObstacle(type) {
      return Boolean(Level.getColorPalettes()[type]);
    }

    static getDefaultColorForType(type) {
      const palette = Level.getColorPalettes()[type];
      return palette ? palette[0].color : null;
    }

    static normalizeObstacleColor(type, value) {
      const fallback = Level.getDefaultColorForType(type);
      return fallback ? Level.normalizeHexColor(value, fallback) : null;
    }

    static normalizeHexColor(value, fallback) {
      const source = typeof value === "string" ? value.trim() : "";
      const withHash = source.startsWith("#") ? source : `#${source}`;
      if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
        return withHash.toLowerCase();
      }

      if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
        const [, r, g, b] = withHash;
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
      }

      return fallback;
    }

    static getObstacleColorStyle(type, color) {
      const normalizedColor = Level.normalizeObstacleColor(type, color);
      const palette = Level.getColorPalettes()[type] || [];
      const preset = palette.find((item) => item.color === normalizedColor) || palette[0];
      if (!preset) {
        return null;
      }

      return {
        name: preset.name,
        color: normalizedColor,
        accent: preset.accent,
        stroke: preset.stroke,
        danger: preset.danger || preset.accent
      };
    }

    static hexToNumber(color, fallback) {
      const normalized = Level.normalizeHexColor(color, null);
      return normalized ? parseInt(normalized.slice(1), 16) : fallback;
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
