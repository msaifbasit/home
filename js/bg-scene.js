/* ============================================================
   bg-scene.js — animated 3D background, dependency-free WebGL
   A neural-network style particle field (nodes + links) with a
   floating wireframe icosahedron. Hand-written WebGL (~10KB)
   instead of a 3D library, so there is nothing heavy to parse
   or compile — the scene boots instantly even on slow phones.
   Runs on the main thread or inside a Web Worker with an
   OffscreenCanvas; never references window/document. Tune
   particle counts in config.js → scene.
   ============================================================ */

/* ---------- tiny mat4 helpers (column-major) ---------- */
function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}
function mat4LookAt(ex, ey, ez, tx, ty, tz) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
  // x = up × z with up = (0,1,0)
  let xx = zz, xy = 0, xz = -zx;
  const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  // y = z × x
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return [
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez),
    -(yx * ex + yy * ey + yz * ez),
    -(zx * ex + zy * ey + zz * ez), 1,
  ];
}
function mat4Multiply(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function mat4Model(rx, ry, px, py, pz) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
  // rotY * rotX with translation
  return [
    cy, 0, -sy, 0,
    sx * sy, cx, sx * cy, 0,
    cx * sy, -sx, cx * cy, 0,
    px, py, pz, 1,
  ];
}

/* ---------- icosahedron wireframe geometry ---------- */
function icosahedronEdges(radius, detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => {
    const l = Math.hypot(...v);
    return v.map((c) => (c / l) * radius);
  });
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let d = 0; d < detail; d++) {
    const nf = [];
    const midCache = new Map();
    const mid = (i, j) => {
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (midCache.has(key)) return midCache.get(key);
      const a = verts[i], b = verts[j];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const l = Math.hypot(...m);
      verts.push(m.map((c) => (c / l) * radius));
      midCache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = nf;
  }
  const edgeSet = new Set();
  const out = [];
  for (const [a, b, c] of faces) {
    for (const [i, j] of [[a, b], [b, c], [c, a]]) {
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      out.push(...verts[i], ...verts[j]);
    }
  }
  return new Float32Array(out);
}

/* ---------- hex colour → [r,g,b] 0..1 ---------- */
function hexToRgb(hex, fallback) {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(hex).trim());
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

/* ---------- shaders ---------- */
const POINT_VS = `
attribute vec3 aPos; attribute vec3 aColor;
uniform mat4 uMVP; uniform float uScale;
varying vec3 vColor; varying float vFog;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  float d = max(gl_Position.w, 0.1);
  gl_PointSize = clamp(uScale * 0.09 / d, 1.5, 14.0);
  vColor = aColor;
  float fd = 0.035 * d;
  vFog = exp(-fd * fd);
}`;
const POINT_FS = `
precision mediump float;
varying vec3 vColor; varying float vFog;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // pow ≈ sRGB lift, matching how a Three.js pipeline would look
  float a = pow(smoothstep(0.5, 0.32, d) * 0.9 * vFog, 0.4545);
  gl_FragColor = vec4(vColor, a);
}`;
const LINE_VS = `
attribute vec3 aPos;
uniform mat4 uMVP;
varying float vFog;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  float fd = 0.035 * max(gl_Position.w, 0.1);
  vFog = exp(-fd * fd);
}`;
const LINE_FS = `
precision mediump float;
uniform vec3 uColor; uniform float uOpacity;
varying float vFog;
void main() {
  // pow ≈ sRGB lift, matching how a Three.js pipeline would look
  gl_FragColor = vec4(uColor, pow(uOpacity * vFog, 0.4545));
}`;

