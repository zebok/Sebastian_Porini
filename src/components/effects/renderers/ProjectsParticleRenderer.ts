import {
  getProjectCategoryStyle,
  type ProjectsRgb,
  type ProjectsRuntime,
  type ProjectsRuntimeState,
} from "../../visualizations/Projects.runtime";

export interface ProjectsRendererParticle {
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

export interface ProjectsMouseState {
  x: number;
  y: number;
  active: boolean;
}

interface StageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  scale: number;
}

interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const TAU = Math.PI * 2;
const READABILITY_PAD_X = 10;
const READABILITY_PAD_Y = 8;
const READABILITY_FADE = 16;

const pseudoRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const rgba = (rgb: ProjectsRgb, alpha: number): string =>
  `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(
    rgb.b
  )}, ${Math.max(0, Math.min(1, alpha)).toFixed(4)})`;

export const getProjectsGroupColor = (
  group: number,
  runtime?: ProjectsRuntime
): ProjectsRgb => {
  const state = runtime?.stateRef.current;
  if (state && state.projects.length > 0) {
    const focusId = state.activeProjectId ?? state.hoveredProjectId;
    if (focusId) {
      const proj = state.projects.find((p) => p.id === focusId);
      if (proj) {
        const primary = getProjectCategoryStyle(proj.category).rgb;
        if (group === 0 || group === 1) return primary;
        // Subtle complementary slate/accent mix for depth
        return {
          r: Math.round(primary.r * 0.72 + 40),
          g: Math.round(primary.g * 0.72 + 45),
          b: Math.round(primary.b * 0.72 + 55),
        };
      }
    }
  }
  if (group === 0) return { r: 45, g: 91, b: 227 };
  if (group === 1) return { r: 124, g: 58, b: 237 };
  return { r: 5, g: 150, b: 105 };
};

const readStageBounds = (
  viewportWidth: number,
  viewportHeight: number
): StageBounds => {
  if (typeof document !== "undefined") {
    const el = document.getElementById("projects-particle-stage");
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 80 && rect.height > 80) {
        const scale = Math.min(
          1.42,
          Math.max(0.75, Math.min(rect.width / 460, rect.height / 310))
        );
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          cx: rect.left + rect.width * 0.5,
          cy: rect.top + rect.height * 0.5,
          scale,
        };
      }
    }
  }

  const isMobile = viewportWidth < 860;
  const left = isMobile ? 24 : viewportWidth * 0.4;
  const top = isMobile ? 240 : 88;
  const width = isMobile ? viewportWidth - 48 : viewportWidth * 0.55;
  const height = isMobile ? 280 : viewportHeight * 0.62;
  const scale = Math.min(1.38, Math.max(0.75, Math.min(width / 460, height / 310)));

  return {
    left,
    top,
    width,
    height,
    cx: left + width * 0.5,
    cy: top + height * 0.5,
    scale,
  };
};

const readReadabilityZones = (): ScreenRect[] => {
  const zones: ScreenRect[] = [];
  if (typeof document === "undefined") return zones;

  const els = document.querySelectorAll<HTMLElement>(
    '[data-projects-readability-zone="true"]'
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

const getReadabilityMask = (
  x: number,
  y: number,
  zones: ScreenRect[]
): number => {
  let mask = 1;
  for (const z of zones) {
    const dx = Math.max(
      z.left - READABILITY_PAD_X - x,
      0,
      x - (z.right + READABILITY_PAD_X)
    );
    const dy = Math.max(
      z.top - READABILITY_PAD_Y - y,
      0,
      y - (z.bottom + READABILITY_PAD_Y)
    );
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.01) return 0.14;
    if (dist < READABILITY_FADE) {
      mask = Math.min(mask, 0.14 + (dist / READABILITY_FADE) * 0.86);
    }
  }
  return mask;
};

/**
 * ─── STATE 0: FREE-FLOATING CLOUD IN STAGE AREA ──────────────────────────────
 * When no project is clicked yet, particles float freely and organically inside
 * the right-hand stage area, gently stirring if a project in the index is hovered.
 */
const setFreeFloatingStageTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number,
  isHoveringProject: boolean
) => {
  const spreadX = stage.width * (isHoveringProject ? 0.36 : 0.45);
  const spreadY = stage.height * (isHoveringProject ? 0.36 : 0.43);

  particles.forEach((p, idx) => {
    const rx = (pseudoRandom(idx * 3.17 + 1.1) - 0.5) * 2 * spreadX;
    const ry = (pseudoRandom(idx * 5.23 + 2.7) - 0.5) * 2 * spreadY;

    const speed = isHoveringProject ? 0.0048 : 0.0026;
    const phase = p.angleOffset + idx * 0.37;
    const driftAmp = (isHoveringProject ? 18 : 26) * stage.scale;

    const driftX = Math.sin(frameCount * speed + phase) * driftAmp;
    const driftY = Math.cos(frameCount * (speed * 0.85) + phase * 1.3) * driftAmp;

    p.tx = stage.cx + rx + driftX;
    p.ty = stage.cy + ry + driftY;
  });
};

/**
 * ─── CONCEPT 1: GEOLOGICAL DATA PLATFORM ─────────────────────────────────────
 * Stage A: Serverless AWS Lambda Ingestion Funnel (Top)
 * Stage B: Relational PostgreSQL Schema Matrix (Center)
 * Stage C: Private VPC Zero-Trust Perimeter Arc (Bottom)
 */
const setGeologicalConceptTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number
) => {
  const { cx, cy, scale } = stage;
  const total = particles.length;
  const stageAEnd = Math.floor(total * 0.34);
  const stageBEnd = Math.floor(total * 0.74);

  particles.forEach((p, idx) => {
    // Stage A: Serverless Ingestion Funnel
    if (idx < stageAEnd) {
      const speed = 0.0014 + (idx % 4) * 0.00022;
      const progress = (pseudoRandom(p.id * 2.7) + frameCount * speed) % 1;
      const startX = cx + (pseudoRandom(p.id * 7.1) - 0.5) * 260 * scale;
      const startY = cy - 132 * scale;
      const throatX = cx + (pseudoRandom(p.id * 3.3) - 0.5) * 18 * scale;
      const throatY = cy - 22 * scale;

      const curvedX = startX + (throatX - startX) * Math.pow(progress, 1.75);
      const curvedY = startY + (throatY - startY) * progress;
      const jitter = Math.sin(frameCount * 0.024 + p.id) * 2 * scale;

      p.tx = curvedX + jitter;
      p.ty = curvedY;
      return;
    }

    // Stage B: Relational PostgreSQL Schema Grid (10 cols x 6 rows)
    if (idx < stageBEnd) {
      const slot = idx - stageAEnd;
      const cols = 10;
      const rows = 6;
      const cell = slot % (cols * rows);
      const col = cell % cols;
      const row = Math.floor(cell / cols);

      const gridW = 176 * scale;
      const gridH = 84 * scale;
      const gx = cx - gridW * 0.5 + (col / (cols - 1)) * gridW;
      const gy = cy + 2 * scale + (row / (rows - 1)) * gridH;
      const wave =
        Math.sin(frameCount * 0.028 + row * 0.5 + col * 0.3) * 1.6 * scale;

      p.tx = gx;
      p.ty = gy + wave;
      return;
    }

    // Stage C: Zero-Trust Private VPC Perimeter Arc enveloping the schema
    const slot = idx - stageBEnd;
    const countC = Math.max(1, total - stageBEnd);
    const t = slot / countC;
    // Lower protective arc from -0.12*PI to 1.12*PI
    const arcAngle = -0.1 * Math.PI + t * 1.2 * Math.PI;
    const ringLayer = slot % 2 === 0 ? 128 * scale : 138 * scale;
    const ryLayer = slot % 2 === 0 ? 104 * scale : 112 * scale;
    const pulse = Math.sin(frameCount * 0.022 + slot * 0.2) * 2.2 * scale;

    p.tx = cx + Math.cos(arcAngle) * (ringLayer + pulse);
    p.ty = cy + 16 * scale + Math.sin(arcAngle) * (ryLayer + pulse);
  });
};

/**
 * ─── CONCEPT 2: INGESTION PIPELINE & ENTITY RESOLUTION ───────────────────────
 * Stage A: Disjoint Turbulent Public Streams (Left)
 * Stage B: Unified Clean Deduplicated Stream (Right)
 * Stage C: Human-in-the-Loop Audit Orbit (Top-Right)
 */
const setAttorneyConceptTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number
) => {
  const { cx, cy, scale } = stage;
  const total = particles.length;
  const stageAEnd = Math.floor(total * 0.42);
  const stageBEnd = Math.floor(total * 0.76);

  particles.forEach((p, idx) => {
    // Stage A: 3 Disjoint Input Streams converging into Similarity Lens
    if (idx < stageAEnd) {
      const streamLane = idx % 3; // -1, 0, +1
      const speed = 0.0016 + (idx % 4) * 0.00022;
      const progress = (pseudoRandom(p.id * 1.7) + frameCount * speed) % 1;
      const startX = cx - 190 * scale;
      const laneOffset = (streamLane - 1) * 68 * scale;
      const startY = cy + laneOffset;
      const lensX = cx - 22 * scale;
      const lensY = cy + (streamLane - 1) * 5 * scale;

      const px = startX + (lensX - startX) * progress;
      const turbulence =
        Math.sin(frameCount * 0.036 + p.id * 0.7) *
        (14 * scale * (1 - progress * 0.78));
      const py = startY + (lensY - startY) * progress + turbulence;

      p.tx = px;
      p.ty = py;
      return;
    }

    // Stage B: Clean Unified Deduplicated Dataset Stream
    if (idx < stageBEnd) {
      const slot = idx - stageAEnd;
      const speed = 0.0014 + (slot % 4) * 0.00018;
      const progress = (pseudoRandom(p.id * 2.3) + frameCount * speed) % 1;
      const startX = cx - 18 * scale;
      const endX = cx + 190 * scale;
      const laneSpread = ((slot % 5) - 2) * 3.2 * scale;

      p.tx = startX + (endX - startX) * progress;
      p.ty = cy + laneSpread;
      return;
    }

    // Stage C: Human-in-the-Loop Audit Orbit
    const slot = idx - stageBEnd;
    const loopCx = cx + 44 * scale;
    const loopCy = cy - 72 * scale;
    const loopRadius = (32 + (slot % 2) * 5) * scale;
    const speed = 0.0058 + (slot % 3) * 0.001;
    const angle = p.angleOffset + frameCount * speed;

    p.tx = loopCx + Math.cos(angle) * loopRadius;
    p.ty = loopCy + Math.sin(angle) * (loopRadius * 0.88);
  });
};

