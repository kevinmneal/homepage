// One persistent character beside the content. Research figures remain in HTML.
const WIDTH = 400, HEIGHT = 340;
const ROOT = new URL('./assets/companion/', import.meta.url);
const DURATIONS = { idle: 0, insurance: 7800, ecology: 7000, packing: 8000, watermark: 7800 };
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const phase = (t, start, end) => clamp((t - start) / (end - start));
const atlasCache = new Map();
let metadataPromise;

function metadata() {
  metadataPromise ??= fetch(new URL('frames.json', ROOT)).then(response => {
    if (!response.ok) throw new Error('Character frame metadata unavailable');
    return response.json();
  }).catch(error => {
    metadataPromise = undefined;
    throw error;
  });
  return metadataPromise;
}
function loadAtlas(name) {
  if (!atlasCache.has(name)) {
    const imagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Character artwork unavailable'));
      image.src = new URL(`${name}.png`, ROOT).href;
    });
    atlasCache.set(name, Promise.all([imagePromise, metadata()]).then(([image, data]) => ({
      image, frames: data[name].frames,
    })).catch(error => { atlasCache.delete(name); throw error; }));
  }
  return atlasCache.get(name);
}
function palette() {
  return document.documentElement.dataset.theme === 'light'
    ? { line: '#c4bda5', ink: '#586e75', accent: '#08746e', green: '#596900', bg: '#fdf6e3' }
    : { line: '#31535a', ink: '#93a1a1', accent: '#42b5a9', green: '#a0ae36', bg: '#002b36' };
}
function sprite(ctx, atlas, frame, x, baseline, scale, rotation = 0, opacity = 1) {
  if (!atlas || opacity <= 0) return;
  const [sx, sy, sw, sh] = atlas.frames[clamp(Math.floor(frame), 0, 15)];
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.translate(x, baseline);
  ctx.rotate(rotation);
  ctx.imageSmoothingEnabled = false;
  // Runtime source rectangles register the feet without editing the PNG atlas.
  ctx.drawImage(atlas.image, sx, sy, sw, sh, -sw * scale / 2, -sh * scale, sw * scale, sh * scale);
  ctx.restore();
}
function ground(ctx, p) {
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, 281);
  ctx.lineTo(300, 281);
  ctx.stroke();
}
const TYPING = [0,1,2,3,4,5,6,7,8,12,13,14,15,0,1,2,3,4,5,6,7,8,12,13,14,15,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
function typingScene(ctx, t, p, atlases, finished) {
  ground(ctx, p);
  const appearance = smooth(phase(t, 0, 0.32));
  const frame = finished ? 15 : TYPING[Math.floor(Math.max(0, t - 0.3) * 12) % TYPING.length];
  sprite(ctx, atlases.hop, 0, 200, 278, 0.72, 0, 1 - appearance);
  sprite(ctx, atlases.typing, frame, 200, 278, 0.72, 0, appearance);
}
function mapFrame(t) {
  if (t < 1.3) return Math.min(5, Math.floor(t / 1.3 * 6));
  if (t < 5.7) {
    const scan = [6,7,8,9,10,11,10,9,8,7,6,5];
    return scan[Math.floor((t - 1.3) * 9) % scan.length];
  }
  return Math.min(15, 12 + Math.floor((t - 5.7) * 5));
}
function mapScene(ctx, t, p, atlases) {
  ground(ctx, p);
  const appearance = smooth(phase(t, 0, 0.32));
  sprite(ctx, atlases.hop, 0, 200, 278, 0.72, 0, 1 - appearance);
  sprite(ctx, atlases.map, mapFrame(t), 200, 278, 0.72, 0, appearance);
}
const SLOTS = [[200,137],[155,214],[245,214],[116,285],[200,285],[284,285]];
function packingScene(ctx, t, p, atlases, finished) {
  ctx.save();
  ctx.globalAlpha = smooth(phase(t, 0.15, 1.2));
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50,295); ctx.lineTo(350,295); ctx.lineTo(200,35); ctx.closePath(); ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 6; i++) {
    const start = 0.35 + i * 0.94;
    const progress = finished ? 1 : phase(t, start, start + 1.22);
    if (t < start && i > 0 && !finished) continue;
    const [tx, ty] = SLOTS[i];
    const fromX = i === 0 ? 200 : i % 2 ? -48 : 448;
    // Sixteen generated poses accompany smooth flight paths. The main toad
    // shrinks into the first occupant; five smaller toads follow it in.
    const travel = smooth(phase(progress, 0.22, 0.77));
    const x = mix(fromX, tx, travel);
    const y = mix(278, ty, travel) - Math.sin(travel * Math.PI) * (i === 0 ? 52 : 92);
    const scale = i === 0 ? mix(0.72, 0.24, smooth(phase(progress, 0.15, 0.72))) : 0.24;
    const frame = progress >= 1 ? 15 : Math.min(15, Math.floor(progress * 16));
    sprite(ctx, atlases.hop, frame, x, y, scale);
  }
}
const WORDS = ['the', 'model', 'chooses', 'a', 'token', 'next'];
function watermarkScene(ctx, t, p, atlases, finished) {
  typingScene(ctx, t, p, atlases, finished);
  const count = phase(t, 0.8, 5.7) * WORDS.length;
  for (let i = 0; i < WORDS.length; i++) {
    const appear = smooth(clamp(count - i));
    if (!appear) continue;
    const x = 71 + (i % 3) * 91;
    const y = 48 + Math.floor(i / 3) * 31 + (1 - appear) * 8;
    const marked = [1,2,4].includes(i);
    ctx.save(); ctx.globalAlpha = appear;
    ctx.strokeStyle = marked ? p.green : p.line; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 78, 24);
    if (marked) {
      ctx.globalAlpha = appear * 0.1; ctx.fillStyle = p.green;
      ctx.fillRect(x + 1, y + 1, 76, 22); ctx.globalAlpha = appear;
    }
    ctx.fillStyle = marked ? p.green : p.ink;
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center'; ctx.fillText(WORDS[i], x + 39, y + 16); ctx.restore();
  }
}
const PAINT = { insurance: typingScene, ecology: mapScene, packing: packingScene, watermark: watermarkScene };
const REQUIRED = { idle: ['hop'], insurance: ['hop','typing'], ecology: ['hop','map'], packing: ['hop'], watermark: ['hop','typing'] };

