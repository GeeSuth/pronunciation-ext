# English Helper — dictionary & pronunciation browser extension

Select any word on a page and a floating toolbar appears with buttons that open
pronunciation and dictionary lookups, plus an inline card with the definition and
audio. Words you look up are saved to a history that doubles as a spaced-repetition
review list, with statistics and optional account sync.

Manifest V3, vanilla JavaScript. **No build step, no dependencies.**

## Features

Supported websites:

1. Dictionary.com
2. Howjsay.com
3. Cambridge Dictionary
4. Youglish.com

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

## Contributors

Thanks to everyone who has contributed to this project!

- [@wilsonkor](https://github.com/wilsonkor) - Contributed feature implementation for configurable delay timer to prevent accidental button triggers during text selection.

## Changelog

### v1.0.9

- Added configurable timing options for dictionary popup buttons
- New setting allows users to adjust delay duration to prevent accidental triggers
- Users can now choose whether popup buttons appear immediately or after holding mouse for a customized duration

### v1.0.8

- Added options to enable/disable individual dictionaries

### v1.0.7

- Renamed the extension from "Dictionary Search" to "Popup Dict"

### v1.0.6

- Removed active tab permission for improved privacy

### v1.0.5

- Fixed inconsistent icon size

### v1.0.4

- Used website icons as buttons to reduce the menu size
