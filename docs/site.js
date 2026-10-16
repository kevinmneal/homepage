import { createCompanion } from './companion.js?v=20261016-reactions-v3';

const root = document.documentElement;
const themeButton = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const themeColor = document.querySelector('meta[name="theme-color"]');
const projects = [...document.querySelectorAll('.project')];
const canvas = document.getElementById('companion');
const companionLabel = document.getElementById('companion-label');
const replayButton = document.getElementById('companion-replay');
const pauseButton = document.getElementById('companion-pause');
const labels = { idle: '', insurance: 'Fortegra', ecology: 'Spadefoot biogeography', packing: 'Six triangles', watermark: 'LLM watermarking' };
let companion;
let selectedProject = null;

canvas.addEventListener('companionstate', event => {
  const { kind, ready, playing, reducedMotion, error } = event.detail;
  companionLabel.textContent = error ? 'Illustration unavailable' : labels[kind];
  const pauseWasFocused = document.activeElement === pauseButton;
  replayButton.hidden = kind === 'idle' || !ready || reducedMotion || Boolean(error);
  pauseButton.hidden = !playing;
  if (pauseWasFocused && pauseButton.hidden && !replayButton.hidden) replayButton.focus({ preventScroll: true });
});
try {
  companion = createCompanion(canvas);
  document.getElementById('companion-rail').hidden = false;
} catch (_) {
  document.getElementById('companion-rail').hidden = true;
}

function syncTheme() {
  const light = root.dataset.theme === 'light';
  themeLabel.textContent = light ? 'light' : 'dark';
  themeButton.setAttribute('aria-label', `Theme: ${light ? 'light' : 'dark'}. Switch to Solarized ${light ? 'dark' : 'light'} theme`);
  themeColor.content = light ? '#fdf6e3' : '#002b36';
  companion?.redraw();
}
syncTheme();
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  syncTheme();
});
function syncSelection() {
  const openProject = projects.find(project => project.open) ?? null;
  if (openProject === selectedProject) return;
  selectedProject = openProject;
  companion?.select(openProject?.dataset.scene ?? 'idle');
}
for (const project of projects) {
  project.addEventListener('toggle', () => {
    if (project.open) projects.forEach(other => { if (other !== project) other.open = false; });
    syncSelection();
  });
}
syncSelection();
replayButton.addEventListener('click', () => companion?.replay());
pauseButton.addEventListener('click', () => companion?.pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) companion?.pause(); });
window.addEventListener('pagehide', () => companion?.pause());
// Native details keeps text and figures available without JavaScript.

// The character reacts without captions; three taps uncover the field trip.
const secret = document.getElementById('companion-secret');
let tapCount = 0;
let lastTap = 0;
let tapTimer;
let openingGame = false;
secret?.addEventListener('pointerenter', event => {
  if (event.pointerType === 'mouse' && tapCount === 0) companion?.react('curious');
});
async function openFieldTrip() {
  if (openingGame) return;
  openingGame = true;
  clearTimeout(tapTimer);
  tapCount = 0;
  companion?.pause();
  try {
    const { openHopGame } = await import('./hop-game.js?v=20261016-hop-v2');
    openHopGame();
  } catch (_) {
    companionLabel.textContent = 'The field trip didn’t load. Try again.';
  } finally {
    openingGame = false;
  }
}
secret?.addEventListener('click', event => {
  const now = performance.now();
  tapCount = now - lastTap < 1800 ? tapCount + 1 : 1;
  lastTap = now;
  if (event.detail !== 0 && tapCount < 3) {
    companion?.react(tapCount === 1 ? 'happy' : 'croak');
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 1800);
    return;
  }
  tapCount = 0;
  openFieldTrip();
});
// The lab also offers a direct, shareable entrance; play still requires Start.
if (window.location?.hash === '#make-hop') openFieldTrip();
window.addEventListener('hashchange', () => {
  if (window.location?.hash === '#make-hop') openFieldTrip();
});
