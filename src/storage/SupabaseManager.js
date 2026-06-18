(() => {
  window.TechnoDash = window.TechnoDash || {};

  class SupabaseManager {
    constructor(options = {}) {
      this.restUrl = String(options.restUrl || "").replace(/\/+$/, "");
      this.apiKey = String(options.apiKey || "");
      this.tableName = options.tableName || "community_levels";
      this.voteTableName = Object.prototype.hasOwnProperty.call(options, "voteTableName")
        ? options.voteTableName
        : "community_level_votes";
      this.useVoteTable = options.useVoteTable !== false && Boolean(this.voteTableName);
    }

    get enabled() {
      return Boolean(this.restUrl && this.apiKey);
    }

    async listLevels() {
      return this.request(
        `${this.tableName}?select=id,name,level_data,plays,deaths,successes,rating_total,rating_count,created_at&order=created_at.desc`
      );
    }

    async publishLevel({ name, levelData }) {
      const rows = await this.request(this.tableName, {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: {
          name,
          level_data: window.TechnoDash.Level.normalize(levelData),
          plays: 0,
          deaths: 0,
          successes: 0,
          rating_total: 0,
          rating_count: 0
        }
      });

      return Array.isArray(rows) ? rows[0] : rows;
    }

    async incrementCounter(levelId, fieldName) {
      if (!["plays", "deaths", "successes"].includes(fieldName)) {
        throw new Error("Unknown counter");
      }

      const level = await this.getLevel(levelId, `${fieldName}`);
      const nextValue = Number(level && level[fieldName] ? level[fieldName] : 0) + 1;
      return this.patchLevel(levelId, { [fieldName]: nextValue });
    }

    async rateLevel(levelId, stars, voterId) {
      const safeStars = Math.min(5, Math.max(1, Math.round(Number(stars) || 0)));
      const safeVoterId = String(voterId || "").trim();
      if (!safeVoterId) {
        throw new Error("Missing voter id");
      }

      if (!this.useVoteTable) {
        return this.rateLevelWithoutVoteTable(levelId, safeStars);
      }

      await this.request(this.voteTableName, {
        method: "POST",
        headers: {
          Prefer: "return=minimal"
        },
        body: {
          level_id: levelId,
          voter_id: safeVoterId,
          stars: safeStars
        }
      }).catch((error) => {
        if (this.isMissingVoteTableError(error)) {
          return this.rateLevelWithoutVoteTable(levelId, safeStars);
        }

        throw error;
      });

      return this.getLevel(levelId, "rating_total,rating_count");
    }

    async rateLevelWithoutVoteTable(levelId, stars) {
      const level = await this.getLevel(levelId, "rating_total,rating_count");
      if (!level) {
        throw new Error("Level not found");
      }

      const ratingTotal = Number(level.rating_total || 0);
      const ratingCount = Number(level.rating_count || 0);
      return this.patchLevel(levelId, {
        rating_total: ratingTotal + stars,
        rating_count: ratingCount + 1
      });
    }

    isMissingVoteTableError(error) {
      const message = String(error && error.message ? error.message : error);
      return /PGRST205|Could not find the table|schema cache/i.test(message);
    }

    async getLevel(levelId, select = "*") {
      const rows = await this.request(
        `${this.tableName}?select=${encodeURIComponent(select)}&id=eq.${encodeURIComponent(levelId)}&limit=1`
      );
      return Array.isArray(rows) ? rows[0] : null;
    }

    async patchLevel(levelId, patch) {
      const rows = await this.request(`${this.tableName}?id=eq.${encodeURIComponent(levelId)}`, {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: patch
      });
      return Array.isArray(rows) ? rows[0] : rows;
    }

    async request(path, options = {}) {
      if (!this.enabled) {
        throw new Error("Supabase is not configured");
      }

      const response = await fetch(`${this.restUrl}/${path}`, {
        method: options.method || "GET",
        headers: {
          apikey: this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Supabase request failed (${response.status})`);
      }

      if (response.status === 204) {
        return null;
      }

      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : null;
    }
  }

  window.TechnoDash.SupabaseManager = SupabaseManager;
})();
