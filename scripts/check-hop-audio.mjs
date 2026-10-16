import assert from 'node:assert/strict';
import test from 'node:test';
import { createHopAudio } from '../docs/hop-audio.js';

test('sound requires opt-in, stops every active source, and resumes after suspension', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const sources = [];
  let contexts = 0, resumed = 0, context;
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect(other) { return other; }, disconnect() {}, gain: parameter(), frequency: parameter(), Q: parameter() });
  const source = () => {
    const item = { ...node(), starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; this.onended?.(); } };
    sources.push(item); return item;
  };
  class AudioContext {
    constructor() { contexts++; context = this; this.currentTime = 0; this.sampleRate = 1000; this.state = 'suspended'; this.destination = node(); }
    createGain() { return node(); }
    createOscillator() { return source(); }
    createBufferSource() { return source(); }
    createBiquadFilter() { return node(); }
    createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
    async resume() { resumed++; this.state = 'running'; }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext } });
  try {
    const sound = createHopAudio();
    sound.play('shout');
    assert.equal(contexts, 0, 'No audio context or sound before explicit opt-in');
    assert.equal(await sound.toggle(), true);
    sound.play('shout'); sound.play('collect'); sound.play('hit');
    assert(sources.length > 0 && sources.every(s => s.starts === 1));
    sound.halt();
    assert(sources.every(s => s.stops >= 1), 'Pause/close can stop every scheduled source');
    context.state = 'suspended'; sound.resume();
    assert.equal(resumed, 2);
    assert.equal(await sound.toggle(), false);
    const count = sources.length; sound.play('shout'); assert.equal(sources.length, count);
    await sound.toggle(); assert.equal(contexts, 1, 'Re-enable reuses the audio context');
    sound.halt();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
});
