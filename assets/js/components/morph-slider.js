/* ==========================================================================
   Lambda Phi Epsilon — Alpha Xi Chapter
   MorphSlider — vanilla port of the React Bits component of the same name.
   No dependencies. Works from file:// as well as a web server.

   The reference drives a single fullscreen triangle through OGL and GSAP; this
   port talks to raw WebGL1 and tweens with its own rAF, but the shader is the
   same idea and the same uniform set —

     tCurrent tNext uResolution uCurrentSize uNextSize uProgress uDir uMode
     uIntensity uScale uAberration uDrift uTime uReduce uPointer uOverlay

   — fbm melt displacement, a ripple centred on the pointer, sliced shear,
   swirl rotation, chromatic aberration riding the transition envelope,
   and a vignette mixed towards the overlay colour.

   FITTING, and the reason nothing is ever cropped: each plate is sampled
   twice. Once contain-fit, which is the whole photograph and never loses an
   edge; once cover-fit, blurred over nine taps and dimmed towards the overlay
   colour, which fills whatever the frame has left over. The sharp plate is
   composited over that ground on a feathered inside/outside test, so a
   portrait photograph in a landscape frame reads as a photograph on a soft
   plate rather than as a photograph with its head and feet cut off.

   CRITICAL, and the reason the section can never break: if a WebGL context
   cannot be had — or a texture upload is refused, which happens with file://
   images on some engines — the component silently rebuilds itself as a plain
   crossfading <img> slider with identical controls, captions and keyboard.
   ========================================================================== */
