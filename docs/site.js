const root = document.documentElement;
const themeButton = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const themeColor = document.querySelector('meta[name="theme-color"]');
function syncThemeButton() {
  const light = root.dataset.theme === 'light';
  themeLabel.textContent = light ? 'dark' : 'light';
  themeButton.setAttribute('aria-label', `Switch to Solarized ${light ? 'dark' : 'light'} theme`);
  themeColor.content = light ? '#fdf6e3' : '#002b36';
}
syncThemeButton();
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('kmn-theme', root.dataset.theme); } catch (_) {}
  syncThemeButton();
});
const toadButton = document.getElementById('toad-button');
const toadStatus = document.getElementById('toad-status');
const toadBubble = document.getElementById('toad-bubble');
const toadHint = document.getElementById('toad-hint');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const greetings = ['one more idea…', 'hello, fellow organism.', 'time for a field trip?', 'coffee → curiosity'];
let busy = false;
let visits = 0;
toadButton.disabled = false;
toadHint.hidden = false;
toadButton.addEventListener('click', () => {
  if (busy) return;
  busy = true;
  const greeting = greetings[visits % greetings.length];
  visits += 1;
  toadBubble.textContent = greeting;
  toadStatus.textContent = `The spadefoot says: ${greeting}`;
  toadButton.classList.add('is-greeting');
  if (!reducedMotion.matches) toadButton.classList.add('is-wiggling');
  window.setTimeout(() => {
    toadButton.classList.remove('is-greeting', 'is-wiggling');
    busy = false;
  }, 2600);
});
