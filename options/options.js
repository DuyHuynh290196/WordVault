const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
];

function populateSelect(id, selected) {
  const sel = document.getElementById(id);
  sel.innerHTML = '';
  LANGUAGES.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = `${lang.flag} ${lang.name}`;
    if (lang.code === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function init() {
  const data = await new Promise((resolve) => {
    chrome.storage.local.get(['sourceLang', 'targetLang'], resolve);
  });

  const sourceLang = data.sourceLang || 'en';
  const targetLang = data.targetLang || 'vi';

  populateSelect('source-lang', sourceLang);
  populateSelect('target-lang', targetLang);

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('source-lang').value = btn.dataset.src;
      document.getElementById('target-lang').value = btn.dataset.tgt;
    });
  });

  // Save
  document.getElementById('btn-save').addEventListener('click', async () => {
    const newSource = document.getElementById('source-lang').value;
    const newTarget = document.getElementById('target-lang').value;

    await new Promise((resolve) => {
      chrome.storage.local.set({ sourceLang: newSource, targetLang: newTarget }, resolve);
    });

    const msg = document.getElementById('save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
  });
}

init();
