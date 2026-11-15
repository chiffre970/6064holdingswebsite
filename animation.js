"use strict";

(() => {
  const output = document.getElementById("ascii-cube");
  const toggle = document.getElementById("motion-toggle");
  if (!output || !toggle) return;

  const COLUMNS = 57;
  const ROWS = 31;
  const CENTER_X = (COLUMNS - 1) / 2;
  const CENTER_Y = (ROWS - 1) / 2;
  const CUBE_ROOT_TWO = 6064 / 4813;
  const FRAME_INTERVAL = 1000 / 22;
  const BASE_YAW = 0.55;

  const VERTICES = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1]
  ];

  const EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function project(yaw, pitch, scale) {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosX = Math.cos(pitch);
    const sinX = Math.sin(pitch);
    const roll = 0.03;
    const cosZ = Math.cos(roll);
    const sinZ = Math.sin(roll);

    const points = VERTICES.map(([x, y, z]) => {
      const xYaw = x * cosY + z * sinY;
      const zYaw = -x * sinY + z * cosY;
      const yPitch = y * cosX - zYaw * sinX;
      const zPitch = y * sinX + zYaw * cosX;
      const xRoll = xYaw * cosZ - yPitch * sinZ;
      const yRoll = xYaw * sinZ + yPitch * cosZ;
      const perspective = 4.4 / (4.4 - zPitch);

      return [
        xRoll * perspective * 14 * scale,
        yRoll * perspective * 7.2 * scale
      ];
    });

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return points.map(([x, y]) => [
      Math.round(CENTER_X - (minX + maxX) / 2 + x),
      Math.round(CENTER_Y + (minY + maxY) / 2 - y)
    ]);
  }

  function lineGlyph(dx, dy) {
    const slope = Math.abs(dy) / Math.max(Math.abs(dx), 0.0001);
    if (slope > 1.65) return "|";
    if (slope < 0.45) return "-";
    return dx * dy > 0 ? "\\" : "/";
  }

  function drawCube(yaw, pitch, scale) {
    const grid = Array.from(
      { length: ROWS },
      () => Array(COLUMNS).fill(" ")
    );
    const points = project(yaw, pitch, scale);

    function plot(x, y, glyph) {
      const column = Math.round(x);
      const row = Math.round(y);
      if (column >= 0 && column < COLUMNS && row >= 0 && row < ROWS) {
        grid[row][column] = glyph;
      }
    }

    for (const [start, end] of EDGES) {
      const [x1, y1] = points[start];
      const [x2, y2] = points[end];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const steps = Math.max(
        2,
        Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2)
      );
      const glyph = lineGlyph(dx, dy);

      for (let step = 0; step <= steps; step += 1) {
        plot(x1 + (dx * step) / steps, y1 + (dy * step) / steps, glyph);
      }
    }

    for (const [x, y] of points) plot(x, y, "+");

    output.textContent = grid
      .map((row) => row.join("").replace(/\s+$/, ""))
      .join("\n");
  }

  let animationTime = 0;
  let rafId = null;
  let lastTimestamp = null;
  let lastPaint = 0;
  let userPaused = false;

  function renderMotion(time) {
    const yaw = BASE_YAW + time * 0.12;
    const pitch = -0.34 + 0.045 * Math.sin(time * 0.23);
    const breath = 0.5 - 0.5 * Math.cos((time % 14) * (Math.PI / 7));
    const scale = 1 + (CUBE_ROOT_TWO - 1) * breath;
    drawCube(yaw, pitch, scale);
  }

  function frame(now) {
    if (lastTimestamp === null) {
      lastTimestamp = now;
      lastPaint = now - FRAME_INTERVAL;
    }

    animationTime += (now - lastTimestamp) / 1000;
    lastTimestamp = now;

    if (now - lastPaint >= FRAME_INTERVAL) {
      renderMotion(animationTime);
      lastPaint = now;
    }

    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (rafId !== null) return;
    lastTimestamp = null;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
  }

  function syncToggle() {
    if (rafId !== null) {
      toggle.textContent = "Pause animation";
    } else if (reducedMotion.matches && !userPaused) {
      toggle.textContent = "Play animation";
    } else {
      toggle.textContent = "Resume animation";
    }
  }

  function handleVisibility() {
    if (document.hidden) {
      stop();
    } else if (!userPaused && !reducedMotion.matches) {
      start();
    }
    syncToggle();
  }

  function handleMotionPreference(event) {
    if (event.matches) {
      stop();
    } else if (!userPaused && !document.hidden) {
      start();
    }
    syncToggle();
  }

  toggle.addEventListener("click", () => {
    if (rafId !== null) {
      stop();
      userPaused = true;
    } else {
      userPaused = false;
      start();
    }
    syncToggle();
  });

  document.addEventListener("visibilitychange", handleVisibility);
  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", handleMotionPreference);
  } else {
    reducedMotion.addListener(handleMotionPreference);
  }

  renderMotion(0);
  toggle.hidden = false;
  if (!document.hidden && !reducedMotion.matches) start();
  syncToggle();
})();
