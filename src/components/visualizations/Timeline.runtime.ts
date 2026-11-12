import type {
  CareerCommitKind,
  LocalizedCareerRepository,
} from "@/types/content";

export type TimelineBranchId = "education" | "work" | "experiences";

export interface TimelinePoint {
  x: number;
  y: number;
}

export interface TimelineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineRgb {
  r: number;
  g: number;
  b: number;
}

export interface TimelineBranchMeta {
  id: TimelineBranchId;
  /** Primary visual color for track dots, particles, and borders. */
  color: string;
  /** High-contrast foreground ink color for text on #F9F9F7 paper. */
  inkColor: string;
  rgb: TimelineRgb;
  y: number;
  count: number;
}

export interface TimelineMilestoneNode {
  id: string;
  sha: string;
  kind: Exclude<CareerCommitKind, "milestone">;
  branchId: TimelineBranchId;
  color: string;
  inkColor: string;
  title: string;
  organization: string;
  period: string;
  summary: string;
  details: string[];
  decimalYear: number;
  spanStartYear: number | null;
  spanEndYear: number | null;
  spanStartX: number | null;
  spanEndX: number | null;
  x: number;
  y: number;
  cardPlacement: "above" | "below";
  cardRect: TimelineRect;
  stemHeight: number;
  isOrigin: boolean;
  isHead: boolean;
  isBranchEnd: boolean;
}

export type TimelineEdgeKind = "continuity" | "fork" | "merge";

export interface TimelineEdgeGeometry {
  id: string;
  sourceId: string;
  targetId: string;
  fromBranchId: TimelineBranchId;
  toBranchId: TimelineBranchId;
  branchId: TimelineBranchId;
  kind: TimelineEdgeKind;
  color: string;
  path: string;
  points: TimelinePoint[];
}

export interface TimelineYearTick {
  year: number;
  age: number;
  x: number;
  isCurrentYear: boolean;
  isFirstYear: boolean;
}

export interface TimelineLayoutOptions {
  stageHeight: number;
  currentDecimalYear: number;
  currentYear?: number;
  minYear?: number;
  yearWidth?: number;
  startX?: number;
  endPadding?: number;
  cardWidth?: number;
  cardHeight?: number;
}

export interface TimelineFutureAnchor {
  branchId: TimelineBranchId;
  color: string;
  inkColor: string;
  fromX: number;
  x: number;
  y: number;
  cardPlacement: "above" | "below";
  cardRect: TimelineRect;
}

export interface TimelineHorizontalLayout {
  width: number;
  height: number;
  axisY: number;
  startX: number;
  yearWidth: number;
  minYear: number;
  maxYear: number;
  presentX: number;
  cardWidth: number;
  cardHeight: number;
  branches: TimelineBranchMeta[];
  nodes: TimelineMilestoneNode[];
  edges: TimelineEdgeGeometry[];
  ticks: TimelineYearTick[];
  futureAnchors: Record<TimelineBranchId, TimelineFutureAnchor>;
}

export interface TimelineViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TimelineRuntimeState {
  enabled: boolean;
  layoutMode: "desktop" | "mobile";
  layout: TimelineHorizontalLayout | null;
  viewport: TimelineViewportRect;
  scrollLeft: number;
  activeBranchId: TimelineBranchId | null;
  hoveredBranchId: TimelineBranchId | null;
  hoveredMilestoneId: string | null;
  selectedMilestoneId: string | null;
  reducedMotion: boolean;
}

export interface TimelineRuntime {
  stateRef: { current: TimelineRuntimeState };
  requestRenderRef: { current: () => void };
}

export const TIMELINE_BRANCH_ORDER: readonly TimelineBranchId[] = [
  "education",
  "work",
  "experiences",
] as const;

export const TIMELINE_BRANCH_STYLE: Record<
  TimelineBranchId,
  { color: string; inkColor: string; rgb: TimelineRgb }
> = {
  education: {
    color: "#D97706",
    inkColor: "#B45309",
    rgb: { r: 217, g: 119, b: 6 },
  },
  work: {
    color: "#2D5BE3",
    inkColor: "#1E44B8",
    rgb: { r: 45, g: 91, b: 227 },
  },
  experiences: {
    color: "#059669",
    inkColor: "#047857",
    rgb: { r: 5, g: 150, b: 105 },
  },
};

