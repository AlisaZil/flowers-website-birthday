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
  var HINT_TOUCH_MS      = 1000;   // phone and tablet: there is no hovering
  var MIN_SHOW_MS = 650;    // don't let the loader flash past on a warm cache
  var started     = Date.now();

  document.body.classList.add('loading');

  var ASSETS = ['assets/note-blank.png', 'assets/girl.png'];
  for (var n = 1; n <= 12; n++) {
    ASSETS.push('assets/flowers/f' + (n < 10 ? '0' : '') + n + '.png');
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
      if (wasOpen) setOpen(false);   // the old elements are about to go
      plantBed();
      requestAnimationFrame(function () {
        buildIndex();
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

    img.src = 'assets/flowers/' + opts.variant + '.png';
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
      if (c.bake) bakeOps.push(c.opts);
      else pair(c.opts.owner, makeBloom(c.opts), frag);
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
      var img = IMG_CACHE['assets/flowers/' + o.variant + '.png'];
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

      var cover = stemCover(o);
      if (cover) { cover.owner = el; el._tipVec = cover.tipVec; covers.push(cover); }
    });

    covers.forEach(function (c) {
      c.z = z++;
      pair(c.owner, makeBloom(c), frag);
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

  var LIFT_COUNT = 44;    // live bed blooms that take part
  var LIFT_MS    = 1350;

  var opened = false;
  var lifted = [];

  function setOpen(on) {
    if (on === opened) return;
    opened = on;
    document.body.classList.toggle('opening', on);
    if (on) applyBloom();
    else    releaseBloom();
  }

  function applyBloom() {
    lifted = [];

    [bed, bedFront].forEach(function (layer, isFront) {
      // the bed is in window pixels; the front layer is centred on the note
      var cx = isFront ? 0 : vw / 2;
      var cy = isFront ? 0 : vh * 0.40;

      var items = [];
      var blooms = layer.children;

      for (var i = 0; i < blooms.length; i++) {
        var el = blooms[i];
        if (el._coverFor) continue;        // covers follow their owner
        var w  = parseFloat(el.style.width);
        var dx = parseFloat(el.style.left) + w / 2 - cx;
        var dy = parseFloat(el.style.top)  + w / 2 - cy;
        items.push({ el: el, dx: dx, dy: dy, dist: Math.hypot(dx, dy) });
      }

      // nearest the note first, then keep only as many as we need
      items.sort(function (a, b) { return a.dist - b.dist; });
      if (!isFront) items = items.slice(0, LIFT_COUNT);

      var reach = items.length ? items[items.length - 1].dist : 1;

      items.forEach(function (it) {
        var d = it.dist || 1;
        var push = (isFront ? 150 : 150 * scale) / d;
        // ease the drift off towards the edge of the moving group so the
        // still blooms beyond it don't show a hard boundary
        var falloff = 1 - Math.min(1, d / (reach * 1.15));
        push *= 0.35 + 0.65 * falloff;

        var move = 'translate(' + (it.dx * push).toFixed(1) + 'px,' +
                                  (it.dy * push).toFixed(1) + 'px) ';
        var delay = Math.round(d * 0.18) + 'ms';

        // the bloom and, if it has one, the cover riding on it
        [it.el, it.el._cover].forEach(function (el) {
          if (!el) return;
          el.classList.add('lift');
          el.style.transitionDelay = delay;
          el.style.transform = move + 'rotate(' + el._rot.toFixed(1) + 'deg) scale(1.12)';
          lifted.push(el);
        });
      });
    });
  }

  function releaseBloom() {
    var settling = lifted;
    lifted = [];

    settling.forEach(function (el) {
      el.style.transitionDelay = '0ms';
      el.style.transform = 'rotate(' + el._rot.toFixed(1) + 'deg)';
    });

    setTimeout(function () {
      settling.forEach(function (el) { el.classList.remove('lift'); });
    }, LIFT_MS + 200);
  }

  /* Clicking the card blooms the bed, holds long enough to watch it,
     then fades through to the letter. The scroll jump happens while the
     veil is opaque, so the panels cross-fade rather than slide. */

  /* The bloom's own movement runs ~1.35s, so the veil now starts while
     it is still settling rather than after a pause. */
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

  function openNote() {
    noteBody.classList.add('on-note');
    notePage.classList.add('active');
    renderNote();                       // builds from note.json, once
    void notePage.offsetHeight;         // let the resting styles land
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        notePage.classList.add('in-view');   // starts the staged entrance
      });
    });
  }

  function closeNote() {
    notePage.classList.remove('active', 'in-view');
    noteBody.classList.remove('on-note');

    // put the bed back the way it was and replay its fade
    setOpen(false);
    noteBody.classList.remove('ready');
    void document.getElementById('bed').offsetHeight;
    noteBody.classList.add('ready');

    // let the nudge earn its place again
    hintShown = hintQueued = false;
    clearTimeout(hintTimer);
    armHint();
  }

  function fadeToNote() {
    if (travelling) return;
    travelling = true;

    var hint = document.getElementById('hint');
    if (hint) hint.classList.remove('show');

    setOpen(true);

    if (reducedMotion()) { openNote(); travelling = false; return; }

    setTimeout(function () {
      if (veil) veil.classList.add('on');
      setTimeout(function () {
        openNote();                     // swapped under an opaque veil
        setTimeout(function () {
          if (veil) veil.classList.remove('on');
          travelling = false;
        }, VEIL_HOLD_MS);
      }, VEIL_IN_MS);
    }, BLOOM_VIEW_MS);
  }

  function fadeToFlowers() {
    if (travelling) return;
    travelling = true;

    if (reducedMotion()) { closeNote(); travelling = false; return; }

    if (veil) veil.classList.add('on');
    setTimeout(function () {
      closeNote();
      setTimeout(function () {
        if (veil) veil.classList.remove('on');
        travelling = false;
      }, VEIL_HOLD_MS);
    }, VEIL_IN_MS);
  }

  var backEl = document.getElementById('back');

  if (backEl) {
    backEl.addEventListener('click', function (e) {
      e.preventDefault();
      fadeToFlowers();
    });
  }

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

  var SHOT_LAYOUT = [
    { x: '26%', y: '26%', w: '17%', r: '-6deg',  ar: '4 / 5',  z: 3 },
    { x: '45%', y: '22%', w: '18%', r: '3deg',   ar: '3 / 4',  z: 4 },
    { x: '65%', y: '23%', w: '16.5%', r: '-3deg',  ar: '4 / 5',  z: 5 },
    { x: '84%', y: '28%', w: '17%', r: '5deg',   ar: '3 / 4',  z: 4 },
    { x: '18%', y: '50%', w: '18%', r: '2deg',   ar: '3 / 4',  z: 6 },
    { x: '38%', y: '53%', w: '16.5%', r: '-2deg',  ar: '3 / 4',  z: 7 },
    { x: '59%', y: '55%', w: '17%', r: '4deg',   ar: '4 / 5',  z: 8 },
    { x: '80%', y: '53%', w: '17%', r: '-4deg',  ar: '4 / 5',  z: 6 },
    { x: '33%', y: '76%', w: '18%', r: '-3deg',  ar: '3 / 4',  z: 9 },
    { x: '55%', y: '79%', w: '16.5%', r: '2deg',   ar: '3 / 4',  z: 10 }
  ];

  var GALLERY_FALLBACK = {
    title: 'my favourite moments',
    photos: [
      { src: 'assets/photos/on-stairs.jpg', alt: 'sitting on the steps', note: 'sat on the steps, laughing about nothing in particular.' },
      { src: 'assets/photos/coffee.jpg', alt: 'holding an enormous bowl of coffee', note: 'the biggest coffee they had. obviously.' },
      { src: 'assets/photos/cocktails.jpg', alt: 'two cocktails on a table', note: 'cocktails, and a photo of the photo.' },
      { src: 'assets/photos/kitttty.jpg', alt: 'a cat peeking over knees', note: 'supervised, as always, by management.' },
      { src: 'assets/photos/movie.jpg', alt: 'popcorn at the cinema', note: 'movie night, and the whole bucket to yourself.' },
      { src: 'assets/photos/funny-face.jpg', alt: 'wearing a mask in a shop', note: 'in a shop, wearing a face that was not yours.' },
      { src: 'assets/photos/horses-face.jpg', alt: 'two horse masks', note: 'no explanation. none needed.' },
      { src: 'assets/photos/dorm-night.jpg', alt: 'a kitchen and a lot of mess', note: 'we do not talk about what happened to that kitchen.' },
      { src: 'assets/photos/e897a1f77219ba5e13e5ea77a0f06af0.jpg', alt: 'finishing a dessert', note: 'not leaving a single crumb behind.' },
      { src: 'assets/photos/omg.jpg', alt: 'a close-up face', note: 'this exact face. every single time.' }
    ]
  };

  var galleryData = null;

  function paintGallery(data) {
    if (!data || !Array.isArray(data.photos)) data = GALLERY_FALLBACK;

    var titleEl = document.getElementById('galleryTitle');
    var wrap    = document.getElementById('shots');
    if (!wrap) return;

    if (data.title && titleEl) titleEl.textContent = data.title;

    var frag = document.createDocumentFragment();

    /* Deal order: nearest the middle of the pile first, working outwards,
       so it looks like someone laying prints down rather than a sweep. */
    var FIRST_CARD_MS = 800;
    var CARD_STEP_MS  = 100;

    var order = data.photos.map(function (_, i) {
      var s = SHOT_LAYOUT[i % SHOT_LAYOUT.length];
      var dx = parseFloat(s.x) - 50, dy = parseFloat(s.y) - 55;
      return { i: i, d: Math.hypot(dx, dy) };
    }).sort(function (a, b) { return a.d - b.d; });

    var beat = {};
    order.forEach(function (o, rank) {
      beat[o.i] = FIRST_CARD_MS + rank * CARD_STEP_MS;
    });

    var lastBeat = FIRST_CARD_MS + (data.photos.length - 1) * CARD_STEP_MS;
    var shotsWrap = document.getElementById('shots');
    if (shotsWrap) {
      // the pile settles once the final print is down
      shotsWrap.style.setProperty('--settle', (lastBeat + 500) + 'ms');
    }

    data.photos.forEach(function (photo, i) {
      var spot = SHOT_LAYOUT[i % SHOT_LAYOUT.length];

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shot';
      btn.style.cssText =
        '--sx:' + spot.x + ';--sy:' + spot.y + ';--sw:' + spot.w +
        ';--sr:' + spot.r + ';z-index:' + spot.z +
        ';--sd:' + beat[i] + 'ms;';

      var img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.setProperty('--ar', spot.ar);

      btn.appendChild(img);
      btn.addEventListener('click', function () { openShot(photo); });
      frag.appendChild(btn);
    });

    wrap.textContent = '';
    wrap.appendChild(frag);
    watchGallery();
  }

  if (window.fetch) {
    fetch('gallery.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { galleryData = d || GALLERY_FALLBACK; })
      .catch(function () { galleryData = GALLERY_FALLBACK; });
  }

  /* The entrance waits until the gallery is scrolled to, so it is watched
     rather than over before you arrive. */

  function watchGallery() {
    var panel = document.getElementById('gallery');
    var scroller = document.getElementById('page');
    if (!panel) return;

    if (!('IntersectionObserver' in window)) { panel.classList.add('in'); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        panel.classList.add('in');
        io.disconnect();
      });
    }, { root: scroller, threshold: 0.22 });

    io.observe(panel);
  }

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
      lbImg.src = '';
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

  // fetched up front so the words are ready before the note is opened
  var noteData = null;

  if (window.fetch) {
    fetch('note.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { noteData = d || NOTE_FALLBACK; })
      .catch(function () { noteData = NOTE_FALLBACK; });
  }

  var noteEl = document.getElementById('note');

  var hintEl = document.getElementById('hint');
  if (hintEl) hintEl.addEventListener('click', fadeToNote);

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
