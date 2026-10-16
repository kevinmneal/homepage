import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Exercise the real game/controller and model with a small DOM/canvas adapter.
// Browser layout, native dialog behavior, and rendered pixels need browser QA.
const metadata = JSON.parse(fs.readFileSync(new URL('../docs/assets/companion/frames.json', import.meta.url), 'utf8'));
const generated = JSON.parse(fs.readFileSync(new URL('../docs/assets/game/frames-v2.json', import.meta.url), 'utf8'));
const atlasMetadata = { hop: metadata.hop, croak: generated.croak, hazards: generated.hazards };
const html = fs.readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
let fixtureNumber = 0;
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.listeners = new Map();
    this.attributes = {};
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.disabled = false;
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  dispatch(type, values = {}) {
    const event = { type, target: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...values };
    for (const callback of this.listeners.get(type) ?? []) callback(event);
    return event;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  closest(selector) { return selector === 'button' && this.tagName === 'button' ? this : null; }
  focus() { document.activeElement = this; }
}

async function withGame(options, check) {
  const originals = new Map();
  const install = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  let now = 1, nextFrame = 0, fetchCount = 0, imageCount = 0;
  const frames = new Map(), pendingLoads = [], saved = new Map();
  const stats = { sprite: null, labels: [], hazards: [], blasts: [], draws: 0 };
  const elements = new Map([...html.matchAll(/<(\w+)\b[^>]*\bid="hop-([^"]+)"/g)]
    .map(([, tag, id]) => [id, new Element(tag)]));
  const el = id => {
    assert(elements.has(id), `Game element hop-${id} is present in index.html`);
    return elements.get(id);
  };
  const opener = new Element('button');
  const documentMock = new Element();
  const bodyClasses = new Set();
  Object.assign(documentMock, {
    activeElement: opener, hidden: false,
    documentElement: { dataset: { theme: options.light ? 'light' : 'dark' } },
    body: { classList: { add: name => bodyClasses.add(name), remove: name => bodyClasses.delete(name) } },
    getElementById: id => elements.get(id.replace(/^hop-/, '')),
  });
  const windowMock = new Element();
  const motion = new Element();
  motion.matches = !!options.reduced;
  const dialog = el('dialog');
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; el('close').focus(); };
  dialog.close = () => { dialog.open = false; dialog.dispatch('close'); };
  const state = { globalAlpha: 1, x: 0, y: 0 }, stack = [];
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), `${String(key)} coordinate is finite`);
        if (key === 'save') stack.push({ ...state });
        if (key === 'restore') { assert(stack.length > 0, 'Canvas restore has a matching save'); Object.assign(state, stack.pop()); }
        if (key === 'translate') { state.x += args[0]; state.y += args[1]; }
        if (key === 'setTransform') {
          assert.equal(stack.length, 0, 'Each frame restores its drawing state');
          state.x = 0; state.y = 0; stats.labels = []; stats.hazards = []; stats.blasts = []; stats.draws++;
        }
        if (key === 'ellipse') assert(args[2] >= 0 && args[3] >= 0, 'Ellipse radii stay nonnegative');
        if (key === 'arc') assert(args[2] >= 0, 'Arc radius stays nonnegative');
        if (key === 'fillText') stats.labels.push(args[0]);
        if (key === 'bezierCurveTo' && state.strokeStyle === '#64d5c7') stats.blasts.push({ x: args[0] - 38, alpha: state.globalAlpha });
        if (key === 'drawImage') {
          const [image, sx, sy, sw, sh, dx, dy, dw, dh] = args;
          assert.equal(args.length, 9);
          assert(sx >= 0 && sy >= 0 && sw > 0 && sh > 0);
          const source = atlasMetadata[image.atlas];
          assert(source, 'Image has a recognized atlas');
          assert(sx + sw <= source.width && sy + sh <= source.height, 'Sprite uses an in-bounds atlas crop');
          const index = source.frames.findIndex(rect => rect.every((n, i) => n === [sx, sy, sw, sh][i]));
          assert(index >= 0, 'Sprite rectangle matches its own atlas metadata');
          assert(dw > 0 && dh > 0);
          assert(state.globalAlpha >= 0 && state.globalAlpha <= 1, 'Sprite alpha is valid');
          const draw = { atlas: image.atlas, index, feet: state.y + dy + dh, x: state.x + dx, source: [sx, sy, sw, sh] };
          if (image.atlas === 'hazards') stats.hazards.push(draw);
          else stats.sprite = draw;
        }
      };
    },
  });
  const canvas = el('canvas');
  canvas.width = 900; canvas.height = 340;
  canvas.getContext = () => ctx;
  canvas.getBoundingClientRect = () => options.mobile ? { width: 330, height: 220 } : { width: 900, height: 340 };
  install('document', documentMock);
  install('window', windowMock);
  install('matchMedia', () => motion);
  install('devicePixelRatio', 2);
  install('ResizeObserver', class { observe() {} });
  install('requestAnimationFrame', callback => { const id = ++nextFrame; frames.set(id, callback); return id; });
  install('cancelAnimationFrame', id => frames.delete(id));
  install('localStorage', {
    getItem: key => { if (options.storageUnavailable) throw new Error('Unavailable'); return saved.get(key) ?? null; },
    setItem: (key, value) => { if (options.storageUnavailable) throw new Error('Unavailable'); saved.set(key, value); },
  });
  install('Image', class {
    set src(value) {
      const name = new URL(value).pathname.split('/').at(-1);
      this.atlas = { 'hop.png': 'hop', 'croak-v2.png': 'croak', 'hazards-v2.png': 'hazards' }[name];
      assert(this.atlas, `Known image asset: ${name}`);
      const attempt = ++imageCount;
      const fail = (options.failImageOnce && attempt === 1) || (options.failHazardsOnce && attempt === 3);
      queueMicrotask(() => fail ? this.onerror() : this.onload());
    }
  });
  install('fetch', async url => {
    const isOriginal = String(url).endsWith('/assets/companion/frames.json');
    assert(isOriginal || String(url).endsWith('/assets/game/frames-v2.json'));
    const attempt = ++fetchCount;
    if (options.delayed) await new Promise(resolve => pendingLoads.push(resolve));
    return { ok: !((options.failMetadataOnce && attempt === 1) || (options.failGeneratedMetadataOnce && attempt === 2)),
      json: async () => isOriginal ? metadata : generated };
  });
  const advance = milliseconds => {
    for (let remaining = milliseconds; remaining > 0;) {
      const elapsed = Math.min(20, remaining); remaining -= elapsed; now += elapsed;
      const callbacks = [...frames.values()]; frames.clear();
      for (const callback of callbacks) callback(now);
      assert(frames.size <= 1, 'Only one game animation frame is scheduled');
    }
  };
  try {
    const { openHopGame } = await import(`../docs/hop-game.js?fixture=${++fixtureNumber}`);
    await check({ el, opener, dialog, canvas, motion, document: documentMock, window: windowMock,
      frames, stats, saved, bodyClasses, advance, open: openHopGame,
      fetchCount: () => fetchCount,
      imageCount: () => imageCount,
      resolveLoads: async () => { pendingLoads.splice(0).forEach(resolve => resolve()); await flush(); },
      click: id => { if (!el(id).disabled) el(id).dispatch('click'); },
      key: (key, values = {}) => dialog.dispatch('keydown', { key, target: canvas, ...values }),
    });
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test('open, pause, automatic suspension, close, and reopen preserve the expected lifecycle', async () => {
  await withGame({}, async g => {
    g.open(); g.open();
    assert(g.dialog.open && g.bodyClasses.has('hop-open'));
    assert(g.el('start').disabled);
    await flush();
    assert.equal(g.fetchCount(), 2);
    assert.equal(g.imageCount(), 3);
    assert.equal(g.document.activeElement, g.el('start'));
    assert.equal(g.frames.size, 0, 'Ready screen does not run physics');
    g.click('start'); g.advance(1000);
    const scoreBeforeDuplicateOpen = g.el('score').textContent;
    g.open(); await flush();
    assert.equal(g.el('score').textContent, scoreBeforeDuplicateOpen, 'An already-open game keeps its current run');
    assert.equal(g.fetchCount(), 2);
    assert.equal(g.frames.size, 1);
    assert.equal(g.document.activeElement, g.canvas);
    assert(g.el('overlay').hidden);
    assert(Number(g.el('score').textContent) > 0);
    for (const suspend of [
      () => g.click('pause'),
      () => { g.document.hidden = true; g.document.dispatch('visibilitychange'); },
      () => g.window.dispatch('blur'),
      () => g.window.dispatch('pagehide'),
    ]) {
      suspend();
      const score = g.el('score').textContent;
      assert.equal(g.frames.size, 0);
      assert.equal(g.el('start').textContent, 'Keep hopping');
      g.advance(5000);
      assert.equal(g.el('score').textContent, score);
      g.document.hidden = false;
      g.click('start'); g.advance(20);
      assert.equal(g.el('score').textContent, score, 'Resume does not catch up time spent paused');
      assert.equal(g.frames.size, 1);
    }
    g.click('close');
    assert.equal(g.frames.size, 0);
    assert(!g.dialog.open && !g.bodyClasses.has('hop-open'));
    assert.equal(g.document.activeElement, g.opener);
    assert(Number(g.saved.get('kmn-hop-best-v1')) > 0);
    g.open(); await flush();
    assert.equal(g.fetchCount(), 2, 'Reopen reuses both loaded metadata files');
    assert.equal(g.imageCount(), 3, 'Reopen reuses all three images');
    assert.equal(g.el('score').textContent, '0');
    assert.equal(g.frames.size, 0);
  });
});

test('closing during load cannot steal focus, and reopening uses only the current preparation', async () => {
  await withGame({ delayed: true }, async g => {
    g.open(); g.click('close'); await g.resolveLoads();
    assert.equal(g.document.activeElement, g.opener);
    assert.equal(g.frames.size, 0);
    assert(!g.dialog.open);
    g.open(); await flush();
    assert.equal(g.fetchCount(), 2);
    assert.equal(g.document.activeElement, g.el('start'));
    assert(!g.el('start').disabled);
  });
  await withGame({ delayed: true }, async g => {
    g.open(); g.click('close'); g.open(); await g.resolveLoads();
    assert.equal(g.fetchCount(), 2);
    assert.equal(g.document.activeElement, g.el('start'));
    assert.equal(g.frames.size, 0);
    g.click('start'); assert.equal(g.frames.size, 1);
  });
});

test('artwork failures can be retried without starting duplicate loops', async () => {
  for (const failure of ['failMetadataOnce', 'failGeneratedMetadataOnce', 'failImageOnce', 'failHazardsOnce']) {
    await withGame({ [failure]: true }, async g => {
      g.open(); await flush();
      assert.equal(g.el('start').textContent, 'Try again');
      assert(!g.el('start').disabled);
      assert.equal(g.frames.size, 0);
      g.click('start'); await flush();
      assert.equal(g.fetchCount(), 4);
      assert.equal(g.imageCount(), 6);
      assert.equal(g.el('start').textContent, 'Let’s hop');
      g.click('start'); g.advance(100);
      assert.equal(g.frames.size, 1);
    });
  }
});

test('keyboard and pointer controls respect buttons, repeats, modifiers, and reduced motion', async () => {
  await withGame({ mobile: true, light: true, storageUnavailable: true }, async g => {
    g.open(); await flush(); g.click('start'); g.advance(20);
    for (const key of [' ', 'ArrowUp', 'f', 'p']) assert(g.key(key, { repeat: true }).defaultPrevented);
    assert(!g.key(' ', { target: g.el('jump') }).defaultPrevented, 'Button keeps native Space activation');
    assert(!g.key('Enter', { target: g.el('start') }).defaultPrevented);
    assert(!g.key(' ', { ctrlKey: true }).defaultPrevented);
    assert.equal(g.el('stage').textContent, 'Quiet dunes');
    assert.equal(g.el('pace').textContent, '1.0×');
    assert.equal(g.el('shout').attributes['aria-disabled'], 'false', 'Repeated F does not consume the croak');
    assert.equal(g.frames.size, 1, 'Repeated P does not pause');
    g.advance(100);
    assert.equal(g.stats.sprite.feet, 266, 'Repeated or modified input did not trigger a jump');
    assert(g.key('ArrowUp').defaultPrevented); g.advance(100);
    assert(g.stats.sprite.feet < 266, 'ArrowUp moves the player into the air');
    g.key('f'); g.advance(20);
    assert.equal(g.el('shout').attributes['aria-disabled'], 'true');
    assert(g.stats.labels.includes('MAKE WAY!'));
    assert.equal(g.stats.sprite.atlas, 'croak');
    g.motion.matches = true; g.motion.dispatch('change');
    assert(!g.stats.labels.includes('MAKE WAY!'), 'Changing motion preference clears decorative effects');
    assert.equal(g.stats.sprite.atlas, 'hop', 'Reduced motion suppresses the croak pose animation');
    assert.equal(g.stats.blasts.length, 1, 'Reduced motion preserves the essential traveling force front');
    g.key('p'); assert.equal(g.frames.size, 0);
    g.key('p'); assert.equal(g.frames.size, 1);
    g.advance(1000);
    assert.equal(g.stats.sprite.feet, 266);
    assert(!g.canvas.dispatch('pointerdown', { button: 2, isPrimary: true }).defaultPrevented);
    assert(!g.canvas.dispatch('pointerdown', { button: 0, isPrimary: false }).defaultPrevented);
    g.advance(20); assert.equal(g.stats.sprite.feet, 266);
    assert(g.canvas.dispatch('pointerdown', { button: 0, isPrimary: true }).defaultPrevented);
    g.advance(100);
    assert(g.stats.sprite.feet < 266, 'Essential jumping still works with reduced motion');
    g.click('close');
  });
  await withGame({ reduced: true }, async g => {
    g.open(); await flush(); g.click('start'); g.key('f'); g.advance(100);
    assert(!g.stats.labels.includes('MAKE WAY!'));
    assert.equal(g.el('shout').attributes['aria-disabled'], 'true', 'Reduced motion preserves the croak action');
  });
});

test('croak front travels into a hazard, then its launched sprite and points appear', async () => {
  await withGame({}, async g => {
    g.open(); await flush(); g.click('start'); g.advance(2020);
    assert(g.stats.hazards.some(draw => draw.index < 4), 'Ground hazard sprites are rendered');
    assert(g.stats.hazards.some(draw => draw.index >= 12), 'Fireflies use the generated atlas');
    g.key('f'); g.advance(20);
    const first = g.stats.blasts[0].x;
    g.advance(100);
    assert(g.stats.blasts[0].x > first, 'The visible force front travels forward');
    assert.equal(g.stats.sprite.atlas, 'croak');
    g.advance(500);
    assert(g.stats.labels.includes('+15'), 'Cleared hazard displays its bonus');
    assert(g.stats.hazards.some(draw => draw.index < 4 && draw.feet < 266), 'Cleared hazard is launched above the ground');
    g.advance(1000);
    assert(!g.stats.labels.includes('+15'), 'Debris and its points expire');
    assert.equal(g.stats.sprite.atlas, 'hop');
  });
});

test('sound stays optional when Web Audio is unavailable', async () => {
  await withGame({}, async g => {
    g.open(); await flush();
    g.click('sound'); await flush();
    assert.equal(g.el('sound').textContent, 'sound off');
    assert.equal(g.el('sound').attributes['aria-pressed'], 'false');
    assert(!g.el('start').disabled);
    g.click('start'); g.key('f'); g.advance(100);
    assert.equal(g.frames.size, 1);
    g.click('pause'); assert.equal(g.frames.size, 0);
    g.click('close'); assert.equal(g.document.activeElement, g.opener);
  });
});

test('a completed run saves its best, stops, and can restart with three hearts', async () => {
  await withGame({}, async g => {
    g.open(); await flush(); g.click('start'); g.advance(60000);
    assert.equal(g.frames.size, 0);
    assert.equal(g.el('hearts').attributes['aria-label'], '0 hearts remaining');
    assert.equal(g.el('start').textContent, 'One more hop');
    assert.equal(g.document.activeElement, g.el('start'));
    assert(g.el('jump').disabled && g.el('shout').disabled);
    const best = Number(g.saved.get('kmn-hop-best-v1'));
    assert(best > 0);
    assert.equal(best, Number(g.el('score').textContent));
    g.click('start');
    assert.equal(g.el('score').textContent, '0');
    assert.equal(g.el('hearts').attributes['aria-label'], '3 hearts remaining');
    assert.equal(Number(g.el('best').textContent), best);
    assert.equal(g.frames.size, 1);
    assert.equal(g.document.activeElement, g.canvas);
  });
});
