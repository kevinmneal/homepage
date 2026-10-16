/**
 * Small, one-shot illustrations. The maps, policy and token sequence are
 * schematic; the packing polygons reproduce the homepage's six-triangle figure.
 * Character art is exclusively the four-pose transparent ImageGen atlas.
 */
const WIDTH = 640;
const HEIGHT = 260;
const DURATION = 7600;
const ATLAS_URL = new URL('./assets/spadefoot-poses.png', import.meta.url);
const PALETTES = {
  dark: { ink: '#93a1a1', muted: '#657b83', faint: '#254b54', paper: '#073642', page: '#002b36', green: '#859900', blue: '#268bd2', cyan: '#2aa198', gold: '#b58900', orange: '#cb4b16' },
  light: { ink: '#586e75', muted: '#839496', faint: '#d3cdb9', paper: '#eee8d5', page: '#fdf6e3', green: '#738500', blue: '#268bd2', cyan: '#238b83', gold: '#a67c00', orange: '#cb4b16' },
};
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a, b, n) => a + (b - a) * n;
const phase = (time, start, end) => clamp((time - start) / (end - start));

let atlasPromise;
function loadAtlas() {
  if (!atlasPromise) {
    atlasPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const cell = image.naturalWidth / 2;
        // Ground contact differs between poses. Keep a common scale and anchor
        // at each pose's feet instead of resizing every silhouette independently.
        const baselines = [568, 568, 492, 499].map(y => y * cell / 627);
        resolve({ image, cell, baselines });
      };
      image.onerror = () => reject(new Error('The spadefoot illustration could not be loaded.'));
      image.src = ATLAS_URL.href;
    });
  }
  return atlasPromise;
}

function line(ctx, points, color, width = 1.5) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function polygon(ctx, points, fill, stroke, width = 1.5) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function alpha(ctx, value, draw) {
  ctx.save();
  ctx.globalAlpha *= value;
  draw();
  ctx.restore();
}

function label(ctx, text, x, y, color, size = 10) {
  ctx.fillStyle = color;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(text, x, y);
}

function toad(ctx, atlas, pose, x, ground = 220, hop = 0) {
  if (!atlas) return;
  const { image, cell, baselines } = atlas;
  const scale = 0.3 * 627 / cell;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // The extra transparent margin is intentional: all four cells share a body
  // anchor, while the reaching arm is allowed to extend beyond that anchor.
  ctx.drawImage(image, (pose % 2) * cell, Math.floor(pose / 2) * cell, cell, cell,
    Math.round(x - cell * scale / 2), Math.round(ground - baselines[pose] * scale - hop),
    cell * scale, cell * scale);
  ctx.restore();
}

function ground(ctx, p, x = 166, width = 141) {
  alpha(ctx, 0.45, () => {
    ctx.fillStyle = p.faint;
    ctx.fillRect(Math.round(x - width / 2), 220, width, 3);
    ctx.fillRect(Math.round(x - width / 2 + 12), 223, width - 24, 2);
  });
  line(ctx, [[90, 226], [554, 226]], p.faint, 1);
}

function paper(ctx, p, x, y) {
  polygon(ctx, [[x, y], [x + 148, y], [x + 163, y + 69], [x - 15, y + 69]], p.paper, p.muted);
  line(ctx, [[x + 13, y + 15], [x + 95, y + 15]], p.muted, 3);
  for (let n = 0; n < 3; n++) line(ctx, [[x + 11, y + 25 + n * 8], [x + 109 - n * 13, y + 25 + n * 8]], p.faint, 2);
  label(ctx, 'POLICY', x + 99, y + 14, p.muted, 9);
}

function stamp(ctx, p, x, y, tilt = 0) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(tilt);
  ctx.fillStyle = p.gold;
  ctx.fillRect(-8, -21, 16, 7);
  ctx.fillRect(-5, -15, 10, 17);
  ctx.fillStyle = p.ink;
  ctx.fillRect(-15, 0, 30, 7);
  ctx.fillStyle = p.page;
  ctx.fillRect(-13, 6, 26, 3);
  ctx.restore();
}

