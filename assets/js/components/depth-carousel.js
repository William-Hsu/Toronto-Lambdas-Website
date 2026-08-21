/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   DepthCarousel — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   A stack of photographs receding along Z: the front plate is sharp and
   upright, the ones behind it step back, slide sideways, turn on their
   vertical axis, dim, and blur. The layout maths is the reference's —

     d          = i - pos, wrapped to the shortest signed path when looping
     translateZ = -depth * d
     translateX = dir * spread * d
     rotateY    = dir * tilt * clamp(d, 0, 1)

   — and the only substitutions are (a) GSAP is replaced by a hand-written rAF
   tween on the same power3.out curve, 1 - (1 - t)^3, and (b) the reference's
   pill dots and glassy chrome are restyled as engraved rules and small caps.

   Navigation: drag, horizontal wheel, arrow keys, a click on any card behind
   the front one, the dots, and the two arrows. Autoplay is opt-in and yields
   to any of them.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* Same prop names as the React component. Two house deviations: `radius`
     defaults to 0 (nothing on this site has rounded corners) and the card
     shadow is a whisper rather than the reference's drop. */
  var DEFAULTS = {
    gallery: null,           /* key into window.LPHIE.galleries              */
    items: null,             /* or an inline [{image, alt, caption}]         */
    cardWidth: 300,
    cardHeight: 380,
    depth: 220,              /* px of Z between neighbouring cards           */
    spread: 90,              /* px of X between neighbouring cards           */
    tilt: 22,                /* degrees of rotateY on the cards behind       */
    tiltDirection: 1,        /* 1 | -1, or "right" | "left"                  */
    perspective: 1400,
    visibleCards: 4,         /* how many are drawn behind the front plate    */
    falloff: 0.2,            /* brightness lost per step back                */
    blur: 6,                 /* px of blur at the back of the stack          */
    duration: 700,           /* ms per settle                                */
    autoplay: false,
    autoplayDelay: 4200,
    loop: true,
    showControls: true,
    showIndicators: true,
    showCaptions: true,
    radius: 0,
    wheelAxis: "x",          /* x = trackpad swipes only; both = also vertical */
    label: "Chapter photographs"
  };

  var NUMERIC = [
    "cardWidth", "cardHeight", "depth", "spread", "tilt", "perspective",
    "visibleCards", "falloff", "blur", "duration", "autoplayDelay", "radius"
  ];

  var BOOLEAN = ["autoplay", "loop", "showControls", "showIndicators", "showCaptions"];

  /* Depth-aware asset prefix, same rule as main.js. */
  var PREFIX = (function () {
    var d = document.documentElement.getAttribute("data-root");
    return d === null ? "" : d;
  })();

  /* ---- 2. Helpers -------------------------------------------------------- */
  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* power3.out — the reference's settle curve, without the library. */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function now() {
    return (window.performance && window.performance.now)
      ? window.performance.now() : Date.now();
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
    for (i = 0; i < BOOLEAN.length; i++) o[BOOLEAN[i]] = !!o[BOOLEAN[i]];

    o.cardWidth = Math.max(80, o.cardWidth);
    o.cardHeight = Math.max(80, o.cardHeight);
    o.visibleCards = Math.max(1, Math.round(o.visibleCards));
    o.falloff = clamp(o.falloff, 0, 0.9);
    o.blur = Math.max(0, o.blur);
    o.duration = Math.max(80, o.duration);
    o.autoplayDelay = Math.max(1200, o.autoplayDelay);
    o.radius = Math.max(0, o.radius);
    o.perspective = Math.max(200, o.perspective);

    if (o.tiltDirection === "left" || o.tiltDirection === -1 || o.tiltDirection === "-1") o.tiltDirection = -1;
    else o.tiltDirection = 1;

    if (o.wheelAxis !== "both") o.wheelAxis = "x";
    return o;
  }

  function resolveImage(src) {
    var s = String(src == null ? "" : src).trim();
    if (!s) return "";
    if (s.indexOf("://") >= 0 || s.charAt(0) === "/") return s;   /* as written */
    if (s.indexOf("/") < 0) return PREFIX + "assets/img/gallery/" + s;
    return PREFIX + s;
  }

  /* Inline items win; otherwise the named gallery; otherwise nothing at all,
     and the component simply does not mount. */
  function normalizeItems(cfg) {
    var source = null, out = [], i, entry, galleries;
    if (cfg.items && cfg.items.length) {
      source = cfg.items;
    } else if (cfg.gallery) {
      galleries = (window.LPHIE && window.LPHIE.galleries) || {};
      if (galleries[cfg.gallery] && galleries[cfg.gallery].length) source = galleries[cfg.gallery];
    }
    if (!source) return out;

    for (i = 0; i < source.length; i++) {
      entry = source[i] || {};
      out.push({
        image: resolveImage(entry.image),
        alt: String(entry.alt == null ? "" : entry.alt),
        caption: String(entry.caption == null ? "" : entry.caption)
      });
    }
    return out;
  }

  /* ---- 3. Mount ---------------------------------------------------------- */
  function mount(root, options) {
    if (!root) return function () {};

    var cfg = settings(options);
    var items = normalizeItems(cfg);
    var n = items.length;
    if (!n) return function () {};              /* nothing to show, no errors */

    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var reduced = !!(mq && mq.matches);

    /* state */
    var pos = 0;                 /* continuous carousel position               */
    var index = 0;               /* the settled front card                     */
    var scale = 1;               /* responsive stage scale                     */
    var cards = [];
    var dots = [];
    var rafId = null;
    var tween = null;            /* { from, delta, t0, dur }                   */
    var autoTimer = null;
    var wheelTimer = null;
    var wheelAcc = 0;
    var dragging = false;
    var dragId = null;
    var dragStartX = 0;
    var dragStartPos = 0;
    var dragLastX = 0;
    var dragLastT = 0;
    var dragVel = 0;             /* index units per second                     */
    var hovered = false;
    var focusedIn = false;
    var visible = true;
    var destroyed = false;

    /* ---- 3a. Skeleton ---------------------------------------------------- */
    while (root.firstChild) root.removeChild(root.firstChild);
    root.classList.add("depth-carousel");
    if (reduced) root.classList.add("depth-carousel--reduced");
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");
    if (!root.getAttribute("aria-label")) root.setAttribute("aria-label", cfg.label);

    var st = root.style;
    st.setProperty("--dc-card-w", cfg.cardWidth + "px");
    st.setProperty("--dc-card-h", cfg.cardHeight + "px");
    st.setProperty("--dc-radius", cfg.radius + "px");
    st.setProperty("--dc-perspective", cfg.perspective + "px");
    st.setProperty("--dc-scale", "1");

    var stage = document.createElement("div");
    stage.className = "depth-carousel__stage";
    stage.setAttribute("tabindex", "0");
    stage.setAttribute("aria-label", cfg.label + " — use the left and right arrow keys");

    var deck = document.createElement("div");
    deck.className = "depth-carousel__deck";
    stage.appendChild(deck);
    root.appendChild(stage);

    var i, card, img, frame;
    for (i = 0; i < n; i++) {
      card = document.createElement("div");
      card.className = "depth-carousel__card";
      card.setAttribute("data-index", String(i));

      frame = document.createElement("div");
      frame.className = "depth-carousel__frame";

      img = document.createElement("img");
      img.setAttribute("src", items[i].image);
      img.setAttribute("alt", items[i].alt);
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("draggable", "false");
      frame.appendChild(img);

      card.appendChild(frame);
      deck.appendChild(card);
      cards.push(card);
    }

    /* Caption plate under the stack — one line, crossfaded on settle. */
    var caption = null;
    if (cfg.showCaptions) {
      caption = document.createElement("p");
      caption.className = "depth-carousel__caption";
      caption.textContent = items[0].caption;
      root.appendChild(caption);
    }

    /* Controls row: arrows either side of the dots. */
    var prevBtn = null, nextBtn = null, dotsWrap = null, controls = null;
    if (cfg.showControls || cfg.showIndicators) {
      controls = document.createElement("div");
      controls.className = "depth-carousel__controls";

      if (cfg.showControls) {
        prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.className = "depth-carousel__arrow depth-carousel__arrow--prev";
        prevBtn.setAttribute("aria-label", "Previous photograph");
        prevBtn.innerHTML = "<span aria-hidden=\"true\">&#8592;</span>";
        controls.appendChild(prevBtn);
      }

      if (cfg.showIndicators) {
        dotsWrap = document.createElement("div");
        dotsWrap.className = "depth-carousel__dots";
        dotsWrap.setAttribute("role", "tablist");
        dotsWrap.setAttribute("aria-label", "Choose a photograph");
        for (i = 0; i < n; i++) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "depth-carousel__dot";
          dot.setAttribute("role", "tab");
          dot.setAttribute("data-index", String(i));
          dot.setAttribute("aria-label", items[i].caption || ("Photograph " + (i + 1)));
          dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
          dotsWrap.appendChild(dot);
          dots.push(dot);
        }
        controls.appendChild(dotsWrap);
      }

      if (cfg.showControls) {
        nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "depth-carousel__arrow depth-carousel__arrow--next";
        nextBtn.setAttribute("aria-label", "Next photograph");
        nextBtn.innerHTML = "<span aria-hidden=\"true\">&#8594;</span>";
        controls.appendChild(nextBtn);
      }

      root.appendChild(controls);
    }

    var live = document.createElement("p");
    live.className = "depth-carousel__sr";
    live.setAttribute("aria-live", "polite");
    root.appendChild(live);

    /* ---- 3b. Layout maths ------------------------------------------------ */
    /* Shortest signed distance from the current position, wrapped when the
       carousel loops. */
    function distance(i) {
      var d = i - pos;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;            /* 0 .. n-1 */
        if (d > n / 2) d -= n;            /* -n/2 .. n/2 */
      }
      return d;
    }

    function render() {
      var i, d, ad, opacity, bright, blurPx, transform, z, cardEl;

      for (i = 0; i < n; i++) {
        cardEl = cards[i];
        d = distance(i);
        ad = Math.abs(d);

        /* Cards in front of the viewer fade out over one step; cards past the
           visible depth fade out over the last step. */
        if (d < 0) opacity = clamp(1 + d, 0, 1);
        else opacity = clamp(1 - (d - (cfg.visibleCards - 1)), 0, 1);

        bright = Math.max(0.15, 1 - cfg.falloff * ad);
        blurPx = ad <= 0.12 ? 0 : Math.min(cfg.blur, ad * cfg.blur * 0.5);

        transform =
          "translate(-50%, -50%)" +
          " translate3d(" + (cfg.tiltDirection * cfg.spread * d).toFixed(2) + "px, 0, " +
          (-cfg.depth * d).toFixed(2) + "px)" +
          " rotateY(" + (cfg.tiltDirection * cfg.tilt * clamp(d, 0, 1)).toFixed(2) + "deg)";

        z = Math.round(500 - d * 10);

        cardEl.style.transform = transform;
        cardEl.style.opacity = opacity.toFixed(3);
        cardEl.style.zIndex = String(z);
        /* An identity filter still forces the card through a compositing pass
           and softens it, so the front plate is left with none at all. */
        if (bright > 0.999 && blurPx <= 0.05) {
          cardEl.style.filter = "";
        } else {
          cardEl.style.filter = "brightness(" + bright.toFixed(3) + ")" +
            (blurPx > 0.05 ? " blur(" + blurPx.toFixed(2) + "px)" : "");
        }
        cardEl.style.visibility = opacity < 0.01 ? "hidden" : "visible";

        if (ad < 0.5) cardEl.classList.add("is-front");
        else cardEl.classList.remove("is-front");
      }
    }

    function normalizePos() {
      if (!cfg.loop || n < 2) return;
      pos = ((pos % n) + n) % n;
    }

    function settledIndex() {
      var v = Math.round(pos);
      if (cfg.loop && n > 1) v = ((v % n) + n) % n;
      return clamp(v, 0, n - 1);
    }

    function syncChrome() {
      var next = settledIndex();
      if (next === index) return;
      index = next;
      for (var i = 0; i < dots.length; i++) {
        dots[i].setAttribute("aria-selected", i === index ? "true" : "false");
        if (i === index) dots[i].classList.add("is-current");
        else dots[i].classList.remove("is-current");
      }
      if (caption) {
        caption.classList.add("is-swapping");
        caption.textContent = items[index].caption;
        /* The class is dropped on the next frame so the fade restarts. */
        requestAnimationFrame(function () {
          if (!destroyed && caption) caption.classList.remove("is-swapping");
        });
      }
      live.textContent = "Photograph " + (index + 1) + " of " + n +
        (items[index].caption ? ": " + items[index].caption : "");
    }

    /* ---- 3c. Tween ------------------------------------------------------- */
    function frameStep() {
      rafId = null;
      if (destroyed) return;

      if (tween) {
        var t = clamp((now() - tween.t0) / tween.dur, 0, 1);
        pos = tween.from + tween.delta * easeOut(t);
        render();
        syncChrome();
        if (t >= 1) {
          pos = tween.from + tween.delta;   /* land exactly on the target */
          tween = null;
          normalizePos();
          render();
          syncChrome();
          return;                           /* the loop ends with the motion */
        }
        rafId = requestAnimationFrame(frameStep);
        return;
      }

      if (dragging) {
        render();
        syncChrome();
        rafId = requestAnimationFrame(frameStep);
      }
    }

    function pump() {
      if (rafId === null && !destroyed) rafId = requestAnimationFrame(frameStep);
    }

    function stopTween() {
      tween = null;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    }

    /* Move to an absolute (possibly out-of-range) position. */
    function glideTo(target, dur) {
      stopTween();
      if (reduced) {
        pos = target;
        normalizePos();
        render();
        syncChrome();
        return;
      }
      var delta = target - pos;
      if (Math.abs(delta) < 0.0005) {
        pos = target;
        normalizePos();
        render();
        syncChrome();
        return;
      }
      tween = { from: pos, delta: delta, t0: now(), dur: cfg.duration * Math.min(2, Math.max(0.6, Math.abs(delta))) };
      if (typeof dur === "number" && isFinite(dur)) tween.dur = Math.max(80, dur);
      pump();
    }

    /* Move by whole steps, taking the short way round when looping. */
    function step(delta) {
      var target = Math.round(pos) + delta;
      if (!cfg.loop) target = clamp(target, 0, n - 1);
      glideTo(target);
      restartAutoplay();
    }

    function goTo(i) {
      var target = i;
      if (cfg.loop && n > 1) {
        /* Pick whichever representative of i is nearest the current position. */
        var base = Math.round(pos);
        var d = ((i - base) % n + n) % n;
        if (d > n / 2) d -= n;
        target = base + d;
      } else {
        target = clamp(i, 0, n - 1);
      }
      glideTo(target);
      restartAutoplay();
    }

    /* ---- 3d. Sizing ------------------------------------------------------ */
    /* The whole stack scales down together, so the depth maths never has to
       change with the viewport. */
    function measure() {
      if (destroyed) return;
      var width = root.clientWidth || 900;
      var needed = cfg.cardWidth + cfg.spread * 1.9 + 96;
      var next = clamp(width / needed, 0.46, 1);
      if (Math.abs(next - scale) < 0.005) return;
      scale = next;
      root.style.setProperty("--dc-scale", scale.toFixed(3));
    }

    /* ---- 3e. Pointer drag ------------------------------------------------ */
    var DRAG_UNIT = function () { return Math.max(60, cfg.cardWidth * 0.62 * scale); };

    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      dragId = e.pointerId;
      dragStartX = e.clientX;
      dragStartPos = pos;
      dragLastX = e.clientX;
      dragLastT = now();
      dragVel = 0;
      stopTween();
      stopAutoplay();
      root.classList.add("is-dragging");
      if (stage.setPointerCapture && e.pointerId !== undefined) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* no capture, no harm */ }
      }
      pump();
    }

    function onDragMove(e) {
      if (!dragging) return;
      if (dragId !== null && e.pointerId !== undefined && e.pointerId !== dragId) return;
      var dx = e.clientX - dragStartX;
      var nextPos = dragStartPos - dx / DRAG_UNIT();
      if (!cfg.loop) nextPos = clamp(nextPos, -0.35, n - 1 + 0.35);

      var t = now();
      var dt = Math.max(8, t - dragLastT) / 1000;
      dragVel = ((e.clientX - dragLastX) / DRAG_UNIT()) / dt * -1;
      dragLastX = e.clientX;
      dragLastT = t;

      pos = nextPos;
      if (e.cancelable) e.preventDefault();
    }

    function onUp(e) {
      if (!dragging) return;
      if (dragId !== null && e && e.pointerId !== undefined && e.pointerId !== dragId) return;
      dragging = false;
      dragId = null;
      root.classList.remove("is-dragging");
      stopTween();

      /* Fling: project a quarter second of the release velocity, then snap. */
      var projected = pos + clamp(dragVel, -6, 6) * 0.24;
      var target = Math.round(projected);
      if (!cfg.loop) target = clamp(target, 0, n - 1);
      glideTo(target, cfg.duration * 0.9);
      restartAutoplay();
    }

    function onCardClick(e) {
      if (dragging) return;
      var el = e.target && e.target.closest ? e.target.closest(".depth-carousel__card") : null;
      if (!el) return;
      var i = parseInt(el.getAttribute("data-index"), 10);
      if (isNaN(i)) return;
      /* A click on the front card is a no-op, as in the reference. */
      if (Math.abs(distance(i)) < 0.5) return;
      goTo(i);
    }

    /* ---- 3f. Wheel ------------------------------------------------------- */
    /* Only a horizontal gesture steers by default: hijacking a vertical wheel
       would fight the page's own scroll. Set wheelAxis:"both" to opt in. */
    function onWheel(e) {
      var horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (cfg.wheelAxis === "x" && !horizontal) return;
      var delta = horizontal ? e.deltaX : e.deltaY;
      if (!delta) return;
      if (e.cancelable) e.preventDefault();

      wheelAcc += delta;
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () {
        wheelTimer = null;
        var steps = clamp(Math.round(wheelAcc / 90), -3, 3);
        wheelAcc = 0;
        if (steps) step(steps);
      }, 90);
    }

    /* ---- 3g. Keyboard ---------------------------------------------------- */
    function onKey(e) {
      var k = e.key;
      if (k === "ArrowLeft" || k === "Left") { e.preventDefault(); step(-1); }
      else if (k === "ArrowRight" || k === "Right") { e.preventDefault(); step(1); }
      else if (k === "Home") { e.preventDefault(); goTo(0); }
      else if (k === "End") { e.preventDefault(); goTo(n - 1); }
    }

    function onDotClick(e) {
      var el = e.target && e.target.closest ? e.target.closest(".depth-carousel__dot") : null;
      if (!el) return;
      var i = parseInt(el.getAttribute("data-index"), 10);
      if (!isNaN(i)) goTo(i);
    }

    /* ---- 3h. Autoplay ---------------------------------------------------- */
    function stopAutoplay() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    }

    function canAutoplay() {
      return cfg.autoplay && !reduced && !destroyed && visible &&
        !hovered && !focusedIn && !dragging && n > 1;
    }

    function restartAutoplay() {
      stopAutoplay();
      if (!canAutoplay()) return;
      autoTimer = setTimeout(function () {
        autoTimer = null;
        if (!canAutoplay()) return;
        var target = Math.round(pos) + 1;
        if (!cfg.loop && target > n - 1) target = 0;
        glideTo(target);
        restartAutoplay();
      }, cfg.autoplayDelay);
    }

    /* ---- 3i. Wiring ------------------------------------------------------ */
    var hasPointer = !!window.PointerEvent;
    var DOWN = hasPointer ? "pointerdown" : "mousedown";
    var MOVE = hasPointer ? "pointermove" : "mousemove";
    var UP = hasPointer ? "pointerup" : "mouseup";
    var CANCEL = hasPointer ? "pointercancel" : "mouseleave";

    stage.addEventListener(DOWN, onDown);
    stage.addEventListener(MOVE, onDragMove, { passive: false });
    window.addEventListener(UP, onUp);
    stage.addEventListener(CANCEL, onUp);
    stage.addEventListener("click", onCardClick);
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("keydown", onKey);
    if (dotsWrap) dotsWrap.addEventListener("click", onDotClick);
    if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });

    function onEnter() { hovered = true; stopAutoplay(); }
    function onLeave() { hovered = false; restartAutoplay(); }
    function onFocusIn() { focusedIn = true; stopAutoplay(); }
    function onFocusOut() { focusedIn = false; restartAutoplay(); }

    root.addEventListener("mouseenter", onEnter);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);

    var ro = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(function () { measure(); });
      ro.observe(root);
    } else {
      window.addEventListener("resize", measure);
    }

    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        for (var j = 0; j < entries.length; j++) visible = entries[j].isIntersecting;
        if (visible) restartAutoplay(); else stopAutoplay();
      }, { rootMargin: "80px 0px" });
      io.observe(root);
    }

    function onMqChange(e) {
      reduced = !!(e && e.matches);
      if (reduced) {
        root.classList.add("depth-carousel--reduced");
        stopTween();
        stopAutoplay();
        pos = Math.round(pos);
        normalizePos();
        render();
        syncChrome();
      } else {
        root.classList.remove("depth-carousel--reduced");
        restartAutoplay();
      }
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMqChange);
      else if (mq.addListener) mq.addListener(onMqChange);
    }

    /* ---- 3j. Go ---------------------------------------------------------- */
    measure();
    render();
    if (dots.length) {
      dots[0].classList.add("is-current");
    }
    live.textContent = "Photograph 1 of " + n +
      (items[0].caption ? ": " + items[0].caption : "");
    restartAutoplay();

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopTween();
      stopAutoplay();
      if (wheelTimer) { clearTimeout(wheelTimer); wheelTimer = null; }
      stage.removeEventListener(DOWN, onDown);
      stage.removeEventListener(MOVE, onDragMove);
      window.removeEventListener(UP, onUp);
      stage.removeEventListener(CANCEL, onUp);
      stage.removeEventListener("click", onCardClick);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("keydown", onKey);
      if (dotsWrap) dotsWrap.removeEventListener("click", onDotClick);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", measure);
      if (io) io.disconnect();
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMqChange);
        else if (mq.removeListener) mq.removeListener(onMqChange);
      }
      while (root.firstChild) root.removeChild(root.firstChild);
      cards = [];
      dots = [];
      root.classList.remove("depth-carousel");
      root.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.depthCarousel = mount;

  /* ---- 4. Auto-init ------------------------------------------------------ */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-depth-carousel]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-depth-carousel");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
