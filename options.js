/*
 * options.js - the configuration page controller.
 *
 * Loads settings, wires every control to an autosave, renders the editable
 * dictionary list, and drives account/sync + data import/export.
 */
(function () {
  "use strict";
  const EH = window.EH;
  const api = EH.api;
  const $ = (id) => document.getElementById(id);

  let settings = EH.mergeSettings({});
  let saveTimer = null;
  let saving = false;
  let pendingSave = false;

  /* ------------------------------------------------------------------ */

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  /*
   * IMPORTANT: never replace `settings` with the object returned by
   * `EH.saveSettings`. It returns a deep clone, and the dictionary rows hold
   * references into the current `settings.dictionaries`; swapping it would
   * orphan those handlers so later edits silently stop saving.
   *
   * Saves are also serialized so a change made while a write is in flight is
   * written by the follow-up pass instead of being overwritten.
   */
  function scheduleSave() {
    pendingSave = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 250);
  }

  async function flushSave() {
    if (saving || !pendingSave) return;
    pendingSave = false;
    saving = true;
    let failed = false;
    try {
      await EH.saveSettings(settings);
    } catch (e) {
      failed = true;
      pendingSave = true;
    } finally {
      saving = false;
    }
    if (failed) {
      toast("Save failed");
      return;
    }
    if (pendingSave) {
      scheduleSave();
      return;
    }
    toast("Saved");
  }

  /* ------------------------------------------------------------------ *
   * Bind simple controls
   * ------------------------------------------------------------------ */

  function bindSimpleControls() {
    $("enabled").addEventListener("change", (e) => {
      settings.enabled = e.target.checked;
      scheduleSave();
    });
    $("theme").addEventListener("change", (e) => {
      settings.theme = e.target.value;
      scheduleSave();
    });
    $("accent").addEventListener("change", (e) => {
      settings.accent = e.target.value;
      scheduleSave();
    });
    $("buttonSize").addEventListener("change", (e) => {
      settings.buttonSize = e.target.value;
      scheduleSave();
    });
    $("positionMode").addEventListener("change", (e) => {
      settings.position.mode = e.target.value;
      scheduleSave();
    });

    document.querySelectorAll("[data-feature]").forEach((el) => {
      el.addEventListener("change", () => {
        settings.features[el.dataset.feature] = el.checked;
        scheduleSave();
      });
    });
    document.querySelectorAll("[data-card]").forEach((el) => {
      el.addEventListener("change", () => {
        settings.card[el.dataset.card] = el.checked;
        scheduleSave();
      });
    });
    document.querySelectorAll("[data-history]").forEach((el) => {
      el.addEventListener("change", () => {
        settings.history[el.dataset.history] = el.checked;
        scheduleSave();
      });
    });

    $("trans-source").addEventListener("change", (e) => {
      settings.translate.source = e.target.value;
      scheduleSave();
    });
    $("trans-target").addEventListener("change", (e) => {
      settings.translate.target = e.target.value;
      scheduleSave();
    });
    $("trans-inline").addEventListener("change", (e) => {
      settings.translate.inline = e.target.checked;
      scheduleSave();
    });
    $("trans-definitions").addEventListener("change", (e) => {
      settings.translate.definitions = e.target.checked;
      scheduleSave();
    });

    $("pageSize").addEventListener("change", (e) => {
      settings.history.pageSize = Math.max(5, Math.min(200, Number(e.target.value) || 20));
      scheduleSave();
    });
    $("srs-enabled").addEventListener("change", (e) => {
      settings.srs.enabled = e.target.checked;
      scheduleSave();
    });
    $("srs-newPerDay").addEventListener("change", (e) => {
      settings.srs.newPerDay = Math.max(1, Number(e.target.value) || 20);
      scheduleSave();
    });
    $("srs-ease").addEventListener("change", (e) => {
      settings.srs.ease = Math.max(1.3, Number(e.target.value) || 2.5);
      scheduleSave();
    });
  }

  function fillForm() {
    $("enabled").checked = !!settings.enabled;
    $("theme").value = settings.theme;
    $("accent").value = settings.accent;
    $("buttonSize").value = settings.buttonSize;
    $("positionMode").value = settings.position.mode;

    document.querySelectorAll("[data-feature]").forEach((el) => {
      el.checked = !!settings.features[el.dataset.feature];
    });
    document.querySelectorAll("[data-card]").forEach((el) => {
      el.checked = !!settings.card[el.dataset.card];
    });
    document.querySelectorAll("[data-history]").forEach((el) => {
      el.checked = !!settings.history[el.dataset.history];
    });

    $("pageSize").value = settings.history.pageSize;
    $("trans-source").value = settings.translate.source || "auto";
    $("trans-target").value = settings.translate.target || "en";
    $("trans-inline").checked = !!settings.translate.inline;
    $("trans-definitions").checked = !!settings.translate.definitions;
    $("srs-enabled").checked = !!settings.srs.enabled;
    $("srs-newPerDay").value = settings.srs.newPerDay;
    $("srs-ease").value = settings.srs.ease;

    $("sync-url").value = settings.sync.apiBaseUrl || "";
    $("sync-email").value = settings.sync.email || "";
    $("sync-auto").checked = !!settings.sync.autoSync;
  }

  function populateLanguages() {
    const src = $("trans-source");
    const tgt = $("trans-target");
    src.innerHTML = "";
    tgt.innerHTML = "";
    EH.TRANSLATE_LANGUAGES.forEach((l) => {
      if (!l.sourceOnly) {
        const o = document.createElement("option");
        o.value = l.code;
        o.textContent = l.name;
        tgt.appendChild(o);
      }
      const o2 = document.createElement("option");
      o2.value = l.code;
      o2.textContent = l.name;
      src.appendChild(o2);
    });
  }

  /* ------------------------------------------------------------------ *
   * Dictionary list
   * ------------------------------------------------------------------ */

  function renderDicts() {
    const list = $("dictList");
    list.innerHTML = "";
    settings.dictionaries.forEach((dict, index) => {
      const row = document.createElement("div");
      row.className = "eh-dict-row";

      const enable = document.createElement("input");
      enable.type = "checkbox";
      enable.checked = !!dict.enabled;
      enable.title = "Enabled";
      enable.addEventListener("change", () => {
        dict.enabled = enable.checked;
        scheduleSave();
      });
      row.appendChild(enable);

      const emoji = document.createElement("input");
      emoji.type = "text";
      emoji.value = dict.emoji || "";
      emoji.maxLength = 2;
      emoji.title = "Icon glyph (used when no image)";
      emoji.style.width = "28px";
      emoji.style.textAlign = "center";
      emoji.addEventListener("input", () => {
        dict.emoji = emoji.value;
        scheduleSave();
      });
      row.appendChild(emoji);

      const name = document.createElement("input");
      name.type = "text";
      name.value = dict.name || "";
      name.addEventListener("input", () => {
        dict.name = name.value;
        scheduleSave();
      });
      row.appendChild(name);

      const tmpl = document.createElement("input");
      tmpl.type = "text";
      tmpl.value = dict.urlTemplate || "";
      tmpl.placeholder = "https://example.com/{word}";
      tmpl.addEventListener("input", () => {
        dict.urlTemplate = tmpl.value;
        scheduleSave();
      });
      row.appendChild(tmpl);

      const move = document.createElement("div");
      const up = document.createElement("button");
      up.className = "eh-move";
      up.textContent = "\u2191";
      up.title = "Move up";
      up.addEventListener("click", () => reorder(index, -1));
      const down = document.createElement("button");
      down.className = "eh-move";
      down.textContent = "\u2193";
      down.title = "Move down";
      down.style.marginLeft = "4px";
      down.addEventListener("click", () => reorder(index, 1));
      move.appendChild(up);
      move.appendChild(down);
      row.appendChild(move);

      const del = document.createElement("button");
      del.className = "eh-btn-danger";
      del.textContent = "\u2715";
      del.title = dict.builtin ? "Built-in (disable instead)" : "Delete";
      del.disabled = !!dict.builtin;
      if (dict.builtin) del.style.opacity = "0.4";
      del.addEventListener("click", () => {
        settings.dictionaries.splice(index, 1);
        renderDicts();
        scheduleSave();
      });
      row.appendChild(del);

      list.appendChild(row);
    });

    settings.dictionaries.forEach((d, i) => (d.order = i));
  }

  function reorder(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= settings.dictionaries.length) return;
    const arr = settings.dictionaries;
    const tmp = arr[index];
    arr[index] = arr[target];
    arr[target] = tmp;
    renderDicts();
    scheduleSave();
  }

  $("addDict").addEventListener("click", () => {
    settings.dictionaries.push({
      id: "custom-" + EH.uid(),
      name: "New dictionary",
      emoji: "\uD83D\uDD16",
      builtin: false,
      enabled: true,
      urlTemplate: "https://example.com/search?q={word}"
    });
    renderDicts();
    scheduleSave();
  });

  $("resetDicts").addEventListener("click", () => {
    if (!confirm("Restore the default dictionary list? Custom entries will be removed.")) return;
    settings.dictionaries = EH.clone(EH.DEFAULT_DICTIONARIES).map((d, i) => Object.assign({ order: i }, d));
    renderDicts();
    scheduleSave();
  });

  /* ------------------------------------------------------------------ *
   * Sync
   * ------------------------------------------------------------------ */

  function setSyncStatus(text, cls) {
    const el = $("syncStatus");
    el.textContent = text || "";
    el.className = "eh-status" + (cls ? " " + cls : "");
  }

  async function refreshSyncStatus() {
    const auth = await EH.getAuth();
    if (!auth) {
      setSyncStatus("Not signed in");
      return;
    }
    setSyncStatus("Signed in as " + (auth.email || "user"), "ok");
  }

  $("sync-url").addEventListener("change", (e) => {
    settings.sync.apiBaseUrl = e.target.value.trim();
    scheduleSave();
  });
  $("sync-email").addEventListener("change", (e) => {
    settings.sync.email = e.target.value.trim();
    scheduleSave();
  });
  $("sync-auto").addEventListener("change", (e) => {
    settings.sync.autoSync = e.target.checked;
    scheduleSave();
  });

  $("grantHost").addEventListener("click", async () => {
    const raw = $("sync-url").value.trim();
    if (!raw) return setSyncStatus("Enter a server URL first.", "err");
    let origin;
    try {
      const u = new URL(raw);
      // Match patterns must not contain a port; host permission covers all ports.
      origin = u.protocol + "//" + u.hostname + "/*";
    } catch (e) {
      return setSyncStatus("That is not a valid URL.", "err");
    }
    try {
      const granted = await api.permissions.request({ origins: [origin] });
      setSyncStatus(granted ? "Access granted to " + origin : "Permission denied.", granted ? "ok" : "err");
    } catch (e) {
      setSyncStatus("Permission error: " + e.message, "err");
    }
  });

  $("loginBtn").addEventListener("click", async () => {
    const email = $("sync-email").value.trim();
    const password = $("sync-password").value;
    if (!email || !password) return setSyncStatus("Enter email and password.", "err");
    setSyncStatus("Signing in\u2026");
    const res = await api.runtime.sendMessage({ type: "login", email: email, password: password });
    if (res && res.ok) {
      settings.sync.email = email;
      scheduleSave();
      setSyncStatus("Signed in.", "ok");
      $("sync-password").value = "";
    } else {
      setSyncStatus((res && res.error) || "Login failed.", "err");
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await api.runtime.sendMessage({ type: "logout" });
    setSyncStatus("Signed out.");
  });

  $("syncNowBtn").addEventListener("click", async () => {
    setSyncStatus("Syncing\u2026");
    const res = await api.runtime.sendMessage({ type: "sync-now" });
    if (res && res.ok) setSyncStatus("Synced " + (res.count || 0) + " words.", "ok");
    else setSyncStatus("Sync failed: " + ((res && res.reason) || "unknown"), "err");
  });

  /* ------------------------------------------------------------------ *
   * Data
   * ------------------------------------------------------------------ */

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  $("exportJson").addEventListener("click", async () => {
    download("english-helper.json", await EH.exportJSON(), "application/json");
  });
  $("exportCsv").addEventListener("click", async () => {
    download("english-helper.csv", await EH.exportCSV(), "text/csv");
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await EH.importJSON(text);
      settings = await EH.getSettings();
      fillForm();
      renderDicts();
      toast("Imported \u2014 " + count + " words");
    } catch (err) {
      toast("Import failed: " + err.message);
    }
    e.target.value = "";
  });

  $("clearHistory").addEventListener("click", async () => {
    if (!confirm("Delete ALL saved words? This cannot be undone.")) return;
    await EH.clearHistory();
    toast("History cleared");
  });

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */

  (async function init() {
    settings = await EH.getSettings();
    populateLanguages();
    fillForm();
    renderDicts();
    bindSimpleControls();
    refreshSyncStatus();
  })();
})();
