// ── Google Translate (free, no key) ──────────────────────────────────────────

const GT_URL = 'https://translate.googleapis.com/translate_a/single';

async function translate(text, sourceLang, targetLang) {
  const trimmed = text?.trim();
  if (!trimmed) throw new Error('Empty text');

  const url = `${GT_URL}?${new URLSearchParams({
    client: 'gtx', sl: sourceLang, tl: targetLang, dt: 't', q: trimmed,
  })}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);

  const data = await res.json();
  if (!data?.[0]?.[0]?.[0]) throw new Error('Translation failed');

  return {
    translation: data[0].map((seg) => seg[0]).join(''),
    detectedLang: data[2] || sourceLang,
  };
}

// ── Supported languages ─────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇬🇧' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', name: '日本語',      flag: '🇯🇵' },
  { code: 'ko', name: '한국어',      flag: '🇰🇷' },
  { code: 'zh', name: '中文',        flag: '🇨🇳' },
  { code: 'fr', name: 'Français',   flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch',    flag: '🇩🇪' },
  { code: 'es', name: 'Español',    flag: '🇪🇸' },
  { code: 'it', name: 'Italiano',   flag: '🇮🇹' },
  { code: 'pt', name: 'Português',  flag: '🇵🇹' },
];

const LANG_NAMES = {};
LANGUAGES.forEach((l) => { LANG_NAMES[l.code] = `${l.flag} ${l.code.toUpperCase()}`; });

const LANG_FLAGS = {};
LANGUAGES.forEach((l) => { LANG_FLAGS[l.code] = l.flag; });
