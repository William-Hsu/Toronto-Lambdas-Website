/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   GradualBlur — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   A stack of `divCount` absolutely-positioned layers, each one a
   backdrop-filter blur masked to a narrow band of a linear gradient. The bands
   march towards the chosen edge while the blur strength climbs, so the page
   behind dissolves gradually instead of stopping at a hard line. The blur
   maths, the mask stops and their rounding are the reference's, unchanged.

   The element is decorative: it never takes pointer events and carries no
   text, so nothing here reaches the accessibility tree.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* Same prop names as the React component. */
  var DEFAULTS = {
    position: "bottom",      /* top | bottom | left | right                   */
    strength: 2,             /* multiplier on every layer's blur radius       */
    height: "6rem",          /* depth of the band (its width when left/right) */
    width: null,             /* cross-axis size; null = fill                  */
    divCount: 5,             /* number of masked layers                       */
    exponential: false,      /* exponential rather than linear ramp           */
    curve: "linear",         /* linear | bezier | ease-in | ease-out | ease-in-out */
    opacity: 1,
    zIndex: 1,
    target: "parent",        /* parent = absolute inside host; page = fixed   */
    fallbackColor: null      /* only used where backdrop-filter is missing    */
  };

  var NUMERIC = ["strength", "divCount", "opacity", "zIndex"];

  /* ---- 2. Curves --------------------------------------------------------- */
  /* Verbatim from the reference. */
  var CURVES = {
    linear: function (p) { return p; },
    bezier: function (p) { return p * p * (3 - 2 * p); },
    "ease-in": function (p) { return p * p; },
    "ease-out": function (p) { return 1 - Math.pow(1 - p, 2); },
    "ease-in-out": function (p) {
      return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    }
  };

  /* The mask runs towards the edge the blur sits on. */
  var DIRECTIONS = {
    top: "to top",
    bottom: "to bottom",
    left: "to left",
    right: "to right"
  };

  var VERTICAL = { top: true, bottom: true };

  /* ---- 3. Helpers -------------------------------------------------------- */
  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  /* A bare number means pixels, anything else is passed through as CSS. */
  function size(v, fallback) {
    if (v === null || v === undefined || v === "") return fallback;
    if (typeof v === "number") return isFinite(v) ? v + "px" : fallback;
    var s = String(v).trim();
    if (!s) return fallback;
    if (/^-?\d*\.?\d+$/.test(s)) return s + "px";
    return s;
  }

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

    if (!DIRECTIONS[o.position]) o.position = DEFAULTS.position;
    if (!CURVES[o.curve]) o.curve = DEFAULTS.curve;
    o.divCount = Math.max(1, Math.min(24, Math.round(o.divCount)));
    o.strength = Math.max(0, o.strength);
    o.opacity = Math.max(0, Math.min(1, o.opacity));
    o.exponential = !!o.exponential;
    if (o.target !== "page") o.target = "parent";
    o.height = size(o.height, DEFAULTS.height);
    o.width = size(o.width, null);
    return o;
  }

  /* ---- 4. Mount ---------------------------------------------------------- */
  function mount(root, options) {
    if (!root) return function () {};

    var cfg = settings(options);
    var curve = CURVES[cfg.curve];
    var direction = DIRECTIONS[cfg.position];
    var vertical = !!VERTICAL[cfg.position];
    var increment = 100 / cfg.divCount;
    var layers = [];
    var i;

    /* The host is decorative through and through. */
    root.classList.add("gradual-blur");
    root.classList.add("gradual-blur--" + cfg.position);
    root.classList.add(cfg.target === "page" ? "gradual-blur--page" : "gradual-blur--parent");
    root.setAttribute("aria-hidden", "true");

    var s = root.style;
    s.zIndex = String(cfg.target === "page" ? cfg.zIndex + 100 : cfg.zIndex);
    s.opacity = String(cfg.opacity);
    if (vertical) {
      s.height = cfg.height;
      s.width = cfg.width || "100%";
    } else {
      s.width = cfg.height;              /* the band's depth, horizontally   */
      s.height = cfg.width || "100%";
    }
    if (cfg.fallbackColor) s.setProperty("--gb-fallback", String(cfg.fallbackColor));

    /* Only the parent target needs a positioning context on the host's
       parent; a page overlay is fixed and needs nothing. */
    if (cfg.target === "parent" && root.parentNode && root.parentNode.nodeType === 1) {
      var parent = root.parentNode;
      var computed = window.getComputedStyle ? window.getComputedStyle(parent) : null;
      if (computed && computed.position === "static") parent.style.position = "relative";
    }

    for (i = 1; i <= cfg.divCount; i++) {
      var progress = curve(i / cfg.divCount);

      /* Reference blur ramp, unchanged. */
      var blur = cfg.exponential
        ? Math.pow(2, progress * 4) * 0.0625 * cfg.strength
        : 0.0625 * (progress * cfg.divCount + 1) * cfg.strength;

      /* Reference mask stops, including the one-decimal rounding. */
      var p1 = Math.round((increment * i - increment) * 10) / 10;
      var p2 = Math.round(increment * i * 10) / 10;
      var p3 = Math.round((increment * i + increment) * 10) / 10;
      var p4 = Math.round((increment * i + increment * 2) * 10) / 10;

      var gradient = "transparent " + p1 + "%, black " + p2 + "%";
      if (p3 <= 100) gradient += ", black " + p3 + "%";
      if (p4 <= 100) gradient += ", transparent " + p4 + "%";

      var mask = "linear-gradient(" + direction + ", " + gradient + ")";

      var layer = document.createElement("div");
      layer.className = "gradual-blur__layer";
      layer.style.webkitMaskImage = mask;
      layer.style.maskImage = mask;
      layer.style.webkitBackdropFilter = "blur(" + blur.toFixed(3) + "rem)";
      layer.style.backdropFilter = "blur(" + blur.toFixed(3) + "rem)";
      root.appendChild(layer);
      layers.push(layer);
    }

    /* A fixed bottom overlay stands down as the reader reaches the end of
       the page, so the footer is never permanently smeared. */
    var onScroll = null;
    if (cfg.target === "page" && cfg.position === "bottom") {
      s.transition = "opacity 0.3s ease-out";
      onScroll = function () {
        var doc = document.documentElement;
        var y = window.scrollY || window.pageYOffset || 0;
        var remaining = doc.scrollHeight - y - window.innerHeight;
        var span = Math.max(root.offsetHeight * 1.5, 120);
        var t = Math.max(0, Math.min(1, remaining / span));
        root.style.opacity = String(cfg.opacity * t);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      onScroll();
    }

    return function destroy() {
      if (onScroll) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
      for (var k = 0; k < layers.length; k++) {
        if (layers[k].parentNode) layers[k].parentNode.removeChild(layers[k]);
      }
      layers = [];
      root.classList.remove("gradual-blur");
      root.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.gradualBlur = mount;

  /* ---- 5. Auto-init ------------------------------------------------------ */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-gradual-blur]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-gradual-blur");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
