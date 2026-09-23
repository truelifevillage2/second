import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, clamp, isBlocked, createGame, step, advance, nearestNode } from '../game.mjs';

const tick = (game, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(game, input, 1 / 60);
};

test('clamp keeps values in range', () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(4, 0, 10), 4);
});
test('roads are open, buildings and world edges are solid', () => {
  assert.equal(isBlocked(160, 500), false);
  assert.equal(isBlocked(320, 320), true);
  assert.equal(isBlocked(-1, 160), true);
  assert.equal(isBlocked(WORLD, 160), true);
});
test('nearest road intersection clamps at world limits', () => {
  assert.deepEqual(nearestNode(-100, 5000), { x: 160, y: 2080 });
});
test('fresh games have independent state and deterministic traffic', () => {
  const a = createGame(123), b = createGame(123);
  assert.deepEqual(a.traffic, b.traffic);
  a.player.health = 0;
  assert.equal(b.player.health, 100);
  assert.equal(b.status, 'playing');
});
test('acceleration moves the car and caps its speed', () => {
  const g = createGame();
  tick(g, 1, { up: true });
  assert.ok(g.player.x > 160);
  assert.ok(g.player.speed > 0 && g.player.speed <= 320);
});
test('handbrake reduces forward speed', () => {
  const g = createGame();
  g.player.speed = 180;
  tick(g, 0.3, { brake: true });
  assert.ok(g.player.speed < 60);
});
test('building collision damages the car and does not enter the building', () => {
  const g = createGame();
  g.player.x = 210; g.player.y = 320; g.player.speed = 200;
  step(g, {}, 0.05);
  assert.ok(g.player.health < 100);
  assert.equal(isBlocked(g.player.x, g.player.y), false);
});
test('invalid simulation time is rejected', () => {
  for (const dt of [-1, NaN, Infinity, '0.1']) {
    assert.throws(() => step(createGame(), {}, dt), /dt/);
  }
});
test('large simulation steps are bounded', () => {
  const g = createGame();
  step(g, {}, 10);
  assert.ok(g.time >= 149.95);
});
test('pickup requires stopping inside the marker', () => {
  const g = createGame();
  Object.assign(g.player, g.missions[0].pickup, { speed: 0 });
  tick(g, 0.8);
  assert.equal(g.cargo, true);
  assert.equal(g.missionIndex, 0);
});
test('delivery pays cash, repairs the car and advances the contract', () => {
  const g = createGame();
  g.cargo = true; g.player.health = 60;
  Object.assign(g.player, g.missions[0].dropoff, { speed: 0 });
  tick(g, 0.8);
  assert.equal(g.cash, g.missions[0].reward);
  assert.equal(g.missionIndex, 1);
  assert.equal(g.cargo, false);
  assert.ok(g.player.health > 60);
});
test('wanted drivers cannot complete a delivery', () => {
  const g = createGame();
  g.cargo = true; g.heat = 2;
  Object.assign(g.player, g.missions[0].dropoff, { speed: 0 });
  tick(g, 0.8);
  assert.equal(g.missionIndex, 0);
  assert.equal(g.cash, 0);
});
test('last delivery wins the run', () => {
  const g = createGame();
  g.missionIndex = g.missions.length - 1; g.cargo = true;
  Object.assign(g.player, g.missions[g.missionIndex].dropoff, { speed: 0 });
  tick(g, 0.8);
  assert.equal(g.status, 'complete');
});
test('timer and vehicle damage end a run', () => {
  const timeout = createGame(); timeout.time = 0.001;
  step(timeout, {}, 1 / 60);
  assert.equal(timeout.status, 'timeout');
  const wreck = createGame(); wreck.player.health = 0;
  step(wreck, {}, 1 / 60);
  assert.equal(wreck.status, 'wrecked');
});
test('finished simulation does not advance', () => {
  const g = createGame(); g.status = 'timeout';
  const before = JSON.stringify(g);
  step(g, { up: true }, 1 / 60);
  assert.equal(JSON.stringify(g), before);
});
test('fixed-step accumulator ignores excessive wall-clock gaps', () => {
  const g = createGame();
  advance(g, {}, 50, 0);
  assert.ok(g.time > 149.8);
});
