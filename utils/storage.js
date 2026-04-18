const DB_NAME = 'WordVault';
const DB_VERSION = 1;
const STORE_NAME = 'words';

let db = null;

function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('sourceLang', 'sourceLang', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function saveWord(entry) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      word: entry.word,
      translation: entry.translation,
      context: entry.context || '',
      sourceUrl: entry.sourceUrl || '',
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
      status: 'new', // new | known | review
      createdAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

async function getAllWords(filters = {}) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
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

async function updateWord(id, updates) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = { ...getReq.result, ...updates };
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function deleteWord(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getStats() {
  const words = await getAllWords();
  return {
    total: words.length,
    new: words.filter((w) => w.status === 'new').length,
    known: words.filter((w) => w.status === 'known').length,
    review: words.filter((w) => w.status === 'review').length,
  };
}
