(() => {
  window.addEventListener("DOMContentLoaded", () => {
    const autosaveKey = "dash-maker-autosave";
    const legacyAutosaveKey = "technodash-workshop-autosave";
    const ratedLevelsKey = "dash-maker-rated-levels";
    const ratingVoterKey = "dash-maker-rating-voter-id";
    const lastViewKey = "dash-maker-last-view";
    const defaultLevelName = "My level 1";
    const defaultSettings = window.TechnoDash.Level.getDefaultData().settings;
    const supabase = new window.TechnoDash.SupabaseManager({
      restUrl: "https://mqfaxpfiqxpinbyqfwpg.supabase.co/rest/v1",
      apiKey: "sb_publishable_DUE6pD0GAdF1zMq7HtOtLA_GZd6Etfw",
      tableName: "community_levels",
      voteTableName: "community_level_votes",
      useVoteTable: false
    });

    const makerProgramState = {
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
      blockSections: {
        addBackground: "initialization",
        addPlayer: "initialization",
        addGround: "initialization",
        addObstacles: "initialization",
        addDecorations: "initialization",
        addFinish: "initialization",
        loop: "gameplay",
        moveLevel: "gameplay",
        applyGravity: "gameplay",
        spacePressed: "gameplay",
        playerGrounded: "gameplay",
        jump: "gameplay",
        hitObstacle: "gameplay",
        showGameOver: "gameplay",
        reachFinish: "gameplay",
        showVictory: "gameplay",
        showDistance: "gameplay",
        showScore: "gameplay",
        restartGame: "gameplay"
      },
      hasDefaultStart: true
    };

    const elements = {
      homeView: document.getElementById("home-view"),
      homeButton: document.getElementById("home-button"),
      brandHomeButton: document.getElementById("brand-home-button"),
      communityBrandHomeButton: document.getElementById("community-brand-home-button"),
      openEditorButton: document.getElementById("open-editor-button"),
      refreshCommunityButton: document.getElementById("refresh-community-button"),
      communityStatus: document.getElementById("community-status"),
      communityFeaturedList: document.getElementById("community-featured-list"),
      communityLevelList: document.getElementById("community-level-list"),
      communitySortSummary: document.getElementById("community-sort-summary"),
      communitySortButtons: [...document.querySelectorAll("[data-community-sort]")],
      appShell: document.querySelector(".app-shell"),
      communityGameMenu: document.getElementById("community-game-menu"),
      communityGameName: document.getElementById("community-game-name"),
      communityGamePlays: document.getElementById("community-game-plays"),
      communityGameDeaths: document.getElementById("community-game-deaths"),
      communityGameSuccesses: document.getElementById("community-game-successes"),
      communityGameRating: document.getElementById("community-game-rating"),
      communityRestartButton: document.getElementById("community-restart-button"),
      communityHomeButton: document.getElementById("community-home-button"),
      communityEditorButton: document.getElementById("community-editor-button"),
      communityClearModal: document.getElementById("community-clear-modal"),
      closeCommunityClearButton: document.getElementById("close-community-clear-button"),
      communityClearTitle: document.getElementById("community-clear-title"),
      communityClearSummary: document.getElementById("community-clear-summary"),
      communityClearAttempts: document.getElementById("community-clear-attempts"),
      communityClearRatingStars: document.getElementById("community-clear-rating-stars"),
      communityClearRatingStatus: document.getElementById("community-clear-rating-status"),
      communityClearRetryButton: document.getElementById("community-clear-retry-button"),
      communityClearHomeButton: document.getElementById("community-clear-home-button"),
      modeButtons: [...document.querySelectorAll(".mode-button")],
      editorView: document.getElementById("editor-view"),
      gameView: document.getElementById("game-view"),
      status: document.getElementById("program-status"),
      workspaceState: document.getElementById("workspace-state"),
      levelNameLabel: document.getElementById("level-name-label"),
      loadedLevelLabel: document.getElementById("loaded-level-label"),
      levelNameInput: document.getElementById("level-name-input"),
      validateModeButton: document.getElementById("validate-mode-button"),
      validationStatusBadge: document.getElementById("validation-status-badge"),
      validationBox: document.getElementById("validation-box"),
      validationMessage: document.getElementById("validation-message"),
      validationStateLabel: document.getElementById("validation-state-label"),
      validationDistanceLabel: document.getElementById("validation-distance-label"),
      validationRunPanel: document.getElementById("validation-run-panel"),
      validationRunMessage: document.getElementById("validation-run-message"),
      validationRunState: document.getElementById("validation-run-state"),
      validationRunGoal: document.getElementById("validation-run-goal"),
      validationRunDistance: document.getElementById("validation-run-distance"),
      retryValidationButton: document.getElementById("retry-validation-button"),
      shareValidationRunButton: document.getElementById("share-validation-run-button"),
      validateLevelButton: document.getElementById("validate-level-button"),
      startValidationButton: document.getElementById("start-validation-button"),
      saveProjectButton: document.getElementById("save-project-button"),
      resetProjectButton: document.getElementById("reset-project-button"),
      loadLevelButton: document.getElementById("load-level-button"),
      levelFileInput: document.getElementById("level-file-input"),
      openPropertiesButton: document.getElementById("open-properties-button"),
      propertiesModal: document.getElementById("properties-modal"),
      closePropertiesButton: document.getElementById("close-properties-button"),
      publishModal: document.getElementById("publish-modal"),
      closePublishModalButton: document.getElementById("close-publish-modal-button"),
      cancelPublishButton: document.getElementById("cancel-publish-button"),
      confirmPublishButton: document.getElementById("confirm-publish-button"),
      publishLevelNameInput: document.getElementById("publish-level-name-input"),
      publishStatus: document.getElementById("publish-status"),
      openValidationButton: document.getElementById("open-validation-button"),
      validationModal: document.getElementById("validation-modal"),
      closeValidationModalButton: document.getElementById("close-validation-modal-button"),
      openClearLevelButton: document.getElementById("open-clear-level-button"),
      clearLevelModal: document.getElementById("clear-level-modal"),
      clearLevelCard: document.querySelector("#clear-level-modal .modal-card"),
      closeClearLevelButton: document.getElementById("close-clear-level-button"),
      cancelClearLevelButton: document.getElementById("cancel-clear-level-button"),
      advanceClearLevelButton: document.getElementById("advance-clear-level-button"),
      confirmClearLevelButton: document.getElementById("confirm-clear-level-button"),
      clearLevelStepLabel: document.getElementById("clear-level-step-label"),
      clearLevelMessage: document.getElementById("clear-level-message"),
      openSelectionButton: document.getElementById("open-selection-button"),
      selectionModal: document.getElementById("selection-modal"),
      closeSelectionButton: document.getElementById("close-selection-button"),
      gameTitle: document.getElementById("game-title"),
      exitGameButton: document.getElementById("exit-game-button"),
      playButton: document.getElementById("play-button"),
      stopButton: document.getElementById("stop-button"),
      resetButton: document.getElementById("reset-button"),
      toolbarPlayButton: document.getElementById("toolbar-play-button"),
      toolbarPauseButton: document.getElementById("toolbar-pause-button"),
      toolbarStopButton: document.getElementById("toolbar-stop-button"),
      toolbarResetViewButton: document.getElementById("toolbar-reset-view-button"),
      zoomOutButton: document.getElementById("zoom-out-button"),
      zoomInButton: document.getElementById("zoom-in-button"),
      zoomLabel: document.getElementById("zoom-label"),
      themeSelect: document.getElementById("theme-select"),
      speedOutput: document.getElementById("speed-output"),
      gravityOutput: document.getElementById("gravity-output"),
      jumpOutput: document.getElementById("jump-output"),
      speedInput: document.getElementById("speed-input"),
      gravityInput: document.getElementById("gravity-input"),
      jumpInput: document.getElementById("jump-input"),
      backgroundColorInput: document.getElementById("background-color-input"),
      gameStateLabel: document.getElementById("game-state-label"),
      distanceValue: document.getElementById("distance-value"),
      scoreValue: document.getElementById("score-value"),
      gameMessage: document.getElementById("game-message"),
      gameFrame: document.querySelector(".game-frame"),
      mobileJumpButton: document.getElementById("mobile-jump-button"),
      mobileRestartButton: document.getElementById("mobile-restart-button"),
      validationSuccessOverlay: document.getElementById("validation-success-overlay"),
      validationSuccessScreen: document.getElementById("validation-success-screen"),
      shareValidatedLevelButton: document.getElementById("share-validated-level-button"),
      closeValidationSuccessButton: document.getElementById("close-validation-success-button"),
      levelScroll: document.getElementById("level-scroll"),
      paletteTabs: [...document.querySelectorAll("[data-palette-tab]")],
      palettePanels: [...document.querySelectorAll(".palette-tab-panel")],
      backgroundPaletteButton: document.getElementById("background-palette-button"),
      backgroundPalettePreview: document.getElementById("background-palette-preview"),
      panelToggles: [...document.querySelectorAll("[data-panel-toggle]")],
      statsButton: document.getElementById("stats-button"),
      statsModal: document.getElementById("stats-modal"),
      closeStatsButton: document.getElementById("close-stats-button"),
      statsSpeedValue: document.getElementById("stats-speed-value"),
      statsGravityValue: document.getElementById("stats-gravity-value"),
      statsJumpValue: document.getElementById("stats-jump-value"),
      statsObjectsValue: document.getElementById("stats-objects-value"),
      statsDecorValue: document.getElementById("stats-decor-value")
    };

    const sanitizeLevelName = (name) => {
      const cleaned = String(name || "").replace(/\.json$/i, "").trim();
      if (!cleaned || cleaned.toLowerCase() === "sans nom") {
        return defaultLevelName;
      }
      return cleaned;
    };

    const preloadAssetCache = new Map();

    const slugifyLevelName = (name) => {
      const source = sanitizeLevelName(name);
      const slug = source
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return slug || `dash-maker-level-${new Date().toISOString().slice(0, 10)}`;
    };

    const readSavedWorkspace = () => {
      const raw = localStorage.getItem(autosaveKey) || localStorage.getItem(legacyAutosaveKey);
      if (!raw) {
        return null;
      }

      try {
        const saved = JSON.parse(raw);
        return {
          level: saved && saved.level
            ? window.TechnoDash.Level.normalize(saved.level)
            : window.TechnoDash.Level.getDefaultData(),
          levelName: sanitizeLevelName(saved && saved.levelName),
          loadedFileName: saved && saved.loadedFileName ? String(saved.loadedFileName) : "",
          validationPassed: Boolean(saved && saved.validationPassed && saved.validatedLevelData),
          validatedLevelData: saved && saved.validatedLevelData
            ? window.TechnoDash.Level.normalize(saved.validatedLevelData)
            : null
        };
      } catch (error) {
        console.warn("Saved workspace is unreadable", error);
        return null;
      }
    };

    const readSavedView = () => {
      try {
        return localStorage.getItem(lastViewKey) === "editor" ? "editor" : "home";
      } catch (error) {
        console.warn("Saved view is unreadable", error);
        return "home";
      }
    };

    const saveLastView = (viewName) => {
      try {
        localStorage.setItem(lastViewKey, viewName === "editor" ? "editor" : "home");
      } catch (error) {
        console.warn("Last view could not be saved", error);
      }
    };

    const readRatedLevels = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(ratedLevelsKey) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        console.warn("Rated levels storage is unreadable", error);
        return {};
      }
    };

    const getRatingVoterId = () => {
      const existing = localStorage.getItem(ratingVoterKey);
      if (existing) {
        return existing;
      }

      const generated = window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `voter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(ratingVoterKey, generated);
      return generated;
    };

    const getRatedStars = (levelId) => {
      const stars = Number(readRatedLevels()[String(levelId)]);
      return Number.isFinite(stars) && stars >= 1 ? Math.min(5, Math.round(stars)) : 0;
    };

    const hasRatedLevel = (levelId) => getRatedStars(levelId) > 0;

    const markLevelRated = (levelId, stars) => {
      ratedLevels = readRatedLevels();
      ratedLevels[String(levelId)] = Math.min(5, Math.max(1, Math.round(Number(stars) || 0)));
      localStorage.setItem(ratedLevelsKey, JSON.stringify(ratedLevels));
    };

    const savedWorkspace = readSavedWorkspace();
    const savedInitialView = readSavedView();
    let ratedLevels = readRatedLevels();
    let currentLevelData = savedWorkspace ? savedWorkspace.level : window.TechnoDash.Level.getDefaultData();
    let currentLevelName = savedWorkspace ? savedWorkspace.levelName : defaultLevelName;
    let loadedFileName = savedWorkspace ? savedWorkspace.loadedFileName : "";
    let currentMode = "create";
    let gameRunMode = "test";
    let game = null;
    let gameScene = null;
    let levelEditor = null;
    let validationActive = false;
    let validationCheckRequested = false;
    let validationPassed = savedWorkspace ? savedWorkspace.validationPassed : false;
    let validatedLevelData = validationPassed ? savedWorkspace.validatedLevelData : null;
    let validationSuccessDismissed = false;
    let validationSuccessTimer = 0;
    let isRestoringWorkspace = true;
    let zoomRatio = 1;
    let communityLevels = [];
    let communitySortKey = "moment";
    let activeCommunityLevel = null;
    let pendingRatingLevelIds = new Set();
    let communitySessionLevelId = "";
    let communitySessionAttempts = 0;
    let communityRunStatsSent = {
      play: false,
      death: false,
      success: false
    };

    const setWorkspaceMessage = (message) => {
      elements.workspaceState.textContent = message;
      elements.status.textContent = message;
    };

    const setCommunityStatus = (message) => {
      if (elements.communityStatus) {
        elements.communityStatus.textContent = message;
      }
    };

    const setTextIfChanged = (element, value) => {
      if (!element) {
        return;
      }

      const text = String(value);
      if (element.textContent !== text) {
        element.textContent = text;
      }
    };

    const hasCoarsePointer = () => window.matchMedia
      && window.matchMedia("(pointer: coarse)").matches;

    const isMobileViewport = () => window.matchMedia
      && window.matchMedia("(max-width: 1359px)").matches;

    const isMobileEditorLocked = () => isMobileViewport() && hasCoarsePointer();

    const isMobileCommunityHomeLayout = () => isMobileViewport() && hasCoarsePointer();

    const isMobileGamePerformanceMode = () => isMobileViewport() && hasCoarsePointer();

    const getGamePerformanceProfile = () => {
      const mobilePerformance = isMobileGamePerformanceMode();
      const logicalViewport = window.TechnoDash.Level.getViewportSize();
      const scene = {
        lowDetail: false,
        showGrid: true,
        renderDecorations: true,
        gridStep: 1,
        renderScale: 1,
        logicalWidth: logicalViewport.width,
        logicalHeight: logicalViewport.height,
        useDecorationAtlas: mobilePerformance,
        adaptiveQuality: mobilePerformance
      };
      if (!mobilePerformance) {
        scene.useDecorationAtlas = false;
        scene.adaptiveQuality = false;
      }
      return {
        mobilePerformance,
        logicalViewport,
        renderViewport: {
          width: Math.round(logicalViewport.width * scene.renderScale),
          height: Math.round(logicalViewport.height * scene.renderScale)
        },
        scene
      };
    };

    const getLevelAssetPreloadList = (levelData) => {
      const profile = getGamePerformanceProfile();
      const data = window.TechnoDash.Level.normalize(levelData);
      const types = [...new Set(data.decorations.map((decoration) => decoration.type))]
        .map((type) => window.TechnoDash.Level.getDecorationForType(type))
        .filter(Boolean);
      if (!types.length) {
        return [];
      }

      if (profile.scene.useDecorationAtlas) {
        const themes = [...new Set(types.map((decoration) => decoration.theme).filter(Boolean))];
        return themes.flatMap((theme) => [
          { type: "image", src: window.TechnoDash.GameScene.getDecorationAtlasPath(theme, "png") },
          { type: "json", src: window.TechnoDash.GameScene.getDecorationAtlasPath(theme, "json") }
        ]);
      }

      return types.map((decoration) => ({
        type: "image",
        src: `assets/decor/${decoration.file}`
      }));
    };

    const preloadAsset = (asset) => {
      if (!asset || !asset.src) {
        return Promise.resolve();
      }

      if (preloadAssetCache.has(asset.src)) {
        return preloadAssetCache.get(asset.src);
      }

      const promise = asset.type === "json"
        ? fetch(asset.src, { cache: "force-cache" }).then((response) => {
          if (!response.ok) {
            throw new Error(`Could not preload ${asset.src}`);
          }
          return response.text();
        })
        : new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = () => reject(new Error(`Could not preload ${asset.src}`));
          image.src = asset.src;
        });
      preloadAssetCache.set(asset.src, promise.catch((error) => {
        preloadAssetCache.delete(asset.src);
        throw error;
      }));
      return preloadAssetCache.get(asset.src);
    };

    const preloadLevelAssets = async (levelData) => {
      const assets = getLevelAssetPreloadList(levelData);
      if (!assets.length) {
        return;
      }

      await Promise.allSettled(assets.map((asset) => preloadAsset(asset)));
    };

    const applyGamePerformanceProfile = () => {
      const performanceProfile = getGamePerformanceProfile();
      if (gameScene) {
        gameScene.setPerformanceProfile(performanceProfile.scene);
        if (gameScene.created && typeof gameScene.renderWorld === "function") {
          gameScene.renderWorld();
        }
      }
      return performanceProfile;
    };

    const showMobileEditorLockedMessage = () => {
      const message = "Editor is temporarily unavailable on mobile.";
      setCommunityStatus(message);
      setWorkspaceMessage(message);
    };

    const setActiveView = (viewName) => {
      elements.editorView.classList.toggle("is-active", viewName === "editor");
      elements.gameView.classList.toggle("is-active", viewName === "game");
      elements.appShell.classList.toggle("is-game-mode", viewName === "game");
    };

    const activateMode = (mode) => {
      currentMode = mode;
      const isValidationMode = mode === "validation";
      elements.appShell.classList.toggle("is-validation-mode", isValidationMode);
      if (elements.validationRunPanel) {
        elements.validationRunPanel.hidden = !isValidationMode;
      }
      elements.modeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.mode === mode);
      });

      if (mode === "test" || mode === "validation") {
        setActiveView("game");
        ensureGame();
        updateGameChrome(mode === "validation" ? "validation" : "test");
        if (mode === "test") {
          updateGamePreview(false);
        }
        return;
      }

      setActiveView("editor");
    };

    const updateLevelNameDisplay = () => {
      elements.levelNameInput.value = currentLevelName;
      elements.levelNameLabel.textContent = `Level: ${currentLevelName}`;
      elements.levelNameLabel.title = currentLevelName;
      elements.loadedLevelLabel.textContent = loadedFileName
        ? `File: ${loadedFileName}`
        : "Current level";
    };

    const updateLevelActionButton = () => {
      if (!elements.validateModeButton) {
        return;
      }

      elements.validateModeButton.classList.toggle("is-validated", validationPassed);
      elements.validateModeButton.setAttribute(
        "aria-label",
        validationPassed ? "Validated level" : "Validate level"
      );
    };

    const updateValidationBadge = () => {
      if (elements.validationStatusBadge) {
        elements.validationStatusBadge.classList.toggle("is-valid", validationPassed);
        elements.validationStatusBadge.classList.toggle("is-invalid", !validationPassed);
        elements.validationStatusBadge.textContent = validationPassed
          ? "Status: Validated"
          : "Status: Not validated";
      }
      updateLevelActionButton();
    };

    const updatePropertyOutputs = () => {
      const settings = currentLevelData.settings;
      elements.speedOutput.textContent = `${(settings.speed / defaultSettings.speed).toFixed(2)}x`;
      elements.gravityOutput.textContent = `${(settings.gravity / defaultSettings.gravity).toFixed(2)}x`;
      elements.jumpOutput.textContent = `${(settings.jumpForce / defaultSettings.jumpForce).toFixed(2)}x`;
      elements.statsSpeedValue.textContent = elements.speedOutput.textContent;
      elements.statsGravityValue.textContent = elements.gravityOutput.textContent;
      elements.statsJumpValue.textContent = elements.jumpOutput.textContent;
      elements.statsObjectsValue.textContent = String(currentLevelData.obstacles.length);
      if (elements.statsDecorValue) {
        elements.statsDecorValue.textContent = String(currentLevelData.decorations.length);
      }

      const matchingTheme = [...elements.themeSelect.options].find((option) => option.value.toLowerCase() === settings.backgroundColor);
      elements.themeSelect.value = matchingTheme ? matchingTheme.value : settings.backgroundColor;
      if (elements.backgroundPalettePreview) {
        elements.backgroundPalettePreview.style.background = settings.backgroundColor || "#071322";
      }
    };

    const autoSaveWorkspace = (message = "") => {
      if (isRestoringWorkspace || !levelEditor) {
        return;
      }

      try {
        localStorage.setItem(autosaveKey, JSON.stringify({
          savedAt: new Date().toISOString(),
          level: levelEditor.getLevelData(),
          levelName: currentLevelName,
          loadedFileName,
          validationPassed,
          validatedLevelData
        }));
        if (message) {
          setWorkspaceMessage(message);
        }
      } catch (error) {
        console.warn("Local save failed", error);
        setWorkspaceMessage("Local save failed");
      }
    };

    const setLevelName = (name) => {
      currentLevelName = sanitizeLevelName(name);
      updateLevelNameDisplay();
      autoSaveWorkspace("Autosaved locally");
    };

    const syncCurrentLevelFromEditor = () => {
      if (levelEditor) {
        currentLevelData = levelEditor.getLevelData();
      }

      return currentLevelData;
    };

    const levelHasFinish = (levelData = syncCurrentLevelFromEditor()) => (
      levelData.obstacles.some((obstacle) => obstacle.type === "finish")
    );

    const setValidationState = (state, message, distance = 0) => {
      elements.validationBox.dataset.state = state;
      elements.validationMessage.textContent = message;
      elements.validationDistanceLabel.textContent = `Distance ${Math.max(0, Math.floor(distance))}`;
      const labels = {
        idle: "Clear check required",
        running: "Checking",
        failed: "Check failed",
        passed: "Validated"
      };
      elements.validationStateLabel.textContent = labels[state] || labels.idle;
      if (elements.validationRunPanel) {
        elements.validationRunPanel.dataset.state = state;
      }
      if (elements.validationRunMessage) {
        elements.validationRunMessage.textContent = message;
      }
      if (elements.validationRunState) {
        elements.validationRunState.textContent = labels[state] || labels.idle;
      }
      if (elements.validationRunDistance) {
        elements.validationRunDistance.textContent = `Distance ${Math.max(0, Math.floor(distance))}`;
      }
      if (elements.validationRunGoal) {
        elements.validationRunGoal.textContent = levelHasFinish()
          ? "Goal: reach the finish"
          : "Missing: finish line";
      }
      if (elements.shareValidationRunButton) {
        elements.shareValidationRunButton.hidden = state !== "passed";
      }
    };

    const resetValidation = (message = "The level changed. Run a new clear check.") => {
      validationActive = false;
      validationCheckRequested = false;
      validationPassed = false;
      validatedLevelData = null;
      validationSuccessDismissed = false;
      updateValidationBadge();
      setValidationState("idle", message);
      hideValidationSuccessFeedback();
    };

    const bindValidationSuccessActions = () => {
      if (elements.shareValidatedLevelButton && !elements.shareValidatedLevelButton.dataset.bound) {
        elements.shareValidatedLevelButton.dataset.bound = "true";
        elements.shareValidatedLevelButton.addEventListener("click", () => openPublishModal());
      }

      if (elements.closeValidationSuccessButton && !elements.closeValidationSuccessButton.dataset.bound) {
        elements.closeValidationSuccessButton.dataset.bound = "true";
        elements.closeValidationSuccessButton.addEventListener("click", () => {
          hideValidationSuccessFeedback();
          returnToEditor();
        });
      }
    };

    const ensureValidationSuccessScreen = () => {
      if (elements.validationSuccessScreen) {
        bindValidationSuccessActions();
        return elements.validationSuccessScreen;
      }

      const screen = document.createElement("div");
      screen.id = "validation-success-screen";
      screen.className = "validation-success-screen";
      screen.hidden = true;
      screen.setAttribute("aria-live", "assertive");
      screen.innerHTML = [
        "<section class=\"validation-success-screen-card\">",
        "<strong id=\"validation-success-title\">Level validated</strong>",
        "<span>Do you want to publish it to the community?</span>",
        "<div class=\"validation-success-actions\">",
        "<button id=\"share-validated-level-button\" class=\"publish-action\" type=\"button\">Publish now</button>",
        "<button id=\"close-validation-success-button\" class=\"secondary-action\" type=\"button\">Back to editor</button>",
        "</div>",
        "</section>"
      ].join("");
      document.body.appendChild(screen);
      elements.validationSuccessScreen = screen;
      elements.shareValidatedLevelButton = screen.querySelector("#share-validated-level-button");
      elements.closeValidationSuccessButton = screen.querySelector("#close-validation-success-button");
      bindValidationSuccessActions();
      return screen;
    };

    const hideValidationSuccessFeedback = () => {
      if (validationSuccessTimer) {
        window.clearTimeout(validationSuccessTimer);
        validationSuccessTimer = 0;
      }
      if (elements.validationSuccessOverlay) {
        elements.validationSuccessOverlay.hidden = true;
      }
      const successScreen = ensureValidationSuccessScreen();
      successScreen.hidden = true;
      elements.gameMessage.classList.remove("is-validated");
      if (elements.shareValidationRunButton) {
        elements.shareValidationRunButton.hidden = true;
      }
    };

    const showValidationSuccessFeedback = () => {
      validationSuccessTimer = 0;
      if (validationSuccessDismissed || !validationPassed) {
        return;
      }

      elements.gameStateLabel.textContent = "Validated";
      elements.gameMessage.textContent = "Level validated";
      elements.gameMessage.classList.remove("is-gameover");
      elements.gameMessage.classList.add("is-victory", "is-validated");
      if (elements.validationSuccessOverlay) {
        elements.validationSuccessOverlay.hidden = true;
      }
      const successScreen = ensureValidationSuccessScreen();
      successScreen.hidden = false;
      if (elements.validationRunPanel && gameRunMode === "validation") {
        elements.validationRunPanel.hidden = false;
        elements.validationRunPanel.dataset.state = "passed";
      }
      if (elements.shareValidationRunButton) {
        elements.shareValidationRunButton.hidden = false;
      }
      setWorkspaceMessage("Level validated. You can publish it.");
    };

    const completeValidation = (stats) => {
      validationActive = false;
      validationCheckRequested = false;
      validationPassed = true;
      validatedLevelData = levelEditor.getLevelData();
      updateValidationBadge();
      setValidationState("passed", "Clear check complete. You can publish the level.", stats.distance);
      autoSaveWorkspace("Level validated");
      if (gameScene) {
        gameScene.stop();
      }
      validationSuccessDismissed = false;
      if (validationSuccessTimer) {
        window.clearTimeout(validationSuccessTimer);
      }
      validationSuccessTimer = window.setTimeout(showValidationSuccessFeedback, 0);
    };

    const failValidation = (stats) => {
      if (validationPassed) {
        return;
      }

      if (stats && (stats.reachedFinish || stats.status === "Victory")) {
        completeValidation(stats);
        return;
      }

      validationActive = false;
      validationCheckRequested = false;
      validationPassed = false;
      validatedLevelData = null;
      updateValidationBadge();
      setValidationState("failed", "Game Over. Edit the level or try the clear check again.", stats.distance);
      hideValidationSuccessFeedback();
      setWorkspaceMessage("Validation failed");
    };

    const updateValidationFromStats = (stats) => {
      if (gameRunMode !== "validation") {
        return;
      }

      if (stats.reachedFinish || stats.status === "Victory") {
        completeValidation(stats);
        return;
      }

      if (!validationActive) {
        return;
      }

      if (stats.status === "Game Over") {
        failValidation(stats);
        return;
      }

      setValidationState("running", "Play the full level. Publishing unlocks when the cube reaches the finish.", stats.distance);
    };

    const syncValidationRunStartFromStats = (stats) => {
      if (!validationCheckRequested || gameRunMode !== "validation" || stats.status !== "Playing" || stats.reachedFinish) {
        return;
      }

      if (!levelHasFinish()) {
        validationActive = false;
        validationCheckRequested = false;
        validationPassed = false;
        validatedLevelData = null;
        updateValidationBadge();
        setValidationState("failed", "Add a finish line before publishing.", stats.distance);
        return;
      }

      if (validationActive && !validationPassed) {
        return;
      }

      validationActive = true;
      validationCheckRequested = true;
      validationPassed = false;
      validatedLevelData = null;
      hideValidationSuccessFeedback();
      updateValidationBadge();
      setValidationState("running", "Play the full level. Publishing unlocks when the cube reaches the finish.", stats.distance);
      setWorkspaceMessage("Clear check running");
    };

    const updateGameStats = (stats) => {
      setTextIfChanged(elements.gameStateLabel, stats.status);
      setTextIfChanged(elements.distanceValue, stats.showDistance ? stats.distance : "-");
      setTextIfChanged(elements.scoreValue, stats.showScore ? stats.score : "-");
      syncValidationRunStartFromStats(stats);
      updateCommunityRunFromStats(stats);
      if (gameRunMode === "validation" && (stats.reachedFinish || stats.status === "Victory")) {
        if (!validationPassed) {
          completeValidation(stats);
        } else {
          showValidationSuccessFeedback();
        }
        return;
      }

      setTextIfChanged(elements.gameMessage, stats.status);
      elements.gameMessage.dataset.grounded = String(Boolean(stats.grounded));
      elements.gameMessage.dataset.playerY = String(stats.playerY);
      elements.gameMessage.classList.toggle("is-gameover", stats.status === "Game Over");
      elements.gameMessage.classList.toggle("is-victory", stats.status === "Victory");
      elements.gameMessage.classList.toggle("is-validated", stats.status === "Validated");
      updateValidationFromStats(stats);
    };

    const getCommunityLevel = (levelId) => communityLevels.find((level) => String(level.id) === String(levelId));

    const getCommunityLevelData = (level) => {
      const fallbackLevel = level && level.id ? getCommunityLevel(level.id) : null;
      const source = level && (level.level_data || level.levelData || level.level)
        || fallbackLevel && (fallbackLevel.level_data || fallbackLevel.levelData || fallbackLevel.level);
      return window.TechnoDash.Level.normalize(source);
    };

    const getAverageRating = (level) => {
      const count = Number(level && level.rating_count ? level.rating_count : 0);
      if (!count) {
        return 0;
      }

      return Number(level.rating_total || 0) / count;
    };

    const getRatingLabel = (level) => {
      const count = Number(level && level.rating_count ? level.rating_count : 0);
      if (!count) {
        return "No rating";
      }

      return `${getAverageRating(level).toFixed(1)} ★ (${count})`;
    };

    const updateCommunityGameInfo = () => {
      if (!activeCommunityLevel) {
        elements.communityGameMenu.hidden = true;
        return;
      }

      elements.communityGameMenu.hidden = false;
      elements.communityGameName.textContent = activeCommunityLevel.name || "Community level";
      elements.communityGamePlays.textContent = String(activeCommunityLevel.plays || 0);
      elements.communityGameDeaths.textContent = String(activeCommunityLevel.deaths || 0);
      elements.communityGameSuccesses.textContent = String(activeCommunityLevel.successes || 0);
      elements.communityGameRating.textContent = getRatingLabel(activeCommunityLevel);
    };

    const formatAttemptLabel = (attempts) => {
      const count = Math.max(1, Math.floor(Number(attempts) || 1));
      return `${count} attempt${count > 1 ? "s" : ""}`;
    };

    const closeCommunityClearModal = () => {
      if (elements.communityClearModal) {
        elements.communityClearModal.hidden = true;
      }
    };

    const renderCommunityClearRating = () => {
      if (!elements.communityClearRatingStars || !activeCommunityLevel) {
        return;
      }

      const levelId = activeCommunityLevel.id;
      const ratedStars = getRatedStars(levelId);
      const isRated = ratedStars > 0;
      const isPending = pendingRatingLevelIds.has(String(levelId));
      const displayStars = isRated ? ratedStars : Math.round(getAverageRating(activeCommunityLevel));
      elements.communityClearRatingStars.innerHTML = "";
      elements.communityClearRatingStars.classList.toggle("is-rated", isRated);
      elements.communityClearRatingStars.classList.toggle("is-pending", isPending);

      for (let index = 1; index <= 5; index += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "community-clear-star";
        button.classList.toggle("is-filled", index <= displayStars);
        button.dataset.communityClearRating = String(index);
        button.disabled = isRated || isPending;
        button.setAttribute(
          "aria-label",
          isRated ? `Already rated ${ratedStars} stars` : `Rate ${index} stars`
        );
        button.textContent = "★";
        elements.communityClearRatingStars.appendChild(button);
      }

      if (!elements.communityClearRatingStatus) {
        return;
      }

      if (isPending) {
        elements.communityClearRatingStatus.textContent = "Saving rating...";
        return;
      }

      elements.communityClearRatingStatus.textContent = isRated
        ? `Your rating: ${ratedStars} ★ · ${getRatingLabel(activeCommunityLevel)}`
        : "Choose a rating from 1 to 5 stars.";
    };

    const showCommunityClearModal = () => {
      if (!activeCommunityLevel || !elements.communityClearModal) {
        return;
      }

      const levelName = activeCommunityLevel.name || "Community game";
      elements.communityClearTitle.textContent = "Game cleared";
      elements.communityClearSummary.textContent = `You finished ${levelName}.`;
      elements.communityClearAttempts.textContent = formatAttemptLabel(communitySessionAttempts);
      renderCommunityClearRating();
      elements.communityClearModal.hidden = false;
    };

    const renderStars = (level) => {
      const average = getAverageRating(level);
      const rounded = Math.round(average);
      const ratedStars = getRatedStars(level.id);
      const isRated = ratedStars > 0;
      const isPending = pendingRatingLevelIds.has(String(level.id));
      const displayStars = isRated ? ratedStars : rounded;
      const wrapper = document.createElement("div");
      wrapper.className = "community-stars";
      wrapper.classList.toggle("is-rated", isRated);
      wrapper.classList.toggle("is-pending", isPending);
      wrapper.setAttribute("aria-label", `Rating ${average.toFixed(1)} out of 5`);

      for (let index = 1; index <= 5; index += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "community-star";
        button.classList.toggle("is-filled", index <= displayStars);
        button.dataset.levelId = level.id;
        button.dataset.rating = String(index);
        button.disabled = isRated || isPending;
        button.setAttribute(
          "aria-label",
          isRated ? `Already rated ${ratedStars} stars` : `Rate ${index} stars`
        );
        button.textContent = "★";
        wrapper.appendChild(button);
      }

      const count = document.createElement("span");
      count.textContent = isRated
        ? `Your vote: ${ratedStars} ★ · ${getRatingLabel(level)}`
        : getRatingLabel(level);
      wrapper.appendChild(count);
      return wrapper;
    };

    const communitySorts = {
      moment: {
        label: "Top moment",
        summary: "Sorted by momentum, rating, plays and freshness."
      },
      mostPlayed: {
        label: "Most played",
        summary: "Sorted by total plays."
      },
      bestRated: {
        label: "Best rated",
        summary: "Sorted by average rating, then rating count."
      },
      leastCleared: {
        label: "Hardest",
        summary: "Sorted by the lowest clear rate among played levels."
      },
      mostDeaths: {
        label: "Most deaths",
        summary: "Sorted by total deaths."
      },
      newest: {
        label: "Newest",
        summary: "Sorted by publish date."
      },
      mostCleared: {
        label: "Most cleared",
        summary: "Sorted by total clears."
      },
      highestClearRate: {
        label: "Cleanest",
        summary: "Sorted by the highest clear rate among played levels."
      },
      undiscovered: {
        label: "Undiscovered",
        summary: "Sorted by the least played recent levels."
      }
    };

    const getLevelNumber = (level, key) => Math.max(0, Number(level && level[key]) || 0);

    const getLevelCreatedAt = (level) => {
      const timestamp = Date.parse(level && level.created_at ? level.created_at : "");
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const getLevelAgeDays = (level) => {
      const timestamp = getLevelCreatedAt(level);
      if (!timestamp) {
        return 90;
      }

      return Math.max(0, (Date.now() - timestamp) / 86400000);
    };

    const getClearRate = (level) => {
      const plays = getLevelNumber(level, "plays");
      if (!plays) {
        return 0;
      }

      return Math.min(1, getLevelNumber(level, "successes") / plays);
    };

    const getDeathRate = (level) => {
      const plays = getLevelNumber(level, "plays");
      if (!plays) {
        return 0;
      }

      return getLevelNumber(level, "deaths") / plays;
    };

    const getMomentScore = (level) => {
      const plays = getLevelNumber(level, "plays");
      const deaths = getLevelNumber(level, "deaths");
      const successes = getLevelNumber(level, "successes");
      const ratingCount = getLevelNumber(level, "rating_count");
      const ratingScore = getAverageRating(level) * Math.log2(ratingCount + 2) * 4;
      const activityScore = Math.log2(plays + 1) * 8 + Math.log2(successes + 1) * 5 + Math.log2(deaths + 1) * 2;
      const freshnessScore = 22 / (1 + getLevelAgeDays(level) / 10);
      return activityScore + ratingScore + freshnessScore;
    };

    const compareNewest = (a, b) => getLevelCreatedAt(b) - getLevelCreatedAt(a);

    const compareByName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));

    const comparePlayedFirst = (a, b) => {
      const aPlayed = getLevelNumber(a, "plays") > 0 ? 1 : 0;
      const bPlayed = getLevelNumber(b, "plays") > 0 ? 1 : 0;
      return bPlayed - aPlayed;
    };

    const compareLevelFallback = (a, b) => (
      compareNewest(a, b)
      || compareByName(a, b)
    );

    const sortCommunityLevels = (levels, sortKey = communitySortKey) => {
      const source = Array.isArray(levels) ? [...levels] : [];
      return source.sort((a, b) => {
        if (sortKey === "mostPlayed") {
          return getLevelNumber(b, "plays") - getLevelNumber(a, "plays")
            || getMomentScore(b) - getMomentScore(a)
            || compareLevelFallback(a, b);
        }

        if (sortKey === "bestRated") {
          return getAverageRating(b) - getAverageRating(a)
            || getLevelNumber(b, "rating_count") - getLevelNumber(a, "rating_count")
            || getMomentScore(b) - getMomentScore(a)
            || compareLevelFallback(a, b);
        }

        if (sortKey === "leastCleared") {
          return comparePlayedFirst(a, b)
            || getClearRate(a) - getClearRate(b)
            || getDeathRate(b) - getDeathRate(a)
            || getLevelNumber(b, "deaths") - getLevelNumber(a, "deaths")
            || compareLevelFallback(a, b);
        }

        if (sortKey === "mostDeaths") {
          return getLevelNumber(b, "deaths") - getLevelNumber(a, "deaths")
            || getDeathRate(b) - getDeathRate(a)
            || compareLevelFallback(a, b);
        }

        if (sortKey === "newest") {
          return compareNewest(a, b) || getMomentScore(b) - getMomentScore(a) || compareByName(a, b);
        }

        if (sortKey === "mostCleared") {
          return getLevelNumber(b, "successes") - getLevelNumber(a, "successes")
            || getClearRate(b) - getClearRate(a)
            || compareLevelFallback(a, b);
        }

        if (sortKey === "highestClearRate") {
          return comparePlayedFirst(a, b)
            || getClearRate(b) - getClearRate(a)
            || getLevelNumber(b, "successes") - getLevelNumber(a, "successes")
            || compareLevelFallback(a, b);
        }

        if (sortKey === "undiscovered") {
          return getLevelNumber(a, "plays") - getLevelNumber(b, "plays")
            || compareNewest(a, b)
            || getAverageRating(b) - getAverageRating(a)
            || compareByName(a, b);
        }

        return getMomentScore(b) - getMomentScore(a)
          || getAverageRating(b) - getAverageRating(a)
          || getLevelNumber(b, "plays") - getLevelNumber(a, "plays")
          || compareLevelFallback(a, b);
      });
    };

    const getFeaturedCommunityLevelLimit = () => (isMobileCommunityHomeLayout() ? 2 : 3);

    const getFeaturedCommunityLevels = () => (
      sortCommunityLevels(communityLevels, "moment").slice(0, getFeaturedCommunityLevelLimit())
    );

    const createCommunityEmptyCard = (title, message) => {
      const empty = document.createElement("article");
      empty.className = "community-empty";
      const titleElement = document.createElement("strong");
      titleElement.textContent = title;
      const messageElement = document.createElement("span");
      messageElement.textContent = message;
      empty.append(titleElement, messageElement);
      return empty;
    };

    const createCommunityStatItem = (label, value) => {
      const item = document.createElement("span");
      const amount = document.createElement("strong");
      amount.textContent = String(value);
      item.append(amount, label);
      return item;
    };

    const createLevelThumbnail = (level) => {
      const canvas = document.createElement("canvas");
      canvas.className = "community-level-thumbnail";
      canvas.width = 320;
      canvas.height = 118;
      canvas.setAttribute("aria-hidden", "true");

      const context = canvas.getContext("2d");
      if (!context) {
        return canvas;
      }

      const data = getCommunityLevelData(level);
      const width = canvas.width;
      const height = canvas.height;
      const groundY = height - 18;
      const viewportHeight = window.TechnoDash.Level.getViewportSize().height;
      const scaleX = width / Math.max(data.length, window.TechnoDash.Level.getTileSize());
      const scaleY = (groundY - 8) / viewportHeight;
      context.fillStyle = data.settings.backgroundColor || "#071322";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "rgba(244, 247, 251, 0.08)";
      for (let x = 0; x < width; x += 24) {
        context.fillRect(x, 0, 1, groundY);
      }
      context.fillStyle = "#2f3747";
      context.fillRect(0, groundY, width, height - groundY);
      context.fillStyle = "#f0c04a";
      context.fillRect(0, groundY - 2, width, 3);

      data.decorations.slice(0, 18).forEach((decoration) => {
        const x = decoration.x * scaleX;
        const objectHeight = Math.max(6, decoration.height * scaleY);
        const objectWidth = Math.max(5, decoration.width * scaleX);
        context.fillStyle = "rgba(96, 165, 250, 0.22)";
        context.fillRect(x - objectWidth / 2, groundY - decoration.y * scaleY - objectHeight, objectWidth, objectHeight);
      });

      data.obstacles.slice(0, 80).forEach((obstacle) => {
        const x = obstacle.x * scaleX;
        const objectHeight = Math.max(4, obstacle.height * scaleY);
        const objectWidth = Math.max(3, obstacle.width * scaleX);
        const bottom = groundY - obstacle.y * scaleY;
        if (obstacle.type === "finish") {
          context.fillStyle = "#f4f7fb";
          context.fillRect(x - 1, 4, 2, groundY - 4);
          context.fillStyle = "#111827";
          context.fillRect(x - objectWidth / 2, bottom - objectHeight, objectWidth, objectHeight);
          return;
        }

        if (window.TechnoDash.Level.isHazardType(obstacle.type)) {
          context.fillStyle = "#ef4444";
        } else if (window.TechnoDash.Level.isModifierType(obstacle.type)) {
          context.fillStyle = "#8b5cf6";
        } else if (window.TechnoDash.Level.isPlatformType(obstacle.type)) {
          context.fillStyle = "#35b6a6";
        } else {
          context.fillStyle = "#5aa7e8";
        }

        if (obstacle.type === "triangle" || obstacle.type === "animatedSpike") {
          context.beginPath();
          context.moveTo(x, bottom - objectHeight);
          context.lineTo(x - objectWidth / 2, bottom);
          context.lineTo(x + objectWidth / 2, bottom);
          context.closePath();
          context.fill();
          return;
        }

        context.fillRect(x - objectWidth / 2, bottom - objectHeight, objectWidth, objectHeight);
      });

      return canvas;
    };

    const createCommunityLevelCard = (level, options = {}) => {
      const card = document.createElement("article");
      card.className = "community-level-card";
      if (options.featured) {
        card.classList.add("is-featured");
      }
      if (options.rank === 1) {
        card.classList.add("is-featured-primary");
      }

      const title = document.createElement("div");
      title.className = "community-level-title";
      const titleCopy = document.createElement("div");
      titleCopy.className = "community-level-title-copy";
      const name = document.createElement("h3");
      name.textContent = level.name || "Untitled level";
      const meta = document.createElement("span");
      meta.textContent = level.created_at ? new Date(level.created_at).toLocaleDateString() : "Community";
      titleCopy.append(name, meta);
      title.appendChild(titleCopy);

      if (options.featured) {
        const rank = document.createElement("span");
        rank.className = "community-rank-badge";
        rank.textContent = `Top ${options.rank || 1}`;
        title.appendChild(rank);
      }

      const stats = document.createElement("div");
      stats.className = "community-stats";
      [
        ["Played", getLevelNumber(level, "plays")],
        ["Deaths", getLevelNumber(level, "deaths")],
        ["Clears", getLevelNumber(level, "successes")]
      ].forEach(([label, value]) => {
        stats.appendChild(createCommunityStatItem(label, value));
      });

      const actions = document.createElement("div");
      actions.className = "community-card-actions";
      actions.appendChild(renderStars(level));
      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "primary-action";
      playButton.dataset.playCommunityLevel = level.id;
      playButton.textContent = "Play";
      actions.appendChild(playButton);

      card.append(createLevelThumbnail(level), title, stats, actions);
      return card;
    };

    const updateCommunitySortControls = () => {
      const sortConfig = communitySorts[communitySortKey] || communitySorts.moment;
      if (elements.communitySortSummary) {
        elements.communitySortSummary.textContent = sortConfig.summary;
      }

      elements.communitySortButtons.forEach((button) => {
        const active = button.dataset.communitySort === communitySortKey;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
    };

    const renderCommunityLevels = () => {
      if (elements.communityFeaturedList) {
        elements.communityFeaturedList.innerHTML = "";
      }
      elements.communityLevelList.innerHTML = "";
      updateCommunitySortControls();
      if (!communityLevels.length) {
        if (elements.communityFeaturedList) {
          elements.communityFeaturedList.appendChild(createCommunityEmptyCard(
            "No featured level yet",
            "Published levels will appear here as the community plays them."
          ));
        }
        elements.communityLevelList.appendChild(createCommunityEmptyCard(
          "No published level yet",
          "Validate and publish the first community level from the editor."
        ));
        return;
      }

      const featuredLevels = getFeaturedCommunityLevels();
      const featuredIds = new Set(featuredLevels.map((level) => String(level.id)));
      if (elements.communityFeaturedList) {
        const featuredFragment = document.createDocumentFragment();
        featuredLevels.forEach((level, index) => {
          featuredFragment.appendChild(createCommunityLevelCard(level, {
            featured: true,
            rank: index + 1
          }));
        });
        elements.communityFeaturedList.appendChild(featuredFragment);
      }

      const otherLevels = sortCommunityLevels(
        communityLevels.filter((level) => !featuredIds.has(String(level.id))),
        communitySortKey
      );
      const fragment = document.createDocumentFragment();
      otherLevels.forEach((level) => {
        fragment.appendChild(createCommunityLevelCard(level));
      });

      if (!otherLevels.length) {
        elements.communityLevelList.appendChild(createCommunityEmptyCard(
          "No other levels yet",
          "Once more community levels are published, this list will fill up."
        ));
        return;
      }

      elements.communityLevelList.appendChild(fragment);
    };

    const refreshCommunityLevels = async () => {
      setCommunityStatus("Loading published levels...");
      try {
        communityLevels = await supabase.listLevels();
        renderCommunityLevels();
        setCommunityStatus(communityLevels.length
          ? `${communityLevels.length} published level${communityLevels.length > 1 ? "s" : ""}`
          : "No published levels yet.");
      } catch (error) {
        console.warn("Community levels could not be loaded", error);
        communityLevels = [];
        renderCommunityLevels();
        setCommunityStatus("Community levels unavailable. Check the Supabase table and policies.");
      }
    };

    const unloadGame = () => {
      if (gameScene) {
        if (typeof gameScene.detachGlobalInputListeners === "function") {
          gameScene.detachGlobalInputListeners();
        }
        gameScene.stop();
        gameScene.setCallbacks(null);
      }

      if (game) {
        game.destroy(true);
      }

      game = null;
      gameScene = null;
      if (elements.gameFrame) {
        const gameContainer = elements.gameFrame.querySelector("#game-container");
        if (gameContainer) {
          gameContainer.innerHTML = "";
        }
      }
    };

    const showHome = () => {
      saveLastView("home");
      unloadGame();
      document.body.classList.add("is-community-home");
      window.scrollTo(0, 0);
      activeCommunityLevel = null;
      communitySessionLevelId = "";
      communitySessionAttempts = 0;
      closeCommunityClearModal();
      elements.appShell.classList.remove("is-community-play-mode");
      updateCommunityGameInfo();
      elements.appShell.classList.add("is-hidden");
      elements.homeView.hidden = false;
      refreshCommunityLevels();
    };

    const openEditor = () => {
      if (isMobileEditorLocked()) {
        showMobileEditorLockedMessage();
        return;
      }

      saveLastView("editor");
      document.body.classList.remove("is-community-home");
      window.scrollTo(0, 0);
      activeCommunityLevel = null;
      communitySessionLevelId = "";
      communitySessionAttempts = 0;
      closeCommunityClearModal();
      elements.appShell.classList.remove("is-community-play-mode");
      updateCommunityGameInfo();
      elements.homeView.hidden = true;
      elements.appShell.classList.remove("is-hidden");
      if (levelEditor) {
        currentLevelData = levelEditor.getLevelData();
      }
      activateMode("create");
      syncZoom();
      setWorkspaceMessage("Editor ready");
    };

    const recordCommunityCounter = async (fieldName) => {
      if (!activeCommunityLevel || !activeCommunityLevel.id) {
        return;
      }

      const levelId = String(activeCommunityLevel.id);
      const levelSnapshot = activeCommunityLevel;
      try {
        const updated = await supabase.incrementCounter(levelId, fieldName);
        if (updated) {
          const listedLevel = getCommunityLevel(levelId);
          const mergedLevel = {
            ...(listedLevel || {}),
            ...levelSnapshot,
            ...updated
          };

          if (!mergedLevel.id) {
            mergedLevel.id = levelId;
          }

          let foundLevel = false;
          communityLevels = communityLevels.map((level) => {
            if (String(level.id) !== levelId) {
              return level;
            }

            foundLevel = true;
            return {
              ...level,
              ...mergedLevel
            };
          });

          if (!foundLevel) {
            communityLevels = [mergedLevel, ...communityLevels];
          }

          if (activeCommunityLevel && String(activeCommunityLevel.id) === levelId) {
            activeCommunityLevel = {
              ...activeCommunityLevel,
              ...mergedLevel
            };
            updateCommunityGameInfo();
          }
        }
      } catch (error) {
        console.warn(`Could not update ${fieldName}`, error);
      }
    };

    const updateCommunityRunFromStats = (stats) => {
      if (gameRunMode !== "community" || !activeCommunityLevel) {
        return;
      }

      if ((stats.reachedFinish || stats.status === "Victory") && !communityRunStatsSent.success) {
        communityRunStatsSent.success = true;
        recordCommunityCounter("successes");
        showCommunityClearModal();
        return;
      }

      if (stats.status === "Game Over" && !communityRunStatsSent.death) {
        communityRunStatsSent.death = true;
        recordCommunityCounter("deaths");
      }
    };

    const startCommunityLevel = async (level) => {
      saveLastView("home");
      const levelId = String(level && level.id ? level.id : "");
      if (communitySessionLevelId !== levelId) {
        communitySessionLevelId = levelId;
        communitySessionAttempts = 0;
      }

      communitySessionAttempts += 1;
      activeCommunityLevel = level;
      communityRunStatsSent = {
        play: false,
        death: false,
        success: false
      };

      const levelData = getCommunityLevelData(level);
      document.body.classList.remove("is-community-home");
      window.scrollTo(0, 0);
      elements.homeView.hidden = true;
      elements.appShell.classList.remove("is-hidden");
      elements.appShell.classList.remove("is-validation-mode");
      elements.appShell.classList.add("is-community-play-mode");
      elements.modeButtons.forEach((button) => button.classList.remove("is-active"));
      if (elements.validationRunPanel) {
        elements.validationRunPanel.hidden = true;
      }
      updateCommunityGameInfo();
      setActiveView("game");
      updateGameChrome("community", level.name || "Community level");
      hideValidationSuccessFeedback();
      closeCommunityClearModal();
      setWorkspaceMessage(`Playing ${level.name || "community level"}`);
      await preloadLevelAssets(levelData);
      ensureGame();

      const loadCommunityRun = () => {
        if (!gameScene) {
          return;
        }
        gameScene.setProgramState(makerProgramState);
        gameScene.loadLevel(levelData, { play: true });
      };

      if (gameScene && gameScene.created) {
        loadCommunityRun();
      } else {
        window.setTimeout(loadCommunityRun, 80);
      }

      communityRunStatsSent.play = true;
      recordCommunityCounter("plays");
    };

    const rateCommunityLevel = async (levelId, stars) => {
      const levelKey = String(levelId);
      if (hasRatedLevel(levelKey)) {
        setCommunityStatus("You already rated this level.");
        return false;
      }

      if (pendingRatingLevelIds.has(levelKey)) {
        setCommunityStatus("Rating is already being saved.");
        return false;
      }

      pendingRatingLevelIds.add(levelKey);
      renderCommunityLevels();
      renderCommunityClearRating();
      try {
        const updated = await supabase.rateLevel(levelId, stars, getRatingVoterId());
        markLevelRated(levelKey, stars);
        if (updated) {
          if (activeCommunityLevel && String(activeCommunityLevel.id) === levelKey) {
            activeCommunityLevel = {
              ...activeCommunityLevel,
              ...updated
            };
            updateCommunityGameInfo();
          }
          communityLevels = communityLevels.map((level) => (
            String(level.id) === String(levelId) ? { ...level, ...updated } : level
          ));
        }
        setCommunityStatus("Rating saved. You cannot rate this level again.");
        return true;
      } catch (error) {
        console.warn("Rating failed", error);
        if (/duplicate|23505|already/i.test(String(error && error.message ? error.message : error))) {
          markLevelRated(levelKey, stars);
          setCommunityStatus("You already rated this level.");
          return false;
        } else {
          setCommunityStatus("Rating could not be saved.");
          return false;
        }
      } finally {
        pendingRatingLevelIds.delete(levelKey);
        renderCommunityLevels();
        renderCommunityClearRating();
      }
    };

    const openPublishModal = () => {
      if (!validationPassed || !validatedLevelData) {
        setValidationState("idle", "Validate the level before publishing.");
        return;
      }

      validationSuccessDismissed = true;
      elements.publishLevelNameInput.value = sanitizeLevelName(currentLevelName);
      elements.publishStatus.textContent = "Only the last validated version will be published.";
      elements.confirmPublishButton.disabled = false;
      ensureValidationSuccessScreen().hidden = true;
      openModal(elements.publishModal);
      window.setTimeout(() => {
        elements.publishLevelNameInput.focus();
        elements.publishLevelNameInput.select();
      }, 0);
    };

    const publishValidatedLevel = async () => {
      if (!validationPassed || !validatedLevelData) {
        elements.publishStatus.textContent = "Validate the level before publishing.";
        return;
      }

      const publishName = sanitizeLevelName(elements.publishLevelNameInput.value);
      elements.confirmPublishButton.disabled = true;
      elements.publishStatus.textContent = "Publishing level...";

      try {
        const published = await supabase.publishLevel({
          name: publishName,
          levelData: validatedLevelData
        });
        currentLevelName = publishName;
        updateLevelNameDisplay();
        autoSaveWorkspace("Level published");
        closeModal(elements.publishModal);
        setWorkspaceMessage(`Published: ${publishName}`);
        if (published) {
          communityLevels = [published, ...communityLevels.filter((level) => String(level.id) !== String(published.id))];
        }
        renderCommunityLevels();
        showHome();
      } catch (error) {
        console.warn("Publish failed", error);
        elements.publishStatus.textContent = "Publish failed. Check the Supabase table and policies.";
        elements.confirmPublishButton.disabled = false;
      }
    };

    const setPaletteTab = (tabName) => {
      elements.paletteTabs.forEach((button) => {
        const active = button.dataset.paletteTab === tabName;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });

      elements.palettePanels.forEach((panel) => {
        const active = panel.id === `${tabName}-palette-panel`;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    };

    const togglePanel = (button) => {
      const target = document.getElementById(button.dataset.panelToggle);
      if (!target) {
        return;
      }

      const expanded = button.getAttribute("aria-expanded") !== "false";
      button.setAttribute("aria-expanded", String(!expanded));
      button.classList.toggle("is-collapsed", expanded);
      target.hidden = expanded;
    };

    const openStats = () => {
      updatePropertyOutputs();
      elements.statsModal.hidden = false;
    };

    const closeStats = () => {
      elements.statsModal.hidden = true;
    };

    const openModal = (modal) => {
      if (modal) {
        modal.hidden = false;
      }
    };

    const closeModal = (modal) => {
      if (modal) {
        modal.hidden = true;
      }
    };

    const getBlockingModals = () => [
        elements.propertiesModal,
        elements.publishModal,
        elements.validationModal,
        elements.validationSuccessScreen,
        elements.clearLevelModal,
        elements.selectionModal,
        elements.statsModal,
        elements.communityClearModal
      ];

    const closeAllModals = () => {
      getBlockingModals().forEach((modal) => closeModal(modal));
    };

    const hasBlockingModalOpen = () => getBlockingModals().some((modal) => modal && !modal.hidden);

    const isTypingTarget = (target) => {
      if (!target || typeof target.closest !== "function") {
        return false;
      }

      return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
    };

    const shouldIgnoreGameShortcut = (event) => isTypingTarget(event.target) || hasBlockingModalOpen();

    const isMobileGameplayPointer = (event) => Boolean(event)
      && (event.pointerType === "touch" || event.pointerType === "pen" || hasCoarsePointer());

    const isGameViewActive = () => elements.gameView.classList.contains("is-active");

    const queueMobileJump = (event) => {
      if (!gameScene || !isGameViewActive() || shouldIgnoreGameShortcut(event) || !isMobileGameplayPointer(event)) {
        return;
      }

      event.preventDefault();
      gameScene.queueJump();
    };

    const queueMobileRestart = (event) => {
      if (!gameScene || !isGameViewActive() || shouldIgnoreGameShortcut(event) || !isMobileGameplayPointer(event)) {
        return;
      }

      event.preventDefault();
      gameScene.queueRestart();
    };

    const setClearLevelStep = (step) => {
      const finalStep = step === 2;
      elements.clearLevelCard.dataset.clearStep = finalStep ? "2" : "1";
      elements.clearLevelStepLabel.textContent = finalStep ? "Confirmation 2 / 2" : "Confirmation 1 / 2";
      elements.clearLevelMessage.textContent = finalStep
        ? "Last check: this cannot be undone from the editor. Click the red button to empty the level."
        : "Your level layout will be emptied. The project settings and level name will stay.";
      elements.advanceClearLevelButton.hidden = finalStep;
      elements.confirmClearLevelButton.hidden = !finalStep;
    };

    const openClearLevelModal = () => {
      setClearLevelStep(1);
      openModal(elements.clearLevelModal);
    };

    const closeClearLevelModal = () => {
      closeModal(elements.clearLevelModal);
      setClearLevelStep(1);
    };

    const clearLevelAfterDoubleConfirmation = () => {
      if (!levelEditor) {
        return;
      }

      levelEditor.clearLevel();
      closeClearLevelModal();
      resetValidation("Level cleared. Add a finish line, then run a clear check.");
      updateGamePreview(false);
      autoSaveWorkspace("Level cleared");
      setWorkspaceMessage("Level cleared");
    };

    const ensureGame = () => {
      const levelData = syncCurrentLevelFromEditor();
      if (game || !window.Phaser) {
        applyGamePerformanceProfile();
        return;
      }

      const performanceProfile = applyGamePerformanceProfile();

      gameScene = new window.TechnoDash.GameScene();
      gameScene.setPerformanceProfile(performanceProfile.scene);
      gameScene.setCallbacks({ onStats: updateGameStats });
      gameScene.setProgramState(makerProgramState);
      gameScene.loadLevel(levelData, { play: false });
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "game-container",
        width: performanceProfile.renderViewport.width,
        height: performanceProfile.renderViewport.height,
        backgroundColor: levelData.settings.backgroundColor || "#071322",
        scene: [gameScene],
        fps: {
          target: 60,
          min: 30,
          smoothStep: true
        },
        render: {
          antialias: false,
          pixelArt: true,
          roundPixels: true,
          powerPreference: "high-performance"
        },
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

      const levelData = syncCurrentLevelFromEditor();
      gameScene.setProgramState(makerProgramState);
      gameScene.loadLevel(levelData, { play: Boolean(keepPlaying && gameScene.isPlaying()) });
    };

    const updateGameChrome = (mode, levelLabel = currentLevelName) => {
      gameRunMode = mode;
      const titlePrefix = mode === "validation"
        ? "Clear check"
        : mode === "community"
          ? "Community run"
        : mode === "play"
          ? "Playing"
          : "Level test";
      elements.gameTitle.textContent = `${titlePrefix}: ${levelLabel}`;
      elements.playButton.textContent = mode === "validation" ? "Retry" : "Play";
      if (mode === "community") {
        elements.loadedLevelLabel.textContent = "Community level";
        return;
      }

      updateLevelNameDisplay();
    };

    const returnToEditor = () => {
      validationSuccessDismissed = true;
      if (gameScene) {
        gameScene.stop();
      }
      closeAllModals();
      hideValidationSuccessFeedback();

      if (gameRunMode === "community") {
        showHome();
        return;
      }

      if (validationActive && !validationPassed) {
        validationActive = false;
        validationCheckRequested = false;
        setValidationState("idle", "Clear check stopped. Run it again before publishing.");
      }

      activateMode("create");
      saveLastView("editor");
      setWorkspaceMessage("Back to editor");
    };

    const startTest = async () => {
      const levelData = syncCurrentLevelFromEditor();
      activateMode("test");
      updateGameChrome("test");
      hideValidationSuccessFeedback();
      setWorkspaceMessage("Testing level");
      await preloadLevelAssets(levelData);
      ensureGame();

      const loadTestRun = () => {
        if (!gameScene) {
          return;
        }
        gameScene.setProgramState(makerProgramState);
        gameScene.loadLevel(levelData, { play: true });
      };

      if (gameScene && gameScene.created) {
        loadTestRun();
      } else {
        window.setTimeout(loadTestRun, 80);
      }
    };

    const startValidation = async () => {
      const levelData = syncCurrentLevelFromEditor();
      const hasFinish = levelHasFinish(levelData);
      activateMode("validation");
      validationSuccessDismissed = false;
      hideValidationSuccessFeedback();
      if (elements.shareValidationRunButton) {
        elements.shareValidationRunButton.hidden = true;
      }
      validationActive = hasFinish;
      validationCheckRequested = hasFinish;
      validationPassed = false;
      validatedLevelData = null;
      updateValidationBadge();
      updateGameChrome("validation");
      setActiveView("game");
      closeModal(elements.validationModal);
      if (hasFinish) {
        setValidationState("running", "Play the full level. Publishing unlocks when the cube reaches the finish.");
        setWorkspaceMessage("Clear check running");
      } else {
        validationCheckRequested = false;
        if (elements.validationStatusBadge) {
          elements.validationStatusBadge.textContent = "Status: Finish missing";
        }
        setValidationState("failed", "Add a finish line before publishing.");
        setWorkspaceMessage("Testing level. Finish line missing for validation.");
      }
      await preloadLevelAssets(levelData);
      ensureGame();

      const loadValidationRun = () => {
        if (!gameScene) {
          return;
        }
        gameScene.setProgramState(makerProgramState);
        gameScene.loadLevel(levelData, { play: true });
      };

      if (gameScene && gameScene.created) {
        loadValidationRun();
      } else {
        window.setTimeout(loadValidationRun, 80);
      }
    };

    const restartCurrentRun = () => {
      hideValidationSuccessFeedback();
      closeCommunityClearModal();

      if (gameRunMode === "validation") {
        startValidation();
        return;
      }

      if (gameRunMode === "community") {
        if (activeCommunityLevel) {
          startCommunityLevel(activeCommunityLevel);
        }
        return;
      }

      if (gameRunMode === "test") {
        startTest();
        return;
      }

      if (gameScene) {
        gameScene.reset(true);
      }
    };

    const downloadLevelFile = (levelData, messagePrefix = "Saved file") => {
      const levelName = sanitizeLevelName(currentLevelName);
      const payload = {
        type: "technodash-level",
        version: 2,
        name: levelName,
        exportedAt: new Date().toISOString(),
        level: window.TechnoDash.Level.normalize(levelData)
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      const fileName = `${slugifyLevelName(levelName)}.json`;
      const downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      link.remove();
      loadedFileName = fileName;
      updateLevelNameDisplay();
      autoSaveWorkspace(`${messagePrefix}: ${fileName}`);
    };

    const saveCurrentLevelToComputer = () => {
      const levelData = levelEditor ? levelEditor.getLevelData() : currentLevelData;
      downloadLevelFile(levelData, "Saved file");
    };

    const parseLevelFile = (raw, file) => {
      const fileName = file && file.name ? file.name : "level.json";
      const fileNameWithoutExtension = sanitizeLevelName(fileName);

      try {
        const payload = JSON.parse(raw);
        if (payload && payload.type && payload.type !== "technodash-level") {
          throw new Error("This JSON is not a Dash Maker level");
        }

        const source = payload && payload.level ? payload.level : payload;
        if (!source || typeof source !== "object" || !Array.isArray(source.obstacles)) {
          throw new Error("Invalid level format");
        }

        return {
          level: window.TechnoDash.Level.normalize(source),
          name: sanitizeLevelName(payload && (payload.name || payload.levelName) ? (payload.name || payload.levelName) : fileNameWithoutExtension),
          fileName
        };
      } catch (error) {
        console.warn("Unreadable level", error);
        return null;
      }
    };

    const loadLevelFromFile = (file) => {
      if (!file) {
        return;
      }

      if (!file.name.toLowerCase().endsWith(".json")) {
        setWorkspaceMessage("Choose a .json Dash Maker level");
        return;
      }

      setWorkspaceMessage(`Reading file: ${file.name}`);
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const loaded = parseLevelFile(String(reader.result || ""), file);
        if (!loaded) {
          setWorkspaceMessage(`File rejected: ${file.name}`);
          return;
        }

        loadedFileName = loaded.fileName;
        currentLevelName = loaded.name;
        levelEditor.setLevelData(loaded.level);
        resetValidation("Loaded level. Run a clear check before publishing.");
        updateLevelNameDisplay();
        updatePropertyOutputs();
        updateGamePreview(false);
        closeAllModals();
        activateMode("create");
        autoSaveWorkspace(`Loaded file: ${loaded.fileName}. Current level replaced.`);
      });
      reader.addEventListener("error", () => {
        setWorkspaceMessage(`Could not read: ${file.name}`);
      });
      reader.readAsText(file);
    };

    const resetProject = () => {
      localStorage.removeItem(autosaveKey);
      localStorage.removeItem(legacyAutosaveKey);
      loadedFileName = "";
      currentLevelName = defaultLevelName;
      currentLevelData = window.TechnoDash.Level.getDefaultData();
      validationActive = false;
      validationCheckRequested = false;
      validationPassed = false;
      validatedLevelData = null;
      levelEditor.setLevelData(currentLevelData);
      updateLevelNameDisplay();
      updatePropertyOutputs();
      updateValidationBadge();
      setValidationState("idle", "Project reset. Add a finish line, then run a clear check.");
      updateGamePreview(false);
      activateMode("create");
      setWorkspaceMessage("Project reset");
      autoSaveWorkspace("Autosaved locally");
    };

    const syncZoom = () => {
      elements.zoomLabel.textContent = `${Math.round(zoomRatio * 100)}%`;
      if (levelEditor && typeof levelEditor.setZoom === "function") {
        levelEditor.setZoom(zoomRatio);
      }
    };

    levelEditor = new window.TechnoDash.LevelEditor({
      levelData: currentLevelData,
      onLevelChange: (levelData) => {
        currentLevelData = window.TechnoDash.Level.normalize(levelData);
        updatePropertyOutputs();
        if (!isRestoringWorkspace) {
          resetValidation("The level changed. Run a new clear check.");
          updateGamePreview(true);
          autoSaveWorkspace("Autosaved locally");
        }
      },
      onRequestClearLevel: openClearLevelModal
    });

    currentLevelData = levelEditor.getLevelData();
    isRestoringWorkspace = false;

    updateLevelNameDisplay();
    updatePropertyOutputs();
    updateValidationBadge();
    setValidationState(
      validationPassed ? "passed" : "idle",
      validationPassed ? "Clear check complete. You can publish the level." : "Finish the level once before publishing."
    );
    setWorkspaceMessage(savedWorkspace ? "Workspace restored" : "Autosaved locally");
    activateMode("create");

    elements.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeCommunityLevel = null;
        if (button.dataset.mode === "test") {
          startTest();
          return;
        }
        if (button.dataset.mode === "validation") {
          startValidation();
          return;
        }
        activateMode(button.dataset.mode);
      });
    });

    elements.levelNameInput.addEventListener("input", () => {
      resetValidation("The level name changed. Run a new clear check before publishing.");
      setLevelName(elements.levelNameInput.value);
    });

    elements.themeSelect.addEventListener("change", () => {
      elements.backgroundColorInput.value = elements.themeSelect.value;
      elements.backgroundColorInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    elements.saveProjectButton.addEventListener("click", () => {
      saveCurrentLevelToComputer();
    });

    elements.homeButton.addEventListener("click", showHome);
    elements.brandHomeButton.addEventListener("click", showHome);
    elements.communityBrandHomeButton.addEventListener("click", showHome);
    elements.openEditorButton.addEventListener("click", openEditor);
    elements.refreshCommunityButton.addEventListener("click", refreshCommunityLevels);
    elements.communityRestartButton.addEventListener("click", restartCurrentRun);
    elements.communityHomeButton.addEventListener("click", showHome);
    elements.communityEditorButton.addEventListener("click", openEditor);
    elements.closeCommunityClearButton.addEventListener("click", closeCommunityClearModal);
    elements.communityClearRetryButton.addEventListener("click", restartCurrentRun);
    elements.communityClearHomeButton.addEventListener("click", showHome);
    elements.communityClearRatingStars.addEventListener("click", async (event) => {
      const ratingButton = event.target.closest("[data-community-clear-rating]");
      if (!ratingButton || !activeCommunityLevel) {
        return;
      }

      await rateCommunityLevel(activeCommunityLevel.id, ratingButton.dataset.communityClearRating);
      renderCommunityClearRating();
    });
    const handleCommunityLevelCardClick = (event) => {
      const playButton = event.target.closest("[data-play-community-level]");
      if (playButton) {
        const level = getCommunityLevel(playButton.dataset.playCommunityLevel);
        if (level) {
          startCommunityLevel(level);
        }
        return;
      }

      const ratingButton = event.target.closest("[data-rating]");
      if (ratingButton) {
        rateCommunityLevel(ratingButton.dataset.levelId, ratingButton.dataset.rating);
      }
    };
    if (elements.communityFeaturedList) {
      elements.communityFeaturedList.addEventListener("click", handleCommunityLevelCardClick);
    }
    elements.communityLevelList.addEventListener("click", handleCommunityLevelCardClick);
    elements.communitySortButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const sortKey = button.dataset.communitySort;
        if (!communitySorts[sortKey] || communitySortKey === sortKey) {
          return;
        }

        communitySortKey = sortKey;
        renderCommunityLevels();
      });
    });
    window.addEventListener("resize", () => {
      if (document.body.classList.contains("is-community-home") && communityLevels.length) {
        renderCommunityLevels();
      }
    });

    elements.loadLevelButton.addEventListener("click", () => {
      elements.levelFileInput.value = "";
    });
    elements.loadLevelButton.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      elements.levelFileInput.value = "";
      elements.levelFileInput.click();
    });
    elements.levelFileInput.addEventListener("change", () => {
      const selectedFile = elements.levelFileInput.files && elements.levelFileInput.files[0]
        ? elements.levelFileInput.files[0]
        : null;
      loadLevelFromFile(selectedFile);
      elements.levelFileInput.value = "";
    });

    elements.toolbarPlayButton.addEventListener("click", startTest);
    elements.toolbarPauseButton.addEventListener("click", () => {
      if (gameScene) {
        gameScene.stop();
      }
    });
    elements.toolbarStopButton.addEventListener("click", () => {
      if (gameScene) {
        gameScene.reset(false);
      }
    });
    elements.toolbarResetViewButton.addEventListener("click", () => {
      elements.levelScroll.scrollLeft = 0;
    });

    elements.playButton.addEventListener("click", () => {
      if (gameRunMode === "validation") {
        startValidation();
        return;
      }
      if (gameRunMode === "community" && activeCommunityLevel) {
        startCommunityLevel(activeCommunityLevel);
        return;
      }
      startTest();
    });
    elements.stopButton.addEventListener("click", () => {
      if (gameScene) {
        gameScene.stop();
      }
    });
    elements.resetButton.addEventListener("click", () => {
      restartCurrentRun();
    });
    elements.exitGameButton.addEventListener("click", returnToEditor);
    if (elements.mobileJumpButton) {
      elements.mobileJumpButton.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        queueMobileJump(event);
      });
    }
    if (elements.mobileRestartButton) {
      elements.mobileRestartButton.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        queueMobileRestart(event);
      });
    }
    if (elements.gameFrame) {
      elements.gameFrame.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".mobile-control-button")) {
          return;
        }
        queueMobileJump(event);
      });
    }

    elements.validateLevelButton.addEventListener("click", startValidation);
    elements.startValidationButton.addEventListener("click", startValidation);
    elements.retryValidationButton.addEventListener("click", startValidation);
    elements.shareValidationRunButton.addEventListener("click", openPublishModal);
    elements.resetProjectButton.addEventListener("click", resetProject);

    elements.zoomOutButton.addEventListener("click", () => {
      zoomRatio = Math.max(0.75, zoomRatio - 0.25);
      syncZoom();
    });
    elements.zoomInButton.addEventListener("click", () => {
      zoomRatio = Math.min(1.75, zoomRatio + 0.25);
      syncZoom();
    });
    elements.paletteTabs.forEach((button) => {
      button.addEventListener("click", () => {
        const layer = button.dataset.paletteTab;
        if (levelEditor && ["gameplay", "decor", "background"].includes(layer)) {
          levelEditor.setActiveLayer(layer);
          return;
        }

        setPaletteTab(layer);
      });
    });
    elements.panelToggles.forEach((button) => {
      button.addEventListener("click", () => togglePanel(button));
    });
    elements.openPropertiesButton.addEventListener("click", () => {
      updatePropertyOutputs();
      openModal(elements.propertiesModal);
    });
    if (elements.backgroundPaletteButton) {
      elements.backgroundPaletteButton.addEventListener("click", () => {
        updatePropertyOutputs();
        openModal(elements.propertiesModal);
      });
    }
    elements.closePropertiesButton.addEventListener("click", () => closeModal(elements.propertiesModal));
    elements.closePublishModalButton.addEventListener("click", () => closeModal(elements.publishModal));
    elements.cancelPublishButton.addEventListener("click", () => closeModal(elements.publishModal));
    elements.confirmPublishButton.addEventListener("click", publishValidatedLevel);
    bindValidationSuccessActions();
    elements.closeValidationModalButton.addEventListener("click", () => closeModal(elements.validationModal));
    elements.openClearLevelButton.addEventListener("click", openClearLevelModal);
    elements.closeClearLevelButton.addEventListener("click", closeClearLevelModal);
    elements.cancelClearLevelButton.addEventListener("click", closeClearLevelModal);
    elements.advanceClearLevelButton.addEventListener("click", () => setClearLevelStep(2));
    elements.confirmClearLevelButton.addEventListener("click", clearLevelAfterDoubleConfirmation);
    if (elements.openSelectionButton) {
      elements.openSelectionButton.addEventListener("click", () => openModal(elements.selectionModal));
    }
    elements.closeSelectionButton.addEventListener("click", () => closeModal(elements.selectionModal));
    elements.statsButton.addEventListener("click", openStats);
    elements.closeStatsButton.addEventListener("click", closeStats);
    [
      elements.propertiesModal,
      elements.publishModal,
      elements.validationModal,
      elements.clearLevelModal,
      elements.selectionModal,
      elements.statsModal,
      elements.communityClearModal
    ].forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal(modal);
        }
      });
    });
    window.addEventListener("keydown", (event) => {
      const isEnter = event.code === "Enter"
        || event.code === "NumpadEnter"
        || event.key === "Enter"
        || event.key === "Return";
      const isRestartLetter = event.code === "KeyR" || event.key === "r" || event.key === "R";
      const isEndedSpaceRestart = (event.code === "Space" || event.key === " ") && gameScene && gameScene.ended;
      const isRestartIntent = isEnter || isRestartLetter || isEndedSpaceRestart;
      const canRestartCurrentRun = gameScene
        && elements.gameView.classList.contains("is-active")
        && ["test", "validation", "community"].includes(gameRunMode)
        && !shouldIgnoreGameShortcut(event)
        && isRestartIntent;
      if (canRestartCurrentRun) {
        event.preventDefault();
        event.stopImmediatePropagation();
        restartCurrentRun();
        return;
      }

      if (event.key === "Escape") {
        if (elements.communityClearModal && !elements.communityClearModal.hidden) {
          event.preventDefault();
          closeCommunityClearModal();
          return;
        }

        if (elements.gameView.classList.contains("is-active")) {
          event.preventDefault();
          returnToEditor();
          return;
        }
        closeAllModals();
      }
    }, true);

    syncZoom();
    if (savedInitialView === "editor" && !isMobileEditorLocked()) {
      openEditor();
    } else {
      showHome();
    }
  });
})();
