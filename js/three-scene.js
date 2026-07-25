/* ============================================================
   three-scene.js — animated 3D background (environment-agnostic)
   A neural-network style particle field (nodes + links) with a
   floating wireframe icosahedron. Runs identically on the main
   thread or inside a Web Worker with an OffscreenCanvas — so it
   never references window/document. The caller feeds it sizes
   and input through the returned API. Tune particle counts in
   config.js → scene.
   ============================================================ */

import * as THREE from "./vendor/three.module.min.js";

export function initScene(canvas, p) {
  // p: { width, height, pixelRatio, isMobile,
  //      accent, accent2, particleCount, linkDistance }
  const COUNT = p.isMobile
    ? Math.floor(p.particleCount * 0.55)
    : p.particleCount;
  const LINK_DIST = p.linkDistance;
  const accent = new THREE.Color(p.accent);
  const accent2 = new THREE.Color(p.accent2);

  // Lighter GPU/CPU settings on phones: no MSAA, lower resolution cap
  const maxDpr = p.isMobile ? 1.5 : 2;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !p.isMobile,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(p.pixelRatio, maxDpr));
  renderer.setSize(p.width, p.height, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.035);

  const camera = new THREE.PerspectiveCamera(60, p.width / p.height, 0.1, 100);
  camera.position.z = 11;

  /* ----- Particle nodes ----- */
  const BOUNDS = { x: 16, y: 10, z: 7 };
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const velocities = [];

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * BOUNDS.x * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * BOUNDS.y * 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2;
    velocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.012,
        (Math.random() - 0.5) * 0.012,
        (Math.random() - 0.5) * 0.008
      )
    );
    const c = accent.clone().lerp(accent2, Math.random());
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pointsGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    pointsGeo,
    new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
    })
  );
  scene.add(points);

  /* ----- Links between nearby nodes ----- */
  const maxLinks = COUNT * 6;
  const linkPositions = new Float32Array(maxLinks * 6);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(linkPositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  const links = new THREE.LineSegments(
    linkGeo,
    new THREE.LineBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
  );
  scene.add(links);

  /* ----- Floating wireframe icosahedron ----- */
  const icoBaseY = p.isMobile ? 3.5 : 1.5;
  const ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.4, 1),
    new THREE.MeshBasicMaterial({
      color: accent2,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    })
  );
  ico.position.set(p.isMobile ? 0 : 5.5, icoBaseY, -2);
  scene.add(ico);

  const icoInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 0),
    new THREE.MeshBasicMaterial({
      color: accent,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    })
  );
  icoInner.position.copy(ico.position);
  scene.add(icoInner);

  /* ----- State driven from outside ----- */
  const mouse = { x: 0, y: 0 };
  let scrollY = 0;
  let paused = false;

  /* ----- Animation loop ----- */
  const clock = new THREE.Clock();

  function frame() {
    if (paused) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // Drift the nodes, wrapping softly at the bounds
    const pos = pointsGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const v = velocities[i];
      pos[i * 3] += v.x * dt * 60;
      pos[i * 3 + 1] += v.y * dt * 60;
      pos[i * 3 + 2] += v.z * dt * 60;
      if (Math.abs(pos[i * 3]) > BOUNDS.x) v.x *= -1;
      if (Math.abs(pos[i * 3 + 1]) > BOUNDS.y) v.y *= -1;
      if (Math.abs(pos[i * 3 + 2]) > BOUNDS.z) v.z *= -1;
    }
    pointsGeo.attributes.position.needsUpdate = true;

    // Rebuild the links between close nodes
    let linkCount = 0;
    const lp = linkGeo.attributes.position.array;
    for (let i = 0; i < COUNT && linkCount < maxLinks; i++) {
      for (let j = i + 1; j < COUNT && linkCount < maxLinks; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < LINK_DIST * LINK_DIST) {
          lp[linkCount * 6]     = pos[i * 3];
          lp[linkCount * 6 + 1] = pos[i * 3 + 1];
          lp[linkCount * 6 + 2] = pos[i * 3 + 2];
          lp[linkCount * 6 + 3] = pos[j * 3];
          lp[linkCount * 6 + 4] = pos[j * 3 + 1];
          lp[linkCount * 6 + 5] = pos[j * 3 + 2];
          linkCount++;
        }
      }
    }
    linkGeo.setDrawRange(0, linkCount * 2);
    linkGeo.attributes.position.needsUpdate = true;

    // Rotate the icosahedra
    ico.rotation.x = t * 0.12;
    ico.rotation.y = t * 0.18;
    icoInner.rotation.x = -t * 0.25;
    icoInner.rotation.y = -t * 0.2;
    ico.position.y = icoBaseY + Math.sin(t * 0.6) * 0.35;
    icoInner.position.y = ico.position.y;

    // Camera: mouse parallax + gentle scroll dolly
    camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.04;
    camera.position.y += (-mouse.y * 0.8 - scrollY * 0.0012 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  // setAnimationLoop works on the main thread and in workers alike
  renderer.setAnimationLoop(frame);

  /* ----- API for the host (main thread or worker shell) ----- */
  return {
    pointer(x, y) { mouse.x = x; mouse.y = y; },
    scroll(y) { scrollY = y; },
    resize(width, height, pixelRatio) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(pixelRatio, maxDpr));
      renderer.setSize(width, height, false);
    },
    setPaused(hidden) {
      paused = hidden;
      if (!paused) clock.getDelta(); // avoid a big jump after returning
    },
  };
}
