/**
 * MAKE HOP! — deterministic, mutable game state with no browser dependencies.
 *
 * All times are seconds. Player height is feet above the ground; velocity is
 * positive upward. Obstacle x is its left edge and y is its BOTTOM edge in
 * screen coordinates. Ground kinds use y=WORLD.ground; moths use y=191 and are
 * safe to run under. phase is a visual angle in radians. All kinds share the
 * same scroll speed, so a tumbleweed cannot catch another obstacle.
 * Fireflies and events use screen coordinates. Call jump/shout for input, then
 * stepRun for elapsed time. Drain events with run.events.splice(0); the bounded
 * queue preserves input events until the renderer consumes them.
 *
 * stage advances 0 -> 1 at 15 s -> 2 at 30 s (rock, then tumbleweed, then moth).
 * blast is null or {x,previousX,y,age,radius,thickness,speed,originX,reach}.
 * Its x is the traveling front, radius its vertical reach, and thickness its
 * horizontal contact width. clear events add kind,width,height,angle,vx,vy;
 * those velocities are screen-space pixels/second for the renderer's debris.
 * stage events add stage. Every event retains type,x,y.
 *
 * stepRun uses 120 Hz physics and accepts at most 0.25 s per call. Longer pauses
 * are discarded so returning to the tab cannot produce a catch-up death.
 * Properties beginning with _ belong to the simulation, not the renderer.
 */

export const WORLD = Object.freeze({ width: 900, height: 340, ground: 266, playerX: 135 });

const TICK = 1 / 120;
const MAX_ELAPSED = 0.25;
const START_SPEED = 210;
const MAX_SPEED = 370;
const ACCELERATION = 2;
const JUMP_VELOCITY = 540;
const GRAVITY = 1500;
const PLAYER_HALF_WIDTH = 14;
const PLAYER_BODY_HEIGHT = 36;
const MIN_OBSTACLE_GAP = 520;
const HURT_GRACE = 1.2;
const SHOUT_REACH = 440;
const SHOUT_SPEED = 720;
const CHARGE_SECONDS = 5;
const EVENT_LIMIT = 96;
const TAU = Math.PI * 2;

// At maximum speed the widest obstacle plus the player's width leaves >0.46 s
// beyond a complete jump: (520 - 54 - 28) / 370 > 0.72 + 0.46.
// Ground obstacles can be hopped; every moth can be passed without jumping.

function random(run) {
  let value = run._rng;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  run._rng = value >>> 0;
  return run._rng / 4294967296;
}

function emit(run, type, x = WORLD.playerX, y = WORLD.ground - run.player.height - 22, details = {}) {
  run.events.push({ type, x, y, ...details });
  if (run.events.length > EVENT_LIMIT) run.events.splice(0, run.events.length - EVENT_LIMIT);
}

function updateScore(run) {
  run.score = Math.floor(run.distance / 10) + run._bonusScore;
}

export function createRun(seed = 0x5ea12345) {
  const integerSeed = Number.isFinite(seed) ? seed >>> 0 : 0x5ea12345;
  return {
    lives: 3,
    score: 0,
    distance: 0,
    time: 0,
    speed: START_SPEED,
    player: { height: 0, velocity: 0 },
    obstacles: [],
    fireflies: [],
    charge: 1,
    blast: null,
    stage: 0,
    invulnerable: 0,
    status: 'running',
    events: [],
    _rng: integerSeed || 0x5ea12345,
    _accumulator: 0,
    _ticks: 0,
    _nextId: 1,
    _nextObstacleDistance: 0,
    _introducedStage: 0,
    _bonusScore: 0,
  };
}

/** One ground jump; holding or repeating input cannot jump again in midair. */
export function jump(run) {
  if (run.status !== 'running' || run.player.height > 0 || run.player.velocity !== 0) return false;
  run.player.velocity = JUMP_VELOCITY;
  emit(run, 'hop', WORLD.playerX, WORLD.ground);
  return true;
}

/** Spend a full charge to launch a force front; clearing happens in stepRun. */
export function shout(run) {
  if (run.status !== 'running' || run.charge < 1 - 1e-9 || run.blast) return false;
  run.charge = 0;
  run.blast = {
    x: WORLD.playerX,
    previousX: WORLD.playerX,
    y: WORLD.ground - run.player.height - 22,
    age: 0,
    radius: 110,
    thickness: 18,
    speed: SHOUT_SPEED,
    originX: WORLD.playerX,
    reach: SHOUT_REACH,
  };
  emit(run, 'shout');
  return true;
}

function obstacleKind(run) {
  // The first spawn after a milestone shows the newly introduced obstacle.
  if (run.stage > run._introducedStage) {
    run._introducedStage = run.stage;
    return run.stage === 1 ? 'tumbleweed' : 'moth';
  }
  if (run.stage === 0) return 'rock';
  const roll = random(run);
  if (run.stage === 2 && roll < 0.3) return 'moth';
  return roll < (run.stage === 1 ? 0.45 : 0.65) ? 'tumbleweed' : 'rock';
}

