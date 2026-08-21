/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   DriftWall — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* Same prop names as the React component. Tuned for a wide full-bleed band
     rather than the reference's small demo box. */
  var DEFAULTS = {
    items: null,
    columns: 6,
    tileWidth: 220,
    tileHeight: 145,
    gap: 18,
    radius: 8,
    tilt: 14,
    turn: -12,
    roll: 0,
    perspective: 1200,
    depth: 120,
    speed: 38,
    direction: "up",
    variance: 0.45,
    parallax: 0.6,
    pauseOnHover: false,
    lift: 64,
    fade: 0.55,
    dim: 0.5,
    grayscale: false,
    overlayColor: "#061539"
  };

  var NUMERIC = [
    "columns", "tileWidth", "tileHeight", "gap", "radius", "tilt", "turn", "roll",
    "perspective", "depth", "speed", "variance", "parallax", "lift", "fade", "dim"
  ];

  /* Used only when data/driftwall.js is missing entirely. */
  var FALLBACK_TITLES = [
    "Brotherhood retreat", "Fall rush kickoff", "Stem cell registry drive",
    "Reveal night", "Convention weekend", "Family line dinner",
    "Intramural finals", "Spring formal", "Charter class reunion",
    "Culture night", "General interest meeting", "Interchapter mixer",
    "Study hours at Robarts", "Front Campus, chapter photo", "Alumni homecoming"
  ];

  /* Deterministic placeholder palette — royal blue and white only. */
  var PH_STOPS = [
    ["#12296B", "#061539"],
    ["#1C3B8F", "#0B1E52"],
    ["#0B1E52", "#12296B"],
    ["#2A50B4", "#12296B"],
    ["#061539", "#1C3B8F"],
    ["#12296B", "#2A50B4"],
    ["#0B1E52", "#1C3B8F"]
  ];
  var PH_ANGLES = [150, 202, 128, 175, 218, 141];
  var PH_MARKS = ["Λ", "Φ", "Ε"];   /* Λ Φ Ε */

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
    for (i = 0; i < NUMERIC.length; i++) {
      o[NUMERIC[i]] = num(o[NUMERIC[i]], DEFAULTS[NUMERIC[i]]);
    }
    o.columns = Math.max(1, Math.round(o.columns));
    if (o.direction !== "down") o.direction = "up";
    return o;
  }

  /* Golden-ratio pseudo-random spread, verbatim from the reference. */
  function columnFactor(index, variance) {
    var pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
    return 1 + variance * pseudo;
  }

  function resolveImage(src) {
    var s = String(src == null ? "" : src);
    if (!s) return "";
    if (s.indexOf("/") >= 0) return s;            /* rooted path or full URL */
    return PREFIX + "assets/img/gallery/" + s;
  }

  function normalizeItems(raw) {
    var source = null, out = [], i, entry;
    if (raw && raw.length) source = raw;
    else if (window.LPHIE.driftWall && window.LPHIE.driftWall.length) source = window.LPHIE.driftWall;

    if (source) {
      for (i = 0; i < source.length; i++) {
        entry = source[i] || {};
        out.push({
          image: String(entry.image == null ? "" : entry.image),
          title: String(entry.title == null ? "" : entry.title),
          href: String(entry.href == null ? "" : entry.href),
          index: i
        });
      }
    } else {
      for (i = 0; i < FALLBACK_TITLES.length; i++) {
        out.push({ image: "", title: FALLBACK_TITLES[i], href: "", index: i });
      }
    }
    return out;
  }

  /* Round-robin into columns; an empty column borrows the first item. */
  function distribute(list, columns) {
    var cols = [], c, i;
    for (c = 0; c < columns; c++) cols.push([]);
    for (i = 0; i < list.length; i++) cols[i % columns].push(list[i]);
    for (c = 0; c < columns; c++) if (!cols[c].length) cols[c] = list.slice(0, 1);
    return cols;
  }

  function isExternal(href) {
    return href.indexOf("://") >= 0 || href.indexOf("//") === 0;
  }

  /* ---- 3. Mount ---------------------------------------------------------- */
  function mount(root, options) {
    if (!root) return function () {};

    var cfg = settings(options);
    var items = normalizeItems(cfg.items);

    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var reduced = !!(mq && mq.matches);

    /* state */
    var plane = null;
    var tracks = [];
    var colItems = [];
    var meta = [];
    var offsets = [];
    var velocities = [];
    var baseVel = [];
    var m = { columns: 0, tileW: 0, tileH: 0, gap: 0, lift: 0 };
    var containerHeight = 600;
    var signature = "";
    var activeTile = null;
    var hoveredCol = -1;
    var wallHovered = false;
    var pointer = { x: 0, y: 0 };
    var damped = { x: 0, y: 0 };
    var lastTs = null;
    var rafId = null;
    var running = false;
    var visible = true;
    var destroyed = false;
    var layoutQueued = false;

    /* ---- 3a. Root preparation ------------------------------------------- */
    var noJsText = String(root.textContent || "").replace(/\s+/g, " ").trim();
    while (root.firstChild) root.removeChild(root.firstChild);

    root.classList.add("drift-wall");
    root.setAttribute("role", "group");
    if (!root.getAttribute("aria-label")) {
      root.setAttribute("aria-label", "Drifting wall of chapter photographs");
    }
    if (reduced) root.classList.add("drift-wall--reduced");

    /* Screen readers get one plain sentence instead of dozens of repeated
       tiles; every tile below is decorative unless it carries a link. */
    var sr = document.createElement("p");
    sr.className = "drift-wall__sr";
    if (noJsText) {
      sr.textContent = noJsText;
    } else {
      var titles = [];
      for (var t = 0; t < items.length; t++) if (items[t].title) titles.push(items[t].title);
      sr.textContent = "Photographs from the chapter: " + titles.join(", ") + ".";
    }
    root.appendChild(sr);

    /* ---- 3b. DOM building ------------------------------------------------ */
    function buildPlaceholder(index, title) {
      var ph = document.createElement("span");
      var stops = PH_STOPS[index % PH_STOPS.length];
      var angle = PH_ANGLES[index % PH_ANGLES.length];
      ph.className = "drift-wall__ph";
      ph.setAttribute("aria-hidden", "true");
      ph.style.backgroundImage =
        "linear-gradient(" + angle + "deg, " + stops[0] + " 0%, " + stops[1] + " 100%)";

      var mark = document.createElement("span");
      mark.className = "drift-wall__ph-mark";
      mark.textContent = PH_MARKS[index % PH_MARKS.length];

      var label = document.createElement("span");
      label.className = "drift-wall__ph-label";
      label.textContent = title || "ΛΦΕ";

      ph.appendChild(mark);
      ph.appendChild(label);
      return ph;
    }

    function buildTile(item, id, col, decorative) {
      var tile;
      if (item.href && !decorative) {
        tile = document.createElement("a");
        tile.setAttribute("href", item.href);
        tile.setAttribute("aria-label", item.title || "Chapter photograph");
        if (isExternal(item.href)) {
          tile.setAttribute("target", "_blank");
          tile.setAttribute("rel", "noreferrer noopener");
        }
      } else {
        tile = document.createElement("div");
        tile.setAttribute("aria-hidden", "true");
      }
      tile.className = "drift-wall__tile";
      tile.setAttribute("data-tile-id", id);
      tile.setAttribute("data-col", String(col));

      var inner = document.createElement("span");
      inner.className = "drift-wall__inner";
      inner.appendChild(buildPlaceholder(item.index, item.title));

      var src = resolveImage(item.image);
      if (src) {
        var img = document.createElement("img");
        img.setAttribute("src", src);
        img.setAttribute("alt", "");
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
        img.setAttribute("draggable", "false");
        /* A missing file simply falls back to the gradient underneath. */
        img.onerror = function () {
          if (img.parentNode) img.parentNode.removeChild(img);
        };
        inner.appendChild(img);
      }

      var overlay = document.createElement("span");
      overlay.className = "drift-wall__overlay";
      overlay.setAttribute("aria-hidden", "true");
      inner.appendChild(overlay);

      tile.appendChild(inner);
      return tile;
    }

    function buildPlane() {
      var frag = document.createDocumentFragment();
      var c, k, i, colEl, track, list, copies;

      tracks = [];
      activeTile = null;
      hoveredCol = -1;

      for (c = 0; c < colItems.length; c++) {
        colEl = document.createElement("div");
        colEl.className = "drift-wall__col";
        track = document.createElement("div");
        track.className = "drift-wall__track";
        list = colItems[c];
        copies = meta[c].copies;
        for (k = 0; k < copies; k++) {
          for (i = 0; i < list.length; i++) {
            track.appendChild(buildTile(list[i], c + "-" + k + "-" + i, c, k > 0));
          }
        }
        colEl.appendChild(track);
        frag.appendChild(colEl);
        tracks.push(track);
      }

      if (plane && plane.parentNode) plane.parentNode.removeChild(plane);
      plane = document.createElement("div");
      plane.className = "drift-wall__plane";
      plane.appendChild(frag);
      root.insertBefore(plane, sr);
    }

    /* ---- 3c. Layout ------------------------------------------------------ */
    function applyVars() {
      var s = root.style;
      s.setProperty("--dw-tile-w", m.tileW + "px");
      s.setProperty("--dw-tile-h", m.tileH + "px");
      s.setProperty("--dw-gap", m.gap + "px");
      s.setProperty("--dw-radius", cfg.radius + "px");
      s.setProperty("--dw-perspective", cfg.perspective + "px");
      s.setProperty("--dw-lift", m.lift + "px");
      s.setProperty("--dw-dim", String(cfg.dim));
      s.setProperty("--dw-gray", cfg.grayscale ? "1" : "0");
      s.setProperty("--dw-overlay", String(cfg.overlayColor));
      s.setProperty("--dw-edge", Math.max(0, (1 - cfg.fade) * 100) + "%");
    }

    function applyPlaneTransform(px, py) {
      if (!plane) return;
      plane.style.transform =
        "translate(-50%, -50%) scale(1.18) " +
        "rotateX(" + (cfg.tilt + py) + "deg) rotateY(" + (cfg.turn + px) + "deg) " +
        "rotateZ(" + cfg.roll + "deg) translateZ(" + (-cfg.depth) + "px)";
    }

    function applyTracks() {
      for (var c = 0; c < tracks.length; c++) {
        if (tracks[c]) tracks[c].style.transform = "translate3d(0, " + (-(offsets[c] || 0)) + "px, 0)";
      }
    }

    function computeVelocities() {
      var dirSign = cfg.direction === "up" ? 1 : -1;
      var next = [];
      for (var c = 0; c < colItems.length; c++) {
        var altSign = c % 2 === 0 ? 1 : -1;
        next.push(cfg.speed * columnFactor(c, cfg.variance) * dirSign * altSign);
      }
      baseVel = next;
    }

    /* Initial offset per column, verbatim from the reference; an existing
       offset is carried over so a resize never snaps the wall. */
    function seedOffsets(previous, previousVel) {
      var nextOff = [], nextVel = [], c, h, prev;
      for (c = 0; c < meta.length; c++) {
        h = meta[c].copyHeight;
        prev = previous[c];
        if (typeof prev === "number" && isFinite(prev)) nextOff.push(((prev % h) + h) % h);
        else nextOff.push(h * ((c * 0.37) % 1));
        nextVel.push(num(previousVel[c], 0));
      }
      offsets = nextOff;
      velocities = nextVel;
    }

    function responsive(width) {
      if (width < 520) return { columns: 3, scale: 0.62 };
      if (width < 720) return { columns: 4, scale: 0.76 };
      if (width < 1024) return { columns: 5, scale: 0.88 };
      if (width < 1600) return { columns: cfg.columns, scale: 1 };
      return { columns: cfg.columns, scale: 1.12 };
    }

    function layout() {
      if (destroyed) return;

      var rect = root.getBoundingClientRect();
      var width = root.clientWidth || rect.width || 1200;
      var height = root.clientHeight || rect.height || 600;
      containerHeight = height || 600;

      var bp = responsive(width);
      var next = {
        columns: Math.max(1, Math.min(cfg.columns, bp.columns)),
        tileW: Math.round(cfg.tileWidth * bp.scale),
        tileH: Math.round(cfg.tileHeight * bp.scale),
        gap: Math.round(cfg.gap * bp.scale),
        lift: Math.round(cfg.lift * bp.scale)
      };

      /* On a wide monitor, add columns until the plane still fills the band —
         but never so many that a column would hold fewer than two photos. */
      if (width >= 1024) {
        var unitW = next.tileW + next.gap;
        var maxCols = Math.max(cfg.columns, Math.min(cfg.columns + 4, Math.floor(items.length / 2)));
        while (next.columns < maxCols && next.columns * unitW * 1.18 < width * 1.04) next.columns++;
      }

      var nextCols = distribute(items, next.columns);
      var unit = next.tileH + next.gap;
      var nextMeta = [];
      var sig = next.columns + ":" + next.tileW + ":" + next.tileH + ":" + next.gap;
      var c, copyHeight, copies;

      for (c = 0; c < nextCols.length; c++) {
        copyHeight = Math.max(unit, nextCols[c].length * unit);
        copies = Math.max(2, Math.ceil((containerHeight * 1.6) / copyHeight) + 1);
        nextMeta.push({ copyHeight: copyHeight, copies: copies });
        sig += "," + copies;
      }

      m = next;
      colItems = nextCols;
      meta = nextMeta;
      applyVars();
      computeVelocities();
      seedOffsets(offsets, velocities);

      if (sig !== signature) {
        signature = sig;
        buildPlane();
      }
      applyTracks();
      applyPlaneTransform(damped.x, damped.y);
    }

    function queueLayout() {
      if (layoutQueued || destroyed) return;
      layoutQueued = true;
      requestAnimationFrame(function () {
        layoutQueued = false;
        layout();
      });
    }

    /* ---- 3d. Animation loop ---------------------------------------------- */
    function frame(ts) {
      rafId = null;
      if (!running || destroyed) return;

      if (lastTs === null) lastTs = ts;
      var dt = Math.min(0.05, Math.max(0, ts - lastTs) / 1000);
      lastTs = ts;

      /* pointer parallax — damped towards the target every frame */
      var maxTilt = cfg.parallax * 8;
      var targetX = pointer.x * maxTilt;
      var targetY = -pointer.y * maxTilt;
      var damp = 1 - Math.exp(-dt / 0.12);
      damped.x += (targetX - damped.x) * damp;
      damped.y += (targetY - damped.y) * damp;
      applyPlaneTransform(damped.x, damped.y);

      /* per-column drift */
      for (var c = 0; c < tracks.length; c++) {
        var mc = meta[c];
        if (!mc) continue;
        var paused = wallHovered && cfg.pauseOnHover;
        var factor = (paused || hoveredCol === c) ? 0 : 1;
        var target = baseVel[c] * factor;
        var ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
        velocities[c] += (target - velocities[c]) * ease;
        var next = (offsets[c] || 0) + velocities[c] * dt;
        next = ((next % mc.copyHeight) + mc.copyHeight) % mc.copyHeight;
        offsets[c] = next;
        if (tracks[c]) tracks[c].style.transform = "translate3d(0, " + (-next) + "px, 0)";
      }

      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (running || destroyed || reduced || !visible) return;
      running = true;
      lastTs = null;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      lastTs = null;
    }

    /* ---- 3e. Pointer + focus --------------------------------------------- */
    function setActive(tile) {
      if (tile === activeTile) return;
      if (activeTile) activeTile.classList.remove("is-active");
      activeTile = tile;
      if (tile) {
        tile.classList.add("is-active");
        var col = parseInt(tile.getAttribute("data-col"), 10);
        hoveredCol = isNaN(col) ? -1 : col;
      } else {
        hoveredCol = -1;
      }
    }

    /* Hit-test with elementFromPoint: the tile inners are pointer-events:none,
       so a plain event target would not tell us which tile is under the cursor. */
    function onMove(e) {
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (cfg.parallax > 0 && !reduced) {
        pointer.x = (e.clientX - rect.left) / rect.width - 0.5;
        pointer.y = (e.clientY - rect.top) / rect.height - 0.5;
      }
      var hit = document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null;
      var tile = hit && hit.closest ? hit.closest("[data-tile-id]") : null;
      if (!tile) return;
      setActive(tile);
    }

    function onEnter() { wallHovered = true; }

    function onLeave() {
      wallHovered = false;
      pointer.x = 0;
      pointer.y = 0;
      setActive(null);
    }

    function onFocusIn(e) {
      var tile = e.target && e.target.closest ? e.target.closest("[data-tile-id]") : null;
      if (tile) setActive(tile);
    }

    function onFocusOut() { setActive(null); }

    var hasPointer = !!window.PointerEvent;
    var MOVE = hasPointer ? "pointermove" : "mousemove";
    var ENTER = hasPointer ? "pointerenter" : "mouseenter";
    var LEAVE = hasPointer ? "pointerleave" : "mouseleave";

    root.addEventListener(MOVE, onMove);
    root.addEventListener(ENTER, onEnter);
    root.addEventListener(LEAVE, onLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);

    /* ---- 3f. Observers ---------------------------------------------------- */
    var ro = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(function () { queueLayout(); });
      ro.observe(root);
    } else {
      window.addEventListener("resize", queueLayout);
    }

    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) visible = entries[i].isIntersecting;
        if (visible) start(); else stop();
      }, { rootMargin: "120px 0px" });
      io.observe(root);
    }

    function onMqChange(e) {
      reduced = !!(e && e.matches);
      if (reduced) {
        root.classList.add("drift-wall--reduced");
        stop();
        pointer.x = 0; pointer.y = 0;
        damped.x = 0; damped.y = 0;
        applyTracks();
        applyPlaneTransform(0, 0);
      } else {
        root.classList.remove("drift-wall--reduced");
        start();
      }
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMqChange);
      else if (mq.addListener) mq.addListener(onMqChange);
    }

    /* ---- 3g. Go ----------------------------------------------------------- */
    layout();
    if (!io) { visible = true; start(); }

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", queueLayout);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMqChange);
        else if (mq.removeListener) mq.removeListener(onMqChange);
      }
      root.removeEventListener(MOVE, onMove);
      root.removeEventListener(ENTER, onEnter);
      root.removeEventListener(LEAVE, onLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      if (plane && plane.parentNode) plane.parentNode.removeChild(plane);
      if (sr.parentNode) sr.parentNode.removeChild(sr);
      plane = null;
      tracks = [];
      root.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.driftWall = mount;

  /* ---- 4. Auto-init ------------------------------------------------------ */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-drift-wall]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-drift-wall");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
