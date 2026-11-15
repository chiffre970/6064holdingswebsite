"use strict";

(() => {
  const figure = document.querySelector(".figure");
  const fallback = document.querySelector(".pyramid-fallback");
  const canvas = document.getElementById("pyramid-canvas");
  if (!figure || !fallback || !canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const REFERENCE_WIDTH = 460;
  const REFERENCE_HEIGHT = 440;
  const CAMERA_SCALE = 115;
  const FULL_TURN_SECONDS = 24;
  const BASE_YAW = 0.45;
  const TILT = 0.19;
  const CENTER_Y = 0.35;
  const TAU = Math.PI * 2;
  const INK = "#24231f";
  const RAMP = [".", ":", "-", "+", "*"];
  const EDGE_GLYPH = "#";
  const EDGE_WIDTH = 0.75;
  const LIGHT = normalize([-0.42, 0.68, 0.6]);

  const APEX = [0, 1.8, 0];
  const BASE = [
    [1.3, -0.8, 1.3],
    [-1.3, -0.8, 1.3],
    [-1.3, -0.8, -1.3],
    [1.3, -0.8, -1.3]
  ];

  function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    return vector.map((component) => component / length);
  }

  function normalOf(a, b, c) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return normalize([
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]
    ]);
  }

  const FACES = BASE.map((corner, index) => {
    const vertices = [APEX, BASE[(index + 1) % BASE.length], corner];
    return {
      vertices,
      normal: normalOf(vertices[0], vertices[1], vertices[2])
    };
  });

  let cssWidth = 0;
  let cssHeight = 0;
  let phase = 0;
  let rafId = null;
  let lastFrameTime = null;
  let revealed = false;

  function resizeCanvas() {
    const rect = figure.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));

    cssWidth = width;
    cssHeight = height;

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
  }

  // Distance in pixels from point p to segment a-b.
  function distanceToSegment(px, py, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy))
    );
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }

  function inTriangle(px, py, a, b, c) {
    const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
    const d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]);
    const d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]);
    const negative = d1 < 0 || d2 < 0 || d3 < 0;
    const positive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(negative && positive);
  }

  function draw(motionPhase) {
    if (cssWidth <= 0 || cssHeight <= 0) return false;

    const scale =
      CAMERA_SCALE *
      Math.min(cssWidth / REFERENCE_WIDTH, cssHeight / REFERENCE_HEIGHT);
    const fontSize = Math.max(6, Math.min(11, scale * 0.075));
    const cellWidth = fontSize * 0.62;
    const cellHeight = fontSize * 1.05;
    const yaw = BASE_YAW + motionPhase * (TAU / FULL_TURN_SECONDS);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosTilt = Math.cos(TILT);
    const sinTilt = Math.sin(TILT);
    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2;
    const pixelScaleX = canvas.width / cssWidth;
    const pixelScaleY = canvas.height / cssHeight;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelScaleX, 0, 0, pixelScaleY, 0, 0);
    context.fillStyle = INK;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font =
      `${fontSize.toFixed(2)}px ui-monospace, SFMono-Regular, Menlo, ` +
      `Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

    const project = (point) => {
      const y = point[1] - CENTER_Y;
      const cameraX = point[0] * cosYaw + point[2] * sinYaw;
      const cameraZ = -point[0] * sinYaw + point[2] * cosYaw;
      const cameraY = y * cosTilt - cameraZ * sinTilt;
      return [centerX + cameraX * scale, centerY - cameraY * scale];
    };

    for (const face of FACES) {
      const normalX = face.normal[0] * cosYaw + face.normal[2] * sinYaw;
      const normalZYaw = -face.normal[0] * sinYaw + face.normal[2] * cosYaw;
      const normalY = face.normal[1] * cosTilt - normalZYaw * sinTilt;
      const normalZ = face.normal[1] * sinTilt + normalZYaw * cosTilt;

      if (normalZ <= 0) continue;

      const diffuse = Math.max(
        0,
        normalX * LIGHT[0] + normalY * LIGHT[1] + normalZ * LIGHT[2]
      );
      const shade = Math.min(1, 0.1 + 0.9 * Math.pow(diffuse, 0.8));
      const glyph = RAMP[Math.min(RAMP.length - 1, Math.floor(shade * RAMP.length))];
      const [a, b, c] = face.vertices.map(project);

      const minX = Math.min(a[0], b[0], c[0]);
      const maxX = Math.max(a[0], b[0], c[0]);
      const minY = Math.min(a[1], b[1], c[1]);
      const maxY = Math.max(a[1], b[1], c[1]);
      const firstColumn = Math.floor((minX - centerX) / cellWidth);
      const lastColumn = Math.ceil((maxX - centerX) / cellWidth);
      const firstRow = Math.floor((minY - centerY) / cellHeight);
      const lastRow = Math.ceil((maxY - centerY) / cellHeight);

      for (let row = firstRow; row <= lastRow; row += 1) {
        const y = centerY + row * cellHeight;
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const x = centerX + column * cellWidth;
          if (!inTriangle(x, y, a, b, c)) continue;

          const edgeDistance = Math.min(
            distanceToSegment(x, y, a, b),
            distanceToSegment(x, y, b, c),
            distanceToSegment(x, y, c, a)
          );
          const onEdge = edgeDistance < cellHeight * EDGE_WIDTH * 0.5;
          context.globalAlpha = onEdge ? 0.95 : 0.5 + 0.45 * shade;
          context.fillText(onEdge ? EDGE_GLYPH : glyph, x, y);
        }
      }
    }

    context.globalAlpha = 1;
    return true;
  }

  function revealCanvas() {
    if (revealed) return;
    canvas.hidden = false;
    fallback.hidden = true;
    revealed = true;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function frame(timestamp) {
    if (lastFrameTime !== null) {
      phase += (timestamp - lastFrameTime) / 1000;
    }
    lastFrameTime = timestamp;
    if (draw(phase)) revealCanvas();
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (rafId !== null || reducedMotion.matches || document.hidden) return;
    lastFrameTime = null;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
    }
    rafId = null;
    lastFrameTime = null;
  }

  function handleResize() {
    resizeCanvas();
    if (draw(phase)) revealCanvas();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  function handleMotionPreference(event) {
    if (event.matches) {
      stop();
      draw(phase);
    } else {
      start();
    }
  }

  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", handleMotionPreference);
  } else {
    reducedMotion.addListener(handleMotionPreference);
  }

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(handleResize);
    observer.observe(figure);
  }
  window.addEventListener("resize", handleResize);

  resizeCanvas();
  if (draw(0)) revealCanvas();
  start();
})();
