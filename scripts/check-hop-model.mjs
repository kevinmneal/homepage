import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD, createRun, jump, shout, stepRun } from '../docs/hop-model.js';

const dt = 1 / 120;
const advance = (run, seconds) => {
  const ticks = Math.round(seconds / dt);
  for (let i = 0; i < ticks; i++) stepRun(run, dt);
};
const rock = (id, x = WORLD.playerX - 5, height = 40) => ({ id, x, y: WORLD.ground, width: 38, height, kind: 'rock', phase: 0 });
const moth = (id, x = WORLD.playerX - 5) => ({ id, x, y: 191, width: 54, height: 30, kind: 'moth', phase: 0 });
const tumbleweed = (id, x = WORLD.playerX - 5) => ({ id, x, y: WORLD.ground, width: 48, height: 48, kind: 'tumbleweed', phase: 0 });
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
  assert.equal(first.blast, null);
  assert.equal(first.stage, 0);
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

test('shout launches a progressive force front and clears each swept obstacle once', () => {
  const run = quietRun();
  run.obstacles = [rock(1, 30), rock(2, 220), tumbleweed(3, 420), moth(4, 600), rock(5, 900)];
  assert.equal(shout(run), true);
  assert.equal(run.obstacles.length, 5, 'input must not delete obstacles instantly');
  assert.equal(run.score, 0);
  assert.equal(run.charge, 0);
  assert.equal(run.blast.x, WORLD.playerX);
  assert.equal(shout(run), false);
  advance(run, 0.05);
  assert(run.blast.x > WORLD.playerX && run.blast.age > 0);
  assert.equal(run.events.filter(e => e.type === 'clear').length, 0);
  advance(run, 0.1);
  assert.equal(run.events.filter(e => e.type === 'clear').length, 1);
  assert(run.obstacles.some(item => item.id === 3), 'farther obstacle waits for front');
  assert.equal(run.lives, 3);
  advance(run, 0.5);
  assert.equal(run.blast, null);
  assert.equal(run._bonusScore, 45);
  const events = run.events.filter(e => e.type === 'clear');
  assert.deepEqual(events.map(e => e.kind), ['rock', 'tumbleweed', 'moth']);
  assert(events.every(e => e.width > 0 && e.height > 0 && e.vx > 0 && e.vy < 0 && Number.isFinite(e.angle)));
  assert(run.obstacles.some(item => item.id === 5), 'distant obstacle is outside pulse reach');
  run.obstacles = [];
  advance(run, 4.25);
  assert.equal(shout(run), false);
  advance(run, 0.1);
  assert.equal(shout(run), true);
});

test('force front sweeps without tunneling in a large frame and works midair', () => {
  const fine = quietRun(), coarse = quietRun();
  for (const run of [fine, coarse]) {
    jump(run); advance(run, 0.3);
    run.obstacles = [rock(10, 200), moth(11, 300)];
    shout(run);
  }
  advance(fine, 0.25);
  stepRun(coarse, 0.25);
  assert.deepEqual(coarse.obstacles, fine.obstacles);
  assert.deepEqual(coarse.events, fine.events);
  assert.equal(coarse._bonusScore, 30);
  assert.equal(coarse.lives, 3);
});

test('moths are safe on the ground but collide at jump height; tumbleweeds can be hopped', () => {
  const below = quietRun();
  below.obstacles = [moth(1)];
  advance(below, 0.6);
  assert.equal(below.lives, 3);
  const jumping = quietRun();
  jump(jumping); advance(jumping, 0.2);
  jumping.obstacles = [moth(2)];
  stepRun(jumping, dt);
  assert.equal(jumping.lives, 2);
  const over = quietRun();
  jump(over); advance(over, 0.3);
  over.obstacles = [tumbleweed(3)];
  const beforePhase = over.obstacles[0].phase;
  stepRun(over, dt);
  assert.equal(over.lives, 3);
  assert.notEqual(over.obstacles[0].phase, beforePhase, 'rolling phase advances');
  const ground = quietRun();
  ground.obstacles = [tumbleweed(4)];
  stepRun(ground, dt);
  assert.equal(ground.lives, 2);
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
  assert(run.events.every(e => typeof e.type === 'string' && Number.isFinite(e.x) && Number.isFinite(e.y)));
});

test('stages introduce tumbleweeds and moths in order with a clear speed ramp', () => {
  const run = quietRun();
  advance(run, 15);
  assert.equal(run.stage, 1);
  assert.equal(run.speed, 240);
  run._nextObstacleDistance = run.distance;
  stepRun(run, dt);
  assert.equal(run.obstacles.at(-1).kind, 'tumbleweed');
  run.obstacles = []; run.fireflies = []; run._nextObstacleDistance = Infinity;
  advance(run, 15);
  assert.equal(run.stage, 2);
  run._nextObstacleDistance = run.distance;
  stepRun(run, dt);
  assert.equal(run.obstacles.at(-1).kind, 'moth');
  assert(run.fireflies.every(f => f.y === WORLD.ground - 22), 'moth fireflies encourage staying low');
  run.obstacles = []; run.fireflies = []; run._nextObstacleDistance = Infinity;
  advance(run, 50);
  assert.equal(run.speed, 370);
  assert.deepEqual(run.events.filter(e => e.type === 'stage').map(e => e.stage), [1, 2]);
});

test('long runs preserve safe mixed-obstacle spacing and bounded live objects', () => {
  const run = createRun(922);
  run.lives = 1000; // Exercise the generator through maximum speed without UI input.
  const seen = new Map();
  const kinds = new Set();
  let maxRocks = 0, maxFlies = 0;
  for (let i = 0; i < 120 * 180; i++) {
    stepRun(run, dt);
    for (const obstacle of run.obstacles) {
      if (!seen.has(obstacle.id)) seen.set(obstacle.id, obstacle.x + run.distance);
      kinds.add(obstacle.kind);
      assert(obstacle.width <= 54 && obstacle.height <= 56);
      if (run.time < 15) assert.equal(obstacle.kind, 'rock');
      if (run.time < 30) assert.notEqual(obstacle.kind, 'moth');
      assert.equal(obstacle.y, obstacle.kind === 'moth' ? 191 : WORLD.ground);
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
    assert(gap >= 520 - 1e-8 && gap <= 700 + 1e-8);
    assert((gap - 54 - 28) / 370 > 0.72 + 0.46);
  }
  assert.deepEqual([...kinds].sort(), ['moth', 'rock', 'tumbleweed']);
  assert.equal(run.speed, 370);
  assert(maxRocks <= 3 && maxFlies <= 6);
  assert.equal(run.status, 'running');
});

test('a simple ground-hop / run-under policy survives mixed patterns without shouting', () => {
  for (const seed of [17, 922, 3511, 80081]) {
    const run = createRun(seed);
    for (let frame = 0; frame < 180 * 60; frame++) {
      const next = run.obstacles.find(o => o.x + o.width > WORLD.playerX - 14);
      if (next && next.kind !== 'moth' && next.x < WORLD.playerX + 14 + run.speed * 0.22) jump(run);
      stepRun(run, 1 / 60);
      run.events.length = 0;
      assert.equal(run.lives, 3, `avoidable path failed for seed ${seed} at ${run.time}s`);
    }
    assert.equal(run.stage, 2);
    assert.equal(run.status, 'running');
  }
});
