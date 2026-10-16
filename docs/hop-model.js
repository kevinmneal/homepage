/**
 * MAKE HOP! — deterministic, mutable game state with no browser dependencies.
 *
 * All times are seconds. Player height is feet above the ground; velocity is
 * positive upward. Obstacle x is its left edge, with its base at WORLD.ground.
 * Fireflies and events use screen coordinates. Call jump/shout for input, then
 * stepRun for elapsed time. Drain events with run.events.splice(0); the bounded
 * queue preserves input events until the renderer consumes them.
 *
 * stepRun uses 120 Hz physics and accepts at most 0.25 s per call. Longer pauses
 * are discarded so returning to the tab cannot produce a catch-up death.
 * Properties beginning with _ belong to the simulation, not the renderer.
 */

export const WORLD = Object.freeze({ width: 900, height: 340, ground: 266, playerX: 135 });

const TICK = 1 / 120;
const MAX_ELAPSED = 0.25;
const START_SPEED = 210;
const MAX_SPEED = 340;
const ACCELERATION = 2.2;
const JUMP_VELOCITY = 540;
const GRAVITY = 1500;
const PLAYER_HALF_WIDTH = 14;
const PLAYER_BODY_HEIGHT = 36;
const MAX_ROCK_WIDTH = 46;
const MIN_ROCK_GAP = 480;
const HURT_GRACE = 1.2;
const SHOUT_RANGE = 320;
const CHARGE_SECONDS = 5;
const EVENT_LIMIT = 96;

// At maximum speed the widest rock plus the player's width leaves >0.47 s
// between complete jump windows: 480 - 46 - 28 > 340 * (0.72 + 0.47).
// Rocks never move vertically, cluster, or require a midair second jump.

function random(run) {
  let value = run._rng;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  run._rng = value >>> 0;
  return run._rng / 4294967296;
}

function emit(run, type, x = WORLD.playerX, y = WORLD.ground - run.player.height - 22) {
  run.events.push({ type, x, y });
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
    invulnerable: 0,
    status: 'running',
    events: [],
    _rng: integerSeed || 0x5ea12345,
    _accumulator: 0,
    _ticks: 0,
    _nextId: 1,
    _nextObstacleDistance: 0,
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

/** Spend a full charge, clearing rocks up to 320 px ahead for 15 points each. */
export function shout(run) {
  if (run.status !== 'running' || run.charge < 1 - 1e-9) return false;
  run.charge = 0;
  emit(run, 'shout');
  run.obstacles = run.obstacles.filter(rock => {
    const inFront = rock.x + rock.width >= WORLD.playerX - PLAYER_HALF_WIDTH;
    if (!inFront || rock.x > WORLD.playerX + SHOUT_RANGE) return true;
    run._bonusScore += 15;
    emit(run, 'clear', rock.x + rock.width / 2, WORLD.ground - rock.height / 2);
    return false;
  });
  updateScore(run);
  return true;
}

function spawn(run) {
  if (run.distance < run._nextObstacleDistance) return;
  // Subtract threshold overshoot to preserve exact spacing across frame rates.
  const x = WORLD.width + 40 - (run.distance - run._nextObstacleDistance);
  const width = 28 + Math.floor(random(run) * (MAX_ROCK_WIDTH - 28 + 1));
  const height = 30 + Math.floor(random(run) * 27);
  run.obstacles.push({ id: run._nextId++, x, width, height, kind: 'rock' });
  const fireflyY = WORLD.ground - (92 + Math.floor(random(run) * 24));
  for (const offset of [-65, 45]) {
    run.fireflies.push({ id: run._nextId++, x: x + offset, y: fireflyY });
  }
  run._nextObstacleDistance += MIN_ROCK_GAP + random(run) * 200;
}

function tick(run) {
  run._ticks += 1;
  run.time = run._ticks * TICK;
  run.speed = Math.min(MAX_SPEED, START_SPEED + ACCELERATION * run.time);
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

  for (const rock of run.obstacles) rock.x -= movement;
  for (const firefly of run.fireflies) firefly.x -= movement;
  spawn(run);

  const feetY = WORLD.ground - run.player.height;
  const left = WORLD.playerX - PLAYER_HALF_WIDTH;
  const right = WORLD.playerX + PLAYER_HALF_WIDTH;
  run.obstacles = run.obstacles.filter(rock => {
    if (rock.x + rock.width < -40) return false;
    const touching = right > rock.x && left < rock.x + rock.width &&
      feetY - 3 > WORLD.ground - rock.height && feetY - PLAYER_BODY_HEIGHT < WORLD.ground;
    if (!touching) return true;
    // A touched rock is removed even during grace, so it cannot hit twice.
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