function spawn(run) {
  if (run.distance < run._nextObstacleDistance) return;
  // Subtract threshold overshoot to preserve exact spacing across frame rates.
  const x = WORLD.width + 40 - (run.distance - run._nextObstacleDistance);
  const kind = obstacleKind(run);
  const width = kind === 'rock' ? 28 + Math.floor(random(run) * 19)
    : kind === 'tumbleweed' ? 40 + Math.floor(random(run) * 11)
      : 46 + Math.floor(random(run) * 9);
  const height = kind === 'rock' ? 30 + Math.floor(random(run) * 27)
    : kind === 'tumbleweed' ? width : 26 + Math.floor(random(run) * 5);
  const y = kind === 'moth' ? 191 : WORLD.ground;
  run.obstacles.push({ id: run._nextId++, x, y, width, height, kind, phase: random(run) * TAU });
  // Ground fireflies reward a hop; moth fireflies reward running safely below.
  const fireflyY = kind === 'moth' ? WORLD.ground - 22
    : WORLD.ground - (92 + Math.floor(random(run) * 24));
  for (const offset of [-65, 45]) {
    run.fireflies.push({ id: run._nextId++, x: x + offset, y: fireflyY });
  }
  run._nextObstacleDistance += MIN_OBSTACLE_GAP + random(run) * 180;
}

function advanceBlast(run, movement) {
  const blast = run.blast;
  if (!blast) return;
  blast.previousX = blast.x;
  blast.age += TICK;
  blast.x = Math.min(blast.originX + blast.reach, blast.x + blast.speed * TICK);
  const sweptLeft = blast.previousX - blast.thickness / 2;
  const sweptRight = blast.x + blast.thickness / 2;
  run.obstacles = run.obstacles.filter(obstacle => {
    const bottom = obstacle.y ?? WORLD.ground;
    const inSweep = obstacle.x <= sweptRight && obstacle.x + obstacle.width + movement >= sweptLeft;
    const inHeight = bottom > blast.y - blast.radius && bottom - obstacle.height < blast.y + blast.radius;
    if (!inSweep || !inHeight) return true;
    run._bonusScore += 15;
    emit(run, 'clear', obstacle.x + obstacle.width / 2, bottom - obstacle.height / 2, {
      kind: obstacle.kind,
      width: obstacle.width,
      height: obstacle.height,
      angle: obstacle.phase ?? 0,
      vx: 360 + (obstacle.id % 5) * 28,
      vy: -220 - (obstacle.id % 4) * 25,
    });
    return false;
  });
  if (blast.x >= blast.originX + blast.reach) run.blast = null;
}

function tick(run) {
  run._ticks += 1;
  run.time = run._ticks * TICK;
  run.speed = Math.min(MAX_SPEED, START_SPEED + ACCELERATION * run.time);
  const stage = run.time >= 30 ? 2 : run.time >= 15 ? 1 : 0;
  if (stage !== run.stage) {
    run.stage = stage;
    emit(run, 'stage', WORLD.playerX, WORLD.ground - 80, { stage });
  }
  const movement = run.speed * TICK;
  run.distance += movement;
  run.invulnerable = Math.max(0, run.invulnerable - TICK);
  run.charge = Math.min(1, run.charge + TICK / CHARGE_SECONDS);

  if (run.player.height > 0 || run.player.velocity > 0) {
    run.player.height += run.player.velocity * TICK - GRAVITY * TICK * TICK / 2;
    run.player.velocity -= GRAVITY * TICK;
    if (run.player.height <= 0) {
      run.player.height = 0;
      run.player.velocity = 0;
    }
  }

  for (const obstacle of run.obstacles) {
    obstacle.x -= movement;
    if (obstacle.kind === 'tumbleweed') {
      obstacle.phase = ((obstacle.phase ?? 0) - movement / (obstacle.height / 2) + TAU) % TAU;
    } else if (obstacle.kind === 'moth') {
      obstacle.phase = ((obstacle.phase ?? 0) + TICK * 14) % TAU;
    }
  }
  for (const firefly of run.fireflies) firefly.x -= movement;
  spawn(run);
  advanceBlast(run, movement);

  const feetY = WORLD.ground - run.player.height;
  const left = WORLD.playerX - PLAYER_HALF_WIDTH;
  const right = WORLD.playerX + PLAYER_HALF_WIDTH;
  run.obstacles = run.obstacles.filter(obstacle => {
    if (obstacle.x + obstacle.width < -40) return false;
    const bottom = obstacle.y ?? WORLD.ground;
    const inset = obstacle.kind === 'moth' ? 6 : 3;
    const touching = right > obstacle.x + inset && left < obstacle.x + obstacle.width - inset &&
      feetY - 3 > bottom - obstacle.height + 3 && feetY - PLAYER_BODY_HEIGHT < bottom - 3;
    if (!touching) return true;
    // A touched obstacle is removed even during grace, so it cannot hit twice.
    if (run.invulnerable === 0 && run.lives > 0) {
      run.lives -= 1;
      run.invulnerable = HURT_GRACE;
      emit(run, 'hit');
    }
    return false;
  });

  if (run.lives === 0) {
    run.status = 'over';
    updateScore(run);
    return;
  }

  const bodyY = feetY - 22;
  run.fireflies = run.fireflies.filter(firefly => {
    if (firefly.x < -40) return false;
    if (Math.hypot(firefly.x - WORLD.playerX, firefly.y - bodyY) > 25) return true;
    run._bonusScore += 25;
    run.charge = Math.min(1, run.charge + 0.12);
    emit(run, 'collect', firefly.x, firefly.y);
    return false;
  });
  updateScore(run);
}

/** Advance a run in place; returns the same run for convenient render loops. */
export function stepRun(run, seconds) {
  if (run.status !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return run;
  run._accumulator += Math.min(seconds, MAX_ELAPSED);
  let steps = 0;
  while (run._accumulator + 1e-10 >= TICK && steps < 30) {
    run._accumulator = Math.max(0, run._accumulator - TICK);
    tick(run);
    steps += 1;
    if (run.status === 'over') {
      run._accumulator = 0;
      break;
    }
  }
  return run;
}
