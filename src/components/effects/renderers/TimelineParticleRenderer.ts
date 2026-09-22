import {
  getTimelineScreenPoint,
  type TimelineEdgeGeometry,
  type TimelineNodeGeometry,
  type TimelineRuntime,
  type TimelineRuntimeState,
} from "../../visualizations/Timeline.runtime";

export interface TimelineRendererParticle {
  readonly id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

interface TimelineRendererOptions {
  animateContinuously: boolean;
}

const EDGE_SLOT_COUNT = 15;
const EDGE_PARTICLES_PER_SLOT = 16;
const CLUSTER_SLOT_COUNT = 13;
const CLUSTER_PARTICLES_PER_SLOT = 18;
const EDGE_PARTICLE_BUDGET = EDGE_SLOT_COUNT * EDGE_PARTICLES_PER_SLOT;

export const TIMELINE_PARTICLE_BUDGET =
  EDGE_PARTICLE_BUDGET +
  CLUSTER_SLOT_COUNT * CLUSTER_PARTICLES_PER_SLOT;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const colorWithAlpha = (color: string, alpha: number): string => {
  const normalizedAlpha = clamp01(alpha);
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i.exec(color);
  const longHex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);

  if (shortHex) {
    const [, red, green, blue] = shortHex;
    return `rgba(${parseInt(red + red, 16)}, ${parseInt(
      green + green,
      16
    )}, ${parseInt(blue + blue, 16)}, ${normalizedAlpha})`;
  }

  if (longHex) {
    const [, red, green, blue] = longHex;
    return `rgba(${parseInt(red, 16)}, ${parseInt(
      green,
      16
    )}, ${parseInt(blue, 16)}, ${normalizedAlpha})`;
  }

  return color;
};

const getRevealThreshold = (state: TimelineRuntimeState): number => {
  const layout = state.layout;
  if (!layout) return 0;
  const span = Math.max(1, layout.bounds.bottom - layout.bounds.top);
  return layout.bounds.top + span * clamp01(state.revealProgress);
};

const getBranchColor = (
  branchId: TimelineEdgeGeometry["branchId"],
  state: TimelineRuntimeState
): string =>
  state.layout?.lanes.find((lane) => lane.id === branchId)?.color ??
  "#69a7ff";

const getEdgeAlpha = (
  edge: TimelineEdgeGeometry,
  state: TimelineRuntimeState
): number => {
  const selectedBranch = state.activeBranchId;
  const branchFactor =
    selectedBranch === null || edge.branchId === selectedBranch ? 1 : 0.16;
  const statusFactor =
    edge.status === "committed" ? 1 : edge.status === "wip" ? 0.68 : 0.4;
  const mergeFactor = edge.kind === "merge-parent" ? 1.18 : 1;
  return Math.min(1, branchFactor * statusFactor * mergeFactor);
};

const getEdgeParticleStride = (edge: TimelineEdgeGeometry): number => {
  if (edge.status === "forecast") return 3;
  if (edge.status === "wip") return 2;
  return 1;
};

const applyEdgeDash = (
  ctx: CanvasRenderingContext2D,
  edge: TimelineEdgeGeometry
) => {
  if (edge.status === "forecast") {
    ctx.setLineDash([2, 9]);
  } else if (edge.status === "wip") {
    ctx.setLineDash([5, 7]);
  } else if (edge.kind === "merge-parent") {
    ctx.setLineDash([3, 5]);
  } else {
    ctx.setLineDash([]);
  }
};

const getRevealedEdgePoints = (
  edge: TimelineEdgeGeometry,
  revealThreshold: number
) => edge.points.filter((point) => point.y <= revealThreshold);

