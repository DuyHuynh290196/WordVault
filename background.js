function getFriendlyError(err) {
  const msg = (err?.message || err || '').toString().toLowerCase();
  if (msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('load failed'))
    return 'No internet connection.';
  if (msg.includes('429') || msg.includes('rate limit'))
    return 'Too many requests. Wait a moment and try again.';
  if (msg.includes('http error 5') || msg.includes('unavailable'))
    return 'Translation service unavailable. Try again later.';
  if (msg.includes('translation failed'))
    return 'Translation failed. Check your language settings.';
  if (msg.includes('extension context') || msg.includes('invalidated'))
    return 'Extension updated. Please refresh the page.';
  return 'Something went wrong. Please try again.';
}

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

// --- Context Menu ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-wordvault',
    title: 'Save to WordVault',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-wordvault') {
    const text = info.selectionText?.trim();
    if (!text) return;

    const settings = await getSettings();
    await processAndSaveWord(text, tab, settings);
  }
});

// --- Keyboard Shortcut ---
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-word') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() || '',
    });

    const text = results?.[0]?.result;
    if (!text) return;

    const settings = await getSettings();
    await processAndSaveWord(text, tab, settings);
  }
});

// --- Message from content/popup ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_WORD') {
    const { text, context, sourceUrl } = msg;
    getSettings().then((settings) => {
      processAndSaveWord(text, { url: sourceUrl }, settings, context).then(sendResponse);
    });
    return true;
  }

  if (msg.type === 'SAVE_WORD_KNOWN') {
    const { text, context, sourceUrl } = msg;
    getSettings().then(async (settings) => {
      const result = await processAndSaveWord(text, { url: sourceUrl }, settings, context, 'known');
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'TRANSLATE') {
    const { text, sourceLang, targetLang } = msg;
    translate(text, sourceLang, targetLang).then(sendResponse).catch((err) => sendResponse({ error: getFriendlyError(err) }));
    return true;
  }

  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (msg.type === 'UPDATE_BADGE') {
    updateBadge();
    sendResponse({ ok: true });
    return true;
  }
});

// --- Helpers ---
async function getSettings() {
  const data = await chrome.storage.local.get(['sourceLang', 'targetLang']);
  return {
    sourceLang: data.sourceLang || 'en',
    targetLang: data.targetLang || 'vi',
  };
}

async function translate(text, sourceLang, targetLang) {
  const langPair = `${sourceLang}|${targetLang}`;
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${langPair}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || 'Translation failed');
  return data.responseData.translatedText;
}

async function processAndSaveWord(text, tab, settings, context = '', status = 'new') {
  const { sourceLang, targetLang } = settings;

  // Notify content script: saving in progress
  if (tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (word) => {
        if (window.__wordvaultShowToast) window.__wordvaultShowToast(`Saving "${word}"...`, 'info');
      },
      args: [text],
    }).catch(() => {});
  }

  try {
    const translation = await translate(text, sourceLang, targetLang);

    // Get context sentence from tab if not provided
    if (!context && tab?.id) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (word) => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return '';
            const range = sel.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const text = container.textContent || '';
            const wordIdx = text.toLowerCase().indexOf(word.toLowerCase());
            if (wordIdx === -1) return '';
            const start = Math.max(0, wordIdx - 80);
            const end = Math.min(text.length, wordIdx + word.length + 80);
            return text.slice(start, end).trim();
          },
          args: [text],
        });
        context = results?.[0]?.result || '';
      } catch (_) {}
    }

    const record = {
      word: text,
      translation,
      context,
      sourceUrl: tab?.url || '',
      sourceLang,
      targetLang,
      status,
      createdAt: Date.now(),
    };

    await saveToStorage(record);
    updateBadge();

    if (tab?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (word, trans) => {
          if (window.__wordvaultShowToast) window.__wordvaultShowToast(`${word} → ${trans}`, 'success');
          if (window.__wordvaultPlaySound) window.__wordvaultPlaySound();
        },
        args: [text, translation],
      }).catch(() => {});
    }

    return { success: true, record };
  } catch (err) {
    if (tab?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (msg) => {
          if (window.__wordvaultShowToast) window.__wordvaultShowToast(msg, 'error');
        },
        args: [getFriendlyError(err)],
      }).catch(() => {});
    }
    return { success: false, error: getFriendlyError(err) };
  }
}

// ── Badge ─────────────────────────────────────────────────────────────────────
async function updateBadge() {
  const data = await chrome.storage.local.get(['badgeEnabled']);
  const enabled = data.badgeEnabled !== false;
  if (!enabled) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  try {
    const db = await openDB();
    const count = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } catch (_) {}
}

// Update badge on install/startup
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

// IndexedDB in service worker
const DB_NAME = 'WordVault';
const DB_VERSION = 1;
const STORE_NAME = 'words';

function openDB() {
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
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToStorage(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}
