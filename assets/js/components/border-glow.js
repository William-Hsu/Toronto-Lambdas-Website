/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   BorderGlow — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   The host element keeps its own markup: the script only marks it, injects a
   single decorative <span class="edge-light"> and writes two custom
   properties as the pointer moves —

     --edge-proximity   0 at the middle of the element, 1 once the pointer is
                        within `glowRadius` of the nearest edge (the reference's
                        min of the centre-relative kx / ky distances)
     --cursor-angle     the pointer's bearing from the centre, in degrees

   The CSS turns those two numbers into a conic-masked hairline along the
   border and a soft bloom just outside it. The reference's animated intro
   sweep and its rainbow mesh fill are deliberately omitted: this house style
   is engraved, not lit, so a single warm hue is all that is used.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  var DEFAULTS = {
    /* HSL channels without the wrapper, so CSS can vary the alpha.
       The default is --accent-dark #C9B98E expressed as hsl. */
    glowColor: null,
    variant: "gold",         /* gold | navy — a preset for glowColor          */
    glowRadius: 120,         /* px from an edge at which the glow reaches 1   */
    coneSpread: 120,         /* degrees of arc lit around the cursor bearing  */
    edgeSensitivity: 1.4,    /* >1 keeps the middle of the element dark       */
    intensity: 1,            /* overall multiplier, 0..1(+)                   */
    thickness: 1,            /* hairline width in px                          */
    focusProximity: 0.85     /* glow shown for keyboard focus                 */
  };

  var VARIANTS = {
    gold: "43 45% 67%",      /* --accent-dark #C9B98E */
    navy: "219 48% 34%"      /* a lit cousin of --navy-700 #1B3057 */
  };

  var NUMERIC = [
    "glowRadius", "coneSpread", "edgeSensitivity", "intensity",
    "thickness", "focusProximity"
  ];

  /* ---- 2. Helpers -------------------------------------------------------- */
  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function settings(options) {
    var o = {}, k, i;
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) o[k] = DEFAULTS[k];
    }
    if (options) {
      for (k in options) {
        if (!Object.prototype.hasOwnProperty.call(options, k)) continue;
        if (options[k] === null || options[k] === undefined) continue;
        o[k] = options[k];
      }
    }
    for (i = 0; i < NUMERIC.length; i++) o[NUMERIC[i]] = num(o[NUMERIC[i]], DEFAULTS[NUMERIC[i]]);

    if (!VARIANTS[o.variant]) o.variant = "gold";
    if (!o.glowColor) o.glowColor = VARIANTS[o.variant];
    o.glowColor = String(o.glowColor).trim();

    o.glowRadius = Math.max(1, o.glowRadius);
    o.coneSpread = Math.max(10, Math.min(360, o.coneSpread));
    o.edgeSensitivity = Math.max(0.1, o.edgeSensitivity);
    o.intensity = Math.max(0, o.intensity);
    o.thickness = Math.max(0.5, o.thickness);
    o.focusProximity = clamp01(o.focusProximity);
    return o;
  }

  /* ---- 3. Mount ---------------------------------------------------------- */
  function mount(host, options) {
    if (!host) return function () {};

    var cfg = settings(options);
    var light = null;
    var rafId = null;
    var pending = null;         /* last pointer event coords awaiting a frame */
    var destroyed = false;
    var focused = false;

    /* ---- 3a. Decorate without touching the host's own children ---------- */
    host.classList.add("border-glow-card");

    var computed = window.getComputedStyle ? window.getComputedStyle(host) : null;
    if (computed && computed.position === "static") host.style.position = "relative";

    host.style.setProperty("--bg-color", cfg.glowColor);
    host.style.setProperty("--bg-cone", cfg.coneSpread + "deg");
    host.style.setProperty("--bg-thickness", cfg.thickness + "px");
    host.style.setProperty("--bg-intensity", String(cfg.intensity));
    host.style.setProperty("--edge-proximity", "0");
    host.style.setProperty("--cursor-angle", "0deg");

    light = document.createElement("span");
    light.className = "edge-light";
    light.setAttribute("aria-hidden", "true");
    host.appendChild(light);

    /* ---- 3b. Geometry ---------------------------------------------------- */
    function apply(clientX, clientY) {
      var rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      var x = clientX - rect.left;
      var y = clientY - rect.top;

      /* Distance to the nearest edge on each axis, then the nearer of the two
         — the reference's min(kx, ky). */
      var kx = Math.min(x, rect.width - x);
      var ky = Math.min(y, rect.height - y);
      var edge = Math.min(kx, ky);

      var raw = clamp01(1 - edge / cfg.glowRadius);
      var proximity = Math.pow(raw, cfg.edgeSensitivity);

      var angle = Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI;
      angle = (angle + 360) % 360;

      host.style.setProperty("--edge-proximity", proximity.toFixed(4));
      host.style.setProperty("--cursor-angle", angle.toFixed(2) + "deg");
    }

    /* One write per frame, and the handle is kept so nothing survives
       destroy(). */
    function schedule() {
      if (rafId !== null || destroyed) return;
      rafId = requestAnimationFrame(function () {
        rafId = null;
        if (destroyed || !pending) return;
        apply(pending.x, pending.y);
      });
    }

    function onMove(e) {
      pending = { x: e.clientX, y: e.clientY };
      schedule();
    }

    function onEnter() { host.classList.add("is-lit"); }

    function onLeave() {
      pending = null;
      host.classList.remove("is-lit");
      if (!focused) host.style.setProperty("--edge-proximity", "0");
    }

    /* ---- 3c. Keyboard ---------------------------------------------------- */
    /* A focused control lights its whole border rather than one arc, so the
       glow is not a mouse-only affordance. */
    function onFocus(e) {
      if (e.target !== host && !host.contains(e.target)) return;
      focused = true;
      host.classList.add("is-focus", "is-lit");
      host.style.setProperty("--edge-proximity", String(cfg.focusProximity));
    }

    function onBlur() {
      focused = false;
      host.classList.remove("is-focus", "is-lit");
      host.style.setProperty("--edge-proximity", "0");
    }

    var hasPointer = !!window.PointerEvent;
    var MOVE = hasPointer ? "pointermove" : "mousemove";
    var ENTER = hasPointer ? "pointerenter" : "mouseenter";
    var LEAVE = hasPointer ? "pointerleave" : "mouseleave";

    host.addEventListener(MOVE, onMove);
    host.addEventListener(ENTER, onEnter);
    host.addEventListener(LEAVE, onLeave);
    host.addEventListener("focusin", onFocus);
    host.addEventListener("focusout", onBlur);

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
      host.removeEventListener(MOVE, onMove);
      host.removeEventListener(ENTER, onEnter);
      host.removeEventListener(LEAVE, onLeave);
      host.removeEventListener("focusin", onFocus);
      host.removeEventListener("focusout", onBlur);
      if (light && light.parentNode) light.parentNode.removeChild(light);
      light = null;
      host.classList.remove("border-glow-card", "is-lit", "is-focus");
      host.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.borderGlow = mount;

  /* ---- 4. Auto-init ------------------------------------------------------ */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-border-glow]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-border-glow");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
