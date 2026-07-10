/* Prime Collections — lightweight i18n
   Text lives in i18n/<code>.json. English (en) is the original/base and is
   already hard-coded in index.html, so the page works with no JS. This script
   swaps text when a language is chosen and remembers the choice.        */
(function () {
  "use strict";

  var SUPPORTED = ["en", "gd", "ga", "lt", "hi"];
  var STORE_KEY = "pc_lang";

  // dot-path lookup: get(dict, "hero.sub")
  function get(dict, path) {
    return path.split(".").reduce(function (o, k) {
      return (o && o[k] != null) ? o[k] : null;
    }, dict);
  }

  function apply(dict) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = get(dict, el.getAttribute("data-i18n"));
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = get(dict, el.getAttribute("data-i18n-html"));
      if (v != null) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var v = get(dict, el.getAttribute("data-i18n-ph"));
      if (v != null) el.setAttribute("placeholder", v);
    });
    var title = get(dict, "meta.title");
    if (title) document.title = title;
    var desc = get(dict, "meta.description");
    var m = document.querySelector('meta[name="description"]');
    if (desc && m) m.setAttribute("content", desc);
  }

  function load(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = "en";
    document.documentElement.setAttribute("lang", lang);
    fetch("i18n/" + lang + ".json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(apply)
      .catch(function () { /* leave the built-in English in place */ });
  }

  function initial() {
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (saved) return saved;
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return SUPPORTED.indexOf(nav) !== -1 ? nav : "en";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var lang = initial();
    var sel = document.getElementById("langSelect");
    if (sel) {
      sel.value = lang;
      sel.addEventListener("change", function () {
        try { localStorage.setItem(STORE_KEY, sel.value); } catch (e) {}
        load(sel.value);
      });
    }
    // English is already in the DOM; only fetch when a different language is active
    if (lang !== "en") load(lang);
  });
})();
