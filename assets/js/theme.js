/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   Theme: the light impression (ink on paper) and the dark one (gilt on
   midnight stock). Stored choice wins; otherwise the operating system does.

   Loaded with `defer` from <head>, so it runs before DOMContentLoaded and
   before main.js builds the header. Clicks are handled by delegation on
   document, so the toggle works whether it exists yet or not.
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "lphie-theme";
  var GLYPH = { light: "☾", dark: "☀" };   /* ☾ offer dark · ☀ offer light */
  var LABEL = { light: "Dark mode", dark: "Light mode" };

  var root = document.documentElement;

  function stored() {
    try {
      var v = window.localStorage.getItem(KEY);
      return (v === "light" || v === "dark") ? v : null;
    } catch (e) { return null; }
  }

  /* The chapter's plate is struck in the dark impression by default: a
     visitor who has expressed no preference of their own is shown the dark
     one, whatever their operating system happens to prefer. A visitor who
     HAS chosen is never overridden — see stored(). */
  function preferred() {
    return "dark";
  }

  function current() {
    var t = root.getAttribute("data-theme");
    return (t === "light" || t === "dark") ? t : (stored() || preferred());
  }

  /* The crest exists in two plates: navy for paper, cream for midnight.
     The footer crest is always on navy and is left alone. */
  function syncCrests(theme) {
    var want = theme === "dark" ? "crest.png" : "crest-navy.png";
    var nodes = document.querySelectorAll(".nav__crest, .hero__crest");
    Array.prototype.forEach.call(nodes, function (img) {
      var src = img.getAttribute("src") || "";
      var next = src.replace(/crest(-navy)?\.png/, want);
      if (next !== src) img.setAttribute("src", next);
    });
  }

  function syncToggles(theme) {
    var nodes = document.querySelectorAll("[data-theme-toggle]");
    Array.prototype.forEach.call(nodes, function (btn) {
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      var g = btn.querySelector("[data-theme-glyph]");
      if (g) g.textContent = GLYPH[theme];
      var l = btn.querySelector("[data-theme-label]");
      if (l) l.textContent = LABEL[theme];
      if (!btn.getAttribute("title")) btn.setAttribute("title", "Switch theme");
    });
  }

  /* Re-paint every themed affordance. Safe to call as often as you like. */
  function sync() {
    var theme = current();
    root.setAttribute("data-theme", theme);
    syncCrests(theme);
    syncToggles(theme);
    return theme;
  }

  function apply(theme, persist) {
    root.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
    if (persist) {
      try { window.localStorage.setItem(KEY, theme); } catch (e) { /* private mode */ }
    }
    sync();
  }

  function toggleTheme() {
    apply(current() === "dark" ? "light" : "dark", true);
  }

  /* ---- wiring ----------------------------------------------------------- */
  /* Delegated: the header is injected later by main.js. */
  document.addEventListener("click", function (e) {
    var t = e.target;
    var btn = t && t.closest ? t.closest("[data-theme-toggle]") : null;
    if (!btn) return;
    e.preventDefault();
    toggleTheme();
  });

  /* The OS is deliberately NOT followed: the default is the dark impression
     for everyone who has not chosen, so an OS switch mid-visit must not move
     the page underneath the reader. */

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.toggleTheme = toggleTheme;
  window.LPHIE.setTheme = function (t) { apply(t, true); };
  window.LPHIE.getTheme = current;
  window.LPHIE.syncTheme = sync;

  sync();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync);
})();
