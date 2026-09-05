/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   Dock — vanilla port of the React Bits component of the same name.
   No dependencies (no motion/react, no React). Works from file:// as well as
   a server.

   The reference is a macOS dock: a floating panel of icon tiles whose SIZE is
   a function of the pointer's horizontal distance from each tile, sprung so
   the swell trails the cursor. Two things are deliberately different here.

     1. NO PANEL. The masthead is already a ruled line of engraved small-caps
        and the brief was to keep that formatting. So the dock is applied to
        the existing <ul class="nav__links"> — no tiles, no plate, no
        tooltips (the links carry their own words).

     2. TRANSFORM, NOT WIDTH. The reference animates each item's width and
        height, which reflows the row. This row is the CENTRE track of the
        masthead grid (masthead.css §2): reflowing it would drag the whole
        itinerary off the page's true centre on every pointer move, and shift
        a link out from under the cursor mid-click. The swell is therefore a
        scale/lift transform about each link's baseline, which is free of
        layout and leaves the centring exact.

   The physics ARE the reference's: one critically-over-damped spring per item
   (mass 0.1, stiffness 150, damping 12) chasing a linear proximity ramp over
   ±distance, integrated in a single rAF loop for the whole row.

   Mount:  <ul class="nav__links" data-dock='{"magnification":1.34}'>
   Every direct <li>'s first element child becomes an item.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* Names follow the reference where the meaning survived the port. The
     reference's baseItemSize/magnification are absolute pixel sizes; here
     magnification is the peak SCALE, which is the same quantity expressed as
     a ratio (reference 70/50 = 1.4). */
  var DEFAULTS = {
    magnification: 1.34,     /* TUNED — reference 1.4. Engraved caps at .69rem
                                overshoot their rule above about 1.35.        */
    distance: 130,           /* px of falloff either side — reference 200,
                                shortened because these items are ~70px wide
                                rather than 50px tall tiles with 1rem gaps.   */
    lift: 4,                 /* px the peak item rises. The reference grows
                                the panel instead; this row cannot grow.      */
    mass: 0.1,               /* the reference's spring, verbatim              */
    stiffness: 150,
    damping: 12,
    minViewport: 901         /* below this the list is the stacked drawer
                                (style.css §5 @900), where a dock is wrong.   */
  };

  var NUMERIC = ["magnification", "distance", "lift", "mass", "stiffness", "damping", "minViewport"];

  /* ---- 2. Helpers -------------------------------------------------------- */
  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
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

    o.magnification = Math.max(1, o.magnification);
    o.distance = Math.max(1, o.distance);
    o.lift = Math.max(0, o.lift);
    o.mass = Math.max(0.01, o.mass);
    o.stiffness = Math.max(1, o.stiffness);
    o.damping = Math.max(0, o.damping);
    return o;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* ---- 3. Mount ---------------------------------------------------------- */
  function mount(host, options) {
    if (!host) return function () {};

    var cfg = settings(options);
    var destroyed = false;
    var rafId = null;
    var lastTs = 0;
    var pointerX = Infinity;      /* the reference's mouseX motion value */
    var items = [];
    var enabled = false;

    /* The spring, solved rather than integrated.

       The reference gets its spring from framer-motion, which advances the
       CLOSED FORM of the damped oscillator each frame. Stepping the ODE by
       hand instead is a trap at these constants: with mass 0.1 and damping 12
       the velocity term alone is dt * c/m = 2.0 at 60fps, which is past the
       stability limit of explicit Euler — the value flips sign and grows
       without bound (measured: 1e15 within 180 frames). So the analytic
       solution is used, which is exact for any dt and cannot diverge.

         w0    undamped angular frequency, sqrt(k/m)
         zeta  damping ratio, c / (2*sqrt(k*m)) — 1.55 here, i.e. overdamped */
    var w0 = Math.sqrt(cfg.stiffness / cfg.mass);
    var zeta = cfg.damping / (2 * Math.sqrt(cfg.stiffness * cfg.mass));

    /* Advance one item's displacement-from-target and velocity by dt. */
    function advance(item, dt) {
      var x0 = item.amount - item.target;
      var v0 = item.velocity;
      var envelope = Math.exp(-zeta * w0 * dt);
      var x, v;

      if (zeta < 1) {                       /* under-damped: rings          */
        var wd = w0 * Math.sqrt(1 - zeta * zeta);
        var c1 = x0;
        var c2 = (zeta * w0 * x0 + v0) / wd;
        var cos = Math.cos(wd * dt), sin = Math.sin(wd * dt);
        x = envelope * (c1 * cos + c2 * sin);
        v = envelope * ((-zeta * w0) * (c1 * cos + c2 * sin) + wd * (c2 * cos - c1 * sin));
      } else if (zeta > 1) {                /* over-damped: crawls home     */
        var g = w0 * Math.sqrt(zeta * zeta - 1);
        var d1 = x0;
        var d2 = (zeta * w0 * x0 + v0) / g;
        var ch = Math.cosh(g * dt), sh = Math.sinh(g * dt);
        x = envelope * (d1 * ch + d2 * sh);
        v = envelope * ((-zeta * w0) * (d1 * ch + d2 * sh) + g * (d2 * ch + d1 * sh));
      } else {                              /* critically damped            */
        var e1 = x0;
        var e2 = v0 + w0 * x0;
        x = envelope * (e1 + e2 * dt);
        v = envelope * (e2 - w0 * (e1 + e2 * dt));
      }

      item.amount = item.target + x;
      item.velocity = v;
    }

    /* A dock is a pointer affordance. On a touch screen there is no hover to
       track, and under reduced-motion the swell is exactly the kind of motion
       being declined — in both cases the row stays as the stylesheet drew it. */
    var wide = window.matchMedia
      ? window.matchMedia("(min-width: " + cfg.minViewport + "px)")
      : null;
    var fine = window.matchMedia ? window.matchMedia("(hover: hover)") : null;

    host.classList.add("dock-row");

    function collect() {
      items = [];
      var li = host.children, i, node;
      for (i = 0; i < li.length; i++) {
        node = li[i].firstElementChild || li[i];
        items.push({ el: node, amount: 0, velocity: 0, target: 0 });
        node.classList.add("dock-item");
      }
    }

    /* 3a. Proximity ramp — the reference's useTransform over
          [-distance, 0, distance] mapped to [base, magnified, base], which is
          a linear tent function of |dx|. */
    function measure() {
      var i, item, rect, centre, dx;
      for (i = 0; i < items.length; i++) {
        item = items[i];
        if (pointerX === Infinity) { item.target = 0; continue; }
        rect = item.el.getBoundingClientRect();
        if (!rect.width) { item.target = 0; continue; }
        centre = rect.left + rect.width / 2;
        dx = Math.abs(pointerX - centre);
        item.target = dx >= cfg.distance ? 0 : 1 - dx / cfg.distance;
      }
    }

    /* 3b. One spring per item, integrated together. */
    function step(ts) {
      rafId = null;
      if (destroyed || !enabled) return;

      if (!lastTs) lastTs = ts;
      /* The closed form is stable at any dt; the clamp is only so a tab that
         was backgrounded for a minute resumes from a sane step rather than
         teleporting, and so cosh() below stays in range. */
      var dt = Math.min((ts - lastTs) / 1000, 1 / 15);
      lastTs = ts;

      measure();

      var moving = false, i, item;
      for (i = 0; i < items.length; i++) {
        item = items[i];
        advance(item, dt);

        if (Math.abs(item.amount - item.target) > 0.0005 || Math.abs(item.velocity) > 0.0005) {
          moving = true;
        } else {
          item.amount = item.target;
          item.velocity = 0;
        }
        paint(item);
      }

      if (moving || pointerX !== Infinity) schedule();
      else lastTs = 0;
    }

    function paint(item) {
      var a = item.amount;
      var scale = 1 + (cfg.magnification - 1) * a;
      item.el.style.transform = "translateY(" + (-cfg.lift * a).toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";
      /* Handed to CSS so the ink can warm with proximity as well. */
      item.el.style.setProperty("--dock-amount", a.toFixed(4));
    }

    function schedule() {
      if (rafId !== null || destroyed || !enabled) return;
      rafId = requestAnimationFrame(step);
    }

    function onMove(e) {
      if (!enabled) return;
      pointerX = e.clientX;
      schedule();
    }

    function onLeave() {
      pointerX = Infinity;
      schedule();
    }

    function clear() {
      var i;
      for (i = 0; i < items.length; i++) {
        items[i].amount = 0;
        items[i].velocity = 0;
        items[i].target = 0;
        items[i].el.style.transform = "";
        items[i].el.style.removeProperty("--dock-amount");
      }
    }

    /* 3c. Enable / disable as the viewport crosses the drawer breakpoint. */
    function evaluate() {
      var want = !prefersReducedMotion() &&
                 (!wide || wide.matches) &&
                 (!fine || fine.matches);
      if (want === enabled) return;
      enabled = want;
      if (enabled) {
        collect();
        host.classList.add("is-docked");
      } else {
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        pointerX = Infinity;
        lastTs = 0;
        clear();
        host.classList.remove("is-docked");
      }
    }

    var hasPointer = !!window.PointerEvent;
    var MOVE = hasPointer ? "pointermove" : "mousemove";
    var LEAVE = hasPointer ? "pointerleave" : "mouseleave";

    host.addEventListener(MOVE, onMove);
    host.addEventListener(LEAVE, onLeave);

    function onQuery() { evaluate(); }
    function listen(mq) {
      if (!mq) return;
      if (mq.addEventListener) mq.addEventListener("change", onQuery);
      else if (mq.addListener) mq.addListener(onQuery);
    }
    function unlisten(mq) {
      if (!mq) return;
      if (mq.removeEventListener) mq.removeEventListener("change", onQuery);
      else if (mq.removeListener) mq.removeListener(onQuery);
    }
    listen(wide);
    listen(fine);

    evaluate();

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      host.removeEventListener(MOVE, onMove);
      host.removeEventListener(LEAVE, onLeave);
      unlisten(wide);
      unlisten(fine);
      clear();
      host.classList.remove("dock-row", "is-docked");
      host.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.dock = mount;

  /* ---- 4. Auto-init ------------------------------------------------------ */
  /* The masthead is injected by main.js, whose DOMContentLoaded listener is
     registered first (main.js is loaded above every component), so the row
     exists by the time this runs. LPHIE.mountDock is exported anyway for any
     later rebuild of the header. */
  function autoInit(root) {
    /* Called both directly (with a root to search) and as the
       DOMContentLoaded handler, which hands over an Event — hence the check
       rather than a bare `root || document`. */
    var scope = (root && root.querySelectorAll) ? root : document;
    var nodes = scope.querySelectorAll("[data-dock]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-dock");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  window.LPHIE.mountDock = autoInit;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
