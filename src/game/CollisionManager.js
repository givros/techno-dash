(() => {
  window.TechnoDash = window.TechnoDash || {};

  class CollisionManager {
    static findObstacleCollision(playerBounds, screenObjects) {
      return screenObjects.find((object) => {
        if (
          object.type === "finish"
          || window.TechnoDash.Level.isModifierType(object.type)
          || CollisionManager.isSafeLandingSurface(object)
          || (object.type === "laser" && object.isActive === false)
          || object.isDisabled
        ) {
          return false;
        }

        if (object.type === "block") {
          return CollisionManager.playerHitsBlockDangerFace(playerBounds, object);
        }

        if (object.type === "triangle" || object.type === "animatedSpike") {
          if (!CollisionManager.rectsOverlap(playerBounds, object)) {
            return false;
          }

          return CollisionManager.playerHitsTriangle(playerBounds, object);
        }

        return CollisionManager.rectsOverlap(playerBounds, object);
      }) || null;
    }

    static findFinishCollision(playerBounds, screenObjects) {
      return screenObjects.find((object) => (
        object.type === "finish"
        && CollisionManager.rectsOverlap(playerBounds, CollisionManager.getFinishLineBounds(object))
      )) || null;
    }

    static getFinishLineBounds(object) {
      return {
        left: object.left,
        right: object.right,
        top: 0,
        bottom: Number.isFinite(object.groundY) ? object.groundY : object.bottom
      };
    }

    static findGravitySwitchCollision(playerBounds, screenObjects) {
      return screenObjects.find((object) => object.type === "gravitySwitch" && CollisionManager.rectsOverlap(playerBounds, object)) || null;
    }

    static findOverlappingObjects(playerBounds, screenObjects, types) {
      const typeSet = new Set(Array.isArray(types) ? types : [types]);
      return screenObjects.filter((object) => (
        typeSet.has(object.type)
        && !object.isDisabled
        && CollisionManager.rectsOverlap(playerBounds, object)
      ));
    }

    static findPlatformLanding(playerBounds, previousBounds, screenObjects, velocityY, gravityDirection = 1) {
      if (velocityY * gravityDirection < 0) {
        return null;
      }

      let landing = null;
      screenObjects.forEach((object) => {
        if (!CollisionManager.isLandingSurface(object)) {
          return;
        }

        if (playerBounds.right <= object.left + 4 || playerBounds.left >= object.right - 4) {
          return;
        }

        if (gravityDirection === -1) {
          if (previousBounds.top < object.bottom - 8 || playerBounds.top > object.bottom) {
            return;
          }

          if (!landing || object.bottom > landing.bottom) {
            landing = object;
          }
        } else {
          if (previousBounds.bottom > object.top + 8 || playerBounds.bottom < object.top) {
            return;
          }

          if (!landing || object.top < landing.top) {
            landing = object;
          }
        }
      });

      return landing;
    }

    static findSolidBlockSideCollision(playerBounds, screenObjects, gravityDirection = 1) {
      let solidBlock = null;
      screenObjects.forEach((object) => {
        if (!CollisionManager.isSolidBlock(object)) {
          return;
        }

        if (!CollisionManager.rectsOverlap(playerBounds, object)) {
          return;
        }

        if (gravityDirection === -1 && playerBounds.top >= object.bottom - 8) {
          return;
        }

        if (gravityDirection !== -1 && playerBounds.bottom <= object.top + 8) {
          return;
        }

        if (playerBounds.left >= object.left || playerBounds.right <= object.left) {
          return;
        }

        if (!solidBlock || object.left < solidBlock.left) {
          solidBlock = object;
        }
      });

      return solidBlock;
    }

    static isSafeLandingSurface(object) {
      return window.TechnoDash.Level.isPlatformType(object.type) || CollisionManager.isSolidBlock(object);
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
      const rotation = window.TechnoDash.Level.normalizeRotation(block.rotation, block.type);
      const faceSize = Math.min(12, Math.max(8, (rotation === 90 || rotation === 270 ? block.height : block.width) * 0.24));
      if (rotation === 90) {
        return CollisionManager.rectsOverlap(playerBounds, {
          left: block.left + 6,
          right: block.right - 6,
          top: block.top - 1,
          bottom: block.top + faceSize
        });
      }

      if (rotation === 180) {
        return CollisionManager.rectsOverlap(playerBounds, {
          left: block.right - faceSize,
          right: block.right + 1,
          top: block.top + 6,
          bottom: block.bottom - 6
        });
      }

      if (rotation === 270) {
        return CollisionManager.rectsOverlap(playerBounds, {
          left: block.left + 6,
          right: block.right - 6,
          top: block.bottom - faceSize,
          bottom: block.bottom + 1
        });
      }

      return CollisionManager.rectsOverlap(playerBounds, {
        left: block.left - 1,
        right: block.left + faceSize,
        top: block.top + 6,
        bottom: block.bottom - 6
      });
    }

    static playerHitsTriangle(playerBounds, triangle) {
      const probePoints = [
        { x: playerBounds.left, y: playerBounds.top },
        { x: playerBounds.right, y: playerBounds.top },
        { x: playerBounds.left, y: playerBounds.bottom },
        { x: playerBounds.right, y: playerBounds.bottom },
        { x: (playerBounds.left + playerBounds.right) / 2, y: playerBounds.bottom },
        { x: (playerBounds.left + playerBounds.right) / 2, y: playerBounds.top },
        { x: (playerBounds.left + playerBounds.right) / 2, y: (playerBounds.top + playerBounds.bottom) / 2 }
      ];

      return probePoints.some((point) => CollisionManager.pointInTriangle(point, CollisionManager.getTrianglePoints(triangle)));
    }

    static getTrianglePoints(triangle) {
      const middleX = (triangle.left + triangle.right) / 2;
      const middleY = (triangle.top + triangle.bottom) / 2;
      const rotation = window.TechnoDash.Level.normalizeRotation(triangle.rotation, "triangle");

      if (rotation === 90) {
        return {
          a: { x: triangle.left, y: triangle.top },
          b: { x: triangle.right, y: middleY },
          c: { x: triangle.left, y: triangle.bottom }
        };
      }

      if (rotation === 180) {
        return {
          a: { x: triangle.left, y: triangle.top },
          b: { x: triangle.right, y: triangle.top },
          c: { x: middleX, y: triangle.bottom }
        };
      }

      if (rotation === 270) {
        return {
          a: { x: triangle.right, y: triangle.top },
          b: { x: triangle.right, y: triangle.bottom },
          c: { x: triangle.left, y: middleY }
        };
      }

      return {
        a: { x: triangle.left, y: triangle.bottom },
        b: { x: middleX, y: triangle.top },
        c: { x: triangle.right, y: triangle.bottom }
      };
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
