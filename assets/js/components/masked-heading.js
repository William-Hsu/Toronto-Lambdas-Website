/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   MaskedHeading — vanilla port of the React Bits component of the same name.
   No dependencies (no GSAP, no React). Works from file:// as well as a server.

   The heading text becomes a clip-path window onto a photo (or, until the exec
   board supplies one, an animated brand-navy gradient) that drifts and
   parallaxes behind the letterforms.

   Mount:  <h2 data-masked-heading='{}'>Asian-interest.<br>Never Asian-exclusive.</h2>
   The heading text is read OUT OF THE DOM (a <br> counts as a line break), so
   the markup still renders as an ordinary heading if this script never runs.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  var SVG_NS = "http://www.w3.org/2000/svg";

  /* useId() does not exist outside React — one counter per page instead, so
     several MaskedHeadings on one page never collide on a clip-path id. */
  var uid = 0;

  /* ---- Defaults ---------------------------------------------------------
     Every prop from the React reference, same names. Values marked TUNED
     differ from the reference because this heading has to sit beside the
     site's ordinary <h2>s (font-size: clamp(1.9rem, 3.6vw, 2.75rem)) in the
     left column of a two-column grid on white.
     ---------------------------------------------------------------------- */
  var DEFAULTS = {
    /* Text. Empty means "read it from the DOM"; a string here overrides,
       and "\n" (or a literal <br>) marks a line break. */
    text: "",

    /* Media. The exec board drops a WIDE chapter photo (roughly 3:1, at least
       1600px across, JPEG) at assets/img/masked-heading.jpg and it appears
       here with no other change. Until that file exists the onerror path
       below renders the animated navy gradient instead. */
    mediaType: "image",             /* "image" | "video" */
    src: "assets/img/masked-heading.jpg",
    poster: "",

    fillScale: 1.25,                /* TUNED — reference 1.25, kept */
    parallax: 26,
    drift: 18,
    brightness: 1,
    saturation: 1,
    grayscale: false,

    reveal: "rise",                 /* "rise" | "wipe" | "fade" | "none" */
    duration: 1.1,
    stagger: 0.09,
    trigger: "view",                /* "view" | "hover" | "mount" */

    align: "left",                  /* TUNED — reference "center"; this site's headings are left-aligned */
    weight: 600,                    /* TUNED — reference 700; matches h1..h4 { font-weight: 600 } */
    tracking: -0.01,                /* TUNED — reference -0.03; matches h1..h4 { letter-spacing: -0.01em } */
    lineHeight: 1.06,

    /* TUNED — reference 0.115 (a number).
       "css" means: do not size the heading at all; let the stylesheet do it.

       The reference scales the heading off its CONTAINER width. This site
       sizes headings off the VIEWPORT — h2 { font-size: clamp(1.9rem, 3.6vw,
       2.75rem) } — and the two cannot track each other. .grid--2 is
       repeat(auto-fit, minmax(320px, 1fr)), so below ~736px viewport it
       collapses to one column: the container jumps to nearly the full
       viewport width while a sibling h2 is still pinned at its 30.4px floor.
       Any fixed ratio is then wrong by up to +72% in that band and -18% at
       375px, and no clamp repairs it because the error is in the middle, not
       at the ends.

       In "css" mode sync() simply skips the font-size assignment. The h2
       keeps the stylesheet's clamp(), the measuring span inherits it, and
       sync() copies the RESULTING computed font off the measuring span onto
       the SVG <text> nodes exactly as it always did — so the clip geometry
       tracks the site's own type scale at every width, by construction.

       Pass a number to restore the reference's container-relative behaviour
       (e.g. {"textScale": 0.115}). minFontSize/maxFontSize apply only then. */
    textScale: "css",

    /* The reference's clamp on the computed size — numeric textScale only. */
    minFontSize: 20,
    maxFontSize: 200
  };

  /* ---- Small helpers ----------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function hasOwn(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function merge(base, extra) {
    var out = {}, k;
    for (k in base) { if (hasOwn(base, k)) out[k] = base[k]; }
    if (extra) {
      for (k in extra) {
        if (hasOwn(extra, k) && extra[k] !== null && extra[k] !== undefined) out[k] = extra[k];
      }
    }
    return out;
  }

  function now() {
    return (window.performance && window.performance.now) ? window.performance.now() : (new Date()).getTime();
  }

  /* Depth-aware asset prefix, same rule main.js uses. */
  function prefix() {
    var d = document.documentElement.getAttribute("data-root");
    return d === null ? "" : d;
  }

  function resolveSrc(src) {
    if (!src) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(src)) return src;
    return prefix() + src;
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* GSAP easing equivalents. */
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }          /* power4.out  — rise */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }          /* power3.out  — fade */
  function easeInOutCubic(t) {                                          /* power3.inOut — wipe */
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* Read the heading text out of the DOM, treating <br> as a newline. */
  function readText(node) {
    var out = "";
    var kids = node.childNodes;
    for (var i = 0; i < kids.length; i += 1) {
      var n = kids[i];
      if (n.nodeType === 3) { out += n.nodeValue; }
      else if (n.nodeType === 1) {
        if (n.nodeName.toLowerCase() === "br") out += "\n";
        else out += readText(n);
      }
    }
    return out;
  }

  /* "Asian-interest.\nNever Asian-exclusive." -> [["Asian-interest."], ["Never","Asian-exclusive."]] */
  function parseLines(text) {
    var raw = String(text === null || text === undefined ? "" : text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    var out = [];
    for (var i = 0; i < raw.length; i += 1) {
      var parts = raw[i].replace(/\s+/g, " ").replace(/^ | $/g, "").split(" ");
      var line = [];
      for (var j = 0; j < parts.length; j += 1) { if (parts[j]) line.push(parts[j]); }
      if (line.length) out.push(line);
    }
    return out;
  }

  /* clip-path: url(#id) is the whole component. If the browser cannot do it,
     leave the plain heading alone rather than blanking it out. */
  function clipPathSupported() {
    if (!window.CSS || typeof window.CSS.supports !== "function") return true;
    return window.CSS.supports("clip-path", "url(#mh)") ||
           window.CSS.supports("-webkit-clip-path", "url(#mh)");
  }

  /* ---- mount ------------------------------------------------------------- */
  function mount(root, options) {
    if (!root || !root.nodeType) return function () {};
    if (!clipPathSupported()) return function () {};

    var o = merge(DEFAULTS, options);
    var lines = parseLines((typeof o.text === "string" && o.text) ? o.text : readText(root));
    if (!lines.length) return function () {};

    /* Sizing mode. A finite number = the reference's container-relative
       scaling; anything else ("css", the default) leaves font-size to the
       stylesheet. See the textScale note in DEFAULTS. */
    var scaleIsNumeric = (typeof o.textScale === "number") &&
                         isFinite(o.textScale) && o.textScale > 0;

    /* -- 1. Build the DOM ------------------------------------------------- */
    var clipId = "mh-clip-" + (++uid);

    var measure = document.createElement("span");
    measure.className = "masked-heading__measure";

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "masked-heading__defs");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var defs = document.createElementNS(SVG_NS, "defs");
    var clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

    var wordBoxes = [];   /* measuring spans — drive offsetLeft */
    var baseMarks = [];   /* zero-size <i> sitting on each baseline — drives offsetTop */
    var glyphs = [];      /* SVG <text> nodes inside the clipPath */

    for (var li = 0; li < lines.length; li += 1) {
      if (li > 0) measure.appendChild(document.createElement("br"));
      var line = lines[li];
      for (var wi = 0; wi < line.length; wi += 1) {
        var word = line[wi];

        var box = document.createElement("span");
        box.className = "masked-heading__word";
        box.appendChild(document.createTextNode(word));

        var mark = document.createElement("i");
        mark.className = "masked-heading__baseline";
        box.appendChild(mark);

        measure.appendChild(box);
        /* A REAL space between the word boxes, not the reference's
           `.word:not(:last-child)::after { content: " " }`. Two reasons:
           the accessible text then actually contains the spaces, and the
           words regain a soft-wrap opportunity (adjacent inline-blocks with
           only pseudo-content between them can never break, so a long line
           would overflow instead of wrapping). If a line does wrap, the
           measuring spans report the new offsets and the clip geometry
           follows on its own — same mechanism the <br> uses. */
        if (wi < line.length - 1) measure.appendChild(document.createTextNode(" "));

        /* NB createElementNS — a document.createElement("text") would sit in
           the DOM and never render, which is the classic silent failure here. */
        var glyph = document.createElementNS(SVG_NS, "text");
        glyph.textContent = word;
        clipPath.appendChild(glyph);

        wordBoxes.push(box);
        baseMarks.push(mark);
        glyphs.push(glyph);
      }
    }

    defs.appendChild(clipPath);
    svg.appendChild(defs);

    var layer = document.createElement("span");
    layer.className = "masked-heading__reveal";
    layer.setAttribute("aria-hidden", "true");

    var clipBox = document.createElement("span");
    clipBox.className = "masked-heading__clip";
    clipBox.style.clipPath = "url(#" + clipId + ")";
    clipBox.style.webkitClipPath = "url(#" + clipId + ")";

    var media = document.createElement("span");
    media.className = "masked-heading__media";

    clipBox.appendChild(media);
    layer.appendChild(clipBox);

    root.className = root.className ? (root.className + " masked-heading") : "masked-heading";
    root.style.textAlign = o.align;
    root.style.fontWeight = String(o.weight);
    root.style.letterSpacing = o.tracking + "em";
    root.style.lineHeight = String(o.lineHeight);

    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(measure);
    root.appendChild(svg);
    root.appendChild(layer);

    /* -- 2. Media, with the gradient fallback ----------------------------- */
    var source = null;
    var onSourceError = null;
    var usingGradient = false;

    function useGradient() {
      if (usingGradient) return;
      usingGradient = true;
      if (source) {
        if (onSourceError) source.removeEventListener("error", onSourceError);
        if (source.parentNode) source.parentNode.removeChild(source);
        source = null;
      }
      root.classList.add("masked-heading--gradient");
      var fill = document.createElement("span");
      fill.className = "masked-heading__source masked-heading__fill";
      media.appendChild(fill);
    }

    (function buildSource() {
      var src = resolveSrc(typeof o.src === "string" ? o.src : "");
      if (!src) { useGradient(); return; }        /* empty src — no failed request */

      onSourceError = function () { useGradient(); };

      if (o.mediaType === "video") {
        var video = document.createElement("video");
        video.className = "masked-heading__source";
        video.setAttribute("muted", "");
        video.setAttribute("loop", "");
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        video.setAttribute("autoplay", "");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        if (o.poster) video.setAttribute("poster", resolveSrc(o.poster));
        video.addEventListener("error", onSourceError);
        video.setAttribute("src", src);
        media.appendChild(video);
        source = video;
        return;
      }

      var img = document.createElement("img");
      img.className = "masked-heading__source";
      img.setAttribute("alt", "");
      img.setAttribute("draggable", "false");
      img.setAttribute("decoding", "async");
      img.addEventListener("error", onSourceError);
      img.setAttribute("src", src);         /* set last, after the listener */
      media.appendChild(img);
      source = img;
    })();

    /* -- 3. place() — drift/parallax transform, clamped so the scaled-up
           media can never expose an edge. ---------------------------------- */
    var off = { x: 0, y: 0, tx: 0, ty: 0 };

    function place() {
      var W = root.clientWidth;
      var H = root.clientHeight;
      var maxX = Math.max(0, ((o.fillScale - 1) / 2) * W);
      var maxY = Math.max(0, ((o.fillScale - 1) / 2) * H);
      media.style.transform =
        "translate3d(" + clamp(off.x, -maxX, maxX).toFixed(2) + "px, " +
        clamp(off.y, -maxY, maxY).toFixed(2) + "px, 0) scale(" + o.fillScale + ")";
      media.style.filter =
        "brightness(" + o.brightness + ") saturate(" + o.saturation + ")" +
        (o.grayscale ? " grayscale(1)" : "");
    }

    /* -- 4. sync() — THE CRITICAL STEP. Copy each measuring span's
           offsetLeft / baseline offsetTop and computed font styles onto the
           matching SVG <text>, so the clip path lands exactly on the layout.
           The <br> in the measuring markup is what makes the second line work:
           its words simply report a larger offsetTop and the geometry follows.
           ------------------------------------------------------------------ */
    function sync() {
      var w = root.clientWidth;
      if (!w) return;

      /* Container-relative sizing only when textScale is a number. In "css"
         mode we deliberately never touch root.style.fontSize, so the site's
         own h2 { font-size: clamp(...) } governs and everything below reads
         back whatever it produced. */
      if (scaleIsNumeric) {
        var size = clamp(w * o.textScale, o.minFontSize, o.maxFontSize).toFixed(1) + "px";
        if (root.style.fontSize !== size) root.style.fontSize = size;
      }

      var cs = window.getComputedStyle(measure);
      for (var i = 0; i < glyphs.length; i += 1) {
        var box = wordBoxes[i], base = baseMarks[i], glyph = glyphs[i];
        if (!box || !base || !glyph) continue;
        glyph.setAttribute("x", String(box.offsetLeft));
        glyph.setAttribute("y", String(base.offsetTop));
        glyph.style.fontFamily = cs.fontFamily;
        glyph.style.fontSize = cs.fontSize;
        glyph.style.fontWeight = cs.fontWeight;
        glyph.style.fontStyle = cs.fontStyle;
        glyph.style.letterSpacing = cs.letterSpacing;
      }
      place();
    }

    /* -- 5. Reveal ---------------------------------------------------------- */
    var revealRaf = 0;
    var revealCleanup = null;

    function stopReveal() {
      if (revealRaf) { cancelAnimationFrame(revealRaf); revealRaf = 0; }
    }

    function setGlyphY(i, y) {
      glyphs[i].setAttribute("transform", "translate(0," + y.toFixed(2) + ")");
    }

    function setLayerClip(v) {
      layer.style.clipPath = v;
      layer.style.webkitClipPath = v;
    }

    function riseDistance() {
      return (parseFloat(window.getComputedStyle(root).fontSize) || 48) * 1.15;
    }

    function settle() {
      for (var i = 0; i < glyphs.length; i += 1) setGlyphY(i, 0);
      layer.style.opacity = "1";
      layer.style.transform = "none";
      setLayerClip("inset(0% 0% 0% 0%)");
    }

    function rest() {
      var i;
      if (o.reveal === "rise") {
        var d = riseDistance();
        for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, d);
      } else if (o.reveal === "wipe") {
        setLayerClip("inset(0% 100% 0% 0%)");
      } else if (o.reveal === "fade") {
        layer.style.opacity = "0";
        layer.style.transform = "scale(1.08)";
      }
    }

    function play() {
      stopReveal();
      if (o.reveal === "none" || reducedMotion()) { settle(); return; }

      var dur = Math.max(10, o.duration * 1000);
      var start = -1;
      var i;

      if (o.reveal === "rise") {
        layer.style.opacity = "1";
        layer.style.transform = "none";
        setLayerClip("inset(0% 0% 0% 0%)");
        var dist = riseDistance();
        var stagger = Math.max(0, o.stagger) * 1000;
        /* Apply the from-state synchronously so "mount"/"hover" never paint a
           single frame of the settled heading before the tween's first tick. */
        for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, dist);

        revealRaf = requestAnimationFrame(function riseFrame(t) {
          if (start < 0) start = t;
          var elapsed = t - start;
          var done = true;
          for (i = 0; i < glyphs.length; i += 1) {
            var p = (elapsed - i * stagger) / dur;
            if (p < 0) p = 0;
            if (p < 1) done = false; else p = 1;
            setGlyphY(i, dist * (1 - easeOutQuart(p)));
          }
          revealRaf = done ? 0 : requestAnimationFrame(riseFrame);
        });
        return;
      }

      if (o.reveal === "wipe") {
        for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, 0);
        layer.style.opacity = "1";
        layer.style.transform = "none";
        setLayerClip("inset(0% 100% 0% 0%)");

        revealRaf = requestAnimationFrame(function wipeFrame(t) {
          if (start < 0) start = t;
          var p = clamp((t - start) / dur, 0, 1);
          setLayerClip("inset(0% " + (100 * (1 - easeInOutCubic(p))).toFixed(2) + "% 0% 0%)");
          revealRaf = p >= 1 ? 0 : requestAnimationFrame(wipeFrame);
        });
        return;
      }

      /* fade */
      for (i = 0; i < glyphs.length; i += 1) setGlyphY(i, 0);
      setLayerClip("inset(0% 0% 0% 0%)");
      layer.style.opacity = "0";
      layer.style.transform = "scale(1.08)";
      revealRaf = requestAnimationFrame(function fadeFrame(t) {
        if (start < 0) start = t;
        var p = clamp((t - start) / dur, 0, 1);
        var e = easeOutCubic(p);
        layer.style.opacity = String(e);
        layer.style.transform = "scale(" + (1.08 + (1 - 1.08) * e).toFixed(4) + ")";
        if (p >= 1) { layer.style.transform = "none"; revealRaf = 0; return; }
        revealRaf = requestAnimationFrame(fadeFrame);
      });
    }

    function setupReveal() {
      if (revealCleanup) { revealCleanup(); revealCleanup = null; }
      stopReveal();
      if (!glyphs.length) return;

      if (o.reveal === "none" || reducedMotion()) { settle(); return; }

      if (o.trigger === "hover") {
        settle();
        root.addEventListener("pointerenter", play);
        revealCleanup = function () { root.removeEventListener("pointerenter", play); };
        return;
      }

      if (o.trigger === "view") {
        settle();
        rest();
        if (!("IntersectionObserver" in window)) { play(); return; }
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i += 1) {
            if (entries[i].isIntersecting) { play(); io.disconnect(); return; }
          }
        }, { threshold: 0.25 });
        io.observe(root);
        revealCleanup = function () { io.disconnect(); };
        return;
      }

      play();
    }

    /* -- 6. Ambient drift + damped pointer parallax ------------------------ */
    var raf = 0;
    var running = false;
    var last = 0;
    var clock = 0;

    function frame(t) {
      var dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      clock += dt;

      var dx = Math.sin(clock * 0.21) * o.drift;
      var dy = Math.cos(clock * 0.17) * o.drift * 0.6;

      var ease = 1 - Math.exp(-dt / 0.18);
      off.x += (off.tx + dx - off.x) * ease;
      off.y += (off.ty + dy - off.y) * ease;

      place();
      raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running || reducedMotion()) return;
      running = true;
      last = now();
      root.classList.remove("is-paused");
      raf = requestAnimationFrame(frame);
    }

    function stopLoop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      root.classList.add("is-paused");
    }

    function onMove(e) {
      if (o.parallax <= 0) return;
      var r = root.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
      var ny = ((e.clientY - r.top) / (r.height || 1)) * 2 - 1;
      off.tx = clamp(nx, -1, 1) * -o.parallax;
      off.ty = clamp(ny, -1, 1) * -o.parallax;
    }

    function onLeave() { off.tx = 0; off.ty = 0; }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    /* -- 7. Observers ------------------------------------------------------ */
    sync();
    setupReveal();

    /* Re-measure on resize. The window listener runs IN ADDITION to the
       ResizeObserver, not as a fallback for it: in "css" mode the heading's
       font-size comes from a vw-based clamp(), and there is a band where the
       viewport changes the computed font-size while the root's own box does
       NOT change (viewport 1180-1222px — .wrap is already capped at 1180, so
       the column stays 542px wide). A ResizeObserver alone can miss that and
       the clip would drift out of alignment against the layout. rAF-throttled
       so a drag-resize coalesces to one sync per frame. */
    var ro = null;
    var resizeRaf = 0;
    function onResize() {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(function () { resizeRaf = 0; sync(); });
    }
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(sync);
      ro.observe(root);
    }
    window.addEventListener("resize", onResize);

    /* The site loads Cormorant Garamond from Google Fonts — the clip geometry
       is measured against the fallback serif until it lands, so re-measure. */
    var alive = true;
    var loadFallback = false;
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
      document.fonts.ready.then(function () {
        if (alive) sync();
      })["catch"](function () {});
    } else {
      loadFallback = true;
      window.addEventListener("load", sync);
    }

    /* Pause the rAF loop (and the gradient's CSS animation) while the heading
       is off-screen, and while the whole tab is hidden. inView is tracked
       separately from the observer callback so that a tab which loads in the
       background still starts the loop when it is finally brought forward. */
    var inView = false;
    var pauseIo = null;

    function refreshLoop() {
      if (inView && !document.hidden) startLoop(); else stopLoop();
    }

    if ("IntersectionObserver" in window) {
      pauseIo = new IntersectionObserver(function (entries) {
        var visible = false;
        for (var i = 0; i < entries.length; i += 1) { if (entries[i].isIntersecting) visible = true; }
        inView = visible;
        refreshLoop();
      }, { threshold: 0 });
      pauseIo.observe(root);
    } else {
      inView = true;
      refreshLoop();
    }

    function onVisibility() { refreshLoop(); }
    document.addEventListener("visibilitychange", onVisibility);

    /* Reduced motion, including live changes to the setting. */
    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function onMotionChange() {
      if (reducedMotion()) {
        stopLoop();
        off.x = 0; off.y = 0; off.tx = 0; off.ty = 0;
        place();
        settle();
      } else {
        setupReveal();
        refreshLoop();
      }
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMotionChange);
      else if (mq.addListener) mq.addListener(onMotionChange);
    }
    if (reducedMotion()) { settle(); place(); }

    /* -- 8. destroy -------------------------------------------------------- */
    return function destroy() {
      alive = false;
      stopLoop();
      stopReveal();
      if (revealCleanup) { revealCleanup(); revealCleanup = null; }
      if (ro) ro.disconnect();
      if (pauseIo) pauseIo.disconnect();
      if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0; }
      window.removeEventListener("resize", onResize);
      if (loadFallback) window.removeEventListener("load", sync);
      document.removeEventListener("visibilitychange", onVisibility);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
        else if (mq.removeListener) mq.removeListener(onMotionChange);
      }
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (source && onSourceError) source.removeEventListener("error", onSourceError);
    };
  }

  window.LPHIE.components.maskedHeading = mount;

  /* ---- auto-init --------------------------------------------------------- */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-masked-heading]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-masked-heading");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
