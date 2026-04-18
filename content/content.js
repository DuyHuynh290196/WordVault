// ── Toast ────────────────────────────────────────────────────────────────────
let toastEl = null;
let toastTimer = null;

function createToast() {
  if (toastEl) return;
  toastEl = document.createElement('div');
  toastEl.id = 'wordvault-toast';
  document.body.appendChild(toastEl);
}

const SVG = {
  success: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  error:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
  info:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2v6l2 2-2 2v6h12v-6l-2-2 2-2V2H6zm10 14.5V18H8v-1.5l2-2v-3l-2-2V4h8v4.5l-2 2v3l2 2z"/></svg>`,
  lock:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`,
  check:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  spin:    `<svg viewBox="0 0 24 24" fill="currentColor" class="wv-spin"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>`,
};

function showToast(message, type = 'info') {
  createToast();
  toastEl.className = `${type}`;
  toastEl.innerHTML = `<span class="wv-icon">${SVG[type] || SVG.info}</span><span>${message}</span>`;
  requestAnimationFrame(() => requestAnimationFrame(() => toastEl.classList.add('show')));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), type === 'info' ? 1500 : 3000);
}

window.__wordvaultShowToast = showToast;

// ── Feature settings cache ────────────────────────────────────────────────────
let featureSettings = { doubleClickEnabled: true, soundEnabled: true };

chrome.storage.local.get(['doubleClickEnabled', 'soundEnabled'], (data) => {
  featureSettings.doubleClickEnabled = data.doubleClickEnabled !== false;
  featureSettings.soundEnabled       = data.soundEnabled !== false;
});

chrome.storage.onChanged.addListener((changes) => {
  if ('doubleClickEnabled' in changes) featureSettings.doubleClickEnabled = changes.doubleClickEnabled.newValue !== false;
  if ('soundEnabled' in changes)       featureSettings.soundEnabled       = changes.soundEnabled.newValue !== false;
});

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

// ── Quick-save bubble (double-click) ─────────────────────────────────────────
let bubble = null;
let bubbleTimer = null;
let pendingWord = '';
let pendingContext = '';

function removeBubble() {
  if (bubble) { bubble.remove(); bubble = null; }
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
}

function showBubble(x, y, word, context) {
  removeBubble();
  pendingWord = word;
  pendingContext = context;

  bubble = document.createElement('div');
  bubble.id = 'wordvault-bubble';
  bubble.title = `Save "${word}" to WordVault`;
  bubble.innerHTML = `<span class="wv-bubble-label">Save to WordVault</span>`;

  // Position above the selection
  bubble.style.left = `${x}px`;
  bubble.style.top = `${y - 44}px`;

  document.body.appendChild(bubble);

  // Animate in
  requestAnimationFrame(() => requestAnimationFrame(() => bubble.classList.add('show')));

  bubble.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    bubble.classList.add('loading');
    bubble.innerHTML = `<span class="wv-bubble-icon">${SVG.spin}</span>`;

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD_KNOWN',
        text: pendingWord,
        context: pendingContext,
        sourceUrl: location.href,
      });

      if (res?.success) {
        bubble.classList.remove('loading');
        bubble.classList.add('done');
        bubble.innerHTML = `<span class="wv-bubble-icon">${SVG.check}</span>`;
        const translation = res.record?.translation || '';
        if (featureSettings.soundEnabled) playSuccessSound();
        showToast(`${pendingWord} → ${translation}`, 'success');
        bubbleTimer = setTimeout(removeBubble, 1200);
      } else {
        throw new Error(res?.error || 'Failed');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      removeBubble();
    }
  });

  // Auto-hide after 4 s of inactivity
  bubbleTimer = setTimeout(removeBubble, 4000);
}

// Double-click on page → show bubble near selection
document.addEventListener('dblclick', (e) => {
  if (!featureSettings.doubleClickEnabled) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

  setTimeout(() => {
    const sel = window.getSelection();
    const word = sel?.toString().trim();
    if (!word || word.length > 60 || word.includes('\n')) { removeBubble(); return; }

    // Get context sentence
    let context = '';
    try {
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const text = container.textContent || '';
      const idx = text.toLowerCase().indexOf(word.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(text.length, idx + word.length + 80);
        context = text.slice(start, end).trim();
      }
    } catch (_) {}

    // Position bubble at cursor
    showBubble(e.pageX, e.pageY, word, context);
  }, 10); // slight delay so selection is finalised
});

// Click outside → close bubble
document.addEventListener('mousedown', (e) => {
  if (bubble && !bubble.contains(e.target)) removeBubble();
});