const BIRTH_YEAR = 1998;
const DEFAULT_MIN_YEAR = 2015;
const DEFAULT_YEAR_WIDTH = 276;
const DEFAULT_START_X = 128;
const DEFAULT_END_PADDING = 200;
const DEFAULT_CARD_WIDTH = 256;
const DEFAULT_CARD_HEIGHT = 82;
const CARD_STEM_HEIGHT = 20;
const CARD_ANCHOR_OFFSET = -26;
const EDGE_SAMPLES = 22;

const EMPTY_VIEWPORT: TimelineViewportRect = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
};

export const getCurrentDecimalYear = (): number => {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const daysInYear =
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  return year + dayOfYear / daysInYear;
};

export const parseDecimalYear = (timeVal: string): number => {
  const parts = timeVal.split("-");
  const yr = parseInt(parts[0], 10);
  if (parts.length > 1) {
    const mo = parseInt(parts[1], 10);
    return yr + (mo - 0.5) / 12;
  }
  return yr + 0.3;
};

const MONTH_TOKENS: readonly string[][] = [
  ["jan", "ene"],
  ["feb"],
  ["mar"],
  ["apr", "abr"],
  ["may", "mai"],
  ["jun"],
  ["jul"],
  ["aug", "ago"],
  ["sep", "set"],
  ["oct", "okt"],
  ["nov"],
  ["dec", "dic", "dez"],
];

const parsePeriodEndpoint = (
  part: string,
  isEnd: boolean,
  currentDecimalYear: number
): number | null => {
  const lower = part.trim().toLowerCase();
  if (
    lower.includes("present") ||
    lower.includes("presente") ||
    lower.includes("hoy") ||
    lower.includes("today") ||
    lower.includes("heute")
  ) {
    return currentDecimalYear;
  }

  const yearMatch = lower.match(/(\d{4})/);
  if (!yearMatch) return null;

  const year = parseInt(yearMatch[1], 10);
  const monthIndex = MONTH_TOKENS.findIndex((group) =>
    group.some((token) => lower.includes(token))
  );
  if (monthIndex !== -1) {
    return year + (monthIndex + (isEnd ? 0.5 : 0)) / 12;
  }
  return year;
};

export const parsePeriodSpan = (
  period: string,
  currentDecimalYear: number
): { start: number | null; end: number | null } => {
  const clean = period.trim().replace(/\s+/g, " ");
  const parts = clean.split(/[-–—]/).map((p) => p.trim());
  if (parts.length < 2) {
    const single = parsePeriodEndpoint(clean, false, currentDecimalYear);
    return { start: single, end: single };
  }
  return {
    start: parsePeriodEndpoint(parts[0], false, currentDecimalYear),
    end: parsePeriodEndpoint(parts[1], true, currentDecimalYear),
  };
};

export const formatPeriodDuration = (
  period: string,
  currentDecimalYear: number,
  lang: string
): string | null => {
  const { start, end } = parsePeriodSpan(period, currentDecimalYear);
  if (start === null || end === null) return null;
  const diff = end - start;
  if (diff < 0.08) return null;

  if (diff < 0.95) {
    const months = Math.max(1, Math.round(diff * 12));
    if (lang === "es") return `${months} ${months === 1 ? "mes" : "meses"}`;
    if (lang === "de") return `${months} Mon.`;
    return `${months} ${months === 1 ? "mo" : "mos"}`;
  }

  const rounded = Math.round(diff);
  if (Math.abs(diff - rounded) < 0.08) {
    if (lang === "es") return `${rounded} ${rounded === 1 ? "año" : "años"}`;
    if (lang === "de") return `${rounded} ${rounded === 1 ? "Jahr" : "Jahre"}`;
    return `${rounded} ${rounded === 1 ? "yr" : "yrs"}`;
  }

  const fixed = diff.toFixed(1);
  if (lang === "es") return `${fixed} años`;
  if (lang === "de") return `${fixed} Jahre`;
  return `${fixed} yrs`;
};

export const mapCommitToBranch = (
  commit: LocalizedCareerRepository["commits"][number]
): TimelineBranchId => {
  if (
    commit.branchId === "experiences" ||
    commit.id.startsWith("work-travel")
  ) {
    return "experiences";
  }
  if (
    commit.branchId === "learn/education" ||
    commit.id === "ort-technical-foundations" ||
    commit.id === "it-management-degree"
  ) {
    return "education";
  }
  return "work";
};

