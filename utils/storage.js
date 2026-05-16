// ── IndexedDB storage layer ──────────────────────────────────────────────────

const DB_NAME = 'WordVault';
const DB_VERSION = 1;
const STORE_NAME = 'words';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('sourceLang', 'sourceLang', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      _db.onclose = () => { _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      fn(store, resolve, reject);
    });
  });
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

async function saveWord(entry, status = 'new') {
  return withStore('readwrite', (store, resolve, reject) => {
    const lookup = store.index('word').getAll(entry.word);
    lookup.onsuccess = () => {
      const existing = lookup.result.find(
        (w) => w.sourceLang === entry.sourceLang && w.targetLang === entry.targetLang
      );
      if (existing) {
        const updated = {
          ...existing,
          translation: entry.translation,
          context: entry.context || existing.context,
          status,
        };
        const req = store.put(updated);
        req.onsuccess = () => resolve(updated);
        req.onerror = () => reject(req.error);
      } else {
        const record = {
          word: entry.word,
          translation: entry.translation,
          context: entry.context || '',
          sourceUrl: entry.sourceUrl || '',
          sourceLang: entry.sourceLang,
          targetLang: entry.targetLang,
          status,
          createdAt: Date.now(),
        };
        const req = store.add(record);
        req.onsuccess = () => resolve({ ...record, id: req.result });
        req.onerror = () => reject(req.error);
      }
    };
    lookup.onerror = () => reject(lookup.error);
  });
}

async function getAllWords(filters = {}) {
  return withStore('readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      let results = req.result;
      if (filters.status) results = results.filter((w) => w.status === filters.status);
      if (filters.sourceLang) results = results.filter((w) => w.sourceLang === filters.sourceLang);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(
          (w) => w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
        );
      }
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getRecentWords(limit = 8) {
  const words = await getAllWords();
  return words.slice(0, limit);
}

async function getStats() {
  const words = await getAllWords();
  return {
    total: words.length,
    new: words.filter((w) => w.status === 'new').length,
    review: words.filter((w) => w.status === 'review').length,
    known: words.filter((w) => w.status === 'known').length,
  };
}

async function updateWordStatus(id, status) {
  return withStore('readwrite', (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => {
      if (!req.result) { reject(new Error('Word not found')); return; }
      const updated = { ...req.result, status };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteWord(id) {
  return withStore('readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearAllWords() {
  return withStore('readwrite', (store, resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getWordCount() {
  return withStore('readonly', (store, resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
