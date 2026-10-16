import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD, createRun, jump, shout, stepRun } from '../docs/hop-model.js';

const dt = 1 / 120;
const advance = (run, seconds) => {
  const ticks = Math.round(seconds / dt);
  for (let i = 0; i < ticks; i++) stepRun(run, dt);
};
const rock = (id, x = WORLD.playerX - 5, height = 40) => ({ id, x, width: 38, height, kind: 'rock' });
const quietRun = () => {
  const run = createRun(12);
  run._nextObstacleDistance = Infinity;
  return run;
};

test('public initial state and seeded input replay are deterministic', () => {
  assert.deepEqual(WORLD, { width: 900, height: 340, ground: 266, playerX: 135 });
  const first = createRun(31415);
  assert.equal(first.status, 'running');
  assert.equal(first.lives, 3);
  assert.equal(first.score, 0);
  assert.equal(first.charge, 1);
  assert.deepEqual(first.player, { height: 0, velocity: 0 });
  const second = createRun(31415);
  for (let i = 0; i < 1800; i++) {
    if (i % 240 === 0) { jump(first); jump(second); }
    if (i % 700 === 0) { shout(first); shout(second); }
    stepRun(first, dt); stepRun(second, dt);
  }
  assert.deepEqual(first, second);
  const different = createRun(31416);
  stepRun(different, dt);
  const initial = createRun(31415);
  stepRun(initial, dt);
  assert.notDeepEqual(different.obstacles, initial.obstacles);
  for (const seed of [0, NaN, Infinity, -1]) {
    const run = createRun(seed); stepRun(run, 0.1);
    assert(Number.isFinite(run.distance));
  }
});

test('elapsed time is bounded and split into fixed physics ticks', () => {
  const capped = quietRun(), normal = quietRun();
  jump(capped); jump(normal);
  stepRun(capped, 500);
  stepRun(normal, 0.25);
  assert.deepEqual(capped, normal);
  assert.equal(capped.time, 0.25);
  const snapshot = structuredClone(capped);
  for (const invalid of [0, -1, NaN, Infinity, undefined]) stepRun(capped, invalid);
  assert.deepEqual(capped, snapshot);

  const small = quietRun(), large = quietRun();
  jump(small); jump(large);
  for (let i = 0; i < 120; i++) stepRun(small, dt);
  for (let i = 0; i < 20; i++) stepRun(large, 0.05);
  assert.equal(small._ticks, large._ticks);
  assert.deepEqual(small.player, large.player);
  assert.equal(small.distance, large.distance);
  const fractional = quietRun();
  stepRun(fractional, dt / 2);
  assert.equal(fractional.time, 0);
  stepRun(fractional, dt / 2);
  assert.equal(fractional.time, dt);
});

test('jump cannot be repeated in air, clears the tallest rock, and lands', () => {
  const run = quietRun();
  assert.equal(jump(run), true);
  assert.equal(jump(run), false);
  advance(run, 0.3);
  assert(run.player.height > 90);
  assert.equal(jump(run), false);
  run.obstacles.push(rock(900, WORLD.playerX - 5, 56));
  stepRun(run, dt);
  assert.equal(run.lives, 3);
  advance(run, 0.45);
  assert.equal(run.player.height, 0);
  assert.equal(run.player.velocity, 0);
  assert.equal(jump(run), true);
  assert.equal(run.events.filter(e => e.type === 'hop').length, 2);
});

test('shout clears only nearby forward rocks, awards points, and recovers', () => {
  const run = quietRun();
  run.obstacles = [rock(1, 30), rock(2, 200), rock(3, 455), rock(4, 456)];
  assert.equal(shout(run), true);
  assert.deepEqual(run.obstacles.map(x => x.id), [1, 4]);
  assert.equal(run.score, 30);
  assert.equal(run.charge, 0);
  assert.equal(shout(run), false);
  assert.equal(run.events.filter(e => e.type === 'clear').length, 2);
  run.obstacles = [];
  advance(run, 4.9);
  assert.equal(shout(run), false);
  advance(run, 0.1);
  assert.equal(shout(run), true);
});

test('collisions have a grace period and the third hit ends the run', () => {
  const run = quietRun();
  run.obstacles = [rock(1), rock(2)];
  stepRun(run, dt);
  assert.equal(run.lives, 2);
  assert.equal(run.obstacles.length, 0);
  assert.equal(run.events.filter(e => e.type === 'hit').length, 1);
  run.obstacles = [rock(3)];
  stepRun(run, dt);
  assert.equal(run.lives, 2);
  advance(run, 1.25);
  run.obstacles = [rock(4)]; stepRun(run, dt);
  assert.equal(run.lives, 1);
  advance(run, 1.25);
  run.obstacles = [rock(5)]; stepRun(run, dt);
  assert.equal(run.lives, 0);
  assert.equal(run.status, 'over');
  assert.equal(run.events.filter(e => e.type === 'hit').length, 3);
  const snapshot = structuredClone(run);
  assert.equal(jump(run), false);
  assert.equal(shout(run), false);
  stepRun(run, 0.25);
  assert.deepEqual(run, snapshot);
});

test('a collected firefly scores and charges exactly once', () => {
  const run = quietRun();
  run.charge = 0.5;
  run.fireflies.push({ id: 1, x: WORLD.playerX + 2, y: WORLD.ground - 22 });
  stepRun(run, dt);
  assert.equal(run.fireflies.length, 0);
  assert.equal(run._bonusScore, 25);
  assert(run.charge > 0.62 && run.charge < 0.63);
  advance(run, 0.3);
  assert.equal(run._bonusScore, 25);
  assert.equal(run.events.filter(e => e.type === 'collect').length, 1);
  assert(run.events.every(e => Object.keys(e).sort().join(',') === 'type,x,y'));
});

test('long runs preserve safe spacing, cap speed and keep live objects bounded', () => {
  const run = createRun(922);
  run.lives = 1000; // Exercise the generator through maximum speed without UI input.
  const seen = new Map();
  let maxRocks = 0, maxFlies = 0;
  for (let i = 0; i < 120 * 180; i++) {
    stepRun(run, dt);
    for (const obstacle of run.obstacles) {
      if (!seen.has(obstacle.id)) seen.set(obstacle.id, obstacle.x + run.distance);
      assert(obstacle.width <= 46 && obstacle.height <= 56);
    }
    maxRocks = Math.max(maxRocks, run.obstacles.length);
    maxFlies = Math.max(maxFlies, run.fireflies.length);
    assert(run.events.length <= 96);
    assert(Number.isFinite(run.score) && Number.isFinite(run.player.height));
  }
  const positions = [...seen.values()];
  assert(positions.length > 80);
  for (let i = 1; i < positions.length; i++) {
    const gap = positions[i] - positions[i - 1];
    assert(gap >= 480 - 1e-8 && gap <= 680 + 1e-8);
    assert((gap - 46 - 28) / 340 > 0.72 + 0.47);
  }
  assert.equal(run.speed, 340);
  assert(maxRocks <= 3 && maxFlies <= 6);
  assert.equal(run.status, 'running');
});