export function createCompanion(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const atlases = {};
  let kind = 'idle', time = 0, playing = false, ready = false, destroyed = false;
  let frameId = 0, startTime = 0, selection = 0;
  function report(error = null) {
    canvas.dispatchEvent(new CustomEvent('companionstate', {
      detail: { kind, playing, ready, reducedMotion: motion.matches, error },
    }));
  }
  function draw() {
    if (destroyed) return;
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = palette();
    if (kind === 'idle' || !ready) {
      ground(ctx, p); sprite(ctx, atlases.hop, 0, 200, 278, 0.72);
    } else PAINT[kind](ctx, time / 1000, p, atlases, time >= DURATIONS[kind]);
  }
  function resize() {
    const width = canvas.getBoundingClientRect().width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (width > 0) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(width * HEIGHT / WIDTH * dpr); }
    draw();
  }
  function stop() {
    playing = false; cancelAnimationFrame(frameId); frameId = 0; report();
  }
  function tick(now) {
    if (!playing || destroyed) return;
    time = Math.min(DURATIONS[kind], now - startTime); draw();
    if (time < DURATIONS[kind]) frameId = requestAnimationFrame(tick); else stop();
  }
  function play() {
    if (destroyed || !ready || kind === 'idle') return;
    stop(); time = motion.matches ? DURATIONS[kind] : 0; draw();
    if (motion.matches || document.hidden) { report(); return; }
    playing = true; startTime = performance.now(); frameId = requestAnimationFrame(tick); report();
  }
  async function select(nextKind = 'idle') {
    if (destroyed || !REQUIRED[nextKind]) return;
    const ticket = ++selection;
    stop(); kind = nextKind; ready = false; time = 0; report(); draw();
    try {
      await Promise.all(REQUIRED[kind].map(async name => { atlases[name] ??= await loadAtlas(name); }));
      if (destroyed || ticket !== selection) return;
      ready = true; resize();
      if (kind !== 'idle') play(); else report();
    } catch (error) { if (ticket === selection && !destroyed) report(error.message); }
  }
  function onMotionChange() {
    if (motion.matches) { stop(); time = DURATIONS[kind]; draw(); }
    report();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas); motion.addEventListener('change', onMotionChange); select('idle');
  return {
    select, replay: play, pause: stop, redraw: resize,
    destroy() { stop(); destroyed = true; selection++; observer.disconnect(); motion.removeEventListener('change', onMotionChange); },
  };
}
