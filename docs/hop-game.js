import { WORLD, createRun, jump, shout, stepRun } from './hop-model.js?v=20261015-hop';

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
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
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
    }
    phase = 'playing';
    overlay.hidden = true;
    hud();
    canvas.focus({ preventScroll: true });
    announce('Off you go! Space to hop. F to make way. P to pause.');
    stop();
    frame = requestAnimationFrame(tick);
  }
  function finish() {
    phase = 'over';
    stop();
    saveBest();
    card('A noble little tumble.', `${Math.floor(run.distance / 10)} m · ${flies} fireflies · ${run.score} points. The desert requests an encore.`, 'One more hop');
    hud();
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
      if (event.type === 'hit') announce(`${run.lives} ${run.lives === 1 ? 'heart' : 'hearts'} left. A little dust, a little dignity.`);
      if (!motion.matches) effects.push({ ...event, born: run.time });
    }
    effects = effects.filter(effect => run.time - effect.born < .65).slice(-50);
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
      ? { sky: '#fdf6e3', far: '#e5d8b6', near: '#cbbf99', ground: '#eee8d5', line: '#928a69', ink: '#586e75', glow: '#976300' }
      : { sky: '#002b36', far: '#073642', near: '#16454b', ground: '#07313b', line: '#416266', ink: '#a4b0ad', glow: '#f7cf72' };
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / WORLD.height, 0, 0);
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, width, WORLD.height);
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
    for (const rock of run.obstacles) {
      if (rock.x > width + 50) continue;
      const { x, height: h, width: w } = rock;
      ctx.fillStyle = '#c34a70';
      ctx.beginPath();
      ctx.moveTo(x, WORLD.ground);
      ctx.lineTo(x + w * .12, WORLD.ground - h * .63);
      ctx.lineTo(x + w * .52, WORLD.ground - h);
      ctx.lineTo(x + w * .9, WORLD.ground - h * .7);
      ctx.lineTo(x + w, WORLD.ground);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ef9b8d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + w * .52, WORLD.ground - h + 3); ctx.lineTo(x + w * .35, WORLD.ground - h * .45); ctx.stroke();
    }
    for (const fly of run.fireflies) {
      if (fly.x > width + 20) continue;
      const bob = motion.matches ? 0 : Math.sin(run.time * 5 + fly.id) * 2;
      ellipse(fly.x - 4, fly.y - 3 + bob, 4, 2.5, light ? '#d4bd86' : '#61745d');
      ellipse(fly.x + 4, fly.y - 3 + bob, 4, 2.5, light ? '#d4bd86' : '#61745d');
      ellipse(fly.x, fly.y + bob, 3.5, 4.5, palette.glow);
    }
    const feet = WORLD.ground - run.player.height;
    ellipse(WORLD.playerX, WORLD.ground + 2, 28 - run.player.height * .1, 4, light ? '#c6bea5' : '#00252f');
    if (assets) {
      let pose = 0;
      if (run.player.height > 0) pose = Math.min(12, Math.max(3, 3 + Math.floor((540 - run.player.velocity) / 108)));
      // The jump atlas follows takeoff, extension, descent, and landing.
      else if (phase === 'playing' && !motion.matches) pose = [0, 1, 0, 2][Math.floor(run.time * 6) % 4];
      const [sx, sy, sw, sh] = assets.frames[pose];
      const scale = 73 / assets.maxHeight;
      ctx.save();
      if (run.invulnerable > 0) ctx.globalAlpha = .68;
      ctx.drawImage(assets.image, sx, sy, sw, sh, WORLD.playerX - sw * scale / 2, feet - sh * scale, sw * scale, sh * scale);
      ctx.restore();
      if (run.invulnerable > 0) {
        ctx.strokeStyle = palette.glow; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(WORLD.playerX, feet - 32, 44, 45, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const effect of effects) {
      const t = (run.time - effect.born) / .65;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      if (effect.type === 'shout') {
        ctx.strokeStyle = '#42b5a9'; ctx.lineWidth = 4 * (1 - t) + 1;
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath(); ctx.arc(effect.x + 23, effect.y, 24 + t * 190 + i * 22, -.7, .7); ctx.stroke();
        }
        ctx.fillStyle = palette.glow; ctx.font = 'bold 17px monospace';
        ctx.fillText('MAKE WAY!', effect.x + 35, effect.y - 62 - t * 12);
      } else {
        ctx.fillStyle = effect.type === 'collect' ? palette.glow : effect.type === 'clear' ? '#ef9b8d' : palette.ink;
        for (let i = 0; i < 5; i += 1) {
          const angle = -Math.PI + i * Math.PI / 4;
          ctx.fillRect(effect.x + Math.cos(angle) * t * 42, effect.y + Math.sin(angle) * t * 38 + t * t * 22, 3, 3);
        }
      }
      ctx.restore();
    }
    ctx.fillStyle = palette.ink; ctx.font = '10px monospace';
    ctx.fillText('SPEA / NIGHT SHIFT', 18, 321);
  }
  function loadAssets() {
    if (assets) return Promise.resolve(assets);
    if (!assetPromise) {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Toad image unavailable'));
        image.src = new URL('./assets/companion/hop.png', import.meta.url).href;
      });
      assetPromise = Promise.all([
        loaded,
        fetch(new URL('./assets/companion/frames.json', import.meta.url)).then(response => {
          if (!response.ok) throw new Error('Toad frames unavailable');
          return response.json();
        }),
      ]).then(([image, metadata]) => {
        assets = { image, frames: metadata.hop.frames, maxHeight: Math.max(...metadata.hop.frames.map(f => f[3])) };
        return assets;
      }).catch(error => { assetPromise = null; throw error; });
    }
    return assetPromise;
  }
  async function prepare() {
    const ticket = ++generation;
    phase = 'loading';
    start.disabled = true;
    card('A very small adventure.', 'Hop over rocks. Catch fireflies. Make a little noise.', 'Waking up…');
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
      returnFocus = document.activeElement;
      run = createRun();
      flies = 0;
      effects = [];
      dialog.showModal();
      document.body.classList.add('hop-open');
      prepare();
    },
  };
}
