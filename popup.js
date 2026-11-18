/*
 * popup.js - toolbar popup: on/off toggle, per-site blocking, quick stats.
 */
(function () {
  "use strict";
  const EH = window.EH;
  const api = EH.api;
  const $ = (id) => document.getElementById(id);
  let settings = EH.mergeSettings({});
  let tab = null;
  let site = "";

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

  /* ------------------------------------------------------------------ *
   * This site
   * ------------------------------------------------------------------ */

  async function loadTab() {
    try {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      tab = tabs && tabs[0] ? tabs[0] : null;
    } catch (e) {
      tab = null;
    }
    site = tab && tab.url ? EH.normalizeSite(tab.url) : "";
  }

  function paintSite() {
    const btn = $("toggleSite");
    const nameEl = $("siteName");
    const stateEl = $("siteState");

    if (!site) {
      nameEl.textContent = tab && tab.url ? "Unsupported page" : "No active page";
      stateEl.textContent = "";
      stateEl.className = "site-state";
      btn.disabled = true;
      btn.classList.remove("danger");
      btn.textContent = "Block this site";
      return;
    }

    const blocked = EH.isSiteExcluded(tab.url, settings);
    nameEl.textContent = site;
    nameEl.title = site;
    stateEl.textContent = blocked ? "Blocked" : "Active";
    stateEl.className = "site-state" + (blocked ? " blocked" : "");
    btn.disabled = false;
    btn.classList.toggle("danger", blocked);
    btn.textContent = blocked ? "Allow on this site" : "Block this site";
  }

  function paintBlockedList() {
    const list = $("blockedList");
    list.innerHTML = "";
    const sites = Array.isArray(settings.excludedSites) ? settings.excludedSites : [];

    if (!sites.length) {
      const empty = document.createElement("span");
      empty.className = "blocked-empty";
      empty.textContent = "None \u2014 English Helper runs everywhere.";
      list.appendChild(empty);
      return;
    }

    sites.forEach((entry) => {
      const chip = document.createElement("span");
      chip.className = "chip";

      const label = document.createElement("span");
      label.textContent = entry;
      chip.appendChild(label);

      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "\u2715";
      del.title = "Allow English Helper on " + entry;
      del.addEventListener("click", async () => {
        if (!EH.removeExcludedSite(settings, entry)) return;
        await EH.saveSettings(settings);
        paintSite();
        paintBlockedList();
      });
      chip.appendChild(del);

      list.appendChild(chip);
    });
  }

  $("toggleSite").addEventListener("click", async () => {
    if (!site) return;
    const blocked = EH.isSiteExcluded(tab.url, settings);
    const changed = blocked ? EH.removeExcludedSite(settings, site) : EH.addExcludedSite(settings, site);
    if (!changed) return;
    await EH.saveSettings(settings);
    paintSite();
    paintBlockedList();
  });

  /* ------------------------------------------------------------------ *
   * Pages / links
   * ------------------------------------------------------------------ */

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
    await loadTab();
    paintSite();
    paintBlockedList();
    paintStats();
    paintSync();
  })();
})();
