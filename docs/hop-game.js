import { WORLD, createRun, jump, shout, stepRun } from './hop-model.js?v=20261016-hop-v2';

import { createHopAudio } from './hop-audio.js?v=20261016-hop-v2';

const BEST_KEY = 'kmn-hop-best-v1';
let game;

export function openHopGame() {
  game ??= createGame();
  game.open();
}

function createGame() {
  const el = id => document.getElementById(`hop-${id}`);
  const dialog = el('dialog');
  const canvas = el('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const overlay = el('overlay');
  const start = el('start');
  const hopButton = el('jump');
  const shoutButton = el('shout');
  const pauseButton = el('pause');
  const sound = createHopAudio();
  const soundButton = el('sound');
  const stageNames = ['Quiet dunes', 'Tumbleweed country', 'Moth hour'];
  let lastShout = -10;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let phase = 'ready';
  let run = createRun();
  let flies = 0;
  let best = 0;
  let frame = 0;
  let last = 0;
  let width = WORLD.width;
  let assets;
  let assetPromise;
  let generation = 0;
  let returnFocus;
  let effects = [];
  try {
    const saved = Number(localStorage.getItem(BEST_KEY));
    if (Number.isFinite(saved)) best = Math.max(0, Math.min(1e9, Math.floor(saved)));
  } catch (_) { /* Private browsing can disable local storage. */ }

  function text(id, value) {
    const node = el(id);
    const next = String(value);
    if (node.textContent !== next) node.textContent = next;
  }
  function announce(message) { text('status', message); }
  function saveBest() {
    if (run.score <= best) return;
    best = run.score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (_) { /* Optional. */ }
  }
  function hud() {
    text('stage', stageNames[run.stage]);
    text('pace', `${(run.speed / 210).toFixed(1)}×`);
    text('score', run.score);
    text('fireflies', flies);
    text('best', Math.max(best, run.score));
    text('hearts', Array.from({ length: 3 }, (_, i) => i < run.lives ? '♥' : '♡').join(' '));
    el('hearts').setAttribute('aria-label', `${run.lives} ${run.lives === 1 ? 'heart' : 'hearts'} remaining`);
    el('charge-fill').style.width = `${run.charge * 100}%`;
    shoutButton.setAttribute('aria-disabled', String(phase !== 'playing' || run.charge < 1 - 1e-9));
    hopButton.disabled = phase !== 'playing';
    shoutButton.disabled = phase !== 'playing';
    pauseButton.hidden = phase !== 'playing' && phase !== 'paused';
    const pauseLabel = phase === 'paused' ? 'resume <kbd>P</kbd>' : 'pause <kbd>P</kbd>';
    if (pauseButton.innerHTML !== pauseLabel) pauseButton.innerHTML = pauseLabel;
  }
  function card(title, copy, action) {
    text('card-title', title);
    text('card-copy', copy);
    start.textContent = action;
    overlay.hidden = false;
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; sound.halt(); }
  function pause() {
    if (phase !== 'playing') return;
    phase = 'paused';
    stop();
    card('A small breather.', 'The rocks are happy to wait.', 'Keep hopping');
    hud();
    draw();
    announce('Paused. Choose Keep hopping to resume.');
  }
  function begin() {
    if (!assets || phase === 'loading') return;
    if (phase !== 'paused') {
      saveBest();
      run = createRun(Date.now());
      flies = 0;
      effects = [];
      lastShout = -10;
    }
    phase = 'playing';
    overlay.hidden = true;
    hud();
    canvas.focus({ preventScroll: true });
    announce('Off you go! Space to hop. F to make way. P to pause.');
    stop();
    sound.resume();
    frame = requestAnimationFrame(tick);
  }
  function finish() {
    phase = 'over';
    stop();
    saveBest();
    card('A noble little tumble.', `${Math.floor(run.distance / 10)} m · ${flies} fireflies · ${run.score} points. The desert requests an encore.`, 'One more hop');
    hud();
    draw();
    announce(`Run finished. ${run.score} points and ${flies} fireflies. Choose One more hop to try again.`);
    start.focus({ preventScroll: true });
  }
  function action(kind) {
    if (phase !== 'playing') return;
    if (kind === 'jump') jump(run);
    else shout(run);
  }
  function consumeEvents() {
    for (const event of run.events.splice(0)) {
      if (event.type === 'collect') flies += 1;
      if (event.type === 'shout') lastShout = run.time;
      sound.play(event.type);
      if (event.type === 'stage') announce(event.stage === 1 ? 'Tumbleweeds rolling in. Hop or blast them!' : 'Moth hour. Stay low to pass beneath them.');
      if (event.type === 'hit') announce(`${run.lives} ${run.lives === 1 ? 'heart' : 'hearts'} left. A little dust, a little dignity.`);
      if (!motion.matches) effects.push({ ...event, born: run.time });
    }
    effects = effects.filter(effect => run.time - effect.born < (effect.type === 'stage' ? 2.5 : effect.type === 'clear' ? 1.2 : .8)).slice(-50);
  }
  function tick(now) {
    frame = 0;
    if (phase !== 'playing' || !dialog.open) return;
    const elapsed = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    stepRun(run, elapsed);
    consumeEvents();
    hud();
    draw();
    if (run.status === 'over') finish();
    else frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (!dialog.open) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = WORLD.height * rect.width / rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    draw();
  }
  function ellipse(x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function draw() {
    const light = document.documentElement.dataset.theme === 'light';
    const palette = light
      ? { sky: '#fdf6e3', far: '#e5d8b6', near: '#cbbf99', ground: '#eee8d5', line: '#928a69', ink: '#586e75', glow: '#976300', blast: '#08746e' }
      : { sky: '#002b36', far: '#073642', near: '#16454b', ground: '#07313b', line: '#416266', ink: '#a4b0ad', glow: '#f7cf72', blast: '#64d5c7' };
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / WORLD.height, 0, 0);
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, width, WORLD.height);
    ctx.save();
    const shoutAge = run.time - lastShout;
    if (!motion.matches && shoutAge < .2) ctx.translate(Math.sin(shoutAge * 110) * 2.5 * (1 - shoutAge / .2), Math.cos(shoutAge * 90) * 1.5);
    const drift = motion.matches ? 0 : run.distance * .07;
    // Small desert, large sky. Background motion is decorative and optional.
    ellipse(width - 94, 62, 24, 24, light ? '#d1ac52' : '#d6d0ad');
    if (!light) ellipse(width - 83, 54, 23, 23, palette.sky);
    for (let i = 0; i < 16; i += 1) {
      if (!light) ellipse((i * 113 + 47) % width, 25 + ((i * 67) % 100), 1.2, 1.2, '#52757b');
    }
    for (let layer = 0; layer < 2; layer += 1) {
      ctx.fillStyle = layer ? palette.near : palette.far;
      ctx.beginPath();
      ctx.moveTo(0, WORLD.ground);
      for (let x = 0; x <= width + 8; x += 8) {
        const y = (layer ? 224 : 191) + Math.sin((x + drift * (layer + 1)) / (layer ? 113 : 177)) * (layer ? 18 : 25);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, WORLD.ground);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, WORLD.ground, width, WORLD.height - WORLD.ground);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, WORLD.ground); ctx.lineTo(width, WORLD.ground); ctx.stroke();
    const groundDrift = motion.matches ? 0 : run.distance;
    ctx.fillStyle = palette.line;
    for (let i = 0; i < 28; i += 1) {
      const x = ((i * 71 - groundDrift) % (width + 80) + width + 80) % (width + 80) - 40;
      ctx.fillRect(x, 281 + (i * 17) % 39, i % 3 ? 5 : 12, 1);
    }
    for (const obstacle of run.obstacles) {
      if (obstacle.x > width + 60) continue;
      drawObstacle(obstacle.kind, obstacle.x + obstacle.width / 2, (obstacle.y ?? WORLD.ground) - obstacle.height / 2,
        obstacle.width, obstacle.height, motion.matches ? 0 : obstacle.phase, false);
    }
    for (const fly of run.fireflies) {
      if (fly.x > width + 25) continue;
      const pose = motion.matches ? 0 : Math.floor(run.time * 12 + fly.id) % 4;
      const [sx, sy, sw, sh] = assets?.hazards.frames[12 + pose] ?? [0, 0, 1, 1];
      const scale = assets ? 21 / assets.fireflyHeight : 1;
      if (assets) ctx.drawImage(assets.hazards.image, sx, sy, sw, sh, fly.x - sw * scale / 2, fly.y + 7 - sh * scale, sw * scale, sh * scale);
    }
    if (run.blast) drawBlast(run.blast, palette);
    const feet = WORLD.ground - run.player.height;
    ellipse(WORLD.playerX, WORLD.ground + 2, 28 - run.player.height * .1, 4, light ? '#c6bea5' : '#00252f');
    if (assets) {
      const active = phase === 'playing' || phase === 'paused';
      let pose = 0, atlas = assets.hop;
      // The jump atlas follows takeoff, extension, descent, and landing.
      if (active && run.player.height > 0) pose = Math.min(12, Math.max(3, 3 + Math.floor((540 - run.player.velocity) / 108)));
      else if (active && !motion.matches) {
        // Real leg poses follow distance, so pausing holds exactly this stride.
        atlas = assets.walk;
        pose = Math.floor(run.distance / 14) % 16;
      }
      const roaring = active && !motion.matches && shoutAge >= 0 && shoutAge < .72;
      if (roaring) {
        atlas = assets.croak;
        pose = shoutAge < .08 ? 4 + Math.floor(shoutAge / .02) : shoutAge < .4 ? 8 + Math.floor((shoutAge - .08) / .08) : Math.min(15, 12 + Math.floor((shoutAge - .4) / .08));
      }
      const [sx, sy, sw, sh] = atlas.frames[pose];
      const scale = atlas === assets.walk ? assets.walkScale : 73 / atlas.maxHeight;
      ctx.save();
      if (run.invulnerable > 0) ctx.globalAlpha = .68;
      ctx.drawImage(atlas.image, sx, sy, sw, sh, WORLD.playerX - sw * scale / 2, feet - sh * scale, sw * scale, sh * scale);
      ctx.restore();
      if (run.invulnerable > 0) {
        ctx.strokeStyle = palette.glow; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(WORLD.playerX, feet - 32, 44, 45, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const effect of effects) {
      const age = run.time - effect.born;
      ctx.save();
      if (effect.type === 'clear') {
        ctx.globalAlpha = Math.max(0, Math.min(1, (1.2 - age) / .4));
        drawObstacle(effect.kind, effect.x + effect.vx * age, effect.y + effect.vy * age + 240 * age * age,
          effect.width, effect.height, effect.angle + age * 7, true);
        ctx.fillStyle = palette.glow; ctx.font = 'bold 13px monospace';
        ctx.fillText('+15', effect.x, effect.y - 14 - age * 35);
      } else if (effect.type === 'shout') {
        ctx.globalAlpha = Math.max(0, 1 - age / .8);
        ctx.fillStyle = palette.glow; ctx.font = 'bold 23px monospace';
        ctx.fillText('MAKE WAY!', effect.x + 18, Math.max(30, effect.y - 80) - age * 12);
      } else if (effect.type === 'stage') {
        ctx.globalAlpha = Math.min(1, age * 5, (2.5 - age) * 2);
        ctx.textAlign = 'center'; ctx.fillStyle = palette.glow; ctx.font = 'bold 17px monospace';
        ctx.fillText(stageNames[effect.stage], width / 2, 42);
        ctx.font = '11px monospace';
        ctx.fillText(effect.stage === 1 ? 'watch the rolling brush' : 'stay low for the high flyers', width / 2, 61);
      } else {
        const t = Math.min(1, age / .6);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = effect.type === 'collect' ? palette.glow : palette.ink;
        for (let i = 0; i < 5; i += 1) {
          const angle = -Math.PI + i * Math.PI / 4;
          ctx.fillRect(effect.x + Math.cos(angle) * t * 42, effect.y + Math.sin(angle) * t * 38 + t * t * 22, 3, 3);
        }
      }
      ctx.restore();
    }
    ctx.fillStyle = palette.ink; ctx.font = '10px monospace';
    ctx.fillText('SPEA / NIGHT SHIFT', 18, 321);
    ctx.restore();
  }
  function drawObstacle(kind, x, y, w, h, phase = 0, launched = false) {
    if (!assets) return;
    const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let pose = Math.floor(cycle / (Math.PI * 2) * 4);
    if (kind === 'tumbleweed') pose += 4;
    if (kind === 'moth') pose = 8 + [0, 1, 2, 3, 2, 1][Math.floor(cycle / (Math.PI * 2) * 6)];
    const [sx, sy, sw, sh] = assets.hazards.frames[pose];
    ctx.save(); ctx.translate(x, y);
    if (launched) ctx.rotate(phase);
    if (kind === 'moth') {
      const scale = 49 / assets.mothHeight;
      ctx.drawImage(assets.hazards.image, sx, sy, sw, sh, -sw * scale / 2, h / 2 - sh * scale, sw * scale, sh * scale);
    } else {
      ctx.drawImage(assets.hazards.image, sx, sy, sw, sh, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
    }
    ctx.restore();
  }
  function drawBlast(blast, palette) {
    ctx.save();
    const strength = Math.max(.15, 1 - blast.age / .8);
    const radius = motion.matches ? 80 : 45 + blast.age * 105;
    ctx.strokeStyle = palette.blast; ctx.lineWidth = motion.matches ? 3 : 4;
    ctx.globalAlpha = strength;
    ctx.beginPath();
    ctx.moveTo(blast.x - 15, blast.y - radius);
    ctx.bezierCurveTo(blast.x + 38, blast.y - radius * .5, blast.x + 38, blast.y + radius * .5, blast.x - 15, blast.y + radius);
    ctx.stroke();
    if (!motion.matches) {
      ctx.lineWidth = 1.5; ctx.strokeStyle = palette.glow;
      for (let i = 0; i < 7; i += 1) {
        const spread = (i - 3) / 3;
        const tip = blast.x - 12 - Math.abs(spread) * 14;
        ctx.globalAlpha = strength * .5;
        ctx.beginPath(); ctx.moveTo(Math.max(blast.originX + 28, tip - 80 - i * 7), blast.y + spread * radius * .7);
        ctx.lineTo(tip, blast.y + spread * radius * .85); ctx.stroke();
      }
      ctx.globalAlpha = strength * .06;
      ctx.fillStyle = '#b5fff2'; ctx.beginPath(); ctx.moveTo(blast.originX + 20, blast.y);
      ctx.lineTo(blast.x, blast.y - radius); ctx.lineTo(blast.x + 25, blast.y); ctx.lineTo(blast.x, blast.y + radius); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function loadAssets() {
    if (assets) return Promise.resolve(assets);
    if (!assetPromise) {
      const imageAt = path => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Game artwork unavailable'));
        image.src = new URL(path, import.meta.url).href;
      });
      const metadataAt = path => fetch(new URL(path, import.meta.url)).then(response => {
        if (!response.ok) throw new Error('Game frames unavailable');
        return response.json();
      });
      assetPromise = Promise.all([
        imageAt('./assets/companion/hop.png'), imageAt('./assets/game/croak-v2.png'), imageAt('./assets/game/hazards-v2.png'),
        imageAt('./assets/game/walk-v3.png'),
        metadataAt('./assets/companion/frames.json'), metadataAt('./assets/game/frames-v3.json'),
      ]).then(([hop, croak, hazards, walk, original, generated]) => {
        const atlas = (image, data) => ({ image, frames: data.frames, maxHeight: Math.max(...data.frames.map(f => f[3])) });
        const hopAtlas = atlas(hop, original.hop), walkAtlas = atlas(walk, generated.walk);
        assets = { hop: hopAtlas, walk: walkAtlas, croak: atlas(croak, generated.croak), hazards: atlas(hazards, generated.hazards),
          walkScale: hopAtlas.frames[0][3] * 73 / hopAtlas.maxHeight / walkAtlas.frames[0][3],
          mothHeight: Math.max(...generated.hazards.frames.slice(8, 12).map(f => f[3])),
          fireflyHeight: Math.max(...generated.hazards.frames.slice(12, 16).map(f => f[3])) };
        return assets;
      }).catch(error => { assetPromise = null; throw error; });
    }
    return assetPromise;
  }
  async function prepare() {
    const ticket = ++generation;
    phase = 'loading';
    start.disabled = true;
    card('A very small adventure.', 'Hop rocks and rolling tumbleweeds. Run under moths. Send them all flying.', 'Waking up…');
    hud();
    resize();
    try {
      await loadAssets();
      if (!dialog.open || ticket !== generation) return;
      phase = 'ready';
      start.disabled = false;
      start.textContent = 'Let’s hop';
      announce('Ready when you are. Choose Let’s hop to begin.');
      draw();
      start.focus({ preventScroll: true });
    } catch (_) {
      if (!dialog.open || ticket !== generation) return;
      phase = 'error';
      start.disabled = false;
      card('The toad is still waking up.', 'The artwork didn’t load. Give it another try.', 'Try again');
      announce('Artwork unavailable. Choose Try again to reload it.');
    }
  }
  soundButton.addEventListener('click', async () => {
    soundButton.disabled = true;
    try {
      const enabled = await sound.toggle();
      soundButton.textContent = enabled ? 'sound on' : 'sound off';
      soundButton.setAttribute('aria-pressed', String(enabled));
      if (enabled && dialog.open) sound.play('collect');
    } finally { soundButton.disabled = false; }
  });
  start.addEventListener('click', () => phase === 'error' ? prepare() : begin());
  hopButton.addEventListener('click', () => action('jump'));
  shoutButton.addEventListener('click', () => action('shout'));
  pauseButton.addEventListener('click', () => phase === 'paused' ? begin() : pause());
  el('close').addEventListener('click', () => dialog.close());
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    action('jump');
  });
  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    // Space/Enter on a real button retains normal keyboard activation.
    if (event.target.closest('button') && (key === ' ' || key === 'enter')) return;
    if (![' ', 'arrowup', 'f', 'p'].includes(key)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (key === ' ' || key === 'arrowup') {
      action('jump');
    } else if (key === 'f') {
      action('shout');
    } else if (key === 'p') {
      if (phase === 'paused') begin(); else pause();
    }
  });
  dialog.addEventListener('close', () => {
    generation += 1;
    stop();
    saveBest();
    phase = 'ready';
    effects = [];
    document.body.classList.remove('hop-open');
    returnFocus?.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  window.addEventListener('pagehide', pause);
  new ResizeObserver(resize).observe(canvas);
  motion.addEventListener('change', () => { effects = []; if (dialog.open) draw(); });
  return {
    open() {
      if (dialog.open) return;
      returnFocus = document.activeElement === document.body ? document.getElementById('companion-secret') : document.activeElement;
      run = createRun();
      lastShout = -10;
      flies = 0;
      effects = [];
      dialog.showModal();
      document.body.classList.add('hop-open');
      prepare();
    },
  };
}
