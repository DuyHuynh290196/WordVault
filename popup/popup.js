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

const LANG_NAMES = {
  en: '🇬🇧 EN', vi: '🇻🇳 VI', ja: '🇯🇵 JA', ko: '🇰🇷 KO',
  zh: '🇨🇳 ZH', fr: '🇫🇷 FR', de: '🇩🇪 DE', es: '🇪🇸 ES',
  it: '🇮🇹 IT', pt: '🇵🇹 PT',
};

const DB_NAME = 'WordVault';
const DB_VERSION = 1;
const STORE_NAME = 'words';

let db = null;
let settings = { sourceLang: 'en', targetLang: 'vi' };
let featureSettings = { doubleClickEnabled: true, soundEnabled: true, badgeEnabled: true };

function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('sourceLang', 'sourceLang', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

async function getStats() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const words = req.result;
      resolve({
        total: words.length,
        new: words.filter((w) => w.status === 'new').length,
        review: words.filter((w) => w.status === 'review').length,
        known: words.filter((w) => w.status === 'known').length,
      });
    };
    req.onerror = () => reject(req.error);
  });
}

function updateLangBar() {
  document.getElementById('lang-source').textContent = LANG_NAMES[settings.sourceLang] || settings.sourceLang.toUpperCase();
  document.getElementById('lang-target').textContent = LANG_NAMES[settings.targetLang] || settings.targetLang.toUpperCase();
}

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

function openLangPanel() {
  populateSelect('sel-source', settings.sourceLang);
  populateSelect('sel-target', settings.targetLang);
  document.getElementById('toggle-dblclick').checked = featureSettings.doubleClickEnabled;
  document.getElementById('toggle-sound').checked    = featureSettings.soundEnabled;
  document.getElementById('toggle-badge').checked    = featureSettings.badgeEnabled;
  document.getElementById('lang-panel').classList.remove('hidden');
  document.getElementById('lang-bar').classList.add('hidden');
}

function closeLangPanel() {
  document.getElementById('lang-panel').classList.add('hidden');
  document.getElementById('lang-bar').classList.remove('hidden');
}

async function getRecentWords(limit = 8) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const sorted = req.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(sorted.slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteWordById(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id).onsuccess = () => resolve();
  });
}

