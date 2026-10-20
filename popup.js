/*
 * popup.js - toolbar popup: on/off toggle, quick stats, shortcuts.
 */
(function () {
  "use strict";
  const EH = window.EH;
  const api = EH.api;
  const $ = (id) => document.getElementById(id);
  let settings = EH.mergeSettings({});

  function paintToggle() {
    const btn = $("toggle");
    btn.textContent = settings.enabled ? "English Helper is ON" : "English Helper is OFF";
    btn.classList.toggle("off", !settings.enabled);
  }

  async function paintStats() {
    const history = await EH.getHistory();
    const stats = EH.computeStats(history);
    $("s-total").textContent = stats.total;
    $("s-today").textContent = stats.learnedToday;
    $("s-due").textContent = settings.srs.enabled ? stats.due : "-";
  }

  async function paintSync() {
    const auth = await EH.getAuth();
    $("syncLine").textContent = auth ? "Synced account: " + (auth.email || "signed in") : "Not signed in \u2014 open Settings to enable sync.";
  }

  function openPage(hash) {
    api.tabs.create({ url: EH.runtimeGetURL("history.html") + (hash || "") });
    window.close();
  }

  function openExternal(url) {
    api.tabs.create({ url: url });
    window.close();
  }

  $("toggle").addEventListener("click", async () => {
    settings.enabled = !settings.enabled;
    settings = await EH.saveSettings(settings);
    paintToggle();
    api.runtime.sendMessage({ type: "refresh-badge" });
  });

  $("openHistory").addEventListener("click", () => openPage("#history"));
  $("openReview").addEventListener("click", () => openPage("#review"));
  $("openOptions").addEventListener("click", () => {
    EH.openOptions();
    window.close();
  });

  $("githubLink").addEventListener("click", (e) => {
    e.preventDefault();
    openExternal("https://github.com/GeeSuth");
  });
  $("issuesLink").addEventListener("click", (e) => {
    e.preventDefault();
    openExternal("https://github.com/GeeSuth/pronunciation-ext/issues");
  });

  (async function init() {
    settings = await EH.getSettings();
    paintToggle();
    paintStats();
    paintSync();
  })();
})();
