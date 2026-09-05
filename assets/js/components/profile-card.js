/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   ProfileCard — vanilla port of the React Bits component of the same name.
   No dependencies (no React). Works from file:// as well as a server.

   The reference is a holographic trading card: a tilt engine drives eight CSS
   custom properties off the pointer, and four stacked layers (foil, glare,
   portrait, plate) read from them to fake a foil-stamped card catching light.
   The ENGINE is ported verbatim — same exponential smoothing, same 0.14s
   time-constant, same 1200ms slower intro sweep from an offset corner, same
   settle check on leave. What changed is what it lights:

     PORTRAIT → MONOGRAM. The reference needs a cut-out photograph. This
       chapter has no alumni portraits (assets/img/brothers is empty), and
       inventing one is not an option, so the card's face is the engraved
       monogram the flat card already used.

     RAINBOW → GILT. The reference's six sunpillar hues are a full spectrum.
       This is a gilt-and-royal-blue plate, so the ramp is gold/bronze/
       champagne with one cool kick — foil, not prism.

     ICON → LAMBDA. The reference masks its foil through an abstract icon
       pattern; per the brief that watermark is now the chapter's lambda
       (assets/img/lambda-tile.svg).

   Content is read OUT OF THE DOM, so if this script never runs the card is
   still a legible block of name / title / company / note.

   Mount:
     <article data-profile-card='{"logo":"assets/img/logos/microsoft.svg"}'>
       <h3 data-pc="name">Howe Gu</h3>
       <p data-pc="title">Head of Digital Strategy</p>
       <p data-pc="org">Microsoft</p>
       <p data-pc="note">Charter class, Alpha Xi 2004.</p>
     </article>
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* The reference's ANIMATION_CONFIG, verbatim. */
  var ANIM = {
    INITIAL_DURATION: 1200,
    INITIAL_X_OFFSET: 70,
    INITIAL_Y_OFFSET: 60,
    ENTER_TRANSITION_MS: 180
  };

  var DEFAULT_TAU = 0.14;     /* reference smoothing time-constant           */
  var INITIAL_TAU = 0.6;      /* the slower constant used during the intro   */

  var DEFAULTS = {
    name: "",                 /* "" means: read it from the DOM              */
    title: "",
    org: "",
    note: "",
    monogram: "",             /* "" means: derive from the name              */
    logo: "",                 /* optional company mark for the plate         */
    iconUrl: "assets/img/lambda-tile.svg",   /* the watermark, per the brief */
    enableTilt: true,
    behindGlow: true
  };

  /* ---- 2. Helpers -------------------------------------------------------- */
  function clamp(v, min, max) {
    min = min === undefined ? 0 : min;
    max = max === undefined ? 100 : max;
    return Math.min(Math.max(v, min), max);
  }
  function round(v, precision) {
    return parseFloat(v.toFixed(precision === undefined ? 3 : precision));
  }
  function adjust(v, fMin, fMax, tMin, tMax) {
    return round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function isTodo(s) { return /^\s*TODO/i.test(String(s || "")); }
  function initials(name) {
    return String(name || "").trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); }).join("").toUpperCase() || "ΛΦΕ";
  }
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function pick(host, key) {
    var n = host.querySelector('[data-pc="' + key + '"]');
    return n ? n.textContent.trim() : "";
  }

  function settings(host, options) {
    var o = {}, k;
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
    o.name = o.name || pick(host, "name");
    o.title = o.title || pick(host, "title");
    o.org = o.org || pick(host, "org");
    o.note = o.note || pick(host, "note");
    o.monogram = o.monogram || initials(o.name);
    return o;
  }

  /* ---- 3. Markup --------------------------------------------------------- */
  /* The reference's layer stack, one for one. Every decorative layer is
     aria-hidden; the readable content keeps its heading and paragraphs. */
  function render(cfg) {
    var org = "";
    if (isTodo(cfg.org)) {
      org = '<span class="tag tag--todo">Add company</span>';
    } else if (cfg.org) {
      org = '<span class="pc-org-name">' + esc(cfg.org) + "</span>";
    }

    /* A company that has supplied a mark shows the mark INSTEAD of its name —
       the name survives as the alt text, so nothing is lost to a reader. The
       logo files are wide lockups drawn for a paper ground, so the slot is a
       wide one and the CSS strikes them in paper-white. */
    if (cfg.logo && !isTodo(cfg.org)) {
      org = '<span class="pc-mini-avatar"><img src="' + esc(cfg.logo) +
            '" alt="' + esc(cfg.org) + '" loading="lazy"></span>';
    }

    var plate = org || cfg.note
      ? '<div class="pc-user-info">' +
          '<div class="pc-user-details">' +
            '<span class="pc-user-text">' +
              (org ? '<span class="pc-handle">' + org + "</span>" : "") +
              (cfg.note ? '<span class="pc-status">' + esc(cfg.note) + "</span>" : "") +
            "</span>" +
          "</div>" +
        "</div>"
      : "";

    return '<span class="pc-behind" aria-hidden="true"></span>' +
      '<div class="pc-card-shell">' +
        '<section class="pc-card">' +
          '<div class="pc-inside">' +
            '<span class="pc-shine" aria-hidden="true"></span>' +
            '<span class="pc-glare" aria-hidden="true"></span>' +
            '<div class="pc-content pc-avatar-content">' +
              '<span class="pc-monogram" aria-hidden="true">' + esc(cfg.monogram) + "</span>" +
              plate +
            "</div>" +
            '<div class="pc-content pc-plate">' +
              '<div class="pc-details">' +
                "<h3>" + esc(cfg.name) + "</h3>" +
                (cfg.title ? "<p>" + esc(cfg.title) + "</p>" : "") +
              "</div>" +
            "</div>" +
          "</div>" +
        "</section>" +
      "</div>";
  }

  /* ---- 4. Tilt engine ---------------------------------------------------- */
  /* The reference's useMemo engine, ported: a target the pointer sets and a
     current value that chases it by an exponential step whose time-constant is
     frame-rate independent, so the card reads the same at 60Hz and 120Hz. */
  function engine(wrap, shell) {
    var rafId = null, running = false, lastTs = 0;
    var currentX = 0, currentY = 0, targetX = 0, targetY = 0;
    var initialUntil = 0;

    function setVarsFromXY(x, y) {
      if (!shell || !wrap) return;
      var width = shell.clientWidth || 1;
      var height = shell.clientHeight || 1;

      var percentX = clamp((100 / width) * x);
      var percentY = clamp((100 / height) * y);
      var centerX = percentX - 50;
      var centerY = percentY - 50;

      wrap.style.setProperty("--pointer-x", percentX + "%");
      wrap.style.setProperty("--pointer-y", percentY + "%");
      wrap.style.setProperty("--background-x", adjust(percentX, 0, 100, 35, 65) + "%");
      wrap.style.setProperty("--background-y", adjust(percentY, 0, 100, 35, 65) + "%");
      wrap.style.setProperty("--pointer-from-center",
        String(clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)));
      wrap.style.setProperty("--pointer-from-top", String(percentY / 100));
      wrap.style.setProperty("--pointer-from-left", String(percentX / 100));
      wrap.style.setProperty("--rotate-x", round(-(centerX / 5)) + "deg");
      wrap.style.setProperty("--rotate-y", round(centerY / 4) + "deg");
    }

    function step(ts) {
      if (!running) return;
      if (lastTs === 0) lastTs = ts;
      var dt = (ts - lastTs) / 1000;
      lastTs = ts;

      var tau = ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU;
      var k = 1 - Math.exp(-dt / tau);

      currentX += (targetX - currentX) * k;
      currentY += (targetY - currentY) * k;
      setVarsFromXY(currentX, currentY);

      var stillFar = Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05;
      if (stillFar) {
        rafId = requestAnimationFrame(step);
      } else {
        /* The reference keeps spinning while the document has focus; that is a
           permanent rAF per card on the page. Six cards on alumni.html would
           mean six idle loops forever, so this stops once settled and the
           pointer handlers restart it. */
        running = false;
        lastTs = 0;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }
    }

    function start() {
      if (running) return;
      running = true;
      lastTs = 0;
      rafId = requestAnimationFrame(step);
    }

    return {
      setImmediate: function (x, y) {
        currentX = x; currentY = y;
        setVarsFromXY(currentX, currentY);
      },
      setTarget: function (x, y) { targetX = x; targetY = y; start(); },
      toCenter: function () {
        if (!shell) return;
        this.setTarget(shell.clientWidth / 2, shell.clientHeight / 2);
      },
      beginInitial: function (durationMs) {
        initialUntil = (window.performance ? performance.now() : 0) + durationMs;
        start();
      },
      getCurrent: function () {
        return { x: currentX, y: currentY, tx: targetX, ty: targetY };
      },
      cancel: function () {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null; running = false; lastTs = 0;
      }
    };
  }

  /* ---- 5. Mount ---------------------------------------------------------- */
  function mount(host, options) {
    if (!host) return function () {};

    var cfg = settings(host, options);
    var destroyed = false;

    host.classList.add("pc-card-wrapper");
    host.innerHTML = render(cfg);
    /* --icon is written here but CONSUMED inside profile-card.css, and a
       relative url() in a custom property resolves against the stylesheet
       that uses it — assets/css/components/ — not against the page. Absolute
       from the document's base is the only form that survives the hand-off. */
    if (cfg.iconUrl) {
      var iconHref = cfg.iconUrl;
      try { iconHref = new URL(cfg.iconUrl, document.baseURI).href; } catch (e) {}
      host.style.setProperty("--icon", 'url("' + encodeURI(iconHref) + '")');
    }
    if (!cfg.behindGlow) {
      var behind = host.querySelector(".pc-behind");
      if (behind) behind.parentNode.removeChild(behind);
    }

    var shell = host.querySelector(".pc-card-shell");
    var card = host.querySelector(".pc-card");
    if (!shell || !card || !cfg.enableTilt || prefersReducedMotion()) {
      return function destroy() {
        host.classList.remove("pc-card-wrapper");
        host.removeAttribute("data-lphie-mounted");
      };
    }

    var tilt = engine(host, shell);
    var enterTimer = null;
    var leaveRaf = null;

    function offsets(evt) {
      var rect = shell.getBoundingClientRect();
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }

    function onEnter(e) {
      shell.classList.add("active", "entering");
      if (enterTimer) window.clearTimeout(enterTimer);
      enterTimer = window.setTimeout(function () {
        shell.classList.remove("entering");
      }, ANIM.ENTER_TRANSITION_MS);
      var p = offsets(e);
      tilt.setTarget(p.x, p.y);
    }

    function onMove(e) {
      var p = offsets(e);
      tilt.setTarget(p.x, p.y);
    }

    /* The reference does not drop .active until the card has actually settled
       back to level, or the 1s CSS transition would fight the engine's last
       few frames and the card would snap. */
    function onLeave() {
      tilt.toCenter();
      function checkSettle() {
        var c = tilt.getCurrent();
        if (Math.hypot(c.tx - c.x, c.ty - c.y) < 0.6) {
          shell.classList.remove("active");
          leaveRaf = null;
        } else {
          leaveRaf = requestAnimationFrame(checkSettle);
        }
      }
      if (leaveRaf) cancelAnimationFrame(leaveRaf);
      leaveRaf = requestAnimationFrame(checkSettle);
    }

    var hasPointer = !!window.PointerEvent;
    var MOVE = hasPointer ? "pointermove" : "mousemove";
    var ENTER = hasPointer ? "pointerenter" : "mouseenter";
    var LEAVE = hasPointer ? "pointerleave" : "mouseleave";

    shell.addEventListener(ENTER, onEnter);
    shell.addEventListener(MOVE, onMove);
    shell.addEventListener(LEAVE, onLeave);

    /* The intro: start off one corner and sweep to level over 1200ms, so the
       foil catches once on load and the card announces that it moves. */
    function intro() {
      var w = shell.clientWidth || 0;
      tilt.setImmediate(w - ANIM.INITIAL_X_OFFSET, ANIM.INITIAL_Y_OFFSET);
      tilt.toCenter();
      tilt.beginInitial(ANIM.INITIAL_DURATION);
    }
    if (shell.clientWidth) intro();
    else if (window.requestAnimationFrame) requestAnimationFrame(intro);

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      shell.removeEventListener(ENTER, onEnter);
      shell.removeEventListener(MOVE, onMove);
      shell.removeEventListener(LEAVE, onLeave);
      if (enterTimer) window.clearTimeout(enterTimer);
      if (leaveRaf) cancelAnimationFrame(leaveRaf);
      tilt.cancel();
      shell.classList.remove("active", "entering");
      host.classList.remove("pc-card-wrapper");
      host.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.profileCard = mount;

  /* ---- 6. Auto-init ------------------------------------------------------ */
  function autoInit(root) {
    /* Called both directly (with a root to search) and as the
       DOMContentLoaded handler, which hands over an Event — hence the check
       rather than a bare `root || document`. */
    var scope = (root && root.querySelectorAll) ? root : document;
    var nodes = scope.querySelectorAll("[data-profile-card]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-profile-card");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  window.LPHIE.mountProfileCards = autoInit;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
