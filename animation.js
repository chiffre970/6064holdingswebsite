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
  const SUBDIVISIONS = 22;
  const FULL_TURN_SECONDS = 24;
  const BASE_YAW = 0.45;
  const TILT = 0.19;
  const CENTER_Y = 0.35;
  const TAU = Math.PI * 2;
  const INK = "#24231f";
  const LIGHT = normalize([-0.42, 0.68, 0.6]);

  const APEX = [0, 1.8, 0];
  const BASE = [
    [1, -0.8, 1],
    [-1, -0.8, 1],
    [-1, -0.8, -1],
    [1, -0.8, -1]
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

  function hash32(value) {
    let hash = value | 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    return (hash ^ (hash >>> 16)) >>> 0;
  }

  function glyphFor(faceIndex, row, column) {
    const value =
      hash32(faceIndex * 101 + row * 43 + column * 19) % 100;
    if (value < 44) return ".";
    if (value < 71) return ":";
    if (value < 91) return "+";
    return "*";
  }

  function sampleFace(vertices, faceIndex) {
    const [a, b, c] = vertices;
    const samples = [];

    for (let row = 0; row <= SUBDIVISIONS; row += 1) {
      const t = row / SUBDIVISIONS;
      for (let column = 0; column <= row; column += 1) {
        const v = row === 0 ? 0 : column / row;
        const aWeight = 1 - t;
        const bWeight = t * (1 - v);
        const cWeight = t * v;
        samples.push({
          x: a[0] * aWeight + b[0] * bWeight + c[0] * cWeight,
          y: a[1] * aWeight + b[1] * bWeight + c[1] * cWeight,
          z: a[2] * aWeight + b[2] * bWeight + c[2] * cWeight,
          glyph: glyphFor(faceIndex, row, column)
        });
      }
    }

    return samples;
  }

  const FACES = BASE.map((corner, index) => {
    const vertices = [APEX, BASE[(index + 1) % BASE.length], corner];
    return {
      normal: normalOf(vertices[0], vertices[1], vertices[2]),
      samples: sampleFace(vertices, index)
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

  function draw(motionPhase) {
    if (cssWidth <= 0 || cssHeight <= 0) return false;

    const scale =
      CAMERA_SCALE *
      Math.min(cssWidth / REFERENCE_WIDTH, cssHeight / REFERENCE_HEIGHT);
    const fontSize = Math.max(6, Math.min(11, scale * 0.0913));
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

    for (const face of FACES) {
      const normalX = face.normal[0] * cosYaw + face.normal[2] * sinYaw;
      const normalZYaw =
        -face.normal[0] * sinYaw + face.normal[2] * cosYaw;
      const normalY = face.normal[1] * cosTilt - normalZYaw * sinTilt;
      const normalZ = face.normal[1] * sinTilt + normalZYaw * cosTilt;

      if (normalZ <= 0) continue;

      const diffuse = Math.max(
        0,
        normalX * LIGHT[0] + normalY * LIGHT[1] + normalZ * LIGHT[2]
      );
      context.globalAlpha = 0.28 + 0.67 * Math.pow(diffuse, 0.85);

      for (const sample of face.samples) {
        const sampleY = sample.y - CENTER_Y;
        const cameraX = sample.x * cosYaw + sample.z * sinYaw;
        const cameraZYaw =
          -sample.x * sinYaw + sample.z * cosYaw;
        const cameraY =
          sampleY * cosTilt - cameraZYaw * sinTilt;
        const x = centerX + cameraX * scale;
        const y = centerY - cameraY * scale;

        if (x < -fontSize || x > cssWidth + fontSize) continue;
        if (y < -fontSize || y > cssHeight + fontSize) continue;
        context.fillText(sample.glyph, x, y);
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
    draw(phase);
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
    draw(phase);
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
