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

interface ScreenPoint {
  x: number;
  y: number;
}

interface ScreenTagBox {
  tag: string;
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

interface ProjectsDomGeometry {
  nodesById: Map<string, ScreenPoint>;
  orderedNodeIds: string[];
  highlights: ScreenPoint[];
  tags: ScreenTagBox[];
  readabilityZones: ScreenRect[];
}

const TAU = Math.PI * 2;
const READABILITY_PAD_X = 14;
const READABILITY_PAD_Y = 10;
const READABILITY_FADE = 18;

const pseudoRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const rgba = (rgb: ProjectsRgb, alpha: number): string =>
  `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(
    rgb.b
  )}, ${Math.max(0, Math.min(1, alpha)).toFixed(4)})`;

const evalCubicBezier = (
  p0: ScreenPoint,
  p1: ScreenPoint,
  p2: ScreenPoint,
  p3: ScreenPoint,
  t: number
): ScreenPoint => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
};

export const getProjectsGroupColor = (
  group: number,
  runtime?: ProjectsRuntime
): ProjectsRgb => {
  const state = runtime?.stateRef.current;
  if (state && state.projects.length > 0) {
    const activeProj =
      state.projects.find((p) => p.id === state.activeProjectId) ??
      state.projects[0];
    if (group === 0) {
      return getProjectCategoryStyle(activeProj.category).rgb;
    }
    const mappedProj = state.projects[group % state.projects.length];
    if (mappedProj) {
      return getProjectCategoryStyle(mappedProj.category).rgb;
    }
  }
  if (group === 0) return { r: 45, g: 91, b: 227 };
  if (group === 1) return { r: 124, g: 58, b: 237 };
  return { r: 5, g: 150, b: 105 };
};

const readProjectsDomGeometry = (
  state: ProjectsRuntimeState,
  viewportWidth: number,
  viewportHeight: number
): ProjectsDomGeometry => {
  const nodesById = new Map<string, ScreenPoint>();
  const orderedNodeIds: string[] = [];
  const highlights: ScreenPoint[] = [];
  const tags: ScreenTagBox[] = [];
  const readabilityZones: ScreenRect[] = [];

  if (typeof document !== "undefined" && state.enabled) {
    state.projects.forEach((proj) => {
      const el = document.getElementById(`project-node-${proj.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          nodesById.set(proj.id, {
            x: rect.left + rect.width * 0.5,
            y: rect.top + rect.height * 0.5,
          });
          orderedNodeIds.push(proj.id);
        }
      }
    });

    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`project-highlight-${i}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          highlights.push({
            x: rect.left + rect.width * 0.5,
            y: rect.top + rect.height * 0.5,
          });
        }
      }
    }

    const tagEls = document.querySelectorAll<HTMLElement>("[data-project-tag]");
    tagEls.forEach((el) => {
      const tag = el.getAttribute("data-project-tag");
      if (!tag) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        tags.push({
          tag,
          x: rect.left + rect.width * 0.5,
          y: rect.top + rect.height * 0.5,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    const textEls = document.querySelectorAll<HTMLElement>(
      '[data-projects-readability-zone="true"]'
    );
    textEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        readabilityZones.push({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        });
      }
    });
  }

  // Fallback geometry if DOM hasn't mounted yet
  if (orderedNodeIds.length === 0) {
    const projectIds =
      state.projects.length > 0
        ? state.projects.map((p) => p.id)
        : [
            "geological-data-platform",
            "attorney-scrapper",
            "cloud-iac-hardening",
            "portfolio-cv-engine",
          ];
    const startY = viewportHeight * 0.3;
    const stepY = Math.min(88, viewportHeight * 0.13);
    const leftX = Math.max(64, viewportWidth * 0.16);

    projectIds.forEach((id, idx) => {
      nodesById.set(id, { x: leftX, y: startY + idx * stepY });
      orderedNodeIds.push(id);
    });
  }

  if (highlights.length === 0) {
    const rightX = viewportWidth * 0.52;
    const baseY = viewportHeight * 0.44;
    for (let i = 0; i < 3; i++) {
      highlights.push({ x: rightX, y: baseY + i * 38 });
    }
  }

  return {
    nodesById,
    orderedNodeIds,
    highlights,
    tags,
    readabilityZones,
  };
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
    if (dist <= 0.01) return 0;
    if (dist < READABILITY_FADE) {
      mask = Math.min(mask, dist / READABILITY_FADE);
    }
  }
  return mask;
};

