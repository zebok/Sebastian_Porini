import { polygonCentroid, polygonContains, polygonHull } from "d3-polygon";
import type { BrainConceptViewModel } from "@/types/brain";
import type { SkillId } from "@/types/content";
import {
  BRAIN_SKILL_POSITIONS,
  getBrainConceptFocusNodes,
  getBrainConceptEnergy,
  getBrainSubnodePosition,
} from "@/components/visualizations/BrainGraph.config";
import {
  BRAIN_BOUNDS_SCALE_X,
  BRAIN_BOUNDS_SCALE_Y,
  BRAIN_MASK_POLYGON,
  isPointInBrain,
  isPointInBrainInset,
  type BrainNormalizedPoint,
} from "@/components/visualizations/BrainGraph.geometry";

/**
 * Canvas and geometry layer for the brain scene.
 * React state, browser events and requestAnimationFrame remain owned by
 * InteractiveNetwork; this module only calculates and draws a supplied frame.
 */

export type BrainRole =
  | "boundary"
  | "fissure"
  | "gyrus"
  | "sulcus"
  | "neuron"
  | "fill";

export type BrainSide = "hard" | "soft" | "language" | "center";

export interface BrainPoint {
  x: number;
  y: number;
  role: BrainRole;
  side: BrainSide;
  track: number;
  skill: SkillId | null;
  subIndex?: number;
}

export interface BrainBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  halfWidth: number;
  halfHeight: number;
}

export interface BrainFiring {
  x: number;
  y: number;
  radius: number;
  life: number;
  side: BrainSide;
}

export interface BrainConnectionSignal {
  fromSkill: SkillId;
  toSkill: SkillId;
  progress: number;
  speed: number;
  curveDirection: number;
}

export interface BrainRendererNode {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  baseRadius: number;
  angleOffset: number;
  brainX: number;
  brainY: number;
  brainRole: BrainRole;
  brainSide: BrainSide;
  brainTrack: number;
  brainSkill: SkillId | null;
  brainSubIndex: number;
  pulse: number;
}

const BRAIN_COLORS = {
  hard: { r: 229, g: 72, b: 77 },
  soft: { r: 45, g: 91, b: 227 },
  center: { r: 124, g: 58, b: 237 },
  language: { r: 5, g: 150, b: 105 },
  introMuted: { r: 112, g: 114, b: 116 },
};

