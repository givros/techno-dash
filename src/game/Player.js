(() => {
  window.TechnoDash = window.TechnoDash || {};

  class Player {
    constructor(scene, x, groundY, ceilingY = 0) {
      this.scene = scene;
      this.x = x;
      this.size = window.TechnoDash.Level.getPlayerSize();
      this.groundY = groundY;
      this.ceilingY = ceilingY;
      this.gravityDirection = 1;
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
      this.gravityDirection = 1;
      this.y = this.groundY - this.size / 2;
      this.velocityY = 0;
      this.grounded = true;
      this.settings = settings;
      this.sprite.setVisible(true);
      this.sprite.setAlpha(1);
      this.sprite.setScale(1, 1);
      this.sprite.setAngle(0);
      this.sprite.setFillStyle(0x31c48d, 1);
      this.syncSprite();
    }

    tryJump(jumpForce, options = {}) {
      if (!this.grounded && !options.allowAirborne) {
        return false;
      }

      this.velocityY = -jumpForce * this.gravityDirection;
      this.grounded = false;
      return true;
    }

    update(deltaSeconds, settings, options = {}) {
      if (options.applyGravity !== false) {
        this.velocityY += settings.gravity * this.gravityDirection * deltaSeconds;
      }

      this.y += this.velocityY * deltaSeconds;

      const bottom = this.y + this.size / 2;
      const top = this.y - this.size / 2;
      if (this.gravityDirection === 1 && bottom >= this.groundY) {
        this.y = this.groundY - this.size / 2;
        this.velocityY = 0;
        this.grounded = true;
      } else if (this.gravityDirection === -1 && top <= this.ceilingY) {
        this.y = this.ceilingY + this.size / 2;
        this.velocityY = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }

      this.syncSprite();
    }

    landOn(surfaceY, gravityDirection = this.gravityDirection) {
      this.y = gravityDirection === -1
        ? surfaceY + this.size / 2
        : surfaceY - this.size / 2;
      this.velocityY = 0;
      this.grounded = true;
      this.syncSprite();
    }

    setGravityDirection(direction) {
      const nextDirection = direction === -1 ? -1 : 1;
      if (this.gravityDirection === nextDirection) {
        return false;
      }

      this.gravityDirection = nextDirection;
      this.velocityY = 0;
      this.grounded = false;
      this.syncSprite();
      return true;
    }

    flipGravity() {
      return this.setGravityDirection(this.gravityDirection === 1 ? -1 : 1);
    }

    syncSprite() {
      this.sprite.setPosition(this.x, this.y);
      this.sprite.setRotation(this.gravityDirection === -1 ? Math.PI : 0);
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
