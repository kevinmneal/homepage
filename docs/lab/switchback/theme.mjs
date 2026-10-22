const root = document.documentElement;
const button = document.getElementById('theme-toggle');
function syncTheme() {
  const mode = root.dataset.theme === 'light' ? 'light' : 'dark';
  document.getElementById('theme-label').textContent = mode;
  button.setAttribute('aria-label', `Theme: ${mode}. Switch to Solarized ${mode === 'light' ? 'dark' : 'light'} theme`);
  document.querySelector('meta[name="theme-color"]').content = mode === 'light' ? '#fdf6e3' : '#002b36';
}
syncTheme();
button.hidden = false;
button.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  syncTheme();
});
