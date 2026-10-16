import { createCompanion } from './companion.js?v=20261015-refined';

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
} catch (_) {
  document.getElementById('companion-rail').hidden = true;
}

function syncTheme() {
  const light = root.dataset.theme === 'light';
  themeLabel.textContent = light ? 'dark' : 'light';
  themeButton.setAttribute('aria-label', `Switch to Solarized ${light ? 'dark' : 'light'} theme`);
  themeColor.content = light ? '#fdf6e3' : '#002b36';
  companion?.redraw();
}
syncTheme();
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('kmn-theme', root.dataset.theme); } catch (_) {}
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
