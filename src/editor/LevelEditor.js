(() => {
  window.TechnoDash = window.TechnoDash || {};

  class LevelEditor {
    constructor(options = {}) {
      this.onLevelChange = options.onLevelChange || function noop() {};
      this.levelData = window.TechnoDash.Level.normalize(options.levelData || window.TechnoDash.Level.getDefaultData());
      this.selectedTool = "triangle";
      this.selectedObstacleId = null;
      this.pixelsPerLevelUnit = 0.34;
      this.extendMargin = 900;
      this.extendAmount = 2400;
      this.groundOffset = 47;
      this.verticalSnap = 22;
      this.grid = document.getElementById("level-grid");
      this.scrollContainer = document.getElementById("level-scroll");
      this.toolPalette = document.querySelector(".level-tool-palette");
      this.renderDecorationTools();
      this.toolButtons = [...document.querySelectorAll(".tool-button")];
      this.deleteButton = document.getElementById("delete-obstacle-button");
      this.clearButton = document.getElementById("clear-level-button");
      this.selectedInfo = document.getElementById("selected-obstacle-info");
      this.lengthLabel = document.getElementById("level-length-label");
      this.speedInput = document.getElementById("speed-input");
      this.gravityInput = document.getElementById("gravity-input");
      this.jumpInput = document.getElementById("jump-input");
      this.preview = null;
      this.bindEvents();
      this.preview = this.createPlacementPreview();
      this.syncInputs();
      this.render();
    }

    renderDecorationTools() {
      if (!this.toolPalette) {
        return;
      }

      this.toolPalette.querySelectorAll("[data-dynamic-decor]").forEach((button) => button.remove());
      const eraserButton = this.toolPalette.querySelector('[data-tool="eraser"]');
      window.TechnoDash.Level.getDecorationTypes().forEach((decoration) => {
        const button = this.createDecorationToolButton(decoration);
        this.toolPalette.insertBefore(button, eraserButton);
      });
    }

    createDecorationToolButton(decoration) {
      const button = document.createElement("button");
      button.className = "tool-button";
      button.type = "button";
      button.dataset.tool = `decor-${decoration.type}`;
      button.dataset.dynamicDecor = "true";

      const swatch = document.createElement("span");
      swatch.className = "tool-swatch";
      swatch.dataset.type = `decor-${decoration.type}`;
      swatch.style.backgroundImage = `url("assets/decor/${decoration.file}")`;
      button.appendChild(swatch);

      const label = document.createElement("span");
      label.textContent = decoration.label;
      button.appendChild(label);

      const note = document.createElement("small");
      note.textContent = "décor";
      button.appendChild(note);

      return button;
    }

    bindEvents() {
      this.toolButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.selectedTool = button.dataset.tool;
          this.toolButtons.forEach((item) => item.classList.toggle("is-active", item === button));
          this.hidePlacementPreview();
        });
      });

      this.grid.addEventListener("mousemove", (event) => this.updatePlacementPreview(event));
      this.grid.addEventListener("mouseleave", () => this.hidePlacementPreview());

      this.grid.addEventListener("click", (event) => {
        const obstacleElement = event.target.closest(".grid-obstacle");
        const point = this.getLevelPointFromEvent(event);
        if (this.selectedTool === "eraser") {
          this.eraseObstacle(obstacleElement ? obstacleElement.dataset.id : null, point.x, point.y);
          return;
        }

        if (obstacleElement) {
          this.selectObstacle(obstacleElement.dataset.id);
          return;
        }

        this.addOrMoveObstacle(point);
      });

      this.deleteButton.addEventListener("click", () => this.deleteSelectedObstacle());
      this.clearButton.addEventListener("click", () => this.clearLevel());
      [this.speedInput, this.gravityInput, this.jumpInput].forEach((input) => {
        input.addEventListener("input", () => this.updateSettingsFromInputs());
      });
    }

    addOrMoveObstacle(point) {
      const decorationType = this.getDecorationTypeFromTool(this.selectedTool);
      if (decorationType) {
        const dimensions = window.TechnoDash.Level.getDecorationDimensionsForType(decorationType);
        const levelX = this.prepareXForPlacement(point.x);
        const decoration = {
          id: `decor-${decorationType}-${Date.now()}`,
          type: decorationType,
          x: this.clampX(levelX),
          y: this.clampY(point.y),
          width: dimensions.width,
          height: dimensions.height
        };
        this.levelData.decorations.push(decoration);
        this.selectedObstacleId = decoration.id;
        this.commitChange();
        return;
      }

      const dimensions = window.TechnoDash.Level.getDimensionsForType(this.selectedTool);
      const levelX = this.prepareXForPlacement(point.x);
      const levelY = this.clampY(point.y);

      if (this.selectedTool === "finish") {
        let finish = this.levelData.obstacles.find((obstacle) => obstacle.type === "finish");
        if (!finish) {
          finish = {
            id: `finish-${Date.now()}`,
            type: "finish",
            x: this.clampX(levelX),
            y: levelY,
            width: dimensions.width,
            height: dimensions.height
          };
          this.levelData.obstacles.push(finish);
        }

        finish.x = this.clampX(levelX);
        finish.y = levelY;
        this.selectedObstacleId = finish.id;
      } else {
        const obstacle = {
          id: `${this.selectedTool}-${Date.now()}`,
          type: this.selectedTool,
          x: this.clampX(levelX),
          y: levelY,
          width: dimensions.width,
          height: dimensions.height
        };
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
        jumpForce: Number(this.jumpInput.value)
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
      const gridWidth = Math.max(900, Math.round(this.levelData.length * this.pixelsPerLevelUnit));
      this.grid.style.width = `${gridWidth}px`;
      this.grid.style.setProperty("--level-cell-width", `${50 * this.pixelsPerLevelUnit}px`);

      this.levelData.obstacles.forEach((obstacle) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `grid-obstacle${obstacle.id === this.selectedObstacleId ? " is-selected" : ""}`;
        button.dataset.id = obstacle.id;
        button.dataset.type = obstacle.type;
        button.dataset.kind = "obstacle";
        button.style.left = `${obstacle.x * this.pixelsPerLevelUnit}px`;
        button.style.bottom = `${this.getGridBottomForY(obstacle.y)}px`;
        this.applyObstacleSize(button, obstacle);
        button.setAttribute("aria-label", this.getObstacleLabel(obstacle));
        this.grid.appendChild(button);
      });

      this.levelData.decorations.forEach((decoration) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `grid-obstacle${decoration.id === this.selectedObstacleId ? " is-selected" : ""}`;
        button.dataset.id = decoration.id;
        button.dataset.type = `decor-${decoration.type}`;
        button.dataset.kind = "decoration";
        button.style.left = `${decoration.x * this.pixelsPerLevelUnit}px`;
        button.style.bottom = `${this.getGridBottomForY(decoration.y)}px`;
        this.applyObstacleSize(button, decoration);
        button.setAttribute("aria-label", this.getObstacleLabel(decoration));
        this.grid.appendChild(button);
      });

      this.deleteButton.disabled = !selected;
      this.selectedInfo.textContent = selected ? this.getObstacleLabel(selected) : "Aucun élément sélectionné";
      if (this.lengthLabel) {
        this.lengthLabel.textContent = `${Math.round(this.levelData.length)} px`;
      }
    }

    createPlacementPreview() {
      const preview = document.createElement("div");
      preview.className = "grid-preview";
      preview.hidden = true;
      this.grid.appendChild(preview);
      return preview;
    }

    updatePlacementPreview(event) {
      if (!this.preview || this.selectedTool === "eraser") {
        this.hidePlacementPreview();
        return;
      }

      const point = this.getLevelPointFromEvent(event);
      const decorationType = this.getDecorationTypeFromTool(this.selectedTool);
      const dimensions = decorationType
        ? window.TechnoDash.Level.getDecorationDimensionsForType(decorationType)
        : window.TechnoDash.Level.getDimensionsForType(this.selectedTool);
      const previewObstacle = {
        type: decorationType || this.selectedTool,
        width: dimensions.width,
        height: dimensions.height,
        y: point.y
      };

      this.preview.hidden = false;
      this.preview.dataset.type = decorationType ? `decor-${decorationType}` : this.selectedTool;
      this.preview.dataset.kind = decorationType ? "decoration" : "obstacle";
      this.preview.style.left = `${point.x * this.pixelsPerLevelUnit}px`;
      this.preview.style.bottom = `${this.getGridBottomForY(point.y)}px`;
      this.applyObstacleSize(this.preview, previewObstacle);
    }

    hidePlacementPreview() {
      if (this.preview) {
        this.preview.hidden = true;
      }
    }

    applyObstacleSize(button, obstacle) {
      const decoration = window.TechnoDash.Level.getDecorationForType(obstacle.type);
      if (decoration) {
        button.style.width = `${Math.max(28, obstacle.width * 0.82)}px`;
        button.style.height = `${Math.max(28, obstacle.height * 0.82)}px`;
        button.style.backgroundImage = `url("assets/decor/${decoration.file}")`;
        return;
      }

      if (obstacle.type === "triangle") {
        return;
      }

      if (obstacle.type === "finish") {
        button.style.width = "22px";
        button.style.height = `${obstacle.height}px`;
        return;
      }

      const width = obstacle.type === "platform"
        ? Math.max(58, obstacle.width * 0.62)
        : Math.max(34, obstacle.width * 0.68);
      button.style.width = `${width}px`;
      button.style.height = `${Math.max(26, obstacle.height * 0.8)}px`;
    }

    syncInputs() {
      this.speedInput.value = this.levelData.settings.speed;
      this.gravityInput.value = this.levelData.settings.gravity;
      this.jumpInput.value = this.levelData.settings.jumpForce;
    }

    getObstacleLabel(obstacle) {
      const decoration = window.TechnoDash.Level.getDecorationForType(obstacle.type);
      if (decoration) {
        return `Décor ${decoration.label} à ${Math.round(obstacle.x)} px / hauteur ${Math.round(obstacle.y || 0)} px`;
      }

      const names = {
        triangle: "Pic",
        block: "Bloc danger",
        platform: "Plateforme",
        solidBlock: "Bloc solide",
        finish: "Arrivée"
      };
      return `${names[obstacle.type]} à ${Math.round(obstacle.x)} px / hauteur ${Math.round(obstacle.y || 0)} px`;
    }

    getDecorationTypeFromTool(tool) {
      return tool && tool.startsWith("decor-") ? tool.replace("decor-", "") : null;
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
      const bottomLine = this.grid.clientHeight - this.groundOffset;
      return {
        x: this.clampX(this.snapToGrid(localX / this.pixelsPerLevelUnit)),
        y: this.clampY(this.snapToVerticalGrid(bottomLine - localY))
      };
    }

    prepareXForPlacement(x) {
      const snappedX = this.snapToGrid(x);
      if (snappedX > this.levelData.length - this.extendMargin) {
        this.levelData.length = this.snapToGrid(snappedX + this.extendAmount);
      }

      return snappedX;
    }

    findObstacleNear(x, y) {
      const hitRadiusX = 55;
      const hitRadiusY = 44;
      const nearest = this.getLevelElements()
        .map((element) => {
          const distanceX = Math.abs(element.x - x);
          const distanceY = Math.abs((element.y || 0) - y);
          return {
            id: element.id,
            distanceX,
            distanceY,
            distance: distanceX + distanceY
          };
        })
        .filter((item) => item.distanceX <= hitRadiusX && item.distanceY <= hitRadiusY)
        .sort((a, b) => a.distance - b.distance)[0];
      return nearest ? nearest.id : null;
    }

    snapToGrid(x) {
      return Math.round(x / 50) * 50;
    }

    clampX(x) {
      return Math.min(this.levelData.length - 120, Math.max(260, x));
    }

    snapToVerticalGrid(y) {
      return Math.round(y / this.verticalSnap) * this.verticalSnap;
    }

    clampY(y) {
      const maxY = Math.max(0, this.grid.clientHeight - this.groundOffset - 34);
      return Math.min(maxY, Math.max(0, y));
    }

    getGridBottomForY(y) {
      return this.groundOffset + (Number(y) || 0);
    }
  }

  window.TechnoDash.LevelEditor = LevelEditor;
})();
