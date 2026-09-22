"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type {
  CareerBranchId,
  Dictionary,
  LocalizedCareerRepository,
} from "@/types/content";
import {
  createTimelineLayout,
  type TimelineNodeGeometry,
  type TimelineRuntime,
} from "@/components/visualizations/Timeline.runtime";
import styles from "./TimelinePage.module.css";

interface TimelinePageProps {
  dict: Dictionary;
  repository: LocalizedCareerRepository;
  timelineRuntime: TimelineRuntime;
  isActive: boolean;
}

type CareerCommit = LocalizedCareerRepository["commits"][number];
type CareerStagingItem = LocalizedCareerRepository["staging"][number];
type CareerNode = CareerCommit | CareerStagingItem;

const DESKTOP_QUERY = "(min-width: 992px)";
const INITIAL_GRAPH_WIDTH = 400;
const INITIAL_REVEAL_PROGRESS = 0.36;

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

const subscribeToDesktop = (onStoreChange: () => void) => {
  const mediaQuery = window.matchMedia(DESKTOP_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
};

const getDesktopSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches;
const getDesktopServerSnapshot = () => false;

const isCommit = (node: CareerNode): node is CareerCommit =>
  node.status === "committed";

const getStatusToken = (node: CareerNode, dict: Dictionary): string => {
  if (node.status === "wip") return dict.timeline.wipLabel;
  if (node.status === "forecast") return dict.timeline.forecastLabel;
  return node.parents.length > 1
    ? dict.timeline.mergeLabel
    : dict.timeline.commitLabel;
};

const getTimeLabel = (node: CareerNode): string => {
  if (isCommit(node)) return node.period;
  return `${node.time.value}${node.time.precision === "year-plus" ? "+" : ""}`;
};

const getNodeAriaLabel = (
  node: CareerNode,
  dict: Dictionary
): string => {
  const sha = isCommit(node) ? `${dict.timeline.commitLabel} ${node.sha}` : "";
  const state = getStatusToken(node, dict);
  return [state, sha, node.title, node.branchId].filter(Boolean).join(", ");
};

const getHexagonPoints = (node: TimelineNodeGeometry): string =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    const radius = node.radius + 2;
    return `${(node.x + Math.cos(angle) * radius).toFixed(2)},${(
      node.y +
      Math.sin(angle) * radius
    ).toFixed(2)}`;
  }).join(" ");

const getDiamondPath = (node: TimelineNodeGeometry): string => {
  const radius = node.radius + 3;
  return `M ${node.x} ${node.y - radius} L ${node.x + radius} ${
    node.y
  } L ${node.x} ${node.y + radius} L ${node.x - radius} ${node.y} Z`;
};

