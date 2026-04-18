const DB_NAME = 'WordVault';
const DB_VERSION = 1;
const STORE_NAME = 'words';

const LANG_FLAGS = {
  en: '🇬🇧', vi: '🇻🇳', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳',
  fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', it: '🇮🇹', pt: '🇵🇹',
};

let db = null;

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

async function getAllWords() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function updateWordStatus(id, status) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = { ...getReq.result, status };
      store.put(record).onsuccess = () => resolve(record);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function deleteWord(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id).onsuccess = () => resolve();
  });
}

async function clearAllWords() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear().onsuccess = () => resolve();
  });
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

let allWords = [];
let filters = { search: '', status: '', lang: '' };

function applyFilters() {
  let result = allWords;
  if (filters.status) result = result.filter((w) => w.status === filters.status);
  if (filters.lang) result = result.filter((w) => w.sourceLang === filters.lang);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (w) => w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
    );
  }
  return result;
}

function renderWords(words) {
  const list = document.getElementById('word-list');
  document.getElementById('h-total').textContent = `${words.length} word${words.length !== 1 ? 's' : ''}`;

  if (words.length === 0) {
    list.innerHTML = '<div class="empty-state">No words found. Start saving vocabulary while browsing!</div>';
    return;
  }

  list.innerHTML = words.map((w) => `
    <div class="word-card" data-id="${w.id}">
      <div class="word-main">
        <div class="word-text">${escHtml(w.word)}</div>
        <div class="word-translation">${escHtml(w.translation)}</div>
        ${w.context ? `<div class="word-context">"${escHtml(w.context)}"</div>` : ''}
        <div class="word-meta">
          <span class="lang-badge">${(LANG_FLAGS[w.sourceLang] || '') + ' ' + w.sourceLang.toUpperCase()} → ${(LANG_FLAGS[w.targetLang] || '') + ' ' + w.targetLang.toUpperCase()}</span>
          <span>${formatDate(w.createdAt)}</span>
        </div>
      </div>
      <div class="word-actions">
        <select class="status-select ${w.status}" data-id="${w.id}">
          <option value="new" ${w.status === 'new' ? 'selected' : ''}>New</option>
          <option value="review" ${w.status === 'review' ? 'selected' : ''}>Review</option>
          <option value="known" ${w.status === 'known' ? 'selected' : ''}>Known</option>
        </select>
        <button class="delete-btn" data-id="${w.id}" title="Delete"><span class="material-icons-round">delete</span></button>
      </div>
    </div>
  `).join('');

  // Events: status change
  list.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = parseInt(sel.dataset.id);
      const status = sel.value;
      await updateWordStatus(id, status);
      sel.className = `status-select ${status}`;
      const idx = allWords.findIndex((w) => w.id === id);
      if (idx !== -1) allWords[idx].status = status;
    });
  });

  // Events: delete
  list.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      await deleteWord(id);
      allWords = allWords.filter((w) => w.id !== id);
      renderWords(applyFilters());
    });
  });
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function populateLangFilter(words) {
  const langs = [...new Set(words.map((w) => w.sourceLang))].sort();
  const sel = document.getElementById('filter-lang');
  sel.innerHTML = '<option value="">All languages</option>';
  langs.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = `${LANG_FLAGS[lang] || ''} ${lang.toUpperCase()}`;
    sel.appendChild(opt);
  });
}

async function init() {
  allWords = await getAllWords();
  populateLangFilter(allWords);
  renderWords(applyFilters());

  // Filters
  let searchTimer;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.search = e.target.value.trim();
      renderWords(applyFilters());
    }, 200);
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderWords(applyFilters());
  });

  document.getElementById('filter-lang').addEventListener('change', (e) => {
    filters.lang = e.target.value;
    renderWords(applyFilters());
  });

  // Clear all
  const modal = document.getElementById('modal-overlay');
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('modal-cancel').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  document.getElementById('modal-confirm').addEventListener('click', async () => {
    await clearAllWords();
    allWords = [];
    modal.classList.add('hidden');
    renderWords([]);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

init();
