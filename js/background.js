// Brain expansion meme background — Three.js
(function () {
  const heroCanvas   = document.getElementById('hero-canvas');
  const globalCanvas = document.getElementById('global-canvas');

  const CYAN  = 0x00e5ff;
  const TEAL  = 0x00b4cc;
  const PALE  = 0xaae8f0;
  const WHITE = 0xffffff;

  // ── GLOBAL SCENE (brain meme) ──────────────────────────────────────────────
  const gRenderer = new THREE.WebGLRenderer({ canvas: globalCanvas, alpha: true, antialias: false });
  gRenderer.setPixelRatio(1);

  const gScene  = new THREE.Scene();
  const gCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  gCamera.position.z = 55;

  function resizeGlobal() {
    const w = window.innerWidth, h = window.innerHeight;
    gRenderer.setSize(w, h, false);
    gCamera.aspect = w / h;
    gCamera.updateProjectionMatrix();
  }
  resizeGlobal();

  // Brain group — rotates as a unit
  const brainGroup = new THREE.Group();
  gScene.add(brainGroup);

  // Solid fill (gives body to the wireframe)
  brainGroup.add(new THREE.Mesh(
    new THREE.IcosahedronGeometry(8, 3),
    new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.07 })
  ));

  // Primary wireframe (the iconic cyan brain grid)
  const brainWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(8.08, 3),
    new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.58 })
  );
  brainGroup.add(brainWire);

  // Inner detail sphere — adds visual complexity
  brainGroup.add(new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.5, 2),
    new THREE.MeshBasicMaterial({ color: PALE, wireframe: true, transparent: true, opacity: 0.18 })
  ));

  // Pulsing bright core (the "enlightened" flash in the meme)
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 8, 6),
    new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.18 })
  );
  gScene.add(flash);

  // Glow halos — concentric fading spheres
  [11, 15, 20].forEach((r, i) => {
    gScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 14),
      new THREE.MeshBasicMaterial({
        color: TEAL,
        transparent: true,
        opacity: 0.045 - i * 0.012,
        side: THREE.BackSide
      })
    ));
  });

  // Light rays radiating outward
  const rays = [];
  const RAY_COUNT = 20;
  const UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < RAY_COUNT; i++) {
    const theta = (i / RAY_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const phi   = (Math.random() - 0.5) * Math.PI * 0.75;
    const len   = 20 + Math.random() * 22;

    const dir = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi)
    ).normalize();

    const rayMat = new THREE.MeshBasicMaterial({
      color: i % 5 === 0 ? WHITE : CYAN,
      transparent: true,
      opacity: 0.22 + Math.random() * 0.3
    });
    const ray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.28, len, 3),
      rayMat
    );

    ray.position.copy(dir.clone().multiplyScalar(8 + len * 0.5));
    ray.quaternion.setFromUnitVectors(UP, dir);
    gScene.add(ray);
    rays.push({ mesh: ray, phase: Math.random() * Math.PI * 2, base: rayMat.opacity });
  }

  // Thin secondary rays (lines) for depth
  const lineRayCount = 24;
  for (let i = 0; i < lineRayCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = (Math.random() - 0.5) * Math.PI;
    const len   = 18 + Math.random() * 28;
    const dir   = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi)
    ).normalize();

    const pts = [
      dir.clone().multiplyScalar(8),
      dir.clone().multiplyScalar(8 + len)
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.15 + Math.random() * 0.25 })
    );
    gScene.add(line);
  }

  // Star particles
  const starGeo  = new THREE.BufferGeometry();
  const starPos  = new Float32Array(350 * 3);
  for (let i = 0; i < 350; i++) {
    const r = 16 + Math.random() * 60;
    const t = Math.random() * Math.PI * 2;
    const p = (Math.random() - 0.5) * Math.PI;
    starPos[i * 3]     = r * Math.cos(t) * Math.cos(p);
    starPos[i * 3 + 1] = r * Math.sin(p);
    starPos[i * 3 + 2] = r * Math.sin(t) * Math.cos(p) - 12;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  gScene.add(new THREE.Points(starGeo,
    new THREE.PointsMaterial({ color: WHITE, size: 0.3, transparent: true, opacity: 0.65 })
  ));

  // ── HERO SCENE (energy particles in foreground) ───────────────────────────
  const hRenderer = new THREE.WebGLRenderer({ canvas: heroCanvas, alpha: true, antialias: false });
  hRenderer.setPixelRatio(1);
  const hScene  = new THREE.Scene();
  const hCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  hCamera.position.z = 28;

  function resizeHero() {
    const w = heroCanvas.parentElement.clientWidth;
    const h = heroCanvas.parentElement.clientHeight;
    hRenderer.setSize(w, h, false);
    hCamera.aspect = w / h;
    hCamera.updateProjectionMatrix();
  }
  resizeHero();

  const hParticles = [];
  for (let i = 0; i < 30; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.4 ? CYAN : WHITE,
      transparent: true,
      opacity: 0.2 + Math.random() * 0.45
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.18, 4, 3), mat);
    mesh.position.set(
      (Math.random() - 0.5) * 44,
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 8
    );
    hScene.add(mesh);
    hParticles.push({
      mesh,
      vel: { x: (Math.random() - 0.5) * 0.014, y: (Math.random() - 0.5) * 0.009 },
      phase: Math.random() * Math.PI * 2
    });
  }

  // ── SHARED STATE ──────────────────────────────────────────────────────────
  let mx = 0, my = 0;
  document.addEventListener('mousemove', e => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('resize', () => { resizeHero(); resizeGlobal(); }, { passive: true });

  let t = 0, gFrame = 0;

  function animate() {
    requestAnimationFrame(animate);
    t += 0.008;

    // Hero — full framerate
    hParticles.forEach(p => {
      p.mesh.position.x += p.vel.x;
      p.mesh.position.y += p.vel.y;
      if (p.mesh.position.x >  26) p.mesh.position.x = -26;
      if (p.mesh.position.x < -26) p.mesh.position.x =  26;
      if (p.mesh.position.y >  16) p.mesh.position.y = -16;
      if (p.mesh.position.y < -16) p.mesh.position.y =  16;
    });
    hCamera.position.x += (mx * 1.5 - hCamera.position.x) * 0.03;
    hCamera.position.y += (-my * 0.8 - hCamera.position.y) * 0.03;
    hCamera.lookAt(0, 0, 0);
    hRenderer.render(hScene, hCamera);

    // Global brain — every other frame (~30fps)
    gFrame++;
    if (gFrame % 2 === 0) {
      brainGroup.rotation.y += 0.0022;
      brainGroup.rotation.x  = Math.sin(t * 0.28) * 0.1;

      const pulse = 1 + Math.sin(t * 1.9) * 0.024;
      brainGroup.scale.setScalar(pulse);

      flash.material.opacity = 0.12 + Math.sin(t * 2.6) * 0.08;

      rays.forEach(r => {
        r.mesh.material.opacity = r.base * (0.45 + Math.abs(Math.sin(t * 3.5 + r.phase)) * 0.75);
      });

      gCamera.position.x += (mx * 4 - gCamera.position.x) * 0.02;
      gCamera.position.y += (-my * 2.5 - gCamera.position.y) * 0.02;
      gCamera.lookAt(0, 0, 0);
      gRenderer.render(gScene, gCamera);
    }
  }
  animate();
})();
