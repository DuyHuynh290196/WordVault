// ── State ─────────────────────────────────────────────────────────────────────

let deck = [];
let currentIndex = 0;
let isFlipped = false;
let sessionStats = { dontKnow: 0, learning: 0, gotIt: 0 };

// ── Deck building ────────────────────────────────────────────────────────────

async function buildDeck() {
  const statusFilter = $('filter-status').value;
  const langFilter = $('filter-lang').value;

  let words = await getAllWords();

  if (statusFilter) {
    const statuses = statusFilter.split(',');
    words = words.filter((w) => statuses.includes(w.status));
  }
  if (langFilter) {
    words = words.filter((w) => w.sourceLang === langFilter);
  }

  const dateFilter = $('filter-date').value;
  if (dateFilter) {
    let dateFrom;
    if (dateFilter === 'today') {
      const d = new Date(); d.setHours(0, 0, 0, 0); dateFrom = d.getTime();
    } else {
      dateFrom = Date.now() - parseInt(dateFilter) * 86400000;
    }
    words = words.filter((w) => w.createdAt >= dateFrom);
  }

  // Spaced repetition priority: new first, then review, then known
  const priority = { new: 0, review: 1, known: 2 };
  words.sort((a, b) => (priority[a.status] ?? 3) - (priority[b.status] ?? 3));

  if ($('toggle-shuffle').checked) {
    // Shuffle within each priority group
    const groups = {};
    words.forEach((w) => {
      const p = priority[w.status] ?? 3;
      if (!groups[p]) groups[p] = [];
      groups[p].push(w);
    });
    words = [];
    Object.keys(groups).sort().forEach((key) => {
      shuffle(groups[key]);
      words.push(...groups[key]);
    });
  }

  return words;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Populate language filter ─────────────────────────────────────────────────

async function populateLangFilter() {
  const words = await getAllWords();
  const langs = [...new Set(words.map((w) => w.sourceLang))].sort();
  const sel = $('filter-lang');
  sel.innerHTML = '<option value="">All languages</option>';
  langs.forEach((code) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${LANG_FLAGS[code] || ''} ${code.toUpperCase()}`;
    sel.appendChild(opt);
  });
}

// ── Card rendering ───────────────────────────────────────────────────────────

function showCard() {
  if (!deck.length) {
    $('card-area').classList.add('hidden');
    $('actions').classList.add('hidden');
    $('done-state').classList.add('hidden');
    $('empty-state').classList.remove('hidden');
    $('progress').textContent = '0 / 0';
    return;
  }

  $('empty-state').classList.add('hidden');
  $('done-state').classList.add('hidden');
  $('card-area').classList.remove('hidden');

  if (currentIndex >= deck.length) {
    showDone();
    return;
  }

  const word = deck[currentIndex];
  isFlipped = false;
  $('card-inner').classList.remove('flipped');
  $('actions').classList.add('hidden');

  $('card-word').textContent = word.word;
  $('card-hint').textContent = 'Click or press Space to flip';
  $('card-translation').textContent = word.translation;
  $('card-context').textContent = word.context ? `"${word.context}"` : '';
  $('card-meta').textContent = `${LANG_FLAGS[word.sourceLang] || ''} ${word.sourceLang.toUpperCase()} → ${LANG_FLAGS[word.targetLang] || ''} ${word.targetLang.toUpperCase()} · ${word.status}`;

  $('progress').textContent = `${currentIndex + 1} / ${deck.length}`;
}

function flipCard() {
  if (!deck.length || currentIndex >= deck.length) return;
  isFlipped = !isFlipped;
  $('card-inner').classList.toggle('flipped', isFlipped);
  if (isFlipped) {
    $('actions').classList.remove('hidden');
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function rateCard(newStatus) {
  if (currentIndex >= deck.length) return;

  const word = deck[currentIndex];

  if (newStatus === 'new') {
    sessionStats.dontKnow++;
  } else if (newStatus === 'review') {
    sessionStats.learning++;
  } else if (newStatus === 'known') {
    sessionStats.gotIt++;
    playSuccessSound();
  }

  if (word.status !== newStatus) {
    await updateWordStatus(word.id, newStatus);
    word.status = newStatus;
  }

  currentIndex++;
  showCard();
}

// ── Done state ───────────────────────────────────────────────────────────────

function showDone() {
  $('card-area').classList.add('hidden');
  $('actions').classList.add('hidden');
  $('done-state').classList.remove('hidden');

  const total = sessionStats.dontKnow + sessionStats.learning + sessionStats.gotIt;
  $('done-summary').textContent =
    `You reviewed ${total} card${total !== 1 ? 's' : ''}: ` +
    `${sessionStats.gotIt} known, ${sessionStats.learning} learning, ${sessionStats.dontKnow} to review.`;
}

// ── Session control ──────────────────────────────────────────────────────────

async function startSession() {
  currentIndex = 0;
  isFlipped = false;
  sessionStats = { dontKnow: 0, learning: 0, gotIt: 0 };
  deck = await buildDeck();
  showCard();
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      flipCard();
      break;
    case '1':
      if (isFlipped) rateCard('new');
      break;
    case '2':
      if (isFlipped) rateCard('review');
      break;
    case '3':
      if (isFlipped) rateCard('known');
      break;
    case 'ArrowRight':
      if (isFlipped) rateCard(deck[currentIndex]?.status || 'new');
      else flipCard();
      break;
    case 'ArrowLeft':
      if (currentIndex > 0) { currentIndex--; showCard(); }
      break;
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await populateLangFilter();
  await startSession();

  $('flashcard').addEventListener('click', flipCard);

  $('btn-dont-know').addEventListener('click', () => rateCard('new'));
  $('btn-learning').addEventListener('click', () => rateCard('review'));
  $('btn-got-it').addEventListener('click', () => rateCard('known'));

  $('btn-restart').addEventListener('click', startSession);
  $('btn-review-again').addEventListener('click', startSession);

  $('filter-status').addEventListener('change', startSession);
  $('filter-lang').addEventListener('change', startSession);
  $('filter-date').addEventListener('change', startSession);
  $('toggle-shuffle').addEventListener('change', startSession);
}

init();
