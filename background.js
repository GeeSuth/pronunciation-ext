/*
 * background.js - MV3 service worker.
 *
 * Responsibilities: context menu, keyboard commands, badge, the dictionary
 * API proxy (so the page never needs cross-origin permission), and running
 * the sync client.
 */
importScripts("common.js");

const api = self.EH.api;

/* ---------------------------------------------------------------------- *
 * Context menu
 * ---------------------------------------------------------------------- */

function createMenus() {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({
      id: "eh-lookup",
      title: 'Look up "%s"',
      contexts: ["selection"]
    });
    api.contextMenus.create({
      id: "eh-sep",
      type: "separator",
      contexts: ["selection"]
    });
    api.contextMenus.create({
      id: "eh-options",
      title: "English Helper settings\u2026",
      contexts: ["action"]
    });
  });
}

api.runtime.onInstalled.addListener(() => {
  createMenus();
  self.EH.getSettings().then((s) => updateBadge(s));
});

api.runtime.onStartup.addListener(() => {
  createMenus();
});

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "eh-options") {
    self.EH.openOptions();
    return;
  }
  if (info.menuItemId !== "eh-lookup" || !info.selectionText) return;
  await dispatchLookup(tab, info.selectionText.trim());
});

/* ---------------------------------------------------------------------- *
 * Keyboard commands
 * ---------------------------------------------------------------------- */

api.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-enabled") {
    const settings = await self.EH.getSettings();
    settings.enabled = !settings.enabled;
    await self.EH.saveSettings(settings);
    return;
  }
  if (command === "lookup-selection") {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) return;
    const ok = await sendToTab(tab.id, { type: "lookup-selection" });
    if (!ok) {
      const word = await readSelection(tab.id);
      if (word) await dispatchLookup(tab, word.trim());
    }
  }
});

async function readSelection(tabId) {
  try {
    const results = await api.scripting.executeScript({
      target: { tabId: tabId },
      func: () => String(window.getSelection ? window.getSelection().toString() : "")
    });
    return (results && results[0] && results[0].result) || "";
  } catch (e) {
    return "";
  }
}

/*
 * Send a message to a tab's content script, injecting it first if the page
 * was already open when the extension (re)loaded.
 */
async function sendToTab(tabId, msg) {
  if (tabId == null) return false;
  try {
    await api.tabs.sendMessage(tabId, msg);
    return true;
  } catch (e) {
    /* not injected yet */
  }
  try {
    await api.scripting.insertCSS({ target: { tabId: tabId }, files: ["content.css"] });
    await api.scripting.executeScript({
      target: { tabId: tabId },
      files: ["common.js", "methods.js", "content.js"]
    });
    await api.tabs.sendMessage(tabId, msg);
    return true;
  } catch (e) {
    return false;
  }
}

/* Fallback for pages where no content script can run (chrome://, web store). */
async function dispatchLookup(tab, word) {
  const settings = await self.EH.getSettings();
  const ok = await sendToTab(tab && tab.id, { type: "lookup", word: word, sentence: "" });
  if (ok) return;
  const dict = settings.dictionaries.find((d) => d.enabled) || settings.dictionaries[0];
  if (dict && tab && tab.id != null) {
    const url = self.EH.buildUrl(dict, word, settings);
    if (url) api.tabs.create({ url: url });
    await self.EH.addWord(word, {});
  }
}

/* ---------------------------------------------------------------------- *
 * Message router (definitions + sync + badge)
 * ---------------------------------------------------------------------- */

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === "define") {
    self.EH.fetchDefinition(msg.word, msg.force)
      .then((def) => sendResponse({ ok: true, def: def }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg.type === "translate") {
    self.EH.fetchTranslation(msg.word, msg.target, msg.source, msg.force)
      .then((tr) => sendResponse({ ok: true, translation: tr }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg.type === "sync-now") {
    self.EH.syncApi.syncNow().then((r) => sendResponse(r));
    return true;
  }

  if (msg.type === "login") {
    self.EH.syncApi
      .login(msg.email, msg.password)
      .then((r) => sendResponse({ ok: true, data: r }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }

  if (msg.type === "logout") {
    self.EH.syncApi.logout().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "refresh-badge") {
    self.EH.getSettings().then((s) => updateBadge(s));
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

/* ---------------------------------------------------------------------- *
 * Badge
 * ---------------------------------------------------------------------- */

async function updateBadge(settings) {
  try {
    const s = settings || (await self.EH.getSettings());
    if (!s.features.badge) {
      api.action.setBadgeText({ text: "" });
      return;
    }
    const history = await self.EH.getHistory();
    const stats = self.EH.computeStats(history);
    if (s.srs.enabled && stats.due > 0) {
      api.action.setBadgeText({ text: String(stats.due) });
      api.action.setBadgeBackgroundColor({ color: "#dc3545" });
      api.action.setTitle({ title: stats.due + " word(s) due for review" });
    } else {
      api.action.setBadgeText({ text: stats.learnedToday ? String(stats.learnedToday) : "" });
      api.action.setBadgeBackgroundColor({ color: "#4CAF50" });
      api.action.setTitle({ title: stats.learnedToday + " new word(s) today" });
    }
  } catch (e) {
    /* ignore */
  }
}

self.EH.onHistoryChanged(() => {
  self.EH.getSettings().then((s) => updateBadge(s));
});
self.EH.onSettingsChanged((s) => updateBadge(s));

/* Auto-sync on history change when signed in (best-effort, non-blocking). */
self.EH.onHistoryChanged(async () => {
  const settings = await self.EH.getSettings();
  if (!settings.sync.autoSync) return;
  const auth = await self.EH.getAuth();
  if (!auth) return;
  self.EH.syncApi.syncNow().catch(() => {});
});
