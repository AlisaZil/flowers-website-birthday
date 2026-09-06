/* ------------------------------------------------------------------
   Flower birthday card
   ------------------------------------------------------------------ */

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var STAGE_W = 886;
  var STAGE_H = 1536;

  var stage     = document.getElementById('stage');
  var bed       = document.getElementById('bed');
  var bedFront  = document.getElementById('bedFront');
  var nameEl    = document.getElementById('name');

  /* --- loading -------------------------------------------------------
     The bed reuses a dozen sprites across ~300 <img> tags, so the real
     wait is those twelve files plus the note. We preload exactly those
     and drive the bar off how many have actually decoded. */

  var loader     = document.getElementById('loader');
  var loaderFill = document.getElementById('loaderFill');
  var loaderBar  = document.getElementById('loaderBar');
  var loaderGirl = document.getElementById('loaderGirl');

  /* The nudge waits until the flowers have been played with, then gives
     it a couple of seconds before speaking up. If nobody moves a pointer
     — a touch screen, or someone just sitting still — it appears anyway. */
  var HINT_AFTER_PLAY_MS = 2000;   // after they first make a flower move
  var HINT_FALLBACK_MS   = 6000;   // if a pointer is there but never used
  var HINT_TOUCH_MS      = 2600;   // phone and tablet: a beat after the
                                   // slower bed fade has finished settling
  var MIN_SHOW_MS = 650;    // don't let the loader flash past on a warm cache
  var started     = Date.now();

  document.body.classList.add('loading');

  var ASSETS = ['assets/img/ui/note-blank.png', 'assets/img/ui/girl.png'];
  for (var n = 1; n <= 12; n++) {
    ASSETS.push('assets/img/flowers/f' + (n < 10 ? '0' : '') + n + '.png');
  }

  if (loaderGirl) {
    if (loaderGirl.complete) loaderGirl.classList.add('ready');
    else loaderGirl.addEventListener('load', function () {
      loaderGirl.classList.add('ready');
    });
  }

  /* --- the nudge ----------------------------------------------------- */

  var hintTimer  = null;
  var hintShown  = false;
  var hintQueued = false;
  var hintPending = false;   // armHint asked for before the words arrived

  function showHint() {
    if (hintShown) return;
    hintShown = true;
    clearTimeout(hintTimer);
    var h = document.getElementById('hint');
    if (h) h.classList.add('show');
  }

  /* On a phone or tablet there is no pointer to play the flowers with,
     so the nudge simply arrives a second in. With a mouse it waits to be
     earned, and the long stop covers someone who never moves it. */
  function armHint() {
    // no point inviting a click while the note is still loading
    if (!noteReady) { hintPending = true; return; }
    var delay = hoverWanted() ? HINT_FALLBACK_MS : HINT_TOUCH_MS;
    hintTimer = setTimeout(showHint, delay);
  }

  // the first time a bloom opens under the pointer, start the short one
  function notePlayed() {
    if (hintShown || hintQueued) return;
    hintQueued = true;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(showHint, HINT_AFTER_PLAY_MS);
  }

  var doneCount = 0;

  function assetSettled() {
    doneCount++;
    var pct = Math.round(100 * doneCount / ASSETS.length);
    if (loaderFill) loaderFill.style.width = pct + '%';
    if (loaderBar)  loaderBar.setAttribute('aria-valuenow', String(pct));
    if (doneCount === ASSETS.length) finish();
  }

  function finish() {
    var wait = Math.max(0, MIN_SHOW_MS - (Date.now() - started));
    setTimeout(function () {
      // the blooms only have a height once their sprite has decoded, so the
      // hover index has to be measured now rather than at plant time
      document.body.classList.remove('loading');
      document.body.classList.add('ready');    // fades the bed up

      imagesReady = true;
      bakeBed();
      buildIndex();
      // armed after the heavy work, so the wait is a real one and not
      // stretched by the bake and the index build
      armHint();
      // the bed fades in from a slight scale-up, so its rects are not
      // final yet — measure again once that has finished
      setTimeout(buildIndex, 1400);
      if (!loader) return;
      loader.classList.add('done');
      setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 600);
    }, wait);
  }

  var IMG_CACHE = {};

  ASSETS.forEach(function (src) {
    var im = new Image();
    im.decoding = 'async';
    im.onload = im.onerror = assetSettled;   // a broken file must not hang it
    im.src = src;
    IMG_CACHE[src] = im;
  });

  /* --- the name ---------------------------------------------------- */

  var wanted = new URLSearchParams(location.search).get('name');
  if (wanted) nameEl.textContent = wanted.trim();

  /* --- scale the stage to fit the viewport ------------------------- */

  var scale = 1, vw = 0, vh = 0;

  /* Content height budget. The note and the prompt together only need
     about 900 design-units of height, so scaling against that (rather
     than the full 1536) keeps the card a sensible size on a short, wide
     window while the bed simply runs on to fill whatever is left. On a
     9:16 window this lands back on scale 1 and reproduces the artwork. */
  var CONTENT_H = 900;

  /* Measured off the stage's own box rather than the document. The bed
     now spans 100lvh, which on iOS is taller than the visible area — read
     the document height instead and the bottom strip, the part hiding
     behind the toolbar, would be planted with no flowers. */
  var viewportEl = document.querySelector('.viewport');

  function measure() {
    var box = viewportEl && viewportEl.getBoundingClientRect();

    vw = (box && Math.round(box.width))  ||
         document.documentElement.clientWidth  || window.innerWidth;
    vh = (box && Math.round(box.height)) ||
         document.documentElement.clientHeight || window.innerHeight;

    scale = Math.min(vw / STAGE_W, vh / CONTENT_H);
  }

  function fit() {
    var before = vw + 'x' + vh;
    measure();
    document.documentElement.style.setProperty('--s', String(scale));
    // the bed is laid out in window pixels, so it has to be replanted
    if (before !== vw + 'x' + vh) {
      var wasOpen = opened;
      opened = false;                // the old elements are about to go
      plantBed();
      requestAnimationFrame(function () {
        buildIndex();
        // re-open the fresh blooms straight away, with no animation, so a
        // resize never looks like the flowers closing and opening again
        if (wasOpen) setOpen(true);
      });
    }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  // web fonts and the flower images can land after first paint
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  var opened = false;
  var lifted = [];   // the blooms that were carried outward

  /* --- deterministic randomness ------------------------------------
     A fixed seed keeps the bed identical on every load, so the card
     always looks like the same card.                                  */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rand = mulberry32(20260902);

  function between(lo, hi) { return lo + rand() * (hi - lo); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

  /* --- the blooms --------------------------------------------------
     f01-f08 are the open flowers; the face-on ones (01,02,04) read as
     the filler between the three quarter blooms that carry the stems. */

  var FACE_ON  = ['f01', 'f02', 'f04'];
  var SIDE_ON  = ['f03', 'f05', 'f06', 'f07', 'f08'];

  /* The side-on sprites are cut off at the stem, which reads as a loose
     green end if it lands in the open. For each one we work out where
     that end actually falls and tuck a face-on bloom over it.
     ar = height/width of the sprite, tip = the cut end in sprite fractions. */
  var TIPS = {
    f03: { ar: 0.891, tip: [0.411, 0.993] },
    f05: { ar: 0.977, tip: [0.079, 0.899] },
    f06: { ar: 1.097, tip: [0.007, 0.908] },
    f07: { ar: 0.907, tip: [0.741, 0.990] },
    f08: { ar: 1.148, tip: [0.072, 0.994] }
  };

  function makeBloom(opts) {
    var el  = document.createElement('div');
    var img = document.createElement('img');

    img.src = 'assets/img/flowers/' + opts.variant + '.png';
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';   // keeps decoding off the main thread
    img.style.filter =
      'drop-shadow(0 6px 10px rgba(190,66,96,.22)) ' +
      'hue-rotate(' + opts.hue.toFixed(1) + 'deg) ' +
      'brightness(' + opts.bright.toFixed(3) + ') ' +
      'saturate(' + opts.sat.toFixed(3) + ')';

    el.className = 'bloom';
    el.style.width = opts.w.toFixed(1) + 'px';
    el.style.left  = (opts.x - opts.w / 2).toFixed(1) + 'px';
    el.style.top   = (opts.y - opts.w / 2).toFixed(1) + 'px';
    el.style.transform = 'rotate(' + opts.rot.toFixed(1) + 'deg)';
    el.style.zIndex = String(opts.z);
    el._rot = opts.rot;

    el.appendChild(img);
    return el;
  }

  function bloomOpts(x, y, w, z, variants) {
    return {
      x: x, y: y, w: w, z: z,
      variant: pick(variants),
      rot:    between(-26, 26),
      hue:    between(-7, 7),
      bright: between(0.93, 1.07),
      sat:    between(0.92, 1.10)
    };
  }

  /* A cover has to travel with the bloom whose stem it hides, or the end
     it was hiding slides back into view the moment anything moves. */

  function pair(owner, coverEl, frag) {
    coverEl._coverFor = owner;
    owner._cover = coverEl;
    frag.appendChild(coverEl);
  }

  /* --- the breeze -----------------------------------------------------
     A share of the blooms lean together on one shared cycle, so the bed
     reads as one gust passing over rather than flowers fidgeting on their
     own. It rides on the <img>, leaving the wrapper's transform to the
     hover swell, which is untouched.

     The count is deliberately small. Every moving bloom forces the
     overlapping bed around it to be re-blended, and past roughly thirty
     the page stops holding 60fps. Stemmed blooms sit it out — one
     drifting away from the bloom hiding its cut end would show green. */

  /* Eighteen is where the page still holds a clean 60fps with no long
     frames at all; at 24 and 30 the median holds but stalls creep in.
     Fewer movers, each leaning a little further, buys the same read. */
  var SWAY_COUNT = 18;

  function markSway(els) {
    if (!els.length) return;
    var step = Math.max(1, els.length / SWAY_COUNT);

    for (var i = 0, taken = 0; taken < SWAY_COUNT && i < els.length; taken++) {
      var el = els[Math.floor(i)];
      var img = el.firstChild;
      i += step;
      if (!img) continue;

      el.classList.add('sway');
      // same phase and speed for all of them; only how far each leans
      // varies, so the movement reads as wind rather than noise
      // how far it leans also costs frames — a bigger sweep dirties more
      // of the bed around it — so this stays gentle
      img.style.setProperty('--ax', between(0.7, 1.5).toFixed(2) + '%');
      img.style.setProperty('--ar', between(0.6, 1.3).toFixed(2) + 'deg');
    }
  }

  /* --- the breeze ----------------------------------------------------
     Every swaying bloom gets its own duration, phase and amplitude, so
     the bed never moves as one. It rides on the <img>, leaving the
     wrapper's transform free for the hover swell and the page turn, and
     it pivots near the base so the head sways rather than the whole
     picture drifting. Bigger blooms read as nearer, so they move a
     little more than the small ones behind them. */

  /* How many of the live blooms sway. Measured on this bed: up to ~45
     swaying at once is indistinguishable from static (60fps, no long
     frames); past ~70 the slow frames roughly double, because moving one
     bloom forces the overlapping ones around it to be re-blended. Raise
     it if you want a busier breeze and can live with that. */
  var WIND_SHARE = 0.25;

  function windVars(w, extra) {
    // 0 for the smallest blooms in the bed, 1 for the largest
    var near = Math.min(1, Math.max(0, (w / scale - 236) / (415 - 236)));
    var amp  = (0.72 + near * 0.5) * (extra || 1);

    return {
      '--wind-duration': between(4, 7).toFixed(2) + 's',
      // a negative delay drops each one in mid-cycle, so they never
      // start together
      '--wind-delay':    (-between(0, 7)).toFixed(2) + 's',
      // the foreground multiplier must not push past the brief's ceilings
      '--wind-angle':    Math.min(1.5, between(0.8, 1.5) * amp).toFixed(2) + 'deg',
      '--wind-distance': Math.min(3, Math.max(1, between(1, 3) * amp)).toFixed(2) + 'px'
    };
  }

  function applyWind(el, vars) {
    var img = el.firstChild;
    if (!img) return;
    el.classList.add('wind');
    for (var k in vars) img.style.setProperty(k, vars[k]);
    el._wind = vars;
  }

  /* Where a placed bloom's stem end lands on the page, after its own
     rotation, and a face-on bloom sized to sit over it. */

  function stemCover(o) {
    var t = TIPS[o.variant];
    if (!t) return null;

    var W = o.w, H = W * t.ar;
    var X = o.x - W / 2, Y = o.y - W / 2;   // matches makeBloom's placement
    var cx = o.x, cy = Y + H / 2;           // the element rotates about this

    var tx = X + t.tip[0] * W;
    var ty = Y + t.tip[1] * H;

    var a = o.rot * Math.PI / 180;
    var cos = Math.cos(a), sin = Math.sin(a);
    var rx = cx + (tx - cx) * cos - (ty - cy) * sin;
    var ry = cy + (tx - cx) * sin + (ty - cy) * cos;

    // carry on a little past the end so it is buried, not just met
    var dx = rx - cx, dy = ry - cy;
    var d = Math.hypot(dx, dy) || 1;
    var push = W * 0.14;

    var c = bloomOpts(rx + dx / d * push, ry + dy / d * push,
                      W * between(0.76, 0.94), 0, FACE_ON);
    // where the stem end sits relative to the bloom's own centre: when the
    // bloom scales, the end travels by this much and the cover must follow
    c.tipVec = { x: dx, y: dy };
    return c;
  }

  /* Rows are drawn top to bottom and stack in that order, so each row
     overlaps the one above it the way a real bed of carnations does. */

  /* The bed covers the whole window. Blooms are sized by the card's own
     scale, so the field reads as one continuous bed with the blooms that
     sit in front of the note. */

  /* Two passes: a coarse underlayer of big blooms that guarantees no
     ground shows through, then a tighter pass on top of it. The blooms
     overlap heavily, the way a packed bed of carnations does. */

  var PASSES = [
    { col: 238, row: 203, lo: 330, hi: 415, jit: 36 },  // underlayer
    { col: 186, row: 157, lo: 288, hi: 366, jit: 31 }   // top layer
  ];

  /* The underlayer exists only to make sure no ground shows through — it
     is almost entirely hidden behind the top pass, so it never needs to be
     hoverable. Those blooms get flattened into one painted canvas instead
     of ~120 filtered <img> elements, which is most of the paint cost gone. */

  var bakeOps = [];

  function plantBed() {
    rand = mulberry32(20260902);     // same bed on every load and resize

    var frag = new DocumentFragment();
    var bleed = 340 * scale;         // overhang so no edge is ever bare
    var covers = [];
    var swayable = [];               // stemless live blooms, in field order
    var z = 1;

    bakeOps = [];

    PASSES.forEach(function (pass, pi) {
      var bake = (pi === 0);          // pass 0 is the buried underlayer
      var rowStep = pass.row * scale;
      var colStep = pass.col * scale;
      // offset the second pass so its centres land in the first one's seams
      var seam = pi ? colStep * 0.5 : 0;

      for (var row = 0, y = -bleed + seam; y < vh + bleed; row++, y += rowStep) {
        // stagger every other row so the packing never grids up
        var offset = (row % 2 ? colStep * 0.5 : 0) + between(-24, 24) * scale;

        for (var x = -bleed + offset + seam; x < vw + bleed; x += colStep) {
          var size = between(pass.lo, pass.hi) * scale;
          var jx = x + between(-pass.jit, pass.jit) * scale;
          var jy = y + between(-pass.jit, pass.jit) * scale;

          // sprinkle the stemmed blooms through the face-on ones
          var variants = rand() < 0.42 ? SIDE_ON : FACE_ON;

          var o = bloomOpts(jx, jy, size, z++, variants);

          if (bake) {
            bakeOps.push(o);
            var bc = stemCover(o);
            if (bc) covers.push({ opts: bc, bake: true });
            continue;
          }

          var el = makeBloom(o);
          frag.appendChild(el);

          if (rand() < WIND_SHARE) applyWind(el, windVars(o.w));

          var cover = stemCover(o);
          if (cover) { cover.owner = el; el._tipVec = cover.tipVec; covers.push({ opts: cover }); }
          else swayable.push(el);
        }
      }
    });

    // covers go on last, above everything, so no stem end survives. A
    // buried bloom's cover is baked right behind it, in the same order.
    covers.forEach(function (c) {
      c.opts.z = z++;
      if (c.bake) { bakeOps.push(c.opts); return; }
      var coverEl = makeBloom(c.opts);
      // same numbers as its owner, or the cut stem end would slide out
      if (c.opts.owner._wind) applyWind(coverEl, c.opts.owner._wind);
      pair(c.opts.owner, coverEl, frag);
    });

    // picked evenly through the field so the gust is spread across it,
    // and all classed in the same frame so they start in phase
    markSway(swayable);

    bed.textContent = '';
    bed.appendChild(frag);
    bakeBed();
  }

  /* --- painting the buried blooms ------------------------------------ */

  var baked = document.getElementById('bedBaked');
  var imagesReady = false;

  function bakeBed() {
    if (!baked || !imagesReady || !bakeOps.length) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    baked.width  = Math.round(vw * dpr);
    baked.height = Math.round(vh * dpr);

    var ctx = baked.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    bakeOps.forEach(function (o) {
      var img = IMG_CACHE['assets/img/flowers/' + o.variant + '.png'];
      if (!img || !img.naturalWidth) return;

      var w = o.w;
      var h = w * (img.naturalHeight / img.naturalWidth);
      // mirrors makeBloom's placement: left/top from the width, rotation
      // about the element's own centre
      var cx = o.x;
      var cy = o.y - w / 2 + h / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(o.rot * Math.PI / 180);
      ctx.filter =
        'drop-shadow(0 6px 10px rgba(190,66,96,.22)) ' +
        'hue-rotate(' + o.hue.toFixed(1) + 'deg) ' +
        'brightness(' + o.bright.toFixed(3) + ') ' +
        'saturate(' + o.sat.toFixed(3) + ')';
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
  }

  /* A few blooms sit in front of the note, overlapping its lower edge,
     so the card reads as tucked down into the flowers. */

  /* offsets from the centre of the note */
  var FRONT = [
    { x: -208, y: 210, w: 302, v: 'f05', rot: -14 },  // over the note's lower left
    { x:   80, y: 262, w: 330, v: 'f03', rot:   6 },  // over the note's lower edge
    { x: -342, y: 136, w: 272, v: 'f06', rot: -24 },  // left of the note
    { x:  350, y: 200, w: 292, v: 'f08', rot:  18 }   // right of the note
  ];

  function plantFront() {
    var frag = new DocumentFragment();
    var covers = [];
    var z = 1;

    FRONT.forEach(function (f) {
      var o = {
        x: f.x, y: f.y, w: f.w, z: z++,
        variant: f.v,
        rot: f.rot,
        hue: between(-5, 5),
        bright: between(0.95, 1.05),
        sat: between(0.95, 1.06)
      };
      var el = makeBloom(o);
      frag.appendChild(el);
      applyWind(el, windVars(o.w, 1.25));

      var cover = stemCover(o);
      if (cover) { cover.owner = el; el._tipVec = cover.tipVec; covers.push(cover); }
    });

    covers.forEach(function (c) {
      c.z = z++;
      var coverEl = makeBloom(c);
      if (c.owner._wind) applyWind(coverEl, c.owner._wind);
      pair(c.owner, coverEl, frag);
    });

    bedFront.appendChild(frag);
  }

  measure();
  fit();
  plantBed();
  plantFront();

  /* --- bloom under the pointer ---------------------------------------
     One throttled listener over a coarse spatial grid. Attaching handlers
     to every bloom, or hit-testing the DOM on each move, is what makes a
     field this size feel heavy. */

  var SWELL      = 1.075;   // how far a bloom opens
  var HOLD_MS    = 240;     // how long it stays open
  var SETTLE_MS  = 420;     // matches the CSS transition
  var CELL       = 100;     // spatial grid, in px
  var HOVER_MIN_W = 768;    // below this we treat it as phone view

  var grid = null;

  function buildIndex() {
    grid = {};
    [bed, bedFront].forEach(function (layer) {
      var els = layer.getElementsByClassName('bloom');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el._coverFor) continue;                 // covers follow their owner
        var r = el.getBoundingClientRect();
        if (!r.width) continue;
        var item = {
          el: el,
          x: r.left + window.scrollX + r.width / 2,
          y: r.top + window.scrollY + r.height / 2,
          // the bloom's core, rather than its whole bounding box
          rad: Math.min(r.width, r.height) * 0.34
        };
        var cx = Math.floor(item.x / CELL), cy = Math.floor(item.y / CELL);
        var key = cx + ',' + cy;
        (grid[key] || (grid[key] = [])).push(item);
      }
    });
  }

  function shape(el, k) {
    el.style.transform = 'rotate(' + el._rot.toFixed(1) + 'deg) scale(' + k + ')';

    var cover = el._cover;
    if (!cover) return;
    // carry the cover out along the stem by exactly as far as the end moved
    var v = el._tipVec;
    var dx = v.x * (k - 1), dy = v.y * (k - 1);
    cover.style.transform =
      'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) ' +
      'rotate(' + cover._rot.toFixed(1) + 'deg) scale(' + k + ')';
  }

  function promote(el, on) {
    el.classList.toggle('swell', on);
    if (el._cover) el._cover.classList.toggle('swell', on);
  }

  function bloomOne(item) {
    if (opened) return;          // the bed has opened; nothing may move it
    var el = item.el;

    notePlayed();   // the nudge waits on this

    if (el._hold) clearTimeout(el._hold);
    if (el._settle) clearTimeout(el._settle);

    promote(el, true);
    shape(el, SWELL);

    el._hold = setTimeout(function () {
      shape(el, 1);
      el._settle = setTimeout(function () {
        promote(el, false);
        el.style.transform = 'rotate(' + el._rot.toFixed(1) + 'deg)';
        if (el._cover) {
          el._cover.style.transform =
            'rotate(' + el._cover._rot.toFixed(1) + 'deg)';
        }
        el._hold = el._settle = null;
      }, SETTLE_MS);
    }, HOLD_MS);
  }

  /* A narrow desktop window still reports a fine pointer, so the media
     query alone is not enough to keep this off in phone view. */
  function hoverWanted() {
    return vw >= HOVER_MIN_W &&
           window.matchMedia('(hover: hover)').matches &&
           window.matchMedia('(pointer: fine)').matches;
  }

  function touch(px, py) {
    if (!grid || opened || !hoverWanted()) return;
    var cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);

    for (var gx = cx - 1; gx <= cx + 1; gx++) {
      for (var gy = cy - 1; gy <= cy + 1; gy++) {
        var cell = grid[gx + ',' + gy];
        if (!cell) continue;
        for (var i = 0; i < cell.length; i++) {
          var it = cell[i];
          if (Math.hypot(px - it.x, py - it.y) < it.rad) bloomOne(it);
        }
      }
    }
  }

  var pending = null;

  function onMove(e) {
    pending = { x: e.clientX, y: e.clientY };
    if (onMove.queued) return;
    onMove.queued = true;
    requestAnimationFrame(function () {
      onMove.queued = false;
      if (pending) touch(pending.x + window.scrollX, pending.y + window.scrollY);
    });
  }

  // touch devices never get here; hoverWanted() also covers a desktop
  // window dragged down to phone width
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', onMove, { passive: true });
  }

  /* --- blooming as you slide down ------------------------------------
     The blooms around the note swell and drift apart as the page scrolls
     towards the letter, and settle back if you scroll up again. Only the
     live blooms take part; the painted underlayer stays put behind them,
     so what opens up is more flowers rather than bare ground. */

  var EDGE_OVERLAP = 18;      // how far petals may still lap over the card
  var SOLID = 0.40;           // the sprite's painted part, as a share of its box
  var OUTER_DRIFT = 40;       // blooms already clear ease outward a touch

  /* The flowers open outward from the middle, far enough to uncover the
     card waiting behind them, and then stay where they land. Each bloom
     lying over the card is carried out along the line from the centre, so
     what opens is the shape of the card itself; a little overlap is left
     so petals still lap over its edges as it appears. */
  /* The flowers open once per page load and stay open. Asking them to
     close is ignored, so they never travel back and the reveal is never
     replayed — a second click cannot restart it. */
  function setOpen(on) {
    if (!on || opened) return;
    opened = true;
    document.body.classList.add('opening');
    applyBloom();
  }

  function applyBloom() {
    lifted = [];

    var cardEl = document.querySelector('.note-panel .sheet');
    if (!cardEl || !cardEl.offsetWidth) return;

    var r0 = cardEl.getBoundingClientRect();
    var cx = r0.left + r0.width / 2;
    var cy = r0.top + r0.height / 2;

    /* The card is still at scale(.96) while it surfaces, so its rect now
       is smaller than where it settles — work from the layout size, or the
       flowers clear a card that then grows back out from under them. */
    var aw = cardEl.offsetWidth;
    var ah = cardEl.offsetHeight;

    var halfW = Math.max(20, aw / 2 - EDGE_OVERLAP);
    var halfH = Math.max(20, ah / 2 - EDGE_OVERLAP);
    var L = cx - halfW, R = cx + halfW, T = cy - halfH, B = cy + halfH;

    /* The heading sits barely a dozen pixels inside the card — well
       within the overlap the petals are allowed — so the top edge moves
       up to clear it. The sides and foot keep their lapping. */
    var head = document.querySelector('.note-panel .sheet-head');
    if (head) {
      var hr = head.getBoundingClientRect();
      if (hr.height) T = Math.min(T, hr.top - 8);
    }

    cx = (L + R) / 2;  cy = (T + B) / 2;
    halfW = (R - L) / 2;  halfH = (B - T) / 2;

    /* The button below the card must be uncovered as well, but folding it
       into the same rectangle made that rectangle nearly as tall as the
       screen — and then the flowers had nowhere to go and sat on it. It
       is kept as a second, small box to clear instead. */
    var keepClear = [{ l: L, r: R, t: T, b: B }];
    var onward = document.querySelector('.note-panel .page-btn');
    if (onward) {
      var br = onward.getBoundingClientRect();
      if (br.width) keepClear.push({ l: br.left - 14, r: br.right + 14,
                                     t: br.top - 14,  b: br.bottom + 14 });
    }

    function clearOf(x, y, hw, hh) {
      for (var q = 0; q < keepClear.length; q++) {
        var k = keepClear[q];
        if (x + hw > k.l && x - hw < k.r && y + hh > k.t && y - hh < k.b) return false;
      }
      return true;
    }

    var box = { width: (R - L) };

    /* Read every position first, then write every transform. Measuring
       and moving in the same loop makes the browser recompute layout on
       each bloom — that stalled the main thread for about half a second
       and held up the card's fade. */
    var items = [];

    [bed, bedFront].forEach(function (layer) {
      var isFront = (layer === bedFront);
      var blooms = layer.children;
      for (var i = 0; i < blooms.length; i++) {
        var el = blooms[i];
        if (el._coverFor) continue;          // covers travel with their owner
        items.push({
          el: el,
          front: isFront,
          r:  el.getBoundingClientRect(),
          cr: el._cover ? el._cover.getBoundingClientRect() : null
        });
      }
    });

    items.forEach(function (it, idx) {
      var el = it.el, r = it.r;

      /* A bloom and the cover hiding its cut stem must travel together or
         the green end slides out, so they are cleared as one shape. */
      var left = r.left, right = r.right, top = r.top, bottom = r.bottom;
      if (it.cr) {
        left   = Math.min(left, it.cr.left);
        right  = Math.max(right, it.cr.right);
        top    = Math.min(top, it.cr.top);
        bottom = Math.max(bottom, it.cr.bottom);
      }

      var bx = (left + right) / 2;
      var by = (top + bottom) / 2;
      // the transparent margin means the painted flower is smaller than its box
      var hw = (right - left)  * SOLID;
      var hh = (bottom - top) * SOLID;

      /* Everything moves straight out from the middle, so the bed opens
         as a circle rather than four blocks sliding apart. The distance
         is worked out along that same bearing: how far the paper's edge
         lies that way, plus how far the bloom itself reaches along it. */
      var dx = bx - cx, dy = by - cy;
      var d  = Math.hypot(dx, dy);

      // a bloom sitting dead centre still needs a bearing; spread these
      // on the golden angle so they never all leave the same way
      var a  = d > 1 ? 0 : (idx * 2.39996);
      var ux = d > 1 ? dx / d : Math.cos(a);
      var uy = d > 1 ? dy / d : Math.sin(a);

      // distance from the middle to the paper's edge on this bearing
      var edge = Math.min(halfW / Math.max(Math.abs(ux), 1e-3),
                          halfH / Math.max(Math.abs(uy), 1e-3));
      // and how far the bloom itself reaches along it
      var reach = Math.abs(ux) * hw + Math.abs(uy) * hh;

      var travel = Math.max(0, edge + reach - EDGE_OVERLAP - d);

      /* That is a close estimate, not a proof — a boxy bloom leaving on a
         diagonal can still clip a corner. Nudge it out until it is really
         clear, keeping the direction. */
      for (var s = 0; s < 26; s++) {
        if (clearOf(bx + ux * travel, by + uy * travel, hw, hh)) break;
        travel = travel * 1.06 + 12;
      }

      var tx, ty;
      if (travel > 0) {
        tx = ux * travel;
        ty = uy * travel;
      } else {
        // already clear: ease outward a touch, fading with distance
        var k = OUTER_DRIFT * Math.max(0, 1 - d / (box.width * 1.15));
        tx = ux * k;
        ty = uy * k;
      }

      /* The blooms in front of the card sit inside .card, which is scaled
         by --s. A translate written there is shrunk by that scale, so on a
         phone they moved less than half as far as asked and stayed over
         the paper. Undo the scale so the travel is in screen pixels. */
      if (it.front && scale) { tx /= scale; ty /= scale; }

      if (Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return;

      /* A bloom hovered just before the click still has the swell's settle
         timers pending; they would rewrite transform and drag it back. */
      if (el._hold)   { clearTimeout(el._hold);   el._hold = null; }
      if (el._settle) { clearTimeout(el._settle); el._settle = null; }

      // inner blooms go first, so the opening travels outward
      var delay = Math.round(Math.min(d, 760) * 0.6) + 'ms';
      var move  = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) ';

      [el, el._cover].forEach(function (node) {
        if (!node) return;
        node.classList.remove('swell');
        node.classList.add('lift');
        node.style.transitionDelay = delay;
        node.style.transform = move + 'rotate(' + node._rot.toFixed(1) + 'deg)';
        lifted.push(node);
      });
    });
  }


  /* Clicking the card blooms the bed, holds long enough to watch it,
     then fades through to the letter. The scroll jump happens while the
     veil is opaque, so the panels cross-fade rather than slide. */

  /* The bloom's own movement runs ~1.35s, so the veil now starts while
     it is still settling rather than after a pause. */
  var CARD_REVEAL_MS = 500;   // the next card starts while the bed is still opening
  var BLOOM_VIEW_MS = 1150;   // time to watch the bloom before the fade
  var VEIL_IN_MS    = 450;    // matches the .veil transition
  var VEIL_HOLD_MS  = 110;    // a beat for the new view to paint

  var veil = document.getElementById('veil');
  var travelling = false;

  function reducedMotion() {
    return window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* --- the two views -------------------------------------------------
     Both live in this document. Only one is on screen at a time, and the
     veil covers the swap so neither is ever seen sliding or popping. */

  var notePage = document.getElementById('page');
  var noteBody = document.body;

  function openNote(revealDelay) {
    noteBody.classList.add('on-note');
    notePage.classList.add('active');
    renderNote();                       // builds from note.json, once
    resetPanels();
    showPanel('noteMain', revealDelay); // always start on the note
    void notePage.offsetHeight;         // let the resting styles land
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        notePage.classList.add('in-view');   // starts the staged entrance
      });
    });
  }

  function closeNote() {
    notePage.classList.remove('active', 'in-view');
    resetPanels();               // next visit starts on the note again
    noteBody.classList.remove('on-note');

    // the flowers stay where they opened — never reset, never replayed
    noteBody.classList.remove('card-away');

    // let the nudge earn its place again
    hintShown = hintQueued = false;
    clearTimeout(hintTimer);
    armHint();
  }

  function fadeToNote() {
    if (travelling) return;

    // the words are not here yet; remember the click and go when they are
    if (!noteReady) { openWhenReady = true; return; }

    travelling = true;

    var hint = document.getElementById('hint');
    if (hint) hint.classList.remove('show');

    /* All three overlap, so it reads as one soft reveal rather than three
       steps: the flowers start opening and the first card starts leaving
       on the same frame, and the next card begins surfacing from behind
       them a moment later — while they are still moving. */
    noteBody.classList.add('card-away');    // the first card fades and shrinks

    if (reducedMotion()) { openNote(0); setOpen(true); travelling = false; return; }

    /* The next card is put in place first — laid out but still invisible —
       so the flowers can measure what they have to uncover. Then they open,
       and the card surfaces from behind them a moment later, while they are
       still moving. */
    openNote(CARD_REVEAL_MS);
    setOpen(true);

    setTimeout(function () { travelling = false; }, 2500);
  }

  function fadeToFlowers() {
    if (travelling) return;
    travelling = true;

    if (reducedMotion()) { closeNote(); travelling = false; return; }

    if (currentPanel) currentPanel.classList.remove('shown');
    setTimeout(function () {
      closeNote();
      travelling = false;
    }, PAGE_HIDE_MS);
  }

  var backEl = document.getElementById('back');

  if (backEl) {
    backEl.addEventListener('click', function (e) {
      e.preventDefault();
      fadeToFlowers();
    });
  }

  var backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', fadeToFlowers);

  /* --- the note's words ----------------------------------------------
     Sections come from note.json so the wording can change without
     touching the page. The copy below is the fallback for when the file
     is opened straight off disk, where fetch cannot read it. */

  var NOTE_FALLBACK = {
    title: 'a birthday note',
    sections: [
      { id: 'opening', heading: null, lines: ['happy birthday to you!'] },
      { id: 'today', heading: 'for today', lines: [
        'I hope today is filled with all the little things that make you smile — the good coffee, the song that comes on at exactly the right moment, the message from someone you were just thinking about.',
        'you deserve so much joy, love, and happiness. not just today, but the whole year ahead of it.'] },
      { id: 'thank-you', heading: 'thank you', lines: [
        'thank you for being you.',
        'for the way you listen properly instead of waiting to talk. for remembering the small things nobody else remembers. for showing up, again and again, even when it would have been easier not to.',
        'you mean a lot. more than gets said out loud often enough.'] },
      { id: 'this-year', heading: 'this year', lines: [
        "here's to a year that is kind to you.",
        'to plans that actually happen, and to the good afternoons that were never planned at all. to feeling proud of yourself for something. to rest when you need it and not feeling guilty about taking it.',
        "and to more moments where you catch yourself thinking — this is nice, I'm glad I'm here."] },
      { id: 'close', heading: null, lines: ['have the best day ever!', 'love you lots \u2665'] }
    ]
  };

  var FIRST_BEAT_MS = 900;   // when the first section arrives
  var BEAT_STEP_MS  = 110;   // and the gap between the ones after it

  var noteBuilt = false;

  function paintNote(data) {
    if (!data || !Array.isArray(data.sections)) data = NOTE_FALLBACK;

    var titleEl = document.getElementById('noteTitle');
    var textEl  = document.getElementById('noteText');
    if (!textEl) return;

    if (data.title && titleEl) titleEl.textContent = data.title;

    var frag = document.createDocumentFragment();

    data.sections.forEach(function (sec, i) {
      var el = document.createElement('section');
      el.className = 'note-section';
      if (sec.id) el.dataset.id = sec.id;
      el.style.setProperty('--d', (FIRST_BEAT_MS + i * BEAT_STEP_MS) + 'ms');

      if (sec.heading) {
        var h = document.createElement('h2');
        h.className = 'note-heading';
        h.textContent = sec.heading;
        el.appendChild(h);
      }

      (sec.lines || []).forEach(function (line) {
        var pEl = document.createElement('p');
        pEl.className = 'note-line';
        pEl.textContent = line;
        el.appendChild(pEl);
      });

      frag.appendChild(el);
    });

    textEl.textContent = '';
    textEl.appendChild(frag);
  }

  function renderNote() {
    if (noteBuilt) return;
    noteBuilt = true;
    paintNote(noteData);
    paintGallery(galleryData);
  }

  /* --- the gallery ----------------------------------------------------
     Photos and their notes come from gallery.json. The scattered layout
     is fixed here rather than in the data, so swapping the photographs
     never means rearranging the pile. */

  /* How many photographs the gallery will take. Put between MIN and MAX
     of them in gallery.json; anything past MAX is ignored, and the pile
     is arranged to suit however many there are. */
  var MIN_PHOTOS = 3;
  var MAX_PHOTOS = 6;

  /* A hand-made scatter for each count, in percentages of the stage, so
     three photos sit as comfortably as six. `note` is where a caption
     bubble hangs off the print, if that photo has one. */
  var LAYOUTS = {
    3: [
      { x: '23.3%', y: '47.8%', w: '28%', r: '-3deg', ar: '5 / 4', z: 3, note: { x: '35.8%', y: '88.9%', r: '-2deg' } },
      { x: '50.0%', y: '41.4%', w: '28%', r: '2deg',  ar: '4 / 5', z: 5, note: { x: '67.8%', y: '11.1%', r: '2deg', dark: true } },
      { x: '75.8%', y: '52.2%', w: '28%', r: '-2deg', ar: '5 / 4', z: 4, note: { x: '82.0%', y: '91.0%', r: '1deg' } }
    ],
    4: [
      { x: '21.5%', y: '39.2%', w: '26%', r: '-4deg', ar: '5 / 4', z: 3, note: { x: '28.7%', y: '74.8%', r: '-2deg' } },
      { x: '43.7%', y: '52.2%', w: '24%', r: '3deg',  ar: '4 / 5', z: 5 },
      { x: '65.2%', y: '34.9%', w: '25%', r: '-2deg', ar: '4 / 5', z: 4, note: { x: '80.2%', y: '13.3%', r: '2deg', dark: true } },
      { x: '80.2%', y: '65.1%', w: '26%', r: '2deg',  ar: '5 / 4', z: 6, note: { x: '83.7%', y: '95.4%', r: '1deg' } }
    ],
    5: [
      { x: '18.9%', y: '43.5%', w: '24%', r: '-4deg', ar: '5 / 4', z: 3, note: { x: '25.9%', y: '78.1%', r: '-2deg' } },
      { x: '38.5%', y: '54.3%', w: '22%', r: '3deg',  ar: '4 / 5', z: 5 },
      { x: '55.4%', y: '32.7%', w: '23%', r: '-2deg', ar: '4 / 5', z: 4, note: { x: '67.8%', y: '6.8%', r: '1deg', dark: true } },
      { x: '69.6%', y: '63.0%', w: '24%', r: '1deg',  ar: '5 / 4', z: 6 },
      { x: '83.7%', y: '34.9%', w: '22%', r: '3deg',  ar: '4 / 5', z: 4, note: { x: '85.6%', y: '69.4%', r: '2deg' } }
    ],
    6: [
      { x: '18.0%', y: '45.7%', w: '23%', r: '-3deg', ar: '5 / 4', z: 3, note: { x: '24.2%', y: '80.2%', r: '-2deg' } },
      { x: '35.8%', y: '52.2%', w: '20%', r: '2deg',  ar: '4 / 5', z: 5 },
      { x: '52.6%', y: '28.4%', w: '22%', r: '-2deg', ar: '4 / 5', z: 4, note: { x: '64.2%', y: '5.7%',  r: '1deg', dark: true } },
      { x: '70.4%', y: '24.1%', w: '22%', r: '3deg',  ar: '5 / 4', z: 6, note: { x: '87.4%', y: '17.6%', r: '2deg' } },
      { x: '59.8%', y: '69.4%', w: '25%', r: '-1deg', ar: '5 / 4', z: 7 },
      { x: '83.7%', y: '56.5%', w: '20%', r: '2deg',  ar: '4 / 5', z: 5, note: { x: '82.0%', y: '93.2%', r: '1deg' } }
    ]
  };

  /* the little paper stickers, per count */
  var STICKERS = {
    3: [{ kind: 'flower', x: '38%', y: '10%', w: '5%',  r: '-8deg' },
        { kind: 'heart',  x: '9%',  y: '20%', w: '6%',  r: '10deg' }],
    4: [{ kind: 'flower', x: '33%', y: '10%', w: '5%',  r: '-8deg' },
        { kind: 'heart',  x: '55%', y: '78%', w: '5.5%', r: '9deg' }],
    5: [{ kind: 'flower', x: '30%', y: '12%', w: '4.5%', r: '-8deg' },
        { kind: 'heart',  x: '26%', y: '24%', w: '5%',  r: '9deg' },
        { kind: 'flower', x: '96%', y: '78%', w: '4.5%', r: '12deg' }],
    6: [{ kind: 'flower', x: '44%', y: '10%', w: '4.5%', r: '-8deg' },
        { kind: 'heart',  x: '25%', y: '30%', w: '5%',  r: '9deg' },
        { kind: 'flower', x: '97%', y: '76%', w: '4.5%', r: '12deg' }]
  };

  var GALLERY_FALLBACK = {
    title: 'little moments with you:',
    photos: [
      { src: 'assets/img/photos/web/sea.jpg',       alt: '', note: 'my favorite day' },
      { src: 'assets/img/photos/web/ice-cream.jpg', alt: '', note: '' },
      { src: 'assets/img/photos/web/flowers.jpg',   alt: '', note: 'best memory' },
      { src: 'assets/img/photos/web/kItttty.jpg',   alt: '', note: 'look how cute' },
      { src: 'assets/img/photos/web/pancake.jpg',   alt: '', note: '' },
      { src: 'assets/img/photos/web/pink-bike.jpg', alt: '', note: 'love you always' }
    ]
  };

  var galleryData = null;

  var FLOWER_STICKER =
    '<svg viewBox="0 0 40 40" aria-hidden="true">' +
    '<g fill="#FFF9F0"><ellipse cx="20" cy="9" rx="7" ry="8"/>' +
    '<ellipse cx="31" cy="16" rx="7" ry="8" transform="rotate(72 31 16)"/>' +
    '<ellipse cx="27" cy="30" rx="7" ry="8" transform="rotate(144 27 30)"/>' +
    '<ellipse cx="13" cy="30" rx="7" ry="8" transform="rotate(216 13 30)"/>' +
    '<ellipse cx="9" cy="16" rx="7" ry="8" transform="rotate(288 9 16)"/></g>' +
    '<circle cx="20" cy="20" r="5" fill="#F2D9A8"/>' +
    '<circle cx="18" cy="19" r="1.1" fill="#D8B87E"/>' +
    '<circle cx="22" cy="21" r="1.1" fill="#D8B87E"/></svg>';

  var HEART_STICKER =
    '<svg viewBox="0 0 36 33" aria-hidden="true">' +
    '<path d="M18 31C18 31 2.5 22 2.5 11.6 2.5 6.3 6.6 2.5 11.2 2.5c3 0 5.5 1.6 6.8 4 1.3-2.4 3.8-4 6.8-4 4.6 0 8.7 3.8 8.7 9.1C33.5 22 18 31 18 31Z" fill="#F7A8C0"/>' +
    '<circle cx="15" cy="13" r="1.7" fill="#FFF1F5"/>' +
    '<circle cx="21" cy="13" r="1.7" fill="#FFF1F5"/></svg>';

  function paintGallery(data) {
    if (!data || !Array.isArray(data.photos)) data = GALLERY_FALLBACK;

    var titleEl = document.getElementById('galleryTitle');
    var wrap    = document.getElementById('shots');
    if (!wrap) return;

    if (data.title && titleEl) titleEl.textContent = data.title;

    /* Take between MIN and MAX of them: any more are left out rather than
       squeezed in, and the layout is chosen to suit the number kept. */
    var photos = data.photos.slice(0, MAX_PHOTOS);
    var slots  = LAYOUTS[photos.length] || LAYOUTS[Math.max(MIN_PHOTOS,
                   Math.min(MAX_PHOTOS, photos.length))] || LAYOUTS[MAX_PHOTOS];

    var frag = document.createDocumentFragment();

    /* Dealt from the middle of the pile outwards, so it looks like someone
       laying prints down rather than a sweep. */
    var FIRST_CARD_MS = 700, CARD_STEP_MS = 110;

    var order = photos.map(function (_, i) {
      var s = slots[i % slots.length];
      return { i: i, d: Math.hypot(parseFloat(s.x) - 50, parseFloat(s.y) - 50) };
    }).sort(function (a, b) { return a.d - b.d; });

    var beat = {};
    order.forEach(function (o, rank) { beat[o.i] = FIRST_CARD_MS + rank * CARD_STEP_MS; });

    photos.forEach(function (photo, i) {
      var spot = slots[i % slots.length];

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shot';
      btn.style.cssText =
        '--sx:' + spot.x + ';--sy:' + spot.y + ';--sw:' + spot.w +
        ';--sr:' + spot.r + ';z-index:' + spot.z + ';--sd:' + beat[i] + 'ms;';

      var img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.setProperty('--ar', photo.ar || spot.ar);

      btn.appendChild(img);
      btn.addEventListener('click', function () { openShot(photo); });
      frag.appendChild(btn);

      // a caption bubble, where the slot has somewhere to hang one
      if (photo.note && spot.note) {
        var tag = document.createElement('span');
        tag.className = 'shot-note' + (spot.note.dark ? ' dark' : '');
        tag.style.cssText =
          '--nx:' + spot.note.x + ';--ny:' + spot.note.y +
          ';--nr:' + (spot.note.r || '0deg') + ';z-index:' + (spot.z + 20) +
          ';--sd:' + (beat[i] + 260) + 'ms;';
        tag.appendChild(document.createTextNode(photo.note));
        tag.insertAdjacentHTML('beforeend',
          '<svg class="bub-heart" viewBox="0 0 32 29" aria-hidden="true"><use href="#hrt-solid"/></svg>');
        frag.appendChild(tag);
      }
    });

    // and the paper stickers
    (STICKERS[photos.length] || []).forEach(function (k, n) {
      var el = document.createElement('span');
      el.className = 'gal-sticker';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        '--kx:' + k.x + ';--ky:' + k.y + ';--kw:' + k.w +
        ';--kr:' + k.r + ';z-index:30;--sd:' + (FIRST_CARD_MS + 620 + n * 90) + 'ms;';
      el.innerHTML = k.kind === 'heart' ? HEART_STICKER : FLOWER_STICKER;
      frag.appendChild(el);
    });

    wrap.textContent = '';
    wrap.appendChild(frag);
  }

  if (window.fetch) {
    fetch('assets/data/gallery.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { galleryData = d || GALLERY_FALLBACK; })
      .catch(function () { galleryData = GALLERY_FALLBACK; });
  }

  /* --- the pages inside the note view --------------------------------
     The note, the gallery and the closing word are three pages rather
     than one long scroll. Each fades out before the next fades in, and
     a page only plays its staged entrance when you actually arrive on
     it — so it is watched, not finished behind your back. */

  var PAGE_HIDE_MS   = 300;   // the page you are on steps aside
  var currentPanel = null;
  var panelBusy = false;

  /* Leaving the note, the flowers carry on outward until they are off the
     screen altogether, and only then is the bed taken away. Cutting it
     mid-frame looked like the flowers had simply been switched off. */
  function scatterAway() {
    var cx = vw / 2, cy = vh / 2;
    var reach = Math.hypot(vw, vh) * 0.9;

    var items = [];
    [bed, bedFront].forEach(function (layer) {
      var kids = layer.children;
      for (var i = 0; i < kids.length; i++) {
        items.push({ el: kids[i], front: layer === bedFront,
                     r: kids[i].getBoundingClientRect() });
      }
    });

    items.forEach(function (it) {
      var el = it.el, r = it.r;
      var bx = r.left + r.width / 2, by = r.top + r.height / 2;
      var dx = bx - cx, dy = by - cy;
      var d = Math.hypot(dx, dy) || 1;

      // where the opening already left it
      var m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform || '');
      var ox = m ? +m[1] : 0, oy = m ? +m[2] : 0;

      // the front layer lives inside .card, which is scaled by --s
      var k = (it.front && scale) ? reach / scale : reach;

      el.classList.add('sweep');
      // the ones nearest the middle leave last, so it reads as a parting
      el.style.transitionDelay = Math.round(Math.max(0, 620 - d) * 0.28) + 'ms';
      el.style.transform =
        'translate(' + (ox + dx / d * k).toFixed(1) + 'px,' +
                       (oy + dy / d * k).toFixed(1) + 'px) ' +
        'rotate(' + el._rot.toFixed(1) + 'deg)';
    });
  }

  function revealPanel(el, delay) {
    // the flowers belong to the note; the pages after it are opaque
    var wantsBed = (el.id === 'noteMain');
    if (wantsBed) noteBody.classList.add('show-bed');

    /* The note's own edge blooms are a fixed layer, so they showed on
       every page. They belong to the note alone. */
    noteBody.classList.toggle('decor-off', !wantsBed);

    el.classList.add('current');          // laid out, but still invisible
    void el.offsetHeight;                 // let the resting styles land

    var go = function () {
      el.classList.add('shown');
      el.classList.add('in');             // starts that page's entrance

      /* Once the entrance is over, drop the per-item stagger delays. They
         are only wanted for the arrival; left in place they also govern
         hover, which then took a second to answer and a second to let go. */
      setTimeout(function () { el.classList.add('settled'); }, 2200);

      // once this page has covered the screen, the bed can go
      if (!wantsBed) {
        // only once the last flower is off the screen
        setTimeout(function () {
          noteBody.classList.remove('show-bed', 'decor-off');
        }, 2000);
      }
    };

    if (delay) { setTimeout(go, delay); return; }

    requestAnimationFrame(function () {
      requestAnimationFrame(go);
    });
  }

  /* Moving between pages: the current one is put away, the bed blooms in
     the gap it leaves, and the next page comes up out of the flowers. */
  function showPanel(id, revealDelay) {
    var next = document.getElementById(id);
    if (!next || next === currentPanel || panelBusy) return;

    var prev = currentPanel;
    currentPanel = next;

    // first page of a visit — nothing to clear away
    if (!prev) {
      revealPanel(next, revealDelay);
      return;
    }

    panelBusy = true;
    prev.classList.remove('shown');

    /* The next page starts arriving at once, underneath the flowers, and
       the flowers sweep away to uncover it. Holding it back until they
       had gone made it a fade-in on an empty page, not a reveal. */
    if (prev.id === 'noteMain' && next.id !== 'noteMain') scatterAway();
    revealPanel(next);

    setTimeout(function () {
      prev.classList.remove('current');
      panelBusy = false;
    }, 700);
  }

  function resetPanels() {
    panelBusy = false;
    noteBody.classList.remove('show-bed', 'decor-off');
    ['noteMain', 'gallery', 'closing'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('current', 'shown', 'in', 'settled');
    });
    currentPanel = null;
  }

  // every button carrying a data-next moves you along
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-next]');
    if (!btn) return;
    e.preventDefault();
    showPanel(btn.getAttribute('data-next'));
  });

  /* --- one photo, opened large ---------------------------------------- */

  var lightbox = document.getElementById('lightbox');
  var lbImg    = document.getElementById('lbImg');
  var lbNote   = document.getElementById('lbNote');
  var lbClose  = document.getElementById('lbClose');
  var lastShot = null;

  function openShot(photo) {
    if (!lightbox) return;
    lastShot = document.activeElement;

    lbImg.src = photo.src;
    lbImg.alt = photo.alt || '';
    lbNote.textContent = photo.note || '';

    lightbox.hidden = false;
    void lightbox.offsetHeight;          // let the hidden state land first
    lightbox.classList.add('open');
    if (lbClose) lbClose.focus();
  }

  function closeShot() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.classList.remove('open');
    setTimeout(function () {
      lightbox.hidden = true;
      lbImg.removeAttribute('src');   // src='' would refetch the page as an image
      if (lastShot && lastShot.focus) lastShot.focus();
    }, 300);
  }

  if (lightbox) {
    // clicking the backdrop closes it; clicking the photo itself does not
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeShot();
    });
    if (lbClose) lbClose.addEventListener('click', closeShot);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeShot();
    });
  }

  /* Fetched up front. Until the words are in hand the card cannot be
     opened — otherwise a quick click lands on a note that has not loaded.
     A click made while waiting is remembered and honoured the moment the
     text arrives, rather than being thrown away. */
  var noteData = null;
  var noteReady = false;
  var openWhenReady = false;

  function noteLoaded(data) {
    if (noteReady) return;
    noteData = data || NOTE_FALLBACK;
    noteReady = true;

    if (hintPending) { hintPending = false; armHint(); }
    if (openWhenReady) { openWhenReady = false; fadeToNote(); }
  }

  if (window.fetch) {
    fetch('assets/data/note.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { noteLoaded(d); })
      .catch(function () { noteLoaded(null); });
  } else {
    noteLoaded(null);            // no fetch: the built-in words will do
  }

  var noteEl = document.getElementById('note');

  var hintEl = document.getElementById('hint');
  if (hintEl) hintEl.addEventListener('click', fadeToNote);

  /* On a phone or tablet the card is a small target, so a tap anywhere on
     the flowers opens the note. Left off where there is a mouse: there the
     bed answers to hover, and a stray click on a flower should not carry
     you off the page. The check runs per tap, so a laptop with a touch
     screen behaves according to how it is actually being used. */
  if (viewportEl) {
    viewportEl.addEventListener('click', function () {
      if (window.matchMedia && window.matchMedia('(hover: hover)').matches) return;
      if (document.body.classList.contains('loading')) return;
      fadeToNote();
    });
    // touch devices get the whole bed as the target, so say so
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) {
      viewportEl.style.cursor = 'pointer';
    }
  }

  if (noteEl) {
    noteEl.addEventListener('click', fadeToNote);
    noteEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fadeToNote();
      }
    });
  }

})();
