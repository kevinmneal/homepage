// Small synthesized effects. Sound is off until the visitor explicitly enables it.
export function createHopAudio() {
  let context, output, noise, enabled = false;
  const active = new Set();
  function track(source, cleanup = () => {}) {
    active.add(source);
    source.onended = () => { active.delete(source); source.disconnect(); cleanup(); };
    return source;
  }
  function halt() {
    for (const source of active) { try { source.stop(); } catch (_) { /* Already stopped. */ } }
    active.clear();
  }
  function tone(frequency, end, duration, delay = 0, level = .3, type = 'sine') {
    const at = context.currentTime + delay;
    const gain = context.createGain();
    const oscillator = track(context.createOscillator(), () => gain.disconnect());
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + .018);
    gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(at); oscillator.stop(at + duration + .01);
  }
  return {
    get enabled() { return enabled; },
    async toggle() {
      if (enabled) { enabled = false; halt(); return false; }
      try {
        if (!context) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return false;
          context = new Audio();
          output = context.createGain(); output.gain.value = .18; output.connect(context.destination);
          noise = context.createBuffer(1, Math.ceil(context.sampleRate * .6), context.sampleRate);
          const samples = noise.getChannelData(0);
          for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
        }
        await context.resume(); enabled = true; return true;
      } catch (_) { enabled = false; return false; }
    },
    halt,
    resume() { if (enabled && context.state !== 'running') context.resume().catch(() => {}); },
    play(type) {
      if (!enabled || !context || context.state !== 'running') return;
      if (type === 'shout') {
        tone(115, 38, .52, 0, .75, 'sawtooth');
        tone(65, 30, .6, .04, .7);
        const source = context.createBufferSource(); source.buffer = noise;
        const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 480; filter.Q.value = .8;
        const gain = context.createGain(), now = context.currentTime;
        track(source, () => { filter.disconnect(); gain.disconnect(); });
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1.2, now + .06); gain.gain.exponentialRampToValueAtTime(.001, now + .58);
        source.connect(filter).connect(gain).connect(output); source.start(); source.stop(now + .6);
      } else if (type === 'collect') {
        tone(720, 1080, .12, 0, .22); tone(1080, 1400, .16, .07, .18);
      } else if (type === 'hit') tone(100, 35, .2, 0, .35, 'triangle');
    },
  };
}
