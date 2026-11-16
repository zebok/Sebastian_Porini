export interface VennRendererParticle {
  readonly id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  r: number;
  g: number;
  b: number;
  group: number;
  baseRadius: number;
  angleOffset: number;
  radiusMultiplier: number;
}

export interface VennMouseState {
  x: number;
  y: number;
  active: boolean;
}

export interface VennCircleState {
  x: number;
  y: number;
  r: number;
  tx: number;
  ty: number;
  tr: number;
  color: { r: number; g: number; b: number };
}

interface ScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TAU = Math.PI * 2;

export const VENN_COLORS: readonly { r: number; g: number; b: number }[] = [
  { r: 45, g: 91, b: 227 }, // 0: Product Vision (Royal Blue)
  { r: 124, g: 58, b: 237 }, // 1: Data Rigor (Purple)
  { r: 5, g: 150, b: 105 }, // 2: Scientific Curiosity (Emerald)
];

const rgba = (
  color: { r: number; g: number; b: number },
  alpha: number
): string =>
  `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(
    color.b
  )}, ${Math.max(0, Math.min(1, alpha)).toFixed(4)})`;

const pseudoRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Reads the exact live bounding boxes of `#venn-circle-0`, `#venn-circle-1`,
 * and `#venn-circle-2` so the canvas circles and DOM elements are 100% locked
 * to the same coordinate space at every instant.
 */
export const updateVennCircleGeometry = (
  circles: VennCircleState[],
  viewportWidth: number,
  viewportHeight: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _selectedCircleIdx: number | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _hoveredCircleIdx: number | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _animateContinuously: boolean
): void => {
  if (typeof document !== "undefined") {
    const c0 = document.getElementById("venn-circle-0");
    const c1 = document.getElementById("venn-circle-1");
    const c2 = document.getElementById("venn-circle-2");

    if (c0 && c1 && c2) {
      const r0 = c0.getBoundingClientRect();
      const r1 = c1.getBoundingClientRect();
      const r2 = c2.getBoundingClientRect();

      if (r0.width > 20 && r1.width > 20 && r2.width > 20) {
        circles[0].x = r0.left + r0.width * 0.5;
        circles[0].y = r0.top + r0.height * 0.5;
        circles[0].r = r0.width * 0.5;

        circles[1].x = r1.left + r1.width * 0.5;
        circles[1].y = r1.top + r1.height * 0.5;
        circles[1].r = r1.width * 0.5;

        circles[2].x = r2.left + r2.width * 0.5;
        circles[2].y = r2.top + r2.height * 0.5;
        circles[2].r = r2.width * 0.5;
        return;
      }
    }
  }

  // Fallback before DOM mounts
  const cx = viewportWidth * 0.5;
  const cy = viewportHeight * 0.54;
  const r = Math.min(viewportWidth, viewportHeight) * 0.18;
  circles[0].x = cx;
  circles[0].y = cy - r * 0.65;
  circles[0].r = r;

  circles[1].x = cx - r * 0.78;
  circles[1].y = cy + r * 0.45;
  circles[1].r = r;

  circles[2].x = cx + r * 0.78;
  circles[2].y = cy + r * 0.45;
  circles[2].r = r;
};

