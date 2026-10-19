# AGENTS.md

## What this is

Vanilla-JS MV3 browser extension ("English Helper"). Selecting text shows a floating
toolbar that opens configurable pronunciation/dictionary lookups, plus an inline
definition/audio card. Lookups are saved to a word history that also drives spaced
repetition, stats, and optional account sync. **No build system, no package.json, no
tests, no linter.** Do not add npm/tooling unless asked.

## Run / verify

Nothing to build or test. Load the folder as an unpacked extension (`chrome://extensions`
→ Developer mode → Load unpacked) and exercise the page. There is no CI. After editing
any script, reload the extension; pages opened before a reload need a refresh (the
service worker injects the content scripts on demand via `scripting` for those tabs).

You can smoke-test the data layer in Node (it only needs a `chrome.storage` stub):

- `common.js` and `methods.js` load and run under `require()` with a fake
  `globalThis.chrome` — used to verify settings merge, `addWord`, SRS, stats, import/export.
- `background.js` / `content.js` / page scripts need a browser; they reference `document`,
  `importScripts`, or DOM events and cannot run in Node.

## Architecture

One global namespace `EH` (defined in `common.js`) shared by every context. `common.js`
must load **first** everywhere.

- `common.js` — settings (defaults + merge), dictionary registry, storage helpers,
  history CRUD, `EH.srs` (SM-2), `EH.computeStats`, `EH.fetchDefinition` (network),
  `EH.syncApi`, import/export. Single source of truth.
- `methods.js` — `EH.buildUrl(dict, word, settings)` and `EH.buildTranslateUrl(word, settings)`;
  every dictionary is a template string with `{word}` / `{accent}`. Loaded after `common.js`.
- `background.js` — service worker. Loads the core via `importScripts("common.js")`.
  Owns: context menu, keyboard commands, badge, the definition-API proxy, and the sync
  runner. Content/page code never fetches cross-origin directly.
- `content.js` — floating toolbar + inline card, rendered in a **Shadow DOM** host
  (`#english-helper-root`) for style isolation; it links `content.css` inside the shadow,
  so `content.css` must stay in `web_accessible_resources`.
- `options.html/js` — the configuration page (dictionaries, features, sync, data).
- `popup.html/js` — toolbar popup (toggle, quick stats, shortcuts).
- `history.html/js` — History / Review / Stats tabs.

## Conventions / gotchas

- **Settings live in `chrome.storage.sync` key `settings`; history and auth in
  `chrome.storage.local`.** Always read via `EH.getSettings()` (it deep-merges defaults and
  backfills new built-in dictionaries), never read the raw key directly.
- **Adding a dictionary to the defaults**: append to `EH.DEFAULT_DICTIONARIES` in
  `common.js` with a unique `id`, a `urlTemplate`, and either `icon` (packaged image — also
  add it to `web_accessible_resources`) or `emoji`. `ensureDictionaries` adds it for
  existing users on next load. No other file needs editing; the options page renders it.
- **Never `fetch` from `content.js`** — route network calls through the service worker
  (`runtime.sendMessage({ type: "define" | "translate" | "sync-now" | "login" | "logout" })`).
  Permitted hosts: the dictionary API, the Google Translate endpoint, and the granted sync
  host (all declared in `manifest.json` `host_permissions` / `optional_host_permissions`).
- **Translation** goes through `EH.fetchTranslation` (SW-only, cached in local `transcache`
  like `defcache`). It tries `clients5.google.com` first and falls back to
  `translate.googleapis.com` (both need host permission). `client=dict-chrome-ex` +
  `dt=t&dt=bd` returns the primary translation plus `data[1]` = alternative terms grouped
  by part of speech; `EH.parseTranslation` normalizes that into `{ text, alternatives[] }`.
  Languages come from `EH.TRANSLATE_LANGUAGES`; `settings.translate` holds `source` /
  `target` / `inline` / `definitions`. Add a language by editing that array only.
- The service worker adds storage-change listeners (`EH.onHistoryChanged`,
  `EH.onSettingsChanged`); content and page scripts re-read settings the same way.
- **Options page:** never replace the live `settings` object with the return value of
  `EH.saveSettings` (it is a deep clone). Dictionary rows hold references into the current
  `settings.dictionaries`, so reassigning orphans every row's handlers and later edits stop
  saving until reload. `options.js` keeps one live object and serializes saves via
  `saving` / `pendingSave` in `flushSave`.
- Bump `version` in `manifest.json` for releases.
- `defcache` in local storage caches definitions for 30 days (bounded to 500 entries).

## Sync server (not yet built)

Client contract is implemented in `EH.syncApi` (`common.js`) and documented in the README:
`POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/sync` (Bearer token; returns the
canonical merged history). The options page requests host permission for the server origin
via `chrome.permissions.request` before login.
