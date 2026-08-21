/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   AccordionGallery — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   Panels expand on hover (mouse) or on tap (touch). Clicking a panel that is
   not yet active only opens it — the link is suppressed. Clicking the panel
   that is already active follows its href. So a phone gets tap-to-open then
   tap-again-to-go, which is why the active panel carries an "Explore →" cue.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* Same prop names as the React reference. Values retuned for this site:
     the purple-black #060010 becomes --navy-900, radius drops 16 -> 8 to match
     --radius-lg, and defaultIndex is 0 so Brotherhood opens first. */
  var DEFAULTS = {
    items: null,
    defaultIndex: 0,
    accentColor: "#FFFFFF",
    overlayColor: "#061539",
    textColor: "#FFFFFF",
    height: 460,
    gap: 10,
    radius: 8,
    expandRatio: 0.52,
    orientation: "horizontal",
    duration: 0.6,
    ease: "power3.out",
    parallax: 0.5,
    tilt: 8,
    stagger: 0.06,
    trigger: "hover",
    showLabels: true,
    grayscale: true,
    cueText: "Explore →",
    imageBase: "assets/img/gallery/",
    className: ""
  };

  /* Used only when data/pillars.js is missing. Keep in step with that file. */
  var FALLBACK_ITEMS = [
    { label: "Brotherhood",  letter: "Β", link: "brotherhood.html",        image: "" },
    { label: "Academics",    letter: "Α", link: "alumni.html",             image: "" },
    { label: "Philanthropy", letter: "Φ", link: "philanthropy.html",       image: "" },
    { label: "Social",       letter: "Σ", link: "brotherhood.html#social", image: "" }
  ];

  /* Deterministic navy gradients, picked by item index so no two neighbours
     match. Royal blue and white only — no third hue. */
  var PH_STOPS = [
    ["#12296B", "#061539"],
    ["#1C3B8F", "#0B1E52"],
    ["#0B1E52", "#12296B"],
    ["#2A50B4", "#12296B"]
  ];
  var PH_ANGLES = ["155deg", "200deg", "135deg", "215deg"];

  /* ---- 2. Helpers -------------------------------------------------------- */
  /* Depth-aware asset prefix, same rule main.js uses. */
  var PREFIX = (function () {
    var d = document.documentElement.getAttribute("data-root");
    return d === null ? "" : d;
  })();

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, e) { return a + (b - a) * e; }

  /* GSAP power3.out, exactly. */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function opt(options, key) {
    return (options && options[key] !== undefined && options[key] !== null)
      ? options[key] : DEFAULTS[key];
  }

  function makeEl(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /* True only for a real pointing device. Touch screens report (hover: none),
     which is what keeps the first tap from being swallowed by a phantom
     mouseenter and navigating straight away. */
  function hasRealHover() {
    return !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }

  /* ---- 3. Mount ---------------------------------------------------------- */
  function mount(root, options) {
    if (!root) return function () {};

    var items = opt(options, "items");
    if (!items || !items.length) items = window.LPHIE.pillarsGallery;
    if (!items || !items.length) items = FALLBACK_ITEMS;

    var count = items.length;
    if (!count) return function () {};

    var accentColor = opt(options, "accentColor");
    var overlayColor = opt(options, "overlayColor");
    var textColor = opt(options, "textColor");
    var height = opt(options, "height");
    var gap = opt(options, "gap");
    var radius = opt(options, "radius");
    var expandRatio = opt(options, "expandRatio");
    var vertical = opt(options, "orientation") === "vertical";
    var duration = opt(options, "duration");
    var parallax = opt(options, "parallax");
    var tilt = opt(options, "tilt");
    var stagger = opt(options, "stagger");
    var trigger = opt(options, "trigger");
    var showLabels = opt(options, "showLabels");
    var grayscale = opt(options, "grayscale");
    var cueText = opt(options, "cueText");
    var imageBase = opt(options, "imageBase");
    var extraClass = opt(options, "className");

    var active = clamp(opt(options, "defaultIndex") | 0, 0, count - 1);
    var mediaSize = 320;
    var firstRun = true;
    var visible = true;
    var rafId = 0;
    var startTime = 0;
    var tweenDur = 0;
    var maxEnd = 0;
    var destroyed = false;

    var reducedQuery = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var prefersReduced = reducedQuery ? reducedQuery.matches : false;

    var originalHtml = root.innerHTML;
    var originalClass = root.className;

    /* -- 3a. DOM ----------------------------------------------------------- */
    var panels = [];
    var medias = [];
    var bars = [];
    var texts = [];
    var cues = [];

    root.innerHTML = "";
    /* Add to whatever classes the page already put here (e.g. "reveal"). */
    root.className = (originalClass ? originalClass + " " : "") + "accordion-gallery" +
      (vertical ? " accordion-gallery--vertical" : "") +
      (extraClass ? " " + extraClass : "");
    root.style.setProperty("--ag-accent", accentColor);
    root.style.setProperty("--ag-overlay", overlayColor);
    root.style.setProperty("--ag-text", textColor);
    root.style.setProperty("--ag-gap", gap + "px");
    root.style.setProperty("--ag-radius", radius + "px");
    root.style.height = (vertical ? Math.round(height * 1.6) : height) + "px";
    root.setAttribute("role", "list");
    root.setAttribute("aria-label", "Image accordion gallery");

    function buildPanel(item, i) {
      var panel = makeEl(item.link ? "a" : "div", "ag-panel");
      panel.style.borderRadius = radius + "px";
      if (item.link) panel.setAttribute("href", PREFIX + item.link);
      panel.setAttribute("role", "listitem");
      panel.setAttribute("tabindex", "0");
      panel.setAttribute("aria-label", item.label || "");

      var frame = makeEl("span", "ag-panel__frame");
      var media = makeEl("span", "ag-panel__media");

      var stops = PH_STOPS[i % PH_STOPS.length];
      var placeholder = makeEl("span", "ag-panel__ph");
      placeholder.style.setProperty("--ag-ph-a", stops[0]);
      placeholder.style.setProperty("--ag-ph-b", stops[1]);
      placeholder.style.setProperty("--ag-ph-angle", PH_ANGLES[i % PH_ANGLES.length]);
      var letter = makeEl("span", "ag-panel__letter");
      letter.textContent = item.letter || "";
      placeholder.appendChild(letter);
      media.appendChild(placeholder);

      if (item.image) {
        var img = document.createElement("img");
        img.setAttribute("alt", item.alt || item.label || "");
        img.setAttribute("draggable", "false");
        img.setAttribute("loading", "lazy");
        /* If the photo is missing the deliberate gradient stays put. */
        img.onerror = function () {
          if (img.parentNode) img.parentNode.removeChild(img);
        };
        img.src = PREFIX + imageBase + item.image;
        media.appendChild(img);
      }

      var overlay = makeEl("span", "ag-panel__overlay");
      overlay.setAttribute("aria-hidden", "true");

      frame.appendChild(media);
      frame.appendChild(overlay);
      panel.appendChild(frame);

      var bar = null, text = null, cue = null;
      if (showLabels) {
        var label = makeEl("span", "ag-panel__label");
        label.setAttribute("aria-hidden", "true");
        bar = makeEl("span", "ag-panel__bar");
        var lines = makeEl("span", "ag-panel__lines");
        text = makeEl("span", "ag-panel__text");
        text.textContent = item.label || "";
        cue = makeEl("span", "ag-panel__cue");
        cue.textContent = cueText;
        lines.appendChild(text);
        lines.appendChild(cue);
        label.appendChild(bar);
        label.appendChild(lines);
        panel.appendChild(label);
      }

      panels.push(panel);
      medias.push(media);
      bars.push(bar);
      texts.push(text);
      cues.push(cue);
      root.appendChild(panel);
    }

    for (var b = 0; b < count; b++) buildPanel(items[b], b);

    /* -- 3b. Animation state ---------------------------------------------- */
    /* One shared rAF timeline drives every panel: flex-grow, the rotateY tilt,
       the media parallax offset, --ag-gray / --ag-dim, and the staggered label
       parts all advance off the same clock, exactly as the GSAP timeline did. */
    function blank() {
      return {
        grow: 1, rot: 0, shift: 0, gray: grayscale ? 1 : 0, dim: 0.35,
        barO: 0, barX: -14, textO: 0, textX: -14, cueO: 0, cueX: -14
      };
    }

    var cur = [];
    var from = [];
    var to = [];
    for (var s = 0; s < count; s++) { cur.push(blank()); from.push(blank()); to.push(blank()); }

    function copyInto(dst, src) {
      dst.grow = src.grow; dst.rot = src.rot; dst.shift = src.shift;
      dst.gray = src.gray; dst.dim = src.dim;
      dst.barO = src.barO; dst.barX = src.barX;
      dst.textO = src.textO; dst.textX = src.textX;
      dst.cueO = src.cueO; dst.cueX = src.cueX;
    }

    function computeTargets() {
      var r = clamp(expandRatio, 0.2, 0.9);
      var grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;

      for (var i = 0; i < count; i++) {
        var isActive = i === active;
        var t = to[i];

        t.grow = isActive ? grow : 1;
        t.rot = isActive ? 0 : (i < active ? tilt : -tilt);

        var drift = clamp(active - i, -1.5, 1.5);
        t.shift = isActive ? 0 : drift * parallax * mediaSize * 0.06;
        t.gray = grayscale ? (isActive ? 0 : 1) : 0;
        t.dim = isActive ? 0 : 0.35;

        t.barO = isActive ? 1 : 0;
        t.barX = isActive ? 0 : -14;
        t.textO = t.barO; t.textX = t.barX;
        t.cueO = t.barO; t.cueX = t.barX;
      }
    }

    function writePanel(i) {
      var v = cur[i];
      var panel = panels[i];
      panel.style.flexGrow = String(v.grow);
      panel.style.transform = vertical
        ? "rotateX(" + (-v.rot) + "deg)"
        : "rotateY(" + v.rot + "deg)";

      var media = medias[i];
      /* GSAP's xPercent/yPercent -50 plus a pixel offset. */
      if (vertical) {
        media.style.transform = "translate(-50%, calc(-50% + " + v.shift + "px))";
      } else {
        media.style.transform = "translate(calc(-50% + " + v.shift + "px), -50%)";
      }
      /* Set on the panel, not the media: the overlay is the media's sibling
         and inherits --ag-dim only from a shared ancestor. */
      panel.style.setProperty("--ag-gray", String(v.gray));
      panel.style.setProperty("--ag-dim", String(v.dim));

      if (showLabels) {
        var bar = bars[i], text = texts[i], cue = cues[i];
        if (bar) { bar.style.opacity = String(v.barO); bar.style.transform = "translateX(" + v.barX + "px)"; }
        if (text) { text.style.opacity = String(v.textO); text.style.transform = "translateX(" + v.textX + "px)"; }
        if (cue) { cue.style.opacity = String(v.cueO); cue.style.transform = "translateX(" + v.cueX + "px)"; }
      }

      if (i === active) panel.setAttribute("aria-current", "true");
      else panel.removeAttribute("aria-current");
      if (i === active) panel.className = "ag-panel ag-panel--active";
      else panel.className = "ag-panel";
    }

    function writeAll() { for (var i = 0; i < count; i++) writePanel(i); }

    function snap() {
      for (var i = 0; i < count; i++) copyInto(cur[i], to[i]);
      writeAll();
    }

    /* Per-element (delay, duration) inside the timeline, mirroring the GSAP
       calls: the panel and media tween for the full duration; an activating label
       staggers bar -> text -> cue; a deactivating label runs at 0.6x speed. */
    function labelTiming(i, slot) {
      var isActive = i === active;
      if (isActive) return [stagger * slot, tweenDur];
      return [0, tweenDur * 0.6];
    }

    function partial(delay, dur, elapsed) {
      if (dur <= 0) return 1;
      return easeOut(clamp((elapsed - delay) / dur, 0, 1));
    }

    function frame(ts) {
      rafId = 0;
      if (destroyed) return;
      /* Clock is taken from the first rAF timestamp, so it never has to agree
         with performance.now() vs Date.now(). */
      if (startTime < 0) startTime = ts;
      var elapsed = (ts - startTime) / 1000;

      for (var i = 0; i < count; i++) {
        var f = from[i], t = to[i], v = cur[i];
        var e = partial(0, tweenDur, elapsed);

        v.grow = lerp(f.grow, t.grow, e);
        v.rot = lerp(f.rot, t.rot, e);
        v.shift = lerp(f.shift, t.shift, e);
        v.gray = lerp(f.gray, t.gray, e);
        v.dim = lerp(f.dim, t.dim, e);

        if (showLabels) {
          var tb = labelTiming(i, 0);
          var tt = labelTiming(i, 1);
          var tc = labelTiming(i, 2);
          var eb = partial(tb[0], tb[1], elapsed);
          var et = partial(tt[0], tt[1], elapsed);
          var ec = partial(tc[0], tc[1], elapsed);
          v.barO = lerp(f.barO, t.barO, eb);   v.barX = lerp(f.barX, t.barX, eb);
          v.textO = lerp(f.textO, t.textO, et); v.textX = lerp(f.textX, t.textX, et);
          v.cueO = lerp(f.cueO, t.cueO, ec);   v.cueX = lerp(f.cueX, t.cueX, ec);
        }
      }

      writeAll();

      if (elapsed >= maxEnd) { snap(); return; }
      rafId = window.requestAnimationFrame(frame);
    }

    function stopRaf() {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    }

    function applyLayout(animate) {
      computeTargets();
      stopRaf();

      if (!animate || prefersReduced || !visible) { snap(); return; }

      tweenDur = duration;
      maxEnd = tweenDur + (showLabels ? stagger * 2 : 0);
      for (var i = 0; i < count; i++) copyInto(from[i], cur[i]);
      startTime = -1;
      rafId = window.requestAnimationFrame(frame);
    }

    function setActive(i) {
      var next = clamp(i, 0, count - 1);
      if (next === active) return;
      active = next;
      applyLayout(true);
    }

    /* -- 3c. Measure ------------------------------------------------------- */
    /* The media box is deliberately oversized so the parallax slide never
       exposes an edge of the panel. */
    var lastTotal = -1;
    function measure() {
      var rect = root.getBoundingClientRect();
      var total = vertical ? rect.height : rect.width;
      if (!total) return;
      if (Math.abs(total - lastTotal) < 0.5) return;
      lastTotal = total;

      var usable = Math.max(total - gap * (count - 1), 120);
      var size = Math.max(140, usable * clamp(expandRatio, 0.2, 0.9) * 1.22);
      mediaSize = size;
      root.style.setProperty("--ag-media-size", size + "px");
      applyLayout(!firstRun);
    }

    /* -- 3d. Events -------------------------------------------------------- */
    var listeners = [];
    function on(node, type, fn, capture) {
      node.addEventListener(type, fn, !!capture);
      listeners.push([node, type, fn, !!capture]);
    }

    var pointerHover = !!window.PointerEvent;
    var mouseHoverOk = !pointerHover && hasRealHover();

    function wirePanel(panel, i) {
      if (trigger === "hover") {
        if (pointerHover) {
          on(panel, "pointerenter", function (e) {
            /* Mouse only. On touch the first tap must NOT pre-activate, or the
               click that follows it would navigate immediately. */
            if (e.pointerType === "mouse") setActive(i);
          });
        } else if (mouseHoverOk) {
          on(panel, "mouseenter", function () { setActive(i); });
        }
      }

      on(panel, "click", function (e) {
        if (i !== active) { e.preventDefault(); setActive(i); }
      });

      on(panel, "focus", function () { setActive(i); });

      on(panel, "keydown", function (e) {
        var k = e.key;
        var next = -1;
        if (k === "ArrowRight" || k === "ArrowDown" || k === "Right" || k === "Down") {
          next = (i + 1) % count;
        } else if (k === "ArrowLeft" || k === "ArrowUp" || k === "Left" || k === "Up") {
          next = (i - 1 + count) % count;
        }
        if (next < 0) return;
        e.preventDefault();
        setActive(next);
        panels[next].focus();
      });
    }

    for (var w = 0; w < count; w++) wirePanel(panels[w], w);

    /* -- 3e. Observers ----------------------------------------------------- */
    var ro = null;
    if (window.ResizeObserver) {
      ro = new window.ResizeObserver(measure);
      ro.observe(root);
    } else {
      on(window, "resize", function () { lastTotal = -1; measure(); });
    }

    /* Contract: no rAF burns while the strip is off-screen. */
    var io = null;
    if (window.IntersectionObserver) {
      io = new window.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var wasVisible = visible;
          visible = entries[i].isIntersecting;
          if (!visible && rafId) { stopRaf(); snap(); }
          else if (visible && !wasVisible) { lastTotal = -1; measure(); }
        }
      }, { rootMargin: "120px 0px" });
      io.observe(root);
    }

    function onReducedChange(e) {
      prefersReduced = e.matches;
      if (prefersReduced) { stopRaf(); snap(); }
    }
    if (reducedQuery) {
      if (reducedQuery.addEventListener) {
        reducedQuery.addEventListener("change", onReducedChange);
      } else if (reducedQuery.addListener) {
        reducedQuery.addListener(onReducedChange);
      }
    }

    /* -- 3f. Boot ---------------------------------------------------------- */
    measure();
    applyLayout(false);
    firstRun = false;

    return function destroy() {
      destroyed = true;
      stopRaf();
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      if (reducedQuery) {
        if (reducedQuery.removeEventListener) reducedQuery.removeEventListener("change", onReducedChange);
        else if (reducedQuery.removeListener) reducedQuery.removeListener(onReducedChange);
      }
      for (var i = 0; i < listeners.length; i++) {
        listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]);
      }
      listeners.length = 0;
      root.removeAttribute("style");
      root.className = originalClass;
      root.removeAttribute("role");
      root.removeAttribute("aria-label");
      root.removeAttribute("data-lphie-mounted");
      root.innerHTML = originalHtml;
    };
  }

  window.LPHIE.components.accordionGallery = mount;

  /* ---- 4. Auto-init ------------------------------------------------------ */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-accordion-gallery]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-accordion-gallery");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
