(() => {
  window.TechnoDash = window.TechnoDash || {};

  class StorageManager {
    constructor(key = "technodash-level") {
      this.key = key;
    }

    saveLevel(levelData) {
      const payload = {
        savedAt: new Date().toISOString(),
        level: window.TechnoDash.Level.normalize(levelData)
      };
      localStorage.setItem(this.key, JSON.stringify(payload));
      return payload;
    }

    loadLevel() {
      const raw = localStorage.getItem(this.key);
      if (!raw) {
        return null;
      }

      try {
        const payload = JSON.parse(raw);
        return window.TechnoDash.Level.normalize(payload.level || payload);
      } catch (error) {
        console.warn("Sauvegarde illisible", error);
        return null;
      }
    }
  }

  window.TechnoDash.StorageManager = StorageManager;
})();