function insurance(ctx, t, p, atlas) {
  const approach = smooth(phase(t, 0.35, 1.35));
  const x = mix(168, 201, approach);
  const hop = t > 0.35 && t < 1.35 ? Math.sin(phase(t, 0.35, 1.35) * Math.PI) * 11 : 0;
  ground(ctx, p, x);
  // A quiet stack of generic documents; no employer systems or real records.
  for (let n = 2; n >= 0; n--) {
    ctx.fillStyle = p.paper;
    ctx.fillRect(442 + n * 3, 157 - n * 5, 72, 51);
    ctx.strokeStyle = p.faint;
    ctx.strokeRect(442 + n * 3, 157 - n * 5, 72, 51);
  }
  const paperX = mix(326, 249, ease(phase(t, 0.5, 1.7)));
  paper(ctx, p, paperX, 148);
  const inspect = t >= 1.4 && t < 2.55;
  const pressing = t >= 3.42 && t < 4.1;
  const reaching = t >= 2.55 && t < 3.42;
  const pose = inspect ? 2 : pressing ? 3 : reaching ? 1 : 0;
  toad(ctx, atlas, pose, x, 218, hop);
  if (t >= 2.55 && t < 4.9) {
    const drop = smooth(phase(t, 3.05, 3.48));
    const lift = smooth(phase(t, 3.85, 4.45));
    const sx = mix(x + 74, x + 64, drop);
    const sy = mix(165, 207, drop) - lift * 34;
    alpha(ctx, 1 - phase(t, 4.3, 4.9), () => stamp(ctx, p, sx, sy, (1 - drop) * -0.12));
  }
  if (t >= 3.5) {
    alpha(ctx, ease(phase(t, 3.5, 3.7)), () => {
      ctx.strokeStyle = p.cyan;
      ctx.lineWidth = 2;
      ctx.strokeRect(paperX + 8, 195, 29, 16);
      line(ctx, [[paperX + 16, 203], [paperX + 21, 207], [paperX + 30, 198]], p.cyan, 2);
    });
  }
  // A second check appears on the finished stack after the stamp is clear.
  if (t > 4.6) {
    const complete = ease(phase(t, 4.6, 5.5));
    alpha(ctx, complete, () => {
      line(ctx, [[454, 174], [461, 181], [475, 165]], p.cyan, 2.5);
      line(ctx, [[454, 191], [496, 191]], p.faint, 2);
    });
  }
}

const PACKING_POLYGONS = [
  [[55,406],[185,406],[120,293.41670]],
  [[312.02062,406],[442.02062,406],[377.02062,293.41670]],
  [[183.51031,183.41361],[313.51031,183.41361],[248.51031,70.83031]],
  [[173.67010,313.04065],[290.85052,256.749],[183.51031,183.41361]],
  [[185,406],[313.51031,386.37604],[232.26031,284.89483]],
  [[232.26031,284.89483],[313.51031,386.37604],[360.77062,265.27087]],
].map(poly => poly.map(([x,y]) => [344 + (x - 55) * 0.51, 217 + (y - 406) * 0.51]));
const CENTERS = PACKING_POLYGONS.map(poly => [poly.reduce((n,v) => n+v[0], 0)/3, poly.reduce((n,v) => n+v[1], 0)/3]);

function packing(ctx, t, p, atlas) {
  const active = Math.floor((t - 0.65) / 0.81);
  const local = ((t - 0.65) / 0.81) - active;
  const moving = active >= 0 && active < 6;
  const push = moving ? Math.sin(local * Math.PI) : 0;
  const x = 174 + push * 11;
  ground(ctx, p, x);
  polygon(ctx, [[344,217],[541.38052,217],[442.69026,46.06346]], null, p.faint, 1.5);
  const colors = [p.cyan, p.blue, p.gold, p.cyan, p.blue, p.gold];
  for (let i = 5; i >= 0; i--) {
    const progress = ease(phase(t, 0.65 + i * 0.81, 1.3 + i * 0.81));
    const [cx, cy] = CENTERS[i];
    const start = [278 + (i % 2) * 5, 184 - i * 2];
    const tx = mix(start[0], cx, progress);
    const ty = mix(start[1], cy, progress) - Math.sin(progress * Math.PI) * 55;
    const rotation = (1 - progress) * (i % 2 ? 0.28 : -0.2);
    const points = PACKING_POLYGONS[i].map(([px, py]) => {
      const dx = px - cx, dy = py - cy;
      return [tx + dx * Math.cos(rotation) - dy * Math.sin(rotation), ty + dx * Math.sin(rotation) + dy * Math.cos(rotation)];
    });
    ctx.save();
    ctx.fillStyle = p.paper;
    polygon(ctx, points, p.paper, null);
    alpha(ctx, 0.2, () => polygon(ctx, points, colors[i], null));
    polygon(ctx, points, null, colors[i], 1.7);
    ctx.restore();
  }
  // A short reach coincides with each piece leaving the pile. The finished
  // exact arrangement is then inspected and held, with no infinite loop.
  const pose = moving ? (local < 0.58 ? 1 : 0) : t > 5.6 && t < 6.8 ? 2 : 0;
  toad(ctx, atlas, pose, x, 220, moving ? push * 3 : 0);
  if (t >= 5.5) alpha(ctx, ease(phase(t, 5.5, 6.2)) * 0.6, () => polygon(ctx, [[344,217],[541.38052,217],[442.69026,46.06346]], null, p.ink, 1));
}

