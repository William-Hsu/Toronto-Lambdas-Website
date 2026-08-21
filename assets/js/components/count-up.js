/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   CountUp — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   Difference from the React original: the original is handed a `to` prop and
   renders an empty <span>. Here the numbers already live in the HTML (several
   are injected at runtime by main.js fillTokens()), so this component reads
   its own rendered text, animates the number it finds inside it, and keeps
   every non-numeric character around it — "100,000+" counts up and stays
   "100,000+", "1981" stays a year with no thousands separator.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* Same prop names and defaults as the reference. `to`, `separator` and
     `decimals` default to null, meaning "infer it from the element's text". */
  var DEFAULTS = {
    from: 0,
    to: null,
    direction: "up",
    delay: 0,
    duration: 2,
    className: "",
    startWhen: true,
    separator: null,
    decimals: null,
    onStart: null,
    onEnd: null
  };

  /* Sign, then digits optionally broken by group separators, then an optional
     en-US decimal tail. Plain spaces are deliberately excluded so "2 min"
     parses as 2 with the suffix " min". */
  var NUM_RE = /-?\d[\d,\u00A0\u202F\u2009']*(?:\.\d+)?/;

  var MAX_FRAME = 0.25;    /* seconds of simulation accepted from one rAF gap */
  var MAX_STEP = 1 / 60;   /* ceiling on a single integration sub-step        */
  var MAX_STEPS = 32;      /* ceiling on sub-steps per frame                  */
  var MIN_DURATION = 0.05; /* below this the spring needs absurd sub-stepping */

  /* ---- helpers ---------------------------------------------------------- */
  function extend(base, extra) {
    var out = {}, k;
    for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k]; }
    if (extra) {
      for (k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k]; }
    }
    return out;
  }

  /* Returns a finite Number, or null when the option was not supplied. */
  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return (typeof n === "number" && isFinite(n)) ? n : null;
  }

  /* The reference's getDecimalPlaces, verbatim in behaviour. */
  function getDecimalPlaces(n) {
    var str = String(n);
    var i = str.indexOf(".");
    if (i >= 0) {
      var dec = str.slice(i + 1);
      if (parseInt(dec, 10) !== 0) return dec.length;
    }
    return 0;
  }

  /* ---- 1. Parse "prefix + number + suffix" out of the element's own text -- */
  function parseText(text) {
    var m = NUM_RE.exec(text);
    if (!m) return null;

    var raw = m[0];
    /* Never let a trailing separator character ride along with the number. */
    while (raw.length > 1 && !/[0-9]/.test(raw.charAt(raw.length - 1))) {
      raw = raw.slice(0, raw.length - 1);
    }

    /* Decimal places come from the text itself: "3.67" -> 2, "1981" -> 0. */
    var dot = raw.indexOf(".");
    var decimals = dot >= 0 ? (raw.length - dot - 1) : 0;

    /* The separator is the first grouping character actually present, so
       "100,000" keeps its comma while "1981" gets no grouping at all. */
    var separator = "";
    for (var i = 0; i < raw.length; i++) {
      var c = raw.charAt(i);
      if (!/[0-9.\-]/.test(c)) { separator = c; break; }
    }

    var value = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
    if (!isFinite(value)) return null;

    return {
      value: value,
      decimals: decimals,
      separator: separator,
      prefix: text.slice(0, m.index),
      suffix: text.slice(m.index + raw.length)
    };
  }

  /* ---- 2. Formatting ----------------------------------------------------- */
  function groupInt(intStr, sep) {
    if (!sep) return intStr;
    var out = "", n = 0;
    for (var i = intStr.length - 1; i >= 0; i--) {
      out = intStr.charAt(i) + out;
      n++;
      if (n % 3 === 0 && i > 0) out = sep + out;
    }
    return out;
  }

  function makeFormatter(decimals, separator) {
    var nf = null;
    if (typeof Intl !== "undefined" && Intl.NumberFormat) {
      try {
        nf = new Intl.NumberFormat("en-US", {
          useGrouping: !!separator,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      } catch (e) { nf = null; }
    }
    return function (v) {
      var s;
      if (nf) {
        s = nf.format(v);
        if (separator && separator !== ",") s = s.replace(/,/g, separator);
      } else {
        var neg = v < 0;
        var parts = Math.abs(v).toFixed(decimals).split(".");
        s = (neg ? "-" : "") + groupInt(parts[0], separator) + (parts[1] ? "." + parts[1] : "");
      }
      return s;
    };
  }

  /* ---- 3. Mount ---------------------------------------------------------- */
  function mount(root, options) {
    function noop() {}
    if (!root || root.nodeType !== 1) return noop;

    var opts = extend(DEFAULTS, options);
    var originalText = root.textContent;
    var parsed = parseText(originalText);
    /* No number in there — leave the element completely alone. */
    if (!parsed) return noop;

    var toOpt = num(opts.to);
    var fromOpt = num(opts.from);
    var to = toOpt === null ? parsed.value : toOpt;
    var from = fromOpt === null ? 0 : fromOpt;

    var decOpt = num(opts.decimals);
    var decimals = decOpt === null
      ? Math.max(parsed.decimals, getDecimalPlaces(from), getDecimalPlaces(to))
      : Math.max(0, Math.floor(decOpt));

    var separator = (opts.separator === null || opts.separator === undefined)
      ? parsed.separator
      : String(opts.separator);

    var duration = num(opts.duration);
    if (duration === null || duration <= 0) duration = DEFAULTS.duration;
    if (duration < MIN_DURATION) duration = MIN_DURATION;
    var delay = num(opts.delay);
    if (delay === null || delay < 0) delay = 0;

    var down = opts.direction === "down";
    var startValue = down ? to : from;
    var target = down ? from : to;

    /* THE SPRING: damping and stiffness are both derived from `duration`. */
    var stiffness = 100 * (1 / duration);
    var damping = 20 + 40 * (1 / duration);

    /* Semi-implicit Euler on this system is only stable while the sub-step
       stays under 2/damping and 2/sqrt(stiffness); at half that it has a
       comfortable margin. Short durations stiffen the spring a lot, so the
       sub-step is derived from the constants rather than fixed at 1/60. */
    var hMax = Math.min(MAX_STEP, 0.5 / damping, 0.5 / Math.sqrt(stiffness));
    var maxElapsed = Math.min(MAX_FRAME, MAX_STEPS * hMax);

    /* Settle at the reference's 0.01, raised to half a rendered unit so a
       0 -> 100000 count stops the frame it can no longer change the text. */
    var unit = Math.pow(10, -decimals);
    var restDelta = Math.max(0.01, unit * 0.5);
    var restSpeed = Math.max(0.01, unit * 0.5);

    var fmt = makeFormatter(decimals, separator);
    function compose(v) { return parsed.prefix + fmt(v) + parsed.suffix; }
    var finalText = compose(target);

    /* -- DOM: an aria-hidden ticker plus a stable copy for screen readers -- */
    var doc = root.ownerDocument || document;
    var valueNode = doc.createElement("span");
    valueNode.className = "count-up__value";
    valueNode.setAttribute("aria-hidden", "true");
    /* Also set inline so the width guard still holds if the CSS is missing. */
    valueNode.style.display = "inline-block";

    var srNode = doc.createElement("span");
    srNode.className = "count-up__sr";
    srNode.textContent = finalText;

    root.classList.add("count-up");
    if (opts.className) root.classList.add(String(opts.className));
    root.setAttribute("aria-live", "off");
    root.setAttribute("aria-label", finalText);
    root.textContent = "";
    root.appendChild(valueNode);
    root.appendChild(srNode);

    function render(v) { valueNode.textContent = compose(v); }

    /* -- Layout-shift guard ------------------------------------------------
       Reserve the widest box the ticker can ever need before it starts, so a
       count from 0 to 100,000 never resizes the stats band. Tabular figures
       (CSS) usually make every digit the same width; the display serif may
       not carry them, so the reservation is measured against the widest
       digit this font actually renders. */
    function measure(text) {
      var prev = valueNode.textContent;
      valueNode.textContent = text;
      var w = valueNode.getBoundingClientRect
        ? valueNode.getBoundingClientRect().width
        : valueNode.offsetWidth;
      valueNode.textContent = prev;
      return w || 0;
    }

    function reserveWidth() {
      var startText = compose(startValue);
      var widest = startText.length >= finalText.length ? startText : finalText;
      var w = Math.max(measure(startText), measure(finalText));
      for (var d = 0; d < 10; d++) {
        w = Math.max(w, measure(widest.replace(/[0-9]/g, String(d))));
      }
      if (w > 0) valueNode.style.minWidth = (Math.ceil(w * 100) / 100) + "px";
    }

    function releaseWidth() { valueNode.style.minWidth = ""; }

    /* The display serif arrives over the network with font-display:swap, so a
       width measured against the fallback can be wrong. Re-measure once the
       real face lands, if the count is still running. */
    function reserveWidthWhenFontsReady() {
      var f = document.fonts;
      if (!f || f.status === "loaded" || !f.ready || !f.ready.then) return;
      f.ready.then(function () {
        if (!destroyed && !settled) reserveWidth();
      }, function () {});
    }

    /* -- State ------------------------------------------------------------- */
    var x = startValue, velocity = 0;
    var raf = 0, timer = 0, last = 0, runId = 0;
    var started = false, settled = false, running = false, destroyed = false;

    var mql = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function reduced() { return !!(mql && mql.matches); }

    /* Paint the starting value immediately, exactly as the reference does —
       unless motion is off, in which case the final value goes straight in. */
    if (reduced()) {
      x = target;
      settled = true;
      started = true;
      render(x);
      if (typeof opts.onEnd === "function") opts.onEnd();
    } else {
      render(x);
    }

    /* -- 4. The spring loop ------------------------------------------------ */
    function finish() {
      running = false;
      settled = true;
      runId++;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      x = target;
      velocity = 0;
      render(x);
      releaseWidth();
      root.classList.remove("is-counting");
      if (io) { io.disconnect(); io = null; }
      if (typeof opts.onEnd === "function") opts.onEnd();
    }

    function resume() {
      if (destroyed || settled || running || !started) return;
      if (!window.requestAnimationFrame) { finish(); return; }
      running = true;
      last = 0;
      var myRun = ++runId;

      /* One closure per run rather than per frame, so a stale callback that
         somehow outlived cancelAnimationFrame can never fork a second loop. */
      function step(now) {
        raf = 0;
        if (destroyed || !running || myRun !== runId) return;

        if (!last) last = now;
        var elapsed = (now - last) / 1000;
        last = now;
        if (elapsed < 0) elapsed = 0;
        /* A backgrounded tab hands back a multi-second gap; capping it and
           then sub-stepping keeps the Euler integration from exploding. The
           cap is chosen so the sub-step can never exceed the stable hMax. */
        if (elapsed > maxElapsed) elapsed = maxElapsed;

        var steps = Math.ceil(elapsed / hMax);
        if (steps < 1) steps = 1;
        var h = elapsed / steps;

        for (var i = 0; i < steps; i++) {
          var accel = stiffness * (target - x) - damping * velocity;
          velocity += accel * h;
          x += velocity * h;
        }

        if (Math.abs(target - x) < restDelta && Math.abs(velocity) < restSpeed) {
          finish();
          return;
        }

        render(x);
        raf = requestAnimationFrame(step);
      }

      raf = requestAnimationFrame(step);
    }

    function pause() {
      running = false;
      runId++;
      last = 0;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function begin() {
      timer = 0;
      if (destroyed || settled) return;
      if (reduced()) { finish(); return; }
      reserveWidth();
      reserveWidthWhenFontsReady();
      root.classList.add("is-counting");
      resume();
    }

    /* -- 5. Fire once, on entering the viewport ---------------------------- */
    function trigger() {
      if (destroyed || started || settled) return;
      started = true;
      if (typeof opts.onStart === "function") opts.onStart();
      if (delay > 0) timer = setTimeout(begin, delay * 1000);
      else begin();
    }

    var io = null;
    if (!settled) {
      if (window.IntersectionObserver) {
        io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
              if (!started) { if (opts.startWhen !== false) trigger(); }
              else resume();
            } else {
              pause();
            }
          }
        }, { rootMargin: "0px", threshold: 0 });
        io.observe(root);
      } else if (opts.startWhen !== false) {
        trigger();
      }
    }

    /* Motion can be switched off mid-count — snap to the final value. */
    function onMotionChange() {
      if (reduced() && !settled && !destroyed) {
        if (timer) { clearTimeout(timer); timer = 0; }
        started = true;
        finish();
      }
    }
    if (mql) {
      if (mql.addEventListener) mql.addEventListener("change", onMotionChange);
      else if (mql.addListener) mql.addListener(onMotionChange);
    }

    /* -- 6. Cleanup -------------------------------------------------------- */
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      runId++;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (timer) { clearTimeout(timer); timer = 0; }
      if (io) { io.disconnect(); io = null; }
      if (mql) {
        if (mql.removeEventListener) mql.removeEventListener("change", onMotionChange);
        else if (mql.removeListener) mql.removeListener(onMotionChange);
      }
      root.classList.remove("count-up");
      root.classList.remove("is-counting");
      if (opts.className) root.classList.remove(String(opts.className));
      root.removeAttribute("aria-live");
      root.removeAttribute("aria-label");
      root.removeAttribute("data-lphie-mounted");
      root.textContent = originalText;
    }

    /* Escape hatch for startWhen:false — the coordinator can call
       destroy.start() when the gating condition is met. */
    destroy.start = trigger;
    return destroy;
  }

  window.LPHIE.components.countUp = mount;

  /* ---- auto-init --------------------------------------------------------- */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-count-up]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-count-up");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  /* NB: the text is read inside autoInit, never at module-evaluation time, so
     main.js fillTokens() has already put the real numbers in the DOM.
     This script tag MUST come after assets/js/main.js. */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
