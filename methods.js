/*
 * methods.js - URL building for configurable dictionaries.
 *
 * Every dictionary is just a template string with {word} and {accent}
 * placeholders, so users can add or edit sites from the options page without
 * any code change. Loaded after common.js.
 */
(function (root) {
  "use strict";
  const EH = (root.EH = root.EH || {});

  /**
   * Build a lookup URL for a dictionary entry.
   * @param {object} dict - settings dictionary entry ({ urlTemplate, ... })
   * @param {string} rawWord - the selected / saved word
   * @param {object} settings - current settings (for the accent preference)
   */
  EH.buildUrl = function (dict, rawWord, settings) {
    if (!dict || !dict.urlTemplate) return "";
    const word = encodeURIComponent(String(rawWord || "").trim().toLowerCase());
    const accent = (settings && settings.accent) || "us";
    return String(dict.urlTemplate)
      .replace(/\{word\}/g, word)
      .replace(/\{accent\}/g, accent);
  };

  /**
   * Build a Google Translate URL for the selected word using the configured
   * source/target languages from settings.translate.
   */
  EH.buildTranslateUrl = function (rawWord, settings) {
    const t = (settings && settings.translate) || {};
    const sl = t.source || "auto";
    const tl = t.target || "en";
    return (
      "https://translate.google.com/?sl=" +
      encodeURIComponent(sl) +
      "&tl=" +
      encodeURIComponent(tl) +
      "&text=" +
      encodeURIComponent(String(rawWord || "").trim()) +
      "&op=translate"
    );
  };

  // Legacy standalone builders kept for anything that calls them directly.
  EH.methods = {
    youglish: (w) => "https://youglish.com/pronounce/" + encodeURIComponent(String(w || "").toLowerCase().trim()) + "/english/us",
    youtube: (w) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(String(w || "").toLowerCase().trim()),
    cambridge: (w) => "https://dictionary.cambridge.org/dictionary/english/" + encodeURIComponent(String(w || "").toLowerCase().trim()),
    google: (w) => "https://www.google.com/search?q=how+to+pronounce+" + encodeURIComponent(String(w || "").toLowerCase().trim())
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