const drawEdges = (
  ctx: CanvasRenderingContext2D,
  edges: TimelineEdgeGeometry[],
  state: TimelineRuntimeState,
  revealThreshold: number
) => {
  edges.slice(0, EDGE_SLOT_COUNT).forEach((edge) => {
    const points = getRevealedEdgePoints(edge, revealThreshold);
    if (points.length < 2) return;

    const color = getBranchColor(edge.branchId, state);
    const alpha = getEdgeAlpha(edge, state);
    const first = getTimelineScreenPoint(points[0], state);

    ctx.save();
    applyEdgeDash(ctx, edge);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    points.slice(1).forEach((point) => {
      const screenPoint = getTimelineScreenPoint(point, state);
      ctx.lineTo(screenPoint.x, screenPoint.y);
    });
    ctx.strokeStyle = colorWithAlpha(color, 0.16 * alpha);
    ctx.lineWidth = edge.kind === "merge-parent" ? 4 : 3;
    ctx.shadowColor = colorWithAlpha(color, 0.34 * alpha);
    ctx.shadowBlur = edge.kind === "merge-parent" ? 10 : 7;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = colorWithAlpha(color, 0.72 * alpha);
    ctx.lineWidth = edge.kind === "merge-parent" ? 1.35 : 0.9;
    ctx.stroke();
    ctx.restore();
  });
};

const positionParticle = (
  particle: TimelineRendererParticle,
  targetX: number,
  targetY: number,
  animateContinuously: boolean
) => {
  particle.tx = targetX;
  particle.ty = targetY;

  if (!animateContinuously) {
    particle.x = targetX;
    particle.y = targetY;
    return;
  }

  particle.x += (targetX - particle.x) * 0.16;
  particle.y += (targetY - particle.y) * 0.16;
};

const drawParticle = (
  ctx: CanvasRenderingContext2D,
  particle: TimelineRendererParticle,
  color: string,
  radius: number,
  alpha: number,
  glowRadius: number
) => {
  ctx.fillStyle = colorWithAlpha(color, alpha * 0.22);
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, glowRadius, 0, TAU);
  ctx.fill();

  ctx.fillStyle = colorWithAlpha(color, alpha);
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, radius, 0, TAU);
  ctx.fill();
};

const drawEdgeParticles = (
  ctx: CanvasRenderingContext2D,
  particles: TimelineRendererParticle[],
  edges: TimelineEdgeGeometry[],
  state: TimelineRuntimeState,
  revealThreshold: number,
  animateContinuously: boolean
) => {
  edges.slice(0, EDGE_SLOT_COUNT).forEach((edge, edgeIndex) => {
    const color = getBranchColor(edge.branchId, state);
    const alpha = getEdgeAlpha(edge, state);
    const stride = getEdgeParticleStride(edge);
    const lastPointIndex = Math.max(0, edge.points.length - 1);

    for (
      let localIndex = 0;
      localIndex < EDGE_PARTICLES_PER_SLOT;
      localIndex += 1
    ) {
      if (localIndex % stride !== 0) continue;
      const particle =
        particles[edgeIndex * EDGE_PARTICLES_PER_SLOT + localIndex];
      if (!particle) continue;

      const pointIndex = Math.round(
        (localIndex / (EDGE_PARTICLES_PER_SLOT - 1)) * lastPointIndex
      );
      const point = edge.points[pointIndex];
      if (!point || point.y > revealThreshold) continue;

      const screenPoint = getTimelineScreenPoint(point, state);
      positionParticle(
        particle,
        screenPoint.x,
        screenPoint.y,
        animateContinuously
      );
      drawParticle(
        ctx,
        particle,
        color,
        edge.kind === "merge-parent" ? 1.2 : 1,
        0.68 * alpha,
        edge.kind === "merge-parent" ? 3.8 : 3
      );
    }
  });
};

const getHighlightedNodeIds = (
  edges: TimelineEdgeGeometry[],
  state: TimelineRuntimeState
): Set<string> => {
  if (state.activeBranchId === null) return new Set();

  const highlightedIds = new Set<string>();
  edges.forEach((edge) => {
    if (edge.branchId !== state.activeBranchId) return;
    highlightedIds.add(edge.parentId);
    highlightedIds.add(edge.childId);
  });
  return highlightedIds;
};

const getNodeAlpha = (
  node: TimelineNodeGeometry,
  highlightedNodeIds: Set<string>,
  state: TimelineRuntimeState
): number => {
  const branchSelected = state.activeBranchId !== null;
  const inSelectedLineage =
    node.branchId === state.activeBranchId || highlightedNodeIds.has(node.id);
  const branchFactor = !branchSelected || inSelectedLineage ? 1 : 0.18;
  const statusFactor =
    node.status === "committed" ? 1 : node.status === "wip" ? 0.74 : 0.46;
  return branchFactor * statusFactor;
};

