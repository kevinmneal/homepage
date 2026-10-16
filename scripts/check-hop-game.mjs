import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Exercise the real game/controller and model with a small DOM/canvas adapter.
// Browser layout, native dialog behavior, and rendered pixels need browser QA.
const metadata = JSON.parse(fs.readFileSync(new URL('../docs/assets/companion/frames.json', import.meta.url), 'utf8'));
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
  const stats = { sprite: null, labels: [], draws: 0 };
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
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), `${String(key)} coordinate is finite`);
        if (key === 'setTransform') { stats.labels = []; stats.draws++; }
        if (key === 'ellipse') assert(args[2] >= 0 && args[3] >= 0, 'Ellipse radii stay nonnegative');
        if (key === 'arc') assert(args[2] >= 0, 'Arc radius stays nonnegative');
        if (key === 'fillText') stats.labels.push(args[0]);
        if (key === 'drawImage') {
          const [, sx, sy, sw, sh, dx, dy, dw, dh] = args;
          assert.equal(args.length, 9);
          assert(sx >= 0 && sy >= 0 && sw > 0 && sh > 0);
          assert(sx + sw <= metadata.hop.width && sy + sh <= metadata.hop.height, 'Sprite uses an in-bounds atlas crop');
          assert(dw > 0 && dh > 0);
          stats.sprite = { feet: dy + dh, x: dx, source: [sx, sy, sw, sh] };
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
      assert(value.endsWith('/assets/companion/hop.png'));
      const fail = options.failImageOnce && ++imageCount === 1;
      queueMicrotask(() => fail ? this.onerror() : this.onload());
    }
  });
  install('fetch', async url => {
    assert(String(url).endsWith('/assets/companion/frames.json'));
    const attempt = ++fetchCount;
    if (options.delayed) await new Promise(resolve => pendingLoads.push(resolve));
    return { ok: !(options.failMetadataOnce && attempt === 1), json: async () => metadata };
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
    assert.equal(g.fetchCount(), 1);
    assert.equal(g.document.activeElement, g.el('start'));
    assert.equal(g.frames.size, 0, 'Ready screen does not run physics');
    g.click('start'); g.advance(1000);
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
    assert.equal(g.fetchCount(), 1, 'Reopen reuses loaded artwork');
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
    assert.equal(g.fetchCount(), 1);
    assert.equal(g.document.activeElement, g.el('start'));
    assert(!g.el('start').disabled);
  });
  await withGame({ delayed: true }, async g => {
    g.open(); g.click('close'); g.open(); await g.resolveLoads();
    assert.equal(g.fetchCount(), 1);
    assert.equal(g.document.activeElement, g.el('start'));
    assert.equal(g.frames.size, 0);
    g.click('start'); assert.equal(g.frames.size, 1);
  });
});

test('artwork failures can be retried without starting duplicate loops', async () => {
  for (const failure of ['failMetadataOnce', 'failImageOnce']) {
    await withGame({ [failure]: true }, async g => {
      g.open(); await flush();
      assert.equal(g.el('start').textContent, 'Try again');
      assert(!g.el('start').disabled);
      assert.equal(g.frames.size, 0);
      g.click('start'); await flush();
      assert.equal(g.fetchCount(), 2);
      assert.equal(g.el('start').textContent, 'Let’s hop');
      g.click('start'); g.advance(100);
      assert.equal(g.frames.size, 1);
    });
  }
});

test('keyboard and pointer controls respect buttons, repeats, modifiers, and reduced motion', async () => {
  await withGame({ mobile: true, light: true, storageUnavailable: true }, async g => {
    g.open(); await flush(); g.click('start'); g.advance(20);
    for (const key of [' ', 'ArrowUp']) assert(g.key(key, { repeat: true }).defaultPrevented);
    assert(!g.key(' ', { target: g.el('jump') }).defaultPrevented, 'Button keeps native Space activation');
    assert(!g.key('Enter', { target: g.el('start') }).defaultPrevented);
    assert(!g.key(' ', { ctrlKey: true }).defaultPrevented);
    g.advance(100);
    assert.equal(g.stats.sprite.feet, 266, 'Repeated or modified input did not trigger a jump');
    assert(g.key('ArrowUp').defaultPrevented); g.advance(100);
    assert(g.stats.sprite.feet < 266, 'ArrowUp moves the player into the air');
    g.key('f'); g.advance(20);
    assert.equal(g.el('shout').attributes['aria-disabled'], 'true');
    assert(g.stats.labels.includes('MAKE WAY!'));
    g.motion.matches = true; g.motion.dispatch('change');
    assert(!g.stats.labels.includes('MAKE WAY!'), 'Changing motion preference clears decorative effects');
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
