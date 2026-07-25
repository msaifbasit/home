/* ============================================================
   bg-scene.js — animated 3D background, dependency-free WebGL
   A neural-network style particle field (nodes + links) with a
   floating wireframe icosahedron. Hand-written WebGL (~14KB)
   instead of a 3D library, so there is nothing heavy to parse
   or compile — the scene boots instantly even on slow phones.

   Lines are drawn as screen-space ribbons with shader-based
   antialiasing (browsers often ignore MSAA on OffscreenCanvas,
   which would leave 1px GL lines pixelated). Runs on the main
   thread or inside a Web Worker; never references
   window/document. Tune particle counts in config.js → scene.
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
  return [
    cy, 0, -sy, 0,
    sx * sy, cx, sx * cy, 0,
    cx * sy, -sx, cx * cy, 0,
    px, py, pz, 1,
  ];
}

/* ---------- icosahedron wireframe edge list ---------- */
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
      out.push([verts[i], verts[j]]);
    }
  }
  return out; // array of [[ax,ay,az],[bx,by,bz]]
}

/* ---------- ribbon-line vertex packing ----------
   Each segment becomes 2 triangles (6 vertices). Every vertex
   carries both endpoints plus (endpointSelector, side) so the
   vertex shader can expand the segment sideways in screen space. */