const REGION = [[21,22],[67,14],[105,28],[143,16],[187,35],[218,34],[228,67],[211,95],[223,123],[188,136],[145,120],[111,137],[74,121],[42,129],[15,105],[28,76],[8,53]];
const CONTOURS = [
  [[28,92],[50,66],[70,61],[91,39],[118,48],[140,38],[162,59],[193,61],[208,84]],
  [[36,106],[60,83],[84,79],[100,57],[124,65],[140,54],[161,77],[185,76],[202,96]],
  [[57,116],[76,98],[98,96],[111,76],[129,83],[144,72],[161,94],[183,91]],
];
const OCCURRENCES = [[53,89],[75,76],[88,57],[107,68],[128,66],[144,88],[161,79],[177,99],[192,83]];
function translated(points, x, y) { return points.map(([px,py]) => [px+x, py+y]); }
function partialLine(ctx, points, progress, color) {
  const length = (points.length - 1) * clamp(progress);
  const whole = Math.floor(length);
  const drawn = points.slice(0, whole + 1);
  if (whole < points.length - 1) drawn.push([mix(points[whole][0],points[whole+1][0],length-whole), mix(points[whole][1],points[whole+1][1],length-whole)]);
  line(ctx, drawn, color, 1.5);
}

function ecology(ctx, t, p, atlas) {
  const travel = smooth(phase(t, 0.4, 1.45));
  const x = mix(168, 217, travel);
  const hop = t > 0.4 && t < 1.45 ? Math.sin(phase(t,0.4,1.45) * Math.PI) * 12 : 0;
  ground(ctx, p, x);
  const mx = 299, my = 57;
  alpha(ctx, 0.5, () => {
    for (let i=0; i<6; i++) line(ctx, [[mx+i*44,my],[mx+i*44,my+143]], p.faint, 0.7);
    for (let i=0; i<4; i++) line(ctx, [[mx,my+i*46],[mx+234,my+i*46]], p.faint, 0.7);
  });
  polygon(ctx, translated(REGION,mx,my), p.paper, p.faint, 1.5);
  for (let i=0; i<CONTOURS.length; i++) {
    alpha(ctx, 0.62, () => partialLine(ctx, translated(CONTOURS[i],mx,my), ease(phase(t,0.6+i*0.18,2.1+i*0.18)), p.cyan));
  }
  const revealed = phase(t, 1.9, 5.7) * OCCURRENCES.length;
  OCCURRENCES.forEach(([px,py],i) => {
    const show = ease(clamp(revealed-i));
    if (!show) return;
    alpha(ctx, show, () => {
      ctx.fillStyle = p.gold;
      ctx.fillRect(mx+px-2, my+py-2, 5, 5);
      if (revealed-i < 1.2) {
        const radius = 5 + (1-show) * 10;
        ctx.strokeStyle = p.gold;
        ctx.lineWidth = 1;
        ctx.strokeRect(mx+px-radius,my+py-radius,radius*2,radius*2);
      }
    });
  });
  const holding = t > 1.45 && t < 6.5;
  toad(ctx, atlas, holding ? 1 : t >= 6.5 ? 2 : 0, x, 220, hop);
  if (holding) {
    const scan = Math.sin(phase(t,1.45,6.5) * Math.PI) * 7;
    const lx = x + 97 + scan, ly = 135 - scan;
    alpha(ctx, Math.min(phase(t,1.45,1.7),1-phase(t,6.1,6.5)), () => {
      line(ctx, [[x+73,175],[lx-10,ly+12]], p.gold, 5);
      ctx.fillStyle = p.page;
      alpha(ctx, 0.5, () => { ctx.beginPath(); ctx.arc(lx,ly,19,0,Math.PI*2); ctx.fill(); });
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lx,ly,19,0,Math.PI*2); ctx.stroke();
      line(ctx, [[lx-10,ly-5],[lx-5,ly-10]], p.muted, 2);
    });
  }
  label(ctx, 'SCHEMATIC DISTRIBUTION', mx+4, 217, p.muted, 9);
}