/**
 * ─── CONCEPT 3: CLOUD IaC & HARDENING ────────────────────────────────────────
 * Stage A: Reproducible IaC Core Rings (Center-Left)
 * Stage B: Segmented VPC Orbital Perimeter Shield (Outer Ellipse)
 * Stage C: Auditable CI/CD Release Stream (Right)
 */
const setCloudIacConceptTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number
) => {
  const { cx, cy, scale } = stage;
  const coreX = cx - 26 * scale;
  const total = particles.length;
  const stageAEnd = Math.floor(total * 0.34);
  const stageBEnd = Math.floor(total * 0.74);

  particles.forEach((p, idx) => {
    // Stage A: Reproducible SAM/CloudFormation Nucleus
    if (idx < stageAEnd) {
      const isInner = idx < stageAEnd * 0.42;
      const ring = (isInner ? 20 : 44) * scale;
      const speed = 0.0034 * (isInner ? 1 : -0.75);
      const angle = p.angleOffset + frameCount * speed;
      const pulse = Math.sin(frameCount * 0.03) * 1.8 * scale;

      p.tx = coreX + Math.cos(angle) * (ring + pulse);
      p.ty = cy + Math.sin(angle) * ((ring + pulse) * 0.88);
      return;
    }

    // Stage B: Hardened VPC Subnet Perimeter Shield
    if (idx < stageBEnd) {
      const slot = idx - stageAEnd;
      const speed = 0.0045 * (slot % 2 === 0 ? 1 : -1);
      const angle = p.angleOffset + frameCount * speed;
      const rx = (104 + p.radiusMultiplier * 10) * scale;
      const ry = (84 + p.radiusMultiplier * 8) * scale;

      p.tx = coreX + Math.cos(angle) * rx;
      p.ty = cy + Math.sin(angle) * ry;
      return;
    }

    // Stage C: Auditable CI/CD Release Stream
    const slot = idx - stageBEnd;
    const speed = 0.0015 + (slot % 4) * 0.0002;
    const progress = (pseudoRandom(p.id * 3.1) + frameCount * speed) % 1;
    const startX = coreX + 106 * scale;
    const endX = cx + 195 * scale;
    const laneY = cy + ((slot % 4) - 1.5) * 5.5 * scale;

    p.tx = startX + (endX - startX) * progress;
    p.ty = laneY;
  });
};

/**
 * ─── CONCEPT 4: INTERACTIVE PORTFOLIO & CV ENGINE ────────────────────────────
 * Stage A: Single-Source-of-Truth JSON Nucleus (Left-Center)
 * Stage B: Interactive Canvas 2D / GSAP Harmonic Wave (Top-Right)
 * Stage C: Automated Node.js PDF Compilation Stream (Bottom-Right)
 */
const setPortfolioConceptTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number
) => {
  const { cx, cy, scale } = stage;
  const coreX = cx - 54 * scale;
  const total = particles.length;
  const stageAEnd = Math.floor(total * 0.32);
  const stageBEnd = Math.floor(total * 0.66);

  particles.forEach((p, idx) => {
    // Stage A: SSOT JSON Nucleus
    if (idx < stageAEnd) {
      const speed = 0.0042 * (idx % 2 === 0 ? 1 : -1);
      const angle = p.angleOffset + frameCount * speed;
      const breathing = Math.sin(frameCount * 0.028) * 3 * scale;
      const r = (18 + (idx % 3) * 9) * scale + breathing;

      p.tx = coreX + Math.cos(angle) * r;
      p.ty = cy + Math.sin(angle) * (r * 0.88);
      return;
    }

    // Stage B: Interactive Canvas 2D Harmonic Wave (Upper Branch)
    if (idx < stageBEnd) {
      const slot = idx - stageAEnd;
      const speed = 0.0015 + (slot % 3) * 0.00022;
      const progress = (pseudoRandom(p.id * 1.9) + frameCount * speed) % 1;
      const startX = coreX + 28 * scale;
      const endX = cx + 185 * scale;
      const startY = cy;
      const endY = cy - 76 * scale;

      const px = startX + (endX - startX) * progress;
      const basePy = startY + (endY - startY) * Math.pow(progress, 0.9);
      const wave =
        Math.sin(progress * Math.PI * 4 + frameCount * 0.04) * 7.5 * scale;

      p.tx = px;
      p.ty = basePy + wave;
      return;
    }

    // Stage C: Automated PDF Compilation Stream (Lower Branch)
    const slot = idx - stageBEnd;
    const speed = 0.0012 + (slot % 3) * 0.00018;
    const progress = (pseudoRandom(p.id * 2.8) + frameCount * speed) % 1;
    const startX = coreX + 28 * scale;
    const endX = cx + 185 * scale;
    const startY = cy;
    const endY = cy + 76 * scale;

    const stepped = Math.floor(progress * 4) / 4 + (progress % 0.25) * 0.72;
    const px = startX + (endX - startX) * stepped;
    const py = startY + (endY - startY) * stepped;
    const blockJitter = ((slot % 3) - 1) * 3.5 * scale;

    p.tx = px;
    p.ty = py + blockJitter;
  });
};

/**
 * ─── CONCEPT 4A (GUSTOHELADO): DOBLE BOCHA ARTESANAL & CUCURUCHO ─────────────
 * Stage A: Flujo de Ingesta en Cucurucho (Cono Waffle Crocante / Ámbar)
 * Stage B: Bocha 1 Inferior (Dulce de Leche / Chocolate Artesanal)
 * Stage C: Bocha 2 Superior (Frambuesa Silvestre / Fruto Rojo Vivo)
 * Stage D: Toppings de Pistacho, Chips y Destellos Aromáticos
 */
const setGustoHeladoScoopTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number
) => {
  const { cx, cy, scale } = stage;
  const total = particles.length;
  const stageAEnd = Math.floor(total * 0.26);
  const stageBEnd = Math.floor(total * 0.62);
  const stageCEnd = Math.floor(total * 0.88);

  const coneTipY = cy + 124 * scale;
  const coneTopY = cy + 30 * scale;
  const coneHalfW = 44 * scale;

  const scoop1Y = cy + 6 * scale;
  const scoop1R = 48 * scale;

  const scoop2Y = cy - 46 * scale;
  const scoop2R = 40 * scale;

  particles.forEach((p, idx) => {
    // Stage A: Upward Data Stream inside the Waffle Cone (Waffle Amber)
    if (idx < stageAEnd) {
      const speed = 0.0018 + (idx % 3) * 0.00025;
      const progress = (pseudoRandom(p.id * 1.5) + frameCount * speed) % 1;
      const currentHw = coneHalfW * (1 - progress);
      const lateralFactor = (pseudoRandom(p.id * 3.7) - 0.5) * 1.7;
      const xOffset = lateralFactor * currentHw;
      const py = coneTopY + (coneTipY - coneTopY) * progress;
      const jitter = Math.sin(frameCount * 0.035 + p.id) * 1.4 * scale;

      p.tx = cx + xOffset + jitter;
      p.ty = py;
      return;
    }

    // Stage B: Bocha 1 (Inferior: Dulce de Leche Artesanal)
    if (idx < stageBEnd) {
      const slot = idx - stageAEnd;
      const countB = stageBEnd - stageAEnd;
      const normalizedSlot = slot / countB;
      const latAngle = Math.PI * 0.12 + normalizedSlot * Math.PI * 0.76;
      const speed = 0.0028 * (slot % 2 === 0 ? 1 : -0.85);
      const angle = p.angleOffset + frameCount * speed;
      const breathing =
        Math.sin(frameCount * 0.026 + slot * 0.22) * 2.2 * scale;
      const radius = scoop1R + breathing + ((slot % 3) - 1) * 3 * scale;

      const px =
        cx - 2 * scale + Math.cos(angle) * Math.sin(latAngle) * radius;
      const py = scoop1Y - Math.cos(latAngle) * (radius * 0.9);

      p.tx = px;
      p.ty = py;
      return;
    }

    // Stage C: Bocha 2 (Superior: Frambuesa Silvestre)
    if (idx < stageCEnd) {
      const slot = idx - stageBEnd;
      const countC = stageCEnd - stageBEnd;
      const normalizedSlot = slot / countC;
      const latAngle = Math.PI * 0.08 + normalizedSlot * Math.PI * 0.8;
      const speed = 0.0034 * (slot % 2 === 0 ? -1 : 0.9);
      const angle = p.angleOffset + frameCount * speed;
      const breathing =
        Math.sin(frameCount * 0.032 + slot * 0.28) * 1.8 * scale;
      const radius = scoop2R + breathing + ((slot % 3) - 1) * 2.5 * scale;

      const px =
        cx + 3 * scale + Math.cos(angle) * Math.sin(latAngle) * radius;
      const py = scoop2Y - Math.cos(latAngle) * (radius * 0.92);

      p.tx = px;
      p.ty = py;
      return;
    }

    // Stage D: Toppings (Pistacho & Oro) and sweet aroma sparkles
    const slot = idx - stageCEnd;
    const speed = 0.0016 + (slot % 3) * 0.0002;
    const progress = (pseudoRandom(p.id * 4.2) + frameCount * speed) % 1;
    const angle = p.angleOffset + frameCount * 0.005;
    const spreadX = Math.cos(angle) * (26 + (slot % 4) * 7) * scale;
    const floatY = scoop2Y - scoop2R - 8 * scale - progress * 44 * scale;
    const wobble = Math.sin(frameCount * 0.04 + p.id) * 3 * scale;

    p.tx = cx + 3 * scale + spreadX + wobble;
    p.ty = floatY;
  });
};

/**
 * ─── CONCEPT 4B (GUSTOHELADO): RADAR POLAR GEOESPACIAL & HAVERSINE ───────────
 * Stage A: Concentric Haversine Sonar Wave Pulse (Walk radius scan)
 * Stage B: Ranked Gelateria POIs in Buenos Aires (Polar Clusters)
 * Stage C: Optimal Walking Vector (Blend Score Stream)
 */
const setGustoHeladoRadarTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number
) => {
  const { cx, cy, scale } = stage;
  const total = particles.length;
  const stageAEnd = Math.floor(total * 0.35);
  const stageBEnd = Math.floor(total * 0.8);

  const shops = [
    { angle: -Math.PI * 0.22, radius: 82 * scale },
    { angle: Math.PI * 0.15, radius: 55 * scale },
    { angle: Math.PI * 0.65, radius: 95 * scale },
    { angle: Math.PI * 0.95, radius: 70 * scale },
    { angle: -Math.PI * 0.75, radius: 110 * scale },
    { angle: -Math.PI * 0.5, radius: 42 * scale },
  ];

  particles.forEach((p, idx) => {
    // Stage A: Expanding Haversine Sonar Wave Rings
    if (idx < stageAEnd) {
      const ringLane = idx % 3;
      const speed = 0.0015 + ringLane * 0.0003;
      const progress = (pseudoRandom(p.id * 1.8) + frameCount * speed) % 1;
      const r = progress * 128 * scale;
      const angle = (idx / stageAEnd) * TAU + frameCount * 0.002;
      const jitter = Math.sin(frameCount * 0.03 + p.id) * 1.5 * scale;

      p.tx = cx + Math.cos(angle) * (r + jitter);
      p.ty = cy + Math.sin(angle) * (r * 0.85 + jitter);
      return;
    }

    // Stage B: Clustered Gelaterias in Buenos Aires
    if (idx < stageBEnd) {
      const slot = idx - stageAEnd;
      const targetShop = shops[slot % shops.length];
      const miniOrbitR = (6 + (slot % 3) * 4) * scale;
      const miniAngle = p.angleOffset + frameCount * 0.008;

      const shopCenterX = cx + Math.cos(targetShop.angle) * targetShop.radius;
      const shopCenterY =
        cy + Math.sin(targetShop.angle) * (targetShop.radius * 0.85);

      p.tx = shopCenterX + Math.cos(miniAngle) * miniOrbitR;
      p.ty = shopCenterY + Math.sin(miniAngle) * miniOrbitR;
      return;
    }

    // Stage C: Blend Score Walk Path (Direct Vector to #1 shop)
    const slot = idx - stageBEnd;
    const speed = 0.0035 + (slot % 3) * 0.0006;
    const progress = (pseudoRandom(p.id * 2.7) + frameCount * speed) % 1;
    const targetShop = shops[0];
    const endX = cx + Math.cos(targetShop.angle) * targetShop.radius;
    const endY = cy + Math.sin(targetShop.angle) * (targetShop.radius * 0.85);

    p.tx = cx + (endX - cx) * progress;
    p.ty = cy + (endY - cy) * progress;
  });
};

/**
 * ─── CONCEPT 4C (GUSTOHELADO): MATRIZ POLAR DE PERFIL DE SABORES ─────────────
 * Stage A: Polygon perimeter traversal (Chocolates, DDL, Cremas, Frutas, Autor)
 * Stage B: Flavor Axis Anchor Nodes
 * Stage C: Centroid Sensory Resonance Pulse
 */
const setGustoHeladoMatrixTargets = (
  particles: ProjectsRendererParticle[],
  stage: StageBounds,
  frameCount: number
) => {
  const { cx, cy, scale } = stage;
  const total = particles.length;
  const stageAEnd = Math.floor(total * 0.6);
  const stageBEnd = Math.floor(total * 0.85);

  const scores = [0.92, 0.96, 0.8, 0.72, 0.86];
  const maxR = 105 * scale;
  const vertices = scores.map((sc, i) => {
    const angle = -Math.PI * 0.5 + (i * TAU) / 5;
    const r = sc * maxR;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });

  particles.forEach((p, idx) => {
    // Stage A: Perimeter circulation along flavor polygon
    if (idx < stageAEnd) {
      const speed = 0.0022 + (idx % 3) * 0.0003;
      const progress = (pseudoRandom(p.id * 1.9) + frameCount * speed) % 1;
      const edgeIndex = Math.floor(progress * 5) % 5;
      const nextEdge = (edgeIndex + 1) % 5;
      const t = (progress * 5) % 1;
      const v1 = vertices[edgeIndex];
      const v2 = vertices[nextEdge];

      p.tx = v1.x + (v2.x - v1.x) * t;
      p.ty = v1.y + (v2.y - v1.y) * t;
      return;
    }

    // Stage B: Anchor Nodes on Vertices
    if (idx < stageBEnd) {
      const slot = idx - stageAEnd;
      const v = vertices[slot % 5];
      const orbitR = (7 + (slot % 3) * 3) * scale;
      const angle = p.angleOffset + frameCount * 0.006;

      p.tx = v.x + Math.cos(angle) * orbitR;
      p.ty = v.y + Math.sin(angle) * orbitR;
      return;
    }

    // Stage C: Centroid Sensory Resonance Pulse
    const slot = idx - stageBEnd;
    const angle = p.angleOffset + frameCount * 0.003;
    const pulseR = (16 + Math.sin(frameCount * 0.03 + slot) * 6) * scale;

    p.tx = cx + Math.cos(angle) * pulseR;
    p.ty = cy + Math.sin(angle) * pulseR;
  });
};

/**
 * Computes deterministic target coordinates for all shared InteractiveNetwork
 * particles while the Projects section is active.
 */
export const setProjectsParticleTargets = (
  particles: ProjectsRendererParticle[],
  viewportWidth: number,
  viewportHeight: number,
  frameCount: number,
  runtime: ProjectsRuntime
): void => {
  const state = runtime.stateRef.current;
  const stage = readStageBounds(viewportWidth, viewportHeight);

  if (!state.activeProjectId) {
    setFreeFloatingStageTargets(
      particles,
      stage,
      frameCount,
      state.hoveredProjectId !== null
    );
    return;
  }

  switch (state.activeProjectId) {
    case "geological-data-platform":
      setGeologicalConceptTargets(particles, stage, frameCount);
      break;
    case "attorney-scrapper":
      setAttorneyConceptTargets(particles, stage, frameCount);
      break;
    case "cloud-iac-hardening":
      setCloudIacConceptTargets(particles, stage, frameCount);
      break;
    case "gusto-helado": {
      const variant = state.gustoVariant ?? "scoop";
      if (variant === "radar") {
        setGustoHeladoRadarTargets(particles, stage, frameCount);
      } else if (variant === "matrix") {
        setGustoHeladoMatrixTargets(particles, stage, frameCount);
      } else {
        setGustoHeladoScoopTargets(particles, stage, frameCount);
      }
      break;
    }
    case "portfolio-cv-engine":
    default:
      setPortfolioConceptTargets(particles, stage, frameCount);
      break;
  }
};