const FLOATS_PER_SEG = 6 * 8;
function packSegment(arr, off, ax, ay, az, bx, by, bz) {
  const quad = [
    [0, -1], [0, 1], [1, 1],
    [0, -1], [1, 1], [1, -1],
  ];
  for (let v = 0; v < 6; v++) {
    const o = off + v * 8;
    arr[o] = ax; arr[o + 1] = ay; arr[o + 2] = az;
    arr[o + 3] = bx; arr[o + 4] = by; arr[o + 5] = bz;
    arr[o + 6] = quad[v][0]; arr[o + 7] = quad[v][1];
  }
}
function packEdgeList(edges) {
  const arr = new Float32Array(edges.length * FLOATS_PER_SEG);
  edges.forEach(([a, b], i) =>
    packSegment(arr, i * FLOATS_PER_SEG, a[0], a[1], a[2], b[0], b[1], b[2]));
  return arr;
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
varying vec3 vColor; varying float vFog; varying float vSize;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  float d = max(gl_Position.w, 0.1);
  gl_PointSize = clamp(uScale * 0.09 / d, 2.0, 20.0);
  vSize = gl_PointSize;
  vColor = aColor;
  float fd = 0.035 * d;
  vFog = exp(-fd * fd);
}`;
const POINT_FS = `
precision mediump float;
varying vec3 vColor; varying float vFog; varying float vSize;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // ~1.2px of feather regardless of dot size: smooth edge, not blurry.
  // pow ≈ sRGB lift, matching how a Three.js pipeline would look.
  float feather = clamp(1.2 / vSize, 0.03, 0.35);
  float edge = smoothstep(0.5, 0.5 - feather, d);
  float a = pow(0.9 * vFog, 0.4545) * edge;
  gl_FragColor = vec4(vColor, a);
}`;
const RIBBON_VS = `
attribute vec3 aStart; attribute vec3 aEnd; attribute vec2 aParam;
uniform mat4 uMVP; uniform vec2 uViewport; uniform float uHalfWidth;
varying float vFog; varying float vSide;
void main() {
  vec4 c0 = uMVP * vec4(aStart, 1.0);
  vec4 c1 = uMVP * vec4(aEnd, 1.0);
  vec4 cur = mix(c0, c1, aParam.x);
  vec2 vp2 = uViewport * 0.5;
  vec2 s0 = c0.xy / max(c0.w, 0.1) * vp2;
  vec2 s1 = c1.xy / max(c1.w, 0.1) * vp2;
  vec2 dir = s1 - s0;
  float len = max(length(dir), 0.0001);
  vec2 nrm = vec2(-dir.y, dir.x) / len;
  cur.xy += nrm * aParam.y * uHalfWidth / vp2 * cur.w;
  gl_Position = cur;
  vSide = aParam.y;
  float fd = 0.035 * max(cur.w, 0.1);
  vFog = exp(-fd * fd);
}`;
const RIBBON_FS = `
precision mediump float;
uniform vec3 uColor; uniform float uOpacity;
varying float vFog; varying float vSide;
void main() {
  // solid core with a soft antialiased edge across the ribbon width
  float edge = 1.0 - smoothstep(0.45, 1.0, abs(vSide));
  // pow ≈ sRGB lift, matching how a Three.js pipeline would look
  gl_FragColor = vec4(uColor, pow(uOpacity * vFog, 0.4545) * edge);
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
  // Native resolution capped at 2x, exactly like the original renderer;
  // antialiasing comes from the shaders, so no MSAA is needed and
  // phones don't pay for a 3x framebuffer.
  const maxDpr = 2;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
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
  const ribbonProg = buildProgram(gl, RIBBON_VS, RIBBON_FS);
  const loc = {
    pPos: gl.getAttribLocation(pointProg, "aPos"),
    pColor: gl.getAttribLocation(pointProg, "aColor"),
    pMVP: gl.getUniformLocation(pointProg, "uMVP"),
    pScale: gl.getUniformLocation(pointProg, "uScale"),
    rStart: gl.getAttribLocation(ribbonProg, "aStart"),
    rEnd: gl.getAttribLocation(ribbonProg, "aEnd"),
    rParam: gl.getAttribLocation(ribbonProg, "aParam"),
    rMVP: gl.getUniformLocation(ribbonProg, "uMVP"),
    rViewport: gl.getUniformLocation(ribbonProg, "uViewport"),
    rHalfWidth: gl.getUniformLocation(ribbonProg, "uHalfWidth"),
    rColor: gl.getUniformLocation(ribbonProg, "uColor"),
    rOpacity: gl.getUniformLocation(ribbonProg, "uOpacity"),
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

  /* ----- link ribbons (rebuilt every frame) ----- */
  const maxLinks = COUNT * 6;
  const linkArr = new Float32Array(maxLinks * FLOATS_PER_SEG);
  const linkBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuf);
  gl.bufferData(gl.ARRAY_BUFFER, linkArr.byteLength, gl.DYNAMIC_DRAW);

  /* ----- icosahedra ribbons (static geometry) ----- */
  const icoBaseY = p.isMobile ? 3.5 : 1.5;
  const icoX = p.isMobile ? 0 : 5.5;
  const icoOuterArr = packEdgeList(icosahedronEdges(2.4, 1));
  const icoInnerArr = packEdgeList(icosahedronEdges(1.15, 0));
  const icoOuterBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, icoOuterBuf);
  gl.bufferData(gl.ARRAY_BUFFER, icoOuterArr, gl.STATIC_DRAW);
  const icoInnerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, icoInnerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, icoInnerArr, gl.STATIC_DRAW);

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

    // rebuild the link ribbons between close nodes
    let linkCount = 0;
    const maxD2 = LINK_DIST * LINK_DIST;
    for (let i = 0; i < COUNT && linkCount < maxLinks; i++) {
      for (let j = i + 1; j < COUNT && linkCount < maxLinks; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < maxD2) {
          packSegment(linkArr, linkCount * FLOATS_PER_SEG,
            positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
            positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
          linkCount++;
        }
      }
    }

    // camera: mouse parallax + gentle scroll dolly
    const par = p.parallax || { x: 3.2, y: 2.2, ease: 0.06 };
    cam.x += (mouse.x * par.x - cam.x) * par.ease;
    cam.y += (-mouse.y * par.y - scrollY * 0.0012 - cam.y) * par.ease;
    const viewProj = mat4Multiply(proj, mat4LookAt(cam.x, cam.y, 11, 0, 0, 0));

    gl.clear(gl.COLOR_BUFFER_BIT);

    // ribbons (links + icosahedra)
    gl.useProgram(ribbonProg);
    gl.uniform2f(loc.rViewport, canvas.width, canvas.height);
    gl.uniform1f(loc.rHalfWidth, 0.65 * dpr);
    gl.enableVertexAttribArray(loc.rStart);
    gl.enableVertexAttribArray(loc.rEnd);
    gl.enableVertexAttribArray(loc.rParam);
    const bindRibbon = (buffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(loc.rStart, 3, gl.FLOAT, false, 32, 0);
      gl.vertexAttribPointer(loc.rEnd, 3, gl.FLOAT, false, 32, 12);
      gl.vertexAttribPointer(loc.rParam, 2, gl.FLOAT, false, 32, 24);
    };
    const drawRibbons = (buffer, segCount, mvp, color, opacity, sub) => {
      gl.uniformMatrix4fv(loc.rMVP, false, mvp);
      gl.uniform3fv(loc.rColor, color);
      gl.uniform1f(loc.rOpacity, opacity);
      bindRibbon(buffer);
      if (sub) gl.bufferSubData(gl.ARRAY_BUFFER, 0, sub);
      gl.drawArrays(gl.TRIANGLES, 0, segCount * 6);
    };
    const icoY = icoBaseY + Math.sin(t * 0.6) * 0.35;
    drawRibbons(linkBuf, linkCount, viewProj, accent, 0.14,
      linkArr.subarray(0, linkCount * FLOATS_PER_SEG));
    drawRibbons(icoOuterBuf, icoOuterArr.length / FLOATS_PER_SEG,
      mat4Multiply(viewProj, mat4Model(t * 0.12, t * 0.18, icoX, icoY, -2)),
      accent2, 0.16);
    drawRibbons(icoInnerBuf, icoInnerArr.length / FLOATS_PER_SEG,
      mat4Multiply(viewProj, mat4Model(-t * 0.25, -t * 0.2, icoX, icoY, -2)),
      accent, 0.28);
    gl.disableVertexAttribArray(loc.rStart);
    gl.disableVertexAttribArray(loc.rEnd);
    gl.disableVertexAttribArray(loc.rParam);

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
