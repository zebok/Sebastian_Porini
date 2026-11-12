import {
  TIMELINE_BRANCH_ORDER,
  TIMELINE_BRANCH_STYLE,
  getTimelineScreenPoint,
  type TimelineBranchId,
  type TimelineMilestoneNode,
  type TimelineRuntime,
  type TimelineRuntimeState,
} from "../../visualizations/Timeline.runtime";

export interface TimelineRendererParticle {
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

export interface TimelineMouseState {
  x: number;
  y: number;
  active: boolean;
}

const BRANCH_BY_GROUP: readonly TimelineBranchId[] = TIMELINE_BRANCH_ORDER;
const TAU = Math.PI * 2;

const pseudoRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const getTimelineGroupColor = (group: number) => {
  const branchId = BRANCH_BY_GROUP[group % BRANCH_BY_GROUP.length] ?? "work";
  return TIMELINE_BRANCH_STYLE[branchId].rgb;
};

const getBranchHighlightFactor = (
  branchId: TimelineBranchId,
  state: TimelineRuntimeState
): number => {
  const focusBranch = state.hoveredBranchId ?? state.activeBranchId;
  if (focusBranch === null) return 1;
  return focusBranch === branchId ? 1.25 : 0.24;
};

const getGroupSlot = (particleId: number, group: number): number => {
  if (particleId < 200) {
    const startIdx = group === 0 ? 0 : group === 1 ? 66 : 132;
    return particleId - startIdx;
  }
  return 66 + Math.floor((particleId - 200) / 3);
};

interface ScreenCardZone {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const CARD_CLEAR_PAD_X = 24;
const CARD_CLEAR_PAD_Y = 20;
const CARD_FADE_MARGIN = 18;

const getVisibleDesktopCardZones = (
  state: TimelineRuntimeState
): ScreenCardZone[] => {
  const layout = state.layout;
  if (
    !state.enabled ||
    state.layoutMode !== "desktop" ||
    !layout ||
    state.viewport.width <= 0
  ) {
    return [];
  }

  const vpLeft = state.viewport.left;
  const vpTop = state.viewport.top;
  const vpRight = vpLeft + state.viewport.width;

  const zones: ScreenCardZone[] = [];
  for (const node of layout.nodes) {
    const left = vpLeft + node.cardRect.x - state.scrollLeft;
    const right = left + node.cardRect.width;
    if (right + CARD_CLEAR_PAD_X < vpLeft || left - CARD_CLEAR_PAD_X > vpRight) {
      continue;
    }
    zones.push({
      left,
      top: vpTop + node.cardRect.y,
      right,
      bottom: vpTop + node.cardRect.y + node.cardRect.height,
    });
  }
  if (state.activeBranchId) {
    const future = layout.futureAnchors[state.activeBranchId];
    const left = vpLeft + future.cardRect.x - state.scrollLeft;
    const right = left + future.cardRect.width;
    if (right + CARD_CLEAR_PAD_X >= vpLeft && left - CARD_CLEAR_PAD_X <= vpRight) {
      zones.push({
        left,
        top: vpTop + future.cardRect.y,
        right,
        bottom: vpTop + future.cardRect.y + future.cardRect.height,
      });
    }
  }
  return zones;
};

/**
 * Computes smoothly attenuated alpha (0..1) near milestone cards or mobile copy
 * so particles and connecting filaments stay cleanly out of readable text.
 */
const getParticleReadabilityMask = (
  x: number,
  y: number,
  state: TimelineRuntimeState,
  cardZones: ScreenCardZone[]
): number => {
  if (!state.enabled) return 1;

  if (state.layoutMode === "mobile") {
    const textStartX = Math.max(24, state.viewport.left + 8) + 18;
    if (x <= textStartX) return 1;
    const over = x - textStartX;
    return over >= CARD_FADE_MARGIN ? 0 : 1 - over / CARD_FADE_MARGIN;
  }

  let mask = 1;
  for (const z of cardZones) {
    const dx = Math.max(z.left - CARD_CLEAR_PAD_X - x, 0, x - (z.right + CARD_CLEAR_PAD_X));
    const dy = Math.max(z.top - CARD_CLEAR_PAD_Y - y, 0, y - (z.bottom + CARD_CLEAR_PAD_Y));
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.01) return 0;
    if (dist < CARD_FADE_MARGIN) {
      mask = Math.min(mask, dist / CARD_FADE_MARGIN);
    }
  }
  return mask;
};

const clampTargetOutsideCards = (
  tx: number,
  ty: number,
  laneY: number,
  cardZones: ScreenCardZone[]
): { x: number; y: number } => {
  let y = ty;
  for (const z of cardZones) {
    if (
      tx >= z.left - CARD_CLEAR_PAD_X &&
      tx <= z.right + CARD_CLEAR_PAD_X &&
      y >= z.top - CARD_CLEAR_PAD_Y &&
      y <= z.bottom + CARD_CLEAR_PAD_Y
    ) {
      // Deflect cleanly onto the branch lane side of the card
      y = laneY <= (z.top + z.bottom) * 0.5
        ? Math.min(laneY, z.top - CARD_CLEAR_PAD_Y - 2)
        : Math.max(laneY, z.bottom + CARD_CLEAR_PAD_Y + 2);
    }
  }
  return { x: tx, y };
};

/**
 * Computes deterministic target coordinates for all shared InteractiveNetwork
 * particles while the Timeline section is active or transitioning in.
 *
 * Particles in group 0/1/2 track strictly along education / work / experiences
 * lane rivers (or left spine on mobile), keeping a clean readability buffer around text.
 */
export const setTimelineParticleTargets = (
  particles: TimelineRendererParticle[],
  viewportWidth: number,
  viewportHeight: number,
  frameCount: number,
  runtime: TimelineRuntime
): void => {
  const state = runtime.stateRef.current;
  const layout = state.layout;
  const hasDesktopGeometry =
    state.enabled &&
    state.layoutMode === "desktop" &&
    layout !== null &&
    state.viewport.width > 0 &&
    state.viewport.height > 0;

  if (state.enabled && state.layoutMode === "mobile") {
    const spineX = Math.max(24, state.viewport.left + 8);
    const topY = Math.max(82, state.viewport.top + 8);
    const spanH = Math.max(280, Math.min(state.viewport.height, viewportHeight - topY));

    particles.forEach((p, idx) => {
      const speed = 0.00065 + p.group * 0.0001;
      const progress = (pseudoRandom(idx * 1.7 + 3) + frameCount * speed) % 1;
      const jitterX = Math.sin(frameCount * 0.014 + p.id) * 4.5;
      p.tx = spineX + jitterX;
      p.ty = topY + progress * spanH;
    });
    return;
  }

  const vpLeft = hasDesktopGeometry ? state.viewport.left : 0;
  const vpTop = hasDesktopGeometry ? state.viewport.top : 96;
  const vpW = hasDesktopGeometry ? state.viewport.width : viewportWidth;
  const vpH = hasDesktopGeometry
    ? state.viewport.height
    : Math.max(460, viewportHeight - 160);

  const fallbackLaneY: Record<TimelineBranchId, number> = {
    education: vpTop + vpH * 0.25,
    work: vpTop + vpH * 0.54,
    experiences: vpTop + vpH * 0.82,
  };

  const laneYByBranch: Record<TimelineBranchId, number> = { ...fallbackLaneY };
  if (hasDesktopGeometry && layout) {
    layout.branches.forEach((branch) => {
      laneYByBranch[branch.id] = vpTop + branch.y;
    });
  }

  const cardZones = getVisibleDesktopCardZones(state);
  const visibleNodesByBranch: Record<TimelineBranchId, TimelineMilestoneNode[]> = {
    education: [],
    work: [],
    experiences: [],
  };
  const visibleEdgesByBranch: Record<
    TimelineBranchId,
    NonNullable<TimelineRuntimeState["layout"]>["edges"]
  > = {
    education: [],
    work: [],
    experiences: [],
  };

  if (hasDesktopGeometry && layout) {
    layout.nodes.forEach((node) => {
      const screenX = vpLeft + node.x - state.scrollLeft;
      if (screenX >= vpLeft - 48 && screenX <= vpLeft + vpW + 48) {
        visibleNodesByBranch[node.branchId].push(node);
      }
    });
    layout.edges.forEach((edge) => {
      if (edge.kind === "continuity") return;
      const first = getTimelineScreenPoint(edge.points[0], state);
      const last = getTimelineScreenPoint(
        edge.points[edge.points.length - 1],
        state
      );
      const minX = Math.min(first.x, last.x);
      const maxX = Math.max(first.x, last.x);
      if (maxX >= vpLeft - 48 && minX <= vpLeft + vpW + 48) {
        visibleEdgesByBranch[edge.toBranchId].push(edge);
      }
    });
  }

  const totalPerGroup = Math.max(1, Math.floor(particles.length / 3));
  const streamWidth = vpW + 80;
  const scrollShift = hasDesktopGeometry ? state.scrollLeft * 0.55 : 0;

  particles.forEach((p) => {
    const branchId = BRANCH_BY_GROUP[p.group % 3] ?? "work";
    const laneY = laneYByBranch[branchId];
    const slot = getGroupSlot(p.id, p.group);
    const normalizedSlot = (slot % totalPerGroup) / totalPerGroup;

    const branchNodes = visibleNodesByBranch[branchId];
    const branchEdges = visibleEdgesByBranch[branchId];

    // 1. ~16% tight halo orbit around visible milestones on the branch lane
    const isMilestoneCluster = slot % 6 === 1 && branchNodes.length > 0;
    // 2. ~8% trace cross-branch fork/merge curves
    const isCurveTracer = slot % 12 === 4 && branchEdges.length > 0;

    if (isMilestoneCluster && hasDesktopGeometry) {
      const node = branchNodes[slot % branchNodes.length];
      const isFocused =
        state.hoveredMilestoneId === node.id ||
        state.selectedMilestoneId === node.id;
      const screenX = vpLeft + node.x - state.scrollLeft;
      const screenY = vpTop + node.y;
      const orbitR = isFocused
        ? 8 + p.radiusMultiplier * 6
        : 9 + p.radiusMultiplier * 7;
      const speed = isFocused ? 0.016 : 0.008;
      const angle = p.angleOffset + frameCount * speed;

      const safe = clampTargetOutsideCards(
        screenX + Math.cos(angle) * orbitR,
        screenY + Math.sin(angle) * orbitR,
        laneY,
        cardZones
      );
      p.tx = safe.x;
      p.ty = safe.y;
      return;
    }

    if (isCurveTracer && hasDesktopGeometry) {
      const edge = branchEdges[slot % branchEdges.length];
      const progress = (normalizedSlot * 3.7 + frameCount * 0.0045) % 1;
      const ptIdx = Math.min(
        edge.points.length - 1,
        Math.floor(progress * (edge.points.length - 1))
      );
      const pt = getTimelineScreenPoint(edge.points[ptIdx], state);
      const jitter = Math.sin(frameCount * 0.02 + p.id) * 1.6;
      const safe = clampTargetOutsideCards(pt.x, pt.y + jitter, laneY, cardZones);
      p.tx = safe.x;
      p.ty = safe.y;
      return;
    }

    // Core branch river cleanly channeled along each horizontal lane (~76% of particles)
    const speed =
      branchId === "work"
        ? 0.00052
        : branchId === "education"
        ? 0.00038
        : 0.00045;
    const rawPhase =
      normalizedSlot +
      pseudoRandom(p.id * 0.37) * 0.04 +
      frameCount * speed -
      scrollShift / streamWidth;
    const wrapped = ((rawPhase % 1) + 1) % 1;
    const x = vpLeft - 40 + wrapped * streamWidth;

    const ribbonSpread = (pseudoRandom(p.id * 1.91) - 0.5) * 8;
    const wave =
      Math.sin(x * 0.008 + frameCount * 0.016 + p.group * 2.09) * 3;

    const safe = clampTargetOutsideCards(x, laneY + ribbonSpread + wave, laneY, cardZones);
    p.tx = safe.x;
    p.ty = safe.y;
  });
};

/**
 * Draws delicate same-lane particle filaments and lane-colored particles on the
 * shared InteractiveNetwork canvas, fading cleanly outside readable milestone text zones.
 */
export const drawTimelineParticles = (
  ctx: CanvasRenderingContext2D,
  particles: TimelineRendererParticle[],
  runtime: TimelineRuntime,
  mouse: TimelineMouseState,
  globalDriftX: number,
  globalDriftY: number
): void => {
  const state = runtime.stateRef.current;
  const cardZones = getVisibleDesktopCardZones(state);
  const maxConnections = Math.min(particles.length, 200);
  const connectionDist = 64;

  // 1. Subtle same-branch filaments between nearby stream particles
  ctx.lineWidth = 0.65;
  for (let i = 0; i < maxConnections; i += 1) {
    const n1 = particles[i];
    const branchId = BRANCH_BY_GROUP[n1.group % 3] ?? "work";
    const branchBoost = getBranchHighlightFactor(branchId, state);
    if (branchBoost < 0.3) continue;

    const mask1 = getParticleReadabilityMask(
      n1.x + globalDriftX,
      n1.y + globalDriftY,
      state,
      cardZones
    );
    if (mask1 <= 0.04) continue;

    for (let j = i + 1; j < maxConnections; j += 1) {
      const n2 = particles[j];
      if (n1.group !== n2.group) continue;

      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= connectionDist) continue;

      const mask2 = getParticleReadabilityMask(
        n2.x + globalDriftX,
        n2.y + globalDriftY,
        state,
        cardZones
      );
      const mask = Math.min(mask1, mask2);
      if (mask <= 0.04) continue;

      let alpha =
        (1 - dist / connectionDist) * 0.08 * Math.min(1.2, branchBoost) * mask;
      if (mouse.active) {
        const midX = (n1.x + n2.x) * 0.5;
        const midY = (n1.y + n2.y) * 0.5;
        const mDist = Math.hypot(mouse.x - midX, mouse.y - midY);
        if (mDist < 120) {
          alpha *= 1 + ((120 - mDist) / 120) * 1.3;
        }
      }

      const r = Math.round(n1.r);
      const g = Math.round(n1.g);
      const b = Math.round(n1.b);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(4)})`;
      ctx.beginPath();
      ctx.moveTo(n1.x + globalDriftX, n1.y + globalDriftY);
      ctx.lineTo(n2.x + globalDriftX, n2.y + globalDriftY);
      ctx.stroke();
    }
  }

  // 2. Render particles with smooth interpolated RGB, branch focus, and card readability mask
  particles.forEach((node) => {
    const px = node.x + globalDriftX;
    const py = node.y + globalDriftY;
    const mask = getParticleReadabilityMask(px, py, state, cardZones);
    if (mask <= 0.02) return;

    const branchId = BRANCH_BY_GROUP[node.group % 3] ?? "work";
    const focusFactor = getBranchHighlightFactor(branchId, state);

    let radius = node.baseRadius * (focusFactor > 1 ? 1.12 : 1);
    let alphaMultiplier = focusFactor * mask;

    if (mouse.active) {
      const mDist = Math.hypot(mouse.x - node.x, mouse.y - node.y);
      const hoverRadius = 125;
      if (mDist < hoverRadius) {
        const ratio = (hoverRadius - mDist) / hoverRadius;
        radius *= 1 + ratio * 0.65;
        alphaMultiplier *= 1 + ratio * 1.4;
      }
    }

    const r = Math.round(node.r);
    const g = Math.round(node.g);
    const b = Math.round(node.b);

    const outerAlpha = Math.min(0.45, 0.2 * alphaMultiplier);
    const coreAlpha = Math.min(0.88, 0.55 * alphaMultiplier);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${outerAlpha.toFixed(4)})`;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${coreAlpha.toFixed(4)})`;
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.44, 0, TAU);
    ctx.fill();
  });
};
