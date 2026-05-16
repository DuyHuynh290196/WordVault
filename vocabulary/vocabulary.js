// ── State ─────────────────────────────────────────────────────────────────────

let allWords = [];
let filters = { search: '', status: '', lang: '' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

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

function langLabel(code) {
  return `${LANG_FLAGS[code] || ''} ${code.toUpperCase()}`;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderWords(words) {
  const list = $('word-list');
  $('h-total').textContent = `${words.length} word${words.length !== 1 ? 's' : ''}`;

  if (!words.length) {
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
          <span class="lang-badge">${langLabel(w.sourceLang)} → ${langLabel(w.targetLang)}</span>
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

  // Status change
  list.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = parseInt(sel.dataset.id);
      await updateWordStatus(id, sel.value);
      sel.className = `status-select ${sel.value}`;
      const idx = allWords.findIndex((w) => w.id === id);
      if (idx !== -1) allWords[idx].status = sel.value;
    });
  });

  // Delete
  list.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      await deleteWord(id);
      allWords = allWords.filter((w) => w.id !== id);
      renderWords(applyFilters());
    });
  });
}

function populateLangFilter(words) {
  const langs = [...new Set(words.map((w) => w.sourceLang))].sort();
  const sel = $('filter-lang');
  sel.innerHTML = '<option value="">All languages</option>';
  langs.forEach((code) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = langLabel(code);
    sel.appendChild(opt);
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  allWords = await getAllWords();
  populateLangFilter(allWords);
  renderWords(applyFilters());

  // Search with debounce
  let searchTimer;
  $('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.search = e.target.value.trim();
      renderWords(applyFilters());
    }, 200);
  });

  $('filter-status').addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderWords(applyFilters());
  });

  $('filter-lang').addEventListener('change', (e) => {
    filters.lang = e.target.value;
    renderWords(applyFilters());
  });

  // Clear all with confirmation modal
  const modal = $('modal-overlay');
  $('btn-clear-all').addEventListener('click', () => modal.classList.remove('hidden'));
  $('modal-cancel').addEventListener('click', () => modal.classList.add('hidden'));
  $('modal-confirm').addEventListener('click', async () => {
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
