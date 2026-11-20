class VehiclePhysics {
  constructor(renderer) {
    this.renderer = renderer;
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this.engine.gravity.y = 1.05;

    this.terrainBodies = [];
    this.terrainPoints = [];
    this.vehicle = null;
    this.projectiles = [];
    this.targets = [];
    this.lastFireTime = 0;

    this.generateTerrain();
    this.spawnTargets();
  }

  generateTerrain() {
    for (const b of this.terrainBodies) {
      Matter.Composite.remove(this.world, b);
    }
    this.terrainBodies = [];
    this.terrainPoints = [];

    const startX = -600;
    const endX = 9500;
    const step = 90;

    for (let x = startX; x <= endX; x += step) {
      let y = 520;
      if (x > 250) {
        const d = x - 250;
        y =
          520 -
          Math.sin(d * 0.0022) * 145 -
          Math.cos(d * 0.0055) * 65 +
          Math.sin(d * 0.0011) * 70;
      }
      this.terrainPoints.push({ x, y });
    }

    for (let i = 0; i < this.terrainPoints.length - 1; i++) {
      const p1 = this.terrainPoints[i];
      const p2 = this.terrainPoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const segment = Matter.Bodies.rectangle(midX, midY + 26, len + 8, 52, {
        isStatic: true,
        angle,
        friction: 0.95,
        restitution: 0.1
      });
      this.terrainBodies.push(segment);
      Matter.Composite.add(this.world, segment);
    }
  }

  spawnTargets() {
    this.targets = [];
    const positions = [950, 1450, 2100, 2850, 3600, 4450, 5300];
    positions.forEach((x, idx) => {
      const groundY = this.getGroundYAt(x);
      this.targets.push({
        id: idx,
        x,
        y: groundY - 26,
        w: 38,
        h: 52,
        hp: 40,
        destroyed: false
      });
    });
  }

  getGroundYAt(x) {
    for (let i = 0; i < this.terrainPoints.length - 1; i++) {
      const a = this.terrainPoints[i];
      const b = this.terrainPoints[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = (x - a.x) / (b.x - a.x);
        return a.y + (b.y - a.y) * t;
      }
    }
    return 500;
  }

  clearVehicle() {
    if (!this.vehicle) return;
    for (const p of this.vehicle.parts) {
      Matter.Composite.remove(this.world, p.body);
    }
    for (const c of this.vehicle.constraints) {
      Matter.Composite.remove(this.world, c);
    }
    this.vehicle = null;
  }

  spawnVehicleFromCells(cellsMap, spawnX = 120, spawnY = 340) {
    this.clearVehicle();
    if (!cellsMap.size) return null;

    const parts = [];
    const constraints = [];
    const bodyByKey = new Map();

    for (const [key, cell] of cellsMap.entries()) {
      const def = PARTS_CATALOG[cell.typeId];
      if (!def) continue;

      const worldX = spawnX + cell.gx * GRID_SIZE;
      const worldY = spawnY + cell.gy * GRID_SIZE;
      const isWheel = cell.typeId === 'wheel';

      const body = isWheel
        ? Matter.Bodies.circle(worldX, worldY, def.radius, {
            density: 0.0022 * def.mass,
            friction: 0.95,
            frictionStatic: 1.0,
            restitution: 0.15
          })
        : Matter.Bodies.rectangle(worldX, worldY, GRID_SIZE - 2, GRID_SIZE - 2, {
            density: 0.002 * def.mass,
            friction: 0.6,
            restitution: 0.1
          });

      Matter.Composite.add(this.world, body);
      bodyByKey.set(key, body);
      parts.push({
        key,
        gx: cell.gx,
        gy: cell.gy,
        typeId: cell.typeId,
        baseRotation: cell.rotation * (Math.PI / 2),
        body
      });
    }

    // Nối các khối liền kề bằng khớp nối cứng
    for (const p of parts) {
      const neighbors = [
        [p.gx + 1, p.gy],
        [p.gx, p.gy + 1]
      ];
      for (const [nx, ny] of neighbors) {
        const nKey = `${nx},${ny}`;
        const bodyA = p.body;
        const bodyB = bodyByKey.get(nKey);
        if (bodyB) {
          const constraint = Matter.Constraint.create({
            bodyA,
            bodyB,
            stiffness: 0.92,
            damping: 0.15,
            length: GRID_SIZE
          });
          constraints.push(constraint);
          Matter.Composite.add(this.world, constraint);
        }
      }
    }

    this.vehicle = { parts, constraints };
    return this.vehicle;
  }

  fireCannons(aimWorldPos) {
    if (!this.vehicle) return;
    const now = performance.now();
    if (now - this.lastFireTime < 260) return;
    this.lastFireTime = now;

    let firedAny = false;
    for (const partObj of this.vehicle.parts) {
      if (partObj.typeId !== 'cannon') continue;
      const { body } = partObj;
      const angle = Math.atan2(aimWorldPos.y - body.position.y, aimWorldPos.x - body.position.x);
      const muzzleX = body.position.x + Math.cos(angle) * 34;
      const muzzleY = body.position.y + Math.sin(angle) * 34;

      const speed = 16;
      this.projectiles.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 110
      });

      // Độ giật nòng pháo đẩy xe lùi nhẹ
      Matter.Body.applyForce(body, body.position, {
        x: -Math.cos(angle) * PARTS_CATALOG.cannon.recoil,
        y: -Math.sin(angle) * PARTS_CATALOG.cannon.recoil
      });

      this.renderer.spawnParticles(muzzleX, muzzleY, 12, {
        baseAngle: angle,
        spread: 0.7,
        minSpeed: 2,
        maxSpeed: 7,
        color: '#fde047',
        additive: true,
        gravity: 0
      });
      firedAny = true;
    }

    if (firedAny) {
      this.renderer.addShake(7, 0.15);
    }
  }

  step(dt, controls, aimWorldPos) {
    if (this.vehicle) {
      const { left, right, boost } = controls;

      for (const partObj of this.vehicle.parts) {
        const { body, typeId, baseRotation } = partObj;
        const def = PARTS_CATALOG[typeId];

        if (typeId === 'wheel') {
          let spin = 0;
          if (right) spin += def.motorTorque;
          if (left) spin -= def.motorTorque;
          if (spin !== 0) {
            body.angularVelocity += spin;
          }
        } else if (typeId === 'thruster' && boost) {
          const thrustAngle = body.angle + baseRotation;
          const fx = Math.cos(thrustAngle) * def.thrust;
          const fy = Math.sin(thrustAngle) * def.thrust;
          Matter.Body.applyForce(body, body.position, { x: fx, y: fy });

          if (Math.random() < 0.7) {
            this.renderer.spawnParticles(
              body.position.x - Math.cos(thrustAngle) * 20,
              body.position.y - Math.sin(thrustAngle) * 20,
              2,
              {
                baseAngle: thrustAngle + Math.PI,
                spread: 0.55,
                minSpeed: 2,
                maxSpeed: 6,
                color: '#fb923c',
                additive: true,
                gravity: -0.02
              }
            );
          }
        } else if ((left || right) && typeId !== 'wheel') {
          // Hỗ trợ nghiêng đầu/đuôi nhẹ khi trên không hoặc leo dốc
          const tiltForce = (right ? 1 : -1) * 0.0018;
          Matter.Body.applyForce(body, body.position, { x: 0, y: tiltForce });
        }
      }
    }

    Matter.Engine.update(this.engine, Math.min(dt * 1000, 33.33));

    // Cập nhật đạn pháo & va chạm bia
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.18;
      b.life--;

      let hit = false;
      const groundY = this.getGroundYAt(b.x);
      if (b.y >= groundY) {
        hit = true;
      }

      for (const t of this.targets) {
        if (t.destroyed) continue;
        if (
          Math.abs(b.x - t.x) <= t.w / 2 + 8 &&
          Math.abs(b.y - t.y) <= t.h / 2 + 8
        ) {
          t.destroyed = true;
          hit = true;
          this.renderer.spawnParticles(t.x, t.y, 26, {
            minSpeed: 2,
            maxSpeed: 9,
            minSize: 3,
            maxSize: 8,
            color: '#f97316',
            additive: true
          });
          this.renderer.addShake(11, 0.25);
          break;
        }
      }

      if (hit) {
        this.renderer.spawnParticles(b.x, b.y, 16, {
          minSpeed: 1.5,
          maxSpeed: 6.5,
          color: '#fbbf24',
          additive: true
        });
        this.projectiles.splice(i, 1);
      } else if (b.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  getLeadBodyPosition() {
    if (!this.vehicle || !this.vehicle.parts.length) return { x: 120, y: 340 };
    let sumX = 0;
    let sumY = 0;
    for (const p of this.vehicle.parts) {
      sumX += p.body.position.x;
      sumY += p.body.position.y;
    }
    return {
      x: sumX / this.vehicle.parts.length,
      y: sumY / this.vehicle.parts.length
    };
  }
}
