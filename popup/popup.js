// ── State ─────────────────────────────────────────────────────────────────────

let settings = { sourceLang: 'en', targetLang: 'vi' };
let features = { doubleClickEnabled: true, soundEnabled: true, badgeEnabled: true };
let translateTimer = null;
let lastTranslated = '';
let lastTranslatedWord = '';

// ── Settings panel ───────────────────────────────────────────────────────────

function populateSelect(id, selected) {
  const sel = $(id);
  sel.innerHTML = '';
  LANGUAGES.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = `${lang.flag} ${lang.name}`;
    if (lang.code === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

function updateLangBar() {
  $('lang-source').textContent = LANG_NAMES[settings.sourceLang] || settings.sourceLang.toUpperCase();
  $('lang-target').textContent = LANG_NAMES[settings.targetLang] || settings.targetLang.toUpperCase();
}

function openLangPanel() {
  populateSelect('sel-source', settings.sourceLang);
  populateSelect('sel-target', settings.targetLang);
  $('toggle-dblclick').checked = features.doubleClickEnabled;
  $('toggle-sound').checked = features.soundEnabled;
  $('toggle-badge').checked = features.badgeEnabled;
  chrome.storage.local.get('theme', function (data) {
    $('toggle-theme').checked = (data.theme || 'dark') === 'dark';
  });
  $('lang-panel').classList.remove('hidden');
  $('lang-bar').classList.add('hidden');
}

function closeLangPanel() {
  $('lang-panel').classList.add('hidden');
  $('lang-bar').classList.remove('hidden');
}

async function saveSettings() {
  const src = $('sel-source').value;
  const tgt = $('sel-target').value;
  const dblclick = $('toggle-dblclick').checked;
  const sound = $('toggle-sound').checked;
  const badge = $('toggle-badge').checked;
  const theme = $('toggle-theme').checked ? 'dark' : 'light';

  await chrome.storage.local.set({
    sourceLang: src, targetLang: tgt,
    doubleClickEnabled: dblclick, soundEnabled: sound, badgeEnabled: badge,
    theme: theme,
  });

  settings = { sourceLang: src, targetLang: tgt };
  features = { doubleClickEnabled: dblclick, soundEnabled: sound, badgeEnabled: badge };
  updateLangBar();
  closeLangPanel();
  lastTranslated = '';
  lastTranslatedWord = '';
  chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
}

// ── Recent words list ────────────────────────────────────────────────────────

async function refreshRecent() {
  const [stats, recent] = await Promise.all([getStats(), getRecentWords()]);
  $('stat-total').textContent = stats.total;
  $('stat-new').textContent = stats.new;
  $('stat-review').textContent = stats.review;
  $('stat-known').textContent = stats.known;
  renderRecent(recent);
}

function renderRecent(words) {
  const list = $('recent-list');
  if (!words.length) {
    list.innerHTML = '<div class="recent-empty">No words yet</div>';
    return;
  }

  list.innerHTML = '';
  words.forEach((w) => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.innerHTML = `
      <span class="recent-word" title="${escHtml(w.word)}">${escHtml(w.word)}</span>
      <span class="recent-sep">→</span>
      <span class="recent-trans" title="${escHtml(w.translation)}">${escHtml(w.translation)}</span>
      <span class="recent-status ${w.status}">${w.status}</span>
      <button class="recent-known-btn hidden" title="Mark as known"><span class="material-icons-round">check_circle</span></button>
      <button class="recent-delete-btn" title="Delete"><span class="material-icons-round">delete</span></button>
    `;

    item.addEventListener('dblclick', () => {
      item.querySelector('.recent-known-btn').classList.toggle('hidden');
    });

    item.querySelector('.recent-known-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await updateWordStatus(w.id, 'known');
      await refreshRecent();
    });

    item.querySelector('.recent-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      item.classList.add('removing');
      await deleteWord(w.id);
      await refreshRecent();
    });

    list.appendChild(item);
  });
}

// ── Quick save ───────────────────────────────────────────────────────────────

async function translatePreview(word) {
  const preview = $('translation-preview');
  preview.className = 'translation-preview';
  preview.textContent = '⏳ Translating...';

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'TRANSLATE', text: word,
      sourceLang: settings.sourceLang, targetLang: settings.targetLang,
    });
    if (result?.error) throw new Error(result.error);
    lastTranslated = result.translation;
    lastTranslatedWord = word;
    preview.className = 'translation-preview';
    preview.textContent = `→ ${result.translation}`;
  } catch (err) {
    preview.className = 'translation-preview error';
    preview.textContent = `⚠️ ${getFriendlyError(err)}`;
    lastTranslated = '';
    lastTranslatedWord = '';
  }
}

async function quickSave() {
  const input = $('input-word');
  const preview = $('translation-preview');
  const saveBtn = $('btn-save');
  const word = input.value.trim();
  if (!word) return;

  saveBtn.disabled = true;
  saveBtn.textContent = '...';

  try {
    if (!lastTranslated || lastTranslatedWord !== word) {
      const result = await chrome.runtime.sendMessage({
        type: 'TRANSLATE', text: word,
        sourceLang: settings.sourceLang, targetLang: settings.targetLang,
      });
      if (result?.error) throw new Error(result.error);
      lastTranslated = result.translation;
      lastTranslatedWord = word;
    }

    await saveWord(
      { word, translation: lastTranslated, context: '', sourceUrl: '', sourceLang: settings.sourceLang, targetLang: settings.targetLang },
      'new',
    );

    input.value = '';
    preview.className = 'translation-preview';
    preview.textContent = `✅ Saved "${word}"`;
    lastTranslated = '';
    lastTranslatedWord = '';

    if (features.soundEnabled) playSuccessSound();
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
    await refreshRecent();
    setTimeout(() => preview.classList.add('hidden'), 2000);
  } catch (err) {
    preview.className = 'translation-preview error';
    preview.textContent = `⚠️ ${getFriendlyError(err)}`;
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Save';
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.local.get([
    'sourceLang', 'targetLang', 'doubleClickEnabled', 'soundEnabled', 'badgeEnabled',
  ]);

  settings = { sourceLang: data.sourceLang || 'en', targetLang: data.targetLang || 'vi' };
  features = {
    doubleClickEnabled: data.doubleClickEnabled !== false,
    soundEnabled: data.soundEnabled !== false,
    badgeEnabled: data.badgeEnabled !== false,
  };

  updateLangBar();
  await refreshRecent();

  // Settings panel
  $('btn-change-lang').addEventListener('click', openLangPanel);
  $('settings-btn').addEventListener('click', openLangPanel);
  $('btn-lang-save').addEventListener('click', saveSettings);
  $('btn-lang-cancel').addEventListener('click', closeLangPanel);

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('sel-source').value = btn.dataset.src;
      $('sel-target').value = btn.dataset.tgt;
    });
  });

  $('toggle-theme').addEventListener('change', () => {
    const theme = $('toggle-theme').checked ? 'dark' : 'light';
    applyTheme(theme);
    chrome.storage.local.set({ theme: theme });
  });

  // Quick save
  const input = $('input-word');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (!val) {
      $('translation-preview').classList.add('hidden');
      lastTranslated = '';
      lastTranslatedWord = '';
      return;
    }
    clearTimeout(translateTimer);
    translateTimer = setTimeout(() => translatePreview(val), 600);
  });

  $('btn-save').addEventListener('click', quickSave);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') quickSave(); });
}

init();
