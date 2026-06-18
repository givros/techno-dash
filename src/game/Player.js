(() => {
  window.TechnoDash = window.TechnoDash || {};

  class Player {
    constructor(scene, x, groundY) {
      this.scene = scene;
      this.x = x;
      this.size = window.TechnoDash.Level.getPlayerSize();
      this.groundY = groundY;
      this.y = groundY - this.size / 2;
      this.velocityY = 0;
      this.grounded = true;
      this.sprite = this.scene.add.rectangle(this.x, this.y, this.size, this.size, 0x31c48d);
      this.sprite.setSize(this.size, this.size);
      this.sprite.setDisplaySize(this.size, this.size);
      this.sprite.setStrokeStyle(3, 0xffffff, 0.95);
      this.sprite.setDepth(10);
    }

    reset(settings) {
      this.y = this.groundY - this.size / 2;
      this.velocityY = 0;
      this.grounded = true;
      this.settings = settings;
      this.syncSprite();
    }

    tryJump(jumpForce) {
      if (!this.grounded) {
        return false;
      }

      this.velocityY = -jumpForce;
      this.grounded = false;
      return true;
    }

    update(deltaSeconds, settings, options = {}) {
      if (options.applyGravity !== false) {
        this.velocityY += settings.gravity * deltaSeconds;
      }

      this.y += this.velocityY * deltaSeconds;

      const bottom = this.y + this.size / 2;
      if (bottom >= this.groundY) {
        this.y = this.groundY - this.size / 2;
        this.velocityY = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }

      this.syncSprite();
    }

    landOn(surfaceY) {
      this.y = surfaceY - this.size / 2;
      this.velocityY = 0;
      this.grounded = true;
      this.syncSprite();
    }

    syncSprite() {
      this.sprite.setPosition(this.x, this.y);
    }

    getBounds() {
      return {
        left: this.x - this.size / 2,
        right: this.x + this.size / 2,
        top: this.y - this.size / 2,
        bottom: this.y + this.size / 2
      };
    }
  }

  window.TechnoDash.Player = Player;
})();
