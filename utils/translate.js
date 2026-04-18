const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

async function translate(text, sourceLang, targetLang) {
  if (!text || !text.trim()) throw new Error('Empty text');

  const langPair = `${sourceLang}|${targetLang}`;
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text.trim())}&langpair=${langPair}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);

  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || 'Translation failed');

  return {
    translation: data.responseData.translatedText,
    match: data.responseData.match,
  };
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
];
