importScripts('utils/errors.js', 'utils/translate.js', 'utils/storage.js');

// ── Settings ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const data = await chrome.storage.local.get(['sourceLang', 'targetLang']);
  return {
    sourceLang: data.sourceLang || 'en',
    targetLang: data.targetLang || 'vi',
  };
}

// ── Context menu ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-wordvault',
    title: 'Save to WordVault',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-to-wordvault') return;
  const text = info.selectionText?.trim();
  if (!text) return;
  await processAndSaveWord(text, tab, await getSettings());
});

// ── Keyboard shortcut ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-word') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const [{ result: text }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString().trim() || '',
  });
  if (!text) return;

  await processAndSaveWord(text, tab, await getSettings());
});

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    SAVE_WORD: () => {
      getSettings().then((s) =>
        processAndSaveWord(msg.text, { url: msg.sourceUrl }, s, msg.context)
      ).then(sendResponse);
    },
    SAVE_WORD_KNOWN: () => {
      getSettings().then((s) =>
        processAndSaveWord(msg.text, { url: msg.sourceUrl }, s, msg.context, 'known')
      ).then(sendResponse);
    },
    TRANSLATE: () => {
      translate(msg.text, msg.sourceLang, msg.targetLang)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: getFriendlyError(err) }));
    },
    GET_SETTINGS: () => getSettings().then(sendResponse),
    UPDATE_BADGE: () => { updateBadge(); sendResponse({ ok: true }); },
  };

  if (handlers[msg.type]) {
    handlers[msg.type]();
    return true;
  }
});

// ── Core: translate + save ───────────────────────────────────────────────────

function notifyTab(tab, fn, args = []) {
  if (!tab?.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id }, func: fn, args,
  }).catch(() => {});
}

function extractContext(tab, word) {
  if (!tab?.id) return Promise.resolve('');
  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (w) => {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return '';
      const text = sel.getRangeAt(0).commonAncestorContainer.textContent || '';
      const i = text.toLowerCase().indexOf(w.toLowerCase());
      if (i === -1) return '';
      return text.slice(Math.max(0, i - 80), Math.min(text.length, i + w.length + 80)).trim();
    },
    args: [word],
  }).then((r) => r?.[0]?.result || '').catch(() => '');
}

async function processAndSaveWord(text, tab, settings, context = '', status = 'new') {
  const { sourceLang, targetLang } = settings;

  notifyTab(tab, (w) => {
    if (window.__wordvaultShowToast) window.__wordvaultShowToast(`Saving "${w}"...`, 'info');
  }, [text]);

  try {
    const { translation } = await translate(text, sourceLang, targetLang);

    if (!context) context = await extractContext(tab, text);

    const record = await saveWord(
      { word: text, translation, context, sourceUrl: tab?.url || '', sourceLang, targetLang },
      status,
    );

    updateBadge();

    notifyTab(tab, (w, t) => {
      if (window.__wordvaultShowToast) window.__wordvaultShowToast(`${w} → ${t}`, 'success');
      if (window.__wordvaultPlaySound) window.__wordvaultPlaySound();
    }, [text, translation]);

    return { success: true, record };
  } catch (err) {
    console.warn('[WordVault] Save failed:', err);
    const friendly = getFriendlyError(err);
    notifyTab(tab, (m) => {
      if (window.__wordvaultShowToast) window.__wordvaultShowToast(m, 'error');
    }, [friendly]);
    return { success: false, error: friendly };
  }
}

// ── Badge ────────────────────────────────────────────────────────────────────

async function updateBadge() {
  const { badgeEnabled } = await chrome.storage.local.get(['badgeEnabled']);
  if (badgeEnabled === false) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  try {
    const count = await getWordCount();
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } catch (e) {
    console.warn('[WordVault] Badge update failed:', e);
  }
}

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
