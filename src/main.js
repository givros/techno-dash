(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const autosaveKey = "technodash-workshop-autosave";
    const defaultLevelName = "sans nom";
    const pseudoCodeGenerator = new window.TechnoDash.PseudoCodeGenerator();
    const status = document.getElementById("program-status");
    const levelNameLabel = document.getElementById("level-name-label");
    const gamePanel = document.getElementById("game-panel");
    const gameTitle = document.getElementById("game-title");
    const playButton = document.getElementById("play-button");
    const pseudoCodeOutput = document.getElementById("pseudocode-output");
    const programCount = document.getElementById("program-count");
    const tabButtons = [...document.querySelectorAll(".tab-button")];
    const tabPages = [...document.querySelectorAll(".tab-page")];
    const validateLevelButton = document.getElementById("validate-level-button");
    const loadLevelButton = document.getElementById("load-level-button");
    const levelFileInput = document.getElementById("level-file-input");
    const validationModal = document.getElementById("validation-modal");
    const validationCard = validationModal.querySelector(".validation-card");
    const validationMessage = document.getElementById("validation-message");
    const validationStateLabel = document.getElementById("validation-state-label");
    const validationDistanceLabel = document.getElementById("validation-distance-label");
    const startValidationButton = document.getElementById("start-validation-button");
    const downloadLevelButton = document.getElementById("download-level-button");
    const closeValidationButton = document.getElementById("close-validation-button");

    const sanitizeLevelName = (name) => {
      const cleaned = String(name || "").replace(/\.json$/i, "").trim();
      return cleaned || defaultLevelName;
    };

    const slugifyLevelName = (name) => {
      const source = sanitizeLevelName(name) === defaultLevelName
        ? `niveau-technodash-${new Date().toISOString().slice(0, 10)}`
        : sanitizeLevelName(name);
      const slug = source
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return slug || `niveau-technodash-${new Date().toISOString().slice(0, 10)}`;
    };

    const readSavedWorkspace = () => {
      try {
        const raw = localStorage.getItem(autosaveKey);
        if (!raw) {
          return null;
        }

        const saved = JSON.parse(raw);
        return {
          program: saved && saved.program && typeof saved.program === "object"
            ? saved.program
            : { activeBlockIds: [] },
          level: saved && saved.level
            ? window.TechnoDash.Level.normalize(saved.level)
            : window.TechnoDash.Level.getDefaultData(),
          levelName: sanitizeLevelName(saved && saved.levelName),
          gameMode: saved && saved.gameMode === "play" ? "play" : "test"
        };
      } catch (error) {
        console.warn("Sauvegarde locale illisible", error);
        return null;
      }
    };

    const savedWorkspace = readSavedWorkspace();

    let currentProgramState = savedWorkspace ? savedWorkspace.program : { activeBlockIds: [] };
    let currentLevelData = savedWorkspace ? savedWorkspace.level : window.TechnoDash.Level.getDefaultData();
    let currentLevelName = savedWorkspace ? savedWorkspace.levelName : defaultLevelName;
    let currentGameMode = savedWorkspace ? savedWorkspace.gameMode : "test";
    let game = null;
    let gameScene = null;
    let validationActive = false;
    let validationPassed = false;
    let validatedLevelData = null;
    let blockEditor = null;
    let levelEditor = null;
    let isRestoringWorkspace = true;
    let isResettingWorkspace = false;
    let isSyncingSettings = false;

    const playableProgramState = {
      activeBlockIds: [
        "addBackground",
        "addPlayer",
        "addGround",
        "addObstacles",
        "addDecorations",
        "addFinish",
        "loop",
        "moveLevel",
        "applyGravity",
        "spacePressed",
        "playerGrounded",
        "jump",
        "hitObstacle",
        "showGameOver",
        "reachFinish",
        "showVictory",
        "showDistance",
        "showScore",
        "restartGame"
      ],
      blockSections: {},
      hasDefaultStart: true
    };

    const switchTab = (tabName) => {
      tabButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tab === tabName);
      });

      tabPages.forEach((page) => {
        page.classList.toggle("is-active", page.dataset.page === tabName);
      });

      if (tabName === "game") {
        ensureGame();
        updateGamePreview(false);
      }
    };

    const readSettings = () => currentLevelData.settings;

    const getGameProgramState = () => currentGameMode === "play"
      ? playableProgramState
      : currentProgramState;

    const updateLevelNameDisplay = () => {
      levelNameLabel.textContent = `Niveau : ${currentLevelName}`;
      levelNameLabel.title = currentLevelName;
    };

    const updateGameChrome = () => {
      gamePanel.dataset.mode = currentGameMode;
      if (currentGameMode === "play") {
        gameTitle.textContent = `Partie : ${currentLevelName}`;
        gameTitle.title = currentLevelName;
        playButton.textContent = "Rejouer";
        return;
      }

      gameTitle.textContent = "Test du jeu";
      gameTitle.removeAttribute("title");
      playButton.textContent = "Tester";
    };

    const setLevelName = (name) => {
      currentLevelName = sanitizeLevelName(name);
      updateLevelNameDisplay();
      updateGameChrome();
    };

    const setGameMode = (mode) => {
      currentGameMode = mode === "play" ? "play" : "test";
      updateGameChrome();
    };

    const autoSaveWorkspace = () => {
      if (isRestoringWorkspace || isResettingWorkspace || !blockEditor || !levelEditor) {
        return;
      }

      try {
        localStorage.setItem(autosaveKey, JSON.stringify({
          savedAt: new Date().toISOString(),
          program: blockEditor.getProgramState(),
          level: levelEditor.getLevelData(),
          levelName: currentLevelName,
          gameMode: currentGameMode
        }));
      } catch (error) {
        console.warn("Sauvegarde locale impossible", error);
      }
    };

    const levelHasFinish = () => currentLevelData.obstacles.some((obstacle) => obstacle.type === "finish");

    const setValidationState = (state, message, distance = 0) => {
      validationCard.dataset.state = state;
      validationMessage.textContent = message;
      validationDistanceLabel.textContent = `Distance ${Math.max(0, Math.floor(distance))}`;
      const labels = {
        idle: "En attente",
        running: "En cours",
        failed: "À relancer",
        passed: "Validé"
      };
      validationStateLabel.textContent = labels[state] || labels.idle;
    };

    const resetValidation = (message) => {
      validationActive = false;
      validationPassed = false;
      validatedLevelData = null;
      downloadLevelButton.disabled = true;
      if (!validationModal.hidden) {
        setValidationState("idle", message || "Le niveau a changé. Relance la validation.");
      }
    };

    const updatePseudoCode = () => {
      pseudoCodeOutput.textContent = pseudoCodeGenerator.generate(currentProgramState, readSettings());
      const fixedBlocks = currentProgramState.hasDefaultStart ? 1 : 0;
      const blockCount = currentProgramState.activeBlockIds.length + fixedBlocks;
      programCount.textContent = `${blockCount} bloc${blockCount > 1 ? "s" : ""}`;
    };

    const completeValidation = (stats) => {
      validationActive = false;
      validationPassed = true;
      validatedLevelData = levelEditor.getLevelData();
      downloadLevelButton.disabled = false;
      setValidationState("passed", "Niveau validé : tu peux maintenant le télécharger.", stats.distance);
      status.textContent = "Niveau validé";
      if (gameScene) {
        gameScene.stop();
      }
    };

    const failValidation = (stats) => {
      validationActive = false;
      validationPassed = false;
      validatedLevelData = null;
      downloadLevelButton.disabled = true;
      setValidationState("failed", "Game Over : relance la validation après avoir corrigé ou rejoué.", stats.distance);
      status.textContent = "Validation échouée";
    };

    const updateValidationFromStats = (stats) => {
      if (!validationActive) {
        return;
      }

      if (stats.reachedFinish || stats.status === "Victoire") {
        completeValidation(stats);
        return;
      }

      if (stats.status === "Game Over") {
        failValidation(stats);
        return;
      }

      setValidationState("running", "Joue le niveau. Le téléchargement se débloque quand le joueur atteint l'arrivée.", stats.distance);
    };

    const updateGameStats = (stats) => {
      document.getElementById("game-state-label").textContent = stats.status;
      document.getElementById("distance-value").textContent = stats.showDistance ? stats.distance : "—";
      document.getElementById("score-value").textContent = stats.showScore ? stats.score : "—";

      const message = document.getElementById("game-message");
      message.textContent = stats.status;
      message.dataset.showDistance = String(Boolean(stats.showDistance));
      message.dataset.showScore = String(Boolean(stats.showScore));
      message.dataset.grounded = String(Boolean(stats.grounded));
      message.dataset.playerY = String(stats.playerY);
      message.classList.toggle("is-gameover", stats.status === "Game Over");
      message.classList.toggle("is-victory", stats.status === "Victoire");
      updateValidationFromStats(stats);
    };

    const ensureGame = () => {
      if (game || !window.Phaser) {
        return;
      }

      gameScene = new window.TechnoDash.GameScene();
      gameScene.setCallbacks({ onStats: updateGameStats });
      gameScene.setProgramState(getGameProgramState());
      gameScene.loadLevel(currentLevelData, { play: false });
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game-container",
        width: 760,
        height: 430,
        backgroundColor: "#121722",
        scene: [gameScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      });
    };

    const updateGamePreview = (keepPlaying) => {
      if (!gameScene) {
        return;
      }

      gameScene.setProgramState(getGameProgramState());
      gameScene.loadLevel(currentLevelData, { play: Boolean(keepPlaying && gameScene.isPlaying()) });
    };

    const startTest = () => {
      setGameMode("test");
      switchTab("game");
      ensureGame();
      status.textContent = "Test en cours";

      window.setTimeout(() => {
        gameScene.setProgramState(currentProgramState);
        gameScene.loadLevel(currentLevelData, { play: true });
      }, 80);
    };

    const startLoadedGame = () => {
      setGameMode("play");
      switchTab("game");
      ensureGame();
      status.textContent = `Partie : ${currentLevelName}`;

      window.setTimeout(() => {
        gameScene.setProgramState(playableProgramState);
        gameScene.loadLevel(currentLevelData, { play: true });
      }, 80);
    };

    const startValidation = () => {
      setGameMode("test");
      validationModal.hidden = false;
      validationPassed = false;
      validatedLevelData = null;
      downloadLevelButton.disabled = true;

      if (!levelHasFinish()) {
        validationActive = false;
        setValidationState("failed", "Ajoute une arrivée dans le level design avant de valider.");
        status.textContent = "Arrivée manquante";
        return;
      }

      validationActive = true;
      setValidationState("running", "Joue le niveau. Le téléchargement se débloque quand le joueur atteint l'arrivée.");
      switchTab("game");
      ensureGame();
      status.textContent = "Validation en cours";

      window.setTimeout(() => {
        if (!validationActive || !gameScene) {
          return;
        }

        gameScene.setProgramState(currentProgramState);
        gameScene.loadLevel(currentLevelData, { play: true });
      }, 80);
    };

    const downloadValidatedLevel = () => {
      if (!validationPassed || !validatedLevelData) {
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const levelName = sanitizeLevelName(currentLevelName) === defaultLevelName
        ? `niveau-technodash-${today}`
        : sanitizeLevelName(currentLevelName);
      const payload = {
        type: "technodash-level",
        version: 1,
        name: levelName,
        exportedAt: new Date().toISOString(),
        level: validatedLevelData
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      const fileName = `${slugifyLevelName(levelName)}.json`;
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      link.remove();
      setLevelName(levelName);
      autoSaveWorkspace();
      status.textContent = `Niveau téléchargé : ${levelName}`;
    };

    const parseLevelFile = (raw, file) => {
      const fileName = sanitizeLevelName(file && file.name ? file.name : defaultLevelName);

      try {
        const payload = JSON.parse(raw);
        if (payload && payload.type && payload.type !== "technodash-level") {
          throw new Error("Ce JSON n'est pas un niveau TechnoDash");
        }

        const source = payload && payload.level ? payload.level : payload;
        if (!source || typeof source !== "object" || !Array.isArray(source.obstacles)) {
          throw new Error("Format de niveau invalide");
        }

        return {
          level: window.TechnoDash.Level.normalize(source),
          name: fileName,
          internalName: sanitizeLevelName(payload && (payload.name || payload.levelName) ? (payload.name || payload.levelName) : fileName),
          fileName: file && file.name ? file.name : `${fileName}.json`
        };
      } catch (error) {
        console.warn("Niveau illisible", error);
        return null;
      }
    };

    const loadLevelFromFile = (file) => {
      if (!file) {
        return;
      }

      if (!file.name.toLowerCase().endsWith(".json")) {
        status.textContent = "Choisis un fichier .json TechnoDash";
        return;
      }

      status.textContent = `Lecture du fichier : ${file.name}`;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const loaded = parseLevelFile(String(reader.result || ""), file);
        if (!loaded) {
          status.textContent = `Fichier refusé : ${file.name}`;
          return;
        }

        setLevelName(loaded.name);
        levelEditor.setLevelData(loaded.level);
        resetValidation("Niveau chargé. Valide-le si tu veux le télécharger à nouveau.");
        setGameMode("play");
        autoSaveWorkspace();
        status.textContent = loaded.internalName === loaded.name
          ? `Niveau chargé : ${loaded.fileName}`
          : `Niveau chargé : ${loaded.fileName} (${loaded.internalName})`;
        startLoadedGame();
      });
      reader.addEventListener("error", () => {
        status.textContent = `Impossible de lire : ${file.name}`;
      });
      reader.readAsText(file);
    };

    const resetWorkspace = () => {
      isResettingWorkspace = true;
      localStorage.removeItem(autosaveKey);
      validationModal.hidden = true;

      blockEditor.loadProgramState({ activeBlockIds: [], blockSections: {} });
      levelEditor.setLevelData(window.TechnoDash.Level.getDefaultData());
      currentLevelData = levelEditor.getLevelData();
      setLevelName(defaultLevelName);
      setGameMode("test");
      blockEditor.updateSettings(readSettings());

      currentProgramState = blockEditor.getProgramState();
      isResettingWorkspace = false;

      resetValidation("Projet remis à zéro.");
      updatePseudoCode();
      updateGamePreview(false);
      if (gameScene) {
        gameScene.reset(false);
      }
      blockEditor.setHint("Programme et level design remis à zéro.");
      status.textContent = "Projet remis à zéro";
    };

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });

    blockEditor = new window.TechnoDash.BlockEditor({
      settings: readSettings(),
      onProgramChange: (programState) => {
        if (isRestoringWorkspace || isResettingWorkspace) {
          return;
        }

        currentProgramState = programState;
        if (isSyncingSettings) {
          updatePseudoCode();
          return;
        }

        setGameMode("test");
        resetValidation("Le programme a changé. Relance la validation du niveau.");
        updatePseudoCode();
        updateGamePreview(false);
        autoSaveWorkspace();
      },
      onMessage: (message) => {
        status.textContent = message;
      }
    });

    levelEditor = new window.TechnoDash.LevelEditor({
      levelData: currentLevelData,
      onLevelChange: (levelData) => {
        if (isRestoringWorkspace || isResettingWorkspace) {
          return;
        }

        currentLevelData = window.TechnoDash.Level.normalize(levelData);
        setGameMode("test");
        resetValidation("Le niveau a changé. Relance la validation.");
        isSyncingSettings = true;
        blockEditor.updateSettings(readSettings());
        isSyncingSettings = false;
        updatePseudoCode();
        updateGamePreview(true);
        autoSaveWorkspace();
      }
    });

    if (savedWorkspace) {
      blockEditor.loadProgramState(savedWorkspace.program);
    }
    currentProgramState = blockEditor.getProgramState();
    currentLevelData = levelEditor.getLevelData();
    isRestoringWorkspace = false;

    updateLevelNameDisplay();
    updateGameChrome();
    status.textContent = savedWorkspace ? "Projet restauré" : "Programme de base";
    updatePseudoCode();

    document.getElementById("test-button").addEventListener("click", startTest);
    document.getElementById("reset-program-button").addEventListener("click", resetWorkspace);
    playButton.addEventListener("click", () => {
      if (currentGameMode === "play") {
        startLoadedGame();
        return;
      }

      startTest();
    });
    document.getElementById("stop-button").addEventListener("click", () => {
      if (gameScene) {
        gameScene.stop();
      }
    });
    document.getElementById("reset-button").addEventListener("click", () => {
      if (gameScene) {
        gameScene.reset(false);
      }
    });
    validateLevelButton.addEventListener("click", startValidation);
    startValidationButton.addEventListener("click", startValidation);
    downloadLevelButton.addEventListener("click", downloadValidatedLevel);
    closeValidationButton.addEventListener("click", () => {
      validationModal.hidden = true;
    });
    loadLevelButton.addEventListener("click", () => {
      levelFileInput.value = "";
    });
    loadLevelButton.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      levelFileInput.value = "";
      levelFileInput.click();
    });
    levelFileInput.addEventListener("change", () => {
      const selectedFile = levelFileInput.files && levelFileInput.files[0]
        ? levelFileInput.files[0]
        : null;
      loadLevelFromFile(selectedFile);
      levelFileInput.value = "";
    });
  });
})();
