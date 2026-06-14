(function () {
  'use strict';

  // Canvas lives inside .after-ai-section as position:absolute so it scrolls
  // with the page — eliminates the one-frame lag of a fixed-position canvas.
  var sectionEl = null;
  var canvas    = null;
  var ctx       = null;
  var dpr       = Math.min(window.devicePixelRatio || 1, 2);
  var words     = [];
  var t         = 0;
  var scrollY   = window.scrollY || 0;
  var animating = false;

  window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

  // Per-word color palettes
  var PALETTES = {
    1: ['125,171,90', '125,171,90', '125,171,90', '160,200,100'],
    2: ['196,135,74', '196,135,74', '220,160,90', '125,171,90'],
    3: ['125,171,90', '100,150,70', '125,171,90'],
    4: ['125,171,90', '196,135,74', '240,236,224', '125,171,90'],
  };

  function getVariant(el) {
    for (var v = 1; v <= 4; v++) {
      if (el.classList.contains('physics-word--' + v)) return v;
    }
    return 1;
  }

  function buildParticles(el) {
    var palette = PALETTES[getVariant(el)] || PALETTES[1];
    var N = 22;
    var out = [];
    for (var i = 0; i < N; i++) {
      var outer = i < N * 0.6;
      out.push({
        angle:  (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.7,
        spread: outer ? 0.55 + Math.random() * 0.7 : 0.1 + Math.random() * 0.45,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speed:  0.18 + Math.random() * 0.30,
        ampX:   14 + Math.random() * 18,
        ampY:   12 + Math.random() * 16,
        size:   outer ? 1.8 + Math.random() * 3.2 : 1.0 + Math.random() * 1.8,
        rgb:    palette[i % palette.length],
        blur:   outer ? 14 + Math.random() * 10 : 6 + Math.random() * 6,
      });
    }
    return out;
  }

  // Store word centres in section-relative coordinates.
  // Called once at setup and again on resize — never during scroll.
  function recalcPositions() {
    if (!sectionEl) return;
    var sr = sectionEl.getBoundingClientRect();
    var sy = window.scrollY || 0;
    var sx = window.scrollX || 0;
    words.forEach(function (w) {
      var r  = w.el.getBoundingClientRect();
      w.cx   = (r.left + sx - (sr.left + sx)) + r.width  * 0.5;
      w.cy   = (r.top  + sy - (sr.top  + sy)) + r.height * 0.5;
      w.hd   = Math.sqrt(r.width * r.width + r.height * r.height) * 0.5;
    });
  }

  function resizeCanvas() {
    if (!canvas || !sectionEl) return;
    canvas.width  = Math.round(sectionEl.offsetWidth  * dpr);
    canvas.height = Math.round(sectionEl.offsetHeight * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    recalcPositions();
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });

  function draw() {
    t += 0.011;
    var sp = scrollY * 0.0022;
    var W  = sectionEl.offsetWidth;
    var H  = sectionEl.offsetHeight;
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.visible) w.life = Math.min(1, w.life + 0.025);
      else           w.life = Math.max(0, w.life - 0.035);
      if (w.life <= 0 || !w.hd) continue;

      for (var j = 0; j < w.particles.length; j++) {
        var p  = w.particles[j];
        var r  = w.hd * p.spread;
        var px = w.cx + Math.cos(p.angle) * r + p.ampX * Math.sin(t * p.speed       + p.phaseX + sp);
        var py = w.cy + Math.sin(p.angle) * r + p.ampY * Math.sin(t * p.speed * 0.7 + p.phaseY + sp * 0.55);

        var alpha = w.life * (0.42 + 0.34 * Math.sin(t * p.speed * 1.3 + p.phaseX));
        if (alpha <= 0.02) continue;

        ctx.save();
        ctx.shadowBlur  = p.blur;
        ctx.shadowColor = 'rgba(' + p.rgb + ',0.8)';
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.rgb + ',' + alpha.toFixed(3) + ')';
        ctx.fill();
        ctx.restore();
      }
    }

    requestAnimationFrame(draw);
  }

  function setup() {
    sectionEl = document.querySelector('.after-ai-section');
    if (!sectionEl) return;

    canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position:absolute', 'top:0', 'left:0',
      'width:100%', 'height:100%',
      'pointer-events:none', 'z-index:10',
      'mix-blend-mode:screen',
    ].join(';');
    sectionEl.appendChild(canvas);
    ctx = canvas.getContext('2d');

    var els = sectionEl.querySelectorAll('.physics-word');
    if (!els.length) return;

    els.forEach(function (el) {
      words.push({ el: el, particles: buildParticles(el), visible: false, life: 0, cx: 0, cy: 0, hd: 0 });
    });

    resizeCanvas();

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        for (var i = 0; i < words.length; i++) {
          if (words[i].el === entry.target) { words[i].visible = entry.isIntersecting; break; }
        }
      });
    }, { threshold: 0.1 });

    words.forEach(function (w) { observer.observe(w.el); });

    if (!animating) { animating = true; requestAnimationFrame(draw); }
  }

  document.addEventListener('afterai-rendered', function () {
    requestAnimationFrame(function () { requestAnimationFrame(setup); });
  });
})();
