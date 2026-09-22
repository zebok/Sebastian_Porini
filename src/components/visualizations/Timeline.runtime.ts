import { curveLinear, extent, line, scalePoint, scaleUtc } from "d3";
import type {
  CareerBranchId,
  CareerCommitKind,
  CareerCommitStatus,
  CareerParentKind,
  CareerRefKind,
  CareerTime,
  LocalizedCareerRepository,
} from "@/types/content";

export interface TimelinePoint {
  x: number;
  y: number;
}

export interface TimelineLayoutOptions {
  width: number;
  topPadding?: number;
  bottomPadding?: number;
  laneInset?: number;
  minimumNodeGap?: number;
  pixelsPerYear?: number;
  edgeSamples?: number;
  nodeRadius?: number;
}

export interface TimelineLaneGeometry {
  id: CareerBranchId;
  label: string;
  description: string;
  color: string;
  index: number;
  x: number;
  nodeIds: string[];
  path: string;
  points: TimelinePoint[];
}

export interface TimelineNodeGeometry {
  id: string;
  sha: string | null;
  source: "commit" | "staging";
  branchId: CareerBranchId;
  status: CareerCommitStatus;
  kind: CareerCommitKind;
  time: CareerTime;
  x: number;
  y: number;
  radius: number;
  isMerge: boolean;
  parentIds: string[];
  refIds: string[];
}

export interface TimelineEdgeGeometry {
  id: string;
  parentId: string;
  childId: string;
  branchId: CareerBranchId;
  status: CareerCommitStatus;
  kind: CareerParentKind;
  path: string;
  points: TimelinePoint[];
}

export interface TimelineRefGeometry {
  id: string;
  kind: CareerRefKind;
  name: string;
  targetId: string;
  x: number;
  y: number;
}

export interface TimelineLayout {
  width: number;
  height: number;
  lanes: TimelineLaneGeometry[];
  nodes: TimelineNodeGeometry[];
  edges: TimelineEdgeGeometry[];
  refs: TimelineRefGeometry[];
  bounds: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface TimelineViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TimelineRuntimeState {
  enabled: boolean;
  layout: TimelineLayout | null;
  viewport: TimelineViewportRect;
  scrollTop: number;
  revealProgress: number;
  activeBranchId: CareerBranchId | null;
  activeCommitId: string | null;
  reducedMotion: boolean;
}

export interface TimelineRuntime {
  stateRef: { current: TimelineRuntimeState };
  requestRenderRef: { current: () => void };
}

type RepositoryNode =
  | LocalizedCareerRepository["commits"][number]
  | LocalizedCareerRepository["staging"][number];

interface AuthoredNode {
  node: RepositoryNode;
  source: TimelineNodeGeometry["source"];
  authoredIndex: number;
}

const DEFAULT_LAYOUT = {
  topPadding: 176,
  bottomPadding: 176,
  laneInset: 48,
  minimumNodeGap: 116,
  pixelsPerYear: 132,
  edgeSamples: 24,
  nodeRadius: 8,
} as const;

const EMPTY_VIEWPORT: TimelineViewportRect = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
};

const pathGenerator = line<TimelinePoint>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveLinear);

const getTimeDate = (time: CareerTime): Date => {
  const [yearText, monthText] = time.value.split("-");
  const year = Number(yearText);
  const month = monthText ? Number(monthText) - 1 : 0;
  return new Date(Date.UTC(year, month, 1));
};

const sampleEdge = (
  parent: TimelinePoint,
  child: TimelinePoint,
  sampleCount: number
): TimelinePoint[] =>
  Array.from({ length: sampleCount + 1 }, (_, index) => {
    const progress = index / sampleCount;
    const eased = progress * progress * (3 - 2 * progress);
    return {
      x: parent.x + (child.x - parent.x) * eased,
      y: parent.y + (child.y - parent.y) * progress,
    };
  });

const toPath = (points: TimelinePoint[]): string => pathGenerator(points) ?? "";

/**
 * Produces immutable, content-coordinate geometry. D3 owns scales and path
 * calculation only; React/SVG and the fixed canvas renderer can consume the
 * same arrays without either renderer granting D3 DOM ownership.
 */