/**
 * Assigns deterministic target coordinates for all shared InteractiveNetwork
 * particles when the Projects section is active.
 *
 * Zero random background noise: every particle belongs to an index node ring,
 * a tag perimeter satellite, or a connecting filament stream.
 */
export const setProjectsParticleTargets = (
  particles: ProjectsRendererParticle[],
  viewportWidth: number,
  viewportHeight: number,
  frameCount: number,
  runtime: ProjectsRuntime
): void => {
  const state = runtime.stateRef.current;
  const geom = readProjectsDomGeometry(state, viewportWidth, viewportHeight);
  const focusTag = state.hoveredTag ?? state.selectedTag;

  const activeNode =
    geom.nodesById.get(state.activeProjectId) ??
    geom.nodesById.get(geom.orderedNodeIds[0]) ?? {
      x: viewportWidth * 0.2,
      y: viewportHeight * 0.4,
    };

  // Identify projects that share the currently focused tag
  const matchingProjectIds = focusTag
    ? state.projects
        .filter((p) => p.tags.includes(focusTag))
        .map((p) => p.id)
        .filter((id) => geom.nodesById.has(id))
    : [];

  const focusedTagBox = focusTag
    ? geom.tags.find((t) => t.tag === focusTag) ?? null
    : null;

  const projectCount = Math.max(1, geom.orderedNodeIds.length);
  const RING_SLOTS_PER_PROJECT = 36;
  const totalRingSlots = projectCount * RING_SLOTS_PER_PROJECT;
  const TAG_SATELLITE_SLOTS = 120;
  const tagSlotsEnd = totalRingSlots + TAG_SATELLITE_SLOTS;

  particles.forEach((p, idx) => {
    // ─── 1. INDEX NODE RINGS (Left Column) ───────────────────────────────────
    if (idx < totalRingSlots) {
      const projIdx = Math.floor(idx / RING_SLOTS_PER_PROJECT);
      const slot = idx % RING_SLOTS_PER_PROJECT;
      const projId = geom.orderedNodeIds[projIdx] ?? geom.orderedNodeIds[0];
      const center = geom.nodesById.get(projId) ?? activeNode;

      const isActive = projId === state.activeProjectId;
      const isHovered = projId === state.hoveredProjectId;
      const isTagMatch = focusTag !== null && matchingProjectIds.includes(projId);

      // Boundary ring vs inner core orbit
      const isBoundary = slot < 24;
      let targetRadius = 8.5;
      let rotSpeed = 0.0025;

      if (isActive) {
        targetRadius = isBoundary ? 21 : 9 + p.radiusMultiplier * 7;
        rotSpeed = isBoundary ? 0.0032 : 0.0055;
      } else if (isTagMatch) {
        targetRadius = isBoundary ? 17.5 : 7 + p.radiusMultiplier * 5;
        rotSpeed = 0.0042;
      } else if (isHovered) {
        targetRadius = isBoundary ? 14.5 : 6 + p.radiusMultiplier * 4;
        rotSpeed = 0.0035;
      } else if (focusTag !== null) {
        targetRadius = isBoundary ? 5.5 : 3;
        rotSpeed = 0.0012;
      }

      const baseAngle = isBoundary
        ? (slot / 24) * TAU
        : p.angleOffset + slot * 0.4;
      const angle =
        baseAngle + frameCount * rotSpeed * (projIdx % 2 === 0 ? 1 : -1);
      const wave =
        isActive || isTagMatch
          ? Math.sin(frameCount * 0.02 + slot * 0.35) * 1.4
          : 0;

      p.tx = center.x + Math.cos(angle) * (targetRadius + wave);
      p.ty = center.y + Math.sin(angle) * (targetRadius + wave);
      return;
    }

    // ─── 2. TAG PERIMETER SATELLITES (Right Stage) ───────────────────────────
    if (idx < tagSlotsEnd && geom.tags.length > 0) {
      const localIdx = idx - totalRingSlots;
      const tagBox = geom.tags[localIdx % geom.tags.length];
      const isThisTagFocused = focusTag !== null && tagBox.tag === focusTag;

      const orbitSpeed = isThisTagFocused ? 0.0085 : 0.0035;
      const angle = p.angleOffset + frameCount * orbitSpeed + localIdx * 0.55;
      const padX = isThisTagFocused
        ? 6 + 9 * p.radiusMultiplier
        : 4 + 6 * p.radiusMultiplier;
      const padY = isThisTagFocused
        ? 5 + 7 * p.radiusMultiplier
        : 3 + 5 * p.radiusMultiplier;

      const rx = tagBox.width * 0.5 + padX;
      const ry = tagBox.height * 0.5 + padY;

      p.tx =
        tagBox.x +
        Math.cos(angle) * rx +
        Math.sin(frameCount * 0.012 + p.id) * 1.5;
      p.ty =
        tagBox.y +
        Math.sin(angle) * ry +
        Math.cos(frameCount * 0.011 + p.id) * 1.5;
      return;
    }

    // ─── 3. BRIDGE STREAM PARTICLES (Filaments between Index, Highlights & Tags)
    const streamIdx = idx - tagSlotsEnd;

    // 3A. When a tag is focused, stream particles along bridges from that tag to all matching projects!
    if (focusedTagBox && matchingProjectIds.length > 0) {
      const targetProjId =
        matchingProjectIds[streamIdx % matchingProjectIds.length];
      const targetNode = geom.nodesById.get(targetProjId) ?? activeNode;
      const isProjActive = targetProjId === state.activeProjectId;
      const ringR = isProjActive ? 21 : 17.5;

      const speed = 0.0032 + (streamIdx % 5) * 0.00045;
      const t = (pseudoRandom(p.id * 1.73) + frameCount * speed) % 1;

      const startPt: ScreenPoint = {
        x: focusedTagBox.x,
        y: focusedTagBox.y - focusedTagBox.height * 0.5 - 4,
      };
      const endPt: ScreenPoint = {
        x: targetNode.x + ringR,
        y: targetNode.y,
      };
      const dx = Math.max(60, Math.abs(startPt.x - endPt.x));
      const cp1: ScreenPoint = {
        x: startPt.x - Math.min(90, dx * 0.32),
        y: startPt.y - 32,
      };
      const cp2: ScreenPoint = {
        x: endPt.x + Math.max(48, dx * 0.38),
        y: endPt.y,
      };

      const pt = evalCubicBezier(startPt, cp1, cp2, endPt, t);
      const spread = (pseudoRandom(p.id * 3.1) - 0.5) * 4.5;
      p.tx = pt.x;
      p.ty = pt.y + spread;
      return;
    }

    // 3B. Default state: gentle stream from active project node to its highlights & tags
    const targets: ScreenPoint[] = [
      ...geom.highlights,
      ...geom.tags.map((t) => ({ x: t.x - t.width * 0.5 - 4, y: t.y })),
    ];

    if (targets.length > 0) {
      const dest = targets[streamIdx % targets.length];
      const speed = 0.0022 + (streamIdx % 4) * 0.00035;
      const t = (pseudoRandom(p.id * 2.17) + frameCount * speed) % 1;

      const startPt: ScreenPoint = {
        x: activeNode.x + 21,
        y: activeNode.y,
      };
      const endPt: ScreenPoint = {
        x: dest.x,
        y: dest.y,
      };
      const midX = startPt.x + (endPt.x - startPt.x) * 0.5;
      const cp1: ScreenPoint = { x: midX, y: startPt.y };
      const cp2: ScreenPoint = { x: midX, y: endPt.y };

      const pt = evalCubicBezier(startPt, cp1, cp2, endPt, t);
      const jitter = Math.sin(frameCount * 0.018 + p.id) * 2.2;
      p.tx = pt.x;
      p.ty = pt.y + jitter;
      return;
    }

    // Fallback orbit around active node
    const fallbackAngle = p.angleOffset + frameCount * 0.003;
    p.tx = activeNode.x + Math.cos(fallbackAngle) * 20;
    p.ty = activeNode.y + Math.sin(fallbackAngle) * 20;
  });
};

