class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.projectiles = [];
    this.targets = [];
    this.shakeTime = 0;
    this.shakeIntensity = 0;
  }

  addShake(intensity = 6, duration = 0.18) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  updateShake(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeIntensity = 0;
    }
  }

  spawnParticles(x, y, count, options = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (options.baseAngle ?? -Math.PI / 2) + (Math.random() - 0.5) * (options.spread ?? Math.PI * 2);
      const speed = (options.minSpeed ?? 1) + Math.random() * ((options.maxSpeed ?? 5) - (options.minSpeed ?? 1));
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (options.minSize ?? 2) + Math.random() * ((options.maxSize ?? 6) - (options.minSize ?? 2)),
        alpha: 1,
        decay: (options.decay ?? 0.025) + Math.random() * 0.02,
        color: options.color ?? '#fb923c',
        additive: options.additive ?? false,
        gravity: options.gravity ?? 0.08
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawBackground(width, height, cameraX, cameraY, mode) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#070b14');
    grad.addColorStop(0.55, '#0f1b2e');
    grad.addColorStop(1, '#182842');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Mặt trăng / đĩa sáng khí quyển
    ctx.save();
    ctx.fillStyle = 'rgba(125, 211, 252, 0.07)';
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.2, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Lưới blueprint trong chế độ lắp ráp
    if (mode === 'build') {
      const step = GRID_SIZE;
      const offsetX = ((-cameraX % step) + step) % step;
      const offsetY = ((-cameraY % step) + step) % step;

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      for (let x = offsetX; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = offsetY; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawTerrain(terrainSegments, width, height, cameraX, cameraY) {
    if (!terrainSegments.length) return;
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    ctx.beginPath();
    const first = terrainSegments[0];
    const last = terrainSegments[terrainSegments.length - 1];
    ctx.moveTo(first.x, height + cameraY + 400);
    for (const pt of terrainSegments) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(last.x, height + cameraY + 400);
    ctx.closePath();

    const groundGrad = ctx.createLinearGradient(0, 320, 0, 900);
    groundGrad.addColorStop(0, '#1e293b');
    groundGrad.addColorStop(0.25, '#131c2e');
    groundGrad.addColorStop(1, '#080c14');
    ctx.fillStyle = groundGrad;
    ctx.fill();

    // Viền cỏ / lớp vỏ địa hình phát sáng nhẹ
    ctx.beginPath();
    for (let i = 0; i < terrainSegments.length; i++) {
      const pt = terrainSegments[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.restore();
  }

  drawBuildGrid(buildCenterX, buildCenterY, gridRadius, cells, hoverCell, selectedPartId, rotationStep, eraserMode) {
    const ctx = this.ctx;
    ctx.save();

    for (let gx = -gridRadius; gx <= gridRadius; gx++) {
      for (let gy = -gridRadius; gy <= gridRadius; gy++) {
        const px = buildCenterX + gx * GRID_SIZE;
        const py = buildCenterY + gy * GRID_SIZE;
        const isCenter = gx === 0 && gy === 0;

        ctx.strokeStyle = isCenter
          ? 'rgba(56, 189, 248, 0.55)'
          : 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = isCenter ? 2 : 1;
        ctx.strokeRect(px - GRID_SIZE / 2 + 2, py - GRID_SIZE / 2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);

        if (isCenter) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.fillRect(px - GRID_SIZE / 2 + 3, py - GRID_SIZE / 2 + 3, GRID_SIZE - 6, GRID_SIZE - 6);
        }
      }
    }

    // Vẽ các khối đã đặt
    for (const cell of cells.values()) {
      const px = buildCenterX + cell.gx * GRID_SIZE;
      const py = buildCenterY + cell.gy * GRID_SIZE;
      this.drawPartVisual(ctx, cell.typeId, px, py, cell.rotation * (Math.PI / 2), 1, false);
    }

    // Preview ô đang trỏ chuột / chạm
    if (hoverCell && Math.abs(hoverCell.gx) <= gridRadius && Math.abs(hoverCell.gy) <= gridRadius) {
      const px = buildCenterX + hoverCell.gx * GRID_SIZE;
      const py = buildCenterY + hoverCell.gy * GRID_SIZE;

      if (eraserMode) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px - GRID_SIZE / 2 + 2, py - GRID_SIZE / 2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
      } else {
        this.drawPartVisual(ctx, selectedPartId, px, py, rotationStep * (Math.PI / 2), 0.55, false);
      }
    }

    ctx.restore();
  }

  drawPartVisual(ctx, typeId, x, y, angle, alpha = 1, isBoosting = false, aimAngle = null) {
    const part = PARTS_CATALOG[typeId];
    if (!part) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);

    const half = GRID_SIZE * 0.46;

    if (typeId === 'chassis') {
      ctx.fillStyle = part.color;
      ctx.strokeStyle = part.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-half, -half, half * 2, half * 2, 6);
      ctx.fill();
      ctx.stroke();

      // Thanh giằng chéo đặc trưng khung xe
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.beginPath();
      ctx.moveTo(-half + 5, -half + 5);
      ctx.lineTo(half - 5, half - 5);
      ctx.stroke();
    } else if (typeId === 'armor') {
      ctx.fillStyle = part.color;
      ctx.strokeStyle = part.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-half - 1, -half - 1, (half + 1) * 2, (half + 1) * 2, 5);
      ctx.fill();
      ctx.stroke();

      // Đinh tán giáp quân sự
      ctx.fillStyle = '#cbd5e1';
      const rOffset = half - 6;
      for (const rx of [-rOffset, rOffset]) {
        for (const ry of [-rOffset, rOffset]) {
          ctx.beginPath();
          ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (typeId === 'wheel') {
      const r = part.radius;
      // Lò xo treo trên
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Lốp cao su
      ctx.fillStyle = part.color;
      ctx.strokeStyle = part.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Vành & nan bánh xe quay theo góc
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
        ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        ctx.stroke();
      }
    } else if (typeId === 'thruster') {
      // Thân động cơ phản lực (hướng đẩy mặc định sang phải +X theo góc xoay)
      ctx.fillStyle = part.color;
      ctx.strokeStyle = part.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-half, -half * 0.75, half * 1.7, half * 1.5, 6);
      ctx.fill();
      ctx.stroke();

      // Loa phụt bên phải
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(half * 0.7, -half * 0.55);
      ctx.lineTo(half * 1.15, -half * 0.85);
      ctx.lineTo(half * 1.15, half * 0.85);
      ctx.lineTo(half * 0.7, half * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (isBoosting) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const flameLen = 28 + Math.random() * 22;
        const flameGrad = ctx.createLinearGradient(half * 1.15, 0, half * 1.15 + flameLen, 0);
        flameGrad.addColorStop(0, '#fff7ed');
        flameGrad.addColorStop(0.35, '#fb923c');
        flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(half * 1.15, -half * 0.65);
        ctx.lineTo(half * 1.15 + flameLen, 0);
        ctx.lineTo(half * 1.15, half * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (typeId === 'cannon') {
      // Đế tháp pháo
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = part.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Nòng pháo xoay
      ctx.save();
      if (typeof aimAngle === 'number') {
        ctx.rotate(aimAngle - angle);
      }
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, -5, 32, 10);
      ctx.strokeRect(0, -5, 32, 10);
      ctx.restore();
    }

    ctx.restore();
  }

  drawVehicle(vehicleData, cameraX, cameraY, isBoosting, aimWorldPos) {
    if (!vehicleData) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // Vẽ các thanh giằng khung xe
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 2;
    for (const c of vehicleData.constraints) {
      if (c.bodyA && c.bodyB) {
        ctx.beginPath();
        ctx.moveTo(c.bodyA.position.x, c.bodyA.position.y);
        ctx.lineTo(c.bodyB.position.x, c.bodyB.position.y);
        ctx.stroke();
      }
    }

    // Vẽ từng bộ phận vật lý
    for (const partObj of vehicleData.parts) {
      const { body, typeId, baseRotation } = partObj;
      let aimAngle = null;
      if (typeId === 'cannon' && aimWorldPos) {
        aimAngle = Math.atan2(aimWorldPos.y - body.position.y, aimWorldPos.x - body.position.x);
      }
      this.drawPartVisual(
        ctx,
        typeId,
        body.position.x,
        body.position.y,
        body.angle + baseRotation,
        1,
        typeId === 'thruster' && isBoosting,
        aimAngle
      );
    }

    ctx.restore();
  }

  drawTargets(targets, cameraX, cameraY) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    for (const t of targets) {
      if (t.destroyed) continue;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = '#991b1b';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-t.w / 2, -t.h / 2, t.w, t.h, 6);
      ctx.fill();
      ctx.stroke();

      // Vạch bia tập bắn
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-t.w / 2 + 6, -4, t.w - 12, 8);
      ctx.restore();
    }

    ctx.restore();
  }

  drawProjectiles(projectiles, cameraX, cameraY) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-cameraX, -cameraY);
    ctx.globalCompositeOperation = 'lighter';

    for (const b of projectiles) {
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawParticles(cameraX, cameraY) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.additive) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