const rectsOverlap = (
  a: TimelineRect,
  b: TimelineRect,
  padX = 12,
  padY = 8
): boolean => {
  return (
    a.x < b.x + b.width + padX &&
    a.x + a.width + padX > b.x &&
    a.y < b.y + b.height + padY &&
    a.y + a.height + padY > b.y
  );
};

const sampleCubicBezier = (
  p0: TimelinePoint,
  c1: TimelinePoint,
  c2: TimelinePoint,
  p1: TimelinePoint,
  sampleCount: number
): TimelinePoint[] =>
  Array.from({ length: sampleCount + 1 }, (_, idx) => {
    const t = idx / sampleCount;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x:
        uuu * p0.x +
        3 * uu * t * c1.x +
        3 * u * tt * c2.x +
        ttt * p1.x,
      y:
        uuu * p0.y +
        3 * uu * t * c1.y +
        3 * u * tt * c2.y +
        ttt * p1.y,
    };
  });

const buildCurveGeometry = (
  id: string,
  sourceId: string,
  targetId: string,
  fromBranchId: TimelineBranchId,
  toBranchId: TimelineBranchId,
  kind: TimelineEdgeKind,
  p0: TimelinePoint,
  p1: TimelinePoint
): TimelineEdgeGeometry => {
  const color = TIMELINE_BRANCH_STYLE[toBranchId].color;
  if (Math.abs(p0.y - p1.y) < 1) {
    const path = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
    const points = Array.from({ length: EDGE_SAMPLES + 1 }, (_, i) => {
      const t = i / EDGE_SAMPLES;
      return { x: p0.x + (p1.x - p0.x) * t, y: p0.y };
    });
    return {
      id,
      sourceId,
      targetId,
      fromBranchId,
      toBranchId,
      branchId: toBranchId,
      kind,
      color,
      path,
      points,
    };
  }

  const midX = p0.x + (p1.x - p0.x) * 0.5;
  const c1 = { x: midX, y: p0.y };
  const c2 = { x: midX, y: p1.y };
  const path = `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`;
  const points = sampleCubicBezier(p0, c1, c2, p1, EDGE_SAMPLES);

  return {
    id,
    sourceId,
    targetId,
    fromBranchId,
    toBranchId,
    branchId: toBranchId,
    kind,
    color,
    path,
    points,
  };
};

/**
 * Computes a collision-free, responsive horizontal 3-branch milestone layout
 * from the career repository. Pure geometry with zero DOM access.
 */
