(() => {
  window.TechnoDash = window.TechnoDash || {};

  class UIManager {
    constructor(options = {}) {
      this.gameScene = options.gameScene;
      this.storageManager = options.storageManager;
      this.pseudoCodeGenerator = options.pseudoCodeGenerator;
      this.currentProgramState = { activeBlockIds: [] };
      this.currentLevelData = window.TechnoDash.Level.getDefaultData();
      this.elements = {
        playButton: document.getElementById("play-button"),
        stopButton: document.getElementById("stop-button"),
        resetButton: document.getElementById("reset-button"),
        saveButton: document.getElementById("save-button"),
        loadButton: document.getElementById("load-button"),
        statusLabel: document.getElementById("game-state-label"),
        distanceValue: document.getElementById("distance-value"),
        scoreValue: document.getElementById("score-value"),
        gameMessage: document.getElementById("game-message"),
        pseudoCodeOutput: document.getElementById("pseudocode-output")
      };

      this.levelEditor = new window.TechnoDash.LevelEditor({
        levelData: this.currentLevelData,
        onLevelChange: (levelData) => this.handleLevelChange(levelData)
      });

      this.blockEditor = new window.TechnoDash.BlockEditor({
        settings: this.currentLevelData.settings,
        onProgramChange: (programState) => this.handleProgramChange(programState)
      });

      this.gameScene.setCallbacks({
        onStats: (stats) => this.updateGameStats(stats)
      });

      this.bindTopbar();
      this.applyLevelToGame(false);
      this.updatePseudoCode();
    }

    bindTopbar() {
      this.elements.playButton.addEventListener("click", () => this.gameScene.play());
      this.elements.stopButton.addEventListener("click", () => this.gameScene.stop());
      this.elements.resetButton.addEventListener("click", () => this.gameScene.reset(false));
      this.elements.saveButton.addEventListener("click", () => this.saveLevel());
      this.elements.loadButton.addEventListener("click", () => this.loadLevel());
    }

    handleLevelChange(levelData) {
      this.currentLevelData = window.TechnoDash.Level.normalize(levelData);
      this.blockEditor.updateSettings(this.currentLevelData.settings);
      this.applyLevelToGame(this.gameScene.isPlaying());
      this.updatePseudoCode();
    }

    handleProgramChange(programState) {
      this.currentProgramState = programState;
      this.updatePseudoCode();
    }

    applyLevelToGame(playAfterReset) {
      this.gameScene.loadLevel(this.currentLevelData, { play: playAfterReset });
    }

    updatePseudoCode() {
      if (!this.pseudoCodeGenerator) {
        return;
      }

      this.elements.pseudoCodeOutput.textContent = this.pseudoCodeGenerator.generate(
        this.currentProgramState,
        this.currentLevelData.settings
      );
    }

    saveLevel() {
      this.storageManager.saveLevel(this.levelEditor.getLevelData());
      this.flashStatus("Sauvé");
    }

    loadLevel() {
      const levelData = this.storageManager.loadLevel();
      if (!levelData) {
        this.flashStatus("Aucune sauvegarde");
        return;
      }

      this.levelEditor.setLevelData(levelData);
      this.flashStatus("Chargé");
    }

    updateGameStats(stats) {
      this.elements.statusLabel.textContent = stats.status;
      this.elements.distanceValue.textContent = stats.showDistance ? stats.distance : "—";
      this.elements.scoreValue.textContent = stats.showScore ? stats.score : "—";
      this.elements.gameMessage.textContent = stats.status;
      this.elements.gameMessage.dataset.showDistance = String(Boolean(stats.showDistance));
      this.elements.gameMessage.dataset.showScore = String(Boolean(stats.showScore));
      this.elements.gameMessage.dataset.grounded = String(Boolean(stats.grounded));
      this.elements.gameMessage.dataset.playerY = String(stats.playerY);
      this.elements.gameMessage.classList.toggle("is-gameover", stats.status === "Game Over");
      this.elements.gameMessage.classList.toggle("is-victory", stats.status === "Victoire");
    }

    flashStatus(message) {
      const previous = this.elements.statusLabel.textContent;
      this.elements.statusLabel.textContent = message;
      window.setTimeout(() => {
        if (this.elements.statusLabel.textContent === message) {
          this.elements.statusLabel.textContent = previous;
        }
      }, 1200);
    }
  }

  window.TechnoDash.UIManager = UIManager;
})();