function buildProgram(gl, vsSrc, fsSrc) {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

/* ============================================================ */
export function initScene(canvas, p) {
  // p: { width, height, pixelRatio, isMobile,
  //      accent, accent2, particleCount, linkDistance }
  const COUNT = p.isMobile
    ? Math.floor(p.particleCount * 0.55)
    : p.particleCount;
  const LINK_DIST = p.linkDistance;
  const accent = hexToRgb(p.accent, [0.13, 0.83, 0.93]);
  const accent2 = hexToRgb(p.accent2, [0.65, 0.55, 0.98]);
  const maxDpr = p.isMobile ? 1.5 : 2;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: !p.isMobile,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!gl) throw new Error("WebGL unavailable");

  let dpr = Math.min(p.pixelRatio, maxDpr);
  let vw = p.width, vh = p.height;
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const pointProg = buildProgram(gl, POINT_VS, POINT_FS);
  const lineProg = buildProgram(gl, LINE_VS, LINE_FS);
  const loc = {
    pPos: gl.getAttribLocation(pointProg, "aPos"),
    pColor: gl.getAttribLocation(pointProg, "aColor"),
    pMVP: gl.getUniformLocation(pointProg, "uMVP"),
    pScale: gl.getUniformLocation(pointProg, "uScale"),
    lPos: gl.getAttribLocation(lineProg, "aPos"),
    lMVP: gl.getUniformLocation(lineProg, "uMVP"),
    lColor: gl.getUniformLocation(lineProg, "uColor"),
    lOpacity: gl.getUniformLocation(lineProg, "uOpacity"),
  };

  /* ----- particle nodes ----- */
  const BOUNDS = { x: 16, y: 10, z: 7 };
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * BOUNDS.x * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * BOUNDS.y * 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2;
    velocities[i * 3]     = (Math.random() - 0.5) * 0.012;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.012;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.008;
    const k = Math.random();
    colors[i * 3]     = accent[0] + (accent2[0] - accent[0]) * k;
    colors[i * 3 + 1] = accent[1] + (accent2[1] - accent[1]) * k;
    colors[i * 3 + 2] = accent[2] + (accent2[2] - accent[2]) * k;
  }
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  const colBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

  /* ----- links ----- */
  const maxLinks = COUNT * 6;
  const linkArr = new Float32Array(maxLinks * 6);
  const linkBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuf);
  gl.bufferData(gl.ARRAY_BUFFER, linkArr.byteLength, gl.DYNAMIC_DRAW);

  /* ----- icosahedra ----- */
  const icoBaseY = p.isMobile ? 3.5 : 1.5;
  const icoX = p.isMobile ? 0 : 5.5;
  const icoOuter = icosahedronEdges(2.4, 1);
  const icoInner = icosahedronEdges(1.15, 0);
  const icoOuterBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, icoOuterBuf);
  gl.bufferData(gl.ARRAY_BUFFER, icoOuter, gl.STATIC_DRAW);
  const icoInnerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, icoInnerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, icoInner, gl.STATIC_DRAW);

  /* ----- state driven from outside ----- */
  const mouse = { x: 0, y: 0 };
  let scrollY = 0;
  let paused = false;
  const cam = { x: 0, y: 0 };
  const t0 = performance.now();
  let lastT = t0;

  let proj = mat4Perspective((60 * Math.PI) / 180, vw / vh, 0.1, 100);

  function frame() {
    schedule();
    if (paused) { lastT = performance.now(); return; }
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    const t = (now - t0) / 1000;

    // drift the nodes, bouncing softly at the bounds
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] += velocities[i * 3] * dt * 60;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt * 60;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt * 60;
      if (Math.abs(positions[i * 3]) > BOUNDS.x) velocities[i * 3] *= -1;
      if (Math.abs(positions[i * 3 + 1]) > BOUNDS.y) velocities[i * 3 + 1] *= -1;
      if (Math.abs(positions[i * 3 + 2]) > BOUNDS.z) velocities[i * 3 + 2] *= -1;
    }

    // rebuild the links between close nodes
    let linkCount = 0;
    const maxD2 = LINK_DIST * LINK_DIST;
    for (let i = 0; i < COUNT && linkCount < maxLinks; i++) {
      for (let j = i + 1; j < COUNT && linkCount < maxLinks; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < maxD2) {
          const o = linkCount * 6;
          linkArr[o]     = positions[i * 3];
          linkArr[o + 1] = positions[i * 3 + 1];
          linkArr[o + 2] = positions[i * 3 + 2];
          linkArr[o + 3] = positions[j * 3];
          linkArr[o + 4] = positions[j * 3 + 1];
          linkArr[o + 5] = positions[j * 3 + 2];
          linkCount++;
        }
      }
    }

    // camera: mouse parallax + gentle scroll dolly
    cam.x += (mouse.x * 1.2 - cam.x) * 0.04;
    cam.y += (-mouse.y * 0.8 - scrollY * 0.0012 - cam.y) * 0.04;
    const viewProj = mat4Multiply(proj, mat4LookAt(cam.x, cam.y, 11, 0, 0, 0));

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Attribute enables are global GL state, so each draw enables
    // exactly what it uses and disables it again — otherwise a stale
    // enabled attribute with a too-small buffer makes the browser
    // silently skip draw calls.
    const drawLines = (buffer, vertCount, mvp, color, opacity, sub) => {
      gl.uniformMatrix4fv(loc.lMVP, false, mvp);
      gl.uniform3fv(loc.lColor, color);
      gl.uniform1f(loc.lOpacity, opacity);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      if (sub) gl.bufferSubData(gl.ARRAY_BUFFER, 0, sub);
      gl.vertexAttribPointer(loc.lPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, vertCount);
    };

    // links + icosahedra (rotating, gently bobbing)
    gl.useProgram(lineProg);
    gl.enableVertexAttribArray(loc.lPos);
    const icoY = icoBaseY + Math.sin(t * 0.6) * 0.35;
    drawLines(linkBuf, linkCount * 2, viewProj, accent, 0.14,
      linkArr.subarray(0, linkCount * 6));
    drawLines(icoOuterBuf, icoOuter.length / 3,
      mat4Multiply(viewProj, mat4Model(t * 0.12, t * 0.18, icoX, icoY, -2)),
      accent2, 0.16);
    drawLines(icoInnerBuf, icoInner.length / 3,
      mat4Multiply(viewProj, mat4Model(-t * 0.25, -t * 0.2, icoX, icoY, -2)),
      accent, 0.28);
    gl.disableVertexAttribArray(loc.lPos);

    // points
    gl.useProgram(pointProg);
    gl.uniformMatrix4fv(loc.pMVP, false, viewProj);
    gl.uniform1f(loc.pScale, canvas.height / 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.enableVertexAttribArray(loc.pPos);
    gl.vertexAttribPointer(loc.pPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.enableVertexAttribArray(loc.pColor);
    gl.vertexAttribPointer(loc.pColor, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, COUNT);
    gl.disableVertexAttribArray(loc.pPos);
    gl.disableVertexAttribArray(loc.pColor);
  }

  // rAF exists on the main thread and in workers that support
  // OffscreenCanvas rendering; fall back to a timer just in case
  const schedule =
    typeof requestAnimationFrame === "function"
      ? () => requestAnimationFrame(frame)
      : () => setTimeout(frame, 16);
  schedule();

  /* ----- API for the host (main thread or worker shell) ----- */
  return {
    pointer(x, y) { mouse.x = x; mouse.y = y; },
    scroll(y) { scrollY = y; },
    resize(width, height, pixelRatio) {
      vw = width; vh = height;
      dpr = Math.min(pixelRatio, maxDpr);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      proj = mat4Perspective((60 * Math.PI) / 180, vw / vh, 0.1, 100);
    },
    setPaused(hidden) { paused = hidden; },
  };
}
