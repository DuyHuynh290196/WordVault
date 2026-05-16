function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var btn = document.getElementById('btn-theme');
  if (btn) {
    btn.querySelector('.material-icons-round').textContent =
      theme === 'dark' ? 'dark_mode' : 'light_mode';
  }
  var toggle = document.getElementById('toggle-theme');
  if (toggle) toggle.checked = theme === 'dark';
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  chrome.storage.local.set({ theme: next });
}

function initTheme() {
  chrome.storage.local.get('theme', function (data) {
    applyTheme(data.theme || 'dark');
  });

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.theme) applyTheme(changes.theme.newValue || 'dark');
  });

  var btn = document.getElementById('btn-theme');
  if (btn) btn.addEventListener('click', toggleTheme);
}

initTheme();