export default function TimelinePage({
  dict,
  repository,
  timelineRuntime,
  isActive,
}: TimelinePageProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const revealProgressRef = useRef(INITIAL_REVEAL_PROGRESS);
  const publishRuntimeRef = useRef<() => void>(() => undefined);
  const [graphWidth, setGraphWidth] = useState(INITIAL_GRAPH_WIDTH);
  const [activeBranchId, setActiveBranchId] =
    useState<CareerBranchId | null>(null);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [engagedCommitId, setEngagedCommitId] = useState<string | null>(null);

  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot
  );
  const reducedMotion = useReducedMotionPreference();
  const activeCommitId = engagedCommitId ?? selectedCommitId;

  const layout = useMemo(
    () =>
      createTimelineLayout(repository, {
        width: graphWidth,
        topPadding: 210,
        bottomPadding: 156,
        laneInset: 42,
        minimumNodeGap: 132,
        pixelsPerYear: 126,
        edgeSamples: 24,
        nodeRadius: 8,
      }),
    [graphWidth, repository]
  );

  const nodeById = useMemo(
    () =>
      new Map<string, CareerNode>([
        ...repository.commits.map((node) => [node.id, node] as const),
        ...repository.staging.map((node) => [node.id, node] as const),
      ]),
    [repository]
  );

  const geometryById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes]
  );

  const refsByTarget = useMemo(() => {
    const result = new Map<string, LocalizedCareerRepository["refs"]>();
    repository.refs.forEach((ref) => {
      const refs = result.get(ref.targetId) ?? [];
      refs.push(ref);
      result.set(ref.targetId, refs);
    });
    return result;
  }, [repository.refs]);

  const visuallyOrderedNodes = useMemo(
    () => [...layout.nodes].sort((left, right) => left.y - right.y),
    [layout.nodes]
  );

  const mobileOrderedNodes = useMemo(
    () => [...repository.staging, ...[...repository.commits].reverse()],
    [repository.commits, repository.staging]
  );

  const branchColorById = useMemo(
    () => new Map(repository.branches.map((branch) => [branch.id, branch.color])),
    [repository.branches]
  );

  const emphasizedNodeIds = useMemo(() => {
    if (!activeBranchId) return null;
    const result = new Set<string>();
    layout.nodes.forEach((node) => {
      if (node.branchId === activeBranchId) result.add(node.id);
    });
    layout.edges.forEach((edge) => {
      if (edge.branchId !== activeBranchId) return;
      result.add(edge.parentId);
      result.add(edge.childId);
    });
    return result;
  }, [activeBranchId, layout.edges, layout.nodes]);

  const initialRevealThreshold = useMemo(() => {
    const span = Math.max(1, layout.bounds.bottom - layout.bounds.top);
    return layout.bounds.top + span * INITIAL_REVEAL_PROGRESS;
  }, [layout.bounds.bottom, layout.bounds.top]);

  const publishRuntime = useCallback(() => {
    const scroller = scrollerRef.current;
    const shouldEnable = Boolean(isActive && isDesktop && scroller);
    const current = timelineRuntime.stateRef.current;

    if (!shouldEnable || !scroller) {
      timelineRuntime.stateRef.current = {
        ...current,
        enabled: false,
        activeBranchId: null,
        activeCommitId: null,
        reducedMotion,
      };
      timelineRuntime.requestRenderRef.current();
      return;
    }

    const rect = scroller.getBoundingClientRect();
    timelineRuntime.stateRef.current = {
      ...current,
      enabled: true,
      layout,
      viewport: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      scrollTop: scroller.scrollTop,
      revealProgress: reducedMotion ? 1 : revealProgressRef.current,
      activeBranchId,
      activeCommitId,
      reducedMotion,
    };
    timelineRuntime.requestRenderRef.current();
  }, [
    activeBranchId,
    activeCommitId,
    isActive,
    isDesktop,
    layout,
    reducedMotion,
    timelineRuntime,
  ]);

  const scheduleRuntimePublish = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      publishRuntimeRef.current();
    });
  }, []);

  useEffect(() => {
    publishRuntimeRef.current = publishRuntime;
    scheduleRuntimePublish();
  }, [publishRuntime, scheduleRuntimePublish]);

  useGSAP(
    () => {
      const root = sectionRef.current;
      const scroller = scrollerRef.current;
      const surface = surfaceRef.current;
      const historyItems = root
        ? gsap.utils.toArray<HTMLElement>(
            root.querySelectorAll(`.${styles.desktopCommitPosition}`)
          )
        : [];

      gsap.set(historyItems, {
        clearProps: "opacity,visibility,transform,willChange",
      });

      if (!isActive || !isDesktop || !scroller || !surface) {
        revealProgressRef.current = INITIAL_REVEAL_PROGRESS;
        scheduleRuntimePublish();
        return;
      }

      if (reducedMotion) {
        revealProgressRef.current = 1;
        gsap.set(historyItems, {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          clearProps: "opacity,visibility,transform,willChange",
        });
        scheduleRuntimePublish();
        return;
      }

      revealProgressRef.current = INITIAL_REVEAL_PROGRESS;
      gsap.set(historyItems, {
        autoAlpha: (_index, target) =>
          target.dataset.initialVisible === "true" ? 1 : 0.16,
        y: (_index, target) =>
          target.dataset.initialVisible === "true" ? 0 : 18,
        scale: (_index, target) =>
          target.dataset.initialVisible === "true" ? 1 : 0.985,
        transformOrigin: "left center",
        willChange: "transform, opacity",
      });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "career-git-dag-reveal",
          trigger: surface,
          scroller,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.45,
          pin: false,
          invalidateOnRefresh: true,
          onRefresh: (self) => {
            revealProgressRef.current =
              INITIAL_REVEAL_PROGRESS +
              (1 - INITIAL_REVEAL_PROGRESS) * self.progress;
            scheduleRuntimePublish();
          },
          onUpdate: (self) => {
            revealProgressRef.current =
              INITIAL_REVEAL_PROGRESS +
              (1 - INITIAL_REVEAL_PROGRESS) * self.progress;
            scheduleRuntimePublish();
          },
        },
      });

      timeline.to(
        historyItems,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 1,
          stagger: {
            each: 0.045,
            from: "start",
          },
        },
        0
      );

      return () => {
        revealProgressRef.current = INITIAL_REVEAL_PROGRESS;
        scheduleRuntimePublish();
      };
    },
    {
      scope: sectionRef,
      dependencies: [
        isActive,
        isDesktop,
        layout.height,
        reducedMotion,
        scheduleRuntimePublish,
      ],
      revertOnUpdate: true,
    }
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!isDesktop || !scroller) {
      publishRuntimeRef.current();
      return;
    }

    const updateGraphWidth = () => {
      const nextWidth = Math.round(
        Math.max(340, Math.min(520, scroller.clientWidth * 0.39))
      );
      setGraphWidth((current) => (current === nextWidth ? current : nextWidth));
      scheduleRuntimePublish();
    };

    const resizeObserver = new ResizeObserver(updateGraphWidth);
    resizeObserver.observe(scroller);
    scroller.addEventListener("scroll", scheduleRuntimePublish, {
      passive: true,
    });
    window.addEventListener("resize", scheduleRuntimePublish, {
      passive: true,
    });
    updateGraphWidth();
    scheduleRuntimePublish();

    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", scheduleRuntimePublish);
      window.removeEventListener("resize", scheduleRuntimePublish);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isDesktop, scheduleRuntimePublish]);

  useEffect(
    () => () => {
      const current = timelineRuntime.stateRef.current;
      timelineRuntime.stateRef.current = {
        ...current,
        enabled: false,
        activeBranchId: null,
        activeCommitId: null,
      };
      timelineRuntime.requestRenderRef.current();
    },
    [timelineRuntime]
  );

  const toggleBranch = useCallback((branchId: CareerBranchId) => {
    setActiveBranchId((current) => (current === branchId ? null : branchId));
  }, []);

  const toggleCommit = useCallback((commitId: string) => {
    setEngagedCommitId(null);
    setSelectedCommitId((current) => (current === commitId ? null : commitId));
  }, []);

  const engageCommit = useCallback((commitId: string) => {
    setEngagedCommitId(commitId);
  }, []);

  const disengageCommit = useCallback((commitId: string) => {
    setEngagedCommitId((current) => (current === commitId ? null : current));
  }, []);

  const handleCommitBlur = useCallback(
    (event: FocusEvent<HTMLButtonElement>, commitId: string) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        disengageCommit(commitId);
      }
    },
    [disengageCommit]
  );

  const handleCommitPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, commitId: string) => {
      if (event.pointerType === "touch") engageCommit(commitId);
    },
    [engageCommit]
  );

  const branchColorStyles = useMemo(
    () =>
      Object.fromEntries(
        repository.branches.map((branch) => [
          `--branch-${branch.id.replaceAll("/", "-")}`,
          branch.color,
        ])
      ) as CSSProperties,
    [repository.branches]
  );

  const renderBranchControls = (className: string) => (
    <nav className={className} aria-label={dict.timeline.branchLabel}>
      <span className={styles.branchLegend}>{dict.timeline.branchLabel}</span>
      <div className={styles.branchButtons}>
        {repository.branches.map((branch) => {
          const isPressed = activeBranchId === branch.id;
          const isDimmed = activeBranchId !== null && !isPressed;
          return (
            <button
              key={branch.id}
              type="button"
              className={`${styles.branchButton} ${
                isPressed ? styles.branchButtonActive : ""
              } ${isDimmed ? styles.branchButtonDimmed : ""}`}
              style={{ "--branch-color": branch.color } as CSSProperties}
              aria-pressed={isPressed}
              aria-label={`${branch.label}: ${branch.description}`}
              title={branch.description}
              onClick={() => toggleBranch(branch.id)}
            >
              <span className={styles.branchSwatch} aria-hidden="true" />
              <span>{branch.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  const renderCommitButton = (
    node: CareerNode,
    variant: "desktop" | "mobile"
  ) => {
    const refs = refsByTarget.get(node.id) ?? [];
    const selected = selectedCommitId === node.id;
    const energized = activeCommitId === node.id;
    const emphasized = !emphasizedNodeIds || emphasizedNodeIds.has(node.id);
    const merge = isCommit(node) && node.parents.length > 1;
    const className = [
      styles.commitButton,
      variant === "desktop" ? styles.commitButtonDesktop : styles.commitButtonMobile,
      node.status === "committed" ? null : styles[`status_${node.status}`],
      merge ? styles.commitButtonMerge : "",
      energized ? styles.commitButtonEnergized : "",
      !emphasized ? styles.commitButtonDimmed : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        type="button"
        className={className}
        style={{
          "--branch-color": branchColorById.get(node.branchId) ?? "var(--ink)",
        } as CSSProperties}
        aria-pressed={selected}
        aria-label={getNodeAriaLabel(node, dict)}
        onClick={() => toggleCommit(node.id)}
        onMouseEnter={() => engageCommit(node.id)}
        onMouseLeave={() => disengageCommit(node.id)}
        onFocus={() => engageCommit(node.id)}
        onBlur={(event) => handleCommitBlur(event, node.id)}
        onPointerDown={(event) => handleCommitPointerDown(event, node.id)}
        onPointerCancel={() => disengageCommit(node.id)}
      >
        <span className={styles.commitRule} aria-hidden="true" />
        <span className={styles.commitMeta}>
          <span className={styles.commitType}>{getStatusToken(node, dict)}</span>
          <code className={styles.sha}>
            {isCommit(node) ? node.sha : node.status === "wip" ? "WIP" : "NEXT"}
          </code>
          <time>{getTimeLabel(node)}</time>
          {merge ? <span className={styles.mergeToken}>merge commit</span> : null}
        </span>
        <span className={styles.commitHeading}>
          <strong>{node.title}</strong>
          {isCommit(node) && node.organization ? (
            <span className={styles.organization}>{node.organization}</span>
          ) : null}
        </span>
        <span className={styles.summary}>{node.summary}</span>
        {isCommit(node) && node.details.length > 0 ? (
          <span className={styles.details}>{node.details.join(" · ")}</span>
        ) : null}
        <span className={styles.refLine}>
          <code className={styles.branchRef}>{node.branchId}</code>
          {refs.map((ref) => (
            <code key={ref.id} className={styles[`ref_${ref.kind}`]}>
              {ref.kind === "head" ? "HEAD → " : ref.kind === "tag" ? "tag: " : ""}
              {ref.name}
            </code>
          ))}
        </span>
      </button>
    );
  };

  const surfaceStyle = {
    ...branchColorStyles,
    "--graph-width": `${layout.width}px`,
    "--surface-height": `${layout.height}px`,
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      className={styles.timelinePage}
      aria-labelledby="timeline-title"
    >
      {isDesktop ? (
        <div className={styles.desktopScroller} ref={scrollerRef}>
          <div
            className={styles.graphSurface}
            ref={surfaceRef}
            style={surfaceStyle}
          >
            <header className={styles.masthead}>
              <p className={styles.eyebrow}>
                <code>$ git log --graph --decorate --all</code>
              </p>
              <h1 id="timeline-title">{dict.timeline.title}</h1>
              <p className={styles.subtitle}>{dict.timeline.subtitle}</p>
              <div className={styles.repositoryIdentity}>
                <span className={styles.repoLabel}>{dict.timeline.repositoryLabel}</span>
                <code>{repository.name}</code>
                <span aria-hidden="true">/</span>
                <code className={styles.headRef}>HEAD → main</code>
                <strong>{repository.headIdentity}</strong>
              </div>
            </header>

            <aside className={styles.workingTree} aria-labelledby="working-tree-title">
              <div className={styles.workingTreeHeading}>
                <span id="working-tree-title">{dict.timeline.stagingLabel}</span>
                <code>git status --short</code>
              </div>
              <ol>
                {repository.staging.map((item) => (
                  <li key={item.id}>
                    <code>{item.status === "wip" ? "M" : "??"}</code>
                    <time>{getTimeLabel(item)}</time>
                    <span>{item.status === "wip" ? "WIP" : "forecast"}</span>
                  </li>
                ))}
              </ol>
            </aside>

            {renderBranchControls(styles.desktopBranches)}

            <svg
              className={styles.dag}
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <pattern
                  id="timeline-wip-hatch"
                  width="5"
                  height="5"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="5" className={styles.hatchLine} />
                </pattern>
                <pattern
                  id="timeline-forecast-dot"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1.5" cy="1.5" r="1" className={styles.forecastDot} />
                </pattern>
              </defs>

              <g className={styles.edges}>
                {layout.edges.map((edge) => {
                  const isDimmed =
                    activeBranchId !== null && edge.branchId !== activeBranchId;
                  const isEnergized =
                    activeCommitId === edge.parentId || activeCommitId === edge.childId;
                  const edgeClassName = [
                    styles.edge,
                    edge.kind === "merge-parent" ? styles.mergeEdge : null,
                    edge.status === "committed"
                      ? null
                      : styles[`edge_${edge.status}`],
                    isDimmed ? styles.edgeDimmed : null,
                    isEnergized ? styles.edgeEnergized : null,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <path
                      key={edge.id}
                      d={edge.path}
                      className={edgeClassName}
                      style={{
                        "--branch-color": branchColorById.get(edge.branchId) ?? "var(--ink)",
                      } as CSSProperties}
                    />
                  );
                })}
              </g>

              <g className={styles.nodes}>
                {visuallyOrderedNodes.map((geometry) => {
                  const content = nodeById.get(geometry.id);
                  if (!content) return null;
                  const refs = refsByTarget.get(geometry.id) ?? [];
                  const hasRelease = refs.some((ref) => ref.kind === "tag");
                  const hasHead = refs.some((ref) => ref.kind === "head");
                  const isDimmed =
                    emphasizedNodeIds !== null &&
                    !emphasizedNodeIds.has(geometry.id);
                  const isEnergized = activeCommitId === geometry.id;
                  const nodeClassName = [
                    styles.node,
                    geometry.status === "committed"
                      ? null
                      : styles[`node_${geometry.status}`],
                    geometry.isMerge ? styles.mergeNode : null,
                    hasRelease ? styles.releaseNode : null,
                    hasHead ? styles.headNode : null,
                    isDimmed ? styles.nodeDimmed : null,
                    isEnergized ? styles.nodeEnergized : null,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <g
                      key={geometry.id}
                      className={nodeClassName}
                      style={{
                        "--branch-color":
                          branchColorById.get(geometry.branchId) ?? "var(--ink)",
                      } as CSSProperties}
                    >
                      {hasRelease ? (
                        <circle
                          cx={geometry.x}
                          cy={geometry.y}
                          r={geometry.radius + 7}
                          className={styles.releaseRing}
                        />
                      ) : null}
                      {geometry.status === "forecast" ? (
                        <polygon
                          points={getHexagonPoints(geometry)}
                          className={styles.forecastShape}
                        />
                      ) : geometry.status === "wip" ? (
                        <rect
                          x={geometry.x - geometry.radius - 2}
                          y={geometry.y - geometry.radius - 2}
                          width={(geometry.radius + 2) * 2}
                          height={(geometry.radius + 2) * 2}
                          className={styles.wipShape}
                        />
                      ) : geometry.isMerge ? (
                        <path d={getDiamondPath(geometry)} className={styles.mergeShape} />
                      ) : (
                        <circle
                          cx={geometry.x}
                          cy={geometry.y}
                          r={geometry.radius}
                          className={styles.commitShape}
                        />
                      )}
                      {hasHead ? (
                        <path
                          d={`M ${geometry.x - 3} ${geometry.y - 22} L ${
                            geometry.x + 3
                          } ${geometry.y - 22} L ${geometry.x} ${
                            geometry.y - 15
                          } Z`}
                          className={styles.headPointer}
                        />
                      ) : null}
                    </g>
                  );
                })}
              </g>

              <g className={styles.svgRefs}>
                {layout.refs.map((ref) => {
                  if (!geometryById.has(ref.targetId)) return null;
                  const isDimmed =
                    emphasizedNodeIds !== null &&
                    !emphasizedNodeIds.has(ref.targetId);
                  const label =
                    ref.kind === "head"
                      ? "HEAD"
                      : ref.kind === "tag"
                        ? `tag: ${ref.name}`
                        : ref.name;
                  return (
                    <text
                      key={ref.id}
                      x={ref.x}
                      y={ref.y - 8}
                      className={`${styles.svgRef} ${styles[`svgRef_${ref.kind}`]} ${
                        isDimmed ? styles.svgRefDimmed : ""
                      }`}
                    >
                      {label}
                    </text>
                  );
                })}
              </g>
            </svg>

            <section className={styles.desktopHistory} aria-labelledby="history-title">
              <h2 id="history-title" className="visually-hidden">
                {dict.timeline.historyLabel}
              </h2>
              <ol>
                {visuallyOrderedNodes.map((geometry) => {
                  const node = nodeById.get(geometry.id);
                  if (!node) return null;
                  return (
                    <li
                      key={node.id}
                      className={styles.desktopCommitPosition}
                      data-initial-visible={
                        geometry.y <= initialRevealThreshold ? "true" : undefined
                      }
                      style={{ "--commit-y": `${geometry.y}px` } as CSSProperties}
                    >
                      {renderCommitButton(node, "desktop")}
                    </li>
                  );
                })}
              </ol>
            </section>

            <p className={styles.scrollHint}>
              <span aria-hidden="true">↓</span> {dict.timeline.scrollHint}
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.mobileLog}>
          <header className={styles.mobileHeader}>
            <p className={styles.eyebrow}>
              <code>$ git log --decorate --oneline</code>
            </p>
            <h1 id="timeline-title">{dict.timeline.title}</h1>
            <p className={styles.subtitle}>{dict.timeline.subtitle}</p>
            <div className={styles.mobileRepository}>
              <span>{dict.timeline.repositoryLabel}</span>
              <code>{repository.name}</code>
              <code className={styles.headRef}>HEAD → main</code>
              <strong>{repository.headIdentity}</strong>
            </div>
          </header>

          {renderBranchControls(styles.mobileBranches)}

          <section className={styles.mobileHistory} aria-labelledby="mobile-history-title">
            <div className={styles.mobileHistoryHeading}>
              <h2 id="mobile-history-title">{dict.timeline.historyLabel}</h2>
              <code>{repository.commits.length + repository.staging.length} entries</code>
            </div>
            <ol>
              {mobileOrderedNodes.map((node) => (
                <li key={node.id}>{renderCommitButton(node, "mobile")}</li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </section>
  );
}
