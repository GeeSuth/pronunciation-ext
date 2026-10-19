# English Helper — dictionary & pronunciation browser extension

Select any word on a page and a floating toolbar appears with buttons that open
pronunciation and dictionary lookups, plus an inline card with the definition and
audio. Words you look up are saved to a history that doubles as a spaced-repetition
review list, with statistics and optional account sync.

Manifest V3, vanilla JavaScript. **No build step, no dependencies.**

## Features

- **Floating toolbar** on text selection, fully configurable.
- **Dictionaries** (enable / rename / reorder / add your own): Youglish, YouTube,
  Cambridge, Google "how to pronounce", Merriam-Webster, Oxford Learner's, Collins,
  Wiktionary, Forvo, Longman — plus unlimited custom entries with a `{word}` template.
- **Translate button** — one click opens Google Translate for the selected word in your
  configured languages; the same target language is shown inline in the definition card.
  Both source and target language are configurable (50+ languages).
- **Inline definition card** (definitions, phonetics, audio, examples, synonyms, and the
  translation) from the Free Dictionary API, with text-to-speech.
- **Word history** with search, sorting, pagination, per-word notes, source sentence, and
  the saved translation.
- **Spaced repetition** review mode (Again / Hard / Good / Easy).
- **Statistics**: totals, lookups, day streak, due count, 14-day chart, most looked up.
- **Import / export** JSON and CSV.
- **Account sync** (ready for a server — see below).
- Light / dark theme, accent (US / UK / AU), button size, toolbar drag & position.

## Development

Load the folder as an unpacked extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

Reload the extension after editing. There is no build, test, or lint step.

## Settings (options page)

Open the extension popup → **Settings**, or `chrome://extensions` → Details → Extension
options. Everything — dictionaries, features, history behaviour, theme, sync — is
configured there and saved automatically.

## Sync server contract

Set the server URL on the settings page and grant access. The client expects:

| Method | Path               | Body                     | Response                      |
| ------ | ------------------ | ------------------------ | ----------------------------- |
| POST   | `/api/auth/login`  | `{ email, password }`    | `{ token, user }`             |
| POST   | `/api/auth/logout` | — (Bearer token)         | any                           |
| POST   | `/api/sync`        | `{ history, updatedAt }` | `{ history, updatedAt }`      |

The token is sent as `Authorization: Bearer <token>`. `/api/sync` receives the local
history and returns the canonical merged history, which replaces the local copy.
Sync runs automatically after changes when enabled, and on demand from settings.

## License

[MIT License](LICENSE)
