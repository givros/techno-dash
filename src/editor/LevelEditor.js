(() => {
  window.TechnoDash = window.TechnoDash || {};

  class LevelEditor {
    constructor(options = {}) {
      this.onLevelChange = options.onLevelChange || function noop() {};
      this.onRequestClearLevel = options.onRequestClearLevel || (() => this.clearLevel());
      this.levelData = window.TechnoDash.Level.normalize(options.levelData || window.TechnoDash.Level.getDefaultData());
      this.selectedTool = "solidBlock";
      this.selectedObstacleId = null;
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
      this.ignoreNextGridClick = false;
      this.grid = document.getElementById("level-grid");
      this.scrollContainer = document.getElementById("level-scroll");
      this.scrollFrame = this.scrollContainer ? this.scrollContainer.closest(".level-scroll-frame") : null;
      this.toolPalette = document.querySelector(".level-tool-palette");
      this.decorPalette = document.getElementById("decor-palette");
      this.colorPanel = document.getElementById("block-color-panel");
      this.selectedColors = this.getDefaultSelectedColors();
      this.renderDecorationTools();
      this.renderColorControls();
      this.toolButtons = [...document.querySelectorAll(".tool-button")];
      this.deleteButton = document.getElementById("delete-obstacle-button");
      this.clearButton = document.getElementById("clear-level-button");
      this.selectedInfo = document.getElementById("selected-obstacle-info");
      this.tileCoordinateLabel = document.getElementById("tile-coordinate-label");
      this.lengthLabel = document.getElementById("level-length-label");
      this.speedInput = document.getElementById("speed-input");
      this.gravityInput = document.getElementById("gravity-input");
      this.jumpInput = document.getElementById("jump-input");
      this.backgroundColorInput = document.getElementById("background-color-input");
      this.preview = null;
      this.toolCursor = null;
      this.paletteHoverPreview = this.createPaletteHoverPreview();
      this.bindEvents();
      window.addEventListener("resize", () => this.render());
      this.preview = this.createPlacementPreview();
      this.toolCursor = this.createToolCursor();
      this.setSelectedTool(this.selectedTool);
      this.syncInputs();
      this.render();
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
      const themeOrder = ["city", "winter", "forest"];
      const themeLabels = {
        city: "City",
        winter: "Winter",
        forest: "Forest",
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

      this.grid.addEventListener("mousemove", (event) => this.updatePlacementPreview(event));
      this.grid.addEventListener("mouseleave", () => {
        this.hidePlacementPreview();
        this.hideToolCursor();
      });

      this.grid.addEventListener("mousedown", (event) => {
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
          this.selectedObstacleId = obstacleElement ? obstacleElement.dataset.id : null;
          this.render();
          return;
        }

        if (this.selectedTool === "eraser") {
          this.eraseObstacle(obstacleElement ? obstacleElement.dataset.id : null, point.x, point.y);
          return;
        }

        if (obstacleElement && !this.isPlacementTool(this.selectedTool)) {
          this.selectObstacle(obstacleElement.dataset.id);
          return;
        }

        this.addOrMoveObstacle(point);
      });

      this.deleteButton.addEventListener("click", () => this.deleteSelectedObstacle());
      this.clearButton.addEventListener("click", () => this.onRequestClearLevel());
      [this.speedInput, this.gravityInput, this.jumpInput, this.backgroundColorInput].forEach((input) => {
        input.addEventListener("input", () => this.updateSettingsFromInputs());
      });
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
      if (!element) {
        return;
      }

      const point = this.getLevelPointFromEvent(event);
      const column = this.getColumnForElement(element);
      const row = this.getRowForElement(element);
      this.selectedObstacleId = id;
      this.moveDrag = {
        id,
        offsetColumn: column - point.column,
        offsetRow: row - point.row,
        startColumn: column,
        startRow: row,
        lastColumn: column,
        lastRow: row,
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
      const targetPoint = this.getPointForTile(
        pointerPoint.column + this.moveDrag.offsetColumn,
        pointerPoint.row + this.moveDrag.offsetRow
      );
      this.moveElementToPoint(element, targetPoint);

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

    addOrMoveObstacle(point) {
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
        this.selectedObstacleId = decoration.id;
        this.commitChange();
        return;
      }

      if (!["triangle", "platform", "solidBlock", "dirtBlock", "iceBlock", "grassBlock", "finish"].includes(this.selectedTool)) {
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
            height: dimensions.height
          };
          this.levelData.obstacles.push(finish);
        }

        finish.column = placement.column;
        finish.row = point.row;
        finish.x = placement.x;
        finish.y = levelY;
        this.selectedObstacleId = finish.id;
      } else {
        const obstacle = {
          id: `${this.selectedTool}-${Date.now()}`,
          type: this.selectedTool,
          column: placement.column,
          row: point.row,
          x: placement.x,
          y: levelY,
          width: dimensions.width,
          height: dimensions.height
        };
        if (window.TechnoDash.Level.isColorableObstacle(obstacle.type)) {
          obstacle.color = this.getSelectedColor(obstacle.type);
        }
        this.levelData.obstacles.push(obstacle);
        this.selectedObstacleId = obstacle.id;
      }

      this.commitChange();
    }

    eraseObstacle(id, x, y) {
      const targetId = id || this.findObstacleNear(x, y);
      if (!targetId) {
        return;
      }

      this.levelData.obstacles = this.levelData.obstacles.filter((obstacle) => obstacle.id !== targetId);
      this.levelData.decorations = this.levelData.decorations.filter((decoration) => decoration.id !== targetId);
      if (this.selectedObstacleId === targetId) {
        this.selectedObstacleId = null;
      }
      this.commitChange();
    }

    selectObstacle(id) {
      this.selectedObstacleId = id;
      const selected = this.findElementById(id);
      if (selected && window.TechnoDash.Level.isColorableObstacle(selected.type)) {
        this.selectedColors[selected.type] = selected.color || window.TechnoDash.Level.getDefaultColorForType(selected.type);
        this.setSelectedTool(selected.type);
      }
      this.render();
    }

    deleteSelectedObstacle() {
      if (!this.selectedObstacleId) {
        return;
      }

      this.levelData.obstacles = this.levelData.obstacles.filter((obstacle) => obstacle.id !== this.selectedObstacleId);
      this.levelData.decorations = this.levelData.decorations.filter((decoration) => decoration.id !== this.selectedObstacleId);
      this.selectedObstacleId = null;
      this.commitChange();
    }

    clearLevel() {
      this.levelData.obstacles = [];
      this.levelData.decorations = [];
      this.selectedObstacleId = null;
      this.commitChange();
    }

    updateSettingsFromInputs() {
      this.levelData.settings = {
        speed: Number(this.speedInput.value),
        gravity: Number(this.gravityInput.value),
        jumpForce: Number(this.jumpInput.value),
        backgroundColor: this.backgroundColorInput.value
      };
      this.commitChange();
    }

    setLevelData(levelData) {
      this.levelData = window.TechnoDash.Level.normalize(levelData);
      this.selectedObstacleId = null;
      this.syncInputs();
      this.commitChange();
    }

    getLevelData() {
      return window.TechnoDash.Level.normalize(this.levelData);
    }

    commitChange() {
      this.levelData = window.TechnoDash.Level.normalize(this.levelData);
      this.syncInputs();
      this.render();
      this.onLevelChange(this.getLevelData());
    }

    render() {
      this.grid.querySelectorAll(".grid-obstacle").forEach((node) => node.remove());
      const selected = this.findElementById(this.selectedObstacleId);
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

      this.levelData.obstacles.forEach((obstacle) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = [
          "grid-obstacle",
          obstacle.id === this.selectedObstacleId ? "is-selected" : "",
          this.moveDrag && this.moveDrag.id === obstacle.id ? "is-moving" : ""
        ].filter(Boolean).join(" ");
        button.dataset.id = obstacle.id;
        button.dataset.type = obstacle.type;
        button.dataset.kind = "obstacle";
        button.dataset.column = obstacle.column;
        button.dataset.row = obstacle.row;
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
          decoration.id === this.selectedObstacleId ? "is-selected" : "",
          this.moveDrag && this.moveDrag.id === decoration.id ? "is-moving" : ""
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

      this.deleteButton.disabled = !selected;
      this.selectedInfo.textContent = selected ? this.getObstacleLabel(selected) : "No object selected";
      if (this.lengthLabel) {
        this.lengthLabel.textContent = `${Math.round(this.levelData.length / this.tileSize)} columns`;
      }
    }

    createPlacementPreview() {
      const preview = document.createElement("div");
      preview.className = "grid-preview";
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

      if (!this.preview || ["eraser", "move"].includes(this.selectedTool)) {
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
        color: decorationType ? null : this.getSelectedColor(this.selectedTool)
      };
      const placement = this.getPlacementForColumn(point.column, dimensions.width);

      this.updateTileCoordinateLabel(placement.column, point.row);
      this.preview.hidden = false;
      this.preview.dataset.type = decorationType ? `decor-${decorationType}` : this.selectedTool;
      this.preview.dataset.kind = decorationType ? "decoration" : "obstacle";
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
    }

    syncInputs() {
      this.speedInput.value = this.levelData.settings.speed;
      this.gravityInput.value = this.levelData.settings.gravity;
      this.jumpInput.value = this.levelData.settings.jumpForce;
      this.backgroundColorInput.value = this.levelData.settings.backgroundColor;
      this.refreshToolColors();
      this.refreshColorControls();
    }

    getObstacleLabel(obstacle) {
      const decoration = window.TechnoDash.Level.getDecorationForType(obstacle.type);
      const tileColumn = this.getColumnForElement(obstacle);
      const tileRow = this.getRowForElement(obstacle);
      if (decoration) {
        return `${this.formatDecorationLabel(decoration)} decor - Col ${tileColumn} / Row ${tileRow}`;
      }

      const names = {
        triangle: "Spike",
        block: "Legacy block",
        platform: "Platform",
        solidBlock: "Block",
        dirtBlock: "Dirt block",
        iceBlock: "Ice block",
        grassBlock: "Grass block",
        finish: "Finish"
      };
      const color = window.TechnoDash.Level.isColorableObstacle(obstacle.type)
        ? window.TechnoDash.Level.getObstacleColorStyle(obstacle.type, obstacle.color)
        : null;
      const colorName = color ? ` ${color.name}` : "";
      return `${names[obstacle.type]}${colorName} - Col ${tileColumn} / Row ${tileRow}`;
    }

    getShortTypeLabel(type) {
      const labels = {
        block: "Legacy",
        platform: "Platform",
        solidBlock: "Block"
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
      this.ignoreNextGridClick = false;
      this.selectedTool = nextTool;
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

    setGridSize(size) {
      this.horizontalSnap = this.tileSize;
      this.verticalSnap = this.tileSize;
      this.render();
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
        || ["triangle", "platform", "solidBlock", "dirtBlock", "iceBlock", "grassBlock", "finish"].includes(tool);
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
      const column = this.clampColumn(Math.floor((localX / this.pixelsPerLevelUnit) / this.tileSize));
      const row = this.clampRow(Math.floor(Math.max(0, (bottomLine - localY) / this.pixelsPerLevelUnit) / this.tileSize));
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
