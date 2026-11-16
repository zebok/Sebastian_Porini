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

interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const TAU = Math.PI * 2;
const HEADER_SAFE_TOP = 78;

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
  const cy = viewportHeight * 0.56;
  const r = Math.min(viewportWidth, viewportHeight) * 0.16;
  circles[0].x = cx;
  circles[0].y = cy - r * 0.62;
  circles[0].r = r;

  circles[1].x = cx - r * 0.75;
  circles[1].y = cy + r * 0.44;
  circles[1].r = r;

  circles[2].x = cx + r * 0.75;
  circles[2].y = cy + r * 0.44;
  circles[2].r = r;
};

const readActiveConceptAnchors = (selectedIdx: number): ScreenBox[] => {
  const boxes: ScreenBox[] = [];
  if (typeof document === "undefined") return boxes;

  for (let idx = 0; idx < 4; idx++) {
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

const readProjectionAnchor = (): ScreenBox | null => {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("venn-projection-anchor");
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

const readTextZones = (): ScreenRect[] => {
  const zones: ScreenRect[] = [];
  if (typeof document === "undefined") return zones;

  const els = document.querySelectorAll<HTMLElement>(
    '[data-venn-text="true"], [id^="venn-title-text-"], [id^="venn-tag-"], #venn-projection-anchor'
  );
  els.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      zones.push({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      });
    }
  });
  return zones;
};

/**
 * Attenuates particle alpha inside or near any text box so text is always
 * 100% legible and never saturated by particles.
 */
const getTextReadabilityMask = (
  x: number,
  y: number,
  zones: ScreenRect[]
): number => {
  if (y < HEADER_SAFE_TOP) {
    return Math.max(0, (y - 54) / 24) * 0.25;
  }

  let mask = 1;
  const padX = 12;
  const padY = 8;
  const fade = 18;

  for (const z of zones) {
    const dx = Math.max(z.left - padX - x, 0, x - (z.right + padX));
    const dy = Math.max(z.top - padY - y, 0, y - (z.bottom + padY));
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.01) return 0.06;
    if (dist < fade) {
      mask = Math.min(mask, 0.06 + (dist / fade) * 0.94);
    }
  }
  return mask;
};

