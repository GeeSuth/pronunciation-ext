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

  EH.onSettingsChanged((s) => {
    settings = s;
    applyTheme();
  });

  /* ------------------------------------------------------------------ *
   * Host / shadow root
   * ------------------------------------------------------------------ */

  function ensureHost() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement("div");
    host.id = "english-helper-root";
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.left = "0";
    host.style.width = "0";
    host.style.height = "0";
    host.style.zIndex = "2147483647";
    shadow = host.attachShadow({ mode: "open" });
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = EH.runtimeGetURL("content.css");
    shadow.appendChild(link);
    document.documentElement.appendChild(host);
    applyTheme();
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

  function keepInViewport(el, x, y) {
    const w = el.offsetWidth || 220;
    const h = el.offsetHeight || 48;
    const nx = Math.min(Math.max(8, x), window.innerWidth - w - 8);
    const ny = Math.min(Math.max(8, y), window.innerHeight - h - 8);
    el.style.left = nx + "px";
    el.style.top = ny + "px";
  }

  /* ------------------------------------------------------------------ *
   * Dictionary icons
   * ------------------------------------------------------------------ */

  function makeIcon(dict) {
    if (dict.icon) {
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
    ensureHost();
    if (card) {
      card.remove();
      card = null;
    }
    if (toolbar) toolbar.remove();

    toolbar = document.createElement("div");
    toolbar.className = "eh-toolbar";

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
      keepInViewport(toolbar, x - 20, y - 55);
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
      // The toolbar remembers its spot; the definition card is free to move
      // without overwriting the toolbar's saved position.
      if (!state.persist) return;
      const rect = state.el.getBoundingClientRect();
      const next = Object.assign({}, settings, { position: { mode: "fixed", x: Math.round(rect.left), y: Math.round(rect.top) } });
      await EH.saveSettings(next);
    },
    true
  );

  /* ------------------------------------------------------------------ *
   * Definition card
   * ------------------------------------------------------------------ */

  async function showCard(word, x, y) {
    ensureHost();
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
    if (card) card.remove();

    card = document.createElement("div");
    card.className = "eh-card";
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
    keepInViewport(card, x - 20, y + 12);

    if (settings.features.dragToolbar) {
      enableDrag(card.querySelector(".eh-card-head"), { target: card, persist: false });
    }

    const audioBtn = card.querySelector(".eh-audio");
    audioBtn.style.display = "none";

    currentWord = word;
    currentTranslation = "";

    const res = await api.runtime.sendMessage({ type: "define", word: word });
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

      const res = await api.runtime.sendMessage({ type: "translate", word: text, target: target, source: source });
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
    const res = await api.runtime.sendMessage({
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
      api.runtime.sendMessage({ type: "refresh-badge" });
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
    api.runtime.sendMessage({ type: "refresh-badge" });
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
      showToolbar(msg.word, Math.round(window.innerWidth / 2) - 60, Math.round(window.innerHeight / 3));
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === "lookup-selection") {
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