/**
 * Draws the structural rings, dashed Bézier filaments, travelling light beads,
 * and readability-masked particles for the Projects section.
 */
export const drawProjectsParticles = (
  ctx: CanvasRenderingContext2D,
  particles: ProjectsRendererParticle[],
  runtime: ProjectsRuntime,
  mouse: ProjectsMouseState,
  globalDriftX: number,
  globalDriftY: number,
  frameCount: number
): void => {
  const state = runtime.stateRef.current;
  const w = typeof window !== "undefined" ? window.innerWidth : ctx.canvas.width;
  const h = typeof window !== "undefined" ? window.innerHeight : ctx.canvas.height;
  const geom = readProjectsDomGeometry(state, w, h);
  const focusTag = state.hoveredTag ?? state.selectedTag;

  const activeProj =
    state.projects.find((p) => p.id === state.activeProjectId) ??
    state.projects[0];
  const activeColor = getProjectCategoryStyle(
    activeProj?.category ?? "data"
  ).rgb;

  const matchingProjectIds = focusTag
    ? state.projects
        .filter((p) => p.tags.includes(focusTag))
        .map((p) => p.id)
    : [];

  const focusedTagBox = focusTag
    ? geom.tags.find((t) => t.tag === focusTag) ?? null
    : null;

  ctx.save();

  // ─── 1. DRAW INDEX NODE RINGS (Venn-style structural circles) ──────────────
  geom.orderedNodeIds.forEach((projId) => {
    const center = geom.nodesById.get(projId);
    if (!center) return;

    const proj = state.projects.find((p) => p.id === projId);
    const rgb = getProjectCategoryStyle(proj?.category ?? "data").rgb;
    const isActive = projId === state.activeProjectId;
    const isHovered = projId === state.hoveredProjectId;
    const isTagMatch = focusTag !== null && matchingProjectIds.includes(projId);

    const cx = center.x + globalDriftX;
    const cy = center.y + globalDriftY;

    let radius = 8.5;
    let fillAlpha = 0.015;
    let strokeAlpha = 0.16;
    let lineWidth = 1.0;
    let dashed = false;

    if (isActive) {
      radius = 21 + Math.sin(frameCount * 0.035) * 0.8;
      fillAlpha = 0.045;
      strokeAlpha = 0.42;
      lineWidth = 1.5;
    } else if (isTagMatch) {
      radius = 17.5 + Math.sin(frameCount * 0.045) * 0.8;
      fillAlpha = 0.04;
      strokeAlpha = 0.46;
      lineWidth = 1.35;
      dashed = true;
    } else if (isHovered) {
      radius = 14.5;
      fillAlpha = 0.03;
      strokeAlpha = 0.3;
      lineWidth = 1.2;
    } else if (focusTag !== null) {
      radius = 5.5;
      fillAlpha = 0;
      strokeAlpha = 0.08;
    }

    ctx.setLineDash(dashed ? [3, 3] : []);
    if (fillAlpha > 0) {
      ctx.fillStyle = rgba(rgb, fillAlpha);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(rgb, strokeAlpha);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();
  });

  // ─── 2. DRAW ACTIVE PROJECT -> HIGHLIGHT FILAMENTS ─────────────────────────
  const activeCenter = geom.nodesById.get(state.activeProjectId);
  if (activeCenter && geom.highlights.length > 0) {
    const startX = activeCenter.x + 21 + globalDriftX;
    const startY = activeCenter.y + globalDriftY;
    const dimFactor = focusTag !== null ? 0.42 : 1;

    geom.highlights.forEach((hl, idx) => {
      const endX = hl.x - 6 + globalDriftX;
      const endY = hl.y + globalDriftY;
      const midX = startX + (endX - startX) * 0.52;

      const p0 = { x: startX, y: startY };
      const p1 = { x: midX, y: startY };
      const p2 = { x: midX, y: endY };
      const p3 = { x: endX, y: endY };

      // Soft outer glow
      const gradGlow = ctx.createLinearGradient(startX, startY, endX, endY);
      gradGlow.addColorStop(0, rgba(activeColor, 0.14 * dimFactor));
      gradGlow.addColorStop(1, rgba(activeColor, 0.06 * dimFactor));

      ctx.setLineDash([]);
      ctx.strokeStyle = gradGlow;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      ctx.stroke();

      // Crisp dashed core
      const gradCore = ctx.createLinearGradient(startX, startY, endX, endY);
      gradCore.addColorStop(0, rgba(activeColor, 0.45 * dimFactor));
      gradCore.addColorStop(1, rgba(activeColor, 0.28 * dimFactor));

      ctx.setLineDash([2.5, 3.5]);
      ctx.strokeStyle = rgba(activeColor, 0.34 * dimFactor);
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      ctx.stroke();

      // Travelling energy pulse bead
      if (!state.reducedMotion && focusTag === null) {
        const progress = (frameCount * 0.0042 + idx * 0.33) % 1;
        const bead = evalCubicBezier(p0, p1, p2, p3, progress);
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(activeColor, 0.78);
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, 2.2, 0, TAU);
        ctx.fill();

        ctx.fillStyle = rgba(activeColor, 0.18);
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, 4.6, 0, TAU);
        ctx.fill();
      }
    });
  }

  // ─── 3. DRAW TAG CONNECTION BRIDGES (Tag -> All Matching Projects) ─────────
  if (focusedTagBox && matchingProjectIds.length > 0) {
    const startX = focusedTagBox.x + globalDriftX;
    const startY =
      focusedTagBox.y - focusedTagBox.height * 0.5 - 4 + globalDriftY;

    matchingProjectIds.forEach((projId, idx) => {
      const targetCenter = geom.nodesById.get(projId);
      if (!targetCenter) return;

      const proj = state.projects.find((p) => p.id === projId);
      const projRgb = getProjectCategoryStyle(proj?.category ?? "data").rgb;
      const isProjActive = projId === state.activeProjectId;
      const ringR = isProjActive ? 21 : 17.5;

      const endX = targetCenter.x + ringR + globalDriftX;
      const endY = targetCenter.y + globalDriftY;
      const dx = Math.max(60, Math.abs(startX - endX));

      const p0 = { x: startX, y: startY };
      const p1 = { x: startX - Math.min(90, dx * 0.32), y: startY - 32 };
      const p2 = { x: endX + Math.max(48, dx * 0.38), y: endY };
      const p3 = { x: endX, y: endY };

      // Outer glow
      const gradGlow = ctx.createLinearGradient(startX, startY, endX, endY);
      gradGlow.addColorStop(0, rgba(activeColor, 0.26));
      gradGlow.addColorStop(1, rgba(projRgb, 0.26));

      ctx.setLineDash([]);
      ctx.strokeStyle = gradGlow;
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      ctx.stroke();

      // Dashed inner filament
      const gradCore = ctx.createLinearGradient(startX, startY, endX, endY);
      gradCore.addColorStop(0, rgba(activeColor, 0.78));
      gradCore.addColorStop(1, rgba(projRgb, 0.85));

      ctx.setLineDash([2.5, 3.5]);
      ctx.strokeStyle = gradCore;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      ctx.stroke();

      // Travelling energy bead from Tag -> Matching Project Node
      if (!state.reducedMotion) {
        const progress = (frameCount * 0.0055 + idx * 0.28) % 1;
        const bead = evalCubicBezier(p0, p1, p2, p3, progress);
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(projRgb, 0.92);
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, 2.6, 0, TAU);
        ctx.fill();

        ctx.fillStyle = rgba(projRgb, 0.24);
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, 5.2, 0, TAU);
        ctx.fill();
      }
    });
  }

  ctx.setLineDash([]);

  // ─── 4. DRAW PARTICLES (with readability attenuation over text) ────────────
  const projectCount = Math.max(1, geom.orderedNodeIds.length);
  const totalRingSlots = projectCount * 36;
  const tagSlotsEnd = totalRingSlots + 120;

  particles.forEach((node, idx) => {
    const px = node.x + globalDriftX;
    const py = node.y + globalDriftY;

    const mask = getReadabilityMask(px, py, geom.readabilityZones);
    if (mask <= 0.02) return;

    let alphaMultiplier = mask;
    let radius = node.baseRadius;

    let rgb = { r: node.r, g: node.g, b: node.b };

    if (idx < totalRingSlots) {
      const projIdx = Math.floor(idx / 36);
      const projId = geom.orderedNodeIds[projIdx];
      const proj = state.projects.find((p) => p.id === projId);
      if (proj) {
        rgb = getProjectCategoryStyle(proj.category).rgb;
      }
      const isActive = projId === state.activeProjectId;
      const isTagMatch = focusTag !== null && matchingProjectIds.includes(projId);
      if (isActive || isTagMatch) {
        radius *= 1.18;
        alphaMultiplier *= 1.45;
      } else if (focusTag !== null) {
        alphaMultiplier *= 0.35;
      } else {
        alphaMultiplier *= 0.85;
      }
    } else if (idx < tagSlotsEnd) {
      rgb = activeColor;
      alphaMultiplier *= focusTag !== null ? 1.15 : 0.9;
    } else {
      // Stream & channel particles: keep delicate so they never overpower
      rgb = activeColor;
      radius *= 0.88;
      alphaMultiplier *= focusTag !== null ? 0.92 : 0.62;
    }

    if (mouse.active) {
      const mDist = Math.hypot(mouse.x - node.x, mouse.y - node.y);
      const hoverRadius = 110;
      if (mDist < hoverRadius) {
        const ratio = (hoverRadius - mDist) / hoverRadius;
        radius *= 1 + ratio * 0.55;
        alphaMultiplier *= 1 + ratio * 1.25;
      }
    }

    const outerAlpha = Math.min(0.42, 0.2 * alphaMultiplier);
    const coreAlpha = Math.min(0.86, 0.54 * alphaMultiplier);

    ctx.fillStyle = rgba(rgb, outerAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = rgba(rgb, coreAlpha);
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.44, 0, TAU);
    ctx.fill();
  });

  ctx.restore();
};