export const createTimelineLayout = (
  repository: LocalizedCareerRepository,
  options: TimelineLayoutOptions
): TimelineLayout => {
  const width = Math.max(320, options.width);
  const topPadding = options.topPadding ?? DEFAULT_LAYOUT.topPadding;
  const bottomPadding = options.bottomPadding ?? DEFAULT_LAYOUT.bottomPadding;
  const laneInset = Math.min(
    options.laneInset ?? DEFAULT_LAYOUT.laneInset,
    width * 0.2
  );
  const minimumNodeGap = Math.max(
    48,
    options.minimumNodeGap ?? DEFAULT_LAYOUT.minimumNodeGap
  );
  const pixelsPerYear = Math.max(
    1,
    options.pixelsPerYear ?? DEFAULT_LAYOUT.pixelsPerYear
  );
  const edgeSamples = Math.max(
    4,
    Math.round(options.edgeSamples ?? DEFAULT_LAYOUT.edgeSamples)
  );
  const nodeRadius = Math.max(2, options.nodeRadius ?? DEFAULT_LAYOUT.nodeRadius);

  const laneScale = scalePoint<CareerBranchId>()
    .domain(repository.branches.map((branch) => branch.id))
    .range([laneInset, width - laneInset])
    .padding(0.45);

  const authoredNodes: AuthoredNode[] = [
    ...repository.commits.map((node, authoredIndex) => ({
      node,
      source: "commit" as const,
      authoredIndex,
    })),
    ...repository.staging.map((node, stagingIndex) => ({
      node,
      source: "staging" as const,
      authoredIndex: repository.commits.length + stagingIndex,
    })),
  ];

  const dates = authoredNodes.map(({ node }) => getTimeDate(node.time));
  const [minimumDate, maximumDate] = extent(dates);
  const fallbackDate = new Date(Date.UTC(2000, 0, 1));
  const domainStart = minimumDate ?? fallbackDate;
  const domainEnd = maximumDate ?? domainStart;
  const yearSpan = Math.max(
    1,
    (domainEnd.getTime() - domainStart.getTime()) /
      (365.2425 * 24 * 60 * 60 * 1000)
  );
  const timeSpan = Math.max(
    minimumNodeGap * Math.max(0, authoredNodes.length - 1),
    yearSpan * pixelsPerYear
  );
  const timeScale = scaleUtc()
    .domain([domainEnd, domainStart])
    .range([topPadding, topPadding + timeSpan]);

  const yByNodeId = new Map<string, number>();
  let previousY = topPadding - minimumNodeGap;
  [...authoredNodes]
    .sort((left, right) => right.authoredIndex - left.authoredIndex)
    .forEach(({ node }) => {
      const timeY = timeScale(getTimeDate(node.time));
      const y = Math.max(timeY, previousY + minimumNodeGap);
      yByNodeId.set(node.id, y);
      previousY = y;
    });

  const refIdsByNode = new Map<string, string[]>();
  repository.refs.forEach((ref) => {
    const ids = refIdsByNode.get(ref.targetId) ?? [];
    ids.push(ref.id);
    refIdsByNode.set(ref.targetId, ids);
  });

  const toNodeGeometry = ({ node, source }: AuthoredNode): TimelineNodeGeometry => ({
    id: node.id,
    sha: "sha" in node ? node.sha : null,
    source,
    branchId: node.branchId,
    status: node.status,
    kind: node.kind,
    time: { ...node.time },
    x: laneScale(node.branchId) ?? width / 2,
    y: yByNodeId.get(node.id) ?? topPadding,
    radius: nodeRadius,
    isMerge: node.parents.length > 1,
    parentIds: node.parents.map((parent) => parent.id),
    refIds: [...(refIdsByNode.get(node.id) ?? [])],
  });

  const authoredGeometry = authoredNodes.map(toNodeGeometry);
  const geometryById = new Map(authoredGeometry.map((node) => [node.id, node]));

  // Historical output is intentionally present-to-past; staging follows as a
  // distinct WIP/forecast sequence even though its coordinates sit above HEAD.
  const commitNodes = authoredGeometry
    .slice(0, repository.commits.length)
    .reverse();
  const stagingNodes = authoredGeometry.slice(repository.commits.length);
  const nodes = [...commitNodes, ...stagingNodes];

  const edges: TimelineEdgeGeometry[] = authoredNodes.flatMap(({ node }) =>
    node.parents.flatMap((parent) => {
      const parentGeometry = geometryById.get(parent.id);
      const childGeometry = geometryById.get(node.id);
      if (!parentGeometry || !childGeometry) return [];
      const points = sampleEdge(parentGeometry, childGeometry, edgeSamples);
      return [
        {
          id: `edge-${parent.id}-${node.id}-${parent.kind}`,
          parentId: parent.id,
          childId: node.id,
          branchId:
            parent.kind === "merge-parent"
              ? parentGeometry.branchId
              : node.branchId,
          status: node.status,
          kind: parent.kind,
          path: toPath(points),
          points,
        },
      ];
    })
  );

  const graphBottom = Math.max(
    topPadding,
    ...authoredGeometry.map((node) => node.y)
  );
  const height = graphBottom + bottomPadding;

  const lanes: TimelineLaneGeometry[] = repository.branches.map(
    (branch, index) => {
      const x = laneScale(branch.id) ?? width / 2;
      const points = [
        { x, y: topPadding - nodeRadius * 2 },
        { x, y: graphBottom + nodeRadius * 2 },
      ];
      return {
        id: branch.id,
        label: branch.label,
        description: branch.description,
        color: branch.color,
        index,
        x,
        nodeIds: authoredGeometry
          .filter((node) => node.branchId === branch.id)
          .map((node) => node.id),
        path: toPath(points),
        points,
      };
    }
  );

  const refs: TimelineRefGeometry[] = repository.refs.flatMap((ref) => {
    const target = geometryById.get(ref.targetId);
    if (!target) return [];
    const targetRefIds = refIdsByNode.get(ref.targetId) ?? [];
    const refIndex = Math.max(0, targetRefIds.indexOf(ref.id));
    return [
      {
        ...ref,
        x: target.x + nodeRadius * 2.25,
        y: target.y + refIndex * 22,
      },
    ];
  });

  return {
    width,
    height,
    lanes,
    nodes,
    edges,
    refs,
    bounds: {
      top: topPadding,
      right: width - laneInset,
      bottom: graphBottom,
      left: laneInset,
    },
  };
};

