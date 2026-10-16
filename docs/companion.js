// One persistent character beside the content. Research figures remain in HTML.
const WIDTH = 400, HEIGHT = 340;
const ROOT = new URL('./assets/companion/', import.meta.url);
const DURATIONS = { idle: 0, insurance: 7800, ecology: 7000, packing: 8000, watermark: 7800 };
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const phase = (t, start, end) => clamp((t - start) / (end - start));
const atlasCache = new Map();
const reactionCache = new Map();
const REACTION_FILES = { curious: 'curious-v3', happy: 'startle-v3', croak: 'puff-v3' };
let metadataPromise;
let reactionMetadataPromise;

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
function reactionMetadata() {
  reactionMetadataPromise ??= fetch(new URL('reactions-v3.json', ROOT)).then(response => {
    if (!response.ok) throw new Error('Reaction frame metadata unavailable');
    return response.json();
  }).then(data => {
    for (const name of Object.keys(REACTION_FILES)) {
      const atlas = data[name];
      if (!atlas || !Number.isFinite(atlas.width) || !Number.isFinite(atlas.height) ||
          !Array.isArray(atlas.frames) || atlas.frames.length !== 16 ||
          !atlas.frames.every(f => Array.isArray(f) && f.length === 4 && f.every(Number.isFinite) &&
            f[0] >= 0 && f[1] >= 0 && f[2] > 0 && f[3] > 0 && f[0] + f[2] <= atlas.width && f[1] + f[3] <= atlas.height)) {
        throw new Error('Reaction frame metadata invalid');
      }
    }
    return data;
  }).catch(error => { reactionMetadataPromise = undefined; throw error; });
  return reactionMetadataPromise;
}
function loadReaction(name) {
  if (!reactionCache.has(name)) {
    const imagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Reaction artwork unavailable'));
      image.src = new URL(`${REACTION_FILES[name]}.png`, ROOT).href;
    });
    reactionCache.set(name, Promise.all([imagePromise, reactionMetadata()]).then(([image, data]) => ({
      image, frames: data[name].frames,
    })).catch(error => { reactionCache.delete(name); throw error; }));
  }
  return reactionCache.get(name);
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
// Two short typing bursts, a single quick blink, and time to rest.
// Durations are seconds. The last pose holds until the scene finishes.
const TYPING = [
  [0,.65],[1,.24],[2,.24],[3,.24],[4,.24],[5,.24],[6,.24],[7,.24],[8,.65],
  [9,.06],[10,.07],[11,.09],[12,.5],
  [13,.26],[14,.26],[15,.26],[12,.26],[13,.26],[14,.26],[15,.26],
  [12,.26],[13,.26],[14,.26],[15,Infinity],
];
const MAP = [
  [0,.35],[1,.25],[2,.25],[3,.25],[4,.25],[5,.3],
  [6,.3],[7,.3],[8,.35],[9,.35],[10,.35],[11,.55],
  [10,.3],[9,.3],[8,.3],[7,.3],[6,.3],[5,.35],
  [12,.26],[13,.26],[14,.26],[15,Infinity],
];
function timedPose(sequence, time, blink = false) {
  for (let i = 0; i < sequence.length; i++) {
    const [frame, duration] = sequence[i];
    if (time < duration) {
      const next = sequence[i + 1]?.[0] ?? frame;
      const eyeChange = blink && ([9,10,11].includes(frame) || [9,10,11].includes(next));
      const blend = eyeChange || !Number.isFinite(duration) ? 0 : smooth(phase(time, duration - .08, duration));
      return { frame, next, blend };
    }
    time -= duration;
  }
}
function typingScene(ctx, t, p, atlases, finished, drawPose) {
  ground(ctx, p);
  const appearance = smooth(phase(t, 0, 0.55));
  const pose = finished ? { frame: 15, blend: 0 } : timedPose(TYPING, t, true);
  sprite(ctx, atlases.hop, 0, 200, 278, 0.72, 0, 1 - appearance);
  drawPose(atlases.typing, pose, 200, 278, 0.72, appearance);
}
function mapScene(ctx, t, p, atlases, finished, drawPose) {
  ground(ctx, p);
  const appearance = smooth(phase(t, 0, 0.55));
  sprite(ctx, atlases.hop, 0, 200, 278, 0.72, 0, 1 - appearance);
  drawPose(atlases.map, timedPose(MAP, t), 200, 278, 0.72, appearance);
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
function watermarkScene(ctx, t, p, atlases, finished, drawPose) {
  typingScene(ctx, t, p, atlases, finished, drawPose);
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
const REACTIONS = { curious: 1440, happy: 1360, croak: 1520 };

export function createCompanion(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const poseLayer = document.createElement('canvas');
  poseLayer.width = WIDTH; poseLayer.height = HEIGHT;
  const poseCtx = poseLayer.getContext('2d');
  function drawPose(atlas, pose, x, baseline, scale, opacity) {
    if (!pose.blend || !poseCtx) {
      sprite(ctx, atlas, pose.frame, x, baseline, scale, 0, opacity);
      return;
    }
    // Blend on transparency so common pixels stay opaque. Compositing both
    // weighted poses directly onto the scene would create a brightness dip.
    poseCtx.clearRect(0, 0, WIDTH, HEIGHT);
    sprite(poseCtx, atlas, pose.frame, x, baseline, scale, 0, 1 - pose.blend);
    poseCtx.globalCompositeOperation = 'lighter';
    sprite(poseCtx, atlas, pose.next, x, baseline, scale, 0, pose.blend);
    poseCtx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha *= opacity; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(poseLayer, 0, 0); ctx.restore();
  }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const atlases = {};
  const reactionAtlases = {};
  let kind = 'idle', time = 0, playing = false, ready = false, destroyed = false;
  let frameId = 0, startTime = 0, selection = 0;
  let reaction = null, autoplay = true, reactionGeneration = 0, reactionsPreloaded = false;
  function preloadReactions() {
    if (reactionsPreloaded || destroyed) return;
    reactionsPreloaded = true;
    for (const name of Object.keys(REACTIONS)) {
      loadReaction(name).then(atlas => { if (!destroyed) reactionAtlases[name] = atlas; })
        .catch(() => { /* Optional artwork retries when the visitor reacts. */ });
    }
  }
  function report(error = null) {
    canvas.dispatchEvent(new CustomEvent('companionstate', {
      detail: { kind, playing, ready, reducedMotion: motion.matches, reaction: reaction?.kind ?? null, error },
    }));
  }
  function draw() {
    if (destroyed) return;
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = palette();
    if (reaction) {
      // Each atlas contains the actual face/body motion. Keep one scale for the
      // whole sequence, registered against the height of the resting character.
      const progress = clamp(reaction.time / REACTIONS[reaction.kind]);
      const pose = Math.min(15, Math.floor(progress * 16));
      const scale = atlases.hop.frames[0][3] * .72 / reaction.atlas.frames[0][3];
      const lift = reaction.kind === 'happy' ? Math.sin(phase(progress, .2, .8) * Math.PI) * 20 : 0;
      ground(ctx, p);
      sprite(ctx, reaction.atlas, pose, 200, 278 - lift, scale);
    } else if (kind === 'idle' || !ready) {
      ground(ctx, p); sprite(ctx, atlases.hop, 0, 200, 278, 0.72);
    } else PAINT[kind](ctx, time / 1000, p, atlases, time >= DURATIONS[kind], drawPose);
  }
  function resize() {
    const width = canvas.getBoundingClientRect().width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (width > 0) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(width * HEIGHT / WIDTH * dpr); }
    draw();
  }
  function stop() {
    reactionGeneration++;
    playing = false; cancelAnimationFrame(frameId); frameId = 0;
    const wasReacting = Boolean(reaction); reaction = null;
    if (wasReacting) draw();
    report();
  }
  function tick(now) {
    frameId = 0;
    if (destroyed) return;
    if (reaction) {
      if (motion.matches || document.hidden) { stop(); return; }
      reaction.time = Math.max(0, now - reaction.started);
      if (reaction.time >= REACTIONS[reaction.kind]) {
        reaction = null; draw(); report();
      } else {
        draw(); frameId = requestAnimationFrame(tick);
      }
      return;
    }
    if (!playing) return;
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
    stop(); autoplay = true; kind = nextKind; ready = false; time = 0; report(); draw();
    try {
      await Promise.all(REQUIRED[kind].map(async name => {
        atlases[name] ??= await loadAtlas(name);
        if (name === 'hop') preloadReactions();
      }));
      if (destroyed || ticket !== selection) return;
      ready = true; resize();
      if (kind !== 'idle' && autoplay) play(); else report();
    } catch (error) { if (ticket === selection && !destroyed) report(error.message); }
  }
  async function react(nextReaction) {
    if (destroyed || !Object.hasOwn(REACTIONS, nextReaction)) return false;
    // Never let an in-flight project load restart playback after an interaction.
    autoplay = false; stop();
    if (motion.matches || document.hidden) return false;
    const ticket = reactionGeneration;
    try {
      let atlas = reactionAtlases[nextReaction];
      if (!atlas || !atlases.hop) {
        const loaded = await Promise.all([loadAtlas('hop'), loadReaction(nextReaction)]);
        atlases.hop ??= loaded[0]; atlas = loaded[1];
      }
      if (destroyed || ticket !== reactionGeneration || motion.matches || document.hidden) return false;
      reactionAtlases[nextReaction] = atlas;
      reaction = { kind: nextReaction, atlas, started: performance.now(), time: 0 };
      draw(); frameId = requestAnimationFrame(tick); report();
      return true;
    } catch (_) { return false; }
  }
  function onMotionChange() {
    if (motion.matches) { stop(); time = DURATIONS[kind]; draw(); }
    report();
  }
  function pause() { autoplay = false; stop(); }
  function onVisibilityChange() { if (document.hidden) pause(); }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas); motion.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange); select('idle');
  return {
    select, react, replay: play, pause, redraw: resize,
    destroy() {
      stop(); destroyed = true; selection++; observer.disconnect();
      motion.removeEventListener('change', onMotionChange); document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
