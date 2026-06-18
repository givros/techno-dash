(() => {
  window.TechnoDash = window.TechnoDash || {};

  class Level {
    constructor(levelData) {
      this.data = Level.normalize(levelData);
    }

    static getDefaultData() {
      return {
        length: 8000,
        tileSize: Level.getTileSize(),
        settings: {
          speed: 280,
          gravity: 1350,
          jumpForce: 560,
          backgroundColor: "#071322"
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

      const length = Level.snapLength(Level.clampNumber(source.length, 1216, 60000, defaults.length));
      const columns = Math.round(length / Level.getTileSize());
      const rawObstacles = Array.isArray(source.obstacles) ? source.obstacles : defaults.obstacles;
      const obstacles = rawObstacles
        .filter((obstacle) => obstacle && Level.getObstacleTypes().includes(obstacle.type))
        .map((obstacle, index) => Level.normalizeObstacle(obstacle, index, length));
      const rawDecorations = Array.isArray(source.decorations) ? source.decorations : defaults.decorations;
      const decorations = rawDecorations
        .filter((decoration) => decoration && Level.getDecorationForType(decoration.type))
        .map((decoration, index) => Level.normalizeDecoration(decoration, index, length));

      return {
        length,
        columns,
        tileSize: Level.getTileSize(),
        settings,
        obstacles,
        decorations
      };
    }

    static normalizeObstacle(obstacle, index, length) {
      const type = obstacle.type;
      const dimensions = Level.getDimensionsForType(type);
      const maxColumn = Level.getMaxColumnForWidth(length, dimensions.width);
      const sourceColumn = Level.getColumnFromX(
        Level.clampNumber(obstacle.x, dimensions.width / 2, length - dimensions.width / 2, 600),
        dimensions.width
      );
      const sourceRow = Level.getRowFromY(Level.clampNumber(obstacle.y, 0, Level.getTileSize() * Level.getMaxVisibleRow(), 0));
      const column = Level.clampInteger(obstacle.column, 0, maxColumn, sourceColumn);
      const row = Level.clampInteger(obstacle.row, 0, Level.getMaxVisibleRow(), sourceRow);
      const normalized = {
        id: obstacle.id || `${type}-${Date.now()}-${index}`,
        type,
        column,
        row,
        x: Level.getXForColumn(column, dimensions.width),
        y: Level.getYForRow(row),
        width: dimensions.width,
        height: dimensions.height
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
      const maxColumn = Level.getMaxColumnForWidth(length, dimensions.width);
      const sourceColumn = Level.getColumnFromX(
        Level.clampNumber(decoration.x, dimensions.width / 2, length - dimensions.width / 2, 400),
        dimensions.width
      );
      const sourceRow = Level.getRowFromY(Level.clampNumber(decoration.y, 0, Level.getTileSize() * Level.getMaxVisibleRow(), 0));
      const column = Level.clampInteger(decoration.column, 0, maxColumn, sourceColumn);
      const row = Level.clampInteger(decoration.row, 0, Level.getMaxVisibleRow(), sourceRow);
      return {
        id: decoration.id || `decor-${type}-${Date.now()}-${index}`,
        type,
        column,
        row,
        x: Level.getXForColumn(column, dimensions.width),
        y: Level.getYForRow(row),
        width: dimensions.width,
        height: dimensions.height
      };
    }

    static getTileSize() {
      return 32;
    }

    static getPlayerSize() {
      return Level.getTileSize();
    }

    static getViewportTileColumns() {
      return 50;
    }

    static getVisibleTileRows() {
      return 20;
    }

    static getGroundMarginRows() {
      return 1;
    }

    static getViewportTileRows() {
      return Level.getVisibleTileRows() + Level.getGroundMarginRows();
    }

    static getMaxVisibleRow() {
      return Level.getVisibleTileRows() - 1;
    }

    static getViewportSize() {
      const tileSize = Level.getTileSize();
      return {
        width: tileSize * Level.getViewportTileColumns(),
        height: tileSize * Level.getViewportTileRows()
      };
    }

    static snapLength(value) {
      const tileSize = Level.getTileSize();
      return Math.max(tileSize, Math.ceil(value / tileSize) * tileSize);
    }

    static snapXToTileCenter(value) {
      const tileSize = Level.getTileSize();
      return Math.floor(value / tileSize) * tileSize + tileSize / 2;
    }

    static snapYToTile(value) {
      const tileSize = Level.getTileSize();
      return Math.floor(value / tileSize) * tileSize;
    }

    static getColumnFromX(value, width = Level.getTileSize()) {
      const tileSize = Level.getTileSize();
      const centerX = Number(value) || 0;
      return Math.max(0, Math.floor((centerX - Number(width || tileSize) / 2) / tileSize));
    }

    static getRowFromY(value) {
      return Math.max(0, Math.floor(Number(value) / Level.getTileSize()));
    }

    static getXForColumn(column, width = Level.getTileSize()) {
      return Level.clampInteger(column, 0, 999999, 0) * Level.getTileSize() + Number(width || Level.getTileSize()) / 2;
    }

    static getYForRow(row) {
      return Level.clampInteger(row, 0, 999999, 0) * Level.getTileSize();
    }

    static getDimensionsForType(type) {
      const tileSize = Level.getTileSize();
      if (type === "platform") {
        return { width: tileSize * 2, height: tileSize };
      }

      return { width: tileSize, height: tileSize };
    }

    static getObstacleTypes() {
      return ["triangle", "block", "platform", "solidBlock", "dirtBlock", "iceBlock", "grassBlock", "finish"];
    }

    static getSolidBlockTypes() {
      return ["solidBlock", "dirtBlock", "iceBlock", "grassBlock"];
    }

    static isSolidBlockType(type) {
      return Level.getSolidBlockTypes().includes(type);
    }

    static getMaterialBlockStyles() {
      return {
        dirtBlock: { name: "dirt", color: "#8b5a32" },
        iceBlock: { name: "ice", color: "#8fd8ff" },
        grassBlock: { name: "grass", color: "#58c76d" }
      };
    }

    static getMaterialBlockStyle(type) {
      return Level.getMaterialBlockStyles()[type] || null;
    }

    static getMaxColumnForWidth(length, width = Level.getTileSize()) {
      const tileSize = Level.getTileSize();
      return Math.max(0, Math.floor((Number(length) - Number(width || tileSize)) / tileSize));
    }

    static getColorPalettes() {
      return {
        block: [
          { name: "gold", color: "#f0b429", accent: "#c7352f", stroke: "#8f6500", danger: "#c7352f" },
          { name: "red", color: "#ef4444", accent: "#fca5a5", stroke: "#991b1b", danger: "#7f1d1d" },
          { name: "violet", color: "#8b5cf6", accent: "#c4b5fd", stroke: "#5b21b6", danger: "#ef4444" },
          { name: "blue", color: "#3b82f6", accent: "#93c5fd", stroke: "#1d4ed8", danger: "#ef4444" },
          { name: "green", color: "#22c55e", accent: "#86efac", stroke: "#15803d", danger: "#ef4444" }
        ],
        platform: [
          { name: "teal", color: "#35b6a6", accent: "#7ee4d6", stroke: "#0f5f59" },
          { name: "blue", color: "#3b82f6", accent: "#93c5fd", stroke: "#1d4ed8" },
          { name: "green", color: "#22c55e", accent: "#86efac", stroke: "#15803d" },
          { name: "violet", color: "#8b5cf6", accent: "#c4b5fd", stroke: "#5b21b6" },
          { name: "orange", color: "#f97316", accent: "#fed7aa", stroke: "#c2410c" }
        ],
        solidBlock: [
          { name: "blue", color: "#5aa7e8", accent: "#9bd0ff", stroke: "#1f5f93" },
          { name: "steel", color: "#64748b", accent: "#cbd5e1", stroke: "#334155" },
          { name: "violet", color: "#8b5cf6", accent: "#c4b5fd", stroke: "#5b21b6" },
          { name: "green", color: "#10b981", accent: "#a7f3d0", stroke: "#047857" },
          { name: "pink", color: "#ec4899", accent: "#fbcfe8", stroke: "#be185d" }
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
      if (Level.getMaterialBlockStyle(type)) {
        return Level.getMaterialBlockStyle(type);
      }

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
      return {
        width: Level.clampNumber(decoration && decoration.width, Level.getTileSize(), Level.getTileSize() * 8, Level.getTileSize()),
        height: Level.clampNumber(decoration && decoration.height, Level.getTileSize(), Level.getTileSize() * 8, Level.getTileSize())
      };
    }

    static clampNumber(value, min, max, fallback) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return fallback;
      }

      return Math.min(max, Math.max(min, number));
    }

    static clampInteger(value, min, max, fallback) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return Math.min(max, Math.max(min, Math.floor(fallback)));
      }

      return Math.min(max, Math.max(min, Math.floor(number)));
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

    getScreenObjects(scrollX, groundY) {
      return this.data.obstacles.map((obstacle) => {
        const screenX = obstacle.x - scrollX;
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

    getScreenDecorations(scrollX, groundY) {
      return this.data.decorations.map((decoration) => {
        const screenX = decoration.x - scrollX;
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
