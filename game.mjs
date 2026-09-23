// Neon Coast: dependency-free simulation plus browser canvas renderer.
// Importing this module in Node does not access the DOM.
export const WORLD = 2240;
const GRID = 320;
const ROAD = 70;
const RADIUS = 14;
const FIXED_DT = 1 / 60;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const roadDistance = value => Math.abs(((value - 160) % GRID + GRID) % GRID - GRID / 2);
export function isBlocked(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  if (x < RADIUS || y < RADIUS || x > WORLD - RADIUS || y > WORLD - RADIUS) return true;
  const dx = 160 - roadDistance(x), dy = 160 - roadDistance(y);
  return dx > ROAD - RADIUS && dy > ROAD - RADIUS;
}
export function nearestNode(x, y) {
  return { x: clamp(Math.round((x - 160) / GRID), 0, 6) * GRID + 160,
    y: clamp(Math.round((y - 160) / GRID), 0, 6) * GRID + 160 };
}
function randomFactory(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export function createGame(seed = 7) {
  const random = randomFactory(seed);
  return {
    player: { x: 160, y: 160, angle: 0, speed: 0, health: 100 },
    traffic: Array.from({ length: 32 }, (_, i) => {
      const horizontal = i % 2 === 0, sign = i % 4 < 2 ? 1 : -1;
      const lane = 160 + Math.floor(random() * 7) * GRID + sign * 26;
      const along = 160 + random() * 1920;
      return { x: horizontal ? along : lane, y: horizontal ? lane : along,
        horizontal, sign, speed: 65 + random() * 45,
        angle: horizontal ? (sign === 1 ? 0 : Math.PI) : (sign === 1 ? Math.PI / 2 : -Math.PI / 2),
        color: ['#b185e5', '#f2d6a0', '#72d6bf', '#da637c'][i % 4] };
    }),
    cops: [], heat: 0, cash: 0, time: 150, elapsed: 0, cargo: false,
    missionIndex: 0, dwell: 0, hitCooldown: 0, spawnCooldown: 0,
    status: 'playing', message: 'Welcome to the coast. Follow the cyan pickup beacon.', messageTime: 6,
    missions: [
      { name: 'Sunset Session', item: 'DJ equipment', pickup: { x: 480, y: 160 }, dropoff: { x: 1120, y: 800 }, reward: 500 },
      { name: 'Midnight Premiere', item: 'Film reels', pickup: { x: 1760, y: 800 }, dropoff: { x: 1760, y: 1760 }, reward: 850 },
      { name: 'The Last Wave', item: 'Radio transmitter', pickup: { x: 800, y: 1760 }, dropoff: { x: 160, y: 1120 }, reward: 1200 }
    ]
  };
}
function notify(g, message) { g.message = message; g.messageTime = 4; }
function impact(g, damage, heat = 0) {
  if (g.hitCooldown > 0) return;
  g.player.health = Math.max(0, g.player.health - damage);
  g.heat = clamp(g.heat + heat, 0, 3);
  g.hitCooldown = 0.8;
  notify(g, heat ? 'Collision reported. Lose the patrol before delivery.' : 'Watch the corners! Vehicle damaged.');
}
function updateCops(g, dt) {
  const p = g.player;
  g.spawnCooldown -= dt;
  if (g.heat >= 1 && g.cops.length < Math.ceil(g.heat) && g.spawnCooldown <= 0) {
    const target = nearestNode(p.x, p.y);
    const node = { x: target.x < 1120 ? 2080 : 160, y: target.y };
    g.cops.push({ ...node, target: { ...node }, angle: 0 });
    g.spawnCooldown = 4;
  }
  if (g.heat < 0.15) { g.cops.length = 0; return; }
  for (const cop of g.cops) {
    let remaining = (145 + g.heat * 22) * dt;
    for (let i = 0; i < 3 && remaining > 0; i++) {
      let d = distance(cop, cop.target);
      if (d < 0.001) {
        const target = nearestNode(p.x, p.y);
        const dx = target.x - cop.x, dy = target.y - cop.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
        cop.target = Math.abs(dx) >= Math.abs(dy)
          ? { x: cop.x + Math.sign(dx) * GRID, y: cop.y }
          : { x: cop.x, y: cop.y + Math.sign(dy) * GRID };
        d = distance(cop, cop.target);
      }
      cop.angle = Math.atan2(cop.target.y - cop.y, cop.target.x - cop.x);
      const movement = Math.min(remaining, d);
      cop.x += Math.cos(cop.angle) * movement;
      cop.y += Math.sin(cop.angle) * movement;
      remaining -= movement;
    }
    if (distance(cop, p) < 31) { impact(g, 12, 0.2); p.speed *= 0.94; }
  }
}
export function step(g, input = {}, dt = FIXED_DT) {
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be a finite nonnegative number');
  if (g.status !== 'playing' || dt === 0) return;
  dt = Math.min(dt, 0.05);
  const p = g.player;
  g.elapsed += dt; g.time = Math.max(0, g.time - dt);
  g.hitCooldown = Math.max(0, g.hitCooldown - dt);
  g.messageTime = Math.max(0, g.messageTime - dt);
  const throttle = Number(Boolean(input.up)) - Number(Boolean(input.down));
  p.speed += throttle * 220 * dt;
  const resistance = input.brake ? 650 : throttle ? 28 : 85;
  p.speed = Math.sign(p.speed) * Math.max(0, Math.abs(p.speed) - resistance * dt);
  p.speed = clamp(p.speed, -110, 320);
  const turn = Number(Boolean(input.right)) - Number(Boolean(input.left));
  p.angle += turn * Math.sign(p.speed) * Math.min(1, Math.abs(p.speed) / 70) * (input.brake ? 3.7 : 2.5) * dt;
  p.angle = Math.atan2(Math.sin(p.angle), Math.cos(p.angle));
  const nx = p.x + Math.cos(p.angle) * p.speed * dt;
  const ny = p.y + Math.sin(p.angle) * p.speed * dt;
  if (!isBlocked(nx, ny)) { p.x = nx; p.y = ny; }
  else { impact(g, clamp(Math.abs(p.speed) / 16, 2, 20)); p.speed *= -0.28; }
  for (const car of g.traffic) {
    const axis = car.horizontal ? 'x' : 'y';
    car[axis] += car.sign * car.speed * dt;
    if (car[axis] > WORLD + 30) car[axis] = -30;
    if (car[axis] < -30) car[axis] = WORLD + 30;
    if (distance(car, p) < 24 && g.hitCooldown <= 0) {
      impact(g, 7 + Math.abs(p.speed) / 35, 0.7); p.speed *= -0.3;
    }
  }
  const pursued = g.cops.some(c => distance(c, p) < 230);
  if (Math.abs(p.speed) > 250) g.heat += 0.14 * dt;
  else if (!pursued) g.heat -= 0.085 * dt;
  g.heat = clamp(g.heat, 0, 3);
  updateCops(g, dt);
  if (p.health <= 0) { g.status = 'wrecked'; return; }
  if (g.time <= 0) { g.status = 'timeout'; return; }
  const mission = g.missions[g.missionIndex];
  const target = g.cargo ? mission.dropoff : mission.pickup;
  const arrived = distance(p, target) < 42 && Math.abs(p.speed) < 32;
  if (arrived && (!g.cargo || g.heat < 0.5)) {
    g.dwell += dt;
    if (g.dwell >= 0.6) {
      g.dwell = 0;
      if (!g.cargo) { g.cargo = true; notify(g, `${mission.item} loaded. Follow the pink delivery beacon.`); }
      else {
        g.cash += mission.reward; g.time += 45; p.health = Math.min(100, p.health + 18);
        g.cargo = false; g.missionIndex++;
        notify(g, `Delivery complete! +$${mission.reward} · +45 seconds · vehicle repaired`);
        if (g.missionIndex === g.missions.length) g.status = 'complete';
      }
    }
  } else {
    g.dwell = 0;
    if (arrived && g.cargo && g.heat >= 0.5) notify(g, 'Lose your wanted heat before making the delivery.');
  }
}
export function advance(g, input, elapsed, accumulator = 0) {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('elapsed must be finite and nonnegative');
  accumulator += Math.min(elapsed, 0.1);
  while (accumulator >= FIXED_DT) { step(g, input, FIXED_DT); accumulator -= FIXED_DT; }
  return accumulator;
}

function boot() {
  const byId = id => document.getElementById(id);
  const canvas = byId('city'), map = byId('minimap');
  if (!canvas || !map) return;
  const ctx = canvas.getContext('2d'), mctx = map.getContext('2d');
  if (!ctx || !mctx) { byId('load-error').hidden = false; return; }
  let game = createGame(), started = false, paused = false, accumulator = 0;
  let last = 0, width = 1, height = 1, dpr = 1, best = 0, screen = 'intro';
  const camera = { x: 160, y: 160 }, keys = new Set(), touches = new Map();
  const money = value => '$' + value.toLocaleString('en-US');
  try { best = clamp(Number(localStorage.getItem('neon-coast-best')) || 0, 0, 10000000); } catch { /* Storage is optional. */ }
  byId('best').textContent = money(best);
  const buildings = [];
  const random = randomFactory(89);
  for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
    const x = col * GRID + 230, y = row * GRID + 230;
    buildings.push({ x, y, color: ['#192237', '#28233c', '#202e3c', '#31253e'][Math.floor(random() * 4)],
      accent: ['#ff6fae', '#64f6e4', '#a696ff', '#edc47e'][(row + col) % 4],
      label: ['VINYL', 'HOTEL', 'ARCADE', 'COAST FM', 'CINEMA', 'NIGHT OWL'][(row * 3 + col) % 6] });
  }
  function resize() {
    width = window.innerWidth; height = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    map.width = 180 * dpr; map.height = 180 * dpr;
  }
  function resetInputs() { keys.clear(); touches.clear(); document.querySelectorAll('[data-key]').forEach(b => b.classList.remove('held')); }
  function modal(kind) {
    screen = kind;
    byId('overlay').hidden = false;
    const copy = {
      intro: ['THE NIGHT IS YOURS.', 'Three deliveries. One borrowed coupe. Keep the city moving before the clock runs out.', 'Hit the streets'],
      paused: ['TAKE A BREATHER.', 'Your run is paused. The coast can wait.', 'Back to the coast'],
      complete: ['COAST LEGEND.', `All three deliveries landed. You earned ${money(game.cash)}. The city knows your name.`, 'Drive again'],
      timeout: ['SUNRISE CAUGHT YOU.', `Time ran out. You banked ${money(game.cash)}. Brake at beacons to collect and deliver.`, 'Try another night'],
      wrecked: ['END OF THE ROAD.', `Your coupe is wrecked. You banked ${money(game.cash)}. Slow down at corners and avoid traffic.`, 'Get a new coupe']
    }[kind];
    byId('overlay-title').textContent = copy[0]; byId('overlay-copy').textContent = copy[1];
    byId('play').textContent = copy[2];
    byId('eyebrow').textContent = kind === 'intro' ? 'AN ORIGINAL ARCADE DRIVING GAME' : kind === 'paused' ? 'INTERMISSION' : 'NIGHT SHIFT / RESULTS';
    byId('play').focus({ preventScroll: true });
  }
  function saveBest() {
    best = Math.max(best, game.cash); byId('best').textContent = money(best);
    try { localStorage.setItem('neon-coast-best', String(best)); } catch { /* Private browsing can disable storage. */ }
  }
  function start() {
    if (screen !== 'paused') { saveBest(); game = createGame(); camera.x = game.player.x; camera.y = game.player.y; }
    started = true; paused = false; screen = ''; accumulator = 0; resetInputs();
    byId('overlay').hidden = true; byId('pause').textContent = 'Ⅱ Pause'; canvas.focus({ preventScroll: true });
  }
  function togglePause() {
    if (!started || game.status !== 'playing') return;
    if (paused) { start(); return; }
    paused = true; resetInputs(); byId('pause').textContent = '▶ Resume'; modal('paused');
  }
  byId('play').addEventListener('click', start);
  byId('pause').addEventListener('click', togglePause);
  byId('restart').addEventListener('click', () => { screen = 'restart'; start(); });
  const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'brake' };
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyP' || event.code === 'Escape') { if (!event.repeat) togglePause(); return; }
    if (event.code === 'KeyR' && started && !event.repeat) { screen = 'restart'; start(); return; }
    if (keyMap[event.code] && started && !paused && game.status === 'playing') { event.preventDefault(); keys.add(event.code); }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { resetInputs(); if (started && !paused && game.status === 'playing') togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { resetInputs(); if (started && !paused && game.status === 'playing') togglePause(); } });
  for (const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown', event => {
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      touches.set(event.pointerId, button.dataset.key); button.classList.add('held');
    });
    const release = event => {
      touches.delete(event.pointerId);
      if (![...touches.values()].includes(button.dataset.key)) button.classList.remove('held');
    };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  }
  function input() {
    const result = {};
    for (const code of keys) result[keyMap[code]] = true;
    for (const key of touches.values()) result[key] = true;
    return result;
  }
  function car(c, color, police = false, player = false) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = '#0007'; ctx.fillRect(-19, -10, 43, 25);
    ctx.fillStyle = '#0b1020'; ctx.fillRect(-14, -14, 10, 5); ctx.fillRect(8, -14, 10, 5); ctx.fillRect(-14, 9, 10, 5); ctx.fillRect(8, 9, 10, 5);
    ctx.fillStyle = color; ctx.fillRect(-21, -11, 42, 22);
    ctx.fillStyle = '#101c33'; ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#b2f9ff99'; ctx.fillRect(6, -8, 4, 16);
    ctx.fillStyle = '#071426'; ctx.fillRect(-11, -8, 3, 16);
    ctx.fillStyle = '#fff7ce'; ctx.fillRect(19, -9, 3, 5); ctx.fillRect(19, 4, 3, 5);
    ctx.fillStyle = '#ff326d'; ctx.fillRect(-22, -9, 3, 5); ctx.fillRect(-22, 4, 3, 5);
    if (police) {
      ctx.fillStyle = Math.floor(game.elapsed * 8) % 2 ? '#ff426b' : '#55c8ff';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16; ctx.fillRect(-2, -8, 5, 16);
    }
    if (player) {
      const light = ctx.createLinearGradient(20, 0, 130, 0); light.addColorStop(0, '#fff2b02b'); light.addColorStop(1, '#fff2b000');
      ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(135, -38); ctx.lineTo(135, 38); ctx.lineTo(20, 8); ctx.fill();
    }
    ctx.restore();
  }
  function palm(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#554052'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(6, -4); ctx.stroke();
    ctx.strokeStyle = '#438b80'; ctx.lineWidth = 5;
    for (let n = 0; n < 6; n++) {
      const angle = n * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(6, -4); ctx.quadraticCurveTo(6 + Math.cos(angle) * 13, -4 + Math.sin(angle) * 13, 6 + Math.cos(angle + 0.3) * 24, -4 + Math.sin(angle + 0.3) * 24); ctx.stroke();
    }
    ctx.restore();
  }
  function draw(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0b2133'; ctx.fillRect(0, 0, width, height);
    const zoom = width < 650 ? 0.76 : 1;
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(zoom, zoom); ctx.translate(-camera.x, -camera.y);
    const left = camera.x - width / zoom / 2 - 200, right = camera.x + width / zoom / 2 + 200;
    const top = camera.y - height / zoom / 2 - 200, bottom = camera.y + height / zoom / 2 + 200;
    ctx.fillStyle = '#152e3a'; ctx.fillRect(0, 0, WORLD, WORLD);
    ctx.fillStyle = '#d1a47c'; ctx.fillRect(WORLD, 0, 90, WORLD);
    ctx.strokeStyle = '#7adae545'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(WORLD + 110 + i * 24 + Math.sin(time * 0.001 + i) * 5, 0); ctx.lineTo(WORLD + 110 + i * 24, WORLD); ctx.stroke(); }
    for (let n = 0; n < 7; n++) {
      const coord = 160 + n * GRID;
      ctx.fillStyle = '#53616c'; ctx.fillRect(coord - 79, 0, 158, WORLD); ctx.fillRect(0, coord - 79, WORLD, 158);
    }
    for (let n = 0; n < 7; n++) {
      const coord = 160 + n * GRID;
      ctx.fillStyle = '#22293a'; ctx.fillRect(coord - ROAD, 0, ROAD * 2, WORLD); ctx.fillRect(0, coord - ROAD, WORLD, ROAD * 2);
    }
    ctx.strokeStyle = '#bca26c55'; ctx.lineWidth = 2; ctx.setLineDash([20, 20]);
    for (let n = 0; n < 7; n++) {
      const coord = 160 + n * GRID;
      ctx.beginPath(); ctx.moveTo(coord, 0); ctx.lineTo(coord, WORLD); ctx.moveTo(0, coord); ctx.lineTo(WORLD, coord); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const x = 160 + c * GRID, y = 160 + r * GRID;
      if (x < left || x > right || y < top || y > bottom) continue;
      ctx.fillStyle = '#22293a'; ctx.fillRect(x - 64, y - 64, 128, 128);
      ctx.fillStyle = '#b2bdc43c';
      for (let i = -4; i <= 4; i++) { ctx.fillRect(x + i * 11, y - 67, 5, 17); ctx.fillRect(x - 67, y + i * 11, 17, 5); }
    }
    for (const b of buildings) {
      if (b.x > right || b.x + 180 < left || b.y > bottom || b.y + 180 < top) continue;
      ctx.fillStyle = '#080c1c88'; ctx.fillRect(b.x + 12, b.y + 14, 180, 180);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, 180, 180);
      ctx.strokeStyle = '#617084'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 5, b.y + 5, 170, 170);
      ctx.fillStyle = '#ffffff06'; ctx.fillRect(b.x + 15, b.y + 15, 150, 64);
      ctx.fillStyle = '#0b1623'; ctx.fillRect(b.x + 30, b.y + 32, 40, 27); ctx.fillRect(b.x + 104, b.y + 95, 34, 32);
      ctx.fillStyle = '#718090'; ctx.fillRect(b.x + 34, b.y + 35, 32, 3); ctx.fillRect(b.x + 34, b.y + 44, 32, 3);
      ctx.strokeStyle = b.accent; ctx.shadowColor = b.accent; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(b.x + 10, b.y + 174); ctx.lineTo(b.x + 170, b.y + 174); ctx.stroke();
      ctx.fillStyle = b.accent; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(b.label, b.x + 90, b.y + 155); ctx.shadowBlur = 0;
      palm(b.x - 9, b.y - 9); palm(b.x + 189, b.y + 189);
    }
    const mission = game.missions[Math.min(game.missionIndex, game.missions.length - 1)];
    const target = game.cargo ? mission.dropoff : mission.pickup;
    const beaconColor = game.cargo ? '#ff75bb' : '#69f6dd';
    if (game.status === 'playing') {
      ctx.save(); ctx.translate(target.x, target.y);
      ctx.strokeStyle = beaconColor; ctx.fillStyle = beaconColor + '22'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 34 + Math.sin(time * 0.004) * 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.rotate(Math.PI / 4); ctx.strokeRect(-10, -10, 20, 20); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = beaconColor; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(game.cargo ? 'DELIVER' : 'PICKUP', 0, -49);
      if (game.dwell > 0) { ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 44, -Math.PI / 2, -Math.PI / 2 + game.dwell / 0.6 * Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    for (const c of game.traffic) if (c.x > left && c.x < right && c.y > top && c.y < bottom) car(c, c.color);
    for (const c of game.cops) car(c, '#dae8f2', true);
    if (!(game.hitCooldown > 0 && Math.floor(time / 90) % 2)) car(game.player, '#ff6da8', false, true);
    ctx.restore();
    const tx = (target.x - camera.x) * zoom, ty = (target.y - camera.y) * zoom;
    if (started && game.status === 'playing' && (Math.abs(tx) > width * 0.37 || Math.abs(ty) > height * 0.30)) {
      const angle = Math.atan2(ty, tx), radius = Math.min(width * 0.35, height * 0.28);
      ctx.save(); ctx.translate(width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius); ctx.rotate(angle);
      ctx.fillStyle = beaconColor; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-5, 0); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
    vignette.addColorStop(0, '#07091a00'); vignette.addColorStop(1, '#07091a88'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    drawMap(target, beaconColor);
  }
  function drawMap(target, color) {
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.fillStyle = '#111c2d'; mctx.fillRect(0, 0, 180, 180);
    const scale = 168 / WORLD;
    mctx.save(); mctx.translate(6, 6); mctx.scale(scale, scale);
    mctx.strokeStyle = '#465264'; mctx.lineWidth = 75;
    for (let n = 0; n < 7; n++) { const pos = 160 + n * GRID; mctx.beginPath(); mctx.moveTo(pos, 0); mctx.lineTo(pos, WORLD); mctx.moveTo(0, pos); mctx.lineTo(WORLD, pos); mctx.stroke(); }
    mctx.strokeStyle = color + '77'; mctx.lineWidth = 12; mctx.setLineDash([35, 30]);
    const node = nearestNode(game.player.x, game.player.y);
    mctx.beginPath(); mctx.moveTo(game.player.x, game.player.y); mctx.lineTo(node.x, node.y); mctx.lineTo(target.x, node.y); mctx.lineTo(target.x, target.y); mctx.stroke(); mctx.setLineDash([]);
    mctx.fillStyle = color; mctx.fillRect(target.x - 42, target.y - 42, 84, 84);
    mctx.fillStyle = '#ff586d'; for (const cop of game.cops) { mctx.beginPath(); mctx.arc(cop.x, cop.y, 33, 0, Math.PI * 2); mctx.fill(); }
    mctx.translate(game.player.x, game.player.y); mctx.rotate(game.player.angle); mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(65, 0); mctx.lineTo(-40, -38); mctx.lineTo(-24, 0); mctx.lineTo(-40, 38); mctx.closePath(); mctx.fill(); mctx.restore();
  }
  function hud() {
    const g = game, mission = g.missions[Math.min(g.missionIndex, g.missions.length - 1)];
    const target = g.cargo ? mission.dropoff : mission.pickup;
    byId('cash').textContent = money(g.cash);
    byId('speed').textContent = String(Math.round(Math.abs(g.player.speed) * 0.42)).padStart(3, '0');
    byId('health-fill').style.width = g.player.health + '%';
    byId('health-fill').style.background = g.player.health < 30 ? '#ff627d' : '#6aecd1';
    byId('health-label').textContent = Math.ceil(g.player.health) + '%';
    byId('health-track').setAttribute('aria-valuenow', String(Math.ceil(g.player.health)));
    const seconds = Math.ceil(g.time);
    byId('timer').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    byId('timer').classList.toggle('urgent', g.time < 30);
    byId('mission-title').textContent = mission.name;
    byId('mission-step').textContent = g.status === 'complete' ? 'ALL CONTRACTS COMPLETE' : `CONTRACT ${g.missionIndex + 1} / 3 · ${g.cargo ? 'DELIVER' : 'COLLECT'}`;
    byId('mission-detail').textContent = `${g.cargo ? 'Deliver' : 'Collect'} ${mission.item.toLowerCase()} · ${Math.round(distance(g.player, target))} m`;
    byId('mission-reward').textContent = money(mission.reward);
    byId('cargo').textContent = g.cargo ? 'CARGO ON BOARD' : 'READY FOR PICKUP';
    const wanted = Math.ceil(g.heat);
    byId('heat').textContent = '★'.repeat(wanted) + '☆'.repeat(3 - wanted);
    byId('heat').setAttribute('aria-label', `Wanted level ${wanted} of 3`);
    byId('heat-caption').textContent = g.heat < 0.5 ? 'CLEAR TO DELIVER' : g.heat < 1 ? 'COOLING DOWN' : 'POLICE ALERT';
    byId('toast').textContent = g.messageTime > 0 ? g.message : g.heat >= 0.5 ? 'Break away from patrols and slow down to lose heat.' : 'Stop inside the beacon to load or unload automatically.';
  }
  function frame(now) {
    const elapsed = last ? (now - last) / 1000 : 0; last = now;
    if (started && !paused && game.status === 'playing') {
      accumulator = advance(game, input(), elapsed, accumulator);
      if (game.status !== 'playing') { saveBest(); resetInputs(); modal(game.status); }
    } else accumulator = 0;
    const follow = 1 - Math.exp(-Math.min(elapsed, 0.1) * 8);
    camera.x += (game.player.x - camera.x) * follow; camera.y += (game.player.y - camera.y) * follow;
    draw(now); hud(); requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize); resize();
  byId('load-error').hidden = true; modal('intro'); requestAnimationFrame(frame);
}
if (typeof document !== 'undefined') {
  try { boot(); } catch (error) {
    console.error('Neon Coast failed to initialize:', error);
    const banner = document.getElementById('load-error');
    if (banner) { banner.hidden = false; banner.textContent = 'Unable to start the game. Reload in a modern browser and check the browser console for details.'; }
  }
}