(function () {
  "use strict";

  window.LPHIE = window.LPHIE || {};
  window.LPHIE.components = window.LPHIE.components || {};

  /* ---- 1. Defaults ------------------------------------------------------- */
  /* Same prop names as the React component; durations in seconds, as there. */
  var DEFAULTS = {
    gallery: null,            /* key into window.LPHIE.galleries             */
    items: null,              /* or an inline [{image, caption, alt}]        */
    transition: "melt",       /* melt | ripple | shear | swirl               */
    duration: 1.1,            /* seconds                                    */
    intensity: 0.55,
    scale: 2.4,               /* noise frequency for melt                   */
    aberration: 0.35,
    drift: 0.4,
    autoplay: false,
    autoplayDelay: 5200,
    loop: true,
    overlayColor: "#0C1B38",  /* --navy-900 */
    showCaptions: true,
    showControls: true,
    showIndicators: true,
    label: "Chapter photographs"
  };

  var MODES = { melt: 0, ripple: 1, shear: 2, swirl: 3 };

  var NUMERIC = ["duration", "intensity", "scale", "aberration", "drift", "autoplayDelay"];
  var BOOLEAN = ["autoplay", "loop", "showCaptions", "showControls", "showIndicators"];

  var PREFIX = (function () {
    var d = document.documentElement.getAttribute("data-root");
    return d === null ? "" : d;
  })();

  /* ---- 2. Shaders -------------------------------------------------------- */
  var VERT = [
    "attribute vec2 aPosition;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = aPosition * 0.5 + 0.5;",
    "  gl_Position = vec4(aPosition, 0.0, 1.0);",
    "}"
  ].join("\n");

  var FRAG = [
    /* Not every GL ES 2 fragment stage has highp; ask for it, accept mediump. */
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "",
    "uniform sampler2D tCurrent;",
    "uniform sampler2D tNext;",
    "uniform vec2  uResolution;",
    "uniform vec2  uCurrentSize;",
    "uniform vec2  uNextSize;",
    "uniform float uProgress;",
    "uniform float uDir;",
    "uniform float uMode;",
    "uniform float uIntensity;",
    "uniform float uScale;",
    "uniform float uAberration;",
    "uniform float uDrift;",
    "uniform float uTime;",
    "uniform float uReduce;",
    "uniform vec2  uPointer;",
    "uniform vec3  uOverlay;",
    "",
    "varying vec2 vUv;",
    "",
    "const float PI = 3.14159265359;",
    "",
    "float hash(vec2 p) {",
    "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);",
    "}",
    "",
    "float noise(vec2 p) {",
    "  vec2 i = floor(p);",
    "  vec2 f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
    "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
    "}",
    "",
    "float fbm(vec2 p) {",
    "  float v = 0.0;",
    "  float a = 0.5;",
    "  for (int i = 0; i < 5; i++) {",
    "    v += a * noise(p);",
    "    p *= 2.02;",
    "    a *= 0.5;",
    "  }",
    "  return v;",
    "}",
    "",
    /* Cover fit: crop the long axis. Used ONLY for the blurred ground now. */
    "vec2 coverUv(vec2 uv, vec2 res, vec2 size) {",
    "  if (size.x < 1.0 || size.y < 1.0) return uv;",
    "  float rs = res.x / max(res.y, 1.0);",
    "  float ri = size.x / max(size.y, 1.0);",
    "  vec2 s = ri > rs ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);",
    "  return (uv - 0.5) * s + 0.5;",
    "}",
    "",
    /* Contain fit: the whole photograph, always. The sampled window is grown
       instead of shrunk, so coordinates run outside 0..1 exactly where the
       frame has space left over — that is what plateMask() then finds. */
    "vec2 containUv(vec2 uv, vec2 res, vec2 size) {",
    "  if (size.x < 1.0 || size.y < 1.0) return uv;",
    "  float rs = res.x / max(res.y, 1.0);",
    "  float ri = size.x / max(size.y, 1.0);",
    "  vec2 s = ri > rs ? vec2(1.0, rs / ri) : vec2(ri / rs, 1.0);",
    "  return (uv - 0.5) / s + 0.5;",
    "}",
    "",
    /* 1 inside the contained photograph, 0 outside, with a couple of pixels of
       feather between the two so the edge is a seam and not a cut. The scale
       vector converts texture-space distance back into stage units, which is
       what keeps the feather even on all four sides. */
    "float plateMask(vec2 uv, vec2 res, vec2 size) {",
    "  if (size.x < 1.0 || size.y < 1.0) return 1.0;",
    "  float rs = res.x / max(res.y, 1.0);",
    "  float ri = size.x / max(size.y, 1.0);",
    "  vec2 s = ri > rs ? vec2(1.0, rs / ri) : vec2(ri / rs, 1.0);",
    "  vec2 d = min(uv, vec2(1.0) - uv) * s;",
    "  return smoothstep(0.0, 0.0045, min(d.x, d.y));",
    "}",
    "",
    /* Tap spacing for the fake blur, in texture space. r is a stage-relative
       radius; dividing x by the stage aspect and then folding in the cover
       scale keeps the smear round on screen rather than stretched. */
    "vec2 blurStep(vec2 res, vec2 size, float r) {",
    "  float rs = res.x / max(res.y, 1.0);",
    "  vec2 s = vec2(1.0);",
    "  if (size.x >= 1.0 && size.y >= 1.0) {",
    "    float ri = size.x / max(size.y, 1.0);",
    "    s = ri > rs ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);",
    "  }",
    "  return vec2(r / max(rs, 0.001), r) * s;",
    "}",
    "",
    /* Nine fixed taps — a cross at full radius and an X at 0.62 of it. No
       loop, no mip, no derivatives; it only has to read as out of focus. */
    "vec3 blurred(sampler2D tex, vec2 uv, vec2 st) {",
    "  vec2 d = st * 0.62;",
    "  vec3 sum = texture2D(tex, clamp(uv, 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv + vec2(st.x, 0.0), 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv - vec2(st.x, 0.0), 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv + vec2(0.0, st.y), 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv - vec2(0.0, st.y), 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv + vec2(d.x, d.y), 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv - vec2(d.x, d.y), 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv + vec2(d.x, -d.y), 0.0, 1.0)).rgb;",
    "  sum += texture2D(tex, clamp(uv - vec2(d.x, -d.y), 0.0, 1.0)).rgb;",
    "  return sum / 9.0;",
    "}",
    "",
    /* Desaturate, dim towards the overlay colour, darken a shade: the ground
       has to read as a soft plate the photograph sits on, never as a second
       photograph competing with it. */
    "vec3 ground(vec3 c) {",
    "  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));",
    "  vec3 g = mix(c, vec3(l), 0.55);",
    "  g = mix(g, uOverlay, 0.62);",
    "  return g * 0.94;",
    "}",
    "",
    "vec2 rotate(vec2 uv, float a) {",
    "  vec2 c = uv - 0.5;",
    "  float s = sin(a), k = cos(a);",
    "  return vec2(c.x * k - c.y * s, c.x * s + c.y * k) + 0.5;",
    "}",
    "",
    "void main() {",
    "  vec2 uv = vUv;",
    "  float p = clamp(uProgress, 0.0, 1.0);",
    /* Envelope: nothing at either end, everything in the middle. */
    "  float env = sin(p * PI);",
    "  float amount = uIntensity * (1.0 - uReduce * 0.85);",
    "",
    "  vec2 offset = vec2(0.0);",
    "  vec2 uvA = uv;",
    "  vec2 uvB = uv;",
    "",
    /* --- melt: fbm displacement drifting slowly with uTime --------------- */
    "  if (uMode < 0.5) {",
    "    vec2 q = uv * uScale + vec2(uTime * uDrift * 0.05, -uTime * uDrift * 0.035);",
    "    float n = fbm(q);",
    "    float m = fbm(q + vec2(n * 0.8, p * 1.2));",
    "    offset = vec2((m - 0.5) * 0.55, (n - 0.5) * 0.9) * env * amount * 0.42;",
    "    offset.x += uDir * env * amount * 0.06;",
    "  }",
    /* --- ripple: rings running out from the pointer ---------------------- */
    "  else if (uMode < 1.5) {",
    "    vec2 d = uv - uPointer;",
    "    d.x *= uResolution.x / max(uResolution.y, 1.0);",
    "    float r = length(d);",
    "    float wave = sin(r * (10.0 + uScale * 3.0) - p * PI * 2.2) * exp(-r * 2.6);",
    "    offset = normalize(d + vec2(1e-5)) * wave * env * amount * 0.20;",
    "  }",
    /* --- shear: horizontal slices sliding past one another --------------- */
    "  else if (uMode < 2.5) {",
    "    float slices = 14.0 + floor(uScale * 3.0);",
    "    float row = floor(uv.y * slices) / slices;",
    "    float r = hash(vec2(row, 3.7)) - 0.5;",
    "    offset = vec2(r * env * amount * 0.85 * uDir, 0.0);",
    "  }",
    /* --- swirl: rotation falling off from the centre --------------------- */
    "  else {",
    "    float fallA = 1.0 - clamp(length(uv - 0.5) * 1.45, 0.0, 1.0);",
    "    float ang = env * amount * 1.9 * uDir * fallA;",
    "    uvA = rotate(uv, ang * p);",
    "    uvB = rotate(uv, -ang * (1.0 - p));",
    "  }",
    "",
    /* Outgoing plate is pushed away, incoming plate arrives from the other
       side; the drift term is the reference's lateral slide. */
    "  vec2 offA = offset * p + vec2(uDir * p * 0.05 * uDrift, 0.0);",
    "  vec2 offB = -offset * (1.0 - p) - vec2(uDir * (1.0 - p) * 0.05 * uDrift, 0.0);",
    "",
    /* The displacement is applied in stage space and clamped first; both fits
       are taken from that same displaced coordinate, so the photograph and its
       ground melt, ripple, shear and swirl together. */
    "  vec2 baseA = clamp(uvA + offA, -0.6, 1.6);",
    "  vec2 baseB = clamp(uvB + offB, -0.6, 1.6);",
    "",
    "  vec2 sampleA = containUv(baseA, uResolution, uCurrentSize);",
    "  vec2 sampleB = containUv(baseB, uResolution, uNextSize);",
    "",
    /* The ground is the same photograph, cover-fit and pushed in a further
       1.14x so the blur taps never reach the clamped texture edge. */
    "  vec2 bedA = (coverUv(baseA, uResolution, uCurrentSize) - 0.5) * 0.88 + 0.5;",
    "  vec2 bedB = (coverUv(baseB, uResolution, uNextSize) - 0.5) * 0.88 + 0.5;",
    "  vec3 bgA = ground(blurred(tCurrent, bedA, blurStep(uResolution, uCurrentSize, 0.038)));",
    "  vec3 bgB = ground(blurred(tNext, bedB, blurStep(uResolution, uNextSize, 0.038)));",
    "",
    /* Chromatic aberration, strongest at the middle of the transition. It
       rides the sharp photograph only; the ground stays clean. */
    "  float ab = uAberration * env * (1.0 - uReduce) * 0.012;",
    "  vec2 dirA = normalize(offA + vec2(1e-5));",
    "  vec2 dirB = normalize(offB + vec2(1e-5));",
    "",
    "  vec3 colA;",
    "  colA.r = texture2D(tCurrent, clamp(sampleA + dirA * ab, 0.0, 1.0)).r;",
    "  colA.g = texture2D(tCurrent, clamp(sampleA, 0.0, 1.0)).g;",
    "  colA.b = texture2D(tCurrent, clamp(sampleA - dirA * ab, 0.0, 1.0)).b;",
    "  colA = mix(bgA, colA, plateMask(sampleA, uResolution, uCurrentSize));",
    "",
    "  vec3 colB;",
    "  colB.r = texture2D(tNext, clamp(sampleB + dirB * ab, 0.0, 1.0)).r;",
    "  colB.g = texture2D(tNext, clamp(sampleB, 0.0, 1.0)).g;",
    "  colB.b = texture2D(tNext, clamp(sampleB - dirB * ab, 0.0, 1.0)).b;",
    "  colB = mix(bgB, colB, plateMask(sampleB, uResolution, uNextSize));",
    "",
    "  float mixer = smoothstep(0.0, 1.0, p);",
    "  vec3 col = mix(colA, colB, mixer);",
    "",
    /* Vignette mixed towards the overlay colour, so the plate sits in the
       page instead of glowing out of it. */
    "  float vig = smoothstep(1.05, 0.28, distance(vUv, vec2(0.5)));",
    "  col = mix(col, uOverlay, (1.0 - vig) * 0.40);",
    "  col = mix(col, uOverlay, env * 0.10);",
    "",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  /* ---- 3. Helpers -------------------------------------------------------- */
  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function now() {
    return (window.performance && window.performance.now)
      ? window.performance.now() : Date.now();
  }

  /* GSAP's two curves, by hand. */
  function power2InOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function power2Out(t) { return 1 - Math.pow(1 - t, 2); }

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

    if (!Object.prototype.hasOwnProperty.call(MODES, o.transition)) o.transition = DEFAULTS.transition;
    o.duration = clamp(o.duration, 0.15, 6);
    o.intensity = clamp(o.intensity, 0, 3);
    o.scale = clamp(o.scale, 0.2, 12);
    o.aberration = clamp(o.aberration, 0, 3);
    o.drift = clamp(o.drift, 0, 3);
    o.autoplayDelay = Math.max(1500, o.autoplayDelay);
    o.overlayColor = String(o.overlayColor || DEFAULTS.overlayColor);
    return o;
  }

  /* "#0C1B38" -> [r, g, b] in 0..1. Anything unparseable falls back to navy. */
  function hexToRgb(hex) {
    var s = String(hex).trim().replace(/^#/, "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) s = "0C1B38";
    return [
      parseInt(s.slice(0, 2), 16) / 255,
      parseInt(s.slice(2, 4), 16) / 255,
      parseInt(s.slice(4, 6), 16) / 255
    ];
  }

  /* Safe to drop inside url("…") in an inline style: percent-encode anything
     that could close the string or the function, and drop line breaks.
     encodeURIComponent is no use here — it leaves ( ) and ' alone. */
  var CSS_ESCAPES = { '"': "%22", "'": "%27", "(": "%28", ")": "%29", "\\": "%5C" };

  function cssUrl(src) {
    return String(src == null ? "" : src)
      .replace(/[\r\n]/g, "")
      .replace(/["'()\\]/g, function (ch) { return CSS_ESCAPES[ch]; });
  }

  function resolveImage(src) {
    var s = String(src == null ? "" : src).trim();
    if (!s) return "";
    if (s.indexOf("://") >= 0 || s.charAt(0) === "/") return s;
    if (s.indexOf("/") < 0) return PREFIX + "assets/img/gallery/" + s;
    return PREFIX + s;
  }

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
        alt: String(entry.alt == null ? (entry.caption || "") : entry.alt),
        caption: String(entry.caption == null ? "" : entry.caption)
      });
    }
    return out;
  }

  /* ---- 4. WebGL renderer -------------------------------------------------- */
  /* Returns null when anything at all goes wrong; the caller then falls back.
     Nothing in here throws upwards. */
  function createGL(canvas, items, cfg) {
    var gl = null, i;
    var attrs = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false };

    try {
      gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
    } catch (e) { gl = null; }
    if (!gl) return null;

    function compile(type, source) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    /* Fullscreen triangle — one primitive, no index buffer. */
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    var names = [
      "tCurrent", "tNext", "uResolution", "uCurrentSize", "uNextSize", "uProgress",
      "uDir", "uMode", "uIntensity", "uScale", "uAberration", "uDrift", "uTime",
      "uReduce", "uPointer", "uOverlay"
    ];
    for (i = 0; i < names.length; i++) U[names[i]] = gl.getUniformLocation(program, names[i]);

    gl.uniform1i(U.tCurrent, 0);
    gl.uniform1i(U.tNext, 1);
    var overlay = hexToRgb(cfg.overlayColor);
    gl.uniform3f(U.uOverlay, overlay[0], overlay[1], overlay[2]);
    gl.uniform1f(U.uMode, MODES[cfg.transition]);
    gl.uniform1f(U.uIntensity, cfg.intensity);
    gl.uniform1f(U.uScale, cfg.scale);
    gl.uniform1f(U.uAberration, cfg.aberration);
    gl.uniform1f(U.uDrift, cfg.drift);

    /* 4x4 dark placeholder so the first frame is never a white flash and an
       unloaded slot is never a black hole. */
    var placeholderPixels = (function () {
      var px = new Uint8Array(4 * 4 * 4);
      for (var k = 0; k < 16; k++) {
        px[k * 4] = Math.round(overlay[0] * 255);
        px[k * 4 + 1] = Math.round(overlay[1] * 255);
        px[k * 4 + 2] = Math.round(overlay[2] * 255);
        px[k * 4 + 3] = 255;
      }
      return px;
    })();

    var failed = false;
    var slots = [];
    var images = [];

    function makeTexture() {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      /* NPOT-safe from the first byte: clamped, linear, never mipmapped. */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderPixels);
      return tex;
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    for (i = 0; i < items.length; i++) slots.push({ tex: makeTexture(), w: 0, h: 0 });

    var onTextureReady = null;

    function load(i) {
      var img = new Image();
      /* crossOrigin only helps for genuinely remote files; asking for it on a
         file:// or same-origin image is what breaks local previews. */
      if (items[i].image.indexOf("://") >= 0) img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = function () {
        if (failed) return;
        try {
          gl.bindTexture(gl.TEXTURE_2D, slots[i].tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          slots[i].w = img.naturalWidth || img.width || 0;
          slots[i].h = img.naturalHeight || img.height || 0;
        } catch (err) {
          /* A refused upload (tainted canvas, typically file://) is fatal to
             the GL path but not to the component. */
          failed = true;
          if (onTextureReady) onTextureReady(true);
          return;
        }
        if (onTextureReady) onTextureReady(false);
      };
      img.onerror = function () { /* the placeholder simply stays */ };
      img.src = items[i].image;
      images.push(img);
    }

    for (i = 0; i < items.length; i++) load(i);

    var api = {
      kind: "webgl",
      hasFailed: function () { return failed; },
      onReady: function (fn) { onTextureReady = fn; },

      resize: function (w, h, dpr) {
        var pw = Math.max(1, Math.round(w * dpr));
        var ph = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        gl.viewport(0, 0, pw, ph);
        gl.uniform2f(U.uResolution, pw, ph);
      },

      draw: function (state) {
        if (failed) return;
        var a = slots[state.current] || slots[0];
        var b = slots[state.next] || a;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, a.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, b.tex);

        gl.uniform2f(U.uCurrentSize, a.w, a.h);
        gl.uniform2f(U.uNextSize, b.w, b.h);
        gl.uniform1f(U.uProgress, state.progress);
        gl.uniform1f(U.uDir, state.dir);
        gl.uniform1f(U.uTime, state.time);
        gl.uniform1f(U.uReduce, state.reduce ? 1 : 0);
        gl.uniform2f(U.uPointer, state.pointerX, state.pointerY);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },

      destroy: function () {
        for (var k = 0; k < images.length; k++) {
          images[k].onload = null;
          images[k].onerror = null;
        }
        images = [];
        try {
          for (k = 0; k < slots.length; k++) gl.deleteTexture(slots[k].tex);
          gl.deleteBuffer(buffer);
          gl.deleteProgram(program);
          var lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();
        } catch (e) { /* teardown is best-effort */ }
        slots = [];
      }
    };

    return api;
  }

  /* ---- 5. Mount ---------------------------------------------------------- */
  function mount(root, options) {
    if (!root) return function () {};

    var cfg = settings(options);
    var items = normalizeItems(cfg);
    var n = items.length;
    if (!n) return function () {};

    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var reduced = !!(mq && mq.matches);

    /* state */
    var current = 0;
    var next = 0;
    var dir = 1;
    var progress = 0;
    var t0 = now();
    var tween = null;            /* { from, to, t0, dur, ease }              */
    var rafId = null;
    var autoTimer = null;
    var pointerX = 0.5, pointerY = 0.5;
    var dragging = false;
    var dragId = null;
    var dragStartX = 0;
    var hovered = false, focusedIn = false, visible = true, destroyed = false;
    var renderer = null;
    var fallbackLayers = null;
    var dots = [];

    /* ---- 5a. Skeleton ---------------------------------------------------- */
    while (root.firstChild) root.removeChild(root.firstChild);
    root.classList.add("morph-slider");
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");
    if (!root.getAttribute("aria-label")) root.setAttribute("aria-label", cfg.label);
    root.style.setProperty("--ms-overlay", cfg.overlayColor);

    var stage = document.createElement("div");
    stage.className = "morph-slider__stage";
    stage.setAttribute("tabindex", "0");
    stage.setAttribute("aria-label", cfg.label + " — use the left and right arrow keys");
    root.appendChild(stage);

    var canvas = document.createElement("canvas");
    canvas.className = "morph-slider__canvas";
    canvas.setAttribute("aria-hidden", "true");
    stage.appendChild(canvas);

    var captionEl = null;
    if (cfg.showCaptions) {
      captionEl = document.createElement("p");
      captionEl.className = "morph-slider__caption";
      captionEl.textContent = items[0].caption;
      stage.appendChild(captionEl);
    }

    var controls = null, prevBtn = null, nextBtn = null, dotsWrap = null;
    if (cfg.showControls || cfg.showIndicators) {
      controls = document.createElement("div");
      controls.className = "morph-slider__controls";

      if (cfg.showControls) {
        prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.className = "morph-slider__arrow morph-slider__arrow--prev";
        prevBtn.setAttribute("aria-label", "Previous photograph");
        prevBtn.innerHTML = "<span aria-hidden=\"true\">&#8592;</span>";
        controls.appendChild(prevBtn);
      }

      if (cfg.showIndicators) {
        dotsWrap = document.createElement("div");
        dotsWrap.className = "morph-slider__dots";
        dotsWrap.setAttribute("role", "tablist");
        dotsWrap.setAttribute("aria-label", "Choose a photograph");
        for (var d = 0; d < n; d++) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "morph-slider__dot";
          dot.setAttribute("role", "tab");
          dot.setAttribute("data-index", String(d));
          dot.setAttribute("aria-label", items[d].caption || ("Photograph " + (d + 1)));
          dot.setAttribute("aria-selected", d === 0 ? "true" : "false");
          if (d === 0) dot.classList.add("is-current");
          dotsWrap.appendChild(dot);
          dots.push(dot);
        }
        controls.appendChild(dotsWrap);
      }

      if (cfg.showControls) {
        nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "morph-slider__arrow morph-slider__arrow--next";
        nextBtn.setAttribute("aria-label", "Next photograph");
        nextBtn.innerHTML = "<span aria-hidden=\"true\">&#8594;</span>";
        controls.appendChild(nextBtn);
      }

      root.appendChild(controls);
    }

    var live = document.createElement("p");
    live.className = "morph-slider__sr";
    live.setAttribute("aria-live", "polite");
    root.appendChild(live);

    /* ---- 5b. The plain-image fallback ------------------------------------ */
    /* Built either up front (no WebGL at all) or mid-flight (a refused
       texture). Same indices, same controls, same captions — and the same
       fitting contract as the shader: each plate is a contained <img>, showing
       the whole photograph, over a blurred cover-fit copy of itself. */
    function buildFallback() {
      if (fallbackLayers) return;
      root.classList.add("morph-slider--fallback");
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);

      fallbackLayers = [];
      /* Insert in item order and always beneath the caption. */
      var anchor = captionEl || null;
      for (var i = 0; i < n; i++) {
        var plate = document.createElement("div");
        plate.className = "morph-slider__plate";

        /* The ground: the same file as the plate above it, so the two share one
           request; CSS blurs, desaturates and dims it. Pointed at its photo
           only once the plate is first shown, which keeps the <img loading>
           policy above honest instead of quietly fetching the whole gallery. */
        var bed = document.createElement("span");
        bed.className = "morph-slider__bed";
        bed.setAttribute("aria-hidden", "true");
        plate.appendChild(bed);

        var img = document.createElement("img");
        img.className = "morph-slider__img";
        img.setAttribute("src", items[i].image);
        img.setAttribute("alt", i === 0 ? items[i].alt : "");
        img.setAttribute("loading", i === 0 ? "eager" : "lazy");
        img.setAttribute("decoding", "async");
        img.setAttribute("draggable", "false");
        plate.appendChild(img);

        if (i === current) plate.classList.add("is-current");
        if (anchor) stage.insertBefore(plate, anchor);
        else stage.appendChild(plate);
        fallbackLayers.push({ plate: plate, bed: bed, img: img, ground: false });
      }
      paintFallback();
    }

    function fillGround(layer, index) {
      if (!layer || layer.ground) return;
      layer.ground = true;
      layer.bed.style.backgroundImage = 'url("' + cssUrl(items[index].image) + '")';
    }

    function paintFallback() {
      if (!fallbackLayers) return;
      for (var i = 0; i < fallbackLayers.length; i++) {
        if (i === current) {
          fallbackLayers[i].plate.classList.add("is-current");
          fillGround(fallbackLayers[i], i);
        } else {
          fallbackLayers[i].plate.classList.remove("is-current");
        }
        fallbackLayers[i].img.setAttribute("alt", i === current ? items[i].alt : "");
      }
    }

    function goFallback() {
      if (renderer) { renderer.destroy(); renderer = null; }
      buildFallback();
      stopLoop();
    }

    /* ---- 5c. Chrome ------------------------------------------------------ */
    function syncChrome() {
      for (var i = 0; i < dots.length; i++) {
        dots[i].setAttribute("aria-selected", i === current ? "true" : "false");
        if (i === current) dots[i].classList.add("is-current");
        else dots[i].classList.remove("is-current");
      }
      if (captionEl) {
        captionEl.classList.add("is-swapping");
        captionEl.textContent = items[current].caption;
        requestAnimationFrame(function () {
          if (!destroyed && captionEl) captionEl.classList.remove("is-swapping");
        });
      }
      live.textContent = "Photograph " + (current + 1) + " of " + n +
        (items[current].caption ? ": " + items[current].caption : "");
    }

    /* ---- 5d. Loop -------------------------------------------------------- */
    function busy() { return !!tween || dragging; }

    function drawOnce() {
      if (destroyed) return;
      if (renderer) {
        if (renderer.hasFailed()) { goFallback(); return; }
        renderer.draw({
          current: current,
          next: next,
          progress: progress,
          dir: dir,
          time: (now() - t0) / 1000,
          reduce: reduced,
          pointerX: pointerX,
          pointerY: pointerY
        });
      }
    }

    function loop() {
      rafId = null;
      if (destroyed) return;

      if (tween) {
        var t = clamp((now() - tween.t0) / tween.dur, 0, 1);
        progress = tween.from + (tween.to - tween.from) * tween.ease(t);
        if (t >= 1) {
          progress = tween.to;
          var landed = tween.to;
          tween = null;
          if (landed >= 1) {
            current = next;
            progress = 0;
            syncChrome();
            paintFallback();
          } else {
            next = current;
          }
        }
      }

      drawOnce();
      if (busy()) rafId = requestAnimationFrame(loop);
    }

    function pump() {
      if (rafId === null && !destroyed) rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    }

    function durationMs(kind) {
      var base = reduced ? Math.min(cfg.duration, 0.28) : cfg.duration;
      return Math.max(90, base * 1000 * (kind === "settle" ? 0.7 : 1));
    }

    /* ---- 5e. Navigation --------------------------------------------------- */
    function targetIndex(delta) {
      var i = current + delta;
      if (cfg.loop) return ((i % n) + n) % n;
      return clamp(i, 0, n - 1);
    }

    function go(index, direction) {
      if (destroyed || n < 2) return;
      if (tween && tween.to >= 1) return;          /* let the current one land */
      if (index === current) return;

      next = index;
      dir = direction >= 0 ? 1 : -1;
      progress = progress || 0;

      /* The fallback has no shader to run: swap on a CSS crossfade instead. */
      if (!renderer) {
        current = next;
        progress = 0;
        syncChrome();
        paintFallback();
        restartAutoplay();
        return;
      }

      tween = {
        from: progress,
        to: 1,
        t0: now(),
        dur: durationMs("transition") * (1 - progress),
        ease: power2InOut
      };
      pump();
      restartAutoplay();
    }

    function step(delta) { go(targetIndex(delta), delta); }

    function goTo(i) {
      if (i === current) return;
      var forward = cfg.loop
        ? (((i - current) % n) + n) % n <= n / 2
        : i > current;
      go(i, forward ? 1 : -1);
    }

    /* ---- 5f. Pointer ------------------------------------------------------ */
    function trackPointer(e) {
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      pointerY = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
      /* At rest the envelope is zero, so the pointer changes nothing on
         screen and the frame can be skipped entirely. */
      if (!busy() && progress > 0) drawOnce();
    }

    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (!renderer || n < 2) return;
      if (tween) return;
      dragging = true;
      dragId = e.pointerId;
      dragStartX = e.clientX;
      stopAutoplay();
      root.classList.add("is-dragging");
      if (stage.setPointerCapture && e.pointerId !== undefined) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      }
      pump();
    }

    function onMove(e) {
      trackPointer(e);
      if (!dragging) return;
      if (dragId !== null && e.pointerId !== undefined && e.pointerId !== dragId) return;

      var rect = stage.getBoundingClientRect();
      var dx = e.clientX - dragStartX;

      /* The first decisive movement chooses the direction and the incoming
         slide; after that the drag simply scrubs uProgress. */
      var wantDir = dx < 0 ? 1 : -1;
      if (!tween && (dir !== wantDir || next === current)) {
        dir = wantDir;
        next = targetIndex(wantDir);
      }
      progress = clamp(Math.abs(dx) / Math.max(160, rect.width * 0.75), 0, 0.96);
      if (e.cancelable) e.preventDefault();
    }

    function onUp(e) {
      if (!dragging) return;
      if (dragId !== null && e && e.pointerId !== undefined && e.pointerId !== dragId) return;
      dragging = false;
      dragId = null;
      root.classList.remove("is-dragging");

      if (next === current) { progress = 0; drawOnce(); restartAutoplay(); return; }

      var commit = progress > 0.32;
      tween = {
        from: progress,
        to: commit ? 1 : 0,
        t0: now(),
        dur: durationMs("settle") * Math.max(0.35, commit ? (1 - progress) : progress),
        ease: power2Out
      };
      pump();
      restartAutoplay();
    }

    function onKey(e) {
      var k = e.key;
      if (k === "ArrowLeft" || k === "Left") { e.preventDefault(); step(-1); }
      else if (k === "ArrowRight" || k === "Right") { e.preventDefault(); step(1); }
      else if (k === "Home") { e.preventDefault(); goTo(0); }
      else if (k === "End") { e.preventDefault(); goTo(n - 1); }
    }

    function onDotClick(e) {
      var el = e.target && e.target.closest ? e.target.closest(".morph-slider__dot") : null;
      if (!el) return;
      var i = parseInt(el.getAttribute("data-index"), 10);
      if (!isNaN(i)) goTo(i);
    }

    /* ---- 5g. Autoplay ----------------------------------------------------- */
    function stopAutoplay() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    }

    function canAutoplay() {
      return cfg.autoplay && !destroyed && visible && !hovered &&
        !focusedIn && !dragging && n > 1 && !reduced;
    }

    function restartAutoplay() {
      stopAutoplay();
      if (!canAutoplay()) return;
      autoTimer = setTimeout(function () {
        autoTimer = null;
        if (!canAutoplay()) return;
        if (!cfg.loop && current === n - 1) return;
        step(1);
        restartAutoplay();
      }, cfg.autoplayDelay);
    }

    /* ---- 5h. Sizing -------------------------------------------------------- */
    function resize() {
      if (destroyed || !renderer) return;
      var rect = stage.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!rect.width || !rect.height) return;
      renderer.resize(rect.width, rect.height, dpr);
      drawOnce();
    }

    /* ---- 5i. Boot ---------------------------------------------------------- */
    renderer = createGL(canvas, items, cfg);
    if (!renderer) {
      goFallback();
    } else {
      renderer.onReady(function (didFail) {
        if (destroyed) return;
        if (didFail) { goFallback(); return; }
        if (!busy()) drawOnce();
      });
      resize();
      drawOnce();
    }

    /* ---- 5j. Wiring --------------------------------------------------------- */
    var hasPointer = !!window.PointerEvent;
    var DOWN = hasPointer ? "pointerdown" : "mousedown";
    var MOVE = hasPointer ? "pointermove" : "mousemove";
    var UP = hasPointer ? "pointerup" : "mouseup";
    var CANCEL = hasPointer ? "pointercancel" : "mouseleave";

    stage.addEventListener(DOWN, onDown);
    stage.addEventListener(MOVE, onMove, { passive: false });
    window.addEventListener(UP, onUp);
    stage.addEventListener(CANCEL, onUp);
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

    function onContextLost(e) {
      e.preventDefault();
      goFallback();
    }
    canvas.addEventListener("webglcontextlost", onContextLost);

    var ro = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(function () { resize(); });
      ro.observe(stage);
    } else {
      window.addEventListener("resize", resize);
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
      if (reduced) stopAutoplay(); else restartAutoplay();
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", onMqChange);
      else if (mq.addListener) mq.addListener(onMqChange);
    }

    live.textContent = "Photograph 1 of " + n +
      (items[0].caption ? ": " + items[0].caption : "");
    restartAutoplay();

    return function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      stopAutoplay();
      stage.removeEventListener(DOWN, onDown);
      stage.removeEventListener(MOVE, onMove);
      window.removeEventListener(UP, onUp);
      stage.removeEventListener(CANCEL, onUp);
      stage.removeEventListener("keydown", onKey);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (dotsWrap) dotsWrap.removeEventListener("click", onDotClick);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
      if (io) io.disconnect();
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", onMqChange);
        else if (mq.removeListener) mq.removeListener(onMqChange);
      }
      if (renderer) { renderer.destroy(); renderer = null; }
      while (root.firstChild) root.removeChild(root.firstChild);
      dots = [];
      fallbackLayers = null;
      root.classList.remove("morph-slider", "morph-slider--fallback", "is-dragging");
      root.removeAttribute("data-lphie-mounted");
    };
  }

  window.LPHIE.components.morphSlider = mount;

  /* ---- 6. Auto-init ------------------------------------------------------- */
  function autoInit() {
    var nodes = document.querySelectorAll("[data-morph-slider]");
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.getAttribute("data-lphie-mounted")) return;
      node.setAttribute("data-lphie-mounted", "1");
      var raw = node.getAttribute("data-morph-slider");
      var opts = {};
      if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }
      mount(node, opts);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoInit);
  else autoInit();
})();