/**
 * Draws delicate architectural guide curves for the active project concept.
 */
const drawGustoScoopGuides = (
  ctx: CanvasRenderingContext2D,
  stage: StageBounds
) => {
  const { cx, cy, scale } = stage;
  const coneTipY = cy + 124 * scale;
  const coneTopY = cy + 30 * scale;
  const coneHalfW = 44 * scale;

  const scoop1Y = cy + 6 * scale;
  const scoop1R = 48 * scale;

  const scoop2Y = cy - 46 * scale;
  const scoop2R = 40 * scale;

  ctx.lineWidth = 1.15;

  // 1. Waffle Cone (Cucurucho Waffle Ámbar / Dorado tostado)
  const coneColor: ProjectsRgb = { r: 218, g: 142, b: 58 };
  ctx.strokeStyle = rgba(coneColor, 0.32);
  ctx.beginPath();
  ctx.moveTo(cx - coneHalfW, coneTopY);
  ctx.lineTo(cx, coneTipY);
  ctx.lineTo(cx + coneHalfW, coneTopY);
  ctx.stroke();

  // Waffle grid cross-hatch inside cone
  ctx.setLineDash([2.5, 4]);
  ctx.strokeStyle = rgba(coneColor, 0.22);
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const y = coneTopY + (coneTipY - coneTopY) * t;
    const hw = coneHalfW * (1 - t);
    ctx.moveTo(cx - hw, y);
    ctx.lineTo(cx + hw * 0.4, y + 24 * scale);
    ctx.moveTo(cx + hw, y);
    ctx.lineTo(cx - hw * 0.4, y + 24 * scale);
  }
  ctx.stroke();

  // Rim ellipse at the cone mouth
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(coneColor, 0.35);
  ctx.beginPath();
  ctx.ellipse(cx, coneTopY, 46 * scale, 11 * scale, 0, 0, TAU);
  ctx.stroke();

  // 2. Bocha 1 (Inferior: Dulce de Leche Artesanal)
  const ddlColor: ProjectsRgb = { r: 204, g: 108, b: 38 };
  ctx.strokeStyle = rgba(ddlColor, 0.35);
  ctx.beginPath();
  ctx.arc(
    cx - 2 * scale,
    scoop1Y,
    scoop1R,
    Math.PI * 0.95,
    -Math.PI * 0.05,
    false
  );
  ctx.stroke();

  // Subtle latitude on Bocha 1
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = rgba(ddlColor, 0.2);
  ctx.beginPath();
  ctx.ellipse(
    cx - 2 * scale,
    scoop1Y - 10 * scale,
    38 * scale,
    9 * scale,
    0,
    0,
    TAU
  );
  ctx.stroke();

  // 3. Bocha 2 (Superior: Frambuesa Silvestre)
  const berryColor: ProjectsRgb = { r: 235, g: 54, b: 102 };
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(berryColor, 0.38);
  ctx.beginPath();
  ctx.arc(cx + 3 * scale, scoop2Y, scoop2R, Math.PI, 0, false);
  ctx.stroke();

  // Subtle latitude on Bocha 2
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = rgba(berryColor, 0.22);
  ctx.beginPath();
  ctx.ellipse(
    cx + 3 * scale,
    scoop2Y - 12 * scale,
    30 * scale,
    7 * scale,
    0,
    0,
    TAU
  );
  ctx.stroke();

  // 4. Little topping accent / cherry sparkle on top
  const topX = cx + 3 * scale;
  const topY = scoop2Y - scoop2R - 6 * scale;
  const pistacchioColor: ProjectsRgb = { r: 40, g: 198, b: 124 };
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(pistacchioColor, 0.5);
  ctx.beginPath();
  ctx.arc(topX, topY, 4.5 * scale, 0, TAU);
  ctx.stroke();
};

const drawGustoRadarGuides = (
  ctx: CanvasRenderingContext2D,
  stage: StageBounds,
  color: ProjectsRgb
) => {
  const { cx, cy, scale } = stage;

  ctx.strokeStyle = rgba(color, 0.22);
  ctx.lineWidth = 1.1;

  // 1. Concentric walk-distance rings
  [38, 76, 120].forEach((r, idx) => {
    ctx.setLineDash([2.5 + idx, 3.5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * scale, r * 0.85 * scale, 0, 0, TAU);
    ctx.stroke();
  });

  // 2. Center Crosshairs
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(color, 0.28);
  ctx.beginPath();
  ctx.moveTo(cx - 14 * scale, cy);
  ctx.lineTo(cx + 14 * scale, cy);
  ctx.moveTo(cx, cy - 14 * scale);
  ctx.lineTo(cx, cy + 14 * scale);
  ctx.stroke();

  // 3. Five flavor axes
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = rgba(color, 0.15);
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI * 0.5 + (i * TAU) / 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * 125 * scale, cy + Math.sin(angle) * 106 * scale);
    ctx.stroke();
  }

  // 4. Vector to top recommendation
  const topAngle = -Math.PI * 0.22;
  const topR = 82 * scale;
  const targetX = cx + Math.cos(topAngle) * topR;
  const targetY = cy + Math.sin(topAngle) * (topR * 0.85);

  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = rgba(color, 0.38);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(targetX, targetY, 8 * scale, 0, TAU);
  ctx.stroke();
};