async function markKnown(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const record = { ...req.result, status: 'known' };
      store.put(record).onsuccess = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

async function refreshRecent() {
  const [stats, recent] = await Promise.all([getStats(), getRecentWords()]);
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-new').textContent = stats.new;
  document.getElementById('stat-review').textContent = stats.review;
  document.getElementById('stat-known').textContent = stats.known;
  renderRecent(recent);
}

function renderRecent(words) {
  const list = document.getElementById('recent-list');
  if (!words.length) {
    list.innerHTML = '<div class="recent-empty">No words yet</div>';
    return;
  }

  list.innerHTML = '';
  words.forEach((w) => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.dataset.id = w.id;
    item.innerHTML = `
      <span class="recent-word" title="${escHtml(w.word)}">${escHtml(w.word)}</span>
      <span class="recent-sep">→</span>
      <span class="recent-trans" title="${escHtml(w.translation)}">${escHtml(w.translation)}</span>
      <span class="recent-status ${w.status}">${w.status}</span>
      <button class="recent-known-btn hidden" title="Mark as known"><span class="material-icons-round">check_circle</span></button>
      <button class="recent-delete-btn" title="Delete"><span class="material-icons-round">delete</span></button>
    `;

    // Double-click → toggle ✅ icon
    item.addEventListener('dblclick', () => {
      const knownBtn = item.querySelector('.recent-known-btn');
      knownBtn.classList.toggle('hidden');
    });

    // ✅ click → mark known
    item.querySelector('.recent-known-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await markKnown(w.id);
      await refreshRecent();
    });

    // 🗑️ click → delete
    item.querySelector('.recent-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      item.classList.add('removing');
      await deleteWordById(w.id);
      await refreshRecent();
    });

    list.appendChild(item);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let translateTimer = null;
let lastTranslated = '';

async function init() {
  const data = await new Promise((resolve) =>
    chrome.storage.local.get(['sourceLang', 'targetLang', 'doubleClickEnabled', 'soundEnabled', 'badgeEnabled'], resolve)
  );
  settings = { sourceLang: data.sourceLang || 'en', targetLang: data.targetLang || 'vi' };
  featureSettings = {
    doubleClickEnabled: data.doubleClickEnabled !== false,
    soundEnabled:       data.soundEnabled !== false,
    badgeEnabled:       data.badgeEnabled !== false,
  };
  updateLangBar();

  const [stats, recent] = await Promise.all([getStats(), getRecentWords()]);
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-new').textContent = stats.new;
  document.getElementById('stat-review').textContent = stats.review;
  document.getElementById('stat-known').textContent = stats.known;
  renderRecent(recent);

  // Open lang panel
  document.getElementById('btn-change-lang').addEventListener('click', openLangPanel);
  document.getElementById('settings-btn').addEventListener('click', openLangPanel);

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('sel-source').value = btn.dataset.src;
      document.getElementById('sel-target').value = btn.dataset.tgt;
    });
  });

  // Save lang
  document.getElementById('btn-lang-save').addEventListener('click', async () => {
    const src = document.getElementById('sel-source').value;
    const tgt = document.getElementById('sel-target').value;
    const dblclick = document.getElementById('toggle-dblclick').checked;
    const sound    = document.getElementById('toggle-sound').checked;
    const badge    = document.getElementById('toggle-badge').checked;

    await new Promise((resolve) => chrome.storage.local.set({
      sourceLang: src, targetLang: tgt,
      doubleClickEnabled: dblclick, soundEnabled: sound, badgeEnabled: badge,
    }, resolve));

    settings = { sourceLang: src, targetLang: tgt };
    featureSettings = { doubleClickEnabled: dblclick, soundEnabled: sound, badgeEnabled: badge };
    updateLangBar();
    closeLangPanel();
    lastTranslated = '';

    // Notify background to update badge
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
  });

  document.getElementById('btn-lang-cancel').addEventListener('click', closeLangPanel);

  // Quick Save
  const input = document.getElementById('input-word');
  const preview = document.getElementById('translation-preview');
  const saveBtn = document.getElementById('btn-save');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (!val) { preview.classList.add('hidden'); lastTranslated = ''; return; }
    clearTimeout(translateTimer);
    translateTimer = setTimeout(async () => {
      preview.className = 'translation-preview';
      preview.textContent = '⏳ Translating...';
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'TRANSLATE', text: val,
          sourceLang: settings.sourceLang, targetLang: settings.targetLang,
        });
        if (result?.error) throw new Error(result.error);
        lastTranslated = result;
        preview.className = 'translation-preview';
        preview.textContent = `→ ${result}`;
      } catch (err) {
        preview.className = 'translation-preview error';
        preview.textContent = `⚠️ ${err.message}`;
        lastTranslated = '';
      }
    }, 600);
  });

  saveBtn.addEventListener('click', async () => {
    const word = input.value.trim();
    if (!word) return;
    saveBtn.disabled = true;
    saveBtn.textContent = '...';
    try {
      if (!lastTranslated) {
        const result = await chrome.runtime.sendMessage({
          type: 'TRANSLATE', text: word,
          sourceLang: settings.sourceLang, targetLang: settings.targetLang,
        });
        if (result?.error) throw new Error(result.error);
        lastTranslated = result;
      }
      const database = await openDB();
      await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).add({
          word, translation: lastTranslated, context: '', sourceUrl: '',
          sourceLang: settings.sourceLang, targetLang: settings.targetLang,
          status: 'new', createdAt: Date.now(),
        });
        req.onsuccess = resolve;
        req.onerror = () => reject(req.error);
      });
      input.value = '';
      preview.className = 'translation-preview';
      preview.textContent = `✅ Saved "${word}"`;
      lastTranslated = '';
      if (featureSettings.soundEnabled) playSuccessSound();
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
      await refreshRecent();
      setTimeout(() => preview.classList.add('hidden'), 2000);
    } catch (err) {
      preview.className = 'translation-preview error';
      preview.textContent = `⚠️ ${err.message}`;
    }
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  });

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });
}

init();
