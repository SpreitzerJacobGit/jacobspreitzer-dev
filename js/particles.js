(function () {
  'use strict';

  // Single fixed canvas over the entire viewport — avoids all z-index nesting issues.
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.scale(dpr, dpr);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  var words    = [];
  var t        = 0;
  var scrollY  = window.scrollY || 0;
  var animating = false;

  window.addEventListener('scroll', function () {
    scrollY = window.scrollY;
  }, { passive: true });

  // Build particle data for one .physics-word element.
  function createWord(el) {
    var N = 14;
    var particles = [];
    for (var i = 0; i < N; i++) {
      var angle    = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      var useAmber = (i % 5 === 4);
      particles.push({
        angle:  angle,
        spread: 0.35 + Math.random() * 0.75,   // distance from word centre as fraction of half-diagonal
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speed:  0.20 + Math.random() * 0.28,
        ampX:   6  + Math.random() * 11,
        ampY:   5  + Math.random() * 9,
        size:   0.9 + Math.random() * 1.8,
        rgb:    useAmber ? '196,135,74' : '125,171,90',
      });
    }
    return { el: el, particles: particles, visible: false, life: 0 };
  }

  function draw() {
    t += 0.011;
    var sp = scrollY * 0.0018;   // scroll-driven wave phase offset
    var W  = window.innerWidth;
    var H  = window.innerHeight;

    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < words.length; i++) {
      var w = words[i];

      // Smooth fade in / fade out
      if (w.visible) w.life = Math.min(1, w.life + 0.03);
      else           w.life = Math.max(0, w.life - 0.04);
      if (w.life <= 0) continue;

      var rect = w.el.getBoundingClientRect();
      if (rect.width === 0) continue;

      // Centre of the word in viewport coordinates
      var cx = rect.left + rect.width  * 0.5;
      var cy = rect.top  + rect.height * 0.5;
      // Half-diagonal — controls how far out particles spread
      var hd = Math.sqrt(rect.width * rect.width + rect.height * rect.height) * 0.5;

      for (var j = 0; j < w.particles.length; j++) {
        var p = w.particles[j];
        var r     = hd * p.spread;
        var baseX = cx + Math.cos(p.angle) * r;
        var baseY = cy + Math.sin(p.angle) * r;

        // Two overlapping sine waves per axis → ocean-sway motion
        var px = baseX + p.ampX * Math.sin(t * p.speed       + p.phaseX + sp);
        var py = baseY + p.ampY * Math.sin(t * p.speed * 0.7 + p.phaseY + sp * 0.6);

        // Breathing opacity so particles pulse gently
        var alpha = w.life * (0.28 + 0.24 * Math.sin(t * p.speed * 1.3 + p.phaseX));
        if (alpha <= 0.01) continue;

        ctx.save();
        ctx.shadowBlur  = 7;
        ctx.shadowColor = 'rgba(' + p.rgb + ',0.5)';
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
    var els = document.querySelectorAll('.physics-word');
    if (!els.length) return;

    els.forEach(function (el) { words.push(createWord(el)); });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        for (var i = 0; i < words.length; i++) {
          if (words[i].el === entry.target) {
            words[i].visible = entry.isIntersecting;
            break;
          }
        }
      });
    }, { threshold: 0.1 });

    words.forEach(function (w) { observer.observe(w.el); });

    if (!animating) {
      animating = true;
      requestAnimationFrame(draw);
    }
  }

  // after-ai.js dispatches this event once the markdown is injected into the DOM
  document.addEventListener('afterai-rendered', function () {
    // Two rAFs ensure layout is fully settled before measuring element rects
    requestAnimationFrame(function () {
      requestAnimationFrame(setup);
    });
  });
})();