const TOKENS = ['a','subtle','signal','appears','across','the','sequence','one','choice','at','a','time'];
const GREEN_TOKENS = new Set([1,2,4,6,7,9,11]);
function watermark(ctx, t, p, atlas) {
  const revealed = Math.min(12, phase(t,0.8,5.6) * 12);
  const whole = Math.floor(revealed);
  const pressing = whole < 12 && revealed - whole > 0.25 && revealed - whole < 0.75;
  ground(ctx, p, 170);
  const pose = t > 0.8 && t < 5.6 ? (pressing ? 3 : 0) : t >= 5.6 && t < 6.8 ? 2 : 0;
  // The tiny keyboard is close enough to the character's front paw to make
  // the token-by-token action legible without a speech bubble or caption joke.
  ctx.fillStyle = p.faint;
  ctx.fillRect(218,214,51,7);
  for (let i=0; i<3; i++) {
    ctx.fillStyle = i === 0 && pressing ? p.cyan : p.muted;
    ctx.fillRect(220+i*16, i === 0 && pressing ? 211 : 208, 12, 5);
  }
  toad(ctx, atlas, pose, 170, 219, 0);
  const tx = 292, ty = 73;
  label(ctx, 'TOKEN SEQUENCE', tx, 54, p.muted, 9);
  TOKENS.forEach((word, i) => {
    const show = ease(clamp(revealed-i));
    const x = tx+(i%4)*65, y = ty+Math.floor(i/4)*34;
    ctx.strokeStyle = p.faint;
    ctx.lineWidth = 1;
    ctx.strokeRect(x,y,59,25);
    if (!show) return;
    const selected = GREEN_TOKENS.has(i);
    alpha(ctx, show, () => {
      if (selected) alpha(ctx,0.19,() => {ctx.fillStyle = p.green;ctx.fillRect(x+1,y+1,57,23);});
      ctx.fillStyle = selected ? p.green : p.ink;
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(word,x+29.5,y+16);
      ctx.textAlign = 'left';
      if (selected) {ctx.fillStyle=p.green;ctx.fillRect(x+48,y+3,5,3);}
    });
  });
  line(ctx, [[tx,215],[tx+252,215]], p.faint, 1);
  let evidence = 0;
  const points = [[tx,214]];
  for (let i=0; i<12; i++) {
    const fraction = clamp(revealed-i);
    if (fraction <= 0) break;
    if (GREEN_TOKENS.has(i)) evidence += fraction;
    points.push([tx+(i+1)*21,214-evidence*4.3]);
  }
  line(ctx, points, p.green, 2);
  if (points.length>1) {
    const last=points.at(-1);
    ctx.fillStyle=p.green;ctx.fillRect(last[0]-2,last[1]-2,4,4);
  }
  label(ctx, 'ACCUMULATING SIGNAL', tx, 237, p.muted, 9);
}

const SCENES = { insurance, packing, ecology, watermark };

/** Create a decorative canvas illustration. Call play only after expansion. */
export function createScene(canvas, kind) {
  if (!SCENES[kind]) throw new Error(`Unknown spadefoot scene: ${kind}`);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A two-dimensional canvas context is required.');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let atlas = null;
  let animation = 0;
  let started = 0;
  let elapsed = 0;
  let destroyed = false;
  let playing = false;
  let pendingPlay = false;

  function reportState() {
    canvas.dispatchEvent(new CustomEvent('scenestate', { detail: { playing } }));
  }

  function draw() {
    if (destroyed) return;
    const p = PALETTES[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'];
    ctx.setTransform(canvas.width / WIDTH,0,0,canvas.height / HEIGHT,0,0);
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    ctx.imageSmoothingEnabled = false;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    SCENES[kind](ctx, elapsed/1000, p, atlas);
  }
  function resize() {
    if (destroyed) return;
    const width = canvas.getBoundingClientRect().width;
    if (width > 0) {
      const dpr = Math.min(window.devicePixelRatio || 1,2);
      canvas.width = Math.max(1,Math.round(width*dpr));
      canvas.height = Math.max(1,Math.round(width*HEIGHT/WIDTH*dpr));
    } else if (!canvas.width || !canvas.height) {
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
    }
    draw();
  }
  function tick(now) {
    if (destroyed || !playing) return;
    elapsed = Math.min(DURATION,now-started);
    draw();
    if (elapsed < DURATION) animation = requestAnimationFrame(tick);
    else { playing=false; animation=0; reportState(); }
  }
  function stop() {
    pendingPlay=false;
    playing=false;
    cancelAnimationFrame(animation);
    animation=0;
    reportState();
  }
  function play() {
    if (destroyed) return;
    stop();
    if (!atlas) { pendingPlay=true; return; }
    elapsed = reducedMotion.matches ? DURATION : 0;
    resize();
    if (reducedMotion.matches) return;
    playing=true;
    reportState();
    started=performance.now();
    animation=requestAnimationFrame(tick);
  }
  function onMotionChange() {
    if (reducedMotion.matches) { stop(); elapsed=DURATION; draw(); }
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  reducedMotion.addEventListener('change',onMotionChange);
  loadAtlas().then(loaded => {
    if (destroyed) return;
    atlas=loaded;
    if (pendingPlay) play();
    else { if (reducedMotion.matches) elapsed=DURATION; resize(); }
  }).catch(error => {
    if (destroyed) return;
    canvas.dispatchEvent(new CustomEvent('sceneerror',{detail:error}));
  });
  resize();
  return {
    play,
    stop,
    redraw: resize,
    destroy() {
      stop();
      destroyed=true;
      resizeObserver.disconnect();
      reducedMotion.removeEventListener('change',onMotionChange);
    },
  };
}
