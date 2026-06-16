(() => {
  window.TechnoDash = window.TechnoDash || {};

  class BlockEditor {
    constructor(options = {}) {
      this.onProgramChange = options.onProgramChange || function noop() {};
      this.onMessage = options.onMessage || function noop() {};
      this.settings = options.settings || {};
      this.activeCategory = "Événements";
      this.programBlockIds = [];
      this.blocks = this.createBlocks();
      this.categoryTabs = document.getElementById("category-tabs");
      this.blockLibrary = document.getElementById("block-library");
      this.programArea = document.getElementById("program-area");
      this.hint = document.getElementById("block-hint");
      this.draggedBlockIndex = null;
      this.pointerDrag = null;
      this.handlePointerMove = (event) => this.movePointerDrag(event);
      this.handlePointerUp = (event) => this.finishPointerDrag(event);
      this.blockSectionOverrides = {};
      this.bindEvents();
      this.render();
      this.emitChange();
    }

    createBlocks() {
      return [
        { id: "restartGame", category: "Événements", label: "Redémarrer le jeu" },
        { id: "addBackground", category: "Objets", label: "Ajouter le fond" },
        { id: "addPlayer", category: "Objets", label: "Ajouter le joueur" },
        { id: "addGround", category: "Objets", label: "Ajouter le sol" },
        { id: "addObstacles", category: "Objets", label: "Ajouter les obstacles" },
        { id: "addDecorations", category: "Objets", label: "Ajouter les décors" },
        { id: "addFinish", category: "Objets", label: "Ajouter l'arrivée" },
        { id: "moveLevel", category: "Mouvement", label: "Déplacer le niveau vers la gauche" },
        { id: "setSpeed", category: "Mouvement", label: "Définir la vitesse" },
        { id: "jump", category: "Saut", label: "Faire sauter le cube" },
        { id: "setJumpForce", category: "Saut", label: "Définir la force de saut" },
        { id: "applyGravity", category: "Physique", label: "Appliquer la gravité" },
        { id: "setGravity", category: "Physique", label: "Définir la gravité" },
        { id: "hitObstacle", category: "Collision", label: "Si le joueur touche un obstacle" },
        { id: "reachFinish", category: "Collision", label: "Si le joueur atteint l'arrivée" },
        { id: "spacePressed", category: "Boucle de jeu", label: "Si la touche Espace est appuyée" },
        { id: "playerGrounded", category: "Boucle de jeu", label: "Si le joueur est au sol" },
        { id: "loop", category: "Boucle de jeu", label: "Répéter en boucle" },
        { id: "showGameOver", category: "Interface", label: "Afficher Game Over" },
        { id: "showVictory", category: "Interface", label: "Afficher Victoire" },
        { id: "showDistance", category: "Interface", label: "Afficher la distance" },
        { id: "showScore", category: "Interface", label: "Afficher le score" }
      ];
    }

    bindEvents() {
    }

    render() {
      this.renderTabs();
      this.renderLibrary();
      this.renderProgram();
    }

    renderTabs() {
      const categories = [...new Set(this.blocks.map((block) => block.category))];
      this.categoryTabs.innerHTML = "";

      categories.forEach((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = category;
        button.className = category === this.activeCategory ? "is-active" : "";
        button.addEventListener("click", () => {
          this.activeCategory = category;
          this.renderTabs();
          this.renderLibrary();
        });
        this.categoryTabs.appendChild(button);
      });
    }

    renderLibrary() {
      this.blockLibrary.innerHTML = "";
      this.blocks
        .filter((block) => block.category === this.activeCategory)
        .forEach((block) => this.blockLibrary.appendChild(this.createLibraryBlock(block)));
    }

    createLibraryBlock(block) {
      const active = this.hasBlock(block.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `block-card${active ? " is-placed" : ""}`;
      button.dataset.category = block.category;
      button.dataset.blockId = block.id;
      button.innerHTML = `<span>${this.getBlockLabel(block)}</span><small>${active ? "placé" : "ajouter"}</small>`;
      button.addEventListener("click", () => this.handleBlockClick(block));
      return button;
    }

    renderProgram() {
      this.programArea.innerHTML = "";

      const flow = document.createElement("div");
      flow.className = "program-flow";
      const indexedBlocks = this.programBlockIds.map((id, index) => ({ id, index }));
      const initBlocks = indexedBlocks.filter((item) => this.getProgramSection(item.id) === "initialization");
      const gameplayBlocks = indexedBlocks.filter((item) => this.getProgramSection(item.id) === "gameplay");

      flow.appendChild(this.createProgramSection("Initialisation du jeu", initBlocks));
      flow.appendChild(this.createProgramSection("Gameplay", gameplayBlocks));
      this.programArea.appendChild(flow);
      this.renderLibrary();
    }

    createProgramSection(title, blocks) {
      const section = document.createElement("section");
      section.className = "program-section";
      section.dataset.section = title === "Gameplay" ? "gameplay" : "initialization";
      section.addEventListener("dragover", (event) => this.dragOverSection(event, section.dataset.section));
      section.addEventListener("drop", (event) => this.dropBlockInSection(event, section.dataset.section));

      const heading = document.createElement("div");
      heading.className = "program-section-heading";
      const fixedCount = section.dataset.section === "initialization" ? 1 : 0;
      const totalBlocks = blocks.length + fixedCount;
      heading.innerHTML = `<h3>${title}</h3><span>${totalBlocks} bloc${totalBlocks > 1 ? "s" : ""}</span>`;
      section.appendChild(heading);

      const stack = document.createElement("div");
      stack.className = "program-section-stack";
      stack.dataset.section = section.dataset.section;
      stack.addEventListener("dragover", (event) => this.dragOverSection(event, section.dataset.section));
      stack.addEventListener("drop", (event) => this.dropBlockInSection(event, section.dataset.section));
      if (section.dataset.section === "initialization") {
        stack.appendChild(this.createDefaultStartBlock());
      }

      if (blocks.length === 0 && section.dataset.section !== "initialization") {
        const empty = document.createElement("div");
        empty.className = "empty-program-section";
        empty.textContent = title === "Gameplay" ? "Aucun bloc de gameplay" : "Aucun bloc d'initialisation";
        stack.appendChild(empty);
      } else {
        blocks.forEach((item) => {
          stack.appendChild(this.createProgramBlock(item.id, item.index));
        });
      }

      section.appendChild(stack);
      return section;
    }

    createDefaultStartBlock() {
      const element = document.createElement("div");
      element.className = "program-block is-fixed-start";
      element.dataset.category = "Événements";
      element.dataset.blockId = "start";

      const label = document.createElement("span");
      label.className = "program-block-label";
      label.textContent = "Quand le jeu commence";
      element.appendChild(label);

      const badge = document.createElement("small");
      badge.textContent = "intégré";
      element.appendChild(badge);
      return element;
    }

    createProgramBlock(blockId, index) {
      const block = this.blocks.find((item) => item.id === blockId);
      const element = document.createElement("div");
      element.className = `program-block ${this.getProgramDepthClass(blockId)}`;
      element.dataset.category = block.category;
      element.dataset.blockId = blockId;
      element.dataset.index = String(index);
      element.draggable = false;
      element.addEventListener("pointerdown", (event) => this.startPointerDraggingBlock(event, index));

      const label = document.createElement("span");
      label.className = "program-block-label";
      label.textContent = this.getBlockLabel(block);
      element.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "program-block-actions";

      const moveUp = document.createElement("button");
      moveUp.className = "move-program-block";
      moveUp.type = "button";
      moveUp.textContent = "▲";
      moveUp.disabled = !this.canMoveBlock(index, -1);
      moveUp.setAttribute("aria-label", `Monter ${block.label}`);
      moveUp.addEventListener("click", () => this.moveBlock(index, -1));
      actions.appendChild(moveUp);

      const moveDown = document.createElement("button");
      moveDown.className = "move-program-block";
      moveDown.type = "button";
      moveDown.textContent = "▼";
      moveDown.disabled = !this.canMoveBlock(index, 1);
      moveDown.setAttribute("aria-label", `Descendre ${block.label}`);
      moveDown.addEventListener("click", () => this.moveBlock(index, 1));
      actions.appendChild(moveDown);

      const remove = document.createElement("button");
      remove.className = "remove-program-block";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Retirer ${block.label}`);
      remove.addEventListener("click", () => this.removeBlock(index));
      actions.appendChild(remove);
      element.appendChild(actions);

      return element;
    }

    handleBlockClick(block) {
      if (this.hasBlock(block.id)) {
        this.setHint("Ce bloc est déjà dans le programme.");
        this.onMessage("Bloc déjà placé");
        return;
      }

      this.programBlockIds.push(block.id);
      this.renderProgram();
      this.emitChange();
      this.setHint(`Bloc ajouté : ${this.getBlockLabel(block)}.`);
      this.onMessage("Programme modifié");
    }

    removeBlock(index) {
      this.programBlockIds.splice(index, 1);
      this.renderProgram();
      this.emitChange();
      this.setHint("Bloc retiré.");
      this.onMessage(this.programBlockIds.length ? "Programme modifié" : "Programme de base");
    }

    moveBlock(index, direction) {
      const section = this.getProgramSection(this.programBlockIds[index]);
      const sectionIndexes = this.getSectionIndexes(section);
      const currentPosition = sectionIndexes.indexOf(index);
      const nextPosition = currentPosition + direction;

      if (nextPosition >= 0 && nextPosition < sectionIndexes.length) {
        this.moveBlockToSectionPosition(index, nextPosition, section);
        return;
      }

      if (direction < 0 && section === "gameplay") {
        this.moveBlockToSectionPosition(index, this.getSectionIndexes("initialization").length, "initialization");
        return;
      }

      if (direction > 0 && section === "initialization") {
        this.moveBlockToSectionPosition(index, 0, "gameplay");
      }
    }

    canMoveBlock(index, direction) {
      const section = this.getProgramSection(this.programBlockIds[index]);
      const sectionIndexes = this.getSectionIndexes(section);
      const currentPosition = sectionIndexes.indexOf(index);
      const nextPosition = currentPosition + direction;
      if (nextPosition >= 0 && nextPosition < sectionIndexes.length) {
        return true;
      }

      return (direction < 0 && section === "gameplay") || (direction > 0 && section === "initialization");
    }

    startDraggingBlock(event, index) {
      this.draggedBlockIndex = index;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      event.currentTarget.classList.add("is-dragging");
    }

    startPointerDraggingBlock(event, index) {
      if (event.button !== 0 || event.target.closest("button")) {
        return;
      }

      this.draggedBlockIndex = index;
      this.pointerDrag = {
        index,
        startX: event.clientX,
        startY: event.clientY,
        hasMoved: false
      };

      event.currentTarget.classList.add("is-dragging", "is-pointer-dragging");
      document.addEventListener("pointermove", this.handlePointerMove);
      document.addEventListener("pointerup", this.handlePointerUp);
      document.addEventListener("pointercancel", this.handlePointerUp);

      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
    }

    movePointerDrag(event) {
      if (!this.pointerDrag || this.draggedBlockIndex === null) {
        return;
      }

      const movedX = Math.abs(event.clientX - this.pointerDrag.startX);
      const movedY = Math.abs(event.clientY - this.pointerDrag.startY);
      if (!this.pointerDrag.hasMoved && movedX + movedY < 6) {
        return;
      }

      this.pointerDrag.hasMoved = true;
      this.clearDropTargets();
      const target = this.getPointerDropTarget(event.clientX, event.clientY);
      this.showPointerDropTarget(target);
      event.preventDefault();
    }

    finishPointerDrag(event) {
      if (!this.pointerDrag) {
        this.endPointerDraggingBlock();
        return;
      }

      const target = this.pointerDrag.hasMoved
        ? this.getPointerDropTarget(event.clientX, event.clientY)
        : null;

      if (target) {
        this.moveBlockToDropTarget(this.pointerDrag.index, target);
        event.preventDefault();
      }

      this.endPointerDraggingBlock();
    }

    endPointerDraggingBlock() {
      document.removeEventListener("pointermove", this.handlePointerMove);
      document.removeEventListener("pointerup", this.handlePointerUp);
      document.removeEventListener("pointercancel", this.handlePointerUp);
      this.pointerDrag = null;
      this.draggedBlockIndex = null;
      this.clearDropMarks();
    }

    getPointerDropTarget(clientX, clientY) {
      const element = document.elementFromPoint(clientX, clientY);
      if (!element || !this.programArea.contains(element)) {
        return null;
      }

      const section = element.closest(".program-section");
      if (!section) {
        return null;
      }

      const targetSection = section.dataset.section;
      const targetBlock = element.closest(".program-block");
      if (targetBlock && !targetBlock.classList.contains("is-fixed-start")) {
        const targetIndex = Number(targetBlock.dataset.index);
        if (Number.isNaN(targetIndex) || targetIndex === this.draggedBlockIndex) {
          return null;
        }

        const rect = targetBlock.getBoundingClientRect();
        return {
          type: "block",
          element: targetBlock,
          targetIndex,
          targetSection,
          dropAfter: clientY > rect.top + rect.height / 2
        };
      }

      return {
        type: "section",
        element: section,
        targetSection,
        targetPosition: targetBlock && targetBlock.classList.contains("is-fixed-start")
          ? 0
          : this.getSectionIndexes(targetSection).length
      };
    }

    showPointerDropTarget(target) {
      if (!target) {
        return;
      }

      if (target.type === "block") {
        target.element.classList.add(target.dropAfter ? "is-drop-after" : "is-drop-before");
        return;
      }

      target.element.classList.add("is-drop-section");
    }

    moveBlockToDropTarget(sourceIndex, target) {
      if (target.type === "block") {
        const sectionIndexes = this.getSectionIndexes(target.targetSection);
        const targetPosition = sectionIndexes.indexOf(target.targetIndex) + (target.dropAfter ? 1 : 0);
        this.moveBlockToSectionPosition(sourceIndex, targetPosition, target.targetSection);
        return;
      }

      this.moveBlockToSectionPosition(sourceIndex, target.targetPosition, target.targetSection);
    }

    dragOverBlock(event, targetIndex) {
      const sourceIndex = this.draggedBlockIndex;
      if (sourceIndex === null || sourceIndex === targetIndex) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const dropAfter = event.clientY > rect.top + rect.height / 2;
      this.clearDropTargets();
      event.currentTarget.classList.add(dropAfter ? "is-drop-after" : "is-drop-before");
    }

    dropBlock(event, targetIndex) {
      event.stopPropagation();
      const sourceIndex = this.draggedBlockIndex;
      if (sourceIndex === null || sourceIndex === targetIndex) {
        this.endDraggingBlock();
        return;
      }

      const sourceSection = this.getProgramSection(this.programBlockIds[sourceIndex]);
      const targetSection = this.getProgramSection(this.programBlockIds[targetIndex]);
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const dropAfter = event.clientY > rect.top + rect.height / 2;
      const sectionIndexes = this.getSectionIndexes(targetSection);
      const targetPosition = sectionIndexes.indexOf(targetIndex) + (dropAfter ? 1 : 0);
      this.moveBlockToSectionPosition(sourceIndex, targetPosition, targetSection);
      this.endDraggingBlock();
    }

    dragOverSection(event, targetSection) {
      if (this.draggedBlockIndex === null) {
        return;
      }

      event.preventDefault();
      this.clearDropTargets();
      const section = event.currentTarget.closest(".program-section");
      if (section) {
        section.classList.add("is-drop-section");
      }
    }

    dropBlockInSection(event, targetSection) {
      if (this.draggedBlockIndex === null) {
        return;
      }

      const targetBlock = event.target.closest(".program-block");
      if (targetBlock && !targetBlock.classList.contains("is-fixed-start")) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
      const targetPosition = targetBlock && targetBlock.classList.contains("is-fixed-start")
        ? 0
        : this.getSectionIndexes(targetSection).length;
      this.moveBlockToSectionPosition(this.draggedBlockIndex, targetPosition, targetSection);
      this.endDraggingBlock();
    }

    endDraggingBlock() {
      this.draggedBlockIndex = null;
      this.clearDropMarks();
    }

    clearDropMarks() {
      this.programArea.querySelectorAll(".is-dragging, .is-pointer-dragging, .is-drop-before, .is-drop-after, .is-drop-section").forEach((node) => {
        node.classList.remove("is-dragging", "is-pointer-dragging", "is-drop-before", "is-drop-after", "is-drop-section");
      });
    }

    clearDropTargets() {
      this.programArea.querySelectorAll(".is-drop-before, .is-drop-after, .is-drop-section").forEach((node) => {
        node.classList.remove("is-drop-before", "is-drop-after", "is-drop-section");
      });
    }

    moveBlockToSectionPosition(index, requestedPosition, targetSection) {
      const movingId = this.programBlockIds[index];
      const previousIds = this.programBlockIds.join("|");
      const previousSection = this.getProgramSection(movingId);
      const section = targetSection || previousSection;
      this.programBlockIds.splice(index, 1);
      this.setBlockSection(movingId, section);

      const targetIds = this.programBlockIds.filter((id) => this.getProgramSection(id) === section);
      const targetPosition = Math.max(0, Math.min(requestedPosition, targetIds.length));
      let insertionIndex = this.getEmptySectionInsertionIndex(section);

      if (targetIds.length > 0) {
        if (targetPosition <= 0) {
          insertionIndex = this.programBlockIds.indexOf(targetIds[0]);
        } else if (targetPosition >= targetIds.length) {
          insertionIndex = this.programBlockIds.indexOf(targetIds[targetIds.length - 1]) + 1;
        } else {
          insertionIndex = this.programBlockIds.indexOf(targetIds[targetPosition]);
        }
      }

      this.programBlockIds.splice(insertionIndex, 0, movingId);
      if (this.programBlockIds.join("|") === previousIds && previousSection === section) {
        return;
      }

      this.renderProgram();
      this.emitChange();
      this.setHint("Ordre du programme modifié.");
      this.onMessage("Programme modifié");
    }

    getEmptySectionInsertionIndex(section) {
      if (section === "initialization") {
        const firstGameplayIndex = this.programBlockIds.findIndex((id) => this.getProgramSection(id) === "gameplay");
        return firstGameplayIndex === -1 ? this.programBlockIds.length : firstGameplayIndex;
      }

      return this.programBlockIds.length;
    }

    getSectionIndexes(section) {
      return this.programBlockIds
        .map((id, index) => ({ id, index }))
        .filter((item) => this.getProgramSection(item.id) === section)
        .map((item) => item.index);
    }

    getProgramDepthClass(blockId) {
      if (this.isInitializationBlock(blockId)) {
        return "is-setup";
      }

      if (["spacePressed", "playerGrounded", "hitObstacle", "reachFinish"].includes(blockId)) {
        return "is-condition";
      }

      if (["jump", "showGameOver", "showVictory"].includes(blockId)) {
        return "is-condition-action";
      }

      if (this.hasBlock("loop") && blockId !== "start" && blockId !== "loop") {
        return "is-loop-child";
      }

      return "is-main";
    }

    getProgramSection(blockId) {
      if (this.blockSectionOverrides[blockId]) {
        return this.blockSectionOverrides[blockId];
      }

      return this.isInitializationBlock(blockId) || blockId === "start" ? "initialization" : "gameplay";
    }

    getDefaultProgramSection(blockId) {
      return this.isInitializationBlock(blockId) || blockId === "start" ? "initialization" : "gameplay";
    }

    setBlockSection(blockId, section) {
      if (section === this.getDefaultProgramSection(blockId)) {
        delete this.blockSectionOverrides[blockId];
        return;
      }

      this.blockSectionOverrides[blockId] = section;
    }

    isInitializationBlock(blockId) {
      return ["setSpeed", "setGravity", "setJumpForce", "addBackground", "addPlayer", "addGround", "addObstacles", "addDecorations", "addFinish"].includes(blockId);
    }

    hasBlock(blockId) {
      return this.programBlockIds.includes(blockId);
    }

    getBlockLabel(block) {
      if (block.id === "setSpeed") {
        return `Définir la vitesse à ${this.settings.speed || 280}`;
      }

      if (block.id === "setGravity") {
        return `Définir la gravité à ${this.settings.gravity || 1350}`;
      }

      if (block.id === "setJumpForce") {
        return `Définir la force de saut à ${this.settings.jumpForce || 560}`;
      }

      return block.label;
    }

    updateSettings(settings) {
      this.settings = settings || {};
      this.renderProgram();
      this.emitChange();
    }

    getProgramState() {
      return {
        activeBlockIds: [...this.programBlockIds],
        blockSections: { ...this.blockSectionOverrides },
        hasDefaultStart: true
      };
    }

    loadProgramState(programState) {
      const sourceIds = programState && Array.isArray(programState.activeBlockIds)
        ? programState.activeBlockIds
        : [];
      const allowedIds = new Set(this.blocks.map((block) => block.id));
      const nextIds = [];
      const nextSections = {};

      sourceIds.forEach((id) => {
        if (!allowedIds.has(id)) {
          return;
        }

        if (!nextIds.includes(id)) {
          nextIds.push(id);
        }
      });

      if (programState && programState.blockSections && typeof programState.blockSections === "object") {
        Object.entries(programState.blockSections).forEach(([id, section]) => {
          if (allowedIds.has(id) && nextIds.includes(id) && ["initialization", "gameplay"].includes(section)) {
            nextSections[id] = section;
          }
        });
      }

      this.programBlockIds = nextIds;
      this.blockSectionOverrides = nextSections;
      this.render();
      this.emitChange();
    }

    emitChange() {
      this.onProgramChange(this.getProgramState());
    }

    setHint(message) {
      this.hint.textContent = message;
    }
  }

  window.TechnoDash.BlockEditor = BlockEditor;
})();
