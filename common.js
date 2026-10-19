/*
 * common.js - Shared core for every extension context.
 *
 * Loaded FIRST as a content script, imported by the service worker via
 * importScripts('common.js'), and included as a plain <script> in extension
 * pages. Everything hangs off the global `EH` namespace so there is no build
 * step and no cross-file global soup beyond this one object.
 */
(function (root) {
  "use strict";

  const api = root.chrome || root.browser || {};
  const EH = (root.EH = root.EH || {});
  EH.api = api;
  EH.VERSION = "3.0.0";

  /* ------------------------------------------------------------------ *
   * Constants / defaults
   * ------------------------------------------------------------------ */

  EH.ACCENTS = [
    { id: "us", label: "US", lang: "en-US" },
    { id: "uk", label: "UK", lang: "en-GB" },
    { id: "au", label: "AU", lang: "en-AU" }
  ];

  /* Languages available for translation. `auto` is only valid as a source. */
  EH.TRANSLATE_LANGUAGES = [
    { code: "auto", name: "Detect language", sourceOnly: true },
    { code: "en", name: "English" },
    { code: "th", name: "Thai" },
    { code: "vi", name: "Vietnamese" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "zh-TW", name: "Chinese (Traditional)" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "es", name: "Spanish" },
    { code: "pt", name: "Portuguese" },
    { code: "it", name: "Italian" },
    { code: "ru", name: "Russian" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
    { code: "id", name: "Indonesian" },
    { code: "ms", name: "Malay" },
    { code: "nl", name: "Dutch" },
    { code: "pl", name: "Polish" },
    { code: "tr", name: "Turkish" },
    { code: "sv", name: "Swedish" },
    { code: "da", name: "Danish" },
    { code: "no", name: "Norwegian" },
    { code: "fi", name: "Finnish" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "uk", name: "Ukrainian" },
    { code: "cs", name: "Czech" },
    { code: "ro", name: "Romanian" },
    { code: "hu", name: "Hungarian" },
    { code: "sk", name: "Slovak" },
    { code: "bg", name: "Bulgarian" },
    { code: "hr", name: "Croatian" },
    { code: "sr", name: "Serbian" },
    { code: "lt", name: "Lithuanian" },
    { code: "lv", name: "Latvian" },
    { code: "et", name: "Estonian" },
    { code: "sl", name: "Slovenian" },
    { code: "fa", name: "Persian" },
    { code: "bn", name: "Bengali" },
    { code: "ta", name: "Tamil" },
    { code: "te", name: "Telugu" },
    { code: "mr", name: "Marathi" },
    { code: "gu", name: "Gujarati" },
    { code: "kn", name: "Kannada" },
    { code: "ml", name: "Malayalam" },
    { code: "pa", name: "Punjabi" },
    { code: "ur", name: "Urdu" },
    { code: "sw", name: "Swahili" },
    { code: "fil", name: "Filipino" }
  ];

  EH.languageName = function (code) {
    const l = EH.TRANSLATE_LANGUAGES.find((x) => x.code === code);
    return l ? l.name : code;
  };

  /*
   * Built-in dictionaries. `urlTemplate` supports {word} and {accent}.
   * `icon` is a packaged image path (exposed in web_accessible_resources),
   * `emoji` is a fallback glyph for dictionaries without a raster icon.
   */
  EH.DEFAULT_DICTIONARIES = [
    {
      id: "youglish",
      name: "Youglish",
      icon: "images/brandyg.png",
      emoji: "\uD83C\uDFA7",
      builtin: true,
      enabled: true,
      accent: true,
      urlTemplate: "https://youglish.com/pronounce/{word}/english/{accent}"
    },
    {
      id: "youtube",
      name: "YouTube",
      icon: "images/youtube.png",
      emoji: "\u25B6\uFE0F",
      builtin: true,
      enabled: true,
      urlTemplate: "https://www.youtube.com/results?search_query={word}"
    },
    {
      id: "cambridge",
      name: "Cambridge Dictionary",
      icon: "images/cam-dict.jpeg",
      emoji: "\uD83C\uDF93",
      builtin: true,
      enabled: true,
      urlTemplate: "https://dictionary.cambridge.org/dictionary/english/{word}"
    },
    {
      id: "google",
      name: "Google (how to pronounce)",
      icon: "images/google.png",
      emoji: "\uD83D\uDD0D",
      builtin: true,
      enabled: true,
      urlTemplate: "https://www.google.com/search?q=how+to+pronounce+{word}"
    },
    {
      id: "merriam",
      name: "Merriam-Webster",
      emoji: "\uD83D\uDCD6",
      builtin: true,
      enabled: false,
      urlTemplate: "https://www.merriam-webster.com/dictionary/{word}"
    },
    {
      id: "oxford",
      name: "Oxford Learner's",
      emoji: "\uD83C\uDF93",
      builtin: true,
      enabled: false,
      urlTemplate: "https://www.oxfordlearnersdictionaries.com/definition/english/{word}"
    },
    {
      id: "collins",
      name: "Collins",
      emoji: "\uD83D\uDCDA",
      builtin: true,
      enabled: false,
      urlTemplate: "https://www.collinsdictionary.com/dictionary/english/{word}"
    },
    {
      id: "wiktionary",
      name: "Wiktionary",
      emoji: "\uD83D\uDCD8",
      builtin: true,
      enabled: false,
      urlTemplate: "https://en.wiktionary.org/wiki/{word}"
    },
    {
      id: "forvo",
      name: "Forvo",
      emoji: "\uD83D\uDD0A",
      builtin: true,
      enabled: false,
      urlTemplate: "https://forvo.com/word/{word}/"
    },
    {
      id: "longman",
      name: "Longman",
      emoji: "\uD83D\uDCD5",
      builtin: true,
      enabled: false,
      urlTemplate: "https://www.ldoceonline.com/dictionary/{word}"
    }
  ];

  EH.DEFAULT_SETTINGS = {
    enabled: true,
    accent: "us",
    buttonSize: "md", // sm | md | lg
    theme: "auto", // auto | light | dark
    position: { mode: "cursor", x: 0, y: 0 }, // cursor | fixed
    features: {
      inlineCard: true,
      translate: true,
      tts: true,
      autoSpeak: false,
      contextSentence: true,
      contextMenu: true,
      badge: true,
      dragToolbar: true,
      closeOnClickOutside: true,
      openInPopupWindow: true
    },
    card: {
      definition: true,
      audio: true,
      examples: true,
      synonyms: true
    },
    history: {
      pageSize: 20,
      captureSentence: true,
      dedupe: true,
      keepNotes: true
    },
    srs: {
      enabled: true,
      newPerDay: 20,
      ease: 2.5
    },
    translate: {
      source: "auto", // "auto" or a language code
      target: "th", // configurable target language
      inline: true, // show the translated word inside the definition card
      definitions: true // also translate the definition text (not just the word)
    },
    sync: {
      apiBaseUrl: "",
      autoSync: true,
      email: ""
    },
    dictionaries: []
  };

  /* ------------------------------------------------------------------ *
   * Tiny utils
   * ------------------------------------------------------------------ */

  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

  EH.clone = (o) => (o === undefined ? o : JSON.parse(JSON.stringify(o)));

  EH.deepMerge = function deepMerge(base, over) {
    let out;
    if (Array.isArray(base)) out = base.slice();
    else if (isObj(base)) out = Object.assign({}, base);
    else return over === undefined ? base : over;

    if (!isObj(over) && !Array.isArray(over)) return over === undefined ? out : over;

    for (const k of Object.keys(over)) {
      const b = out[k];
      const o = over[k];
      if (Array.isArray(o)) out[k] = EH.clone(o);
      else if (isObj(o) && isObj(b)) out[k] = EH.deepMerge(b, o);
      else if (o !== undefined) out[k] = o;
    }
    return out;
  };

  EH.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  EH.todayKey = (d) => {
    const x = d ? new Date(d) : new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  };

  /* ------------------------------------------------------------------ *
   * Storage helpers (promise wrappers, work in SW + pages)
   * ------------------------------------------------------------------ */

  EH.get = (area, keys) =>
    new Promise((resolve) => {
      try {
        api.storage[area].get(keys, (r) => resolve(r || {}));
      } catch (e) {
        resolve({});
      }
    });

  EH.set = (area, obj) =>
    new Promise((resolve) => {
      try {
        api.storage[area].set(obj, () => resolve());
      } catch (e) {
        resolve();
      }
    });

  EH.remove = (area, keys) =>
    new Promise((resolve) => {
      try {
        api.storage[area].remove(keys, () => resolve());
      } catch (e) {
        resolve();
      }
    });

  /* ------------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------------ */

  // Add any built-in dictionary that a stored settings blob predates so that
  // upgrades surface new sites (respecting their default enabled state).
  function ensureDictionaries(list) {
    const arr = Array.isArray(list) && list.length ? list.slice() : EH.clone(EH.DEFAULT_DICTIONARIES);
    const have = new Set(arr.map((d) => d.id));
    EH.DEFAULT_DICTIONARIES.forEach((d) => {
      if (!have.has(d.id)) arr.push(EH.clone(d));
    });
    return arr.map((d, i) => Object.assign({ order: i }, d)).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  EH.mergeSettings = function (stored) {
    const merged = EH.deepMerge(EH.DEFAULT_SETTINGS, stored || {});
    merged.dictionaries = ensureDictionaries(merged.dictionaries);
    return merged;
  };

  EH.getSettings = async function () {
    const data = await EH.get("sync", "settings");
    return EH.mergeSettings(data.settings);
  };

  EH.saveSettings = async function (settings) {
    const normalized = EH.mergeSettings(settings);
    await EH.set("sync", { settings: normalized });
    return normalized;
  };

  EH.onSettingsChanged = function (cb) {
    api.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.settings) {
        cb(EH.mergeSettings(changes.settings.newValue));
      }
    });
  };

  /* ------------------------------------------------------------------ *
   * Word history (local storage; server sync mirrors this list later)
   * ------------------------------------------------------------------ */

  EH.getHistory = async function () {
    const data = await EH.get("local", "history");
    return Array.isArray(data.history) ? data.history : [];
  };

  EH.saveHistory = async function (list) {
    await EH.set("local", { history: list });
    await EH.markDirty();
    return list;
  };

  EH.onHistoryChanged = function (cb) {
    api.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.history) cb(changes.history.newValue || []);
    });
  };

  /*
   * Record a lookup. Dedupes case-insensitively, bumps count, refreshes
   * updatedAt, optionally captures the surrounding sentence / source URL,
   * and (for brand new words) seeds the SRS schedule.
   */
  EH.addWord = async function (rawWord, opts) {
    const options = opts || {};
    const word = String(rawWord || "").trim();
    if (!word) return null;

    const settings = await EH.getSettings();
    const list = await EH.getHistory();
    const idx = list.findIndex((it) => String(it.word || "").toLowerCase() === word.toLowerCase());
    const now = Date.now();
    const today = new Date().toLocaleString();

    if (idx !== -1) {
      const item = list[idx];
      if (!settings.history.dedupe) {
        list.push(makeItem(word, options, now, today, settings));
      } else {
        item.count = (item.count || 1) + 1;
        item.datetime = today;
        item.updatedAt = now;
        if (options.sentence && (!item.sentence || options.sentence.length > item.sentence.length)) {
          item.sentence = options.sentence;
        }
        if (options.sourceUrl && !item.sourceUrl) item.sourceUrl = options.sourceUrl;
        if (options.translation && !item.translation) item.translation = options.translation;
        list[idx] = item;
      }
    } else {
      const item = makeItem(word, options, now, today, settings);
      list.push(item);
    }

    await EH.saveHistory(list);
    return list;
  };

  function makeItem(word, options, now, today, settings) {
    const due = settings.srs.enabled ? now : 0;
    return {
      id: EH.uid(),
      word: word,
      count: 1,
      datetime: today,
      createdAt: now,
      updatedAt: now,
      sentence: options.sentence || "",
      sourceUrl: options.sourceUrl || "",
      translation: options.translation || "",
      notes: "",
      tags: [],
      srs: { due: due, interval: 0, ease: settings.srs.ease || 2.5, reps: 0, lapses: 0, last: 0 }
    };
  }

  EH.updateWord = async function (id, patch) {
    const list = await EH.getHistory();
    const idx = list.findIndex((it) => it.id === id);
    if (idx === -1) return list;
    list[idx] = Object.assign({}, list[idx], patch, { updatedAt: Date.now() });
    await EH.saveHistory(list);
    return list;
  };

  EH.removeWord = async function (id) {
    const list = await EH.getHistory();
    const next = list.filter((it) => it.id !== id);
    await EH.saveHistory(next);
    return next;
  };

  EH.clearHistory = async function () {
    await EH.saveHistory([]);
    return [];
  };

  /* ------------------------------------------------------------------ *
   * Spaced repetition (lightweight SM-2)
   * ------------------------------------------------------------------ */

  EH.srs = {
    // grade: 0 = again, 1 = hard, 2 = good, 3 = easy
    apply: function (item, grade, easeSetting) {
      const base = easeSetting || 2.5;
      const srs = Object.assign({ due: 0, interval: 0, ease: base, reps: 0, lapses: 0, last: 0 }, item.srs || {});
      const now = Date.now();
      const g = Number(grade) || 0;

      if (g === 0) {
        srs.lapses = (srs.lapses || 0) + 1;
        srs.reps = 0;
        srs.interval = 0;
        srs.ease = Math.max(1.3, (srs.ease || base) - 0.2);
      } else {
        const q = g === 1 ? 3 : g === 2 ? 4 : 5;
        srs.ease = Math.max(1.3, (srs.ease || base) + (0.1 - (5 - q) * 0.08));
        if (!srs.reps) srs.interval = g === 1 ? 1 : g === 2 ? 1 : 3;
        else if (g === 1) srs.interval = Math.max(1, Math.round((srs.interval || 1) * 1.2));
        else srs.interval = Math.max(1, Math.round((srs.interval || 1) * srs.ease));
        srs.reps = (srs.reps || 0) + 1;
      }
      srs.last = now;
      srs.due = now + srs.interval * 24 * 60 * 60 * 1000;
      return Object.assign({}, item, { srs: srs, updatedAt: now });
    },

    isDue: function (item, now) {
      const t = now || Date.now();
      return !item.srs || !item.srs.due || item.srs.due <= t;
    },

    dueList: function (list, now) {
      return (list || []).filter((it) => EH.srs.isDue(it, now)).sort((a, b) => (a.srs && a.srs.due ? a.srs.due : 0) - (b.srs && b.srs.due ? b.srs.due : 0));
    },

    gradeWord: async function (id, grade) {
      const settings = await EH.getSettings();
      const list = await EH.getHistory();
      const idx = list.findIndex((it) => it.id === id);
      if (idx === -1) return list;
      list[idx] = EH.srs.apply(list[idx], grade, settings.srs.ease);
      await EH.saveHistory(list);
      return list;
    }
  };

  /* ------------------------------------------------------------------ *
   * Statistics
   * ------------------------------------------------------------------ */

  EH.computeStats = function (list) {
    const items = list || [];
    const total = items.length;
    const lookups = items.reduce((n, it) => n + (it.count || 1), 0);
    const today = EH.todayKey();
    const learnedToday = items.filter((it) => EH.todayKey(it.createdAt || Date.now()) === today).length;

    const byDay = {};
    items.forEach((it) => {
      const k = EH.todayKey(it.createdAt || Date.now());
      byDay[k] = (byDay[k] || 0) + 1;
    });

    // streak of consecutive days (ending today or yesterday) with >=1 new word
    let streak = 0;
    const cursor = new Date();
    if (!byDay[EH.todayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (byDay[EH.todayKey(cursor)]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const top = items
      .slice()
      .sort((a, b) => (b.count || 1) - (a.count || 1))
      .slice(0, 10)
      .map((it) => ({ word: it.word, count: it.count || 1 }));

    const mastered = items.filter((it) => it.srs && it.srs.reps >= 4 && (it.srs.interval || 0) >= 7).length;
    const due = EH.srs.dueList(items).length;

    return { total, lookups, learnedToday, streak, mastered, due, byDay, top };
  };

  /* ------------------------------------------------------------------ *
   * Definitions (Free Dictionary API, fetched from the service worker)
   * ------------------------------------------------------------------ */

  EH.normalizeDefinition = function (data, word) {
    if (!Array.isArray(data) || !data.length) return null;
    const entry = data[0] || {};
    const phonetics = (entry.phonetics || []).filter((p) => p && (p.text || p.audio));
    const audio = phonetics.map((p) => p.audio).filter(Boolean);
    const text = entry.phonetic || (phonetics.find((p) => p.text) || {}).text || "";
    const meanings = (entry.meanings || []).map((m) => ({
      partOfSpeech: m.partOfSpeech || "",
      definitions: (m.definitions || []).slice(0, 3).map((d) => ({ definition: d.definition, example: d.example })),
      synonyms: (m.synonyms || []).slice(0, 6)
    }));
    return {
      word: entry.word || word,
      phonetic: text,
      audio: audio,
      audioUrl: audio.find((u) => /-us\./.test(u)) || audio[0] || "",
      meanings: meanings,
      sourceUrl: entry.sourceUrls ? entry.sourceUrls[0] : ""
    };
  };

  EH.fetchDefinition = async function (word, force) {
    const key = String(word || "").trim().toLowerCase();
    if (!key) return null;

    if (!force) {
      const cached = await EH.get("local", "defcache");
      const hit = (cached.defcache || {})[key];
      if (hit && Date.now() - hit.at < 1000 * 60 * 60 * 24 * 30) return hit.value;
    }

    let value = null;
    try {
      const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(key));
      if (res.ok) value = EH.normalizeDefinition(await res.json(), key);
    } catch (e) {
      value = null;
    }

    const cached = await EH.get("local", "defcache");
    const store = cached.defcache || {};
    store[key] = { at: Date.now(), value: value };
    // keep the cache bounded
    const keys = Object.keys(store);
    if (keys.length > 500) {
      keys.slice(0, keys.length - 500).forEach((k) => delete store[k]);
    }
    await EH.set("local", { defcache: store });
    return value;
  };

  /* ------------------------------------------------------------------ *
   * Translation (Google Translate public endpoint, via the SW)
   * ------------------------------------------------------------------ */

  /*
   * The dictionary payload gives us the best translation plus, for single
   * words, alternative translations grouped by part of speech. Two hosts are
   * tried because Google intermittently rate-limits one of them.
   */
  function translateUrls(sl, tl, text) {
    const q = encodeURIComponent(text);
    return [
      "https://clients5.google.com/translate_a/single?client=dict-chrome-ex&sl=" +
        encodeURIComponent(sl) +
        "&tl=" +
        encodeURIComponent(tl) +
        "&dt=t&dt=bd&q=" +
        q,
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
        encodeURIComponent(sl) +
        "&tl=" +
        encodeURIComponent(tl) +
        "&dt=t&dt=bd&q=" +
        q
    ];
  }

  EH.parseTranslation = function (data, sl, tl) {
    if (!Array.isArray(data)) return null;
    const translated = Array.isArray(data[0])
      ? data[0].map((seg) => (seg ? seg[0] : "")).join("")
      : "";
    if (!translated) return null;

    const rawGroups = [];
    const addGroup = (entry) => {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || !Array.isArray(entry[1])) return false;
      const terms = entry[1].filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim());
      if (!terms.length) return false;
      rawGroups.push({ partOfSpeech: entry[0], terms: terms });
      return true;
    };

    // Normal shape: data[1] is the list of dictionary entries.
    let found = false;
    if (Array.isArray(data[1])) data[1].forEach((entry) => { if (addGroup(entry)) found = true; });

    // Defensive: some payload variants place it at another top-level index.
    if (!found) {
      for (let i = 1; i < data.length; i++) {
        const top = data[i];
        if (Array.isArray(top) && Array.isArray(top[0]) && top[0].length &&
            typeof top[0][0] === "string" && Array.isArray(top[0][1])) {
          top.forEach((entry) => addGroup(entry));
        }
      }
    }

    // De-duplicate terms, drop the primary translation, cap the list.
    const seen = new Set([translated]);
    const alternatives = [];
    rawGroups.forEach((g) => {
      const terms = g.terms.filter((t) => {
        if (seen.has(t)) return false;
        seen.add(t);
        return true;
      });
      if (terms.length) alternatives.push({ partOfSpeech: g.partOfSpeech, terms: terms.slice(0, 8) });
    });

    return { text: translated, source: data[2] || sl, target: tl, alternatives: alternatives };
  };

  EH.fetchTranslation = async function (word, target, source, force) {
    const text = String(word || "").trim();
    if (!text) return null;
    const tl = target || "en";
    const sl = source || "auto";
    // v2 = includes alternatives; keeps old single-word cache entries unused.
    const key = "v2|" + sl + "|" + tl + "|" + text.toLowerCase();

    if (!force) {
      const cached = await EH.get("local", "transcache");
      const hit = (cached.transcache || {})[key];
      if (hit && Date.now() - hit.at < 1000 * 60 * 60 * 24 * 30) return hit.value;
    }

    let value = null;
    for (const url of translateUrls(sl, tl, text)) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        value = EH.parseTranslation(await res.json(), sl, tl);
        if (value) break;
      } catch (e) {
        /* try the next host */
      }
    }

    const cached = await EH.get("local", "transcache");
    const store = cached.transcache || {};
    store[key] = { at: Date.now(), value: value };
    const keys = Object.keys(store);
    if (keys.length > 500) keys.slice(0, keys.length - 500).forEach((k) => delete store[k]);
    await EH.set("local", { transcache: store });
    return value;
  };

  /* ------------------------------------------------------------------ *
   * Sync (server is not built yet; the client contract is here)
   * ------------------------------------------------------------------ *
   * Expected endpoints:
   *   POST {base}/api/auth/login  { email, password } -> { token, user }
   *   POST {base}/api/auth/logout
   *   GET  {base}/api/sync        -> { history: [...], updatedAt }
   *   POST {base}/api/sync        { history, updatedAt } -> { history, updatedAt }
   */

  EH.syncState = { status: "signed-out", lastSync: 0, error: "", pending: false };

  EH.getAuth = async function () {
    const data = await EH.get("local", "auth");
    return data.auth || null;
  };

  EH.setAuth = async function (auth) {
    if (auth) await EH.set("local", { auth: auth });
    else await EH.remove("local", "auth");
  };

  EH.getSyncMeta = async function () {
    const data = await EH.get("local", "syncMeta");
    return data.syncMeta || { dirty: false, lastSync: 0 };
  };

  EH.markDirty = async function () {
    const meta = await EH.getSyncMeta();
    meta.dirty = true;
    await EH.set("local", { syncMeta: meta });
  };

  function baseUrl(settings) {
    return String((settings.sync && settings.sync.apiBaseUrl) || "").replace(/\/+$/, "");
  }

  EH.syncApi = {
    async login(email, password) {
      const settings = await EH.getSettings();
      const base = baseUrl(settings);
      if (!base) throw new Error("Set the sync server URL first.");
      const res = await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
      });
      if (!res.ok) throw new Error("Login failed (HTTP " + res.status + ")");
      const data = await res.json();
      await EH.setAuth({ token: data.token, email: email });
      EH.syncState.status = "signed-in";
      EH.syncState.error = "";
      return data;
    },

    async logout() {
      const auth = await EH.getAuth();
      const settings = await EH.getSettings();
      const base = baseUrl(settings);
      if (auth && base) {
        try {
          await fetch(base + "/api/auth/logout", {
            method: "POST",
            headers: { Authorization: "Bearer " + auth.token }
          });
        } catch (e) {
          /* server may be unreachable; clear locally anyway */
        }
      }
      await EH.setAuth(null);
      EH.syncState.status = "signed-out";
      return true;
    },

    async syncNow() {
      const auth = await EH.getAuth();
      const settings = await EH.getSettings();
      const base = baseUrl(settings);
      if (!auth || !base) {
        EH.syncState.status = auth ? "no-server" : "signed-out";
        return { ok: false, reason: EH.syncState.status };
      }

      EH.syncState.status = "syncing";
      const history = await EH.getHistory();
      const meta = await EH.getSyncMeta();

      try {
        const res = await fetch(base + "/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + auth.token
          },
          body: JSON.stringify({ history: history, updatedAt: meta.lastSync || 0 })
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const merged = Array.isArray(data.history) ? data.history : history;
        await EH.set("local", { history: merged, syncMeta: { dirty: false, lastSync: Date.now() } });
        EH.syncState.status = "synced";
        EH.syncState.lastSync = Date.now();
        EH.syncState.error = "";
        return { ok: true, count: merged.length };
      } catch (e) {
        EH.syncState.status = "error";
        EH.syncState.error = String(e.message || e);
        return { ok: false, reason: EH.syncState.error };
      }
    }
  };

  /* ------------------------------------------------------------------ *
   * Import / export
   * ------------------------------------------------------------------ */

  EH.exportJSON = async function () {
    const [settings, history] = await Promise.all([EH.getSettings(), EH.getHistory()]);
    return JSON.stringify({ app: "english-helper", version: EH.VERSION, exportedAt: new Date().toISOString(), settings: settings, history: history }, null, 2);
  };

  EH.exportCSV = async function () {
    const history = await EH.getHistory();
    const head = ["word", "count", "datetime", "sentence", "notes", "interval", "due", "reps"];
    const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const rows = history.map((it) =>
      [
        it.word,
        it.count || 1,
        it.datetime || "",
        it.sentence || "",
        it.notes || "",
        (it.srs && it.srs.interval) || 0,
        it.srs && it.srs.due ? new Date(it.srs.due).toISOString() : "",
        (it.srs && it.srs.reps) || 0
      ]
        .map(esc)
        .join(",")
    );
    return [head.join(",")].concat(rows).join("\n");
  };

  EH.importJSON = async function (text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") throw new Error("Not an English Helper export file.");
    const incoming = Array.isArray(data.history) ? data.history : [];
    const current = await EH.getHistory();
    const byWord = new Map();
    current.forEach((it) => byWord.set(String(it.word).toLowerCase(), it));
    incoming.forEach((it) => {
      if (!it || !it.word) return;
      const k = String(it.word).toLowerCase();
      const existing = byWord.get(k);
      if (!existing) byWord.set(k, it);
      else {
        existing.count = Math.max(existing.count || 1, it.count || 1);
        if (it.srs && existing.srs && (it.srs.reps || 0) > (existing.srs.reps || 0)) existing.srs = it.srs;
        if (!existing.sentence && it.sentence) existing.sentence = it.sentence;
        if (!existing.notes && it.notes) existing.notes = it.notes;
      }
    });
    const merged = Array.from(byWord.values());
    await EH.saveHistory(merged);
    if (data.settings) await EH.saveSettings(data.settings);
    return merged.length;
  };

  /* ------------------------------------------------------------------ *
   * Action helpers (usable from any context)
   * ------------------------------------------------------------------ */

  EH.openTab = function (url) {
    if (api.tabs && api.tabs.create) return api.tabs.create({ url: url });
    root.open(url, "_blank");
    return null;
  };

  EH.openOptions = function () {
    if (api.runtime && api.runtime.openOptionsPage) return api.runtime.openOptionsPage();
    return EH.openTab(api.runtime.getURL("options.html"));
  };

  EH.runtimeGetURL = function (path) {
    return api.runtime && api.runtime.getURL ? api.runtime.getURL(path) : path;
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
