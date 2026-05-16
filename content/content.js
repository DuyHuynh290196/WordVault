// ── Toast notifications ──────────────────────────────────────────────────────

let toastEl = null;
let toastTimer = null;

const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
  info:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2v6l2 2-2 2v6h12v-6l-2-2 2-2V2H6zm10 14.5V18H8v-1.5l2-2v-3l-2-2V4h8v4.5l-2 2v3l2 2z"/></svg>',
  check:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
  spin:    '<svg viewBox="0 0 24 24" fill="currentColor" class="wv-spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>',
};

function showToast(message, type = 'info') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'wordvault-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.className = type;
  toastEl.innerHTML = `<span class="wv-icon">${ICONS[type] || ICONS.info}</span><span>${message}</span>`;
  requestAnimationFrame(() => requestAnimationFrame(() => toastEl.classList.add('show')));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), type === 'info' ? 1500 : 3000);
}

window.__wordvaultShowToast = showToast;

// ── Feature settings ─────────────────────────────────────────────────────────

let features = { doubleClickEnabled: true, soundEnabled: true };

chrome.storage.local.get(['doubleClickEnabled', 'soundEnabled'], (data) => {
  features.doubleClickEnabled = data.doubleClickEnabled !== false;
  features.soundEnabled = data.soundEnabled !== false;
});

chrome.storage.onChanged.addListener((changes) => {
  if ('doubleClickEnabled' in changes) features.doubleClickEnabled = changes.doubleClickEnabled.newValue !== false;
  if ('soundEnabled' in changes) features.soundEnabled = changes.soundEnabled.newValue !== false;
});

window.__wordvaultPlaySound = () => {
  if (features.soundEnabled) playSuccessSound();
};

// ── Quick-save bubble ────────────────────────────────────────────────────────

let bubble = null;
let bubbleTimer = null;
let pendingWord = '';
let pendingContext = '';

function removeBubble() {
  if (bubble) { bubble.remove(); bubble = null; }
  clearTimeout(bubbleTimer);
  bubbleTimer = null;
}

function getContextAroundSelection(word) {
  try {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return '';
    const text = sel.getRangeAt(0).commonAncestorContainer.textContent || '';
    const i = text.toLowerCase().indexOf(word.toLowerCase());
    if (i === -1) return '';
    return text.slice(Math.max(0, i - 80), Math.min(text.length, i + word.length + 80)).trim();
  } catch (_) { return ''; }
}

function showBubble(x, y, word, context) {
  removeBubble();
  pendingWord = word;
  pendingContext = context;

  bubble = document.createElement('div');
  bubble.id = 'wordvault-bubble';
  bubble.title = `Save "${word}" to WordVault`;
  bubble.innerHTML = '<span class="wv-bubble-label">Save to WordVault</span>';
  bubble.style.left = `${x}px`;
  bubble.style.top = `${y - 44}px`;
  document.body.appendChild(bubble);

  requestAnimationFrame(() => requestAnimationFrame(() => bubble.classList.add('show')));

  bubble.addEventListener('mousedown', handleBubbleClick);
  bubbleTimer = setTimeout(removeBubble, 4000);
}

async function handleBubbleClick(e) {
  e.preventDefault();
  e.stopPropagation();

  bubble.classList.add('loading');
  bubble.innerHTML = `<span class="wv-bubble-icon">${ICONS.spin}</span>`;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'SAVE_WORD',
      text: pendingWord,
      context: pendingContext,
      sourceUrl: location.href,
    });

    if (!res?.success) throw new Error(res?.error || 'Failed');

    bubble.classList.remove('loading');
    bubble.classList.add('done');
    bubble.innerHTML = `<span class="wv-bubble-icon">${ICONS.check}</span>`;

    if (features.soundEnabled) playSuccessSound();
    showToast(`${pendingWord} → ${res.record?.translation || ''}`, 'success');
    bubbleTimer = setTimeout(removeBubble, 1200);
  } catch (err) {
    console.warn('[WordVault] Bubble save failed:', err);
    showToast(getFriendlyError(err), 'error');
    removeBubble();
  }
}

// ── Double-click listener ────────────────────────────────────────────────────

document.addEventListener('dblclick', (e) => {
  if (!features.doubleClickEnabled) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  setTimeout(() => {
    const word = window.getSelection()?.toString().trim();
    if (!word || word.length > 60 || word.includes('\n')) { removeBubble(); return; }

    const context = getContextAroundSelection(word);
    showBubble(e.pageX, e.pageY, word, context);
  }, 10);
});

document.addEventListener('mousedown', (e) => {
  if (bubble && !bubble.contains(e.target)) removeBubble();
});
