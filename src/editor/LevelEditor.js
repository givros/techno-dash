(() => {
  window.TechnoDash = window.TechnoDash || {};

  class LevelEditor {
    constructor(options = {}) {
      this.onLevelChange = options.onLevelChange || function noop() {};
      this.onRequestClearLevel = options.onRequestClearLevel || (() => this.clearLevel());
      this.levelData = window.TechnoDash.Level.normalize(options.levelData || window.TechnoDash.Level.getDefaultData());
      this.selectedTool = "solidBlock";
      this.selectedObstacleId = null;
      this.selectedElementIds = new Set();
      this.clipboard = null;
      this.history = [this.cloneLevelData(this.levelData)];
      this.historyIndex = 0;
      this.isApplyingHistory = false;
      this.activeLayer = "gameplay";
      this.tileSize = window.TechnoDash.Level.getTileSize();
      this.basePixelsPerLevelUnit = 1;
      this.zoomRatio = 1;
      this.pixelsPerLevelUnit = this.basePixelsPerLevelUnit;
      this.extendMargin = this.tileSize * 20;
      this.extendAmount = this.tileSize * 80;
      this.groundOffset = this.tileSize * window.TechnoDash.Level.getGroundMarginRows();
      this.horizontalSnap = this.tileSize;
      this.verticalSnap = this.tileSize;
      this.isPanning = false;
      this.moveDrag = null;
      this.rectangleDrag = null;
      this.ignoreNextGridClick = false;
      this.rectangleFillType = "solidBlock";
      this.grid = document.getElementById("level-grid");
      this.scrollContainer = document.getElementById("level-scroll");
      this.scrollFrame = this.scrollContainer ? this.scrollContainer.closest(".level-scroll-frame") : null;
      this.toolPalette = document.querySelector(".level-tool-palette");
      this.decorPalette = document.getElementById("decor-palette");
      this.colorPanel = document.getElementById("block-color-panel");
      this.groundThemePalette = document.getElementById("ground-theme-palette");
      this.selectedColors = this.getDefaultSelectedColors();
      this.renderGameplayTools();
      this.renderDecorationTools();
      this.renderGroundThemeControls();
      this.renderColorControls();
      this.toolButtons = [...document.querySelectorAll(".tool-button")];
      this.groundThemeButtons = [...document.querySelectorAll("#ground-theme-palette [data-ground-theme]")];
      this.actionButtons = [...document.querySelectorAll("[data-editor-action]")];
      this.layerButtons = [...document.querySelectorAll("[data-editor-layer]")];
      this.paletteTabs = [...document.querySelectorAll("[data-palette-tab]")];
      this.palettePanels = [...document.querySelectorAll(".palette-tab-panel")];
      this.deleteButton = document.getElementById("delete-obstacle-button");
      this.clearButton = document.getElementById("clear-level-button");
      this.selectedInfo = document.getElementById("selected-obstacle-info");
      this.tileCoordinateLabel = document.getElementById("tile-coordinate-label");
      this.lengthLabel = document.getElementById("level-length-label");
      this.speedInput = document.getElementById("speed-input");
      this.gravityInput = document.getElementById("gravity-input");
      this.jumpInput = document.getElementById("jump-input");
      this.backgroundColorInput = document.getElementById("background-color-input");
      this.groundThemeSelect = document.getElementById("ground-theme-select");
      this.deathAnimationSelect = document.getElementById("death-animation-select");
      this.preview = null;
      this.rectanglePreview = null;
      this.toolCursor = null;
      this.paletteHoverPreview = this.createPaletteHoverPreview();
      this.handleKeyboardShortcut = (event) => this.onKeyboardShortcut(event);
      this.bindEvents();
      document.addEventListener("keydown", this.handleKeyboardShortcut);
      window.addEventListener("resize", () => this.render());
      this.preview = this.createPlacementPreview();
      this.rectanglePreview = this.createRectanglePreview();
      this.toolCursor = this.createToolCursor();
      this.setSelectedTool(this.selectedTool);
      this.syncInputs();
      this.render();
    }

    renderGameplayTools() {
      if (!this.toolPalette) {
        return;
      }

      this.toolPalette.innerHTML = "";
      window.TechnoDash.Level.getGameplayToolGroups().forEach((group) => {
        const section = document.createElement("section");
        section.className = "gameplay-category";
        section.dataset.gameplayCategory = group.id;

        const title = document.createElement("h3");
        title.className = "gameplay-category-title";
        title.textContent = group.label;
        section.appendChild(title);

        const grid = document.createElement("div");
        grid.className = "gameplay-category-grid";
        group.tools.forEach((tool) => {
          grid.appendChild(this.createGameplayToolButton(tool));
        });
        section.appendChild(grid);
        this.toolPalette.appendChild(section);
      });
    }

    createGameplayToolButton(tool) {
      const button = document.createElement("button");
      button.className = "palette-card tool-button";
      if (tool.type === this.selectedTool) {
        button.classList.add("is-active");
      }
      button.type = "button";
      button.dataset.tool = tool.type;

      const swatch = document.createElement("span");
      swatch.className = "palette-preview tool-swatch";
      swatch.dataset.type = tool.type;
      button.appendChild(swatch);

      const label = document.createElement("strong");
      label.textContent = tool.label;
      button.appendChild(label);

      const note = document.createElement("small");
      note.textContent = tool.note;
      button.appendChild(note);

      return button;
    }

    renderDecorationTools() {
      if (!this.decorPalette) {
        return;
      }

      this.decorPalette.querySelectorAll("[data-dynamic-decor]").forEach((element) => element.remove());
      const groups = this.groupDecorationsByTheme(window.TechnoDash.Level.getDecorationTypes());
      groups.forEach((group) => {
        const section = document.createElement("section");
        section.className = "decor-category";
        section.dataset.dynamicDecor = "true";

        const title = document.createElement("h3");
        title.className = "decor-category-title";
        title.textContent = group.label;
        section.appendChild(title);

        const grid = document.createElement("div");
        grid.className = "decor-category-grid";
        group.decorations.forEach((decoration) => {
          const button = this.createDecorationToolButton(decoration);
          grid.appendChild(button);
        });
        section.appendChild(grid);
        this.decorPalette.appendChild(section);
      });
    }

    groupDecorationsByTheme(decorations) {
      const themeOrder = ["city", "winter", "forest", "desert", "space", "candy", "ocean", "castle", "industrial", "volcano"];
      const themeLabels = {
        city: "City",
        winter: "Winter",
        forest: "Forest",
        desert: "Desert",
        space: "Space",
        candy: "Candy",
        ocean: "Ocean",
        castle: "Castle",
        industrial: "Industrial",
        volcano: "Volcano",
        other: "Other"
      };
      const groups = new Map(themeOrder.map((theme) => [theme, []]));
      decorations.forEach((decoration) => {
        const theme = themeOrder.includes(decoration.theme) ? decoration.theme : "other";
        if (!groups.has(theme)) {
          groups.set(theme, []);
        }
        groups.get(theme).push(decoration);
      });

      return [...groups.entries()]
        .filter(([, groupDecorations]) => groupDecorations.length > 0)
        .map(([theme, groupDecorations]) => ({
          label: themeLabels[theme] || this.formatDecorationLabel({ type: theme }),
          decorations: groupDecorations
        }));
    }

    createDecorationToolButton(decoration) {
      const button = document.createElement("button");
      button.className = "palette-card tool-button";
      button.type = "button";
      button.dataset.tool = `decor-${decoration.type}`;
      button.dataset.dynamicDecor = "true";

      const swatch = document.createElement("span");
      swatch.className = "palette-preview tool-swatch";
      swatch.dataset.type = `decor-${decoration.type}`;
      swatch.style.backgroundImage = `url("assets/decor/${decoration.file}")`;
      button.appendChild(swatch);

      const label = document.createElement("strong");
      label.textContent = this.formatDecorationLabel(decoration);
      button.appendChild(label);

      const note = document.createElement("small");
      note.textContent = "decor";
      button.appendChild(note);

      return button;
    }

    renderGroundThemeControls() {
      if (!this.groundThemePalette) {
        return;
      }

      this.groundThemePalette.innerHTML = "";
      window.TechnoDash.Level.getGroundThemes().forEach((theme) => {
        const button = document.createElement("button");
        button.className = "palette-card ground-theme-button";
        button.type = "button";
        button.dataset.groundTheme = theme.id;

        const preview = document.createElement("span");
        preview.className = "palette-preview ground-theme-preview";
        preview.dataset.groundThemePreview = theme.id;
        button.appendChild(preview);

        const label = document.createElement("strong");
        label.textContent = theme.label;
        button.appendChild(label);

        const note = document.createElement("small");
        note.textContent = "ground";
        button.appendChild(note);

        this.groundThemePalette.appendChild(button);
      });
    }

    getDefaultSelectedColors() {
      return Object.fromEntries(
        Object.keys(window.TechnoDash.Level.getColorPalettes()).map((type) => [
          type,
          window.TechnoDash.Level.getDefaultColorForType(type)
        ])
      );
    }

    renderColorControls() {
      if (!this.colorPanel) {
        return;
      }

      this.colorPanel.innerHTML = "";
      const title = document.createElement("div");
      title.className = "block-color-title";
      title.textContent = "Colors";
      this.colorPanel.appendChild(title);

      Object.entries(window.TechnoDash.Level.getColorPalettes())
        .filter(([type]) => type !== "block")
        .forEach(([type, colors]) => {
        const group = document.createElement("div");
        group.className = "block-color-group";
        group.dataset.colorType = type;

        const label = document.createElement("span");
        label.textContent = this.getShortTypeLabel(type);
        group.appendChild(label);

        const swatches = document.createElement("div");
        swatches.className = "block-color-swatches";
        colors.forEach((colorInfo) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "block-color-option";
          button.dataset.colorType = type;
          button.dataset.color = colorInfo.color;
          button.setAttribute("aria-label", `${this.getShortTypeLabel(type)} ${colorInfo.name}`);
          this.applyColorStyle(button, type, colorInfo.color);
          button.addEventListener("click", () => this.chooseColor(type, colorInfo.color));
          swatches.appendChild(button);
        });
        group.appendChild(swatches);
        this.colorPanel.appendChild(group);
      });

      this.refreshColorControls();
    }

    bindEvents() {
      this.toolButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.setSelectedTool(button.dataset.tool);
          this.hidePlacementPreview();
          this.hideToolCursor();
          this.hidePaletteHoverPreview();
        });

        if (button.classList.contains("palette-card")) {
          button.addEventListener("mouseenter", (event) => this.showPaletteHoverPreview(button, event));
          button.addEventListener("mousemove", (event) => this.positionPaletteHoverPreview(event));
          button.addEventListener("mouseleave", () => this.hidePaletteHoverPreview());
        }
      });

      this.actionButtons.forEach((button) => {
        button.addEventListener("click", () => this.runEditorAction(button.dataset.editorAction));
      });

      this.layerButtons.forEach((button) => {
        button.addEventListener("click", () => this.setActiveLayer(button.dataset.editorLayer));
      });

      this.grid.addEventListener("mousemove", (event) => this.updatePlacementPreview(event));
      this.grid.addEventListener("mouseleave", () => {
        this.hidePlacementPreview();
        this.hideToolCursor();
      });

      this.grid.addEventListener("mousedown", (event) => {
        if (this.selectedTool === "rectangle") {
          this.startRectangleDrag(event);
          return;
        }

        if (this.selectedTool !== "move") {
          return;
        }

        const obstacleElement = event.target.closest(".grid-obstacle");
        if (obstacleElement) {
          this.startMoveDrag(obstacleElement.dataset.id, event);
          return;
        }

        this.startGridPan(event);
        event.preventDefault();
      });

      window.addEventListener("mousemove", (event) => {
        if (this.rectangleDrag) {
          this.updateRectangleDrag(event);
          return;
        }

        if (this.moveDrag) {
          this.updateMoveDrag(event);
          return;
        }

        if (!this.isPanning) {
          return;
        }

        this.updateGridPan(event);
      });

      window.addEventListener("mouseup", () => {
        if (this.rectangleDrag) {
          this.finishRectangleDrag();
        }

        if (this.moveDrag) {
          this.finishMoveDrag();
        }

        if (this.isPanning) {
          this.finishGridPan();
        }
      });

      this.grid.addEventListener("click", (event) => {
        if (this.ignoreNextGridClick) {
          this.ignoreNextGridClick = false;
          return;
        }

        const obstacleElement = event.target.closest(".grid-obstacle");
        const point = this.getLevelPointFromEvent(event);
        if (this.selectedTool === "move") {
          if (obstacleElement && this.isElementMutedByLayerKind(obstacleElement.dataset.kind)) {
            return;
          }
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            this.toggleElementSelection(obstacleElement ? obstacleElement.dataset.id : null);
          } else {
            this.setSelection(obstacleElement ? [obstacleElement.dataset.id] : []);
          }
          this.render();
          return;
        }

        if (this.selectedTool === "eraser") {
          this.eraseObstacle(obstacleElement ? obstacleElement.dataset.id : null, point.x, point.y);
          return;
        }

        if (this.selectedTool === "rotate") {
          this.rotateObstacle(obstacleElement ? obstacleElement.dataset.id : this.findObstacleNear(point.x, point.y));
          return;
        }

        if (obstacleElement && !this.isPlacementTool(this.selectedTool)) {
          this.selectObstacle(obstacleElement.dataset.id, event.shiftKey || event.ctrlKey || event.metaKey);
          return;
        }

        this.addOrMoveObstacle(point);
      });

      this.deleteButton.addEventListener("click", () => this.deleteSelectedObstacle());
      this.clearButton.addEventListener("click", () => this.onRequestClearLevel());
      [this.speedInput, this.gravityInput, this.jumpInput, this.backgroundColorInput, this.groundThemeSelect, this.deathAnimationSelect].filter(Boolean).forEach((input) => {
        input.addEventListener("input", () => this.updateSettingsFromInputs());
      });
      if (this.groundThemeSelect) {
        this.groundThemeSelect.addEventListener("change", () => this.updateSettingsFromInputs());
      }
      if (this.deathAnimationSelect) {
        this.deathAnimationSelect.addEventListener("change", () => this.updateSettingsFromInputs());
      }
      if (this.groundThemePalette) {
        this.groundThemePalette.addEventListener("click", (event) => {
          const button = event.target.closest("[data-ground-theme]");
          if (!button) {
            return;
          }

          this.chooseGroundTheme(button.dataset.groundTheme);
        });
      }
    }

    cloneLevelData(data) {
      return JSON.parse(JSON.stringify(window.TechnoDash.Level.normalize(data)));
    }

    recordHistorySnapshot() {
      if (this.isApplyingHistory) {
        return;
      }

      const snapshot = this.cloneLevelData(this.levelData);
      const current = this.history[this.historyIndex];
      if (current && JSON.stringify(current) === JSON.stringify(snapshot)) {
        return;
      }

      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(snapshot);
      if (this.history.length > 80) {
        this.history.shift();
      }
      this.historyIndex = this.history.length - 1;
    }

    resetHistory() {
      this.history = [this.cloneLevelData(this.levelData)];
      this.historyIndex = 0;
    }

    restoreHistory(offset) {
      const nextIndex = this.historyIndex + offset;
      if (nextIndex < 0 || nextIndex >= this.history.length) {
        return;
      }

      this.isApplyingHistory = true;
      this.historyIndex = nextIndex;
      this.levelData = this.cloneLevelData(this.history[nextIndex]);
      this.setSelection([]);
      this.syncInputs();
      this.render();
      this.onLevelChange(this.getLevelData());
      this.isApplyingHistory = false;
    }

    runEditorAction(action) {
      const actions = {
        undo: () => this.restoreHistory(-1),
        redo: () => this.restoreHistory(1),
        duplicate: () => this.duplicateSelection(),
        copy: () => this.copySelection(),
        paste: () => this.pasteClipboard(),
        mirrorHorizontal: () => this.mirrorSelection("horizontal"),
        mirrorVertical: () => this.mirrorSelection("vertical")
      };
      if (actions[action]) {
        actions[action]();
      }
    }

    onKeyboardShortcut(event) {
      if (this.shouldIgnoreEditorShortcut(event)) {
        return;
      }

      const key = String(event.key || "").toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (mod) {
        const ctrlActions = {
          z: event.shiftKey ? "redo" : "undo",
          y: "redo",
          c: "copy",
          v: "paste",
          d: "duplicate"
        };
        const action = ctrlActions[key];
        if (action) {
          event.preventDefault();
          this.runEditorAction(action);
        }
        return;
      }

      const plainActions = {
        delete: "delete",
        backspace: "delete",
        r: "rotate",
        h: "mirrorHorizontal",
        v: "mirrorVertical"
      };
      const action = plainActions[key];
      if (!action) {
        return;
      }

      event.preventDefault();
      if (action === "delete") {
        this.deleteSelectedObstacle();
      } else if (action === "rotate") {
        this.rotateObstacle();
      } else {
        this.runEditorAction(action);
      }
    }

    shouldIgnoreEditorShortcut(event) {
      const editorView = this.grid && this.grid.closest(".view-pane");
      if (editorView && !editorView.classList.contains("is-active")) {
        return true;
      }

      const target = event && event.target;
      if (target && typeof target.closest === "function" && target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) {
        return true;
      }

      return Boolean(document.querySelector(
        ".maker-modal:not([hidden]), .stats-modal:not([hidden]), .validation-success-screen:not([hidden])"
      ));
    }

    refreshActionButtons() {
      if (!this.actionButtons) {
        return;
      }

      const hasSelection = this.selectedElementIds.size > 0;
      const clipboardItems = this.clipboard && Array.isArray(this.clipboard.items) ? this.clipboard.items : [];
      const canPasteInActiveLayer = this.activeLayer !== "background"
        && clipboardItems.some((item) => item && !this.isElementMutedByLayerKind(item.kind));
      const states = {
        undo: this.historyIndex <= 0,
        redo: this.historyIndex >= this.history.length - 1,
        duplicate: !hasSelection,
        copy: !hasSelection,
        paste: !canPasteInActiveLayer,
        mirrorHorizontal: !hasSelection,
        mirrorVertical: !hasSelection
      };
      this.actionButtons.forEach((button) => {
        const disabled = Boolean(states[button.dataset.editorAction]);
        button.disabled = disabled;
        button.classList.toggle("is-disabled", disabled);
      });
    }

    refreshLayerButtons() {
      if (!this.layerButtons) {
        return;
      }

      this.layerButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.editorLayer === this.activeLayer);
      });
      if (this.grid) {
        this.grid.dataset.activeLayer = this.activeLayer;
      }
    }

    refreshPaletteForLayer() {
      const activeLayer = ["gameplay", "decor", "background"].includes(this.activeLayer)
        ? this.activeLayer
        : "gameplay";

      if (this.paletteTabs) {
        this.paletteTabs.forEach((button) => {
          const active = button.dataset.paletteTab === activeLayer;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-selected", String(active));
        });
      }

      if (this.palettePanels) {
        this.palettePanels.forEach((panel) => {
          const active = panel.id === `${activeLayer}-palette-panel`;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      }
    }

    setActiveLayer(layer) {
      if (!["gameplay", "decor", "background"].includes(layer)) {
        return;
      }

      this.activeLayer = layer;
      this.setSelection([]);
      this.hidePlacementPreview();
      this.hideRectanglePreview();
      this.ensureToolMatchesActiveLayer();
      this.render();
    }

    getToolLayer(tool = this.selectedTool) {
      if (this.getDecorationTypeFromTool(tool)) {
        return "decor";
      }

      if (tool === "rectangle" || window.TechnoDash.Level.getObstacleTypes().includes(tool)) {
        return "gameplay";
      }

      return "editor";
    }

    getDefaultDecorTool() {
      const button = this.decorPalette && this.decorPalette.querySelector("[data-tool^='decor-']");
      return button && button.dataset.tool ? button.dataset.tool : null;
    }

    ensureToolMatchesActiveLayer() {
      const toolLayer = this.getToolLayer(this.selectedTool);
      if (this.activeLayer === "gameplay" && toolLayer === "decor") {
        this.setSelectedTool("solidBlock");
      } else if (this.activeLayer === "decor" && toolLayer === "gameplay") {
        this.setSelectedTool(this.getDefaultDecorTool() || "move");
      } else if (this.activeLayer === "background" && toolLayer !== "editor") {
        this.setSelectedTool("move");
      }
    }

    canPlaceSelectedToolInActiveLayer() {
      if (this.activeLayer === "background") {
        return false;
      }

      const toolLayer = this.getToolLayer(this.selectedTool);
      return toolLayer === this.activeLayer;
    }

    getElementLayerKind(element) {
      return element && window.TechnoDash.Level.getDecorationForType(element.type)
        ? "decoration"
        : "obstacle";
    }

    isElementMutedByActiveLayer(element) {
      return !element || this.isElementMutedByLayerKind(this.getElementLayerKind(element));
    }

    isElementMutedByLayerKind(kind) {
      if (this.activeLayer === "background") {
        return true;
      }
      if (this.activeLayer === "gameplay") {
        return kind === "decoration";
      }
      if (this.activeLayer === "decor") {
        return kind === "obstacle";
      }
      return false;
    }

    isIdMoving(id) {
      return Boolean(this.moveDrag && this.moveDrag.ids && this.moveDrag.ids.includes(id));
    }

    setSelection(ids) {
      const nextIds = (Array.isArray(ids) ? ids : [ids])
        .filter((id) => {
          const element = id ? this.findElementById(id) : null;
          return element && !this.isElementMutedByActiveLayer(element);
        });
      this.selectedElementIds = new Set(nextIds);
      this.selectedObstacleId = nextIds.length ? nextIds[nextIds.length - 1] : null;
    }

    toggleElementSelection(id) {
      const element = id ? this.findElementById(id) : null;
      if (!element || this.isElementMutedByActiveLayer(element)) {
        this.setSelection([]);
        return;
      }

      if (this.selectedElementIds.has(id)) {
        this.selectedElementIds.delete(id);
        this.selectedObstacleId = [...this.selectedElementIds].slice(-1)[0] || null;
      } else {
        this.selectedElementIds.add(id);
        this.selectedObstacleId = id;
      }
    }

    getSelectedElements() {
      return [...this.selectedElementIds]
        .map((id) => this.findElementById(id))
        .filter(Boolean);
    }

    getElementKind(element) {
      return window.TechnoDash.Level.getDecorationForType(element.type) ? "decoration" : "obstacle";
    }

    getSelectionBounds(elements = this.getSelectedElements()) {
      if (!elements.length) {
        return null;
      }

      const bounds = elements.reduce((acc, element) => {
        const column = this.getColumnForElement(element);
        const row = this.getRowForElement(element);
        const widthTiles = this.getElementTileWidth(element);
        const heightTiles = Math.max(1, Math.ceil((Number(element.height) || this.tileSize) / this.tileSize));
        return {
          minColumn: Math.min(acc.minColumn, column),
          maxColumn: Math.max(acc.maxColumn, column + widthTiles - 1),
          minRow: Math.min(acc.minRow, row),
          maxRow: Math.max(acc.maxRow, row + heightTiles - 1)
        };
      }, {
        minColumn: Infinity,
        maxColumn: -Infinity,
        minRow: Infinity,
        maxRow: -Infinity
      });

      return Number.isFinite(bounds.minColumn) ? bounds : null;
    }

    duplicateSelection() {
      const elements = this.getSelectedElements();
      if (!elements.length) {
        return;
      }

      const copies = elements.map((element, index) => this.createElementCopy(element, 2, 0, `duplicate-${index}`));
      this.insertCopiedElements(copies);
    }

    copySelection() {
      const elements = this.getSelectedElements();
      const bounds = this.getSelectionBounds(elements);
      if (!bounds) {
        return;
      }

      this.clipboard = {
        minColumn: bounds.minColumn,
        minRow: bounds.minRow,
        items: elements.map((element) => ({
          kind: this.getElementKind(element),
          data: { ...element },
          offsetColumn: this.getColumnForElement(element) - bounds.minColumn,
          offsetRow: this.getRowForElement(element) - bounds.minRow
        }))
      };
      this.refreshActionButtons();
    }

    pasteClipboard() {
      if (!this.clipboard || !this.clipboard.items || !this.clipboard.items.length) {
        return;
      }

      const visibleColumn = this.scrollContainer
        ? Math.floor((this.scrollContainer.scrollLeft / this.pixelsPerLevelUnit) / this.tileSize) + 4
        : 4;
      const selectedBounds = this.getSelectionBounds();
      const baseColumn = selectedBounds ? selectedBounds.minColumn + 2 : visibleColumn;
      const baseRow = selectedBounds ? selectedBounds.minRow : this.clipboard.minRow;
      const copies = this.clipboard.items.map((item, index) => {
        const source = item.data;
        const column = baseColumn + item.offsetColumn;
        const row = baseRow + item.offsetRow;
        return this.createElementCopy(source, column - this.getColumnForElement(source), row - this.getRowForElement(source), `paste-${index}`);
      });
      this.insertCopiedElements(copies);
    }

    createElementCopy(source, offsetColumn, offsetRow, suffix) {
      const kind = this.getElementKind(source);
      const copy = { ...source };
      const width = Number(copy.width) || this.tileSize;
      const column = this.clampColumnForWidth(this.getColumnForElement(source) + offsetColumn, width);
      const row = this.clampRow(this.getRowForElement(source) + offsetRow);
      copy.id = `${source.type}-${Date.now()}-${suffix}`;
      copy.column = column;
      copy.row = row;
      copy.x = window.TechnoDash.Level.getXForColumn(column, width);
      copy.y = window.TechnoDash.Level.getYForRow(row);
      if (kind === "obstacle") {
        copy.rotation = window.TechnoDash.Level.normalizeRotation(copy.rotation, copy.type);
      }
      return copy;
    }

    insertCopiedElements(copies) {
      const insertedIds = [];
      copies
        .filter((copy) => copy && !this.isElementMutedByLayerKind(this.getElementKind(copy)))
        .forEach((copy) => {
          const kind = this.getElementKind(copy);
          if (kind === "decoration") {
            this.levelData.decorations.push(copy);
          } else {
            this.levelData.obstacles.push(copy);
          }
          insertedIds.push(copy.id);
        });
      if (!insertedIds.length) {
        this.refreshActionButtons();
        return;
      }
      this.setSelection(insertedIds);
      this.commitChange();
    }

    mirrorSelection(axis) {
      const elements = this.getSelectedElements();
      const bounds = this.getSelectionBounds(elements);
      if (!bounds) {
        return;
      }

      elements.forEach((element) => {
        const widthTiles = this.getElementTileWidth(element);
        const heightTiles = Math.max(1, Math.ceil((Number(element.height) || this.tileSize) / this.tileSize));
        if (axis === "horizontal") {
          const column = bounds.minColumn + bounds.maxColumn - (this.getColumnForElement(element) + widthTiles - 1);
          this.setElementGridPosition(element, column, this.getRowForElement(element));
          element.rotation = this.getMirroredRotation(element, axis);
        } else {
          const topRow = this.getRowForElement(element) + heightTiles - 1;
          const row = bounds.minRow + bounds.maxRow - topRow;
          this.setElementGridPosition(element, this.getColumnForElement(element), row);
          element.rotation = this.getMirroredRotation(element, axis);
        }
      });
      this.commitChange();
    }

    getMirroredRotation(element, axis) {
      if (!window.TechnoDash.Level.isRotatableObstacleType(element.type)) {
        return element.rotation || 0;
      }

      const rotation = window.TechnoDash.Level.normalizeRotation(element.rotation, element.type);
      if (axis === "horizontal") {
        return { 0: 0, 90: 270, 180: 180, 270: 90 }[rotation];
      }
      return { 0: 180, 90: 90, 180: 0, 270: 270 }[rotation];
    }

    setElementGridPosition(element, column, row) {
      const placement = this.getPlacementForColumn(column, element.width);
      element.column = placement.column;
      element.row = this.clampRow(row);
      element.x = placement.x;
      element.y = window.TechnoDash.Level.getYForRow(element.row);
    }

    createPaletteHoverPreview() {
      const preview = document.createElement("div");
      preview.className = "palette-hover-preview";
      preview.hidden = true;
      preview.setAttribute("aria-hidden", "true");

      const stage = document.createElement("div");
      stage.className = "palette-hover-preview-stage";

      const shape = document.createElement("span");
      shape.className = "palette-hover-preview-shape tool-swatch";
      stage.appendChild(shape);

      const copy = document.createElement("div");
      copy.className = "palette-hover-preview-copy";

      const title = document.createElement("strong");
      const note = document.createElement("small");
      copy.append(title, note);

      preview.append(stage, copy);
      document.body.appendChild(preview);
      return preview;
    }

    showPaletteHoverPreview(button, event) {
      if (!this.paletteHoverPreview || !button || !button.dataset.tool) {
        return;
      }

      const tool = button.dataset.tool;
      const decorationType = this.getDecorationTypeFromTool(tool);
      const visualType = decorationType ? `decor-${decorationType}` : tool;
      const shape = this.paletteHoverPreview.querySelector(".palette-hover-preview-shape");
      const title = this.paletteHoverPreview.querySelector("strong");
      const note = this.paletteHoverPreview.querySelector("small");

      if (!shape || !title || !note) {
        return;
      }

      this.clearColorStyle(shape);
      shape.dataset.type = visualType;
      shape.style.backgroundImage = "";

      if (!decorationType) {
        this.applyColorStyle(shape, tool, this.getSelectedColor(tool));
      } else {
        const decoration = window.TechnoDash.Level.getDecorationForType(decorationType);
        if (decoration) {
          shape.style.backgroundImage = `url("assets/decor/${decoration.file}")`;
        }
      }

      title.textContent = button.querySelector("strong")?.textContent?.trim() || this.getObstacleLabel({ type: tool, column: 0, row: 0 });
      note.textContent = button.querySelector("small")?.textContent?.trim() || "object";
      this.paletteHoverPreview.hidden = false;
      this.positionPaletteHoverPreview(event, button);
    }

    positionPaletteHoverPreview(event, sourceButton) {
      if (!this.paletteHoverPreview || this.paletteHoverPreview.hidden) {
        return;
      }

      const sourceRect = sourceButton ? sourceButton.getBoundingClientRect() : null;
      const pointerX = event && Number.isFinite(event.clientX) ? event.clientX : (sourceRect ? sourceRect.right : 0);
      const pointerY = event && Number.isFinite(event.clientY) ? event.clientY : (sourceRect ? sourceRect.top : 0);
      const margin = 14;
      const offset = 18;
      const rect = this.paletteHoverPreview.getBoundingClientRect();
      let left = pointerX + offset;
      let top = pointerY + offset;

      if (left + rect.width > window.innerWidth - margin) {
        left = pointerX - rect.width - offset;
      }

      if (top + rect.height > window.innerHeight - margin) {
        top = pointerY - rect.height - offset;
      }

      this.paletteHoverPreview.style.left = `${Math.max(margin, left)}px`;
      this.paletteHoverPreview.style.top = `${Math.max(margin, top)}px`;
    }

    hidePaletteHoverPreview() {
      if (this.paletteHoverPreview) {
        this.paletteHoverPreview.hidden = true;
      }
    }

    startGridPan(event) {
      this.isPanning = true;
      this.panState = {
        startX: event.clientX,
        startScrollLeft: this.scrollContainer.scrollLeft,
        moved: false
      };
      this.grid.classList.add("is-panning");
    }

    updateGridPan(event) {
      if (!this.panState) {
        return;
      }

      const deltaX = event.clientX - this.panState.startX;
      if (Math.abs(deltaX) > 3) {
        this.panState.moved = true;
      }
      this.scrollContainer.scrollLeft = this.panState.startScrollLeft - deltaX;
    }

    finishGridPan() {
      this.ignoreNextGridClick = Boolean(this.panState && this.panState.moved);
      this.isPanning = false;
      this.panState = null;
      this.grid.classList.remove("is-panning");
    }

    startMoveDrag(id, event) {
      const element = this.findElementById(id);
      if (!element || this.isElementMutedByActiveLayer(element)) {
        return;
      }

      const point = this.getLevelPointFromEvent(event);
      if (!this.selectedElementIds.has(id)) {
        this.setSelection([id]);
      }

      const dragElements = this.getSelectedElements();
      const primaryColumn = this.getColumnForElement(element);
      const primaryRow = this.getRowForElement(element);
      this.moveDrag = {
        id,
        ids: dragElements.map((item) => item.id),
        offsets: dragElements.map((item) => ({
          id: item.id,
          offsetColumn: this.getColumnForElement(item) - point.column,
          offsetRow: this.getRowForElement(item) - point.row
        })),
        startColumn: primaryColumn,
        startRow: primaryRow,
        lastColumn: primaryColumn,
        lastRow: primaryRow,
        moved: false
      };
      this.hidePlacementPreview();
      this.hideToolCursor();
      this.grid.classList.add("is-moving-object");
      this.render();
      event.preventDefault();
    }

    updateMoveDrag(event) {
      const element = this.findElementById(this.moveDrag.id);
      if (!element) {
        this.finishMoveDrag();
        return;
      }

      const pointerPoint = this.getLevelPointFromEvent(event);
      this.moveDrag.offsets.forEach((offset) => {
        const target = this.findElementById(offset.id);
        if (!target) {
          return;
        }

        const targetPoint = this.getPointForTile(
          pointerPoint.column + offset.offsetColumn,
          pointerPoint.row + offset.offsetRow
        );
        this.moveElementToPoint(target, targetPoint);
      });

      const column = this.getColumnForElement(element);
      const row = this.getRowForElement(element);
      this.updateTileCoordinateLabel(column, row);
      if (column === this.moveDrag.lastColumn && row === this.moveDrag.lastRow) {
        return;
      }

      this.moveDrag.lastColumn = column;
      this.moveDrag.lastRow = row;
      this.moveDrag.moved = true;
      this.render();
    }

    finishMoveDrag() {
      const didMove = Boolean(this.moveDrag && this.moveDrag.moved);
      this.ignoreNextGridClick = didMove;
      this.moveDrag = null;
      this.grid.classList.remove("is-moving-object");

      if (didMove) {
        this.commitChange();
        return;
      }

      this.render();
    }

    moveElementToPoint(element, point) {
      const placement = this.getPlacementForColumn(point.column, element.width);
      const levelY = this.clampY(point.y);
      element.x = placement.x;
      element.y = levelY;
      element.column = placement.column;
      element.row = this.getRowFromY(element.y);
    }

    startRectangleDrag(event) {
      if (this.activeLayer !== "gameplay") {
        return;
      }

      const point = this.getLevelPointFromEvent(event);
      this.rectangleDrag = {
        startColumn: point.column,
        startRow: point.row,
        endColumn: point.column,
        endRow: point.row
      };
      this.hidePlacementPreview();
      this.renderRectanglePreview();
      event.preventDefault();
    }

    updateRectangleDrag(event) {
      if (!this.rectangleDrag) {
        return;
      }

      const point = this.getLevelPointFromEvent(event);
      this.rectangleDrag.endColumn = point.column;
      this.rectangleDrag.endRow = point.row;
      this.updateTileCoordinateLabel(point.column, point.row);
      this.renderRectanglePreview();
    }

    finishRectangleDrag() {
      const rect = this.getRectangleDragBounds();
      this.hideRectanglePreview();
      this.rectangleDrag = null;
      if (!rect) {
        return;
      }

      this.ignoreNextGridClick = true;
      const maxCells = 320;
      const width = rect.maxColumn - rect.minColumn + 1;
      const height = rect.maxRow - rect.minRow + 1;
      if (width * height > maxCells) {
        rect.maxColumn = rect.minColumn + Math.floor((maxCells - 1) / height);
      }

      const fillType = this.getRectangleFillType();
      const dimensions = window.TechnoDash.Level.getDimensionsForType(fillType);
      const existing = this.getOccupiedGameplayCells();
      const insertedIds = [];
      for (let column = rect.minColumn; column <= rect.maxColumn; column += 1) {
        for (let row = rect.minRow; row <= rect.maxRow; row += 1) {
          const key = `${column}:${row}`;
          if (existing.has(key)) {
            continue;
          }

          const placement = this.getPlacementForColumn(column, dimensions.width);
          const obstacle = {
            id: `${fillType}-rect-${Date.now()}-${column}-${row}`,
            type: fillType,
            column: placement.column,
            row,
            x: placement.x,
            y: window.TechnoDash.Level.getYForRow(row),
            width: dimensions.width,
            height: dimensions.height,
            rotation: 0
          };
          if (window.TechnoDash.Level.isColorableObstacle(fillType)) {
            obstacle.color = this.getSelectedColor(fillType);
          }
          this.levelData.obstacles.push(obstacle);
          this.addOccupiedGameplayCells(existing, obstacle);
          insertedIds.push(obstacle.id);
        }
      }

      if (!insertedIds.length) {
        this.render();
        return;
      }

      this.setSelection(insertedIds);
      this.commitChange();
    }

    getRectangleFillType() {
      return window.TechnoDash.Level.isSolidBlockType(this.rectangleFillType)
        ? this.rectangleFillType
        : "solidBlock";
    }

    getOccupiedGameplayCells() {
      const cells = new Set();
      this.levelData.obstacles.forEach((obstacle) => this.addOccupiedGameplayCells(cells, obstacle));
      return cells;
    }

    addOccupiedGameplayCells(cells, obstacle) {
      const startColumn = this.getColumnForElement(obstacle);
      const startRow = this.getRowForElement(obstacle);
      const widthTiles = this.getElementTileWidth(obstacle);
      const heightTiles = Math.max(1, Math.ceil((Number(obstacle.height) || this.tileSize) / this.tileSize));
      for (let column = startColumn; column < startColumn + widthTiles; column += 1) {
        for (let row = startRow; row < startRow + heightTiles; row += 1) {
          cells.add(`${column}:${row}`);
        }
      }
    }

    getRectangleDragBounds() {
      if (!this.rectangleDrag) {
        return null;
      }

      return {
        minColumn: Math.min(this.rectangleDrag.startColumn, this.rectangleDrag.endColumn),
        maxColumn: Math.max(this.rectangleDrag.startColumn, this.rectangleDrag.endColumn),
        minRow: Math.min(this.rectangleDrag.startRow, this.rectangleDrag.endRow),
        maxRow: Math.max(this.rectangleDrag.startRow, this.rectangleDrag.endRow)
      };
    }

    renderRectanglePreview() {
      const bounds = this.getRectangleDragBounds();
      if (!this.rectanglePreview || !bounds) {
        return;
      }

      const left = bounds.minColumn * this.tileSize * this.pixelsPerLevelUnit;
      const bottom = this.getGridBottomForY(window.TechnoDash.Level.getYForRow(bounds.minRow));
      const width = (bounds.maxColumn - bounds.minColumn + 1) * this.tileSize * this.pixelsPerLevelUnit;
      const height = (bounds.maxRow - bounds.minRow + 1) * this.tileSize * this.pixelsPerLevelUnit;
      this.rectanglePreview.hidden = false;
      this.rectanglePreview.style.left = `${left}px`;
      this.rectanglePreview.style.bottom = `${bottom}px`;
      this.rectanglePreview.style.width = `${width}px`;
      this.rectanglePreview.style.height = `${height}px`;
    }

    hideRectanglePreview() {
      if (this.rectanglePreview) {
        this.rectanglePreview.hidden = true;
      }
    }

    addOrMoveObstacle(point) {
      if (!this.canPlaceSelectedToolInActiveLayer()) {
        return;
      }

      const decorationType = this.getDecorationTypeFromTool(this.selectedTool);
      if (decorationType) {
        const dimensions = window.TechnoDash.Level.getDecorationDimensionsForType(decorationType);
        const placement = this.getPlacementForColumn(point.column, dimensions.width);
        const decoration = {
          id: `decor-${decorationType}-${Date.now()}`,
          type: decorationType,
          column: placement.column,
          row: point.row,
          x: placement.x,
          y: this.clampY(point.y),
          width: dimensions.width,
          height: dimensions.height
        };
        this.levelData.decorations.push(decoration);
        this.setSelection([decoration.id]);
        this.commitChange();
        return;
      }

      if (!window.TechnoDash.Level.getObstacleTypes().includes(this.selectedTool)) {
        return;
      }

      const dimensions = window.TechnoDash.Level.getDimensionsForType(this.selectedTool);
      const placement = this.getPlacementForColumn(point.column, dimensions.width);
      const levelY = this.clampY(point.y);

      if (this.selectedTool === "finish") {
        let finish = this.levelData.obstacles.find((obstacle) => obstacle.type === "finish");
        if (!finish) {
          finish = {
            id: `finish-${Date.now()}`,
            type: "finish",
            column: placement.column,
            row: point.row,
            x: placement.x,
            y: levelY,
            width: dimensions.width,
            height: dimensions.height,
            rotation: 0
          };
          this.levelData.obstacles.push(finish);
        }

        finish.column = placement.column;
        finish.row = point.row;
        finish.x = placement.x;
        finish.y = levelY;
        this.setSelection([finish.id]);
      } else {
        const obstacle = {
          id: `${this.selectedTool}-${Date.now()}`,
          type: this.selectedTool,
          column: placement.column,
          row: point.row,
          x: placement.x,
          y: levelY,
          width: dimensions.width,
          height: dimensions.height,
          rotation: 0
        };
        if (window.TechnoDash.Level.isColorableObstacle(obstacle.type)) {
          obstacle.color = this.getSelectedColor(obstacle.type);
        }
        this.levelData.obstacles.push(obstacle);
        this.setSelection([obstacle.id]);
      }

      this.commitChange();
    }

    rotateObstacle(id) {
      const targetId = id || this.selectedObstacleId;
      const selectedTargets = this.selectedElementIds.has(targetId)
        ? this.getSelectedElements()
        : [this.findElementById(targetId)].filter(Boolean);
      const rotatableTargets = selectedTargets
        .filter((element) => !this.isElementMutedByActiveLayer(element))
        .filter((element) => window.TechnoDash.Level.isRotatableObstacleType(element.type));
      if (!rotatableTargets.length) {
        return;
      }

      rotatableTargets.forEach((element) => {
        element.rotation = window.TechnoDash.Level.getNextRotation(element.rotation, element.type);
        const dimensions = window.TechnoDash.Level.getDimensionsForType(element.type, element.rotation);
        const placement = this.getPlacementForColumn(this.getColumnForElement(element), dimensions.width);
        element.width = dimensions.width;
        element.height = dimensions.height;
        element.column = placement.column;
        element.x = placement.x;
      });
      this.setSelection(rotatableTargets.map((element) => element.id));
      this.commitChange();
    }

    eraseObstacle(id, x, y) {
      const targetId = id || this.findObstacleNear(x, y);
      if (!targetId) {
        return;
      }

      const target = this.findElementById(targetId);
      if (this.isElementMutedByActiveLayer(target)) {
        return;
      }

      this.levelData.obstacles = this.levelData.obstacles.filter((obstacle) => obstacle.id !== targetId);
      this.levelData.decorations = this.levelData.decorations.filter((decoration) => decoration.id !== targetId);
      if (this.selectedElementIds.has(targetId)) {
        this.selectedElementIds.delete(targetId);
        this.selectedObstacleId = [...this.selectedElementIds].slice(-1)[0] || null;
      }
      this.commitChange();
    }

    selectObstacle(id, additive = false) {
      const selected = this.findElementById(id);
      if (!selected || this.isElementMutedByActiveLayer(selected)) {
        return;
      }

      if (additive) {
        this.toggleElementSelection(id);
      } else {
        this.setSelection([id]);
      }
      if (selected && window.TechnoDash.Level.isColorableObstacle(selected.type)) {
        this.selectedColors[selected.type] = selected.color || window.TechnoDash.Level.getDefaultColorForType(selected.type);
        this.setSelectedTool(selected.type);
      }
      this.render();
    }

    deleteSelectedObstacle() {
      const selectedIds = [...this.selectedElementIds];
      if (!selectedIds.length) {
        return;
      }

      const selectedSet = new Set(selectedIds);
      this.levelData.obstacles = this.levelData.obstacles.filter((obstacle) => !selectedSet.has(obstacle.id));
      this.levelData.decorations = this.levelData.decorations.filter((decoration) => !selectedSet.has(decoration.id));
      this.setSelection([]);
      this.commitChange();
    }

    clearLevel() {
      this.levelData.obstacles = [];
      this.levelData.decorations = [];
      this.setSelection([]);
      this.commitChange();
    }

    updateSettingsFromInputs() {
      this.levelData.settings = {
        speed: Number(this.speedInput.value),
        gravity: Number(this.gravityInput.value),
        jumpForce: Number(this.jumpInput.value),
        backgroundColor: this.backgroundColorInput.value,
        groundTheme: this.getSelectedGroundTheme(),
        deathAnimation: this.deathAnimationSelect ? this.deathAnimationSelect.value : "burst"
      };
      this.commitChange();
    }

    getSelectedGroundTheme() {
      return window.TechnoDash.Level.normalizeGroundTheme(
        this.groundThemeSelect ? this.groundThemeSelect.value : this.levelData.settings.groundTheme
      );
    }

    chooseGroundTheme(theme) {
      const nextTheme = window.TechnoDash.Level.normalizeGroundTheme(theme);
      if (this.levelData.settings.groundTheme === nextTheme) {
        this.refreshGroundThemeControls();
        return;
      }

      this.levelData.settings.groundTheme = nextTheme;
      this.commitChange();
    }

    setLevelData(levelData) {
      this.levelData = window.TechnoDash.Level.normalize(levelData);
      this.setSelection([]);
      this.resetHistory();
      this.syncInputs();
      this.commitChange({ history: false });
    }

    getLevelData() {
      return window.TechnoDash.Level.normalize(this.levelData);
    }

    commitChange(options = {}) {
      this.levelData = window.TechnoDash.Level.normalize(this.levelData);
      if (options.history !== false) {
        this.recordHistorySnapshot();
      }
      this.syncInputs();
      this.render();
      this.onLevelChange(this.getLevelData());
    }

    render() {
      this.grid.querySelectorAll(".grid-obstacle").forEach((node) => node.remove());
      const selected = this.findElementById(this.selectedObstacleId);
      const selectedCount = this.selectedElementIds.size;
      this.basePixelsPerLevelUnit = this.getViewportFitScale();
      this.pixelsPerLevelUnit = this.basePixelsPerLevelUnit * this.zoomRatio;

      const viewportSize = window.TechnoDash.Level.getViewportSize();
      const gridWidth = Math.max(
        Math.round(viewportSize.width * this.pixelsPerLevelUnit),
        Math.round(this.levelData.length * this.pixelsPerLevelUnit)
      );
      const gridHeight = Math.round(viewportSize.height * this.pixelsPerLevelUnit);
      const scaledTileSize = this.tileSize * this.pixelsPerLevelUnit;
      const scaledGroundOffset = this.groundOffset * this.pixelsPerLevelUnit;

      [this.scrollContainer, this.scrollFrame].forEach((element) => {
        if (!element) {
          return;
        }
        element.style.setProperty("--editor-grid-height", `${gridHeight}px`);
        element.style.setProperty("--tile-size", `${scaledTileSize}px`);
        element.style.setProperty("--ground-offset", `${scaledGroundOffset}px`);
      });
      this.grid.style.width = `${gridWidth}px`;
      this.grid.style.height = `${gridHeight}px`;
      this.grid.style.setProperty("--tile-size", `${scaledTileSize}px`);
      this.grid.style.setProperty("--ground-offset", `${scaledGroundOffset}px`);
      this.grid.dataset.groundTheme = window.TechnoDash.Level.normalizeGroundTheme(this.levelData.settings.groundTheme);

      this.levelData.obstacles.forEach((obstacle) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = [
          "grid-obstacle",
          this.selectedElementIds.has(obstacle.id) ? "is-selected" : "",
          this.isIdMoving(obstacle.id) ? "is-moving" : "",
          this.isElementMutedByLayerKind("obstacle") ? "is-layer-muted" : ""
        ].filter(Boolean).join(" ");
        button.dataset.id = obstacle.id;
        button.dataset.type = obstacle.type;
        button.dataset.kind = "obstacle";
        button.dataset.column = obstacle.column;
        button.dataset.row = obstacle.row;
        button.dataset.rotation = String(obstacle.rotation || 0);
        button.style.left = `${obstacle.x * this.pixelsPerLevelUnit}px`;
        button.style.bottom = `${this.getGridBottomForY(obstacle.y)}px`;
        this.applyColorStyle(button, obstacle.type, obstacle.color);
        this.applyObstacleSize(button, obstacle);
        button.setAttribute("aria-label", this.getObstacleLabel(obstacle));
        this.grid.appendChild(button);
      });

      this.levelData.decorations.forEach((decoration) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = [
          "grid-obstacle",
          this.selectedElementIds.has(decoration.id) ? "is-selected" : "",
          this.isIdMoving(decoration.id) ? "is-moving" : "",
          this.isElementMutedByLayerKind("decoration") ? "is-layer-muted" : ""
        ].filter(Boolean).join(" ");
        button.dataset.id = decoration.id;
        button.dataset.type = `decor-${decoration.type}`;
        button.dataset.kind = "decoration";
        button.dataset.column = decoration.column;
        button.dataset.row = decoration.row;
        button.style.left = `${decoration.x * this.pixelsPerLevelUnit}px`;
        button.style.bottom = `${this.getGridBottomForY(decoration.y)}px`;
        this.applyObstacleSize(button, decoration);
        button.setAttribute("aria-label", this.getObstacleLabel(decoration));
        this.grid.appendChild(button);
      });

      this.deleteButton.disabled = selectedCount === 0;
      this.selectedInfo.textContent = selectedCount > 1
        ? `${selectedCount} objects selected`
        : selected ? this.getObstacleLabel(selected) : "No object selected";
      if (this.lengthLabel) {
        this.lengthLabel.textContent = `${Math.round(this.levelData.length / this.tileSize)} columns`;
      }
      this.refreshActionButtons();
      this.refreshLayerButtons();
      this.refreshPaletteForLayer();
    }

    createPlacementPreview() {
      const preview = document.createElement("div");
      preview.className = "grid-preview";
      preview.hidden = true;
      this.grid.appendChild(preview);
      return preview;
    }

    createRectanglePreview() {
      const preview = document.createElement("div");
      preview.className = "rectangle-fill-preview";
      preview.hidden = true;
      this.grid.appendChild(preview);
      return preview;
    }

    createToolCursor() {
      const cursor = document.createElement("div");
      cursor.className = "tool-cursor";
      cursor.hidden = true;
      cursor.setAttribute("aria-hidden", "true");

      const shape = document.createElement("span");
      shape.className = "tool-cursor-shape";
      cursor.appendChild(shape);

      this.grid.appendChild(cursor);
      return cursor;
    }

    updatePlacementPreview(event) {
      const point = this.getLevelPointFromEvent(event);
      this.updateTileCoordinateLabel(point.column, point.row);
      this.updateToolCursor(event);

      if (!this.preview || !this.canPlaceSelectedToolInActiveLayer() || ["eraser", "move", "rotate", "rectangle"].includes(this.selectedTool)) {
        this.hidePlacementPreview();
        return;
      }

      const decorationType = this.getDecorationTypeFromTool(this.selectedTool);
      const dimensions = decorationType
        ? window.TechnoDash.Level.getDecorationDimensionsForType(decorationType)
        : window.TechnoDash.Level.getDimensionsForType(this.selectedTool);
      const previewObstacle = {
        type: decorationType || this.selectedTool,
        width: dimensions.width,
        height: dimensions.height,
        y: point.y,
        column: this.clampColumnForWidth(point.column, dimensions.width),
        row: point.row,
        rotation: 0,
        color: decorationType ? null : this.getSelectedColor(this.selectedTool)
      };
      const placement = this.getPlacementForColumn(point.column, dimensions.width);

      this.updateTileCoordinateLabel(placement.column, point.row);
      this.preview.hidden = false;
      this.preview.dataset.type = decorationType ? `decor-${decorationType}` : this.selectedTool;
      this.preview.dataset.kind = decorationType ? "decoration" : "obstacle";
      this.preview.dataset.rotation = "0";
      this.preview.style.left = `${placement.x * this.pixelsPerLevelUnit}px`;
      this.preview.style.bottom = `${this.getGridBottomForY(point.y)}px`;
      this.applyColorStyle(this.preview, previewObstacle.type, previewObstacle.color);
      this.applyObstacleSize(this.preview, previewObstacle);
    }

    hidePlacementPreview() {
      if (this.preview) {
        this.preview.hidden = true;
      }
    }

    updateToolCursor(event) {
      if (!this.toolCursor || this.moveDrag || this.isPanning) {
        this.hideToolCursor();
        return;
      }

      const placementTool = this.isPlacementTool(this.selectedTool) || this.selectedTool === "rectangle";
      if (placementTool && !this.canPlaceSelectedToolInActiveLayer()) {
        this.hideToolCursor();
        return;
      }

      const rect = this.grid.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      this.toolCursor.hidden = false;
      this.toolCursor.style.left = `${localX}px`;
      this.toolCursor.style.top = `${localY}px`;
      this.syncToolCursor();
    }

    hideToolCursor() {
      if (this.toolCursor) {
        this.toolCursor.hidden = true;
      }
    }

    syncToolCursor() {
      if (!this.toolCursor) {
        return;
      }

      const decorationType = this.getDecorationTypeFromTool(this.selectedTool);
      const type = decorationType ? `decor-${decorationType}` : this.selectedTool;
      const shape = this.toolCursor.querySelector(".tool-cursor-shape");
      this.toolCursor.dataset.tool = type;
      if (shape) {
        shape.dataset.type = type;
        shape.style.backgroundImage = "";
      }

      if (!decorationType) {
        this.applyColorStyle(this.toolCursor, this.selectedTool, this.getSelectedColor(this.selectedTool));
      } else if (shape) {
        const decoration = window.TechnoDash.Level.getDecorationForType(decorationType);
        if (decoration) {
          shape.style.backgroundImage = `url("assets/decor/${decoration.file}")`;
        }
      }
    }

    applyObstacleSize(button, obstacle) {
      const decoration = window.TechnoDash.Level.getDecorationForType(obstacle.type);
      if (decoration) {
        button.style.width = `${obstacle.width * this.pixelsPerLevelUnit}px`;
        button.style.height = `${obstacle.height * this.pixelsPerLevelUnit}px`;
        button.style.backgroundImage = `url("assets/decor/${decoration.file}")`;
        return;
      }

      button.style.width = `${obstacle.width * this.pixelsPerLevelUnit}px`;
      button.style.height = `${obstacle.height * this.pixelsPerLevelUnit}px`;
      button.dataset.rotation = String(window.TechnoDash.Level.normalizeRotation(obstacle.rotation, obstacle.type));
    }

    syncInputs() {
      this.speedInput.value = this.levelData.settings.speed;
      this.gravityInput.value = this.levelData.settings.gravity;
      this.jumpInput.value = this.levelData.settings.jumpForce;
      this.backgroundColorInput.value = this.levelData.settings.backgroundColor;
      if (this.groundThemeSelect) {
        this.groundThemeSelect.value = window.TechnoDash.Level.normalizeGroundTheme(this.levelData.settings.groundTheme);
      }
      if (this.deathAnimationSelect) {
        this.deathAnimationSelect.value = this.levelData.settings.deathAnimation;
      }
      this.refreshToolColors();
      this.refreshColorControls();
      this.refreshGroundThemeControls();
    }

    getObstacleLabel(obstacle) {
      const decoration = window.TechnoDash.Level.getDecorationForType(obstacle.type);
      const tileColumn = this.getColumnForElement(obstacle);
      const tileRow = this.getRowForElement(obstacle);
      if (decoration) {
        return `${this.formatDecorationLabel(decoration)} decor - Col ${tileColumn} / Row ${tileRow}`;
      }

      const names = {
        ...Object.fromEntries(window.TechnoDash.Level.getGameplayTools().map((tool) => [tool.type, tool.label])),
        block: "Legacy block"
      };
      const color = window.TechnoDash.Level.isColorableObstacle(obstacle.type)
        ? window.TechnoDash.Level.getObstacleColorStyle(obstacle.type, obstacle.color)
        : null;
      const colorName = color ? ` ${color.name}` : "";
      const rotation = window.TechnoDash.Level.normalizeRotation(obstacle.rotation, obstacle.type);
      const rotationLabel = window.TechnoDash.Level.isRotatableObstacleType(obstacle.type) && rotation
        ? ` / ${rotation}deg`
        : "";
      return `${names[obstacle.type]}${colorName} - Col ${tileColumn} / Row ${tileRow}${rotationLabel}`;
    }

    getShortTypeLabel(type) {
      const labels = {
        block: "Legacy",
        platform: "Platform",
        solidBlock: "Metal",
        gravitySwitch: "Gravity",
        oneWayPlatform: "One-way",
        movingPlatform: "Moving"
      };
      return labels[type] || type;
    }

    getSelectedColor(type) {
      if (!window.TechnoDash.Level.isColorableObstacle(type)) {
        return null;
      }

      return this.selectedColors[type] || window.TechnoDash.Level.getDefaultColorForType(type);
    }

    chooseColor(type, color) {
      this.selectedColors[type] = color;
      this.setSelectedTool(type);

      const selected = this.findElementById(this.selectedObstacleId);
      if (selected && selected.type === type) {
        selected.color = color;
        this.commitChange();
        return;
      }

      this.refreshToolColors();
      this.refreshColorControls();
    }

    setSelectedTool(tool) {
      const nextTool = tool === "select" ? "move" : tool;
      const nextToolLayer = this.getToolLayer(nextTool);
      if (["gameplay", "decor"].includes(nextToolLayer) && nextToolLayer !== this.activeLayer) {
        return;
      }

      this.ignoreNextGridClick = false;
      this.selectedTool = nextTool;
      if (window.TechnoDash.Level.isSolidBlockType(nextTool)) {
        this.rectangleFillType = nextTool;
      }
      this.grid.dataset.activeTool = nextTool;
      this.toolButtons.forEach((item) => {
        item.classList.toggle("is-active", item.dataset.tool === nextTool);
      });
      this.syncToolCursor();
      this.refreshColorControls();
    }

    setZoom(ratio) {
      const normalized = Number.isFinite(Number(ratio)) ? Number(ratio) : 1;
      this.zoomRatio = Math.min(1.75, Math.max(0.75, normalized));
      this.render();
    }

    getViewportFitScale() {
      const viewportWidth = window.TechnoDash.Level.getViewportSize().width;
      const availableWidth = this.scrollContainer ? this.scrollContainer.clientWidth : viewportWidth;
      if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
        return this.basePixelsPerLevelUnit || 1;
      }

      return Math.min(1, Math.max(0.45, availableWidth / viewportWidth));
    }

    refreshToolColors() {
      if (!this.toolPalette) {
        return;
      }

      Object.keys(window.TechnoDash.Level.getColorPalettes()).forEach((type) => {
        const swatch = this.toolPalette.querySelector(`.tool-swatch[data-type="${type}"]`);
        if (swatch) {
          this.applyColorStyle(swatch, type, this.getSelectedColor(type));
        }
      });
    }

    refreshColorControls() {
      if (!this.colorPanel) {
        return;
      }

      this.colorPanel.querySelectorAll(".block-color-option").forEach((button) => {
        const type = button.dataset.colorType;
        const color = button.dataset.color;
        const active = this.selectedTool === type && this.getSelectedColor(type) === color;
        button.classList.toggle("is-active", active);
      });
    }

    refreshGroundThemeControls() {
      const activeTheme = window.TechnoDash.Level.normalizeGroundTheme(this.levelData.settings.groundTheme);
      if (this.groundThemeButtons) {
        this.groundThemeButtons.forEach((button) => {
          const active = button.dataset.groundTheme === activeTheme;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
        });
      }
      if (this.groundThemeSelect) {
        this.groundThemeSelect.value = activeTheme;
      }
      if (this.grid) {
        this.grid.dataset.groundTheme = activeTheme;
      }
    }

    clearColorStyle(element) {
      ["--object-color", "--object-accent", "--object-stroke", "--object-danger"].forEach((property) => {
        element.style.removeProperty(property);
      });
    }

    applyColorStyle(element, type, color) {
      this.clearColorStyle(element);
      const style = window.TechnoDash.Level.getObstacleColorStyle(type, color);
      if (!style) {
        return;
      }

      element.style.setProperty("--object-color", style.color);
      if (style.accent) {
        element.style.setProperty("--object-accent", style.accent);
      }
      if (style.stroke) {
        element.style.setProperty("--object-stroke", style.stroke);
      }
      if (style.danger) {
        element.style.setProperty("--object-danger", style.danger);
      }
    }

    getDecorationTypeFromTool(tool) {
      return tool && tool.startsWith("decor-") ? tool.replace("decor-", "") : null;
    }

    isPlacementTool(tool) {
      return Boolean(this.getDecorationTypeFromTool(tool))
        || window.TechnoDash.Level.getObstacleTypes().includes(tool);
    }

    findElementById(id) {
      if (!id) {
        return null;
      }

      return this.levelData.obstacles.find((obstacle) => obstacle.id === id)
        || this.levelData.decorations.find((decoration) => decoration.id === id)
        || null;
    }

    getLevelElements() {
      return [
        ...this.levelData.obstacles,
        ...this.levelData.decorations
      ];
    }

    getLevelPointFromEvent(event) {
      const rect = this.grid.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const bottomLine = this.grid.clientHeight - (this.groundOffset * this.pixelsPerLevelUnit);
      const column = this.snapColumn(Math.floor((localX / this.pixelsPerLevelUnit) / this.tileSize));
      const row = this.snapRow(Math.floor(Math.max(0, (bottomLine - localY) / this.pixelsPerLevelUnit) / this.tileSize));
      return this.getPointForTile(column, row);
    }

    prepareXForPlacement(x) {
      const snappedX = this.snapToTileCenter(x);
      if (snappedX > this.levelData.length - this.extendMargin) {
        this.levelData.length = this.snapLength(snappedX + this.extendAmount);
      }

      return snappedX;
    }

    prepareColumnForPlacement(column, width = this.tileSize) {
      const tileWidth = Number(width) || this.tileSize;
      const maxX = (Number(column) || 0) * this.tileSize + tileWidth;
      if (maxX > this.levelData.length - this.extendMargin) {
        this.levelData.length = this.snapLength(maxX + this.extendAmount);
      }

      return this.clampColumnForWidth(column, tileWidth);
    }

    getPlacementForColumn(column, width = this.tileSize) {
      const tileWidth = Number(width) || this.tileSize;
      const safeColumn = this.prepareColumnForPlacement(column, tileWidth);
      return {
        column: safeColumn,
        x: safeColumn * this.tileSize + tileWidth / 2
      };
    }

    findObstacleNear(x, y) {
      const column = this.getColumnFromX(x);
      const row = this.getRowFromY(y);
      const nearest = this.getLevelElements()
        .filter((element) => !this.isElementMutedByActiveLayer(element))
        .map((element) => {
          const elementColumn = this.getColumnForElement(element);
          const elementTileWidth = this.getElementTileWidth(element);
          const isInsideX = column >= elementColumn && column < elementColumn + elementTileWidth;
          const distanceX = isInsideX
            ? 0
            : Math.min(Math.abs(elementColumn - column), Math.abs(elementColumn + elementTileWidth - 1 - column));
          const distanceY = Math.abs(this.getRowForElement(element) - row);
          return {
            id: element.id,
            distanceX,
            distanceY,
            distance: distanceX + distanceY
          };
        })
        .filter((item) => item.distanceX === 0 && item.distanceY === 0)
        .sort((a, b) => a.distance - b.distance)[0];
      return nearest ? nearest.id : null;
    }

    updateTileCoordinateLabel(column, row) {
      if (!this.tileCoordinateLabel) {
        return;
      }

      this.tileCoordinateLabel.textContent = `Col ${column} / Row ${row}`;
    }

    getPointForTile(column, row) {
      const safeColumn = this.clampColumn(column);
      const safeRow = this.clampRow(row);
      return {
        column: safeColumn,
        row: safeRow,
        x: safeColumn * this.tileSize + this.tileSize / 2,
        y: safeRow * this.tileSize
      };
    }

    snapColumn(column) {
      const step = Math.max(1, Math.round(this.horizontalSnap / this.tileSize));
      return this.clampColumn(Math.floor((Number(column) || 0) / step) * step);
    }

    snapRow(row) {
      const step = Math.max(1, Math.round(this.verticalSnap / this.tileSize));
      return this.clampRow(Math.floor((Number(row) || 0) / step) * step);
    }

    clampColumn(column) {
      const maxColumn = Math.max(0, Math.floor(this.levelData.length / this.tileSize) - 1);
      const number = Number.isFinite(Number(column)) ? Math.floor(Number(column)) : 0;
      return Math.min(maxColumn, Math.max(0, number));
    }

    clampColumnForWidth(column, width = this.tileSize) {
      const maxColumn = Math.max(0, Math.floor((this.levelData.length - (Number(width) || this.tileSize)) / this.tileSize));
      const number = Number.isFinite(Number(column)) ? Math.floor(Number(column)) : 0;
      return Math.min(maxColumn, Math.max(0, number));
    }

    clampRow(row) {
      const maxRow = this.getMaxVisibleRow();
      const number = Number.isFinite(Number(row)) ? Math.floor(Number(row)) : 0;
      return Math.min(maxRow, Math.max(0, number));
    }

    getMaxVisibleRow() {
      return window.TechnoDash.Level.getMaxVisibleRow();
    }

    getColumnForElement(element) {
      return Number.isFinite(Number(element.column))
        ? Number(element.column)
        : this.getColumnFromX(element.x, element.width);
    }

    getRowForElement(element) {
      return Number.isFinite(Number(element.row))
        ? Number(element.row)
        : this.getRowFromY(element.y);
    }

    getColumnFromX(x, width = this.tileSize) {
      return Math.floor(((Number(x) || 0) - (Number(width) || this.tileSize) / 2) / this.tileSize);
    }

    getElementTileWidth(element) {
      return Math.max(1, Math.ceil((Number(element && element.width) || this.tileSize) / this.tileSize));
    }

    getRowFromY(y) {
      return Math.floor((Number(y) || 0) / this.tileSize);
    }

    snapToTileCenter(x) {
      return Math.floor(x / this.tileSize) * this.tileSize + this.tileSize / 2;
    }

    snapToTileBottom(y) {
      return Math.floor(Math.max(0, y) / this.tileSize) * this.tileSize;
    }

    snapLength(x) {
      return Math.ceil(x / this.tileSize) * this.tileSize;
    }

    clampX(x) {
      return this.getPointForTile(this.getColumnFromX(x), 0).x;
    }

    clampY(y) {
      return this.getPointForTile(0, this.getRowFromY(y)).y;
    }

    getGridBottomForY(y) {
      return (this.groundOffset + (Number(y) || 0)) * this.pixelsPerLevelUnit;
    }

    formatDecorationLabel(decoration) {
      const source = decoration && decoration.type ? decoration.type : "decor";
      return source
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  window.TechnoDash.LevelEditor = LevelEditor;
})();
