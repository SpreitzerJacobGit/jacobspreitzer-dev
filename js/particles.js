(function () {
  'use strict';

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

  window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

  // Color palettes per word variant
  var PALETTES = {
    1: ['125,171,90', '125,171,90', '125,171,90', '160,200,100'],        // mostly green
    2: ['196,135,74', '196,135,74', '220,160,90', '125,171,90'],         // mostly amber
    3: ['125,171,90', '100,150,70', '125,171,90'],                       // muted greens
    4: ['125,171,90', '196,135,74', '240,236,224', '125,171,90'],        // green + amber + warm white
  };

  function getVariant(el) {
    for (var v = 1; v <= 4; v++) {
      if (el.classList.contains('physics-word--' + v)) return v;
    }
    return 1;
  }

  function createWord(el) {
    var variant  = getVariant(el);
    var palette  = PALETTES[variant] || PALETTES[1];
    var N        = 22;
    var particles = [];

    for (var i = 0; i < N; i++) {
      var angle  = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
      var layer  = i < N * 0.6 ? 'outer' : 'inner'; // outer ring + inner cluster
      var spread = layer === 'outer'
        ? 0.55 + Math.random() * 0.7
        : 0.1  + Math.random() * 0.45;

      particles.push({
        angle:  angle,
        spread: spread,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speed:  0.18 + Math.random() * 0.30,
        ampX:   14 + Math.random() * 18,
        ampY:   12 + Math.random() * 16,
        size:   layer === 'outer'
          ? 1.8 + Math.random() * 3.2
          : 1.0 + Math.random() * 1.8,
        rgb:    palette[i % palette.length],
        blur:   layer === 'outer' ? 14 + Math.random() * 10 : 6 + Math.random() * 6,
      });
    }

    return { el: el, particles: particles, visible: false, life: 0 };
  }

  function draw() {
    t += 0.011;
    var sp = scrollY * 0.0022;
    var W  = window.innerWidth;
    var H  = window.innerHeight;

    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < words.length; i++) {
      var w = words[i];

      if (w.visible) w.life = Math.min(1, w.life + 0.025);
      else           w.life = Math.max(0, w.life - 0.035);
      if (w.life <= 0) continue;

      var rect = w.el.getBoundingClientRect();
      if (rect.width === 0) continue;

      var cx = rect.left + rect.width  * 0.5;
      var cy = rect.top  + rect.height * 0.5;
      var hd = Math.sqrt(rect.width * rect.width + rect.height * rect.height) * 0.5;

      for (var j = 0; j < w.particles.length; j++) {
        var p = w.particles[j];
        var r = hd * p.spread;

        var px = cx + Math.cos(p.angle) * r + p.ampX * Math.sin(t * p.speed       + p.phaseX + sp);
        var py = cy + Math.sin(p.angle) * r + p.ampY * Math.sin(t * p.speed * 0.7 + p.phaseY + sp * 0.55);

        // Breathing pulse + fade envelope
        var pulse = 0.42 + 0.34 * Math.sin(t * p.speed * 1.3 + p.phaseX);
        var alpha = w.life * pulse;
        if (alpha <= 0.02) continue;

        ctx.save();
        ctx.shadowBlur  = p.blur;
        ctx.shadowColor = 'rgba(' + p.rgb + ',0.7)';
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

  document.addEventListener('afterai-rendered', function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(setup);
    });
  });
})();