export const createTimelineHorizontalLayout = (
  repository: LocalizedCareerRepository,
  options: TimelineLayoutOptions
): TimelineHorizontalLayout => {
  const height = Math.max(460, Math.min(760, Math.round(options.stageHeight)));
  const minYear = options.minYear ?? DEFAULT_MIN_YEAR;
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const maxYear = Math.max(currentYear + 1, 2027);
  const yearWidth = options.yearWidth ?? DEFAULT_YEAR_WIDTH;
  const startX = options.startX ?? DEFAULT_START_X;
  const endPadding = options.endPadding ?? DEFAULT_END_PADDING;
  const cardWidth = options.cardWidth ?? DEFAULT_CARD_WIDTH;
  const cardHeight = options.cardHeight ?? DEFAULT_CARD_HEIGHT;

  const axisY = height - 42;
  const usableTop = 18;
  const usableBottom = axisY - 22;
  const usableSpan = usableBottom - usableTop;

  const laneYMap: Record<TimelineBranchId, number> = {
    education: Math.round(usableTop + usableSpan * 0.25),
    work: Math.round(usableTop + usableSpan * 0.57),
    experiences: Math.round(usableTop + usableSpan * 0.87),
  };

  const toX = (decimalYear: number): number =>
    Math.round(startX + (decimalYear - minYear) * yearWidth);

  const presentX = toX(options.currentDecimalYear);
  const maxContentX = Math.max(presentX, toX(maxYear));
  const width = Math.max(maxContentX + endPadding, presentX + 340);

  const milestoneCommits = repository.commits
    .filter(
      (c) =>
        c.kind === "role" ||
        c.kind === "foundation" ||
        c.kind === "education"
    )
    .map((commit) => ({
      commit,
      branchId: mapCommitToBranch(commit),
      decimalYear: parseDecimalYear(commit.time.value),
    }))
    .sort((a, b) => a.decimalYear - b.decimalYear);

  const countByBranch: Record<TimelineBranchId, number> = {
    education: 0,
    work: 0,
    experiences: 0,
  };
  const lastIdByBranch: Partial<Record<TimelineBranchId, string>> = {};
  milestoneCommits.forEach(({ commit, branchId }) => {
    countByBranch[branchId] += 1;
    lastIdByBranch[branchId] = commit.id;
  });

  const branches: TimelineBranchMeta[] = TIMELINE_BRANCH_ORDER.map((id) => ({
    id,
    ...TIMELINE_BRANCH_STYLE[id],
    y: laneYMap[id],
    count: countByBranch[id],
  }));

  const placedCardRects: TimelineRect[] = [];

  const headTargetId =
    milestoneCommits.find(({ commit }) =>
      /present|presente|hoy|today|heute/i.test(commit.period)
    )?.commit.id ?? lastIdByBranch.work ?? null;

  interface MilestoneDraft {
    commit: LocalizedCareerRepository["commits"][number];
    branchId: TimelineBranchId;
    decimalYear: number;
    style: { color: string; inkColor: string; rgb: TimelineRgb };
    x: number;
    y: number;
    spanStartYear: number | null;
    spanEndYear: number | null;
    spanStartX: number | null;
    spanEndX: number | null;
    isOrigin: boolean;
    isHead: boolean;
    isBranchEnd: boolean;
  }

  // 1. Precompute branch node anchors so cross-branch curves can inform card placement
  const drafts: MilestoneDraft[] = milestoneCommits.map(
    ({ commit, branchId, decimalYear }, index) => {
      const style = TIMELINE_BRANCH_STYLE[branchId];
      const x = toX(decimalYear);
      const y = laneYMap[branchId];
      const span = parsePeriodSpan(commit.period, options.currentDecimalYear);
      const clampedStart =
        span.start !== null ? Math.max(minYear - 0.15, span.start) : null;
      const clampedEnd = span.end !== null ? span.end : null;
      const spanStartX =
        clampedStart !== null && clampedStart < decimalYear - 0.15
          ? toX(clampedStart)
          : null;
      const spanEndX =
        clampedEnd !== null && clampedEnd > decimalYear + 0.15
          ? toX(clampedEnd)
          : null;

      return {
        commit,
        branchId,
        decimalYear,
        style,
        x,
        y,
        spanStartYear: clampedStart,
        spanEndYear: clampedEnd,
        spanStartX,
        spanEndX,
        isOrigin: index === 0,
        isHead: commit.id === headTargetId,
        isBranchEnd: lastIdByBranch[branchId] === commit.id,
      };
    }
  );

  const draftById = new Map(drafts.map((d) => [d.commit.id, d]));
  const edges: TimelineEdgeGeometry[] = [];
  const edgeKeys = new Set<string>();

  const pushEdge = (
    sourceId: string,
    targetId: string,
    kind: TimelineEdgeKind,
    overrideP0?: TimelinePoint
  ) => {
    const source = draftById.get(sourceId);
    const target = draftById.get(targetId);
    if (!source || !target) return;
    const key = `${sourceId}->${targetId}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);

    edges.push(
      buildCurveGeometry(
        `edge-${sourceId}-${targetId}`,
        sourceId,
        targetId,
        source.branchId,
        target.branchId,
        kind,
        overrideP0 ?? { x: source.x, y: source.y },
        { x: target.x, y: target.y }
      )
    );
  };

  // Sequential continuity along each branch
  TIMELINE_BRANCH_ORDER.forEach((branchId) => {
    const branchDrafts = drafts.filter((d) => d.branchId === branchId);
    for (let i = 0; i < branchDrafts.length - 1; i += 1) {
      // Education spans 10 years with DevBorn/work happening in between; connect via fork/merge instead of a flat 10-year jump
      if (branchId === "education") continue;
      pushEdge(branchDrafts[i].commit.id, branchDrafts[i + 1].commit.id, "continuity");
    }
  });

  // Authentic career fork & merge transitions across the 3 branches
  milestoneCommits.forEach(({ commit }) => {
    commit.parents.forEach((parent) => {
      if (draftById.has(parent.id)) {
        const src = draftById.get(parent.id)!;
        const dst = draftById.get(commit.id)!;
        if (src.branchId === dst.branchId) return;
        pushEdge(
          parent.id,
          commit.id,
          parent.kind === "merge-parent" ? "merge" : "fork"
        );
      }
    });
  });

  // Connect DevBorn -> UADE (started Jun 2022 while working) & UADE (2026) -> GEA (2026 Present)
  const devborn = draftById.get("devborn-operations-automation");
  const uade = draftById.get("it-management-degree");
  const gea = draftById.get("gea-backend-api-delivery");
  if (devborn && uade) {
    const uadeStartX = uade.spanStartX ?? toX(2022.42);
    // Fork upward from work lane around 2022 to the start of the UADE education span
    edges.push(
      buildCurveGeometry(
        "edge-devborn-uade-start",
        devborn.commit.id,
        uade.commit.id,
        "work",
        "education",
        "fork",
        { x: Math.max(devborn.x, uadeStartX - 90), y: devborn.y },
        { x: uadeStartX, y: uade.y }
      )
    );
  }
  if (uade && gea) {
    pushEdge(uade.commit.id, gea.commit.id, "merge");
  }

  // Cross-branch curve sample points used to score candidate card positions cleanly
  const crossBranchEdges = edges.filter((edge) => edge.kind !== "continuity");
  const scoreCardIntersections = (rect: TimelineRect): number => {
    const padX = 10;
    const padY = 8;
    let penalty = 0;

    for (const edge of crossBranchEdges) {
      let edgeHits = 0;
      for (const pt of edge.points) {
        if (
          pt.x >= rect.x - padX &&
          pt.x <= rect.x + rect.width + padX &&
          pt.y >= rect.y - padY &&
          pt.y <= rect.y + rect.height + padY
        ) {
          edgeHits += 1;
        }
      }
      if (edgeHits > 0) {
        penalty += 120 + edgeHits * 12;
      }
    }

    return penalty;
  };

  // 2. Collision-free card placement choosing positions clear of cross-branch curves & HEAD line
  const lastPlacedSideByBranch: Partial<Record<TimelineBranchId, "above" | "below">> = {};
  const nodes: TimelineMilestoneNode[] = drafts.map((draft) => {
    const { commit, branchId, x, y } = draft;

    const buildCardRect = (
      side: "above" | "below",
      offsetX: number
    ): TimelineRect => ({
      x: Math.max(12, Math.min(width - cardWidth - 16, x + offsetX)),
      y:
        side === "above"
          ? Math.max(8, y - CARD_STEM_HEIGHT - cardHeight)
          : Math.min(axisY - cardHeight - 10, y + CARD_STEM_HEIGHT),
      width: cardWidth,
      height: cardHeight,
    });

    let preferredSide: "above" | "below" = "above";
    if (branchId === "work") {
      const prevSide = lastPlacedSideByBranch[branchId];
      preferredSide = prevSide === "above" ? "below" : "above";
    }

    const candidateSides: ("above" | "below")[] =
      branchId === "work"
        ? [preferredSide, preferredSide === "above" ? "below" : "above"]
        : [preferredSide, "below"];
    const candidateOffsets = [
      CARD_ANCHOR_OFFSET,
      -cardWidth + 32,
      -cardWidth / 2,
      20,
      -cardWidth + 16,
    ];

    let chosenSide = preferredSide;
    let chosenRect = buildCardRect(preferredSide, CARD_ANCHOR_OFFSET);
    let bestScore = Number.POSITIVE_INFINITY;
    let placed = false;

    candidateSides.forEach((side, sideRank) => {
      candidateOffsets.forEach((offset, offsetRank) => {
        const candidate = buildCardRect(side, offset);
        const collidesWithCard = placedCardRects.some((r) =>
          rectsOverlap(candidate, r)
        );
        const crossesOtherLane = TIMELINE_BRANCH_ORDER.some((otherId) => {
          if (otherId === branchId) return false;
          const otherY = laneYMap[otherId];
          return otherY >= candidate.y - 4 && otherY <= candidate.y + candidate.height + 4;
        });
        if (collidesWithCard || crossesOtherLane) return;

        const score =
          scoreCardIntersections(candidate) + sideRank * 8 + offsetRank * 2;
        if (score < bestScore) {
          bestScore = score;
          chosenSide = side;
          chosenRect = candidate;
          placed = true;
        }
      });
    });

    // Final nudge fallback if all candidates collided
    if (!placed) {
      let shift = 0;
      while (
        placedCardRects.some((r) => rectsOverlap(chosenRect, r)) &&
        shift < 420
      ) {
        shift += 36;
        chosenRect = buildCardRect(chosenSide, CARD_ANCHOR_OFFSET + shift);
      }
    }

    placedCardRects.push(chosenRect);
    lastPlacedSideByBranch[branchId] = chosenSide;

    return {
      id: commit.id,
      sha: commit.sha,
      kind: commit.kind as Exclude<CareerCommitKind, "milestone">,
      branchId,
      color: draft.style.color,
      inkColor: draft.style.inkColor,
      title: commit.title,
      organization: commit.organization ?? "",
      period: commit.period,
      summary: commit.summary,
      details:
        commit.details && commit.details.length > 0
          ? commit.details
          : [commit.summary],
      decimalYear: draft.decimalYear,
      spanStartYear: draft.spanStartYear,
      spanEndYear: draft.spanEndYear,
      spanStartX: draft.spanStartX,
      spanEndX: draft.spanEndX,
      x,
      y,
      cardPlacement: chosenSide,
      cardRect: chosenRect,
      stemHeight: CARD_STEM_HEIGHT,
      isOrigin: draft.isOrigin,
      isHead: draft.isHead,
      isBranchEnd: draft.isBranchEnd,
    };
  });

  const buildFutureAnchor = (branchId: TimelineBranchId): TimelineFutureAnchor => {
    const style = TIMELINE_BRANCH_STYLE[branchId];
    const branchNodes = nodes.filter((n) => n.branchId === branchId);
    const lastNode = branchNodes[branchNodes.length - 1];
    const laneY = laneYMap[branchId];
    const cardPlacement: "above" | "below" =
      branchId === "work" ? "below" : "above";
    const cardY =
      cardPlacement === "above"
        ? Math.max(8, laneY - CARD_STEM_HEIGHT - cardHeight)
        : Math.min(axisY - cardHeight - 10, laneY + CARD_STEM_HEIGHT);

    // Clear any existing card occupying this vertical shelf band on the same branch or adjacent space
    const shelfBlockerMaxRight = nodes
      .filter((n) => {
        const yOverlap =
          n.cardRect.y < cardY + cardHeight + 8 &&
          n.cardRect.y + n.cardRect.height + 8 > cardY;
        return yOverlap;
      })
      .reduce((acc, n) => Math.max(acc, n.cardRect.x + n.cardRect.width), 0);

    const cardX = Math.max(presentX + 28, shelfBlockerMaxRight + 34);
    const futureX = Math.max(presentX + 145, Math.round(cardX + cardWidth * 0.45));
    const cardRect: TimelineRect = {
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
    };

    return {
      branchId,
      color: style.color,
      inkColor: style.inkColor,
      fromX: lastNode ? lastNode.x : Math.max(startX, presentX - 180),
      x: futureX,
      y: laneY,
      cardPlacement,
      cardRect,
    };
  };

  const futureAnchors: Record<TimelineBranchId, TimelineFutureAnchor> = {
    education: buildFutureAnchor("education"),
    work: buildFutureAnchor("work"),
    experiences: buildFutureAnchor("experiences"),
  };

  const finalWidth = Math.max(
    width,
    ...TIMELINE_BRANCH_ORDER.map(
      (bId) =>
        Math.max(
          futureAnchors[bId].cardRect.x + futureAnchors[bId].cardRect.width + 36,
          futureAnchors[bId].x + 120
        )
    )
  );

  const ticks: TimelineYearTick[] = Array.from(
    { length: maxYear - minYear + 1 },
    (_, idx) => {
      const year = minYear + idx;
      return {
        year,
        age: year - BIRTH_YEAR,
        x: toX(year),
        isCurrentYear: year === currentYear,
        isFirstYear: idx === 0,
      };
    }
  );

  return {
    width: finalWidth,
    height,
    axisY,
    startX,
    yearWidth,
    minYear,
    maxYear,
    presentX,
    cardWidth,
    cardHeight,
    branches,
    nodes,
    edges,
    ticks,
    futureAnchors,
  };
};

const createInitialTimelineState = (): TimelineRuntimeState => ({
  enabled: false,
  layoutMode: "desktop",
  layout: null,
  viewport: { ...EMPTY_VIEWPORT },
  scrollLeft: 0,
  activeBranchId: null,
  hoveredBranchId: null,
  hoveredMilestoneId: null,
  selectedMilestoneId: null,
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
    },
  },
  requestRenderRef: { current: () => undefined },
});

export const getTimelineScreenPoint = (
  point: TimelinePoint,
  state: TimelineRuntimeState
): TimelinePoint => ({
  x: state.viewport.left + point.x - state.scrollLeft,
  y: state.viewport.top + point.y,
});
