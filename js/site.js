/* Prime Collections — content loader
   Reads window.CONTENT (from content.js), fills {tokens} from the details
   block, and writes the text into the page. Non-technical people edit
   content.js only; this file never needs changing.

   Safety net: the page ships with the same English wording hard-coded in the
   HTML. If content.js has a typo and fails to load, the page keeps that
   wording instead of going blank. */
(function () {
  "use strict";
  var C = window.CONTENT;
  if (!C) return; // content.js missing/broken -> keep the built-in HTML text

  // Shared details available as {tokens} inside any sentence
  var vars = {
    company: C.company || "", phone: C.phone || "", email: C.email || "",
    established: C.established || "", regNumber: C.regNumber || "",
    regAddress: C.regAddress || "", year: C.year || ""
  };
  function fill(s) {
    return (typeof s === "string")
      ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; })
      : s;
  }
  function get(path) {
    return path.split(".").reduce(function (o, k) {
      return (o && o[k] != null) ? o[k] : null;
    }, C);
  }

  function run() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = get(el.getAttribute("data-i18n")); if (v != null) el.textContent = fill(v);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = get(el.getAttribute("data-i18n-html")); if (v != null) el.innerHTML = fill(v);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var v = get(el.getAttribute("data-i18n-ph")); if (v != null) el.setAttribute("placeholder", fill(v));
    });

    // Contact details written straight from the variables
    document.querySelectorAll('[data-var="phone"]').forEach(function (el) { if (vars.phone) el.textContent = vars.phone; });
    document.querySelectorAll('[data-var="email"]').forEach(function (el) { if (vars.email) el.textContent = vars.email; });
    document.querySelectorAll('[data-var="company"]').forEach(function (el) { if (vars.company) el.textContent = vars.company; });
    document.querySelectorAll('[data-var-href="tel"]').forEach(function (el) {
      if (vars.phone) el.setAttribute("href", "tel:" + vars.phone.replace(/[^0-9+]/g, ""));
    });
    document.querySelectorAll('[data-var-href="mailto"]').forEach(function (el) {
      if (vars.email) el.setAttribute("href", "mailto:" + vars.email);
    });

    // Browser tab title + search description
    var t = get("meta.title"); if (t) document.title = fill(t);
    var d = get("meta.description"), m = document.querySelector('meta[name="description"]');
    if (d && m) m.setAttribute("content", fill(d));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else { run(); }
})();