const getRGBA = (
  color: { r: number; g: number; b: number },
  alpha: number
) => `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const cubicBezier = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) => {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
};

const randomPointInRightBrain = (
  random: () => number,
  posteriorOnly = false
): BrainNormalizedPoint => {
  for (let attempt = 0; attempt < 120; attempt++) {
    const x = 0.035 + random() * 0.925;
    const y = posteriorOnly
      ? 0.3 + random() * 0.68
      : random() * 1.98 - 1;

    if (isPointInBrainInset(x, y, 0.045)) {
      return { x, y };
    }
  }

  return { x: 0.2, y: posteriorOnly ? 0.48 : 0 };
};

const createBrainBlueprint = (count: number): BrainPoint[] => {
  const points: BrainPoint[] = [];
  const random = seededRandom(7319);
  const fissureCount = 44;
  const gyrusCount = 160;
  const sulcusCount = 72;
  const neuronCount = 119;

  BRAIN_MASK_POLYGON.forEach((point) => {
    points.push({
      x: point.x,
      y: point.y,
      role: "boundary",
      side: "center",
      track: 0,
      skill: null,
    });
  });

  for (let index = 0; index < fissureCount; index++) {
    const t = index / Math.max(1, fissureCount - 1);
    points.push({
      x: 0,
      y: -0.91 + t * 1.79,
      role: "fissure",
      side: "center",
      track: 0,
      skill: null,
    });
  }

  const gyrusTracks = 10;
  const pointsPerGyrus = gyrusCount / gyrusTracks;
  const xBands = [0.075, 0.24, 0.42, 0.6, 0.76];

  for (let track = 0; track < gyrusTracks; track++) {
    const rightSide = track >= 5;
    const direction = rightSide ? 1 : -1;
    const band = track % 5;
    const x = xBands[band];
    const p0 = { x: direction * x * 0.9, y: -0.84 + band * 0.035 };
    const p1 = { x: direction * Math.min(0.9, x + 0.11), y: -0.34 + band * 0.055 };
    const p2 = { x: direction * Math.max(0.08, x - 0.1), y: 0.34 + band * 0.035 };
    const p3 = { x: direction * x * 0.88, y: 0.86 + band * 0.022 };

    for (let pointIndex = 0; pointIndex < pointsPerGyrus; pointIndex++) {
      const t = pointIndex / Math.max(1, pointsPerGyrus - 1);
      const point = cubicBezier(p0, p1, p2, p3, t);
      const texture =
        Math.sin(t * Math.PI * 4.2 + band * 0.7) * 0.032 +
        Math.sin(t * Math.PI * 9.4 + band) * 0.009;

      points.push({
        x: point.x + direction * texture,
        y: point.y + Math.cos(t * Math.PI * 6.2 + band) * 0.008,
        role: "gyrus",
        side: "center",
        track,
        skill: null,
      });
    }
  }

  const sulcusTracks = 6;
  const pointsPerSulcus = sulcusCount / sulcusTracks;
  const sulcusY = [-0.27, 0.16, 0.64];

  for (let track = 0; track < sulcusTracks; track++) {
    const direction = track % 2 === 0 ? -1 : 1;
    const band = Math.floor(track / 2);
    const p0 = { x: direction * 0.09, y: sulcusY[band] - 0.08 };
    const p1 = { x: direction * 0.28, y: sulcusY[band] - 0.02 };
    const p2 = { x: direction * 0.58, y: sulcusY[band] + 0.09 };
    const p3 = { x: direction * (0.83 - band * 0.06), y: sulcusY[band] + 0.04 };

    for (let pointIndex = 0; pointIndex < pointsPerSulcus; pointIndex++) {
      const t = pointIndex / Math.max(1, pointsPerSulcus - 1);
      const point = cubicBezier(p0, p1, p2, p3, t);
      points.push({
        x: point.x + direction * Math.sin(t * Math.PI * 5 + band) * 0.014,
        y: point.y + Math.sin(t * Math.PI * 3.4 + band * 0.8) * 0.022,
        role: "sulcus",
        side: "center",
        track,
        skill: null,
      });
    }
  }

  const skillNeuronBlueprint = BRAIN_SKILL_POSITIONS.flatMap((skill) => {
    const neuronCountForSkill = skill.kind === "language" ? 1 : 4;

    return Array.from({ length: neuronCountForSkill }, (_, subIndex) => ({
      skill,
      subIndex,
    }));
  });

  skillNeuronBlueprint.forEach(({ skill, subIndex }) => {
    const position = getBrainSubnodePosition(skill.id, subIndex, false);
    points.push({
      x: position.x,
      y: position.y,
      role: "neuron",
      side: skill.kind,
      track: 0,
      skill: skill.id,
      subIndex,
    });
  });

  const ambientNeuronPairCount =
    (neuronCount - skillNeuronBlueprint.length) / 2;

  for (let pairIndex = 0; pairIndex < ambientNeuronPairCount; pairIndex++) {
    const point = randomPointInRightBrain(random, pairIndex % 2 === 0);

    [1, -1].forEach((direction) => {
      points.push({
        x: point.x * direction,
        y: point.y,
        role: "neuron",
        side: "center",
        track: 0,
        skill: null,
      });
    });
  }

  while (points.length < count) {
    const remaining = count - points.length;
    if (remaining === 1) {
      points.push({
        x: 0,
        y: 0,
        role: "fill",
        side: "center",
        track: 0,
        skill: null,
      });
      break;
    }

    const point = randomPointInRightBrain(random, points.length % 4 === 0);
    [1, -1].forEach((direction) => {
      points.push({
        x: point.x * direction,
        y: point.y,
        role: "fill",
        side: "center",
        track: 0,
        skill: null,
      });
    });
  }

  return points.slice(0, count);
};

const getBrainBounds = (anchor: HTMLElement | null, fallbackWidth: number, fallbackHeight: number): BrainBounds => {
  const rect = anchor?.getBoundingClientRect();
  const width = rect?.width || Math.min(fallbackWidth * 0.48, 610);
  const height = rect?.height || Math.min(fallbackHeight * 0.68, 610);
  const x = rect?.left ?? (fallbackWidth - width) / 2;
  const y = rect?.top ?? (fallbackHeight - height) / 2;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    halfWidth: width * BRAIN_BOUNDS_SCALE_X,
    halfHeight: height * BRAIN_BOUNDS_SCALE_Y,
  };
};

const setBrainTargets = (
  nodes: BrainRendererNode[],
  bounds: BrainBounds,
  frameCount: number,
  focusSkill: SkillId | null,
  selectedSkills: Set<SkillId>,
  isPinned: boolean
) => {
  nodes.forEach((node) => {
    let targetBrainX = node.brainX;
    let targetBrainY = node.brainY;
    if (node.brainSkill) {
      const skillPosition = getBrainSubnodePosition(
        node.brainSkill,
        node.brainSubIndex,
        node.brainSkill === focusSkill ||
        (isPinned && selectedSkills.has(node.brainSkill))
      );
      targetBrainX = skillPosition.x;
      targetBrainY = skillPosition.y;
    }
    const verticalDrift =
      node.brainRole === "neuron" && !node.brainSkill
        ? Math.cos(frameCount * 0.006 + node.angleOffset) * 0.28
        : 0;

    node.tx =
      bounds.centerX +
      targetBrainX * bounds.halfWidth;
    node.ty =
      bounds.centerY +
      targetBrainY * bounds.halfHeight +
      verticalDrift;
  });
};


const getBrainColor = (side: BrainSide) => {
  if (side === "hard") return BRAIN_COLORS.hard;
  if (side === "soft") return BRAIN_COLORS.soft;
  if (side === "language") return BRAIN_COLORS.language;
  return BRAIN_COLORS.center;
};

const traceBrainOutline = (
  ctx: CanvasRenderingContext2D,
  boundaryNodes: BrainRendererNode[]
) => {
  if (!boundaryNodes.length) return;
  ctx.beginPath();
  ctx.moveTo(boundaryNodes[0].x, boundaryNodes[0].y);
  for (let index = 1; index < boundaryNodes.length; index++) {
    ctx.lineTo(boundaryNodes[index].x, boundaryNodes[index].y);
  }
  ctx.closePath();
};

const drawBrainStructure = (
  ctx: CanvasRenderingContext2D,
  nodes: BrainRendererNode[],
  bounds: BrainBounds,
  concepts: BrainConceptViewModel[],
  focusSide: BrainSide | null,
  focusSkill: SkillId | null,
  selectedSkills: Set<SkillId>,
  isPinned: boolean,
  frameCount: number
) => {
  const boundaryNodes = nodes.filter((node) => node.brainRole === "boundary");
  const conceptProtagonistIds = new Set(
    concepts.map((concept) => concept.visual.protagonistId)
  );
  const meshNodes = nodes.filter(
    (node) =>
      node.brainRole === "boundary" ||
      node.brainRole === "gyrus" ||
      node.brainRole === "sulcus" ||
      node.brainRole === "fill" ||
      (node.brainRole === "neuron" && node.brainSkill === null)
  );

  // Every structural layer uses the same path. Nothing beneath the final
  // outline can leak across the cortical edge, including glows and line caps.
  ctx.save();
  traceBrainOutline(ctx, boundaryNodes);
  ctx.clip();

  const integratedGradient = ctx.createLinearGradient(
    bounds.centerX - bounds.halfWidth,
    bounds.centerY,
    bounds.centerX + bounds.halfWidth,
    bounds.centerY
  );
  integratedGradient.addColorStop(0, getRGBA(BRAIN_COLORS.center, 0.045));
  integratedGradient.addColorStop(0.44, getRGBA(BRAIN_COLORS.soft, 0.032));
  integratedGradient.addColorStop(0.56, getRGBA(BRAIN_COLORS.language, 0.026));
  integratedGradient.addColorStop(1, getRGBA(BRAIN_COLORS.center, 0.045));
  ctx.fillStyle = integratedGradient;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

  const neuralField = ctx.createRadialGradient(
    bounds.centerX,
    bounds.centerY - bounds.halfHeight * 0.08,
    0,
    bounds.centerX,
    bounds.centerY,
    Math.max(bounds.halfWidth, bounds.halfHeight)
  );
  neuralField.addColorStop(0, getRGBA(BRAIN_COLORS.soft, 0.045));
  neuralField.addColorStop(0.58, getRGBA(BRAIN_COLORS.center, 0.025));
  neuralField.addColorStop(1, getRGBA(BRAIN_COLORS.center, 0));
  ctx.fillStyle = neuralField;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

  const fissureGradient = ctx.createLinearGradient(
    bounds.centerX - 7,
    0,
    bounds.centerX + 7,
    0
  );
  fissureGradient.addColorStop(0, "rgba(249, 249, 247, 0)");
  fissureGradient.addColorStop(0.34, "rgba(249, 249, 247, 0.78)");
  fissureGradient.addColorStop(0.5, "rgba(249, 249, 247, 0.96)");
  fissureGradient.addColorStop(0.66, "rgba(249, 249, 247, 0.78)");
  fissureGradient.addColorStop(1, "rgba(249, 249, 247, 0)");
  ctx.fillStyle = fissureGradient;
  ctx.fillRect(
    bounds.centerX - 7,
    bounds.centerY - bounds.halfHeight * 0.88,
    14,
    bounds.halfHeight * 1.76
  );

  const drawTracks = (role: BrainRole, trackCount: number) => {
    for (let track = 0; track < trackCount; track++) {
      const trackNodes = nodes.filter(
        (node) => node.brainRole === role && node.brainTrack === track
      );
      if (trackNodes.length < 2) continue;
      const side = trackNodes[0].brainSide;
      const isDimmed = focusSide !== null && side !== "center" && focusSide !== side;
      const color = getBrainColor(side);

      ctx.beginPath();
      ctx.moveTo(trackNodes[0].x, trackNodes[0].y);
      for (let index = 1; index < trackNodes.length - 1; index++) {
        const current = trackNodes[index];
        const next = trackNodes[index + 1];
        ctx.quadraticCurveTo(
          current.x,
          current.y,
          (current.x + next.x) / 2,
          (current.y + next.y) / 2
        );
      }
      const lastNode = trackNodes[trackNodes.length - 1];
      ctx.lineTo(lastNode.x, lastNode.y);
      ctx.strokeStyle = getRGBA(
        color,
        role === "gyrus"
          ? (isDimmed ? 0.08 : 0.22)
          : (isDimmed ? 0.045 : 0.12)
      );
      ctx.lineWidth = role === "gyrus" ? 0.65 : 0.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };

  drawTracks("gyrus", 10);
  drawTracks("sulcus", 6);

  const connectionRadius = Math.max(
    40,
    Math.min(bounds.width, bounds.height) * 0.103
  );
  const connectionRadiusSquared = connectionRadius * connectionRadius;
  const boundaryConnectionRadius = connectionRadius * 1.4;
  const boundaryConnectionRadiusSquared = boundaryConnectionRadius ** 2;
  const maximumConnections =
    focusSkill || selectedSkills.size > 0 ? 6 : 7;
  const ambientNodes = meshNodes.filter(
    (node) => node.brainSide === "center"
  );
  const rightMeshNodes = ambientNodes.filter((node) => node.brainX > 0.018);

  const gridSize = boundaryConnectionRadius;
  const spatialBuckets = new Map<string, BrainRendererNode[]>();
  rightMeshNodes.forEach((node) => {
    const column = Math.floor(node.x / gridSize);
    const row = Math.floor(node.y / gridSize);
    const key = `${column}:${row}`;
    const bucket = spatialBuckets.get(key);
    if (bucket) bucket.push(node);
    else spatialBuckets.set(key, [node]);
  });

  ctx.beginPath();
  rightMeshNodes.forEach((node) => {
    const column = Math.floor(node.x / gridSize);
    const row = Math.floor(node.y / gridSize);
    let connectionCount = 0;

    for (
      let offsetX = -1;
      offsetX <= 1 && connectionCount < maximumConnections;
      offsetX++
    ) {
      for (
        let offsetY = -1;
        offsetY <= 1 && connectionCount < maximumConnections;
        offsetY++
      ) {
        const candidates =
          spatialBuckets.get(`${column + offsetX}:${row + offsetY}`) ?? [];

        for (const candidate of candidates) {
          if (
            candidate.id <= node.id ||
            connectionCount >= maximumConnections
          ) {
            continue;
          }
          if (
            node.brainRole === "boundary" &&
            candidate.brainRole === "boundary"
          ) {
            continue;
          }

          const deltaX = candidate.x - node.x;
          const deltaY = candidate.y - node.y;
          const reachesBoundary =
            node.brainRole === "boundary" ||
            candidate.brainRole === "boundary";
          const maximumDistanceSquared = reachesBoundary
            ? boundaryConnectionRadiusSquared
            : connectionRadiusSquared;

          if (deltaX * deltaX + deltaY * deltaY >= maximumDistanceSquared) {
            continue;
          }

          ctx.moveTo(node.x, node.y);
          ctx.lineTo(candidate.x, candidate.y);
          ctx.moveTo(2 * bounds.centerX - node.x, node.y);
          ctx.lineTo(2 * bounds.centerX - candidate.x, candidate.y);
          connectionCount++;
        }
      }
    }
  });

  const rightInteriorNodes = rightMeshNodes.filter(
    (node) => node.brainRole !== "boundary"
  );
  const medialBoundaryNodes = ambientNodes.filter(
    (node) =>
      node.brainRole === "boundary" && Math.abs(node.brainX) <= 0.018
  );

  medialBoundaryNodes.forEach((medialNode) => {
    let nearest: { node: BrainRendererNode; distanceSquared: number } | null =
      null;
    let secondNearest: {
      node: BrainRendererNode;
      distanceSquared: number;
    } | null = null;

    for (const node of rightInteriorNodes) {
      const distanceSquared =
        (node.x - medialNode.x) ** 2 + (node.y - medialNode.y) ** 2;
      if (distanceSquared >= boundaryConnectionRadiusSquared) continue;

      if (!nearest || distanceSquared < nearest.distanceSquared) {
        secondNearest = nearest;
        nearest = { node, distanceSquared };
      } else if (
        !secondNearest ||
        distanceSquared < secondNearest.distanceSquared
      ) {
        secondNearest = { node, distanceSquared };
      }
    }

    const medialConnections: {
      node: BrainRendererNode;
      distanceSquared: number;
    }[] = [];
    if (nearest) medialConnections.push(nearest);
    if (secondNearest) medialConnections.push(secondNearest);

    medialConnections.forEach((connection) => {
      const { node } = connection;
      ctx.moveTo(medialNode.x, medialNode.y);
      ctx.lineTo(node.x, node.y);
      ctx.moveTo(medialNode.x, medialNode.y);
      ctx.lineTo(2 * bounds.centerX - node.x, node.y);
    });
  });

  ctx.strokeStyle = getRGBA(
    BRAIN_COLORS.center,
    focusSkill || selectedSkills.size > 0 ? 0.064 : 0.095
  );
  ctx.lineWidth = 0.42;
  ctx.lineCap = "round";
  ctx.stroke();

  const hubConnectionLimit =
    focusSkill || selectedSkills.size > 0 ? 9 : 12;
  const hubConnectionRadiusSquared = connectionRadiusSquared * 3.35;
  const interiorAmbientNodes = ambientNodes.filter(
    (node) => node.brainRole !== "boundary"
  );
  const protagonistNetworks = nodes
    .filter(
      (node) =>
        node.brainRole === "neuron" &&
        node.brainSkill !== null &&
        node.brainSubIndex === 0 &&
        conceptProtagonistIds.has(node.brainSkill)
    )
    .map((hub) => {
      const targetDistanceSquared = connectionRadiusSquared * 1.55;
      const minimumDistanceSquared = connectionRadiusSquared * 0.28;
      const spokeSlots: (
        | { node: BrainRendererNode; distanceSquared: number }
        | null
      )[] = Array.from({ length: hubConnectionLimit }, () => null);

      for (const node of interiorAmbientNodes) {
        const deltaX = node.x - hub.x;
        const deltaY = node.y - hub.y;
        const distanceSquared =
          deltaX * deltaX + deltaY * deltaY;
        if (
          distanceSquared <= minimumDistanceSquared ||
          distanceSquared >= hubConnectionRadiusSquared
        ) {
          continue;
        }

        const normalizedAngle =
          (Math.atan2(deltaY, deltaX) + Math.PI) / (Math.PI * 2);
        const slotIndex = Math.min(
          hubConnectionLimit - 1,
          Math.floor(normalizedAngle * hubConnectionLimit)
        );
        const current = spokeSlots[slotIndex];
        if (
          current === null ||
          Math.abs(distanceSquared - targetDistanceSquared) <
          Math.abs(current.distanceSquared - targetDistanceSquared)
        ) {
          spokeSlots[slotIndex] = { node, distanceSquared };
        }
      }

      return {
        hub,
        spokes: spokeSlots.filter(
          (
            connection
          ): connection is {
            node: BrainRendererNode;
            distanceSquared: number;
          } => connection !== null
        ),
      };
    });

  const hubNetworkDimmed = focusSkill !== null || selectedSkills.size > 0;
  const isHubActive = (hub: BrainRendererNode) =>
    hub.brainSkill !== null &&
    (hub.brainSkill === focusSkill || selectedSkills.has(hub.brainSkill));
  const coreConnections: {
    start: BrainRendererNode;
    end: BrainRendererNode;
    curveDirection: number;
  }[] = [];
  const coreConnectionKeys = new Set<string>();

  protagonistNetworks.forEach(({ hub }) => {
    protagonistNetworks
      .filter((candidate) => candidate.hub.id !== hub.id)
      .map((candidate) => ({
        hub: candidate.hub,
        distanceSquared:
          (candidate.hub.x - hub.x) ** 2 +
          (candidate.hub.y - hub.y) ** 2,
      }))
      .sort((first, second) => first.distanceSquared - second.distanceSquared)
      .slice(0, 2)
      .forEach((candidate) => {
        const firstId = Math.min(hub.id, candidate.hub.id);
        const secondId = Math.max(hub.id, candidate.hub.id);
        const key = `${firstId}:${secondId}`;
        if (coreConnectionKeys.has(key)) return;
        coreConnectionKeys.add(key);
        coreConnections.push({
          start: hub,
          end: candidate.hub,
          curveDirection: (firstId + secondId) % 2 === 0 ? 1 : -1,
        });
      });
  });

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  coreConnections.forEach(({ start, end, curveDirection }) => {
    const connectionActive = isHubActive(start) || isHubActive(end);
    const connectionDimmed = hubNetworkDimmed && !connectionActive;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const controlX =
      (start.x + end.x) / 2 + deltaY * 0.045 * curveDirection;
    const controlY =
      (start.y + end.y) / 2 - deltaX * 0.045 * curveDirection;
    const magneticGradient = ctx.createLinearGradient(
      start.x,
      start.y,
      end.x,
      end.y
    );
    const endpointAlpha = connectionDimmed
      ? 0.025
      : connectionActive
        ? 0.24
        : 0.095;
    const centerAlpha = connectionDimmed
      ? 0.018
      : connectionActive
        ? 0.2
        : 0.072;
    magneticGradient.addColorStop(
      0,
      getRGBA(getBrainColor(start.brainSide), endpointAlpha)
    );
    magneticGradient.addColorStop(
      0.5,
      `rgba(255, 255, 255, ${centerAlpha})`
    );
    magneticGradient.addColorStop(
      1,
      getRGBA(getBrainColor(end.brainSide), endpointAlpha)
    );

    ctx.strokeStyle = magneticGradient;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(controlX, controlY, end.x, end.y);
    ctx.globalAlpha = connectionActive ? 0.48 : 0.34;
    ctx.lineWidth = connectionActive ? 3.1 : 2.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = connectionActive ? 0.72 : 0.54;
    ctx.stroke();
  });

  protagonistNetworks.forEach(({ hub, spokes }) => {
    const color = getBrainColor(hub.brainSide);
    const hubActive = isHubActive(hub);
    const hubDimmed = hubNetworkDimmed && !hubActive;

    spokes.forEach(({ node }) => {
      const energyGradient = ctx.createLinearGradient(
        node.x,
        node.y,
        hub.x,
        hub.y
      );
      energyGradient.addColorStop(
        0,
        getRGBA(
          BRAIN_COLORS.center,
          hubDimmed ? 0.012 : hubActive ? 0.055 : 0.036
        )
      );
      energyGradient.addColorStop(
        0.68,
        getRGBA(color, hubDimmed ? 0.034 : hubActive ? 0.15 : 0.09)
      );
      energyGradient.addColorStop(
        1,
        getRGBA(color, hubDimmed ? 0.075 : hubActive ? 0.32 : 0.2)
      );
      ctx.strokeStyle = energyGradient;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(hub.x, hub.y);
      ctx.globalAlpha = hubActive ? 0.52 : 0.38;
      ctx.lineWidth = hubActive ? 2.5 : 1.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = hubActive ? 0.64 : 0.5;
      ctx.stroke();
    });
  });
  ctx.restore();

  if (frameCount > 0) {
    protagonistNetworks.forEach(({ hub, spokes }, hubIndex) => {
      if (!spokes.length) return;

      const cycle =
        frameCount * (0.008 + hubIndex * 0.00022) + hubIndex * 0.41;
      const spoke = spokes[Math.floor(cycle) % spokes.length].node;
      const rawProgress = cycle % 1;
      const progress =
        rawProgress * rawProgress * (3 - 2 * rawProgress);
      const signalX = spoke.x + (hub.x - spoke.x) * progress;
      const signalY = spoke.y + (hub.y - spoke.y) * progress;
      const color = getBrainColor(hub.brainSide);
      const hubActive = isHubActive(hub);
      const hubDimmed = hubNetworkDimmed && !hubActive;
      const halo = ctx.createRadialGradient(
        signalX,
        signalY,
        0,
        signalX,
        signalY,
        4.2
      );
      halo.addColorStop(
        0,
        getRGBA(color, hubDimmed ? 0.09 : hubActive ? 0.34 : 0.24)
      );
      halo.addColorStop(1, getRGBA(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(signalX, signalY, 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${hubDimmed ? 0.4 : hubActive ? 0.9 : 0.76
        })`;
      ctx.beginPath();
      ctx.arc(signalX, signalY, 0.72, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  (["hard", "soft", "language"] as BrainSide[]).forEach((kind) => {
    const skillNodes = nodes.filter(
      (node) =>
        node.brainRole === "neuron" &&
        node.brainSide === kind &&
        node.brainSubIndex === 0
    );
    const color = getBrainColor(kind);
    const isDimmed = focusSide !== null && focusSide !== kind;
    const longConnectionRadius = bounds.width * (kind === "language" ? 0.34 : 0.58);
    const longConnectionRadiusSquared = longConnectionRadius * longConnectionRadius;

    ctx.beginPath();
    for (let first = 0; first < skillNodes.length; first++) {
      const a = skillNodes[first];
      for (let second = first + 1; second < skillNodes.length; second++) {
        const b = skillNodes[second];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy >= longConnectionRadiusSquared) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }

      if (
        a.brainSkill !== null &&
        !conceptProtagonistIds.has(a.brainSkill)
      ) {
        for (
          let ambientIndex = 0;
          ambientIndex < ambientNodes.length;
          ambientIndex++
        ) {
          const ambient = ambientNodes[ambientIndex];
          const dx = ambient.x - a.x;
          const dy = ambient.y - a.y;
          if (dx * dx + dy * dy >= connectionRadiusSquared * 2.35) {
            continue;
          }
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(ambient.x, ambient.y);
        }
      }
    }

    ctx.strokeStyle = getRGBA(
      color,
      isDimmed ? 0.018 : focusSide === kind ? 0.15 : kind === "language" ? 0.075 : 0.052
    );
    ctx.lineWidth = focusSide === kind ? 0.72 : 0.44;
    ctx.stroke();
  });

  const activeSkillIds = new Set(selectedSkills);
  if (focusSkill) activeSkillIds.add(focusSkill);

  activeSkillIds.forEach((activeSkillId) => {
    const focusedNeurons = nodes.filter(
      (node) => node.brainSkill === activeSkillId
    );
    if (focusedNeurons.length) {
      const color = getBrainColor(focusedNeurons[0].brainSide);
      const isHovered = activeSkillId === focusSkill;
      const pulse =
        (isHovered ? 0.18 : isPinned ? 0.15 : 0.075) +
        Math.sin(frameCount * 0.045) * (isPinned ? 0.04 : 0.02);
      ctx.beginPath();
      for (let first = 0; first < focusedNeurons.length; first++) {
        for (let second = first + 1; second < focusedNeurons.length; second++) {
          ctx.moveTo(focusedNeurons[first].x, focusedNeurons[first].y);
          ctx.lineTo(focusedNeurons[second].x, focusedNeurons[second].y);
        }
      }
      ctx.strokeStyle = getRGBA(color, pulse);
      ctx.lineWidth = isHovered ? 1.15 : 0.9;
      ctx.stroke();
    }
  });

  ctx.restore();

  // The outline is intentionally drawn last so its antialiased edge seals the
  // clipped mesh and remains perfectly stable while internal neurons move.
  ctx.save();
  traceBrainOutline(ctx, boundaryNodes);
  const outlineGradient = ctx.createLinearGradient(
    bounds.centerX - bounds.halfWidth,
    0,
    bounds.centerX + bounds.halfWidth,
    0
  );
  outlineGradient.addColorStop(0, getRGBA(BRAIN_COLORS.center, 0.55));
  outlineGradient.addColorStop(0.45, getRGBA(BRAIN_COLORS.soft, 0.48));
  outlineGradient.addColorStop(0.55, getRGBA(BRAIN_COLORS.language, 0.34));
  outlineGradient.addColorStop(1, getRGBA(BRAIN_COLORS.center, 0.55));
  ctx.strokeStyle = outlineGradient;
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 14;
  ctx.shadowColor = getRGBA(BRAIN_COLORS.center, 0.14);
  ctx.stroke();
  ctx.restore();
};

