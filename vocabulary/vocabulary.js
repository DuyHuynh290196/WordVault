// ── State ─────────────────────────────────────────────────────────────────────

let allWords = [];
let filteredWords = [];
let currentPage = 0;
const PAGE_SIZE = 10;
let filters = { search: '', status: '', lang: '', date: '', sort: 'newest' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDateFrom(value) {
  if (!value) return 0;
  if (value === 'today') {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return Date.now() - parseInt(value) * 86400000;
}

function getDateGroup(ts) {
  var now = new Date();
  var date = new Date(ts);
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var yesterdayStart = todayStart - 86400000;
  var weekStart = todayStart - (now.getDay() || 7) * 86400000;
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  if (ts >= todayStart) return 'Today';
  if (ts >= yesterdayStart) return 'Yesterday';
  if (ts >= weekStart) return 'This week';
  if (ts >= monthStart) return 'This month';
  return 'Older';
}

function langLabel(code) {
  return `${LANG_FLAGS[code] || ''} ${code.toUpperCase()}`;
}

// ── Filter & Sort ────────────────────────────────────────────────────────────

function applyFilters() {
  var result = allWords;

  if (filters.status) result = result.filter(function (w) { return w.status === filters.status; });
  if (filters.lang) result = result.filter(function (w) { return w.sourceLang === filters.lang; });
  if (filters.date) {
    var dateFrom = getDateFrom(filters.date);
    result = result.filter(function (w) { return w.createdAt >= dateFrom; });
  }
  if (filters.search) {
    var q = filters.search.toLowerCase();
    result = result.filter(function (w) {
      return w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q);
    });
  }

  // Sort
  switch (filters.sort) {
    case 'oldest':
      result.sort(function (a, b) { return a.createdAt - b.createdAt; });
      break;
    case 'az':
      result.sort(function (a, b) { return a.word.localeCompare(b.word); });
      break;
    case 'za':
      result.sort(function (a, b) { return b.word.localeCompare(a.word); });
      break;
    default:
      result.sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  return result;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderWords() {
  var list = $('word-list');
  var total = filteredWords.length;
  var visibleCount = Math.min((currentPage + 1) * PAGE_SIZE, total);
  var visible = filteredWords.slice(0, visibleCount);
  var useGroups = filters.sort === 'newest' || filters.sort === 'oldest';

  // Header stat
  if (visibleCount < total) {
    $('h-total').textContent = 'Showing ' + visibleCount + ' of ' + total + ' words';
  } else {
    $('h-total').textContent = total + ' word' + (total !== 1 ? 's' : '');
  }

  if (!total) {
    list.innerHTML = '<div class="empty-state">No words found. Start saving vocabulary while browsing!</div>';
    return;
  }

  var html = '';
  var lastGroup = '';

  visible.forEach(function (w) {
    if (useGroups) {
      var group = getDateGroup(w.createdAt);
      if (group !== lastGroup) {
        html += '<div class="date-header">' + group + '</div>';
        lastGroup = group;
      }
    }

    html += '<div class="word-card" data-id="' + w.id + '">' +
      '<div class="word-main">' +
        '<div class="word-text">' + escHtml(w.word) + '</div>' +
        '<div class="word-translation">' + escHtml(w.translation) + '</div>' +
        (w.context ? '<div class="word-context">"' + escHtml(w.context) + '"</div>' : '') +
        '<div class="word-meta">' +
          '<span class="lang-badge">' + langLabel(w.sourceLang) + ' → ' + langLabel(w.targetLang) + '</span>' +
          '<span>' + formatDate(w.createdAt) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="word-actions">' +
        '<select class="status-select ' + w.status + '" data-id="' + w.id + '">' +
          '<option value="new"' + (w.status === 'new' ? ' selected' : '') + '>New</option>' +
          '<option value="review"' + (w.status === 'review' ? ' selected' : '') + '>Review</option>' +
          '<option value="known"' + (w.status === 'known' ? ' selected' : '') + '>Known</option>' +
        '</select>' +
        '<button class="delete-btn" data-id="' + w.id + '" title="Delete"><span class="material-icons-round">delete</span></button>' +
      '</div>' +
    '</div>';
  });

  // Load more button
  if (visibleCount < total) {
    var remaining = total - visibleCount;
    html += '<button id="btn-load-more" class="load-more-btn">Load more (' + remaining + ' remaining)</button>';
  }

  list.innerHTML = html;

  // Event: status change
  list.querySelectorAll('.status-select').forEach(function (sel) {
    sel.addEventListener('change', async function () {
      var id = parseInt(sel.dataset.id);
      await updateWordStatus(id, sel.value);
      sel.className = 'status-select ' + sel.value;
      var idx = allWords.findIndex(function (w) { return w.id === id; });
      if (idx !== -1) allWords[idx].status = sel.value;
    });
  });

  // Event: delete
  list.querySelectorAll('.delete-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var id = parseInt(btn.dataset.id);
      await deleteWord(id);
      allWords = allWords.filter(function (w) { return w.id !== id; });
      filteredWords = applyFilters();
      renderWords();
    });
  });

  // Event: load more
  var loadMoreBtn = $('btn-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      currentPage++;
      renderWords();
    });
  }
}

function populateLangFilter(words) {
  var langs = [...new Set(words.map(function (w) { return w.sourceLang; }))].sort();
  var sel = $('filter-lang');
  sel.innerHTML = '<option value="">All languages</option>';
  langs.forEach(function (code) {
    var opt = document.createElement('option');
    opt.value = code;
    opt.textContent = langLabel(code);
    sel.appendChild(opt);
  });
}

function onFilterChange() {
  currentPage = 0;
  filteredWords = applyFilters();
  renderWords();
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  allWords = await getAllWords();
  populateLangFilter(allWords);
  filteredWords = applyFilters();
  renderWords();

  // Search with debounce
  var searchTimer;
  $('search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      filters.search = e.target.value.trim();
      onFilterChange();
    }, 200);
  });

  $('filter-status').addEventListener('change', function (e) {
    filters.status = e.target.value;
    onFilterChange();
  });

  $('filter-lang').addEventListener('change', function (e) {
    filters.lang = e.target.value;
    onFilterChange();
  });

  $('filter-date').addEventListener('change', function (e) {
    filters.date = e.target.value;
    onFilterChange();
  });

  $('sort-order').addEventListener('change', function (e) {
    filters.sort = e.target.value;
    onFilterChange();
  });

  // Clear all with confirmation modal
  var modal = $('modal-overlay');
  $('btn-clear-all').addEventListener('click', function () { modal.classList.remove('hidden'); });
  $('modal-cancel').addEventListener('click', function () { modal.classList.add('hidden'); });
  $('modal-confirm').addEventListener('click', async function () {
    await clearAllWords();
    allWords = [];
    modal.classList.add('hidden');
    onFilterChange();
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

init();