const drawGustoMatrixGuides = (
  ctx: CanvasRenderingContext2D,
  stage: StageBounds,
  color: ProjectsRgb
) => {
  const { cx, cy, scale } = stage;
  const maxR = 105 * scale;

  ctx.strokeStyle = rgba(color, 0.18);
  ctx.lineWidth = 1.1;

  // Concentric pentagon rings (at 0.4, 0.7, 1.0)
  [0.4, 0.7, 1.0].forEach((ratio) => {
    ctx.setLineDash(ratio < 1 ? [2.5, 3.5] : []);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI * 0.5 + (i * TAU) / 5;
      const x = cx + Math.cos(angle) * maxR * ratio;
      const y = cy + Math.sin(angle) * maxR * ratio;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  // 5 Radial axes from center to vertices
  ctx.setLineDash([2, 4]);
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI * 0.5 + (i * TAU) / 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
    ctx.stroke();
  }
};

const drawConceptGuides = (
  ctx: CanvasRenderingContext2D,
  stage: StageBounds,
  projectId: string,
  color: ProjectsRgb,
  gustoVariant?: "scoop" | "radar" | "matrix"
) => {
  const { cx, cy, scale } = stage;
  ctx.save();
  ctx.strokeStyle = rgba(color, 0.22);
  ctx.lineWidth = 1.1;

  switch (projectId) {
    case "geological-data-platform": {
      // Funnel guides
      ctx.beginPath();
      ctx.moveTo(cx - 125 * scale, cy - 130 * scale);
      ctx.quadraticCurveTo(
        cx - 38 * scale,
        cy - 72 * scale,
        cx - 16 * scale,
        cy - 22 * scale
      );
      ctx.moveTo(cx + 125 * scale, cy - 130 * scale);
      ctx.quadraticCurveTo(
        cx + 38 * scale,
        cy - 72 * scale,
        cx + 16 * scale,
        cy - 22 * scale
      );
      ctx.stroke();

      // VPC protective lower arc
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(color, 0.28);
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy + 16 * scale,
        133 * scale,
        108 * scale,
        0,
        -0.08 * Math.PI,
        1.08 * Math.PI
      );
      ctx.stroke();
      break;
    }

    case "attorney-scrapper": {
      // Similarity focal lens
      ctx.beginPath();
      ctx.ellipse(cx - 20 * scale, cy, 10 * scale, 56 * scale, 0, 0, TAU);
      ctx.stroke();

      // Human-in-the-loop audit ring
      ctx.setLineDash([3, 3.5]);
      ctx.beginPath();
      ctx.ellipse(
        cx + 44 * scale,
        cy - 72 * scale,
        34 * scale,
        30 * scale,
        0,
        0,
        TAU
      );
      ctx.stroke();
      break;
    }

    case "cloud-iac-hardening": {
      const coreX = cx - 26 * scale;
      // Inner IaC ring
      ctx.beginPath();
      ctx.ellipse(coreX, cy, 44 * scale, 39 * scale, 0, 0, TAU);
      ctx.stroke();

      // Outer VPC perimeter shield
      ctx.setLineDash([3.5, 4]);
      ctx.strokeStyle = rgba(color, 0.28);
      ctx.beginPath();
      ctx.ellipse(coreX, cy, 108 * scale, 88 * scale, 0, 0, TAU);
      ctx.stroke();
      break;
    }

    case "gusto-helado": {
      const variant = gustoVariant ?? "scoop";
      if (variant === "radar") {
        drawGustoRadarGuides(ctx, stage, color);
      } else if (variant === "matrix") {
        drawGustoMatrixGuides(ctx, stage, color);
      } else {
        drawGustoScoopGuides(ctx, stage);
      }
      break;
    }

    case "portfolio-cv-engine":
    default: {
      const coreX = cx - 54 * scale;
      ctx.beginPath();
      ctx.arc(coreX, cy, 32 * scale, 0, TAU);
      ctx.stroke();

      // Forking paths from SSOT core
      ctx.setLineDash([2.5, 3.5]);
      ctx.beginPath();
      ctx.moveTo(coreX + 32 * scale, cy - 6 * scale);
      ctx.lineTo(cx + 175 * scale, cy - 74 * scale);
      ctx.moveTo(coreX + 32 * scale, cy + 6 * scale);
      ctx.lineTo(cx + 175 * scale, cy + 74 * scale);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
};

/**
 * Resolves the display RGB for a particle based on active project and custom palette roles.
 */
const getProjectsParticleDrawRgb = (
  node: ProjectsRendererParticle,
  state: ProjectsRuntimeState,
  fallbackRgb: ProjectsRgb,
  idx: number,
  total: number
): ProjectsRgb => {
  if (state.activeProjectId === "gusto-helado") {
    const variant = state.gustoVariant ?? "scoop";
    if (variant === "scoop") {
      const coneEnd = Math.floor(total * 0.26);
      const scoop1End = Math.floor(total * 0.62);
      const scoop2End = Math.floor(total * 0.88);

      if (idx < coneEnd) {
        // Cono Waffle: Ámbar tostado / Dorado crocante
        return { r: 218, g: 142, b: 58 };
      }
      if (idx < scoop1End) {
        // Bocha 1 (Inferior): Dulce de Leche artesanal / Caramelo
        return { r: 204, g: 108, b: 38 };
      }
      if (idx < scoop2End) {
        // Bocha 2 (Superior): Frambuesa silvestre viva
        return { r: 235, g: 54, b: 102 };
      }
      // Toppings: Pistacho verde & Maracuyá dorado
      return idx % 2 === 0
        ? { r: 40, g: 198, b: 124 }
        : { r: 245, g: 195, b: 65 };
    }
    if (variant === "radar") {
      const stageAEnd = Math.floor(total * 0.35);
      const stageBEnd = Math.floor(total * 0.8);
      if (idx < stageAEnd) {
        return { r: 45, g: 130, b: 240 };
      }
      if (idx < stageBEnd) {
        const flavorColors = [
          { r: 235, g: 54, b: 102 },
          { r: 204, g: 108, b: 38 },
          { r: 124, g: 58, b: 237 },
          { r: 40, g: 198, b: 124 },
          { r: 245, g: 195, b: 65 },
          { r: 218, g: 142, b: 58 },
        ];
        return flavorColors[idx % flavorColors.length];
      }
      return { r: 235, g: 54, b: 102 };
    }
    if (variant === "matrix") {
      const flavorColors = [
        { r: 140, g: 70, b: 35 },
        { r: 204, g: 108, b: 38 },
        { r: 240, g: 205, b: 120 },
        { r: 235, g: 54, b: 102 },
        { r: 124, g: 58, b: 237 },
      ];
      return flavorColors[idx % 5];
    }
  }
  return fallbackRgb;
};

/**
 * Renders the Projects particle stage:
 * - In free-floating mode: calm network filaments + drifting particles in the stage.
 * - In concept mode: architectural guides + high-definition concept formation.
 */
export const drawProjectsParticles = (
  ctx: CanvasRenderingContext2D,
  particles: ProjectsRendererParticle[],
  runtime: ProjectsRuntime,
  mouse: ProjectsMouseState,
  globalDriftX: number,
  globalDriftY: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _frameCount: number
): void => {
  const state = runtime.stateRef.current;
  const w = typeof window !== "undefined" ? window.innerWidth : ctx.canvas.width;
  const h =
    typeof window !== "undefined" ? window.innerHeight : ctx.canvas.height;
  const stage = readStageBounds(w, h);
  const readabilityZones = readReadabilityZones();

  const focusId = state.activeProjectId ?? state.hoveredProjectId;
  const focusProj = focusId
    ? state.projects.find((p) => p.id === focusId)
    : null;
  const activeColor = focusProj
    ? getProjectCategoryStyle(focusProj.category).rgb
    : { r: 45, g: 91, b: 227 };

  ctx.save();

  // 1. Draw architectural concept guides when a project is active
  if (state.activeProjectId) {
    drawConceptGuides(
      ctx,
      {
        ...stage,
        cx: stage.cx + globalDriftX,
        cy: stage.cy + globalDriftY,
      },
      state.activeProjectId,
      activeColor,
      state.gustoVariant
    );
  }

  // 2. Subtle local connections between nearby particles
  const maxConnections = Math.min(particles.length, 220);
  const connectionDist = state.activeProjectId ? 44 : 62;
  ctx.lineWidth = 0.65;

  for (let i = 0; i < maxConnections; i += 1) {
    const n1 = particles[i];
    const p1x = n1.x + globalDriftX;
    const p1y = n1.y + globalDriftY;

    for (let j = i + 1; j < maxConnections; j += 1) {
      const n2 = particles[j];
      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= connectionDist) continue;

      const alpha =
        (1 - dist / connectionDist) * (state.activeProjectId ? 0.11 : 0.085);
      const baseRgb = state.activeProjectId
        ? activeColor
        : { r: n1.r, g: n1.g, b: n1.b };
      const rgb = getProjectsParticleDrawRgb(
        n1,
        state,
        baseRgb,
        i,
        particles.length
      );

      ctx.strokeStyle = rgba(rgb, alpha);
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(n2.x + globalDriftX, n2.y + globalDriftY);
      ctx.stroke();
    }
  }

  // 3. Draw particles
  particles.forEach((node, idx) => {
    const px = node.x + globalDriftX;
    const py = node.y + globalDriftY;
    const mask = getReadabilityMask(px, py, readabilityZones);

    let radius = Math.max(1.75, node.baseRadius * 1.12);
    let alphaMultiplier = (state.activeProjectId ? 1.22 : 0.96) * mask;

    if (mouse.active) {
      const mDist = Math.hypot(mouse.x - node.x, mouse.y - node.y);
      const hoverRadius = 115;
      if (mDist < hoverRadius) {
        const ratio = (hoverRadius - mDist) / hoverRadius;
        radius *= 1 + ratio * 0.6;
        alphaMultiplier *= 1 + ratio * 1.35;
      }
    }

    const fallback = focusProj
      ? activeColor
      : { r: node.r, g: node.g, b: node.b };
    const rgb = getProjectsParticleDrawRgb(
      node,
      state,
      fallback,
      idx,
      particles.length
    );
    const outerAlpha = Math.min(0.4, 0.19 * alphaMultiplier);
    const coreAlpha = Math.min(0.92, 0.66 * alphaMultiplier);

    ctx.fillStyle = rgba(rgb, outerAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius * 1.45, 0, TAU);
    ctx.fill();

    ctx.fillStyle = rgba(rgb, coreAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.58, 0, TAU);
    ctx.fill();
  });

  ctx.restore();
};
