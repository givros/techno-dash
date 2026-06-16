(() => {
  window.TechnoDash = window.TechnoDash || {};

  class PseudoCodeGenerator {
    generate(programState, settings) {
      const blocks = Array.isArray(programState.activeBlockIds)
        ? programState.activeBlockIds.filter((id) => id !== "start")
        : [];
      const blockSections = programState && programState.blockSections && typeof programState.blockSections === "object"
        ? programState.blockSections
        : {};
      const lines = [];
      const speed = settings && settings.speed ? settings.speed : 280;
      const gravity = settings && settings.gravity ? settings.gravity : 1350;
      const jumpForce = settings && settings.jumpForce ? settings.jumpForce : 560;

      const initBlocks = blocks.filter((id) => this.getSection(id, blockSections) === "initialization");
      const gameplayBlocks = blocks.filter((id) => this.getSection(id, blockSections) === "gameplay");

      lines.push("INITIALISATION DU JEU");
      lines.push("    QUAND le jeu commence");
      const startSeen = true;
      initBlocks.forEach((id) => {
        this.getBlockLines(id, { speed, gravity, jumpForce }).forEach((line) => {
          lines.push(`${startSeen ? "        " : "    "}${line}`);
        });
      });

      lines.push("");
      lines.push("GAMEPLAY");
      let loopSeen = false;
      for (let index = 0; index < gameplayBlocks.length; index += 1) {
        const id = gameplayBlocks[index];
        if (id === "loop") {
          lines.push("    RÉPÉTER en boucle");
          loopSeen = true;
          continue;
        }

        const indent = loopSeen ? "        " : "    ";
        if (this.isConditionBlock(id)) {
          const conditionIds = [];
          while (this.isConditionBlock(gameplayBlocks[index])) {
            conditionIds.push(gameplayBlocks[index]);
            index += 1;
          }

          const condition = conditionIds.map((conditionId) => this.getConditionLabel(conditionId)).join(" ET ");
          lines.push(`${indent}SI ${condition} ALORS`);
          while (this.isCompatibleAction(conditionIds, gameplayBlocks[index])) {
            this.getGameplayLines(gameplayBlocks[index]).forEach((line) => {
              lines.push(`${indent}    ${line}`);
            });
            index += 1;
          }
          lines.push(`${indent}FIN SI`);
          index -= 1;
          continue;
        }

        this.getBlockLines(id, { speed, gravity, jumpForce }).forEach((line) => {
          lines.push(`${indent}${line}`);
        });
      }

      if (loopSeen) {
        lines.push("    FIN RÉPÉTER");
      }

      return lines.join("\n");
    }

    getSection(blockId, blockSections = {}) {
      if (blockSections[blockId]) {
        return blockSections[blockId];
      }

      return this.isInitializationBlock(blockId) || blockId === "start" ? "initialization" : "gameplay";
    }

    isInitializationBlock(blockId) {
      return ["setSpeed", "setGravity", "setJumpForce", "addBackground", "addPlayer", "addGround", "addObstacles", "addDecorations", "addFinish"].includes(blockId);
    }

    getInitializationLine(blockId, settings) {
      const lines = {
        setSpeed: `définir vitesse = ${settings.speed}`,
        setGravity: `définir gravité = ${settings.gravity}`,
        setJumpForce: `définir force_saut = ${settings.jumpForce}`,
        addBackground: "ajouter le fond",
        addPlayer: "ajouter le joueur",
        addGround: "ajouter le sol",
        addObstacles: "ajouter les obstacles du niveau",
        addDecorations: "ajouter les décors du niveau",
        addFinish: "ajouter l'arrivée"
      };
      return lines[blockId] || "";
    }

    isConditionBlock(blockId) {
      return ["spacePressed", "playerGrounded", "hitObstacle", "reachFinish"].includes(blockId);
    }

    getConditionLabel(blockId) {
      const labels = {
        spacePressed: "touche Espace appuyée",
        playerGrounded: "joueur au sol",
        hitObstacle: "joueur touche un obstacle",
        reachFinish: "joueur atteint l'arrivée"
      };
      return labels[blockId] || "condition";
    }

    isCompatibleAction(conditionIds, blockId) {
      if (blockId === "jump") {
        return conditionIds.every((id) => ["spacePressed", "playerGrounded"].includes(id));
      }

      if (blockId === "showGameOver") {
        return conditionIds.includes("hitObstacle");
      }

      if (blockId === "showVictory") {
        return conditionIds.includes("reachFinish");
      }

      return false;
    }

    getGameplayLines(blockId) {
      const lines = {
        loop: ["RÉPÉTER en boucle", "FIN RÉPÉTER"],
        moveLevel: ["déplacer le niveau vers la gauche"],
        applyGravity: ["appliquer la gravité au cube"],
        jump: ["faire sauter le cube"],
        showGameOver: ["afficher Game Over", "arrêter la partie"],
        showVictory: ["afficher Victoire", "arrêter la partie"],
        showDistance: ["afficher la distance"],
        showScore: ["afficher le score"],
        restartGame: ["SI bouton Reset appuyé ALORS", "    redémarrer le jeu", "FIN SI"]
      };
      return lines[blockId] || [];
    }

    getBlockLines(blockId, settings) {
      if (blockId === "start") {
        return ["QUAND le jeu commence"];
      }

      const initLine = this.getInitializationLine(blockId, settings);
      if (initLine) {
        return [initLine];
      }

      if (this.isConditionBlock(blockId)) {
        return [`SI ${this.getConditionLabel(blockId)} ALORS`, "FIN SI"];
      }

      return this.getGameplayLines(blockId);
    }
  }

  window.TechnoDash.PseudoCodeGenerator = PseudoCodeGenerator;
})();
