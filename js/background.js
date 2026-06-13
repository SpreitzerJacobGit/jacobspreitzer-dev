// Single shared Three.js renderer for both hero + global background
(function () {
  const heroCanvas = document.getElementById('hero-canvas');
  const globalCanvas = document.getElementById('global-canvas');

  // ── HERO SCENE ─────────────────────────────────────────────────────────────
  const hRenderer = new THREE.WebGLRenderer({ canvas: heroCanvas, alpha: true, antialias: false });
  hRenderer.setPixelRatio(1);

  const hScene = new THREE.Scene();
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

  // Shared geometries — reused across all meshes, no cloning
  const sharedGeos = [
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.OctahedronGeometry(1, 0),
    new THREE.TetrahedronGeometry(1, 0),
    new THREE.CylinderGeometry(0, 0.9, 1.6, 5),
  ];
  const colors = [0x7dab5a, 0x5a8c3a, 0xc4874a, 0x4a7a3a, 0x9bc46a, 0xa87040];

  const hParticles = [];
  const hCount = 22; // reduced from 38
  for (let i = 0; i < hCount; i++) {
    const geo = sharedGeos[i % sharedGeos.length];
    const mat = new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      transparent: true,
      opacity: 0.1 + Math.random() * 0.22,
      wireframe: Math.random() > 0.45,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 44,
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 12
    );
    mesh.scale.setScalar(0.5 + Math.random() * 1.8);
    const vel = { x: (Math.random() - 0.5) * 0.01, y: (Math.random() - 0.5) * 0.007 };
    const rot = { x: (Math.random() - 0.5) * 0.007, y: (Math.random() - 0.5) * 0.007 };
    hScene.add(mesh);
    hParticles.push({ mesh, vel, rot, phase: Math.random() * Math.PI * 2 });
  }

  // ── GLOBAL SCENE ──────────────────────────────────────────────────────────
  const gRenderer = new THREE.WebGLRenderer({ canvas: globalCanvas, alpha: true, antialias: false });
  gRenderer.setPixelRatio(1);

  const gScene = new THREE.Scene();
  const gCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  gCamera.position.z = 60;

  function resizeGlobal() {
    const w = window.innerWidth, h = window.innerHeight;
    gRenderer.setSize(w, h, false);
    gCamera.aspect = w / h;
    gCamera.updateProjectionMatrix();
  }
  resizeGlobal();

  const wireMats = [
    new THREE.MeshBasicMaterial({ color: 0x7dab5a, wireframe: true }),
    new THREE.MeshBasicMaterial({ color: 0xc4874a, wireframe: true }),
    new THREE.MeshBasicMaterial({ color: 0x4a7a3a, wireframe: true }),
  ];
  // Reuse geometries — no cloning
  const gGeos = [
    new THREE.IcosahedronGeometry(7, 1),
    new THREE.OctahedronGeometry(6, 0),
    new THREE.IcosahedronGeometry(9, 1),
    new THREE.OctahedronGeometry(5, 0),
    new THREE.TorusGeometry(5, 1.2, 5, 12),
    new THREE.OctahedronGeometry(8, 0),
  ];
  const gObjects = [];
  gGeos.forEach((geo, i) => {
    const mesh = new THREE.Mesh(geo, wireMats[i % wireMats.length]);
    const angle = (i / gGeos.length) * Math.PI * 2;
    const radius = 20 + Math.random() * 25;
    mesh.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20 - 10);
    const rotSpeed = { x: (Math.random() - 0.5) * 0.003, y: (Math.random() - 0.5) * 0.004 };
    gScene.add(mesh);
    gObjects.push({ mesh, rotSpeed, orbitAngle: angle, orbitRadius: radius, orbitSpeed: 0.0003 + Math.random() * 0.0003, baseY: mesh.position.y, phase: Math.random() * Math.PI * 2 });
  });

  const centerMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(14, 1),
    new THREE.MeshBasicMaterial({ color: 0x5a8c3a, wireframe: true })
  );
  centerMesh.position.z = -30;
  gScene.add(centerMesh);

  // ── SHARED STATE ──────────────────────────────────────────────────────────
  let mx = 0, my = 0;
  document.addEventListener('mousemove', e => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('resize', () => { resizeHero(); resizeGlobal(); }, { passive: true });

  let t = 0;
  let gFrame = 0; // global scene runs at half rate

  function animate() {
    requestAnimationFrame(animate);
    t += 0.008;

    // Hero — full framerate
    hParticles.forEach(p => {
      p.mesh.position.x += p.vel.x;
      p.mesh.position.y += p.vel.y;
      if (p.mesh.position.x > 26) p.mesh.position.x = -26;
      if (p.mesh.position.x < -26) p.mesh.position.x = 26;
      if (p.mesh.position.y > 16) p.mesh.position.y = -16;
      if (p.mesh.position.y < -16) p.mesh.position.y = 16;
      p.mesh.rotation.x += p.rot.x;
      p.mesh.rotation.y += p.rot.y;
    });
    hCamera.position.x += (mx * 1.5 - hCamera.position.x) * 0.03;
    hCamera.position.y += (-my * 0.8 - hCamera.position.y) * 0.03;
    hCamera.lookAt(0, 0, 0);
    hRenderer.render(hScene, hCamera);

    // Global — every other frame (effective ~30fps)
    gFrame++;
    if (gFrame % 2 === 0) {
      centerMesh.rotation.y += 0.0016;
      gObjects.forEach(o => {
        o.orbitAngle += o.orbitSpeed * 2;
        o.mesh.position.x = Math.cos(o.orbitAngle) * o.orbitRadius;
        o.mesh.position.y = o.baseY + Math.sin(t * 0.4 + o.phase) * 2;
        o.mesh.rotation.x += o.rotSpeed.x * 2;
        o.mesh.rotation.y += o.rotSpeed.y * 2;
      });
      gRenderer.render(gScene, gCamera);
    }
  }
  animate();
})();
