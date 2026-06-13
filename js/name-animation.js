(function () {
  const canvas = document.getElementById('name-canvas');
  const ctx = canvas.getContext('2d');

  let W, H, dpr;
  let particles = [];
  let mouse = { x: -9999, y: -9999 };

  const REPEL_RADIUS = 100;
  const REPEL_STRENGTH = 6;
  const RETURN_SPEED = 0.055;
  const DAMPING = 0.72;

  // Wind — slow-shifting gusts
  let windX = 0, windY = 0, windTarget = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    buildParticles();
  }

  function sampleText() {
    const offscreen = document.createElement('canvas');

    // Fit both lines left-aligned with padding
    const PAD = 8;
    const fontSize = Math.floor(H * 0.42);
    const lineH = fontSize * 1.12;
    const totalH = lineH * 2;

    offscreen.width = W;
    offscreen.height = H;
    const oc = offscreen.getContext('2d');
    oc.fillStyle = '#fff';
    oc.font = `700 ${fontSize}px Lora, serif`;
    oc.textBaseline = 'top';

    const startY = (H - totalH) / 2;
    oc.fillText('Jacob', PAD, startY);
    oc.fillText('Spreitzer', PAD, startY + lineH);

    const data = oc.getImageData(0, 0, W, H).data;
    const pts = [];
    const gap = Math.max(3, Math.floor(fontSize / 28));
    for (let y = 0; y < H; y += gap) {
      for (let x = 0; x < W; x += gap) {
        const idx = (y * W + x) * 4;
        if (data[idx + 3] > 128) pts.push({ x, y });
      }
    }
    return pts;
  }

  function buildParticles() {
    const pts = sampleText();
    particles = pts.map(p => ({
      tx: p.x, ty: p.y,
      x: p.x + (Math.random() - 0.5) * 240,
      y: p.y + (Math.random() - 0.5) * 120,
      vx: 0, vy: 0,
      size: 1.2 + Math.random() * 1.0,
      // Each particle has a unique "weight" — lighter ones sway more
      weight: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      color: pickColor(),
    }));
  }

  const palette = ['#f0ece0', '#e8dcc8', '#d4c9b0', '#7dab5a', '#9bc46a', '#c4874a'];
  function pickColor() {
    const w = Math.random();
    if (w < 0.60) return palette[0];
    if (w < 0.75) return palette[1];
    if (w < 0.86) return palette[2];
    if (w < 0.93) return palette[3];
    if (w < 0.97) return palette[4];
    return palette[5];
  }

  let t = 0;
  let windChangeTimer = 0;

  function animate() {
    requestAnimationFrame(animate);
    t += 0.012;
    windChangeTimer += 0.012;

    // Shift wind direction slowly like a real breeze
    if (windChangeTimer > 4 + Math.random() * 4) {
      windTarget = (Math.random() - 0.5) * 0.3;
      windChangeTimer = 0;
    }
    windX += (windTarget - windX) * 0.009;
    windY = Math.sin(t * 0.35) * 0.05;

    ctx.clearRect(0, 0, W, H);

    particles.forEach(p => {
      // Wave propagation — offset based on particle's x position so waves sweep left to right
      const wavePhase = t * 1.4 + p.tx * 0.018;
      const swayX = Math.sin(wavePhase) * 2.8 * p.weight + Math.sin(t * 0.5 + p.phase) * 0.8 * p.weight;
      const swayY = Math.cos(wavePhase * 0.7 + p.ty * 0.012) * 2.2 * p.weight + Math.sin(t * 0.8 + p.phase) * 0.6 * p.weight;

      // Spring back to home + sway
      const dx = (p.tx + swayX) - p.x;
      const dy = (p.ty + swayY) - p.y;
      p.vx += dx * RETURN_SPEED;
      p.vy += dy * RETURN_SPEED;

      // Apply wind (lighter particles catch more wind)
      p.vx += windX * p.weight * 1.2;
      p.vy += windY * p.weight * 0.6;

      // Mouse repulsion
      const mx = mouse.x - p.x;
      const my = mouse.y - p.y;
      const dist = Math.sqrt(mx * mx + my * my);
      if (dist < REPEL_RADIUS && dist > 0) {
        const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
        p.vx -= (mx / dist) * force;
        p.vy -= (my / dist) * force;
      }

      p.vx *= DAMPING;
      p.vy *= DAMPING;
      p.x += p.vx;
      p.y += p.vy;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
  }

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.x = -9999; mouse.y = -9999;
  });

  // Click to copy name
  let toastTimeout;
  canvas.addEventListener('click', () => {
    navigator.clipboard.writeText('Jacob Spreitzer').then(() => {
      let toast = document.getElementById('name-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'name-toast';
        toast.style.cssText = `
          position:absolute; bottom: -2rem; left: 0;
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          color: var(--accent);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        `;
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(toast);
      }
      toast.textContent = 'Name copied to clipboard';
      toast.style.opacity = '1';
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    });
  });
  canvas.style.cursor = 'pointer';

  document.fonts.ready.then(() => {
    resize();
    animate();
  });
  window.addEventListener('resize', resize);
})();
