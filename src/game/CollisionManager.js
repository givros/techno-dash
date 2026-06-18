(() => {
  window.TechnoDash = window.TechnoDash || {};

  class CollisionManager {
    static findObstacleCollision(playerBounds, screenObjects) {
      return screenObjects.find((object) => {
        if (object.type === "finish" || CollisionManager.isSafeLandingSurface(object)) {
          return false;
        }

        if (object.type === "block") {
          return CollisionManager.playerHitsBlockDangerFace(playerBounds, object);
        }

        if (object.type === "triangle") {
          if (!CollisionManager.rectsOverlap(playerBounds, object)) {
            return false;
          }

          return CollisionManager.playerHitsTriangle(playerBounds, object);
        }

        return CollisionManager.rectsOverlap(playerBounds, object);
      }) || null;
    }

    static findFinishCollision(playerBounds, screenObjects) {
      return screenObjects.find((object) => object.type === "finish" && CollisionManager.rectsOverlap(playerBounds, object)) || null;
    }

    static findPlatformLanding(playerBounds, previousBounds, screenObjects, velocityY) {
      if (velocityY < 0) {
        return null;
      }

      return screenObjects
        .filter((object) => CollisionManager.isLandingSurface(object))
        .filter((object) => playerBounds.right > object.left + 4 && playerBounds.left < object.right - 4)
        .filter((object) => previousBounds.bottom <= object.top + 8 && playerBounds.bottom >= object.top)
        .sort((a, b) => a.top - b.top)[0] || null;
    }

    static findSolidBlockSideCollision(playerBounds, screenObjects) {
      return screenObjects
        .filter((object) => CollisionManager.isSolidBlock(object))
        .filter((object) => CollisionManager.rectsOverlap(playerBounds, object))
        .filter((object) => playerBounds.bottom > object.top + 8)
        .filter((object) => playerBounds.left < object.left && playerBounds.right > object.left)
        .sort((a, b) => a.left - b.left)[0] || null;
    }

    static isSafeLandingSurface(object) {
      return object.type === "platform" || CollisionManager.isSolidBlock(object);
    }

    static isSolidBlock(object) {
      return window.TechnoDash.Level.isSolidBlockType(object.type);
    }

    static isLandingSurface(object) {
      return CollisionManager.isSafeLandingSurface(object) || object.type === "block";
    }

    static rectsOverlap(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    static playerHitsBlockDangerFace(playerBounds, block) {
      const faceWidth = Math.min(12, Math.max(8, block.width * 0.24));
      return CollisionManager.rectsOverlap(playerBounds, {
        left: block.left - 1,
        right: block.left + faceWidth,
        top: block.top + 6,
        bottom: block.bottom - 6
      });
    }

    static playerHitsTriangle(playerBounds, triangle) {
      const probePoints = [
        { x: playerBounds.left, y: playerBounds.bottom },
        { x: playerBounds.right, y: playerBounds.bottom },
        { x: (playerBounds.left + playerBounds.right) / 2, y: playerBounds.bottom },
        { x: (playerBounds.left + playerBounds.right) / 2, y: (playerBounds.top + playerBounds.bottom) / 2 }
      ];

      return probePoints.some((point) => CollisionManager.pointInTriangle(point, {
        a: { x: triangle.left, y: triangle.bottom },
        b: { x: (triangle.left + triangle.right) / 2, y: triangle.top },
        c: { x: triangle.right, y: triangle.bottom }
      }));
    }

    static pointInTriangle(point, triangle) {
      const area = CollisionManager.sign(triangle.a, triangle.b, triangle.c);
      const s = CollisionManager.sign(point, triangle.a, triangle.b);
      const t = CollisionManager.sign(point, triangle.b, triangle.c);
      const u = CollisionManager.sign(point, triangle.c, triangle.a);
      const hasNegative = s < 0 || t < 0 || u < 0;
      const hasPositive = s > 0 || t > 0 || u > 0;
      return area < 0 ? !(hasNegative && hasPositive) : !(hasNegative && hasPositive);
    }

    static sign(p1, p2, p3) {
      return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    }
  }

  window.TechnoDash.CollisionManager = CollisionManager;
})();