/**
 * Computes calm, airy target coordinates for particles across the 3 Venn circles.
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
  const projectionBox =
    selectedCircleIdx !== null &&
    hoveredCircleIdx !== null &&
    hoveredCircleIdx !== selectedCircleIdx
      ? readProjectionAnchor()
      : null;

  const groupCounts = [0, 0, 0];

  particles.forEach((node) => {
    const g = node.group % 3;
    const slot = groupCounts[g]++;
    const circle = circles[g];
    const isHovered = hoveredCircleIdx === g;
    const isSelected = selectedCircleIdx === g;

    // ─── STATE 1: 3-CIRCLE OVERVIEW (+ HOVER 1ST ANIMATION) ────────────────
    if (selectedCircleIdx === null) {
      // 1A. Clean Perimeter Ring (Slots 0..79)
      if (slot < 80) {
        const baseAngle = (slot / 80) * TAU;
        const speed = (isHovered ? 0.0028 : 0.0012) * (g % 2 === 0 ? 1 : -1);
        const angle = baseAngle + frameCount * speed;
        const wave =
          Math.sin(angle * 3 + frameCount * (isHovered ? 0.028 : 0.014) + g) *
          (isHovered ? 3.2 : 1.4);
        const r = circle.r + wave;

        node.tx = circle.x + Math.cos(angle) * r;
        node.ty = Math.max(HEADER_SAFE_TOP, circle.y + Math.sin(angle) * r);
        return;
      }

      // 1B. Airy Internal & Overlap Field (Slots 80..239)
      const localIdx = slot - 80;
      const speed =
        (isHovered ? 0.0042 : 0.0018) * (localIdx % 2 === 0 ? 1 : -1);
      const orbitAngle =
        node.angleOffset + frameCount * speed + localIdx * 0.37;
      // Spread gently across the outer 0.35..0.88 band so the center isn't a dense blob
      const band = 0.28 + 0.58 * node.radiusMultiplier;
      const pulse =
        Math.sin(frameCount * 0.018 + node.id * 0.5) * (isHovered ? 3.5 : 1.5);
      const r = circle.r * band + pulse;

      node.tx = circle.x + Math.cos(orbitAngle) * r;
      node.ty = Math.max(HEADER_SAFE_TOP, circle.y + Math.sin(orbitAngle) * r);
      return;
    }

    // ─── STATE 2: IMMERSION IN SELECTED CIRCLE (2ND ANIMATION ON CLICK) ────
    if (isSelected) {
      // 2A. Expanded Circle Membrane (Slots 0..109) — majority of particles stay on the perimeter ring!
      if (slot < 110) {
        const baseAngle = (slot / 110) * TAU;
        const angle = baseAngle + frameCount * 0.0015;
        const wave = Math.sin(frameCount * 0.016 + slot * 0.25) * 2.8;
        node.tx = circle.x + Math.cos(angle) * (circle.r + wave);
        node.ty = Math.max(
          HEADER_SAFE_TOP,
          circle.y + Math.sin(angle) * (circle.r + wave)
        );
        return;
      }

      // 2B. Subtle Central Hub (Slots 110..123 — only 14 particles so it's delicate)
      if (slot < 124) {
        const localIdx = slot - 110;
        const speed = 0.004 * (localIdx % 2 === 0 ? 1 : -1);
        const angle = node.angleOffset + frameCount * speed;
        const r = 6 + 10 * node.radiusMultiplier;
        node.tx = circle.x + Math.cos(angle) * r;
        node.ty = circle.y + Math.sin(angle) * r;
        return;
      }

      // 2C. Delicate Perimeter Halos OUTSIDE each Sub-Concept text box (Slots 124..189)
      if (slot < 190 && conceptBoxes.length > 0) {
        const localIdx = slot - 124;
        const boxIdx = localIdx % conceptBoxes.length;
        const box = conceptBoxes[boxIdx];
        const clusterSlot = Math.floor(localIdx / conceptBoxes.length);

        // Orbit strictly OUTSIDE the text box (padX >= 14px, padY >= 12px) so text is 100% clear!
        const rx = box.width * 0.5 + 14 + (clusterSlot % 2) * 6;
        const ry = box.height * 0.5 + 11 + (clusterSlot % 2) * 5;
        const speed = 0.0038 * (boxIdx % 2 === 0 ? 1 : -1);
        const angle =
          (clusterSlot / 22) * TAU + frameCount * speed + node.angleOffset * 0.25;

        node.tx = box.x + Math.cos(angle) * rx;
        node.ty = Math.max(HEADER_SAFE_TOP, box.y + Math.sin(angle) * ry);
        return;
      }

      // 2D. If hovering a companion circle, send a gentle projection ring around `#venn-projection-anchor`
      if (projectionBox && slot >= 210) {
        const localIdx = slot - 210;
        const rx = projectionBox.width * 0.5 + 16;
        const ry = projectionBox.height * 0.5 + 14;
        const angle =
          (localIdx / 30) * TAU + frameCount * 0.0038 + node.angleOffset;
        node.tx = projectionBox.x + Math.cos(angle) * rx;
        node.ty = Math.max(
          HEADER_SAFE_TOP,
          projectionBox.y + Math.sin(angle) * ry
        );
        return;
      }

      // 2E. Gentle Streams from Hub to Sub-Concepts (Slots 190..239)
      const streamIdx = slot - 190;
      const targets: ScreenBox[] = [
        ...(titleBox ? [titleBox] : []),
        ...conceptBoxes,
      ];
      if (targets.length > 0) {
        const target = targets[streamIdx % targets.length];
        const speed = 0.0026 + (streamIdx % 4) * 0.00035;
        const t = (pseudoRandom(node.id * 2.13) + frameCount * speed) % 1;

        // Stop short of the target text box so stream particles don't cross the letters
        const maxT = 0.82;
        const clampedT = t * maxT;
        const dx = target.x - circle.x;
        const dy = target.y - circle.y;
        const perpX = -dy * 0.12;
        const perpY = dx * 0.12;
        const arch =
          Math.sin(clampedT * Math.PI) * (streamIdx % 2 === 0 ? 1 : -1);

        node.tx = circle.x + dx * clampedT + perpX * arch;
        node.ty = Math.max(
          HEADER_SAFE_TOP,
          circle.y + dy * clampedT + perpY * arch
        );
        return;
      }

      const fallbackAngle = node.angleOffset + frameCount * 0.0025;
      node.tx = circle.x + Math.cos(fallbackAngle) * (circle.r * 0.6);
      node.ty = Math.max(
        HEADER_SAFE_TOP,
        circle.y + Math.sin(fallbackAngle) * (circle.r * 0.6)
      );
      return;
    }

    // ─── 2F. OVERLAPPING COMPANION CIRCLES (circleGroup !== selectedCircleIdx)
    const activeCircle = circles[selectedCircleIdx];

    // Companion Boundary Ring (Slots 0..79)
    if (slot < 80) {
      const baseAngle = (slot / 80) * TAU;
      const speed = (isHovered ? 0.0035 : 0.0018) * (g % 2 === 0 ? 1 : -1);
      const angle = baseAngle + frameCount * speed;
      const wave = isHovered
        ? Math.sin(frameCount * 0.025 + slot * 0.2) * 2.2
        : 0;
      const r = circle.r * (isHovered ? 1.06 : 1.0) + wave;

      node.tx = circle.x + Math.cos(angle) * r;
      node.ty = Math.max(HEADER_SAFE_TOP, circle.y + Math.sin(angle) * r);
      return;
    }

    // HOVER PROJECTION: When this companion circle is hovered, form a clean halo
    // around `#venn-projection-anchor` (strictly outside the text!)
    if (isHovered && projectionBox && slot >= 80 && slot < 165) {
      const localIdx = slot - 80;
      const rx = projectionBox.width * 0.5 + 16 + (localIdx % 2) * 6;
      const ry = projectionBox.height * 0.5 + 14 + (localIdx % 2) * 5;

      if (localIdx < 54) {
        const angle = (localIdx / 54) * TAU - frameCount * 0.0038;
        node.tx = projectionBox.x + Math.cos(angle) * rx;
        node.ty = Math.max(
          HEADER_SAFE_TOP,
          projectionBox.y + Math.sin(angle) * ry
        );
        return;
      }

      // Subtle stream from companion circle to the edge of the projected halo
      const streamSlot = localIdx - 54;
      const speed = 0.0032 + (streamSlot % 3) * 0.0004;
      const t = ((pseudoRandom(node.id * 1.91) + frameCount * speed) % 1) * 0.84;
      const dx = projectionBox.x - circle.x;
      const dy = projectionBox.y - circle.y;
      const perpX = -dy * 0.14;
      const perpY = dx * 0.14;
      const arch = Math.sin(t * Math.PI);

      node.tx = circle.x + dx * t + perpX * arch;
      node.ty = Math.max(
        HEADER_SAFE_TOP,
        circle.y + dy * t + perpY * arch
      );
      return;
    }

    // Companion Overlap Bridge with Active Circle (Slots 80..149)
    if (slot < 150) {
      const localIdx = slot - 80;
      const lensX = circle.x * 0.68 + activeCircle.x * 0.32;
      const lensY = circle.y * 0.68 + activeCircle.y * 0.32;
      const speed = isHovered ? 0.005 : 0.0025;
      const angle = node.angleOffset + frameCount * speed + localIdx * 0.38;
      const orbitR =
        circle.r * (isHovered ? 0.48 : 0.35) * node.radiusMultiplier;

      node.tx = lensX + Math.cos(angle) * orbitR;
      node.ty = Math.max(HEADER_SAFE_TOP, lensY + Math.sin(angle) * orbitR);
      return;
    }

    // Companion Inner Core Orbit (Slots 150..239)
    const orbitAngle =
      node.angleOffset + frameCount * (isHovered ? 0.005 : 0.0024);
    const orbitRadius =
      circle.r * (isHovered ? 0.6 : 0.45) * node.radiusMultiplier;

    node.tx = circle.x + Math.cos(orbitAngle) * orbitRadius;
    node.ty = Math.max(
      HEADER_SAFE_TOP,
      circle.y + Math.sin(orbitAngle) * orbitRadius
    );
  });
};

/**
 * Renders the 3 Venn circles, delicate filaments, and readability-masked particles.
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
  const projectionBox =
    selectedCircleIdx !== null &&
    hoveredCircleIdx !== null &&
    hoveredCircleIdx !== selectedCircleIdx
      ? readProjectionAnchor()
      : null;
  const textZones = readTextZones();

  ctx.save();

  // ─── 1. DRAW VENN CIRCLE MEMBRANES ─────────────────────────────────────────
  circles.forEach((circle, idx) => {
    const isSelected = selectedCircleIdx === idx;
    const isHovered = hoveredCircleIdx === idx;
    const isCompanion = selectedCircleIdx !== null && !isSelected;

    const cx = circle.x + globalDriftX;
    const cy = circle.y + globalDriftY;
    const drawR = isCompanion && isHovered ? circle.r * 1.06 : circle.r;

    let fillAlpha = 0.02;
    let strokeAlpha = 0.2;
    let lineWidth = 1.2;
    let useDash = false;

    if (selectedCircleIdx !== null) {
      if (isSelected) {
        fillAlpha = 0.016;
        strokeAlpha = 0.34 + 0.08 * Math.sin(frameCount * 0.035);
        lineWidth = 1.75;
      } else if (isCompanion) {
        fillAlpha = isHovered ? 0.045 : 0.015;
        strokeAlpha = isHovered ? 0.46 : 0.2;
        lineWidth = isHovered ? 1.5 : 1.05;
        useDash = true;
      }
    } else {
      fillAlpha = isHovered ? 0.05 : 0.02;
      strokeAlpha = isHovered ? 0.45 : 0.2;
      lineWidth = isHovered ? 1.65 : 1.2;
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

  // ─── 2. DRAW IMMERSED CURVED FILAMENTS (Stopping at edge of text boxes) ────
  if (selectedCircleIdx !== null) {
    const activeCircle = circles[selectedCircleIdx];
    const color = activeCircle.color;
    const hubX = activeCircle.x + globalDriftX;
    const hubY = activeCircle.y + globalDriftY;

    // Central pulsing core hub
    const pulseRadius = 3.6 + Math.sin(frameCount * 0.045) * 0.7;
    ctx.fillStyle = rgba(color, 0.75);
    ctx.beginPath();
    ctx.arc(hubX, hubY, pulseRadius, 0, TAU);
    ctx.fill();

    const targets: ScreenBox[] = [
      ...(titleBox
        ? [{ ...titleBox, y: titleBox.y + titleBox.height * 0.55 }]
        : []),
      ...conceptBoxes,
    ];

    targets.forEach((target, idx) => {
      const fullDx = target.x + globalDriftX - hubX;
      const fullDy = target.y + globalDriftY - hubY;
      // Stop the filament at 80% of the distance so it doesn't cross through the text
      const tx = hubX + fullDx * 0.8;
      const ty = hubY + fullDy * 0.8;
      const ctrlX =
        hubX + fullDx * 0.42 - fullDy * 0.1 * (idx % 2 === 0 ? 1 : -1);
      const ctrlY =
        hubY + fullDy * 0.42 + fullDx * 0.1 * (idx % 2 === 0 ? 1 : -1);

      const gradCore = ctx.createLinearGradient(hubX, hubY, tx, ty);
      gradCore.addColorStop(0, rgba(color, 0.22));
      gradCore.addColorStop(1, rgba(color, 0.52));

      ctx.setLineDash([2.5, 4]);
      ctx.strokeStyle = gradCore;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(hubX, hubY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tx, ty);
      ctx.stroke();

      // Travelling energy bead
      const t = (frameCount * 0.004 + idx * 0.22) % 1;
      const u = 1 - t;
      const beadX = u * u * hubX + 2 * u * t * ctrlX + t * t * tx;
      const beadY = u * u * hubY + 2 * u * t * ctrlY + t * t * ty;

      ctx.setLineDash([]);
      ctx.fillStyle = rgba(color, 0.78);
      ctx.beginPath();
      ctx.arc(beadX, beadY, 2.0, 0, TAU);
      ctx.fill();
    });

    // ─── 2B. DRAW COMPANION HOVER PROJECTION HALO & ARC ──────────────────────
    if (
      projectionBox &&
      hoveredCircleIdx !== null &&
      hoveredCircleIdx !== selectedCircleIdx
    ) {
      const compCircle = circles[hoveredCircleIdx];
      const compColor = compCircle.color;
      const px = projectionBox.x + globalDriftX;
      const py = projectionBox.y + globalDriftY;
      const rx = projectionBox.width * 0.5 + 16;
      const ry = projectionBox.height * 0.5 + 14;

      ctx.setLineDash([3, 3.5]);
      ctx.strokeStyle = rgba(compColor, 0.34);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, TAU);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  // ─── 3. DRAW DELICATE PARTICLE WEB CONNECTIONS (Masked around text) ────────
  const maxConnections = Math.min(particles.length, 160);
  const connectionDist = 66;
  ctx.lineWidth = 0.5;

  for (let i = 0; i < maxConnections; i += 1) {
    const n1 = particles[i];
    const p1x = n1.x + globalDriftX;
    const p1y = n1.y + globalDriftY;
    const m1 = getTextReadabilityMask(p1x, p1y, textZones);
    if (m1 < 0.2) continue;

    for (let j = i + 1; j < maxConnections; j += 1) {
      const n2 = particles[j];
      if (selectedCircleIdx !== null && n1.group !== n2.group) continue;

      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= connectionDist) continue;

      const p2x = n2.x + globalDriftX;
      const p2y = n2.y + globalDriftY;
      const m2 = getTextReadabilityMask(p2x, p2y, textZones);
      const mask = Math.min(m1, m2);
      if (mask < 0.2) continue;

      let alpha = (1 - dist / connectionDist) * 0.055 * mask;
      if (selectedCircleIdx !== null && n1.group !== selectedCircleIdx) {
        alpha *= hoveredCircleIdx === n1.group ? 0.85 : 0.35;
      }

      const rgb = VENN_COLORS[n1.group % 3];
      ctx.strokeStyle = rgba(rgb, alpha);
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();
    }
  }

  // ─── 4. DRAW PARTICLES (Calm density + Text Readability Mask) ──────────────
  const drawGroupCounts = [0, 0, 0];

  particles.forEach((node) => {
    const g = node.group % 3;
    const slot = drawGroupCounts[g]++;
    const px = node.x + globalDriftX;
    const py = node.y + globalDriftY;

    const mask = getTextReadabilityMask(px, py, textZones);
    if (mask <= 0.08) return;

    const isSelected = selectedCircleIdx === g;
    const isHovered = hoveredCircleIdx === g;
    const isBoundary = selectedCircleIdx !== null ? slot < 110 : slot < 80;

    let radius = node.baseRadius * (isBoundary ? 1.05 : 0.82);
    let alphaMultiplier = (isBoundary ? 1.15 : 0.58) * mask;

    if (selectedCircleIdx !== null) {
      if (isSelected) {
        alphaMultiplier *= isBoundary ? 1.25 : 0.85;
      } else {
        alphaMultiplier *= isHovered ? 1.15 : 0.55;
      }
    } else if (isHovered) {
      radius *= 1.15;
      alphaMultiplier *= 1.3;
    }

    if (mouse.active) {
      const mDist = Math.hypot(mouse.x - node.x, mouse.y - node.y);
      const hoverRadius = 110;
      if (mDist < hoverRadius) {
        const ratio = (hoverRadius - mDist) / hoverRadius;
        radius *= 1 + ratio * 0.45;
        alphaMultiplier *= 1 + ratio * 0.9;
      }
    }

    const rgb = VENN_COLORS[g];
    const outerAlpha = Math.min(0.32, 0.16 * alphaMultiplier);
    const coreAlpha = Math.min(0.76, 0.44 * alphaMultiplier);

    ctx.fillStyle = rgba(rgb, outerAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = rgba(rgb, coreAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.4, 0, TAU);
    ctx.fill();
  });

  ctx.restore();
};
