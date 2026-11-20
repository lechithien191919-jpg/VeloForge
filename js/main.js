const canvas = document.getElementById('game-canvas');
const renderer = new GameRenderer(canvas);
const physics = new VehiclePhysics(renderer);

const state = {
  mode: 'build', // 'build' | 'drive'
  selectedPart: 'chassis',
  rotationStep: 0,
  eraserMode: false,
  cells: new Map(),
  hoverCell: null,
  cameraX: 0,
  cameraY: 0,
  pointerScreen: { x: 0, y: 0 },
  controls: {
    left: false,
    right: false,
    boost: false,
    fire: false
  }
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Xe mẫu ban đầu để ông vào chạy thử ngay không cần lắp từ đầu
function loadStarterPreset() {
  state.cells.clear();
  const preset = [
    { gx: -1, gy: 0, typeId: 'chassis', rotation: 0 },
    { gx: 0, gy: 0, typeId: 'chassis', rotation: 0 },
    { gx: 1, gy: 0, typeId: 'armor', rotation: 0 },
    { gx: 0, gy: -1, typeId: 'cannon', rotation: 0 },
    { gx: -2, gy: 0, typeId: 'thruster', rotation: 0 },
    { gx: -1, gy: 1, typeId: 'wheel', rotation: 0 },
    { gx: 1, gy: 1, typeId: 'wheel', rotation: 0 }
  ];
  for (const item of preset) {
    state.cells.set(`${item.gx},${item.gy}`, item);
  }
  updateStats();
}

function updateStats() {
  let mass = 0;
  let thrust = 0;
  let cannons = 0;

  for (const cell of state.cells.values()) {
    const def = PARTS_CATALOG[cell.typeId];
    if (!def) continue;
    mass += def.mass;
    if (def.thrust) thrust += Math.round(def.thrust * 1000);
    if (cell.typeId === 'cannon') cannons++;
  }

  document.getElementById('stat-mass').textContent = mass.toFixed(1);
  document.getElementById('stat-thrust').textContent = thrust;
  document.getElementById('stat-cannons').textContent = cannons;
}

// Render danh sách linh kiện
const partsListEl = document.getElementById('parts-list');
function buildPartCards() {
  partsListEl.innerHTML = '';
  for (const id of PARTS_ORDER) {
    const def = PARTS_CATALOG[id];
    const card = document.createElement('div');
    card.className = 'part-card' + (state.selectedPart === id && !state.eraserMode ? ' selected' : '');
    card.innerHTML = `
      <div class="part-top">
        <span>${def.name}</span>
        <span class="part-swatch" style="background:${def.accent}"></span>
      </div>
      <div class="part-desc">${def.shortDesc}</div>
    `;
    card.addEventListener('click', () => {
      state.selectedPart = id;
      state.eraserMode = false;
      document.getElementById('btn-eraser').classList.remove('active');
      buildPartCards();
    });
    partsListEl.appendChild(card);
  }
}

function getBuildCenter() {
  return {
    x: canvas.width * 0.5,
    y: canvas.height * 0.44
  };
}

function screenToGrid(clientX, clientY) {
  const center = getBuildCenter();
  const gx = Math.round((clientX - center.x) / GRID_SIZE);
  const gy = Math.round((clientY - center.y) / GRID_SIZE);
  return { gx, gy };
}

function screenToWorld(clientX, clientY) {
  return {
    x: clientX + state.cameraX,
    y: clientY + state.cameraY
  };
}

function applyCellAction(gx, gy, removeOnly = false) {
  const radius = 4;
  if (Math.abs(gx) > radius || Math.abs(gy) > radius) return;
  const key = `${gx},${gy}`;

  if (removeOnly || state.eraserMode) {
    state.cells.delete(key);
  } else {
    state.cells.set(key, {
      gx,
      gy,
      typeId: state.selectedPart,
      rotation: state.rotationStep
    });
  }
  updateStats();
}

canvas.addEventListener('pointermove', (e) => {
  state.pointerScreen = { x: e.clientX, y: e.clientY };
  if (state.mode === 'build') {
    state.hoverCell = screenToGrid(e.clientX, e.clientY);
  }
});

canvas.addEventListener('pointerdown', (e) => {
  state.pointerScreen = { x: e.clientX, y: e.clientY };

  if (state.mode === 'build') {
    const cell = screenToGrid(e.clientX, e.clientY);
    if (e.button === 2) {
      state.rotationStep = (state.rotationStep + 1) % 4;
      return;
    }
    applyCellAction(cell.gx, cell.gy, e.shiftKey);
  } else if (state.mode === 'drive') {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    physics.fireCannons(worldPos);
    state.controls.fire = true;
  }
});

window.addEventListener('pointerup', () => {
  state.controls.fire = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Nút bấm giao diện
const btnToggleMode = document.getElementById('btn-toggle-mode');
const modeBadge = document.getElementById('mode-badge');
const buildDock = document.getElementById('build-dock');
const driveHud = document.getElementById('drive-hud');
const btnEraser = document.getElementById('btn-eraser');

function setMode(newMode) {
  state.mode = newMode;
  if (newMode === 'drive') {
    modeBadge.textContent = 'DRIVE MODE';
    modeBadge.classList.add('drive');
    btnToggleMode.textContent = '🛠 LẮP RÁP LẠI';
    btnToggleMode.classList.add('driving');
    buildDock.classList.add('hidden');
    driveHud.classList.remove('hidden');

    physics.spawnTargets();
    physics.spawnVehicleFromCells(state.cells, 120, 320);
  } else {
    modeBadge.textContent = 'BUILD MODE';
    modeBadge.classList.remove('drive');
    btnToggleMode.textContent = '▶ LÁI THỬ';
    btnToggleMode.classList.remove('driving');
    buildDock.classList.remove('hidden');
    driveHud.classList.add('hidden');

    physics.clearVehicle();
    state.cameraX = 0;
    state.cameraY = 0;
  }
}

btnToggleMode.addEventListener('click', () => {
  setMode(state.mode === 'build' ? 'drive' : 'build');
});

document.getElementById('btn-clear').addEventListener('click', () => {
  state.cells.clear();
  updateStats();
  if (state.mode === 'drive') physics.clearVehicle();
});

document.getElementById('btn-rotate').addEventListener('click', () => {
  state.rotationStep = (state.rotationStep + 1) % 4;
});

btnEraser.addEventListener('click', () => {
  state.eraserMode = !state.eraserMode;
  btnEraser.classList.toggle('active', state.eraserMode);
  buildPartCards();
});

// Nút điều khiển cảm ứng / chuột khi lái
function bindHoldButton(id, controlKey) {
  const el = document.getElementById(id);
  const start = (e) => {
    e.preventDefault();
    state.controls[controlKey] = true;
    el.classList.add('active');
  };
  const end = (e) => {
    e.preventDefault();
    state.controls[controlKey] = false;
    el.classList.remove('active');
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', end);
  el.addEventListener('pointercancel', end);
}

bindHoldButton('ctrl-left', 'left');
bindHoldButton('ctrl-right', 'right');
bindHoldButton('ctrl-boost', 'boost');
bindHoldButton('ctrl-fire', 'fire');

// Phím tắt bàn phím
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.controls.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') state.controls.right = true;
  if (e.code === 'Space') {
    if (state.mode === 'drive') {
      e.preventDefault();
      state.controls.boost = true;
    }
  }
  if (e.code === 'KeyF') state.controls.fire = true;
  if (e.code === 'KeyR' && state.mode === 'build') {
    state.rotationStep = (state.rotationStep + 1) % 4;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.controls.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') state.controls.right = false;
  if (e.code === 'Space') state.controls.boost = false;
  if (e.code === 'KeyF') state.controls.fire = false;
});

// Vòng lặp chính (Game Loop)
let lastTime = performance.now();
function gameLoop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  renderer.updateShake(dt);
  renderer.updateParticles();

  const aimWorld = screenToWorld(state.pointerScreen.x, state.pointerScreen.y);

  if (state.mode === 'drive') {
    if (state.controls.fire) {
      physics.fireCannons(aimWorld);
    }
    physics.step(dt, state.controls, aimWorld);

    const lead = physics.getLeadBodyPosition();
    const targetCamX = lead.x - canvas.width * 0.35;
    const targetCamY = lead.y - canvas.height * 0.55;
    state.cameraX += (targetCamX - state.cameraX) * 0.1;
    state.cameraY += (targetCamY - state.cameraY) * 0.08;
  }

  let shakeX = 0;
  let shakeY = 0;
  if (renderer.shakeTime > 0) {
    shakeX = (Math.random() - 0.5) * renderer.shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * renderer.shakeIntensity * 2;
  }

  const camX = state.cameraX + shakeX;
  const camY = state.cameraY + shakeY;

  renderer.drawBackground(canvas.width, canvas.height, camX, camY, state.mode);
  renderer.drawTerrain(physics.terrainPoints, canvas.width, canvas.height, camX, camY);
  renderer.drawTargets(physics.targets, camX, camY);

  if (state.mode === 'build') {
    const center = getBuildCenter();
    renderer.drawBuildGrid(
      center.x,
      center.y,
      4,
      state.cells,
      state.hoverCell,
      state.selectedPart,
      state.rotationStep,
      state.eraserMode
    );
  } else {
    renderer.drawVehicle(physics.vehicle, camX, camY, state.controls.boost, aimWorld);
    renderer.drawProjectiles(physics.projectiles, camX, camY);
  }

  renderer.drawParticles(camX, camY);

  requestAnimationFrame(gameLoop);
}

loadStarterPreset();
buildPartCards();
requestAnimationFrame(gameLoop);
