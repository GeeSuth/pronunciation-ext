/*
 * content.js - Floating toolbar + inline definition card.
 *
 * Rendered inside a Shadow DOM host so page styles can't leak in and ours
 * can't leak out. All behaviour is driven by EH settings, which are reloaded
 * whenever the options page saves.
 */
(function () {
  "use strict";
  const EH = window.EH;
  const api = EH.api;

  let settings = EH.mergeSettings({});
  let host = null;
  let shadow = null;
  let toolbar = null;
  let card = null;
  let currentWord = "";
  let currentTranslation = "";
  let dragState = null;

  const ready = EH.getSettings().then((s) => {
    settings = s;
  });

  /*
   * A content script can outlive the extension (reload / update / merge). In
   * that state api.runtime.sendMessage rejects with "Extension context
   * invalidated"; swallow it so the page console stays clean.
   */
  function sendMessage(msg) {
    try {
      const p = api.runtime.sendMessage(msg);
      return p && typeof p.catch === "function" ? p.catch(() => null) : Promise.resolve(p);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  EH.onSettingsChanged((s) => {
    settings = s;
    applyTheme();
    // Blocked from the popup / options while our UI is open: close it.
    if (isSiteBlocked()) clearUI();
  });

  /*
   * Sites the user switched off with the 🚫 toolbar button (or the popup /
   * options page). Nothing is shown there, including the right-click lookup.
   */
  function isSiteBlocked() {
    return EH.isSiteExcluded(location.href, settings);
  }

  /* ------------------------------------------------------------------ *
   * Host / shadow root
   * ------------------------------------------------------------------ */

  function ensureHost() {
    if (host && document.documentElement.contains(host)) return true;
    if (!EH.isContextAlive()) return false;
    host = document.createElement("div");
    host.id = "english-helper-root";
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.left = "0";
    host.style.width = "0";
    host.style.height = "0";
    host.style.zIndex = "2147483647";
    shadow = host.attachShadow({ mode: "open" });
    const cssUrl = EH.runtimeGetURL("content.css");
    if (!cssUrl) {
      host = null;
      shadow = null;
      return false;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.addEventListener("error", loadCssFallback);
    shadow.appendChild(link);
    document.documentElement.appendChild(host);
    applyTheme();
    return true;
  }

  /*
   * A strict page Content-Security-Policy can block the shadow <link> to
   * chrome-extension://content.css. Without it our elements have no
   * `position: fixed`, so they land in the document flow (top-left of the
   * page) no matter which coordinates we set. Ask the service worker for the
   * CSS text (extension pages are not bound by the page CSP) and attach it as
   * a constructed stylesheet, which CSP does not block.
   */
  async function loadCssFallback() {
    if (!shadow || !EH.isContextAlive()) return;
    let text = "";
    try {
      const res = await sendMessage({ type: "get-css", path: "content.css" });
      text = res && res.ok ? res.text : "";
    } catch (e) {
      text = "";
    }
    if (!text || !shadow) return;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      shadow.adoptedStyleSheets = [sheet];
    } catch (e) {
      try {
        const style = document.createElement("style");
        style.textContent = text;
        shadow.appendChild(style);
      } catch (e2) {
        /* give up: inline placement styles still keep the UI usable */
      }
    }
  }

  function applyTheme() {
    if (!host) return;
    const mode = settings.theme || "auto";
    const dark = mode === "dark" || (mode === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    host.setAttribute("data-eh-theme", dark ? "dark" : "light");
    host.setAttribute("data-eh-size", settings.buttonSize || "md");
  }

  function clearUI() {
    if (toolbar) toolbar.remove();
    if (card) card.remove();
    toolbar = null;
    card = null;
    dragState = null;
  }

  /*
   * Layout-critical styles are also written inline so placement still works if
   * the page blocks our stylesheet (see loadCssFallback): without them the
   * element is `position: static` and left/top are ignored.
   */
  function lockPlacement(el) {
    el.style.position = "fixed";
    el.style.zIndex = "2147483647";
    el.style.margin = "0";
    el.style.boxSizing = "border-box";
    if (el.className.indexOf("eh-toolbar") !== -1) {
      el.style.display = "flex";
      el.style.flexWrap = "wrap";
      el.style.alignItems = "center";
      el.style.maxWidth = "92vw";
    }
    return el;
  }

  /*
   * Writes a fixed position, then compensates for pages that put a transform /
   * filter / contain on an ancestor (which makes that ancestor the containing
   * block for `position: fixed`, so our coordinates would otherwise be shifted).
   * One measurement is enough because the offset is linear.
   */
  function positionEl(el, left, top) {
    const x = Math.round(left);
    const y = Math.round(top);
    el.style.left = x + "px";
    el.style.top = y + "px";
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return; // not laid out yet - nothing to correct
    const dx = x - rect.left;
    const dy = y - rect.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      el.style.left = Math.round(x + dx) + "px";
      el.style.top = Math.round(y + dy) + "px";
    }
  }

  function keepInViewport(el, x, y) {
    const w = el.offsetWidth || 220;
    const h = el.offsetHeight || 48;
    const nx = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8));
    const ny = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8));
    positionEl(el, nx, ny);
  }

  /*
   * Viewport rect of the last line of the current selection - the spot the user
   * is actually looking at. Returns null when nothing usable is selected.
   */
  function selectionAnchor() {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
      const range = sel.getRangeAt(sel.rangeCount - 1);
      let rect = null;
      const rects = range.getClientRects ? range.getClientRects() : null;
      if (rects && rects.length) {
        for (let i = rects.length - 1; i >= 0; i--) {
          const r = rects[i];
          if (r && (r.width || r.height)) {
            rect = r;
            break;
          }
        }
      }
      if (!rect) {
        const b = range.getBoundingClientRect();
        if (b && (b.width || b.height)) rect = b;
      }
      if (!rect) return null;
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    } catch (e) {
      return null;
    }
  }

  /*
   * Places `el` right next to the selected text: under the selection when it
   * fits, above it otherwise, always clamped to the viewport. `fallbackX/Y` are
   * used when there is no live selection (context menu / keyboard commands).
   */
  function placeNextToSelection(el, fallbackX, fallbackY) {
    const anchor = selectionAnchor();
    if (!anchor) {
      keepInViewport(el, fallbackX, fallbackY);
      return;
    }

    const w = el.offsetWidth || 220;
    const h = el.offsetHeight || 48;
    const gap = 8;
    const maxX = Math.max(gap, window.innerWidth - w - gap);
    const maxY = Math.max(gap, window.innerHeight - h - gap);

    let top = anchor.bottom + gap;
    if (top > maxY) {
      const above = anchor.top - h - gap;
      top = above >= gap ? above : anchor.bottom + gap;
    }
    top = Math.min(Math.max(gap, top), maxY);

    // Line up with the selection's left edge, or right-align it when the
    // buttons would run off the right side of the viewport.
    let left = anchor.left;
    if (left > maxX || left + w > maxX) left = anchor.right - w;
    left = Math.min(Math.max(gap, left), maxX);

    positionEl(el, left, top);
  }

  /* ------------------------------------------------------------------ *
   * Dictionary icons
   * ------------------------------------------------------------------ */

  function makeIcon(dict) {
    if (typeof dict.icon === "string" && dict.icon) {
      const img = document.createElement("img");
      img.src = EH.runtimeGetURL(dict.icon);
      img.alt = dict.name;
      img.className = "eh-icon";
      img.addEventListener("error", () => {
        const span = document.createElement("span");
        span.className = "eh-icon eh-emoji";
        span.textContent = dict.emoji || dict.name.slice(0, 1);
        img.replaceWith(span);
      });
      return img;
    }
    const span = document.createElement("span");
    span.className = "eh-icon eh-emoji";
    span.textContent = dict.emoji || (dict.name || "?").slice(0, 1);
    return span;
  }

  /* ------------------------------------------------------------------ *
   * Toolbar
   * ------------------------------------------------------------------ */

  function showToolbar(word, x, y) {
    if (!ensureHost()) return;
    hideToast();
    if (card) {
      card.remove();
      card = null;
    }
    if (toolbar) toolbar.remove();

    toolbar = document.createElement("div");
    toolbar.className = "eh-toolbar";
    lockPlacement(toolbar);

    const dicts = settings.dictionaries
      .filter((d) => d.enabled)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    dicts.forEach((dict) => {
      const btn = document.createElement("button");
      btn.className = "eh-btn";
      btn.title = dict.name;
      btn.appendChild(makeIcon(dict));
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openDictionary(dict, word, ev);
      });
      toolbar.appendChild(btn);
    });

    if (settings.features.inlineCard) {
      const defineBtn = document.createElement("button");
      defineBtn.className = "eh-btn eh-define";
      defineBtn.title = "Definition & audio";
      defineBtn.textContent = "\uD83D\uDCD6";
      defineBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        showCard(word, ev.clientX, ev.clientY);
      });
      toolbar.appendChild(defineBtn);
    }

    if (settings.features.translate) {
      const translateBtn = document.createElement("button");
      translateBtn.className = "eh-btn";
      translateBtn.title = "Translate to " + EH.languageName(settings.translate.target);
      translateBtn.textContent = "\uD83C\uDF10";
      translateBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openTranslate(word, ev);
      });
      toolbar.appendChild(translateBtn);
    }

    if (settings.features.tts) {
      const speakBtn = document.createElement("button");
      speakBtn.className = "eh-btn";
      speakBtn.title = "Speak";
      speakBtn.textContent = "\uD83D\uDD0A";
      speakBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        speak(word);
      });
      toolbar.appendChild(speakBtn);
    }

    // "Don't show on this site" - only on real web pages.
    const currentSite = EH.normalizeSite(location.href);
    if (currentSite) {
      const siteBtn = document.createElement("button");
      siteBtn.className = "eh-btn eh-site-off";
      siteBtn.title = "Don't show English Helper on " + currentSite;
      siteBtn.textContent = "\uD83D\uDEAB";
      siteBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        blockCurrentSite();
      });
      toolbar.appendChild(siteBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "eh-btn eh-close";
    closeBtn.title = "Close";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      clearUI();
    });
    toolbar.appendChild(closeBtn);

    shadow.appendChild(toolbar);

    if (settings.position.mode === "fixed" && settings.position.x && settings.position.y) {
      keepInViewport(toolbar, settings.position.x, settings.position.y);
    } else {
      placeNextToSelection(toolbar, x, y);
    }

    if (settings.features.dragToolbar) enableDrag(toolbar, { persist: true });
  }

  /*
   * `el` is the drag handle; `opts.target` is the element that actually moves
   * (defaults to the handle). The card uses its header as handle but moves the
   * whole card.
   */
  function enableDrag(el, opts) {
    const options = opts || {};
    const target = options.target || el;
    const handle = (ev) => {
      if (ev.target.closest(".eh-btn") || ev.target.closest("button")) return;
      const rect = target.getBoundingClientRect();
      dragState = {
        dx: ev.clientX - rect.left,
        dy: ev.clientY - rect.top,
        startX: ev.clientX,
        startY: ev.clientY,
        moved: false,
        el: target,
        persist: !!options.persist
      };
      ev.preventDefault();
    };
    el.addEventListener("mousedown", handle);
  }

  document.addEventListener(
    "mousemove",
    (ev) => {
      if (!dragState) return;
      if (!dragState.moved && Math.abs(ev.clientX - dragState.startX) < 3 && Math.abs(ev.clientY - dragState.startY) < 3) return;
      dragState.moved = true;
      keepInViewport(dragState.el, ev.clientX - dragState.dx, ev.clientY - dragState.dy);
    },
    true
  );

  document.addEventListener(
    "mouseup",
    async () => {
      if (!dragState) return;
      const state = dragState;
      dragState = null;
      // Only "Fixed" mode remembers a drag; otherwise the toolbar keeps
      // appearing right next to the selection the user just made.
      if (!state.persist || !state.moved) return;
      if (settings.position.mode !== "fixed") return;
      const rect = state.el.getBoundingClientRect();
      const next = Object.assign({}, settings, { position: { mode: "fixed", x: Math.round(rect.left), y: Math.round(rect.top) } });
      await EH.saveSettings(next);
    },
    true
  );

  /*
   * Keep the toolbar glued to the selected words when the page scrolls or is
   * resized (the toolbar itself is `position: fixed`).
   */
  let repositionQueued = false;
  function queueReposition() {
    if (!toolbar || dragState || repositionQueued) return;
    if (settings.position.mode === "fixed") return;
    repositionQueued = true;
    window.requestAnimationFrame(() => {
      repositionQueued = false;
      if (!toolbar || dragState) return;
      const anchor = selectionAnchor();
      if (!anchor) return;
      // Hide instead of parking the toolbar on the viewport edge when the
      // selected text itself has been scrolled out of view.
      if (anchor.bottom < 0 || anchor.top > window.innerHeight) {
        toolbar.style.visibility = "hidden";
        return;
      }
      toolbar.style.visibility = "";
      placeNextToSelection(toolbar, 0, 0);
    });
  }

  window.addEventListener("scroll", queueReposition, true);
  window.addEventListener("resize", queueReposition);

  /* ------------------------------------------------------------------ *
   * Definition card
   * ------------------------------------------------------------------ */

  async function showCard(word, x, y) {
    if (!ensureHost()) return;
    // The card opens under the toolbar it was launched from, so it stays next
    // to the selection instead of jumping to the mouse position.
    const toolbarRect = toolbar ? toolbar.getBoundingClientRect() : null;
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
    if (card) card.remove();

    card = document.createElement("div");
    card.className = "eh-card";
    lockPlacement(card);
    card.innerHTML =
      '<div class="eh-card-head">' +
      '  <span class="eh-word"></span>' +
      '  <span class="eh-phon"></span>' +
      '  <button class="eh-audio" title="Play audio">\u25B6</button>' +
      '  <button class="eh-card-close" title="Close">\u2715</button>' +
      "</div>" +
      '<div class="eh-body"><div class="eh-loading">Loading\u2026</div></div>';

    card.querySelector(".eh-word").textContent = word;
    card.querySelector(".eh-card-close").addEventListener("click", clearUI);
    shadow.appendChild(card);
    if (toolbarRect) keepInViewport(card, toolbarRect.left, toolbarRect.bottom + 8);
    else keepInViewport(card, x - 20, y + 12);

    if (settings.features.dragToolbar) {
      enableDrag(card.querySelector(".eh-card-head"), { target: card, persist: false });
    }

    const audioBtn = card.querySelector(".eh-audio");
    audioBtn.style.display = "none";

    currentWord = word;
    currentTranslation = "";

    const res = await sendMessage({ type: "define", word: word });
    const def = res && res.ok ? res.def : null;
    renderCard(def, word, audioBtn);
    await loadTranslationIntoCard(word);
    await loadDefinitionTranslations(def);

    if (settings.features.autoSpeak) speak(word);
  }

  /*
   * Translates the definition text of each meaning into the target language
   * and appends it under that meaning. One request per meaning (cached).
   */
  async function loadDefinitionTranslations(def) {
    if (!settings.features.translate || !settings.translate.definitions || !def || !card) return;

    const target = settings.translate.target;
    const source = settings.translate.source;
    const blocks = card.querySelectorAll(".eh-meaning");

    for (let i = 0; i < blocks.length && i < def.meanings.length; i++) {
      const meaning = def.meanings[i];
      const text = meaning.definitions
        .slice(0, 2)
        .map((d) => d.definition)
        .join("; ")
        .trim();
      if (!text) continue;

      const res = await sendMessage({ type: "translate", word: text, target: target, source: source });
      const tr = res && res.ok ? res.translation : null;
      if (!tr || !tr.text || !card) continue;

      const el = document.createElement("div");
      el.className = "eh-meaning-trans";
      el.textContent = tr.text;
      blocks[i].appendChild(el);
    }
  }

  /*
   * Fetches the translation for the card and renders it above the actions.
   * Also records it so "Save word" stores the translation with the word.
   */
  async function loadTranslationIntoCard(word) {
    if (!settings.features.translate || !settings.translate.inline || !card) return;

    const target = settings.translate.target;
    const res = await sendMessage({
      type: "translate",
      word: word,
      target: target,
      source: settings.translate.source
    });
    const tr = res && res.ok ? res.translation : null;
    if (!tr || !tr.text || !card) return;

    currentTranslation = tr.text;

    const block = document.createElement("div");
    block.className = "eh-translation";
    const lang = document.createElement("span");
    lang.className = "eh-trans-lang";
    lang.textContent = EH.languageName(target);
    const text = document.createElement("span");
    text.className = "eh-trans-text";
    text.textContent = tr.text;
    block.appendChild(lang);
    block.appendChild(text);

    if (Array.isArray(tr.alternatives) && tr.alternatives.length) {
      const altWrap = document.createElement("div");
      altWrap.className = "eh-alt-wrap";
      tr.alternatives.forEach((group) => {
        const row = document.createElement("div");
        row.className = "eh-alt";
        const pos = document.createElement("span");
        pos.className = "eh-alt-pos";
        pos.textContent = group.partOfSpeech;
        const terms = document.createElement("span");
        terms.className = "eh-alt-terms";
        terms.textContent = group.terms.join(" \u00B7 ");
        row.appendChild(pos);
        row.appendChild(terms);
        altWrap.appendChild(row);
      });
      block.appendChild(altWrap);
    }

    const body = card.querySelector(".eh-body");
    const actions = card.querySelector(".eh-actions");
    if (actions) body.insertBefore(block, actions);
    else body.appendChild(block);
  }

  function renderCard(def, word, audioBtn) {
    const body = card.querySelector(".eh-body");
    body.innerHTML = "";

    if (def && def.phonetic && settings.card.definition) {
      card.querySelector(".eh-phon").textContent = def.phonetic;
    }

    if (def && def.audioUrl && settings.card.audio) {
      audioBtn.style.display = "";
      audioBtn.addEventListener("click", () => {
        try {
          new Audio(def.audioUrl).play();
        } catch (e) {
          /* ignore */
        }
      });
    }

    if (!def || !def.meanings || !def.meanings.length) {
      const p = document.createElement("div");
      p.className = "eh-empty";
      p.textContent = "No offline definition found.";
      body.appendChild(p);
      body.appendChild(buildActions(word));
      return;
    }

    def.meanings.slice(0, 3).forEach((m) => {
      if (!settings.card.definition) return;
      const block = document.createElement("div");
      block.className = "eh-meaning";
      const pos = document.createElement("div");
      pos.className = "eh-pos";
      pos.textContent = m.partOfSpeech;
      block.appendChild(pos);

      const ul = document.createElement("ul");
      m.definitions.slice(0, 3).forEach((d) => {
        const li = document.createElement("li");
        li.textContent = d.definition;
        if (settings.card.examples && d.example) {
          const ex = document.createElement("span");
          ex.className = "eh-example";
          ex.textContent = " \u2014 " + d.example;
          li.appendChild(ex);
        }
        ul.appendChild(li);
      });
      block.appendChild(ul);

      if (settings.card.synonyms && m.synonyms && m.synonyms.length) {
        const syn = document.createElement("div");
        syn.className = "eh-syn";
        syn.textContent = "syn: " + m.synonyms.join(", ");
        block.appendChild(syn);
      }
      body.appendChild(block);
    });

    body.appendChild(buildActions(word, def));
  }

  function buildActions(word, def) {
    const row = document.createElement("div");
    row.className = "eh-actions";

    const save = document.createElement("button");
    save.className = "eh-act eh-save";
    save.textContent = "Save word";
    save.addEventListener("click", async () => {
      await EH.addWord(word, {
        sentence: settings.features.contextSentence ? surroundingSentence() : "",
        sourceUrl: location.href,
        translation: currentTranslation
      });
      save.textContent = "Saved \u2713";
      save.disabled = true;
      sendMessage({ type: "refresh-badge" });
    });
    row.appendChild(save);

    if (settings.features.tts) {
      const speakBtn = document.createElement("button");
      speakBtn.className = "eh-act";
      speakBtn.textContent = "Speak";
      speakBtn.addEventListener("click", () => speak(word));
      row.appendChild(speakBtn);
    }

    if (settings.features.translate) {
      const trBtn = document.createElement("button");
      trBtn.className = "eh-act";
      trBtn.textContent = "Translate";
      trBtn.addEventListener("click", (ev) => openTranslate(word, ev, true));
      row.appendChild(trBtn);
    }

    const dicts = settings.dictionaries.filter((d) => d.enabled).slice(0, 4);
    dicts.forEach((dict) => {
      const b = document.createElement("button");
      b.className = "eh-act eh-act-link";
      b.textContent = dict.name;
      b.addEventListener("click", (ev) => openDictionary(dict, word, ev));
      row.appendChild(b);
    });

    return row;
  }

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  /*
   * "Don't show on this site" - the toolbar button, with an undo toast so a
   * misclick does not need a trip to the settings page.
   */
  async function blockCurrentSite() {
    const site = EH.normalizeSite(location.href);
    if (!site) return;
    clearUI();
    hideToast();
    if (!EH.addExcludedSite(settings, site)) return;
    await EH.saveSettings(settings);
    showToast("Off on " + site, "Undo", () => unblockSite(site));
  }

  async function unblockSite(site) {
    if (!EH.removeExcludedSite(settings, site)) return;
    await EH.saveSettings(settings);
    showToast("English Helper is back on " + site);
  }

  let toastEl = null;
  let toastTimer = null;

  function hideToast() {
    clearTimeout(toastTimer);
    if (toastEl) toastEl.remove();
    toastEl = null;
  }

  function showToast(message, actionLabel, onAction) {
    if (!ensureHost()) return;
    hideToast();

    const el = document.createElement("div");
    el.className = "eh-toast";
    lockPlacement(el);

    const text = document.createElement("span");
    text.className = "eh-toast-text";
    text.textContent = message;
    el.appendChild(text);

    if (actionLabel) {
      const btn = document.createElement("button");
      btn.className = "eh-toast-act";
      btn.textContent = actionLabel;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideToast();
        if (onAction) onAction();
      });
      el.appendChild(btn);
    }

    shadow.appendChild(el);
    toastEl = el;

    const w = el.offsetWidth || 200;
    const h = el.offsetHeight || 36;
    positionEl(el, (window.innerWidth - w) / 2, window.innerHeight - h - 26);
    toastTimer = setTimeout(hideToast, 6000);
  }

  function openExternal(url, ev) {
    if (!url) return;
    if (settings.features.openInPopupWindow) {
      const vw = Math.max(400, Math.round(window.innerWidth * 0.33));
      const vh = Math.max(600, Math.round(window.innerHeight * 0.55));
      window.open(url, "_blank", "width=" + vw + ",height=" + vh + ",left=" + (ev ? ev.clientX : 0) + ",top=" + (ev ? ev.clientY : 0));
    } else {
      window.open(url, "_blank");
    }
  }

  function recordLookup(word) {
    EH.addWord(word, {
      sentence: settings.features.contextSentence ? surroundingSentence() : "",
      sourceUrl: location.href,
      translation: currentTranslation
    });
    sendMessage({ type: "refresh-badge" });
  }

  function openDictionary(dict, word, ev) {
    const url = EH.buildUrl(dict, word, settings);
    if (!url) return;
    openExternal(url, ev);
    recordLookup(word);
    clearUI();
  }

  function openTranslate(word, ev, keepCard) {
    const url = EH.buildTranslateUrl(word, settings);
    if (!url) return;
    openExternal(url, ev);
    recordLookup(word);
    if (!keepCard) clearUI();
  }

  function speak(word) {
    if (!settings.features.tts || !window.speechSynthesis) return;
    const accent = EH.ACCENTS.find((a) => a.id === settings.accent) || EH.ACCENTS[0];
    const u = new SpeechSynthesisUtterance(String(word));
    u.lang = accent.lang;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* ignore */
    }
  }

  function surroundingSentence() {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return "";
      const node = sel.anchorNode;
      if (!node) return "";
      let text = node.textContent || "";
      let offset = sel.anchorOffset || 0;
      if (node.nodeType !== 3) {
        const el = node;
        text = el.textContent || "";
        offset = 0;
      }
      text = text.replace(/\s+/g, " ").trim();
      if (!text) return "";
      const parts = text.split(/(?<=[.!?])\s+/);
      let acc = 0;
      for (const p of parts) {
        if (offset <= acc + p.length) return p.trim();
        acc += p.length + 1;
      }
      return parts[0] ? parts[0].trim() : text;
    } catch (e) {
      return "";
    }
  }

  /* ------------------------------------------------------------------ *
   * Triggers
   * ------------------------------------------------------------------ */

  document.addEventListener("mouseup", async (event) => {
    if (event.target === host) return; // click inside our UI
    if (toolbar || card) return;
    await ready;
    if (!settings.enabled) return;
    if (isSiteBlocked()) return;
    if (!EH.isContextAlive()) return;

    const selected = String(window.getSelection().toString() || "").trim();
    if (!selected) return;
    if (selected.length > 120) return;
    showToolbar(selected, event.clientX, event.clientY);
  });

  document.addEventListener(
    "mousedown",
    (event) => {
      if (event.target === host) return;
      if (!settings.features.closeOnClickOutside) return;
      if (toolbar || card) clearUI();
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (toolbar || card)) clearUI();
  });

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return false;

    if (msg.type === "lookup") {
      // Blocked site: acknowledge so the service worker does not fall back to
      // opening a dictionary tab.
      if (isSiteBlocked()) {
        sendResponse({ ok: true, excluded: true });
        return false;
      }
      showToolbar(msg.word, Math.round(window.innerWidth / 2) - 60, Math.round(window.innerHeight / 3));
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === "lookup-selection") {
      if (isSiteBlocked()) {
        sendResponse({ ok: true, excluded: true });
        return false;
      }
      const selected = String(window.getSelection().toString() || "").trim();
      if (selected) {
        showToolbar(selected, Math.round(window.innerWidth / 2) - 60, Math.round(window.innerHeight / 3));
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
      return false;
    }

    return false;
  });
})();
