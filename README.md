# WordVault

A Chrome extension for saving, translating, and reviewing vocabulary while browsing the web.

## Features

- **Save words instantly** — right-click context menu, keyboard shortcut (`Ctrl+Shift+S` / `Cmd+Shift+S`), or double-click any word on a page
- **Auto-translate** — words are automatically translated using Google Translate
- **Quick-save popup** — type or paste a word directly in the extension popup with live translation preview
- **Vocabulary manager** — full-page view to browse, search, filter, and manage all saved words
- **Learning progress** — track words with statuses: New, Review, and Known
- **10 languages supported** — English, Vietnamese, Japanese, Korean, Chinese, French, German, Spanish, Italian, Portuguese
- **Customizable** — toggle double-click saving, sound effects, and badge count
- **Context capture** — automatically saves surrounding text for context when saving from a web page
- **Duplicate detection** — saves are deduplicated by word and language pair

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder

## Usage

### Save a word

- **Right-click**: Select text on any page → Right-click → "Save to WordVault"
- **Keyboard shortcut**: Select text → `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)
- **Double-click**: Double-click a word on any page → click the "Save to WordVault" bubble
- **Popup**: Click the extension icon → type a word → Save

### Manage vocabulary

Click the extension icon → "My Vocabulary" to open the full vocabulary page where you can:

- Search words and translations
- Filter by status (New / Review / Known) or language
- Change word status
- Delete individual words or clear all

### Settings

Click the extension icon → Settings gear icon to:

- Change source/target language pair
- Use quick presets (EN→VI, JA→VI, etc.)
- Toggle double-click saving, sound effects, and badge count

## Project Structure

```
WordVault/
├── manifest.json           # Chrome extension manifest (v3)
├── background.js           # Service worker — translation, saving, context menu
├── content/
│   ├── content.js          # Injected into pages — double-click bubble, toasts
│   └── content.css
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Quick save, stats, recent words, settings
│   └── popup.css
├── vocabulary/
│   ├── vocabulary.html     # Full vocabulary management page
│   ├── vocabulary.js       # Search, filter, status management
│   └── vocabulary.css
├── options/
│   ├── options.html        # Settings page
│   ├── options.js
│   └── options.css
├── utils/
│   ├── storage.js          # IndexedDB operations (shared)
│   ├── translate.js        # MyMemory API + language definitions (shared)
│   └── errors.js           # User-friendly error messages (shared)
└── icons/                  # Extension icons (16, 32, 48, 128px)
```

## Tech Stack

- Vanilla JavaScript (no frameworks or dependencies)
- Chrome Extensions Manifest V3
- IndexedDB for local storage
- Google Translate (free, no API key required)
- Web Audio API for sound effects
- Material Icons

## License

MIT