const getClusterParticleStride = (node: TimelineNodeGeometry): number => {
  if (node.status === "forecast") return 3;
  if (node.status === "wip") return 2;
  return 1;
};

const drawCommitClusters = (
  ctx: CanvasRenderingContext2D,
  particles: TimelineRendererParticle[],
  nodes: TimelineNodeGeometry[],
  edges: TimelineEdgeGeometry[],
  state: TimelineRuntimeState,
  revealThreshold: number,
  animateContinuously: boolean
) => {
  const highlightedNodeIds = getHighlightedNodeIds(edges, state);

  nodes.slice(0, CLUSTER_SLOT_COUNT).forEach((node, nodeIndex) => {
    if (node.y > revealThreshold) return;

    const color = getBranchColor(node.branchId, state);
    const isActiveCommit = state.activeCommitId === node.id;
    const isMerge = node.isMerge;
    const alpha = isActiveCommit
      ? 1
      : getNodeAlpha(node, highlightedNodeIds, state);
    const stride = getClusterParticleStride(node);
    const center = getTimelineScreenPoint(node, state);
    const clusterRadius =
      node.radius * (isActiveCommit ? 1.78 : isMerge ? 1.38 : 1.12);

    ctx.save();
    if (node.status !== "committed") {
      ctx.setLineDash(node.status === "forecast" ? [2, 6] : [4, 5]);
    }
    ctx.strokeStyle = colorWithAlpha(
      color,
      alpha * (isActiveCommit ? 0.92 : 0.52)
    );
    ctx.lineWidth = isActiveCommit ? 1.8 : isMerge ? 1.35 : 0.9;
    ctx.beginPath();
    ctx.arc(center.x, center.y, clusterRadius, 0, TAU);
    ctx.stroke();
    ctx.restore();

    for (
      let localIndex = 0;
      localIndex < CLUSTER_PARTICLES_PER_SLOT;
      localIndex += 1
    ) {
      if (localIndex % stride !== 0) continue;
      const particle =
        particles[
          EDGE_PARTICLE_BUDGET +
            nodeIndex * CLUSTER_PARTICLES_PER_SLOT +
            localIndex
        ];
      if (!particle) continue;

      const radialProgress =
        localIndex === 0
          ? 0
          : Math.sqrt(localIndex / (CLUSTER_PARTICLES_PER_SLOT - 1));
      const angle = localIndex * GOLDEN_ANGLE + nodeIndex * 0.37;
      const targetX =
        center.x + Math.cos(angle) * clusterRadius * radialProgress;
      const targetY =
        center.y + Math.sin(angle) * clusterRadius * radialProgress;
      positionParticle(particle, targetX, targetY, animateContinuously);
      drawParticle(
        ctx,
        particle,
        color,
        isActiveCommit ? 1.85 : isMerge ? 1.38 : 1.12,
        alpha * (isActiveCommit ? 1 : 0.78),
        isActiveCommit ? 6.4 : isMerge ? 4.4 : 3.6
      );
    }
  });
};

/**
 * Renders the fixed-canvas Timeline scene from the final runtime snapshot.
 * Particle slots are a deterministic prefix of the shared network pool; the
 * renderer owns no canvas, RAF, event listener, or secondary particle array.
 */
export const renderTimelineParticles = (
  ctx: CanvasRenderingContext2D,
  particles: TimelineRendererParticle[],
  runtime: TimelineRuntime,
  options: TimelineRendererOptions
) => {
  const state = runtime.stateRef.current;
  const layout = state.layout;
  if (
    !state.enabled ||
    !layout ||
    state.viewport.width <= 0 ||
    state.viewport.height <= 0 ||
    state.revealProgress <= 0
  ) {
    return;
  }

  const revealThreshold = getRevealThreshold(state);
  const animateContinuously =
    options.animateContinuously && !state.reducedMotion;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    state.viewport.left,
    state.viewport.top,
    state.viewport.width,
    state.viewport.height
  );
  ctx.clip();

  drawEdges(ctx, layout.edges, state, revealThreshold);
  drawEdgeParticles(
    ctx,
    particles,
    layout.edges,
    state,
    revealThreshold,
    animateContinuously
  );
  drawCommitClusters(
    ctx,
    particles,
    layout.nodes,
    layout.edges,
    state,
    revealThreshold,
    animateContinuously
  );

  ctx.restore();
};
