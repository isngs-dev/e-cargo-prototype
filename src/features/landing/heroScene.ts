// @ts-nocheck
/*
 * Aerial rail-corridor hero scene, ported VERBATIM from the approved landing reference (docs/landing-reference/landing.html).
 * It is a purely visual canvas animation with no business logic, so it is kept as the reference wrote it (hence ts-nocheck).
 * Everything is pre-rendered to off-screen canvases; the loop pauses when off-screen / hidden and shows a still frame for
 * reduced motion. Returns a cleanup function.
 */
export function startHeroScene(stage: HTMLElement, canvas: HTMLCanvasElement, tracker: HTMLElement, reduce: boolean): () => void {
  var ctx = canvas.getContext('2d');
  if (!ctx) return function () {};
    var MONO = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    var COL = { bg: '#04301f', b800: '#064531', b700: '#08583f', b600: '#0b6e4f', b500: '#13865c', b200: '#a9d8c1', b100: '#d5ece0', b50: '#eef7f2' };
    var BOX = ['#0b6e4f', '#a9d8c1', '#475569', '#e2e8f0', '#13865c', '#334155', '#d5ece0', '#92400e'];
    var STATIONS = [[760, 'APAPA PORT'], [2400, 'EBUTE METTA'], [3500, 'MONIYA']];
    var LOOP = 4400, GT = 320, BT = 260, BH = 88, TRAIN_H = 48;
    var RIVER = 1500, RIVER_W = 360, YARD = 200, YARD_W = 480;
    var CARS = 11, CARS2 = 7, TRAIN_W = 78 + CARS * 64 + 8, TRAIN2_W = 78 + CARS2 * 64 + 8;

    var W = 0, H = 0, dpr = 0, trackY = 0, headX = 0, ready = false;
    var groundPat, bedPat, train, train2, beam, glow, cloud, yard, bridge, river, overlay, platforms = [];
    var world = 1100, clock = 4, last = 0, raf = 0, onScreen = true;

    function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function layer(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); var g = c.getContext('2d'); g.scale(dpr, dpr); return [c, g]; }
    function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
    function wrap(s, x, y, r, fn) { for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) { var cx = x + i * s, cy = y + j * s; if (cx + r > 0 && cx - r < s && cy + r > 0 && cy - r < s) fn(cx, cy); } }
    function each(base, span, fn) { for (var k = -1; k < 2; k++) { var x = base - (world % LOOP) + k * LOOP; if (x > -span && x < W) fn(x); } }

    function buildGround() {
      var L = layer(GT, GT), g = L[1], r = rng(7), i;
      g.fillStyle = COL.bg; g.fillRect(0, 0, GT, GT);
      for (i = 0; i < 60; i++) {                   // soft vegetation patches
        var rad = 14 + r() * 50, a = 0.1 + r() * 0.16;
        wrap(GT, r() * GT, r() * GT, rad, function (x, y) {
          var gr = g.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, rgba(COL.b700, a)); gr.addColorStop(1, rgba(COL.b700, 0));
          g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        });
      }
      for (i = 0; i < 16; i++) {                   // field parcels, as seen from the air
        var pw = 50 + r() * 90, ph = 30 + r() * 60, rot = (r() - 0.5) * 0.25, pa = (0.06 + r() * 0.12).toFixed(3);
        wrap(GT, r() * GT, r() * GT, Math.max(pw, ph), function (x, y) {
          g.save(); g.translate(x, y); g.rotate(rot);
          g.fillStyle = rgba(COL.b700, pa); g.fillRect(-pw / 2, -ph / 2, pw, ph);
          g.strokeStyle = 'rgba(169,216,193,.06)'; g.strokeRect(-pw / 2, -ph / 2, pw, ph);
          g.restore();
        });
      }
      for (i = 0; i < 12; i++) {                   // small tree clusters with cast shadows
        var cx0 = r() * GT, cy0 = r() * GT;
        for (var t = 0; t < 5; t++) {
          var tr = 1.8 + r() * 2.2;
          wrap(GT, cx0 + (r() - 0.5) * 22, cy0 + (r() - 0.5) * 14, tr + 4, function (x, y) {
            g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(x + 2, y + 2.5, tr, 0, 7); g.fill();
            g.fillStyle = rgba(COL.b600, 0.85); g.beginPath(); g.arc(x, y, tr, 0, 7); g.fill();
          });
        }
      }
      for (i = 0; i < 900; i++) { g.fillStyle = rgba(COL.b200, (r() * 0.07).toFixed(3)); g.fillRect(r() * GT, r() * GT, 1, 1); }
      groundPat = ctx.createPattern(L[0], 'repeat');
    }

    function buildBed() {                          // ballast with two tracks: sleepers + rails
      var L = layer(BT, BH), g = L[1], r = rng(11);
      g.fillStyle = 'rgba(213,236,224,.07)'; g.fillRect(0, 0, BT, BH);
      for (var i = 0; i < 1600; i++) { g.fillStyle = r() > 0.5 ? 'rgba(213,236,224,' + (0.05 + r() * 0.1).toFixed(3) + ')' : 'rgba(0,0,0,.22)'; g.fillRect(r() * BT, r() * BH, 1.2, 1.2); }
      g.fillStyle = 'rgba(169,216,193,.16)'; g.fillRect(0, 0, BT, 1); g.fillRect(0, BH - 1, BT, 1);
      [26, 62].forEach(function (c) {
        for (var x = 0; x < BT; x += 10) { g.fillStyle = 'rgba(15,23,42,.6)'; g.fillRect(x, c - 12, 4, 24); g.fillStyle = 'rgba(213,236,224,.08)'; g.fillRect(x, c - 12, 4, 1); }
        [c - 6, c + 5].forEach(function (y) { g.fillStyle = 'rgba(169,216,193,.8)'; g.fillRect(0, y, BT, 2); g.fillStyle = 'rgba(238,247,242,.5)'; g.fillRect(0, y, BT, 0.8); });
      });
      bedPat = ctx.createPattern(L[0], 'repeat');
    }

    function buildPlatforms() {
      platforms = STATIONS.map(function (s) {
        var L = layer(420, 40), g = L[1];
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(14, 10, 400, 26);
        g.fillStyle = 'rgba(213,236,224,.16)'; g.fillRect(10, 6, 400, 26);
        g.fillStyle = 'rgba(255,251,235,.55)'; g.fillRect(10, 29, 400, 2);
        for (var x = 150; x < 390; x += 78) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 3, 11, 56, 14); g.fillStyle = 'rgba(238,247,242,.22)'; g.fillRect(x, 9, 56, 13); }
        g.font = MONO; g.fillStyle = 'rgba(238,247,242,.8)'; g.fillText(s[1].split('').join(String.fromCharCode(8202)), 22, 22);
        return L[0];
      });
    }

    function makeTrain(n, seed) {
      var tw = 78 + n * 64 + 8, L = layer(tw + 24, TRAIN_H), g = L[1], r = rng(seed), cy = 22, x = 6, cars = [];
      for (var i = 0; i < n; i++) { var k = r(); cars.push({ x: x, type: k < 0.55 ? 1 : k < 0.88 ? 2 : 0, c1: BOX[(r() * BOX.length) | 0], c2: BOX[(r() * BOX.length) | 0] }); x += 64; }
      var lx = x;                                  // locomotive leads, facing right
      function boxes(fn) {
        cars.forEach(function (c) {
          fn(c.x, cy - 9, 60, 18, '#0f172a');
          if (c.type === 1) fn(c.x + 2, cy - 10, 56, 20, c.c1);
          if (c.type === 2) { fn(c.x + 2, cy - 10, 27, 20, c.c1); fn(c.x + 31, cy - 10, 27, 20, c.c2); }
        });
        fn(lx, cy - 12, 78, 24, COL.b50);
      }
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 9; g.shadowOffsetX = 6; g.shadowOffsetY = 8;
      boxes(function (x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }); g.restore();
      boxes(function (x, y, w, h) {               // corrugation, roof light, door ends
        if (h !== 20) return;
        g.fillStyle = 'rgba(0,0,0,.15)'; for (var cx = x + 2; cx < x + w - 1; cx += 2.5) g.fillRect(cx, y + 1, 1, h - 2);
        g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x, y, w, 1.5);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y, 1.5, h); g.fillRect(x + w - 1.5, y, 1.5, h);
      });
      cars.forEach(function (c) { if (c.type === 0) { g.fillStyle = 'rgba(169,216,193,.25)'; for (var bx = c.x + 4; bx < c.x + 58; bx += 6) g.fillRect(bx, cy - 8, 1, 16); } g.fillStyle = '#334155'; g.fillRect(c.x + 60, cy - 2, 4, 4); });
      g.fillStyle = COL.b500; g.fillRect(lx, cy - 12, 78, 2.5); g.fillRect(lx, cy + 9.5, 78, 2.5);
      g.fillStyle = 'rgba(4,48,31,.35)'; for (var gx = lx + 8; gx < lx + 46; gx += 3) g.fillRect(gx, cy - 6, 1.5, 12);
      g.fillStyle = 'rgba(4,48,31,.55)'; [lx + 15, lx + 36].forEach(function (fx) { g.beginPath(); g.arc(fx, cy, 4.5, 0, 7); g.fill(); });
      g.fillStyle = COL.b100; g.fillRect(lx + 52, cy - 9, 18, 18);
      g.fillStyle = COL.bg; g.fillRect(lx + 70, cy - 8, 4, 16);
      g.fillStyle = '#fffbeb'; g.fillRect(lx + 76, cy - 7, 2, 3); g.fillRect(lx + 76, cy + 4, 2, 3);
      return L[0];
    }

    function buildSprites() {
      buildGround(); buildBed(); buildPlatforms();
      train = makeTrain(CARS, 23); train2 = makeTrain(CARS2, 41);

      var B = layer(200, 64), b = B[1];             // elliptical headlight wash
      b.translate(0, 32); b.scale(1, 0.15);
      var gr = b.createRadialGradient(0, 0, 0, 0, 0, 200); gr.addColorStop(0, 'rgba(255,251,235,.26)'); gr.addColorStop(1, 'rgba(255,251,235,0)');
      b.fillStyle = gr; b.fillRect(0, -214, 200, 428); beam = B[0];

      var G = layer(28, 28), q = G[1], gg = q.createRadialGradient(14, 14, 0, 14, 14, 14);
      gg.addColorStop(0, 'rgba(236,253,245,1)'); gg.addColorStop(0.25, 'rgba(19,134,92,.75)'); gg.addColorStop(1, 'rgba(19,134,92,0)');
      q.fillStyle = gg; q.fillRect(0, 0, 28, 28); glow = G[0];

      var C = layer(560, 320), c = C[1], rc = rng(5); // soft cloud shadow, fades out inside its box
      for (var i = 0; i < 9; i++) {
        var x = 160 + rc() * 240, y = 120 + rc() * 80, rad = 60 + rc() * 60;
        var cg = c.createRadialGradient(x, y, 0, x, y, rad); cg.addColorStop(0, 'rgba(0,12,7,.17)'); cg.addColorStop(1, 'rgba(0,12,7,0)');
        c.fillStyle = cg; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      cloud = C[0];

      var Y = layer(YARD_W, 92), yd = Y[1], ry = rng(31); // Apapa port container yard
      yd.fillStyle = 'rgba(213,236,224,.07)'; yd.fillRect(0, 0, YARD_W, 92);
      yd.save(); yd.shadowColor = 'rgba(0,0,0,.55)'; yd.shadowBlur = 5;
      for (var row = 0; row < 3; row++) for (var col = 0; col < 14; col++) {
        if (ry() < 0.12) continue;
        var tier = 1 + ((ry() * 3) | 0); yd.shadowOffsetX = 1 + tier * 2; yd.shadowOffsetY = 2 + tier * 2.5;
        yd.fillStyle = BOX[(ry() * BOX.length) | 0]; yd.fillRect(8 + col * 33, 8 + row * 27, 28, 19);
      }
      yd.restore();
      yd.fillStyle = 'rgba(0,0,0,.14)';
      for (row = 0; row < 3; row++) for (col = 0; col < 14; col++) for (var cx = 10 + col * 33; cx < 34 + col * 33; cx += 2.5) yd.fillRect(cx, 9 + row * 27, 1, 17);
      yd.strokeStyle = 'rgba(238,247,242,.6)'; yd.lineWidth = 1.5; yd.strokeRect(186.5, 2.5, 38, 87);
      yd.fillStyle = 'rgba(255,251,235,.75)'; yd.fillRect(186, 44, 39, 3);
      yard = Y[0];

      var Bb = layer(RIVER_W, BH + 20), br = Bb[1]; // bridge girders with truss pattern
      [0, BH + 14].forEach(function (y0) {
        br.fillStyle = 'rgba(15,23,42,.8)'; br.fillRect(0, y0, RIVER_W, 6);
        br.strokeStyle = 'rgba(169,216,193,.5)'; br.lineWidth = 1; br.beginPath();
        for (var bx = 0; bx < RIVER_W; bx += 18) { br.moveTo(bx, y0); br.lineTo(bx + 9, y0 + 6); br.lineTo(bx + 18, y0); }
        br.stroke();
      });
      bridge = Bb[0];
    }

    function buildRiver() {                        // lagoon creek crossing, sized to the hero height
      var R = layer(RIVER_W, H), g = R[1], y;
      g.beginPath();
      for (y = 0; y <= H + 8; y += 8) g.lineTo(32 + Math.sin(y * 0.011) * 20, y);
      for (y = H + 8; y >= 0; y -= 8) g.lineTo(RIVER_W - 32 + Math.sin(y * 0.009 + 2) * 20, y);
      g.closePath();
      var wg = g.createLinearGradient(0, 0, RIVER_W, 0);
      wg.addColorStop(0, 'rgba(7,89,133,.78)'); wg.addColorStop(0.5, 'rgba(7,89,133,.95)'); wg.addColorStop(1, 'rgba(7,89,133,.78)');
      g.fillStyle = wg; g.fill();
      g.strokeStyle = 'rgba(213,236,224,.24)'; g.lineWidth = 2; g.stroke();
      river = R[0];
    }

    function buildOverlay() {                      // chart graticule with Lagos-approach coordinates
      var L = layer(W, H), g = L[1], step = W >= 960 ? 220 : 150, i, x, y;
      g.strokeStyle = 'rgba(169,216,193,.08)'; g.lineWidth = 1; g.font = MONO; g.fillStyle = 'rgba(169,216,193,.5)';
      for (i = 0, x = step * 0.6; x < W - 30; x += step, i++) {
        g.beginPath(); g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, H); g.stroke();
        g.fillText('3°' + (18 + i * 2) + '′E', x + 6, H - 18);
      }
      g.textAlign = 'right';
      for (i = 0, y = step * 0.75; y < H - 40; y += step, i++) {
        g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(W, Math.round(y) + 0.5); g.stroke();
        g.fillText('6°' + (34 - i * 2) + '′N', W - 12, y - 6);
      }
      var v = g.createRadialGradient(W * 0.6, H * 0.6, Math.min(W, H) * 0.25, W * 0.6, H * 0.6, Math.max(W, H) * 0.85);
      v.addColorStop(0, 'rgba(2,24,15,0)'); v.addColorStop(1, 'rgba(2,24,15,.55)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      overlay = L[0];
    }

    function fill(pat, off, tile, y, h) {         // scroll a pattern in device pixels
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(-Math.round((off % tile) * dpr), Math.round(y * dpr));
      ctx.fillStyle = pat; ctx.fillRect(0, 0, canvas.width + tile * dpr + 2, Math.ceil(h * dpr));
      ctx.restore();
    }

    function draw() {
      if (!ready) return;
      var bedTop = trackY - 62, i, x;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fill(groundPat, world, GT, 0, H);

      each(RIVER, RIVER_W, function (x) {           // water, ripples, bridge deck and its shadow
        ctx.drawImage(river, x, 0, RIVER_W, H);
        ctx.fillStyle = 'rgba(240,249,255,.22)';
        for (var j = 0; j < 18; j++) ctx.fillRect(x + 70 + (j * 53) % 220, ((j * 97 + clock * 16) % (H + 40)) - 20, 12 + (j % 3) * 7, 1);
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x, bedTop + BH + 10, RIVER_W, 18);
        ctx.fillStyle = 'rgba(15,23,42,.85)'; ctx.fillRect(x, bedTop, RIVER_W, BH);
      });
      fill(bedPat, world, BT, bedTop, BH);
      each(RIVER, RIVER_W, function (x) { ctx.drawImage(bridge, x, bedTop - 10, RIVER_W, BH + 20); });
      each(YARD, YARD_W, function (x) { ctx.drawImage(yard, x, bedTop - 100, YARD_W, 92); });
      for (i = 0; i < STATIONS.length; i++) each(STATIONS[i][0], 420, function (x) { ctx.drawImage(platforms[i], x, bedTop - 40, 420, 40); });

      for (x = 640 - (world % 900); x < W + 30; x += 900) {
        ctx.fillStyle = 'rgba(15,23,42,.8)'; ctx.fillRect(x - 1.5, bedTop + BH + 6, 3, 10);
        ctx.drawImage(glow, x - 14, bedTop + BH - 6, 28, 28);
      }

      var travel = (clock % 24) * 165, x2 = W + 60 - travel; // opposing train on the upper track
      if (x2 < W + 60 && x2 + TRAIN2_W + 24 > -260) {
        ctx.save(); ctx.translate(x2 + TRAIN2_W + 24, bedTop + 4); ctx.scale(-1, 1);
        ctx.drawImage(beam, TRAIN2_W - 4, -10, 200, 64);
        ctx.drawImage(train2, 0, 0, TRAIN2_W + 24, TRAIN_H);
        ctx.restore();
      }

      var tx = headX - TRAIN_W;
      ctx.drawImage(beam, tx + TRAIN_W - 4, trackY - 32, 200, 64);
      ctx.drawImage(train, tx, trackY - 22, TRAIN_W + 24, TRAIN_H);

      for (i = 0; i < 3; i++) {                     // cloud shadows drift over everything
        var span = W + 760, cx = (((i * 0.37 * span) - world - clock * 9) % span + span) % span - 560;
        ctx.drawImage(cloud, cx, H * (0.02 + i * 0.3), 560, 320);
      }
      ctx.drawImage(overlay, 0, 0, W, H);
    }

    function placeTracker() {
      var compact = W < 640, tw = tracker.offsetWidth, th = tracker.offsetHeight;
      var anchor = headX - 34, left = Math.max(16, Math.min(W - tw - 16, anchor - tw + 56));
      var bottom = trackY - 62 - (compact ? 8 : 52), top = bottom - th;
      // App-port tweak: on mid-size screens keep the label clear of the hero call-to-action buttons.
      var actions = stage.parentNode && stage.parentNode.querySelector('.hero-actions');
      if (actions) {
        var ar = actions.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        var aRight = ar.right - sr.left, aBottom = ar.bottom - sr.top;
        if (top < aBottom + 10 && left < aRight + 14) left = Math.min(W - tw - 16, Math.max(left, aRight + 14));
        // still colliding (no free space beside the buttons)? hide this purely decorative label
        tracker.style.visibility = (top < aBottom + 10 && left < aRight + 14) ? 'hidden' : '';
      }
      tracker.style.left = left + 'px'; tracker.style.top = top + 'px';
      tracker.style.setProperty('--lx', Math.max(14, Math.min(tw - 14, anchor - left)) + 'px');
      tracker.style.setProperty('--lh', (trackY - 16 - bottom) + 'px');
    }

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (w < 2 || h < 2) { ready = false; return; }   // not laid out yet (e.g. hidden preview)
      var d = Math.min(2, Math.round((window.devicePixelRatio || 1) * 4) / 4);
      W = w; H = h;
      if (d !== dpr) { dpr = d; buildSprites(); }
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      trackY = H - (W >= 960 ? 112 : 84);
      headX = Math.round(W * (W >= 960 ? 0.8 : 0.9));
      buildOverlay(); buildRiver(); ready = true;
      placeTracker(); draw(); start();
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      world += 34 * dt; clock += dt;
      draw(); start();
    }
    function start() { if (ready && !reduce && !raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }

  resize();
  var showTracker = setTimeout(function () { tracker.classList.add('is-on'); }, reduce ? 0 : 250);
  var ro, io, rt;
  var onVis = function () { if (document.hidden) stop(); else start(); };
  var onWinResize = function () { clearTimeout(rt); rt = setTimeout(resize, 120); };
  if ('ResizeObserver' in window) { ro = new ResizeObserver(function () { resize(); }); ro.observe(stage); }
  else window.addEventListener('resize', onWinResize);
  document.addEventListener('visibilitychange', onVis);
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; if (onScreen) start(); else stop(); });
    io.observe(stage);
  }
  return function () {
    stop(); clearTimeout(showTracker); clearTimeout(rt);
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    window.removeEventListener('resize', onWinResize);
    document.removeEventListener('visibilitychange', onVis);
  };
}