type BrainCanvasPoint = [number, number];

const getBrainConceptNodes = (
  nodes: BrainRendererNode[],
  concept: BrainConceptViewModel
) =>
  concept.visual.skillIds
    .map((skillId) =>
      nodes.find(
        (node) =>
          node.brainSkill === skillId && node.brainSubIndex === 0
      )
    )
    .filter((node): node is BrainRendererNode => Boolean(node));

/**
 * Builds a padded convex envelope around the network's actual neurons. The
 * interaction hotspots remain stable, while the visible territory follows the
 * distributed network instead of pretending to be an anatomical partition.
 */
const getBrainTerritoryHull = (
  nodes: BrainRendererNode[],
  concept: BrainConceptViewModel,
  padding: number,
  phase = 0
) => {
  const areaNodes = getBrainConceptNodes(nodes, concept);
  const samples: BrainCanvasPoint[] = [];
  const samplesPerNeuron = 12;

  areaNodes.forEach((node, nodeIndex) => {
    for (let sampleIndex = 0; sampleIndex < samplesPerNeuron; sampleIndex++) {
      const angle = (sampleIndex / samplesPerNeuron) * Math.PI * 2;
      const organicScale =
        1 + Math.sin(angle * 3 + nodeIndex * 1.7 + phase) * 0.038;
      samples.push([
        node.x + Math.cos(angle) * padding * organicScale,
        node.y + Math.sin(angle) * padding * organicScale,
      ]);
    }
  });

  return polygonHull(samples);
};

