import { createScene } from './scenes.js';

const root = document.documentElement;
const themeButton = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const themeColor = document.querySelector('meta[name="theme-color"]');
const projects = [...document.querySelectorAll('.project')];
const scenes = new Map();

function syncTheme() {
  const light = root.dataset.theme === 'light';
  themeLabel.textContent = light ? 'dark' : 'light';
  themeButton.setAttribute('aria-label', `Switch to Solarized ${light ? 'dark' : 'light'} theme`);
  themeColor.content = light ? '#fdf6e3' : '#002b36';
  scenes.forEach(scene => scene.redraw());
}
syncTheme();
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('kmn-theme', root.dataset.theme); } catch (_) {}
  syncTheme();
});

function sceneFor(project) {
  if (!scenes.has(project)) {
    scenes.set(project, createScene(project.querySelector('canvas'), project.dataset.scene));
    project.querySelector('.scene-controls').hidden = false;
  }
  return scenes.get(project);
}

for (const project of projects) {
  const canvas = project.querySelector('canvas');
  const pauseButton = project.querySelector('.pause');
  pauseButton.hidden = true;
  canvas.addEventListener('scenestate', event => {
    const wasFocused = document.activeElement === pauseButton;
    pauseButton.hidden = !event.detail.playing;
    if (wasFocused && pauseButton.hidden) project.querySelector('.replay').focus({ preventScroll: true });
  });
  canvas.addEventListener('sceneerror', () => {
    project.querySelector('.scene-controls').hidden = true;
    project.querySelector('figcaption > span').textContent = 'Illustration unavailable';
  });
  project.addEventListener('toggle', () => {
    if (project.open) {
      projects.forEach(other => { if (other !== project) other.open = false; });
      sceneFor(project).play();
    } else {
      scenes.get(project)?.stop();
    }
  });
  project.querySelector('.replay').addEventListener('click', () => sceneFor(project).play());
  project.querySelector('.pause').addEventListener('click', () => scenes.get(project)?.stop());
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) scenes.forEach(scene => scene.stop());
});

window.addEventListener('pagehide', () => scenes.forEach(scene => scene.stop()));
// Native details/summary keeps the content available even without JavaScript.
