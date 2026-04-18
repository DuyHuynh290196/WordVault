function getFriendlyError(err) {
  const msg = (err?.message || err || '').toString().toLowerCase();

  if (msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('load failed'))
    return 'No internet connection. Please check your network.';

  if (msg.includes('http error 429') || msg.includes('rate limit'))
    return 'Too many requests. Please wait a moment and try again.';

  if (msg.includes('http error 5') || msg.includes('service unavailable'))
    return 'Translation service is temporarily unavailable.';

  if (msg.includes('http error 4'))
    return 'Could not reach translation service. Try again later.';

  if (msg.includes('translation failed') || msg.includes('mymemory'))
    return 'Translation failed. Try again or check your language settings.';

  if (msg.includes('empty text') || msg.includes('no text'))
    return 'Please select or enter a word first.';

  if (msg.includes('quota') || msg.includes('storage'))
    return 'Storage is full. Please delete some words and try again.';

  if (msg.includes('extension context') || msg.includes('invalidated'))
    return 'Extension was updated. Please refresh the page.';

  if (msg.includes('could not establish connection') || msg.includes('receiving end does not exist'))
    return 'Could not connect. Please refresh the page.';

  return 'Something went wrong. Please try again.';
}