const traceBrainTerritory = (
  ctx: CanvasRenderingContext2D,
  hull: BrainCanvasPoint[]
) => {
  const first = hull[0];
  const last = hull[hull.length - 1];

  ctx.beginPath();
  ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  hull.forEach((point, index) => {
    const next = hull[(index + 1) % hull.length];
    ctx.quadraticCurveTo(
      point[0],
      point[1],
      (point[0] + next[0]) / 2,
      (point[1] + next[1]) / 2
    );
  });
  ctx.closePath();
};

const drawBrainConceptMap = (
  ctx: CanvasRenderingContext2D,
  nodes: BrainRendererNode[],
  bounds: BrainBounds,
  concepts: BrainConceptViewModel[],
  activeConceptId: string | null,
  isPinned: boolean,
  frameCount: number
) => {
  const boundaryNodes = nodes.filter(
    (node) => node.brainRole === "boundary"
  );

  ctx.save();
  traceBrainOutline(ctx, boundaryNodes);
  ctx.clip();

  concepts.forEach((concept, conceptIndex) => {
    const isActive = concept.id === activeConceptId;
    const areaNodes = getBrainConceptNodes(nodes, concept);
    if (!isActive || areaNodes.length < 2) return;

    const breath = 0.5 + Math.sin(frameCount * 0.018 + conceptIndex) * 0.5;
    const basePadding = Math.max(
      18,
      Math.min(bounds.width, bounds.height) * (isActive ? 0.052 : 0.034)
    );
    const padding =
      basePadding * (isActive ? 1 + breath * (isPinned ? 0.065 : 0.035) : 1);
    const hull = getBrainTerritoryHull(
      nodes,
      concept,
      padding,
      isActive ? frameCount * 0.009 : conceptIndex * 0.8
    );
    if (!hull) return;

    const startColor = getBrainColor(
      areaNodes[0]?.brainSide ?? "center"
    );
    const middleColor = getBrainColor(
      areaNodes[Math.floor(areaNodes.length / 2)]?.brainSide ?? "center"
    );
    const endColor = getBrainColor(
      areaNodes[areaNodes.length - 1]?.brainSide ?? "center"
    );
    const minX = Math.min(...hull.map((point) => point[0]));
    const maxX = Math.max(...hull.map((point) => point[0]));
    const [centerX, centerY] = polygonCentroid(hull);
    const colorSpan = Math.max(1, maxX - minX);

    if (isActive) {
      const territoryFill = ctx.createLinearGradient(
        centerX - colorSpan / 2,
        centerY,
        centerX + colorSpan / 2,
        centerY
      );
      territoryFill.addColorStop(
        0,
        getRGBA(startColor, isPinned ? 0.095 : 0.052)
      );
      territoryFill.addColorStop(
        0.5,
        getRGBA(middleColor, isPinned ? 0.062 : 0.032)
      );
      territoryFill.addColorStop(
        1,
        getRGBA(endColor, isPinned ? 0.095 : 0.052)
      );
      ctx.fillStyle = territoryFill;
      traceBrainTerritory(ctx, hull);
      ctx.fill();
    }

    const areaGradient = ctx.createLinearGradient(
      minX,
      centerY,
      maxX,
      centerY
    );
    areaGradient.addColorStop(
      0,
      getRGBA(startColor, isPinned ? 0.4 : 0.24)
    );
    areaGradient.addColorStop(
      0.5,
      getRGBA(middleColor, isPinned ? 0.32 : 0.19)
    );
    areaGradient.addColorStop(
      1,
      getRGBA(endColor, isPinned ? 0.4 : 0.24)
    );

    ctx.save();
    traceBrainTerritory(ctx, hull);
    ctx.strokeStyle = areaGradient;
    ctx.lineWidth = isPinned ? 0.9 : 0.58;
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    if (isActive) {
      ctx.shadowBlur = isPinned ? 10 : 5;
      ctx.shadowColor = getRGBA(middleColor, isPinned ? 0.2 : 0.1);
    }
    ctx.stroke();
    ctx.restore();

    if (isActive) {
      const outerHull = getBrainTerritoryHull(
        nodes,
        concept,
        padding + Math.max(4, bounds.width * 0.008),
        frameCount * 0.009 + 0.45
      );
      if (outerHull) {
        traceBrainTerritory(ctx, outerHull);
        ctx.strokeStyle = areaGradient;
        ctx.globalAlpha = (isPinned ? 0.2 : 0.12) + breath * 0.04;
        ctx.lineWidth = 0.38;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  });

  ctx.setLineDash([]);
  ctx.restore();
};

const drawBrainRelationConnections = (
  ctx: CanvasRenderingContext2D,
  nodes: BrainRendererNode[],
  concepts: BrainConceptViewModel[],
  relatedGroups: SkillId[][],
  signals: BrainConnectionSignal[],
  isPinned: boolean,
  activeConceptId: string | null,
  animateSignals: boolean
) => {
  const activeConcept =
    concepts.find((concept) => concept.id === activeConceptId) ?? null;
  const connections: {
    start: BrainRendererNode;
    end: BrainRendererNode;
    key: string;
    curveDirection: number;
    strength: number;
  }[] = [];
  const connectionKeys = new Set<string>();

  relatedGroups.forEach((group) => {
    const relatedNeurons = group
      .map((skillId) =>
        nodes.find(
          (node) =>
            node.brainSkill === skillId && node.brainSubIndex === 0
        )
      )
      .filter((node): node is BrainRendererNode => Boolean(node));

    for (let first = 0; first < relatedNeurons.length; first++) {
      for (let second = first + 1; second < relatedNeurons.length; second++) {
        const start = relatedNeurons[first];
        const end = relatedNeurons[second];
        const key = [start.brainSkill, end.brainSkill].sort().join(":");
        if (connectionKeys.has(key)) continue;
        connectionKeys.add(key);
        connections.push({
          start,
          end,
          key,
          curveDirection: connections.length % 2 === 0 ? 1 : -1,
          strength: activeConcept
            ? Math.max(
              0.35,
              Math.min(
                getBrainConceptEnergy(
                  activeConcept,
                  start.brainSkill ?? ""
                ),
                getBrainConceptEnergy(activeConcept, end.brainSkill ?? "")
              )
            )
            : 0.65,
        });
      }
    }
  });

  if (!connections.length) {
    signals.splice(0);
    return;
  }

  connections.forEach(({ start, end, curveDirection, strength }) => {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const controlX =
      (start.x + end.x) / 2 + deltaY * 0.075 * curveDirection;
    const controlY =
      (start.y + end.y) / 2 - deltaX * 0.075 * curveDirection;
    const gradient = ctx.createLinearGradient(
      start.x,
      start.y,
      end.x,
      end.y
    );
    gradient.addColorStop(
      0,
      getRGBA(
        getBrainColor(start.brainSide),
        (isPinned ? 0.5 : 0.34) * strength
      )
    );
    gradient.addColorStop(
      0.5,
      `rgba(255, 255, 255, ${(isPinned ? 0.28 : 0.18) * strength})`
    );
    gradient.addColorStop(
      1,
      getRGBA(
        getBrainColor(end.brainSide),
        (isPinned ? 0.5 : 0.34) * strength
      )
    );

    const connectionLineWidth =
      (isPinned ? 1.2 : 0.82) * (0.62 + strength * 0.48);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(controlX, controlY, end.x, end.y);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = isPinned ? 0.38 : 0.28;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = connectionLineWidth * 3.1;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = gradient;
    ctx.lineWidth = connectionLineWidth;
    ctx.stroke();
  });

  if (!animateSignals) {
    signals.splice(0);
    return;
  }

  const isIntroRunning = activeConceptId === null && relatedGroups.length > 0;
  const maxSignals = isIntroRunning ? 8 : (isPinned ? 4 : 2);
  const spawnProbability = isIntroRunning ? 0.12 : (isPinned ? 0.022 : 0.008);

  if (
    signals.length < maxSignals &&
    Math.random() < spawnProbability
  ) {
    const connection =
      connections[Math.floor(Math.random() * connections.length)];
    signals.push({
      fromSkill: connection.start.brainSkill ?? "",
      toSkill: connection.end.brainSkill ?? "",
      progress: 0,
      speed: 0.018 + Math.random() * 0.015,
      curveDirection: connection.curveDirection,
    });
  }

  for (let index = signals.length - 1; index >= 0; index--) {
    const signal = signals[index];
    const key = [signal.fromSkill, signal.toSkill].sort().join(":");
    const connection = connections.find(
      (candidate) => candidate.key === key
    );
    if (!connection) {
      signals.splice(index, 1);
      continue;
    }

    signal.progress += signal.speed;
    if (signal.progress >= 1) {
      signals.splice(index, 1);
      continue;
    }

    const { start, end } = connection;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const controlX =
      (start.x + end.x) / 2 +
      deltaY * 0.075 * signal.curveDirection;
    const controlY =
      (start.y + end.y) / 2 -
      deltaX * 0.075 * signal.curveDirection;
    const progress = signal.progress;
    const inverse = 1 - progress;
    const x =
      inverse * inverse * start.x +
      2 * inverse * progress * controlX +
      progress * progress * end.x;
    const y =
      inverse * inverse * start.y +
      2 * inverse * progress * controlY +
      progress * progress * end.y;
    const color = getBrainColor(end.brainSide);

    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.beginPath();
    ctx.arc(x, y, isPinned ? 1.45 : 1.1, 0, Math.PI * 2);
    ctx.fill();

    const halo = ctx.createRadialGradient(x, y, 0, x, y, 6);
    halo.addColorStop(0, getRGBA(color, isPinned ? 0.32 : 0.18));
    halo.addColorStop(1, getRGBA(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawBrainParticles = (
  ctx: CanvasRenderingContext2D,
  nodes: BrainRendererNode[],
  bounds: BrainBounds,
  concepts: BrainConceptViewModel[],
  focusSide: BrainSide | null,
  focusSkill: SkillId | null,
  selectedSkills: Set<SkillId>,
  activeConceptId: string | null,
  isPinned: boolean,
  focusSubIndex: number | null,
  frameCount: number
) => {
  const activeConcept =
    concepts.find((concept) => concept.id === activeConceptId) ?? null;
  const conceptProtagonistIds = new Set(
    concepts.map((concept) => concept.visual.protagonistId)
  );
  const coreNeurons = nodes.filter(
    (node) =>
      node.brainRole === "neuron" &&
      node.brainSkill !== null &&
      node.brainSubIndex === 0 &&
      conceptProtagonistIds.has(node.brainSkill)
  );
  const coreClearance = Math.max(
    16,
    Math.min(bounds.width, bounds.height) * 0.024
  );
  const coreClearanceSquared = coreClearance * coreClearance;
  const coreFadeRadiusSquared = (coreClearance * 1.7) ** 2;
  const activeTerritory = activeConcept
    ? getBrainTerritoryHull(
      nodes,
      activeConcept,
      Math.max(18, Math.min(bounds.width, bounds.height) * 0.052)
    )
    : null;

  nodes.forEach((node) => {
    const color = getBrainColor(node.brainSide);
    const isEtherParticle =
      node.brainSide === "center" && node.brainSkill === null;
    let etherClearanceFactor = 1;

    if (isEtherParticle) {
      let nearestCoreDistanceSquared = Number.POSITIVE_INFINITY;
      for (const core of coreNeurons) {
        const distanceSquared =
          (node.x - core.x) ** 2 + (node.y - core.y) ** 2;
        nearestCoreDistanceSquared = Math.min(
          nearestCoreDistanceSquared,
          distanceSquared
        );
      }

      if (nearestCoreDistanceSquared < coreClearanceSquared) return;
      if (nearestCoreDistanceSquared < coreFadeRadiusSquared) {
        const distance = Math.sqrt(nearestCoreDistanceSquared);
        etherClearanceFactor =
          (distance - coreClearance) / (coreClearance * 0.7);
      }
    }

    const dimmedBySide = focusSide !== null && node.brainSide !== "center" && node.brainSide !== focusSide;
    const matchesSkill = focusSkill !== null && node.brainSkill === focusSkill;
    const isSelected =
      node.brainSkill !== null && selectedSkills.has(node.brainSkill);
    const conceptWeight =
      activeConcept && node.brainSkill
        ? getBrainConceptEnergy(activeConcept, node.brainSkill)
        : 0;
    const isHiddenSatellite =
      node.brainSkill !== null &&
      node.brainSubIndex > 0 &&
      !(isPinned && isSelected);
    if (isHiddenSatellite) return;
    const matchesSub =
      matchesSkill &&
      focusSubIndex !== null &&
      node.brainSubIndex === focusSubIndex;
    const dimmedBySkill =
      focusSkill !== null &&
      node.brainRole === "neuron" &&
      node.brainSkill !== null &&
      !matchesSkill &&
      !isSelected;
    const dimmedBySelection =
      selectedSkills.size > 0 &&
      node.brainRole === "neuron" &&
      node.brainSkill !== null &&
      !isSelected &&
      !matchesSkill;
    const isInsideActiveArea =
      activeTerritory !== null &&
      polygonContains(activeTerritory, [node.x, node.y]);

    let radius = node.baseRadius;
    let alpha = 0.38;

    switch (node.brainRole) {
      case "boundary":
        radius *= 0.72;
        alpha = 0.64;
        break;
      case "gyrus":
        radius *= 0.68;
        alpha = 0.52;
        break;
      case "sulcus":
        radius *= 0.52;
        alpha = 0.25;
        break;
      case "fissure":
        radius *= 0.42;
        alpha = 0.13;
        break;
      case "fill":
        radius *= 0.46;
        alpha = 0.12;
        break;
      case "neuron": {
        const organicPulse = 0.82 + Math.sin(frameCount * 0.022 + node.angleOffset) * 0.18;
        radius = Math.max(2.1, radius * 1.28) * organicPulse;
        alpha = 0.82;
        break;
      }
    }

    if (isEtherParticle) {
      alpha *= 0.24 + etherClearanceFactor * 0.76;
      if (activeConcept) {
        radius *= isInsideActiveArea ? 0.96 : 0.88;
        alpha *= isInsideActiveArea
          ? isPinned
            ? 0.7
            : 0.8
          : isPinned
            ? 0.48
            : 0.6;
      }
    }
    if (dimmedBySide) alpha *= 0.22;
    if (dimmedBySkill) alpha *= 0.34;
    if (dimmedBySelection) alpha *= isPinned ? 0.72 : 0.58;
    if (isSelected) {
      radius *=
        (isPinned ? 1.16 : 1.12) + conceptWeight * (isPinned ? 0.24 : 0.28);
      alpha = Math.max(
        alpha,
        (isPinned ? 0.74 : 0.7) + conceptWeight * 0.25
      );
      node.pulse = Math.max(
        node.pulse,
        (isPinned ? 0.08 : 0.1) + conceptWeight * 0.1
      );
    }
    if (matchesSkill) {
      radius *= 1.45;
      alpha = 1;
      node.pulse = Math.max(node.pulse, 0.4);
    }
    if (matchesSub) {
      radius *= 1.38;
      node.pulse = 1;
    }

    if (node.pulse > 0) {
      radius *= 1 + node.pulse * 0.72;
      alpha = Math.min(1, alpha + node.pulse * 0.28);
      const halo = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        radius * 6.5
      );
      halo.addColorStop(0, getRGBA(color, 0.19 * node.pulse));
      halo.addColorStop(1, getRGBA(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 6.5, 0, Math.PI * 2);
      ctx.fill();
      node.pulse = Math.max(0, node.pulse - 0.012);
    }

    ctx.fillStyle = getRGBA(color, alpha * 0.72);
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (node.brainRole !== "fill" && node.brainRole !== "fissure") {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.72, alpha * 0.62)})`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, Math.max(0.35, radius * 0.34), 0, Math.PI * 2);
      ctx.fill();
    }
  });
};

const traceOrganicHalo = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  phase: number
) => {
  const segments = 42;
  ctx.beginPath();

  for (let segment = 0; segment <= segments; segment++) {
    const angle = (segment / segments) * Math.PI * 2;
    const wobble =
      1 +
      Math.sin(angle * 3 + phase) * 0.035 +
      Math.sin(angle * 7 - phase * 1.35) * 0.018;
    const pointX = x + Math.cos(angle) * radius * wobble;
    const pointY = y + Math.sin(angle) * radius * wobble;

    if (segment === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }

  ctx.closePath();
};

const drawBrainBeacons = (
  ctx: CanvasRenderingContext2D,
  nodes: BrainRendererNode[],
  concepts: BrainConceptViewModel[],
  candidateConceptId: string | null,
  conceptProximity: number,
  activeConceptId: string | null,
  isPinned: boolean,
  introCoreSkillIds: Set<SkillId>,
  introIntensity: number,
  frameCount: number
) => {
  const candidateConcept =
    concepts.find((concept) => concept.id === candidateConceptId) ?? null;
  const activeConcept =
    concepts.find((concept) => concept.id === activeConceptId) ?? null;
  const conceptProtagonistIds = new Set(
    concepts.map((concept) => concept.visual.protagonistId)
  );
  const primaryNeurons = nodes.filter(
    (node) =>
      node.brainRole === "neuron" &&
      node.brainSkill !== null &&
      node.brainSubIndex === 0
  );

  primaryNeurons.forEach((node, index) => {
    const skillId = node.brainSkill ?? "";
    const isConceptParent = conceptProtagonistIds.has(skillId);
    const candidateWeight = candidateConcept
      ? getBrainConceptEnergy(candidateConcept, skillId)
      : 0;
    const activeWeight = activeConcept
      ? getBrainConceptEnergy(activeConcept, skillId)
      : 0;
    const isIntroCore = introCoreSkillIds.has(skillId);
    const isIntroTourRunning = introCoreSkillIds.size > 0;
    const isIntroRendering = introIntensity < 1 || isIntroTourRunning;
    const color =
      isIntroRendering && !isIntroCore
        ? BRAIN_COLORS.introMuted
        : getBrainColor(node.brainSide);
    const proximityResponse = isIntroTourRunning
      ? isIntroCore
        ? conceptProximity
        : 0
      : conceptProximity * candidateWeight;
    const activeResponse = isIntroTourRunning
      ? 0
      : isPinned
        ? activeWeight
        : activeWeight * (0.45 + conceptProximity * 0.55);
    const activationStrength = Math.max(activeResponse, proximityResponse);
    const isProtagonist =
      activeConcept?.visual.protagonistId === skillId ||
      candidateConcept?.visual.protagonistId === skillId ||
      isIntroCore;
    const isPeripheral = activeConcept !== null && activeWeight === 0;
    const breathing = 0.5 + Math.sin(frameCount * 0.026 + index * 0.82) * 0.5;
    const easedActivation =
      activationStrength * activationStrength * (3 - 2 * activationStrength);
    const baseRadius =
      (isConceptParent ? 11.45 : 9.3) +
      breathing * (isConceptParent ? 0.3 : 0.68) +
      easedActivation * (isProtagonist ? 5.2 : 3.8) +
      (isPinned && activeWeight > 0 ? activeWeight * 0.75 : 0);
    const restingAlpha = isPeripheral
      ? (isConceptParent ? 0.13 : 0.07) + breathing * 0.018
      : (isConceptParent ? 0.36 : 0.16) +
      breathing * (isConceptParent ? 0.025 : 0.03);
    const baseAlpha = Math.max(
      restingAlpha,
      (isConceptParent ? 0.37 : 0.18) +
      easedActivation * (isProtagonist ? 0.58 : 0.45)
    );

    const haloScale =
      (isConceptParent ? 2.18 : 1.86) +
      easedActivation * (isProtagonist ? 1.05 : 0.72) +
      (isPinned && activeWeight > 0 ? 0.12 : 0);
    const halo = ctx.createRadialGradient(
      node.x,
      node.y,
      1,
      node.x,
      node.y,
      baseRadius * haloScale
    );
    halo.addColorStop(
      0,
      getRGBA(
        color,
        (isConceptParent ? 0.052 : 0.014) + easedActivation * 0.15
      )
    );
    halo.addColorStop(
      0.48,
      getRGBA(
        color,
        (isConceptParent ? 0.075 : 0.024) + easedActivation * 0.15
      )
    );
    halo.addColorStop(
      0.7,
      getRGBA(
        color,
        (isConceptParent ? 0.13 : 0.055) + easedActivation * 0.22
      )
    );
    halo.addColorStop(1, getRGBA(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(
      node.x,
      node.y,
      baseRadius * haloScale,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (isConceptParent) {
      const coreLight = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        baseRadius * 1.45
      );
      coreLight.addColorStop(
        0,
        `rgba(255, 255, 255, ${0.12 + easedActivation * 0.16})`
      );
      coreLight.addColorStop(
        0.34,
        getRGBA(color, 0.075 + easedActivation * 0.13)
      );
      coreLight.addColorStop(1, getRGBA(color, 0));
      ctx.fillStyle = coreLight;
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();
    }

    traceOrganicHalo(
      ctx,
      node.x,
      node.y,
      baseRadius,
      frameCount * 0.006 + index * 0.73
    );
    ctx.strokeStyle = getRGBA(color, baseAlpha);
    ctx.lineWidth = Math.max(
      isConceptParent ? 1.08 : 0.78,
      (isConceptParent ? 1.08 : 0.78) +
      easedActivation * (isProtagonist ? 0.68 : 0.42)
    );
    ctx.stroke();

    ctx.strokeStyle = getRGBA(color, baseAlpha * 0.62);
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.arc(
      node.x,
      node.y,
      baseRadius + (isProtagonist ? 4.6 : isConceptParent ? 3.8 : 3),
      Math.PI * 0.82 - frameCount * 0.002,
      Math.PI * 1.62 - frameCount * 0.002
    );
    ctx.stroke();

    if (node.brainSide === "language") {
      const membraneAlpha = 0.08 + easedActivation * 0.28;
      ctx.lineWidth = 0.72 + easedActivation * 0.28;
      ctx.strokeStyle = getRGBA(BRAIN_COLORS.hard, membraneAlpha);
      ctx.beginPath();
      ctx.arc(
        node.x,
        node.y,
        baseRadius + 2.2,
        -Math.PI * 0.08,
        Math.PI * 0.92
      );
      ctx.stroke();
      ctx.strokeStyle = getRGBA(BRAIN_COLORS.soft, membraneAlpha);
      ctx.beginPath();
      ctx.arc(
        node.x,
        node.y,
        baseRadius + 2.2,
        Math.PI * 0.92,
        Math.PI * 1.92
      );
      ctx.stroke();
    }

    if (activeWeight > 0) {
      const orbitAngle = frameCount * 0.018;
      const orbitRadius = baseRadius + 4.5;
      ctx.fillStyle = getRGBA(color, 0.48 + activeWeight * 0.48);
      ctx.beginPath();
      ctx.arc(
        node.x + Math.cos(orbitAngle) * orbitRadius,
        node.y + Math.sin(orbitAngle) * orbitRadius,
        0.8 + activeWeight * 0.72,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  });
};

const drawBrainZoom = (
  ctx: CanvasRenderingContext2D,
  nodes: BrainRendererNode[],
  concepts: BrainConceptViewModel[],
  anchor: HTMLElement | null,
  rawFocusProgress: number,
  activeConceptId: string | null,
  frameCount: number
) => {
  if (!anchor || !activeConceptId) return;

  const concept = concepts.find(
    (candidate) => candidate.id === activeConceptId
  );
  if (!concept) return;

  const rect = anchor.getBoundingClientRect();
  if (rect.width < 40 || rect.height < 40) return;
  const focusProgress = Math.max(
    0,
    Math.min(1, rawFocusProgress)
  );
  if (focusProgress <= 0) return;

  const easedProgress = 1 - Math.pow(1 - focusProgress, 3);
  const layoutNodes = getBrainConceptFocusNodes(concept);
  const zoomNeurons = layoutNodes
    .map((layout) => {
      const primary = nodes.find(
        (node) =>
          node.brainSkill === layout.skillId && node.brainSubIndex === 0
      );
      if (!primary) return null;

      return {
        ...layout,
        primary,
        point: {
          x: rect.left + rect.width * (layout.x / 100),
          y: rect.top + rect.height * (layout.y / 100),
        },
      };
    })
    .filter(
      (
        item
      ): item is (typeof layoutNodes)[number] & {
        primary: BrainRendererNode;
        point: { x: number; y: number };
      } => Boolean(item)
    );
  const protagonist = zoomNeurons.find((node) => node.protagonist);
  if (!protagonist) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.left, rect.top, rect.width, rect.height);
  ctx.clip();

  const minDimension = Math.min(rect.width, rect.height);
  const fieldRadius = minDimension * 0.42 * easedProgress;
  const field = ctx.createRadialGradient(
    protagonist.point.x,
    protagonist.point.y,
    0,
    protagonist.point.x,
    protagonist.point.y,
    fieldRadius
  );
  field.addColorStop(0, getRGBA(BRAIN_COLORS.center, 0.045 * easedProgress));
  field.addColorStop(0.54, getRGBA(BRAIN_COLORS.center, 0.018 * easedProgress));
  field.addColorStop(1, getRGBA(BRAIN_COLORS.center, 0));
  ctx.fillStyle = field;
  ctx.beginPath();
  ctx.arc(protagonist.point.x, protagonist.point.y, fieldRadius, 0, Math.PI * 2);
  ctx.fill();

  // A deterministic microscopic field gives the close-up the same energetic
  // language as the brain without borrowing particles from the main scene.
  // Depth changes scale and luminance, while slow parallax makes the field feel
  // volumetric instead of like a flat constellation.
  const etherRandom = seededRandom(9281 + concept.index * 7919);
  const etherPalette = zoomNeurons.map((node) =>
    getBrainColor(node.primary.brainSide)
  );
  const etherColumns = 8;
  const etherRows = 7;
  const etherNodeCount = etherColumns * etherRows;
  const etherNodes = Array.from({ length: etherNodeCount }, (_, index) => {
    const column = index % etherColumns;
    const row = Math.floor(index / etherColumns);
    const depth = 0.24 + etherRandom() * 0.76;
    const stagger = row % 2 === 0 ? 0 : 0.42;
    const normalizedX =
      (column + stagger + 0.38 + (etherRandom() - 0.5) * 0.36) /
      (etherColumns + 0.25);
    const normalizedY =
      (row + 0.46 + (etherRandom() - 0.5) * 0.42) / etherRows;
    const tissueWarpX =
      Math.sin(normalizedY * Math.PI * 2.2 + concept.index * 0.37) *
      rect.width *
      0.018;
    const tissueWarpY =
      Math.sin(normalizedX * Math.PI * 2.7 + row * 0.31) *
      rect.height *
      0.022;
    const driftX =
      Math.sin(frameCount * (0.0032 + depth * 0.0018) + index * 1.71) *
      minDimension *
      0.0048 *
      depth;
    const driftY =
      Math.cos(frameCount * (0.0027 + depth * 0.0015) + index * 1.19) *
      minDimension *
      0.0042 *
      depth;
    let x =
      rect.left +
      rect.width * (0.065 + normalizedX * 0.87) +
      tissueWarpX +
      driftX;
    let y =
      rect.top +
      rect.height * (0.07 + normalizedY * 0.85) +
      tissueWarpY +
      driftY;

    // The ether bends around every semantic neuron. This keeps the violet
    // matter visibly present while preventing the ugly particle/node overlap.
    zoomNeurons.forEach((focusNode, focusIndex) => {
      const deltaX = x - focusNode.point.x;
      const deltaY = y - focusNode.point.y;
      const distance = Math.hypot(deltaX, deltaY);
      const clearance =
        minDimension * (focusNode.protagonist ? 0.077 : 0.052);
      if (distance >= clearance) return;

      const fallbackAngle = index * 1.43 + focusIndex * 0.93;
      const directionX = distance > 0.001 ? deltaX / distance : Math.cos(fallbackAngle);
      const directionY = distance > 0.001 ? deltaY / distance : Math.sin(fallbackAngle);
      x += directionX * (clearance - distance);
      y += directionY * (clearance - distance);
    });

    const horizontalInset = rect.width * 0.055;
    const verticalInset = rect.height * 0.065;

    return {
      x: Math.max(rect.left + horizontalInset, Math.min(rect.right - horizontalInset, x)),
      y: Math.max(rect.top + verticalInset, Math.min(rect.bottom - verticalInset, y)),
      depth,
      phase: etherRandom() * Math.PI * 2,
      radius: 0.36 + depth * 0.9,
      color:
        etherPalette[index % Math.max(1, etherPalette.length)] ??
        BRAIN_COLORS.center,
    };
  }).sort((first, second) => first.depth - second.depth);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Irregular filaments replace orbital rings: this is a slice of active
  // tissue, not a miniature solar system around the Core.
  for (let layer = 0; layer < 5; layer++) {
    const layerDepth = (layer + 1) / 5;
    const direction = layer % 2 === 0 ? 1 : -1;
    const startY =
      rect.top + rect.height * (0.15 + layer * 0.165) +
      Math.sin(concept.index + layer) * rect.height * 0.018;
    ctx.beginPath();
    ctx.moveTo(rect.left + rect.width * 0.055, startY);
    for (let step = 1; step <= 6; step++) {
      const stepX = rect.left + rect.width * (0.055 + step * 0.15);
      const controlX = stepX - rect.width * 0.075;
      const controlY =
        startY +
        Math.sin(step * 1.7 + layer * 0.83 + frameCount * 0.0018) *
        rect.height *
        0.035 *
        direction;
      const stepY =
        startY +
        Math.sin(step * 1.12 + layer * 0.67) * rect.height * 0.018;
      ctx.quadraticCurveTo(controlX, controlY, stepX, stepY);
    }
    ctx.setLineDash([1.2, 7 + layer * 0.8]);
    ctx.strokeStyle = getRGBA(
      layer % 2 === 0 ? BRAIN_COLORS.soft : BRAIN_COLORS.center,
      (0.018 + layerDepth * 0.026) * easedProgress
    );
    ctx.lineWidth = 0.34 + layerDepth * 0.16;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const meshThreshold = minDimension * 0.178;
  for (let sourceIndex = 0; sourceIndex < etherNodes.length; sourceIndex++) {
    const source = etherNodes[sourceIndex];

    for (
      let targetIndex = sourceIndex + 1;
      targetIndex < etherNodes.length;
      targetIndex++
    ) {
      const target = etherNodes[targetIndex];
      const distance = Math.hypot(target.x - source.x, target.y - source.y);
      const edgeSignature =
        sourceIndex * 17 + targetIndex * 11 + concept.index * 7;
      if (
        distance > meshThreshold ||
        Math.abs(source.depth - target.depth) > 0.58 ||
        edgeSignature % 5 === 0
      ) {
        continue;
      }

      const closeness = 1 - distance / meshThreshold;
      const depth = (source.depth + target.depth) * 0.5;
      const middleX = (source.x + target.x) * 0.5;
      const middleY = (source.y + target.y) * 0.5;
      const normalX = distance > 0.001 ? -(target.y - source.y) / distance : 0;
      const normalY = distance > 0.001 ? (target.x - source.x) / distance : 0;
      const curve =
        Math.sin(edgeSignature * 0.73 + frameCount * 0.0016) *
        minDimension *
        0.012;
      const controlX = middleX + normalX * curve;
      const controlY = middleY + normalY * curve;
      ctx.strokeStyle = getRGBA(
        source.color,
        (0.022 + closeness * 0.09) * depth * easedProgress
      );
      ctx.lineWidth = 0.22 + depth * 0.38;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.quadraticCurveTo(controlX, controlY, target.x, target.y);
      ctx.stroke();

      if (edgeSignature % 13 === 0 && focusProgress > 0.48) {
        const signalProgress =
          (frameCount * (0.0024 + depth * 0.0017) + edgeSignature * 0.019) %
          1;
        const inverse = 1 - signalProgress;
        const signalX =
          inverse * inverse * source.x +
          2 * inverse * signalProgress * controlX +
          signalProgress * signalProgress * target.x;
        const signalY =
          inverse * inverse * source.y +
          2 * inverse * signalProgress * controlY +
          signalProgress * signalProgress * target.y;
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.18 + depth * 0.42) * easedProgress
          })`;
        ctx.beginPath();
        ctx.arc(signalX, signalY, 0.38 + depth * 0.46, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (sourceIndex % 3 === 0) {
      let nearestFocus = zoomNeurons[0];
      let nearestDistance = Number.POSITIVE_INFINITY;
      zoomNeurons.forEach((focusNode) => {
        const distance = Math.hypot(
          focusNode.point.x - source.x,
          focusNode.point.y - source.y
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestFocus = focusNode;
        }
      });

      if (nearestFocus && nearestDistance < minDimension * 0.24) {
        ctx.strokeStyle = getRGBA(
          source.color,
          (0.028 + source.depth * 0.052) * easedProgress
        );
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(nearestFocus.point.x, nearestFocus.point.y);
        ctx.stroke();
      }
    }
  }

  etherNodes.forEach((etherNode) => {
    const particlePulse =
      0.86 + Math.sin(frameCount * 0.012 + etherNode.phase) * 0.14;
    ctx.fillStyle = getRGBA(
      etherNode.color,
      (0.2 + etherNode.depth * 0.42) * easedProgress * particlePulse
    );
    ctx.beginPath();
    ctx.arc(
      etherNode.x,
      etherNode.y,
      etherNode.radius * easedProgress * particlePulse,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (etherNode.depth > 0.68) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.22 * etherNode.depth * easedProgress
        })`;
      ctx.beginPath();
      ctx.arc(etherNode.x, etherNode.y, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();

  // Supporting concepts also exchange energy with one another, so the close-up
  // reads as a connected piece of the brain rather than a hub-and-spoke icon.
  const supporters = zoomNeurons.filter((node) => !node.protagonist);
  if (supporters.length > 2) {
    supporters.forEach((supporter, supporterIndex) => {
      const target = supporters[(supporterIndex + 1) % supporters.length];
      const sourceColor = getBrainColor(supporter.primary.brainSide);
      const targetColor = getBrainColor(target.primary.brainSide);
      const supportGradient = ctx.createLinearGradient(
        supporter.point.x,
        supporter.point.y,
        target.point.x,
        target.point.y
      );
      supportGradient.addColorStop(0, getRGBA(sourceColor, 0.13 * easedProgress));
      supportGradient.addColorStop(0.5, getRGBA(BRAIN_COLORS.center, 0.07 * easedProgress));
      supportGradient.addColorStop(1, getRGBA(targetColor, 0.13 * easedProgress));
      ctx.strokeStyle = supportGradient;
      ctx.lineWidth = 0.42;
      ctx.beginPath();
      ctx.moveTo(supporter.point.x, supporter.point.y);
      ctx.quadraticCurveTo(
        protagonist.point.x +
        (supporter.point.y - target.point.y) * 0.035,
        protagonist.point.y +
        (target.point.x - supporter.point.x) * 0.035,
        target.point.x,
        target.point.y
      );
      ctx.stroke();
    });
  }

  concept.visual.satellites.forEach((satellite, relationIndex) => {
    const supporter = zoomNeurons.find(
      (node) => node.skillId === satellite.skillId
    );
    if (!supporter) return;
    const energy = satellite.energy;

    const start = protagonist.point;
    const target = supporter.point;
    const end = {
      x: start.x + (target.x - start.x) * easedProgress,
      y: start.y + (target.y - start.y) * easedProgress,
    };
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const curveDirection = relationIndex % 2 === 0 ? 1 : -1;
    const control = {
      x: (start.x + end.x) / 2 + deltaY * 0.055 * curveDirection,
      y: (start.y + end.y) / 2 - deltaX * 0.055 * curveDirection,
    };
    const protagonistColor = getBrainColor(protagonist.primary.brainSide);
    const supporterColor = getBrainColor(supporter.primary.brainSide);
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient.addColorStop(
      0,
      getRGBA(protagonistColor, (0.34 + energy * 0.34) * easedProgress)
    );
    gradient.addColorStop(
      0.55,
      `rgba(255, 255, 255, ${(0.08 + energy * 0.13) * easedProgress})`
    );
    gradient.addColorStop(
      1,
      getRGBA(supporterColor, (0.25 + energy * 0.36) * easedProgress)
    );

    const traceRelation = () => {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
    };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.2 + energy * 0.11;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3.2 + energy * 2.1;
    traceRelation();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.68 + energy * 0.92;
    traceRelation();
    ctx.stroke();

    if (focusProgress > 0.58) {
      const signalProgress =
        (frameCount * (0.0038 + energy * 0.0024) +
          relationIndex * 0.24) %
        1;
      const inverse = 1 - signalProgress;
      const signalX =
        inverse * inverse * start.x +
        2 * inverse * signalProgress * control.x +
        signalProgress * signalProgress * end.x;
      const signalY =
        inverse * inverse * start.y +
        2 * inverse * signalProgress * control.y +
        signalProgress * signalProgress * end.y;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.46 + energy * 0.45})`;
      ctx.beginPath();
      ctx.arc(signalX, signalY, 0.85 + energy * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  zoomNeurons.forEach((focusNode, skillIndex) => {
    const { primary, point, energy, protagonist: isProtagonist } = focusNode;
    const color = getBrainColor(primary.brainSide);
    const nodeDelay = skillIndex * 0.055;
    const nodeReveal = Math.max(
      0,
      Math.min(1, (focusProgress - nodeDelay) / 0.72)
    );
    if (nodeReveal <= 0) return;

    if (focusProgress > 0.42) {
      const dendriteRandom = seededRandom(
        4187 + concept.index * 1543 + skillIndex * 619
      );
      const dendriteCount = isProtagonist ? 9 : 5;
      const clusterPoints = Array.from({ length: dendriteCount }, (_, index) => {
        const angle =
          (index / dendriteCount) * Math.PI * 2 +
          skillIndex * 0.29 +
          (dendriteRandom() - 0.5) * 0.42;
        const orbitRadius =
          minDimension *
          (isProtagonist ? 0.052 : 0.038 + energy * 0.014) *
          (0.82 + dendriteRandom() * 0.34);

        return {
          x: point.x + Math.cos(angle) * orbitRadius,
          y: point.y + Math.sin(angle) * orbitRadius,
          phase: dendriteRandom() * Math.PI * 2,
        };
      });

      if (clusterPoints.length > 2) {
        ctx.strokeStyle = getRGBA(
          color,
          (0.052 + energy * 0.07) * nodeReveal
        );
        ctx.lineWidth = 0.34;
        ctx.beginPath();
        clusterPoints.forEach((clusterPoint, pointIndex) => {
          if (pointIndex === 0) ctx.moveTo(clusterPoint.x, clusterPoint.y);
          else ctx.lineTo(clusterPoint.x, clusterPoint.y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      clusterPoints.forEach(({ x, y, phase }) => {
        ctx.strokeStyle = getRGBA(color, (0.08 + energy * 0.16) * nodeReveal);
        ctx.lineWidth = 0.42 + energy * 0.24;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        const subPulse =
          0.86 + Math.sin(frameCount * 0.024 + phase) * 0.14;
        ctx.fillStyle = getRGBA(color, (0.46 + energy * 0.38) * nodeReveal);
        ctx.beginPath();
        ctx.arc(x, y, (1.25 + energy * 0.85) * subPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * nodeReveal})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.55, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const radius =
      (isProtagonist ? 10.5 : 3.7 + energy * 2.2) *
      (0.72 + nodeReveal * 0.28);
    const halo = ctx.createRadialGradient(
      point.x,
      point.y,
      0,
      point.x,
      point.y,
      radius * (isProtagonist ? 7.2 : 5.4)
    );
    halo.addColorStop(
      0,
      getRGBA(color, (isProtagonist ? 0.34 : 0.12 + energy * 0.14) * nodeReveal)
    );
    halo.addColorStop(1, getRGBA(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      radius * (isProtagonist ? 7.2 : 5.4),
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (isProtagonist) {
      traceOrganicHalo(
        ctx,
        point.x,
        point.y,
        radius * 1.55,
        frameCount * 0.007
      );
      ctx.strokeStyle = getRGBA(color, 0.42 + nodeReveal * 0.4);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    ctx.fillStyle = getRGBA(
      color,
      (isProtagonist ? 0.98 : 0.56 + energy * 0.4) * nodeReveal
    );
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();

    if (primary.brainSide === "language") {
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = getRGBA(BRAIN_COLORS.hard, 0.32 * nodeReveal);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 2.8, -0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.strokeStyle = getRGBA(BRAIN_COLORS.soft, 0.32 * nodeReveal);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 2.8, Math.PI - 0.2, Math.PI * 2 - 0.2);
      ctx.stroke();
    }
  });

  ctx.restore();
};

const drawBrainFirings = (
  ctx: CanvasRenderingContext2D,
  firings: BrainFiring[]
) => {
  for (let index = firings.length - 1; index >= 0; index--) {
    const firing = firings[index];
    firing.radius += 1.85;
    firing.life -= 0.022;

    if (firing.life <= 0) {
      firings.splice(index, 1);
      continue;
    }

    const color = getBrainColor(firing.side);
    ctx.strokeStyle = getRGBA(color, firing.life * 0.42);
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.arc(firing.x, firing.y, firing.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
};

export {
  createBrainBlueprint,
  drawBrainBeacons,
  drawBrainConceptMap,
  drawBrainFirings,
  drawBrainParticles,
  drawBrainRelationConnections,
  drawBrainStructure,
  drawBrainZoom,
  getBrainBounds,
  isPointInBrain,
  setBrainTargets,
  traceBrainOutline,
};