const readActiveConceptAnchors = (selectedIdx: number): ScreenBox[] => {
  const boxes: ScreenBox[] = [];
  if (typeof document === "undefined") return boxes;

  for (let idx = 0; idx < 6; idx++) {
    const el = document.getElementById(`venn-tag-${selectedIdx}-${idx}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        boxes.push({
          x: rect.left + rect.width * 0.5,
          y: rect.top + rect.height * 0.5,
          width: rect.width,
          height: rect.height,
        });
      }
    }
  }
  return boxes;
};

const readActiveTitleBox = (selectedIdx: number): ScreenBox | null => {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(`venn-title-text-${selectedIdx}`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
    width: rect.width,
    height: rect.height,
  };
};

/**
 * Computes fluid target coordinates for all 720 particles across the 3 Venn circles.
 *
 * - In Overview / Hover (1st animation):
 *   Particles form a living perimeter + organic internal currents + rich intersection swarms.
 * - In Immersion / Click (2nd animation):
 *   Particles of the selected circle form a grand breathing membrane, living streams from
 *   the central core to each floating concept inside the circle, and orbital halos around
 *   each concept, while companion circles pulse in their overlapping border positions.
 */
export const setVennParticleTargets = (
  particles: VennRendererParticle[],
  circles: VennCircleState[],
  selectedCircleIdx: number | null,
  hoveredCircleIdx: number | null,
  frameCount: number
): void => {
  const conceptBoxes =
    selectedCircleIdx !== null
      ? readActiveConceptAnchors(selectedCircleIdx)
      : [];
  const titleBox =
    selectedCircleIdx !== null ? readActiveTitleBox(selectedCircleIdx) : null;

  const groupCounts = [0, 0, 0];
  const centerAllX = (circles[0].x + circles[1].x + circles[2].x) / 3;
  const centerAllY = (circles[0].y + circles[1].y + circles[2].y) / 3;

  particles.forEach((node) => {
    const g = node.group % 3;
    const slot = groupCounts[g]++;
    const circle = circles[g];
    const isHovered = hoveredCircleIdx === g;
    const isSelected = selectedCircleIdx === g;

    // ─── STATE 1: 3-CIRCLE OVERVIEW (+ HOVER 1ST ANIMATION) ────────────────
    if (selectedCircleIdx === null) {
      // 1A. Living Perimeter Ring (Slots 0..69)
      if (slot < 70) {
        const baseAngle = (slot / 70) * TAU;
        const speed = (isHovered ? 0.0032 : 0.0014) * (g % 2 === 0 ? 1 : -1);
        const angle = baseAngle + frameCount * speed;
        const wave =
          Math.sin(angle * 3 + frameCount * (isHovered ? 0.032 : 0.016) + g) *
          (isHovered ? 3.8 : 1.6);
        const r = circle.r + wave;

        node.tx = circle.x + Math.cos(angle) * r;
        node.ty = circle.y + Math.sin(angle) * r;
        return;
      }

      // 1B. Intersection Swarms where circles overlap (Slots 70..119)
      if (slot < 120) {
        const localIdx = slot - 70;
        const partnerIdx = localIdx % 2 === 0 ? (g + 1) % 3 : (g + 2) % 3;
        const partner = circles[partnerIdx];
        const isPairHovered = isHovered || hoveredCircleIdx === partnerIdx;

        const lensX =
          localIdx % 5 === 0
            ? centerAllX
            : circle.x * 0.54 + partner.x * 0.46;
        const lensY =
          localIdx % 5 === 0
            ? centerAllY
            : circle.y * 0.54 + partner.y * 0.46;

        const speed = isPairHovered ? 0.0055 : 0.0025;
        const angle = node.angleOffset + frameCount * speed + localIdx * 0.45;
        const orbitR =
          circle.r * (isPairHovered ? 0.28 : 0.22) * node.radiusMultiplier;

        node.tx = lensX + Math.cos(angle) * orbitR;
        node.ty = lensY + Math.sin(angle) * orbitR;
        return;
      }

      // 1C. Organic Internal Currents (Slots 120..239)
      const localIdx = slot - 120;
      const speed =
        (isHovered ? 0.0055 : 0.0024) * (localIdx % 2 === 0 ? 1 : -1);
      const orbitAngle =
        node.angleOffset + frameCount * speed + localIdx * 0.31;
      // Distributed smoothly from center out to 0.78*r
      const band = 0.14 + 0.64 * node.radiusMultiplier;
      const pulse =
        Math.sin(frameCount * (isHovered ? 0.03 : 0.016) + node.id * 0.5) *
        (isHovered ? 5 : 2.2);
      const r = circle.r * band + pulse;

      node.tx = circle.x + Math.cos(orbitAngle) * r;
      node.ty = circle.y + Math.sin(orbitAngle) * r;
      return;
    }

    // ─── STATE 2: IMMERSION IN SELECTED CIRCLE (2ND ANIMATION ON CLICK) ────
    if (isSelected) {
      // 2A. Expanded Circle Membrane (Slots 0..79)
      if (slot < 80) {
        const baseAngle = (slot / 80) * TAU;
        const angle = baseAngle + frameCount * 0.002;
        const wave = Math.sin(frameCount * 0.018 + slot * 0.25) * 3.2;
        node.tx = circle.x + Math.cos(angle) * (circle.r + wave);
        node.ty = circle.y + Math.sin(angle) * (circle.r + wave);
        return;
      }

      // 2B. Central Core Nucleus (Slots 80..109)
      if (slot < 110) {
        const localIdx = slot - 80;
        const speed = 0.005 * (localIdx % 2 === 0 ? 1 : -1);
        const angle = node.angleOffset + frameCount * speed;
        const r = 10 + 18 * node.radiusMultiplier;
        node.tx = circle.x + Math.cos(angle) * r;
        node.ty = circle.y + Math.sin(angle) * r;
        return;
      }

      // 2C. Concept Satellite Halos around the floating concepts inside the circle (Slots 110..189)
      if (slot < 190 && conceptBoxes.length > 0) {
        const localIdx = slot - 110;
        const box = conceptBoxes[localIdx % conceptBoxes.length];
        const localAngle =
          node.angleOffset +
          frameCount * 0.007 * (localIdx % 2 === 0 ? 1 : -1) +
          localIdx * 0.4;
        const rx = box.width * 0.5 + 5 + 10 * node.radiusMultiplier;
        const ry = box.height * 0.5 + 4 + 8 * node.radiusMultiplier;

        node.tx =
          box.x +
          Math.cos(localAngle) * rx +
          Math.sin(frameCount * 0.01 + node.id) * 2;
        node.ty =
          box.y +
          Math.sin(localAngle) * ry +
          Math.cos(frameCount * 0.01 + node.id) * 2;
        return;
      }

      // 2D. Flowing Energy Streams from Central Hub to Title & Concepts (Slots 190..239)
      const streamIdx = slot - 190;
      const targets: ScreenBox[] = [
        ...(titleBox ? [titleBox] : []),
        ...conceptBoxes,
      ];
      if (targets.length > 0) {
        const target = targets[streamIdx % targets.length];
        const speed = 0.0032 + (streamIdx % 4) * 0.00045;
        const t = (pseudoRandom(node.id * 2.13) + frameCount * speed) % 1;

        const dx = target.x - circle.x;
        const dy = target.y - circle.y;
        const perpX = -dy * 0.14;
        const perpY = dx * 0.14;
        const arch = Math.sin(t * Math.PI) * (streamIdx % 2 === 0 ? 1 : -1);

        node.tx = circle.x + dx * t + perpX * arch;
        node.ty = circle.y + dy * t + perpY * arch;
        return;
      }

      const fallbackAngle = node.angleOffset + frameCount * 0.003;
      node.tx = circle.x + Math.cos(fallbackAngle) * (circle.r * 0.45);
      node.ty = circle.y + Math.sin(fallbackAngle) * (circle.r * 0.45);
      return;
    }

    // ─── 2E. OVERLAPPING COMPANION CIRCLES (circleGroup !== selectedCircleIdx)
    const activeCircle = circles[selectedCircleIdx];

    // Companion Boundary Ring (Slots 0..59)
    if (slot < 60) {
      const baseAngle = (slot / 60) * TAU;
      const speed = (isHovered ? 0.004 : 0.002) * (g % 2 === 0 ? 1 : -1);
      const angle = baseAngle + frameCount * speed;
      const wave = isHovered
        ? Math.sin(frameCount * 0.025 + slot * 0.2) * 2.5
        : 0;
      const r = circle.r * (isHovered ? 1.08 : 1.0) + wave;

      node.tx = circle.x + Math.cos(angle) * r;
      node.ty = circle.y + Math.sin(angle) * r;
      return;
    }

    // Companion Overlap Bridge with Active Circle (Slots 60..139)
    if (slot < 140) {
      const localIdx = slot - 60;
      // Overlap zone between companion center and active circle border
      const lensX = circle.x * 0.68 + activeCircle.x * 0.32;
      const lensY = circle.y * 0.68 + activeCircle.y * 0.32;
      const speed = isHovered ? 0.0065 : 0.0032;
      const angle = node.angleOffset + frameCount * speed + localIdx * 0.38;
      const orbitR = circle.r * (isHovered ? 0.52 : 0.38) * node.radiusMultiplier;

      node.tx = lensX + Math.cos(angle) * orbitR;
      node.ty = lensY + Math.sin(angle) * orbitR;
      return;
    }

    // Companion Inner Core Orbit (Slots 140..239)
    const orbitAngle =
      node.angleOffset + frameCount * (isHovered ? 0.0065 : 0.003);
    const orbitRadius =
      circle.r * (isHovered ? 0.65 : 0.48) * node.radiusMultiplier;
    const vibration = isHovered
      ? Math.sin(frameCount * 0.025 + node.id * 0.5) * 2
      : 0;

    node.tx = circle.x + Math.cos(orbitAngle) * (orbitRadius + vibration);
    node.ty = circle.y + Math.sin(orbitAngle) * (orbitRadius + vibration);
  });
};

/**
 * Renders the 3 Venn circles, organic filaments, and all 720 particles.
 */
export const drawVennParticles = (
  ctx: CanvasRenderingContext2D,
  particles: VennRendererParticle[],
  circles: VennCircleState[],
  selectedCircleIdx: number | null,
  hoveredCircleIdx: number | null,
  mouse: VennMouseState,
  globalDriftX: number,
  globalDriftY: number,
  frameCount: number
): void => {
  const conceptBoxes =
    selectedCircleIdx !== null
      ? readActiveConceptAnchors(selectedCircleIdx)
      : [];
  const titleBox =
    selectedCircleIdx !== null ? readActiveTitleBox(selectedCircleIdx) : null;

  ctx.save();

  // ─── 1. DRAW VENN CIRCLE MEMBRANES ─────────────────────────────────────────
  circles.forEach((circle, idx) => {
    const isSelected = selectedCircleIdx === idx;
    const isHovered = hoveredCircleIdx === idx;
    const isCompanion = selectedCircleIdx !== null && !isSelected;

    const cx = circle.x + globalDriftX;
    const cy = circle.y + globalDriftY;
    const drawR =
      isCompanion && isHovered ? circle.r * 1.08 : circle.r;

    let fillAlpha = 0.025;
    let strokeAlpha = 0.22;
    let lineWidth = 1.25;
    let useDash = false;

    if (selectedCircleIdx !== null) {
      if (isSelected) {
        fillAlpha = 0.02;
        strokeAlpha = 0.36 + 0.1 * Math.sin(frameCount * 0.035);
        lineWidth = 2.0;
      } else if (isCompanion) {
        fillAlpha = isHovered ? 0.05 : 0.018;
        strokeAlpha = isHovered ? 0.48 : 0.22;
        lineWidth = isHovered ? 1.6 : 1.1;
        useDash = true;
      }
    } else {
      fillAlpha = isHovered ? 0.06 : 0.025;
      strokeAlpha = isHovered ? 0.52 : 0.22;
      lineWidth = isHovered ? 1.85 : 1.25;
    }

    ctx.setLineDash(useDash ? [3.5, 4] : []);
    if (fillAlpha > 0) {
      ctx.fillStyle = rgba(circle.color, fillAlpha);
      ctx.beginPath();
      ctx.arc(cx, cy, drawR, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = rgba(circle.color, strokeAlpha);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, drawR, 0, TAU);
    ctx.stroke();
  });

  ctx.setLineDash([]);

  // ─── 2. DRAW CURVED ENERGY FILAMENTS INSIDE IMMERSED CIRCLE ────────────────
  if (selectedCircleIdx !== null) {
    const activeCircle = circles[selectedCircleIdx];
    const color = activeCircle.color;
    const hubX = activeCircle.x + globalDriftX;
    const hubY = activeCircle.y + globalDriftY;

    // Central pulsing core hub
    const pulseRadius = 4 + Math.sin(frameCount * 0.05) * 0.9;
    ctx.fillStyle = rgba(color, 0.85);
    ctx.beginPath();
    ctx.arc(hubX, hubY, pulseRadius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = rgba(color, 0.24);
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(hubX, hubY, pulseRadius * 2.2, 0, TAU);
    ctx.stroke();

    // Soft curved filaments from hub to title & each floating concept
    const targets: ScreenBox[] = [
      ...(titleBox
        ? [{ ...titleBox, y: titleBox.y + titleBox.height * 0.5 }]
        : []),
      ...conceptBoxes,
    ];

    targets.forEach((target, idx) => {
      const tx = target.x + globalDriftX;
      const ty = target.y + globalDriftY;
      const dx = tx - hubX;
      const dy = ty - hubY;
      const ctrlX = hubX + dx * 0.5 - dy * 0.12 * (idx % 2 === 0 ? 1 : -1);
      const ctrlY = hubY + dy * 0.5 + dx * 0.12 * (idx % 2 === 0 ? 1 : -1);

      // Soft outer glow
      const gradGlow = ctx.createLinearGradient(hubX, hubY, tx, ty);
      gradGlow.addColorStop(0, rgba(color, 0.12));
      gradGlow.addColorStop(1, rgba(color, 0.28));

      ctx.setLineDash([]);
      ctx.strokeStyle = gradGlow;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(hubX, hubY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tx, ty);
      ctx.stroke();

      // Dashed inner filament
      const gradCore = ctx.createLinearGradient(hubX, hubY, tx, ty);
      gradCore.addColorStop(0, rgba(color, 0.28));
      gradCore.addColorStop(1, rgba(color, 0.78));

      ctx.setLineDash([2.5, 3.5]);
      ctx.strokeStyle = gradCore;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hubX, hubY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tx, ty);
      ctx.stroke();

      // Travelling energy bead along quadratic curve
      const t = (frameCount * 0.0045 + idx * 0.22) % 1;
      const u = 1 - t;
      const beadX = u * u * hubX + 2 * u * t * ctrlX + t * t * tx;
      const beadY = u * u * hubY + 2 * u * t * ctrlY + t * t * ty;

      ctx.setLineDash([]);
      ctx.fillStyle = rgba(color, 0.9);
      ctx.beginPath();
      ctx.arc(beadX, beadY, 2.4, 0, TAU);
      ctx.fill();
    });

    ctx.setLineDash([]);
  }

  // ─── 3. DRAW PARTICLE WEB CONNECTIONS ──────────────────────────────────────
  const maxConnections = Math.min(particles.length, 240);
  const connectionDist = selectedCircleIdx !== null ? 95 : 88;
  ctx.lineWidth = selectedCircleIdx !== null ? 0.7 : 0.55;

  for (let i = 0; i < maxConnections; i += 1) {
    const n1 = particles[i];
    const p1x = n1.x + globalDriftX;
    const p1y = n1.y + globalDriftY;

    for (let j = i + 1; j < maxConnections; j += 1) {
      const n2 = particles[j];
      if (selectedCircleIdx !== null && n1.group !== n2.group) continue;

      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= connectionDist) continue;

      let alpha = (1 - dist / connectionDist) * 0.085;
      if (mouse.active) {
        const midX = (n1.x + n2.x) * 0.5;
        const midY = (n1.y + n2.y) * 0.5;
        const mDist = Math.hypot(mouse.x - midX, mouse.y - midY);
        if (mDist < 120) {
          alpha *= 1 + ((120 - mDist) / 120) * 1.4;
        }
      }

      if (
        selectedCircleIdx !== null &&
        n1.group !== selectedCircleIdx
      ) {
        alpha *= hoveredCircleIdx === n1.group ? 0.85 : 0.38;
      }

      const rgb = VENN_COLORS[n1.group % 3];
      ctx.strokeStyle = rgba(rgb, alpha);
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(n2.x + globalDriftX, n2.y + globalDriftY);
      ctx.stroke();
    }
  }

  // ─── 4. DRAW PARTICLES ─────────────────────────────────────────────────────
  particles.forEach((node) => {
    const px = node.x + globalDriftX;
    const py = node.y + globalDriftY;
    const g = node.group % 3;
    const isSelected = selectedCircleIdx === g;
    const isHovered = hoveredCircleIdx === g;

    let radius = node.baseRadius;
    let alphaMultiplier = 1;

    if (selectedCircleIdx !== null) {
      if (isSelected) {
        radius *= 1.25;
        alphaMultiplier *= 1.55;
      } else {
        radius *= isHovered ? 1.15 : 0.9;
        alphaMultiplier *= isHovered ? 1.45 : 0.82;
      }
    } else if (isHovered) {
      radius *= 1.28;
      alphaMultiplier *= 1.7;
    }

    if (mouse.active) {
      const mDist = Math.hypot(mouse.x - node.x, mouse.y - node.y);
      const hoverRadius = 135;
      if (mDist < hoverRadius) {
        const ratio = (hoverRadius - mDist) / hoverRadius;
        radius *= 1 + ratio * 0.75;
        alphaMultiplier *= 1 + ratio * 1.65;
      }
    }

    const rgb = VENN_COLORS[g];
    const outerAlpha = Math.min(0.45, 0.24 * alphaMultiplier);
    const coreAlpha = Math.min(0.92, 0.58 * alphaMultiplier);

    ctx.fillStyle = rgba(rgb, outerAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = rgba(rgb, coreAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.42, 0, TAU);
    ctx.fill();
  });

  ctx.restore();
};
