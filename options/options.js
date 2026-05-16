function populateSelect(id, selected) {
  const sel = $(id);
  sel.innerHTML = '';
  LANGUAGES.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = `${lang.flag} ${lang.name}`;
    if (lang.code === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function init() {
  const data = await chrome.storage.local.get(['sourceLang', 'targetLang']);

  populateSelect('source-lang', data.sourceLang || 'en');
  populateSelect('target-lang', data.targetLang || 'vi');

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('source-lang').value = btn.dataset.src;
      $('target-lang').value = btn.dataset.tgt;
    });
  });

  $('btn-save').addEventListener('click', async () => {
    await chrome.storage.local.set({
      sourceLang: $('source-lang').value,
      targetLang: $('target-lang').value,
    });
    const msg = $('save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
  });
}

init();