const createInitialTimelineState = (): TimelineRuntimeState => ({
  enabled: false,
  layout: null,
  viewport: { ...EMPTY_VIEWPORT },
  scrollTop: 0,
  revealProgress: 0,
  activeBranchId: null,
  activeCommitId: null,
  reducedMotion: false,
});

export const createTimelineRuntime = (
  initialState: Partial<TimelineRuntimeState> = {}
): TimelineRuntime => ({
  stateRef: {
    current: {
      ...createInitialTimelineState(),
      ...initialState,
      viewport: initialState.viewport
        ? { ...initialState.viewport }
        : { ...EMPTY_VIEWPORT },
      revealProgress: Math.max(
        0,
        Math.min(1, initialState.revealProgress ?? 0)
      ),
    },
  },
  requestRenderRef: { current: () => undefined },
});

export const getTimelineScreenPoint = (
  point: TimelinePoint,
  state: TimelineRuntimeState
): TimelinePoint => ({
  x: state.viewport.left + point.x,
  y: state.viewport.top + point.y - state.scrollTop,
});

export const isTimelinePointVisible = (
  point: TimelinePoint,
  state: TimelineRuntimeState,
  margin = 80
): boolean => {
  const screenPoint = getTimelineScreenPoint(point, state);
  return (
    screenPoint.x >= state.viewport.left - margin &&
    screenPoint.x <= state.viewport.left + state.viewport.width + margin &&
    screenPoint.y >= state.viewport.top - margin &&
    screenPoint.y <= state.viewport.top + state.viewport.height + margin
  );
};
