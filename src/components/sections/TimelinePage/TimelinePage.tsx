"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { Dictionary, LocalizedCareerRepository } from "@/types/content";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import {
  TIMELINE_BRANCH_ORDER,
  TIMELINE_BRANCH_STYLE,
  createTimelineHorizontalLayout,
  formatPeriodDuration,
  getCurrentDecimalYear,
  type TimelineBranchId,
  type TimelineFutureAnchor,
  type TimelineMilestoneNode,
  type TimelineRuntime,
} from "@/components/visualizations/Timeline.runtime";
import styles from "./TimelinePage.module.css";

interface TimelinePageProps {
  dict: Dictionary;
  repository: LocalizedCareerRepository;
  timelineRuntime?: TimelineRuntime;
  isActive?: boolean;
  isTransitioningIn?: boolean;
  lang?: string;
}

type SupportedLocale = "es" | "en" | "de";

const resolveLocale = (lang: string): SupportedLocale =>
  lang === "es" || lang === "de" ? lang : "en";

const formatCompactYears = (period: string, todayLabel: string): string => {
  const parts = period.split(/[-–—]/).map((p) => p.trim());
  const formatEndpoint = (part: string): string => {
    if (/present|presente|hoy|today|heute/i.test(part)) return todayLabel;
    const match = part.match(/(\d{4})/);
    return match ? match[1] : part;
  };
  if (parts.length < 2) return formatEndpoint(period);
  const start = formatEndpoint(parts[0]);
  const end = formatEndpoint(parts[1]);
  return start === end ? start : `${start}–${end}`;
};

interface AnnotationAnchorInput {
  x: number;
  y: number;
  cardPlacement: "above" | "below";
  cardRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const getAnnotationGeometry = (node: AnnotationAnchorInput) => {
  const isAbove = node.cardPlacement === "above";
  const anchorY = isAbove
    ? node.cardRect.y + node.cardRect.height + 3
    : node.cardRect.y - 3;
  const minX = node.cardRect.x + 12;
  const maxX = node.cardRect.x + node.cardRect.width - 12;
  const center = node.cardRect.x + node.cardRect.width * 0.5;
  const rawAnchorX = node.x + (node.x <= center ? 12 : -12);
  const anchorX = Math.max(minX, Math.min(maxX, rawAnchorX));

  return { anchorX, anchorY };
};

const formatMilestoneTitle = (title: string): string =>
  title.replace(/\s*->\s*/g, " → ");

interface FutureMetaParticlesProps {
  color: string;
  width: number;
  height?: number;
  count?: number;
  seed?: number;
  reducedMotion?: boolean;
  className?: string;
}

/**
 * Renders a living swarm of floating micro-particles in place of undesignated
 * future company and time-horizon metadata.
 */
function FutureMetaParticles({
  color,
  width,
  height = 13,
  count = 20,
  seed = 1,
  reducedMotion = false,
  className,
}: FutureMetaParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // Deterministic seeded sequence so particles distribute naturally
    let state = (seed * 9301 + 49297) % 233280;
    const nextRand = () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };

    const particles = Array.from({ length: count }, (_, idx) => {
      const bandT = (idx + 0.5) / count;
      const baseX = 4 + bandT * (width - 8) + (nextRand() - 0.5) * 5;
      const baseY = height * (0.24 + nextRand() * 0.52);
      return {
        baseX: Math.max(3, Math.min(width - 3, baseX)),
        baseY,
        r: 1.0 + nextRand() * 1.25,
        phase: nextRand() * Math.PI * 2,
        speed: 0.0014 + nextRand() * 0.0014,
        ampX: 1.4 + nextRand() * 2.0,
        ampY: 1.0 + nextRand() * 1.6,
        alpha: 0.56 + nextRand() * 0.4,
      };
    });

    const drawFrame = (timeMs: number) => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      for (const p of particles) {
        const t = reducedMotion ? 0 : timeMs * p.speed + p.phase;
        const x = p.baseX + Math.sin(t) * p.ampX;
        const y = p.baseY + Math.cos(t * 1.35) * p.ampY;
        const edgeFade =
          0.42 + 0.58 * Math.sin(Math.max(0.05, Math.min(0.95, x / width)) * Math.PI);
        const pulse = reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(t * 1.7 + p.phase);

        ctx.globalAlpha = p.alpha * edgeFade * pulse;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    if (reducedMotion) {
      drawFrame(0);
      return;
    }

    let rafId = 0;
    const tick = (now: number) => {
      drawFrame(now);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [color, width, height, count, seed, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`${styles.metaParticleCanvas} ${className ?? ""}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      aria-hidden="true"
    />
  );
}

export default function TimelinePage({
  dict,
  repository,
  timelineRuntime,
  isActive = true,
  isTransitioningIn = false,
  lang = "es",
}: TimelinePageProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mobileTimelineRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const cardButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dragPanRef = useRef<{
    active: boolean;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  }>({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const minimapDragRef = useRef(false);
  const initialScrollAppliedRef = useRef(false);

  const prefersReducedMotion = useReducedMotionPreference();
  const locale = resolveLocale(lang);
  const copy = dict.timeline;

  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 1180, height: 600 });
  const [scrollLeft, setScrollLeft] = useState(0);
  const [activeBranchId, setActiveBranchId] = useState<TimelineBranchId | null>(
    null
  );
  const [hoveredBranchId, setHoveredBranchId] =
    useState<TimelineBranchId | null>(null);
  const [hoveredMilestoneId, setHoveredMilestoneId] = useState<string | null>(
    null
  );
  const [currentDecimalYear, setCurrentDecimalYear] = useState(() =>
    getCurrentDecimalYear()
  );
  const [currentYear, setCurrentYear] = useState(() =>
    new Date().getFullYear()
  );

  const isTimelineVisible = isActive || isTransitioningIn;

  useEffect(() => {
    setCurrentDecimalYear(getCurrentDecimalYear());
    setCurrentYear(new Date().getFullYear());
    setIsMounted(true);

    const checkViewport = () => {
      setIsMobile(window.innerWidth < 992);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Measure real scroller viewport so lanes & SVG match DOM pixel-for-pixel
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || isMobile) return;

    const updateSize = () => {
      const w = scroller.clientWidth;
      const h = scroller.clientHeight;
      if (w > 0 && h > 0) {
        setStageSize((prev) =>
          prev.width === w && prev.height === h ? prev : { width: w, height: h }
        );
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [isMobile, isMounted]);

  const layout = useMemo(
    () =>
      createTimelineHorizontalLayout(repository, {
        stageHeight: stageSize.height,
        currentDecimalYear,
        currentYear,
      }),
    [repository, stageSize.height, currentDecimalYear, currentYear]
  );

  // Synchronize runtime state for InteractiveNetwork particle streams
  const syncRuntime = useCallback(
    (nextScrollLeft?: number) => {
      if (!timelineRuntime) return;
      const scroller = scrollerRef.current;
      const rect = scroller?.getBoundingClientRect();
      const mobileRect = mobileTimelineRef.current?.getBoundingClientRect();

      timelineRuntime.stateRef.current = {
        enabled: isTimelineVisible && isMounted,
        layoutMode: isMobile ? "mobile" : "desktop",
        layout,
        viewport: isMobile
          ? {
              left: mobileRect?.left ?? 16,
              top: mobileRect?.top ?? 150,
              width: mobileRect?.width ?? window.innerWidth - 32,
              height: mobileRect?.height ?? window.innerHeight - 170,
            }
          : {
              left: rect?.left ?? 158,
              top: rect?.top ?? 72,
              width: rect?.width ?? stageSize.width,
              height: rect?.height ?? stageSize.height,
            },
        scrollLeft: nextScrollLeft ?? scroller?.scrollLeft ?? scrollLeft,
        activeBranchId,
        hoveredBranchId,
        hoveredMilestoneId,
        selectedMilestoneId: null,
        reducedMotion: prefersReducedMotion,
      };
      timelineRuntime.requestRenderRef.current();
    },
    [
      timelineRuntime,
      isTimelineVisible,
      isMounted,
      isMobile,
      layout,
      stageSize.width,
      stageSize.height,
      scrollLeft,
      activeBranchId,
      hoveredBranchId,
      hoveredMilestoneId,
      prefersReducedMotion,
    ]
  );

  useEffect(() => {
    syncRuntime();
  }, [syncRuntime]);

  // Frame recent era (2023 -> Present) immediately on entry / transition
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || isMobile || !isMounted) return;
    if (!isTimelineVisible) return;

    if (!initialScrollAppliedRef.current) {
      const targetRightEdge = layout.presentX + 140;
      const targetScroll = Math.max(
        0,
        Math.min(
          layout.width - scroller.clientWidth,
          targetRightEdge - scroller.clientWidth
        )
      );
      scroller.scrollLeft = targetScroll;
      setScrollLeft(targetScroll);
      syncRuntime(targetScroll);
      initialScrollAppliedRef.current = true;
    }
  }, [
    isMobile,
    isMounted,
    isTimelineVisible,
    layout.presentX,
    layout.width,
    syncRuntime,
  ]);

  // Reset transient hover/scroll flags when navigating away from Timeline
  useEffect(() => {
    if (!isTimelineVisible) {
      initialScrollAppliedRef.current = false;
      setHoveredMilestoneId(null);
      setHoveredBranchId(null);
    }
  }, [isTimelineVisible]);

  // Map vertical mouse wheel to horizontal scroll while preserving native trackpad deltaX
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || isMobile || !isMounted) return;

    const handleWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absY > absX && e.deltaY !== 0) {
        e.preventDefault();
        scroller.scrollLeft += e.deltaY * 1.1;
      }
    };

    scroller.addEventListener("wheel", handleWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", handleWheel);
  }, [isMobile, isMounted]);

  // Subtle annotation entrance choreography respecting reduced motion
  useGSAP(
    () => {
      if (isMobile || !isMounted || !isTimelineVisible) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(`.${styles.milestoneAnnotation}`, {
          opacity: 0,
          y: 8,
          duration: 0.48,
          stagger: 0.03,
          ease: "power3.out",
          clearProps: "transform,opacity",
        });
      });

      return () => mm.revert();
    },
    {
      scope: sectionRef,
      dependencies: [isMobile, isMounted, isActive],
      revertOnUpdate: true,
    }
  );

  const scrollToTrackX = useCallback(
    (
      targetX: number,
      behavior: ScrollBehavior = "smooth",
      alignRatio = 0.5
    ) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const desiredLeft = targetX - scroller.clientWidth * alignRatio;
      const maxLeft = Math.max(0, layout.width - scroller.clientWidth);
      const clamped = Math.max(0, Math.min(maxLeft, desiredLeft));
      scroller.scrollTo({ left: clamped, behavior });
    },
    [layout.width]
  );

  const focusMilestoneInView = useCallback(
    (node: TimelineMilestoneNode) => {
      const cardCenterX = node.cardRect.x + node.cardRect.width / 2;
      scrollToTrackX(
        cardCenterX,
        prefersReducedMotion ? "auto" : "smooth",
        0.5
      );
    },
    [scrollToTrackX, prefersReducedMotion]
  );

  const connectedNodeIds = useMemo(() => {
    if (!hoveredMilestoneId) return null;
    const set = new Set<string>([hoveredMilestoneId]);
    layout.edges.forEach((edge) => {
      if (edge.sourceId === hoveredMilestoneId) set.add(edge.targetId);
      if (edge.targetId === hoveredMilestoneId) set.add(edge.sourceId);
    });
    return set;
  }, [hoveredMilestoneId, layout.edges]);

  const focusBranch = hoveredBranchId ?? activeBranchId;
  const activeFuture: TimelineFutureAnchor | null = activeBranchId
    ? layout.futureAnchors[activeBranchId]
    : null;
  const activeFutureCopy = activeBranchId
    ? copy.futureNodes[activeBranchId]
    : null;

  const toggleBranch = useCallback(
    (branchId: TimelineBranchId) => {
      const next = activeBranchId === branchId ? null : branchId;
      setActiveBranchId(next);
      if (next !== null && !isMobile) {
        const futureAnchor = layout.futureAnchors[next];
        scrollToTrackX(
          futureAnchor.x,
          prefersReducedMotion ? "auto" : "smooth",
          0.78
        );
      }
    },
    [
      activeBranchId,
      isMobile,
      layout.futureAnchors,
      prefersReducedMotion,
      scrollToTrackX,
    ]
  );

  const isEdgeHighlighted = useCallback(
    (
      sourceId: string,
      targetId: string,
      fromBranch: TimelineBranchId,
      toBranch: TimelineBranchId
    ) => {
      if (hoveredMilestoneId) {
        return sourceId === hoveredMilestoneId || targetId === hoveredMilestoneId;
      }
      if (focusBranch) {
        return fromBranch === focusBranch || toBranch === focusBranch;
      }
      return false;
    },
    [hoveredMilestoneId, focusBranch]
  );

  const isEdgeDimmed = useCallback(
    (
      sourceId: string,
      targetId: string,
      fromBranch: TimelineBranchId,
      toBranch: TimelineBranchId
    ) => {
      if (hoveredMilestoneId) {
        return sourceId !== hoveredMilestoneId && targetId !== hoveredMilestoneId;
      }
      if (focusBranch) {
        return fromBranch !== focusBranch && toBranch !== focusBranch;
      }
      return false;
    },
    [hoveredMilestoneId, focusBranch]
  );

  // Scroller click-and-drag pan handlers
  const handleScrollerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    dragPanRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: scroller.scrollLeft,
      moved: false,
    };
  };

  const handleScrollerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragPanRef.current.active) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const dx = e.clientX - dragPanRef.current.startX;
    if (Math.abs(dx) > 4) dragPanRef.current.moved = true;
    scroller.scrollLeft = dragPanRef.current.startScrollLeft - dx;
  };

  const handleScrollerPointerUp = () => {
    dragPanRef.current.active = false;
  };

  // Minimap scrub handlers
  const scrubFromClientX = useCallback(
    (clientX: number, behavior: ScrollBehavior = "auto") => {
      const bar = minimapRef.current;
      const scroller = scrollerRef.current;
      if (!bar || !scroller) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetCenterX = ratio * layout.width;
      const maxLeft = Math.max(0, layout.width - scroller.clientWidth);
      const nextLeft = Math.max(
        0,
        Math.min(maxLeft, targetCenterX - scroller.clientWidth / 2)
      );
      scroller.scrollTo({ left: nextLeft, behavior });
    },
    [layout.width]
  );

  const handleMinimapPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    minimapDragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubFromClientX(e.clientX, prefersReducedMotion ? "auto" : "smooth");
  };

  const handleMinimapPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!minimapDragRef.current) return;
    scrubFromClientX(e.clientX, "auto");
  };

  const handleMinimapPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!minimapDragRef.current) return;
    minimapDragRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Keyboard navigation across branches & milestones
  const handleStageKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && activeBranchId !== null) {
      e.preventDefault();
      setActiveBranchId(null);
      return;
    }
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    e.preventDefault();
    const visibleNodes = activeBranchId
      ? layout.nodes.filter((n) => n.branchId === activeBranchId)
      : layout.nodes;
    if (visibleNodes.length === 0) return;

    const activeElement = document.activeElement;
    const currentIdx = visibleNodes.findIndex(
      (n) => cardButtonRefs.current.get(n.id) === activeElement
    );
    const nextIdx =
      currentIdx === -1
        ? e.key === "ArrowRight"
          ? 0
          : visibleNodes.length - 1
        : Math.max(
            0,
            Math.min(
              visibleNodes.length - 1,
              currentIdx + (e.key === "ArrowRight" ? 1 : -1)
            )
          );
    const targetNode = visibleNodes[nextIdx];
    focusMilestoneInView(targetNode);
    requestAnimationFrame(() => {
      cardButtonRefs.current
        .get(targetNode.id)
        ?.focus({ preventScroll: true });
    });
  };

  if (!isMounted) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.pulseLoader} />
      </div>
    );
  }

  // ─── MOBILE LAYOUT (< 992px): Architectural unboxed vertical stream ──────────
  if (isMobile) {
    const mobileNodes = [...layout.nodes]
      .reverse()
      .filter((n) => !activeBranchId || n.branchId === activeBranchId);

    return (
      <section
        ref={sectionRef}
        className={styles.mobileSection}
        aria-label={dict.timeline.title}
      >
        <div className={styles.mobileContainer}>
          <div
            className={styles.mobileFilters}
            role="group"
            aria-label={copy.branchFilterGroupLabel}
          >
            <button
              type="button"
              className={`${styles.mobileFilterBtn} ${
                activeBranchId === null ? styles.mobileFilterBtnActive : ""
              }`}
              onClick={() => setActiveBranchId(null)}
              aria-pressed={activeBranchId === null}
            >
              {copy.allBranches}
            </button>
            {TIMELINE_BRANCH_ORDER.map((bId) => {
              const style = TIMELINE_BRANCH_STYLE[bId];
              const isSelected = activeBranchId === bId;
              return (
                <button
                  key={bId}
                  type="button"
                  className={`${styles.mobileFilterBtn} ${
                    isSelected ? styles.mobileFilterBtnActive : ""
                  }`}
                  style={
                    isSelected
                      ? {
                          borderColor: style.color,
                          color: style.inkColor,
                          backgroundColor: `${style.color}14`,
                        }
                      : undefined
                  }
                  onClick={() => toggleBranch(bId)}
                  aria-pressed={isSelected}
                >
                  <span
                    className={styles.branchDot}
                    style={{ backgroundColor: style.color }}
                  />
                  <span>{copy.branches[bId]}</span>
                </button>
              );
            })}
          </div>

          <div ref={mobileTimelineRef} className={styles.mobileTimeline}>
            <div className={styles.mobileLine} aria-hidden="true" />
            {activeFuture && activeFutureCopy && (
              <>
                <article
                  key={`mobile-future-${activeFuture.branchId}`}
                  data-future-milestone="true"
                  className={`${styles.mobileItem} ${styles.mobileItemFuture}`}
                >
                  <span
                    className={`${styles.mobileNodeDot} ${styles.mobileNodeDotFuture}`}
                    style={{
                      borderColor: activeFuture.color,
                      color: activeFuture.color,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className={`${styles.mobileLeaderTick} ${styles.mobileLeaderTickFuture}`}
                    style={{ backgroundColor: activeFuture.color }}
                    aria-hidden="true"
                  />
                  <div
                    className={`${styles.mobileAnnotation} ${styles.mobileFutureAnnotation}`}
                  >
                    <div className={styles.cardMetaRow}>
                      <span
                        className={styles.branchInlineTag}
                        style={{ color: activeFuture.inkColor }}
                      >
                        {copy.branches[activeFuture.branchId]}
                      </span>
                      <FutureMetaParticles
                        color="#64645d"
                        width={46}
                        height={13}
                        count={12}
                        seed={19}
                        reducedMotion={prefersReducedMotion}
                        className={styles.mobilePeriodParticles}
                      />
                    </div>
                    <h3 className={styles.mobileRole}>
                      {activeFutureCopy.title}
                    </h3>
                    <FutureMetaParticles
                      color={activeFuture.inkColor}
                      width={92}
                      height={13}
                      count={22}
                      seed={7}
                      reducedMotion={prefersReducedMotion}
                      className={styles.mobileCompanyParticles}
                    />
                  </div>
                </article>
                <div
                  className={styles.mobileTodayDivider}
                  data-today-divider="true"
                >
                  <span className={styles.mobileTodayLabel}>{copy.today}</span>
                  <span className={styles.mobileTodayRule} aria-hidden="true" />
                </div>
              </>
            )}
            {mobileNodes.map((node) => {
              const duration = formatPeriodDuration(
                node.period,
                currentDecimalYear,
                locale
              );
              const yearSpan = formatCompactYears(node.period, copy.today);

              return (
                <article
                  key={node.id}
                  className={`${styles.mobileItem} ${
                    activeBranchId ? styles.mobileItemReceded : ""
                  }`}
                >
                  <span
                    className={`${styles.mobileNodeDot} ${
                      node.isOrigin
                        ? styles.nodeShapeOrigin
                        : styles.nodeShapeCommit
                    }`}
                    style={{
                      borderColor: node.color,
                      color: node.color,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className={styles.mobileLeaderTick}
                    style={{ backgroundColor: node.color }}
                    aria-hidden="true"
                  />
                  <div className={styles.mobileAnnotation}>
                    <div className={styles.cardMetaRow}>
                      <span
                        className={styles.branchInlineTag}
                        style={{ color: node.inkColor }}
                      >
                        {copy.branches[node.branchId]}
                      </span>
                      <span className={styles.mobilePeriod}>
                        {yearSpan}
                        {duration ? ` · ${duration}` : ""}
                      </span>
                    </div>
                    <h3 className={styles.mobileRole}>
                      {formatMilestoneTitle(node.title)}
                    </h3>
                    {node.organization && (
                      <span
                        className={styles.cardCompany}
                        style={{ color: node.inkColor }}
                      >
                        {node.organization}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // ─── DESKTOP HORIZONTAL TIMELINE ─────────────────────────────────────────────
  const maxScroll = Math.max(1, layout.width - stageSize.width);
  const lensLeftPct = Math.max(
    0,
    Math.min(100, (scrollLeft / layout.width) * 100)
  );
  const lensWidthPct = Math.max(
    6,
    Math.min(100 - lensLeftPct, (stageSize.width / layout.width) * 100)
  );

  return (
    <section
      ref={sectionRef}
      className={styles.desktopRoot}
      aria-label={dict.timeline.title}
      onKeyDown={handleStageKeyDown}
    >
      {/* Main Stage: Clean Left Branch Labels + Horizontal Scroller */}
      <div className={styles.stageShell}>
        <aside
          className={styles.branchRail}
          aria-label={copy.branchFilterGroupLabel}
        >
          {layout.branches.map((branch) => {
            const isSelected = activeBranchId === branch.id;
            const isDimmed =
              focusBranch !== null && focusBranch !== branch.id;
            return (
              <button
                key={branch.id}
                type="button"
                className={`${styles.branchLabel} ${
                  isSelected ? styles.branchLabelActive : ""
                } ${isDimmed ? styles.branchLabelDimmed : ""}`}
                style={{
                  top: `${branch.y}px`,
                  borderColor: isSelected ? branch.color : undefined,
                  color: branch.inkColor,
                  backgroundColor: isSelected
                    ? `${branch.color}12`
                    : undefined,
                }}
                onClick={() => toggleBranch(branch.id)}
                onMouseEnter={() => setHoveredBranchId(branch.id)}
                onMouseLeave={() => setHoveredBranchId(null)}
                aria-pressed={isSelected}
              >
                <span
                  className={styles.branchDot}
                  style={{ backgroundColor: branch.color }}
                  aria-hidden="true"
                />
                <span className={styles.branchName}>
                  {copy.branches[branch.id]}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Scrollable Track Viewport */}
        <div
          ref={scrollerRef}
          className={styles.desktopScroller}
          tabIndex={0}
          role="region"
          aria-label={dict.timeline.historyLabel}
          onScroll={(e) => {
            const nextLeft = e.currentTarget.scrollLeft;
            setScrollLeft(nextLeft);
            syncRuntime(nextLeft);
          }}
          onPointerDown={handleScrollerPointerDown}
          onPointerMove={handleScrollerPointerMove}
          onPointerUp={handleScrollerPointerUp}
          onPointerCancel={handleScrollerPointerUp}
          onClick={() => {
            if (dragPanRef.current.moved) {
              dragPanRef.current.moved = false;
            }
          }}
        >
          <div
            className={styles.track}
            style={{
              width: `${layout.width}px`,
              height: `${layout.height}px`,
            }}
          >
            {/* 1:1 SVG Layer: Lane Baselines, Duration Spans, Branch Curves & Minimal Pointer Stems */}
            <svg
              className={styles.svgLayer}
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden="true"
            >
              <defs>
                <filter
                  id="timeline-edge-mask-blur"
                  x="-10%"
                  y="-10%"
                  width="120%"
                  height="120%"
                >
                  <feGaussianBlur stdDeviation="5" />
                </filter>
                <mask
                  id="timeline-edge-clear-mask"
                  maskUnits="userSpaceOnUse"
                  x={0}
                  y={0}
                  width={layout.width}
                  height={layout.height}
                >
                  <rect
                    x={0}
                    y={0}
                    width={layout.width}
                    height={layout.height}
                    fill="#ffffff"
                  />
                  <g filter="url(#timeline-edge-mask-blur)">
                    {layout.nodes.map((node) => (
                      <rect
                        key={`edge-mask-${node.id}`}
                        x={node.cardRect.x - 10}
                        y={node.cardRect.y - 6}
                        width={node.cardRect.width + 20}
                        height={node.cardRect.height + 12}
                        rx={12}
                        fill="#000000"
                      />
                    ))}
                    {activeFuture && (
                      <rect
                        key={`edge-mask-future-${activeFuture.branchId}`}
                        x={activeFuture.cardRect.x - 10}
                        y={activeFuture.cardRect.y - 6}
                        width={activeFuture.cardRect.width + 20}
                        height={activeFuture.cardRect.height + 12}
                        rx={12}
                        fill="#000000"
                      />
                    )}
                  </g>
                </mask>
              </defs>
              {/* Faint lane guide lines */}
              {layout.branches.map((branch) => {
                const isDimmed =
                  focusBranch !== null && focusBranch !== branch.id;
                const isExtendedFuture =
                  activeFuture !== null && activeFuture.branchId === branch.id;
                return (
                  <line
                    key={`lane-guide-${branch.id}`}
                    x1={24}
                    y1={branch.y}
                    x2={
                      isExtendedFuture
                        ? layout.width - 36
                        : layout.presentX + 18
                    }
                    y2={branch.y}
                    stroke={branch.color}
                    strokeWidth={1}
                    strokeDasharray="2 6"
                    opacity={isDimmed ? 0.08 : 0.22}
                  />
                );
              })}

              {/* Conditional Today temporal divider (only when a branch is actively highlighted) */}
              {activeFuture && (
                <g
                  className={styles.todaySvgGroup}
                  data-today-divider="true"
                >
                  <line
                    x1={layout.presentX}
                    y1={24}
                    x2={layout.presentX}
                    y2={layout.axisY}
                    stroke="var(--ink)"
                    strokeWidth={1.15}
                    strokeDasharray="4 5"
                    strokeOpacity={0.34}
                    mask="url(#timeline-edge-clear-mask)"
                  />
                  <text
                    x={layout.presentX}
                    y={15}
                    textAnchor="middle"
                    className={styles.todayMarkerLabel}
                  >
                    {copy.today}
                  </text>
                </g>
              )}

              {/* Proportional duration span ribbons + start ticks along the branch */}
              {layout.nodes.map((node) => {
                if (node.spanStartX === null) return null;
                const x1 = node.spanStartX;
                const x2 = node.spanEndX ?? node.x;
                const active = hoveredMilestoneId === node.id;
                const dimmed =
                  (focusBranch !== null && focusBranch !== node.branchId) ||
                  (connectedNodeIds !== null && !connectedNodeIds.has(node.id));
                return (
                  <g
                    key={`span-${node.id}`}
                    opacity={dimmed ? 0.14 : active ? 0.95 : 0.55}
                  >
                    <line
                      x1={x1}
                      y1={node.y}
                      x2={x2}
                      y2={node.y}
                      stroke={node.color}
                      strokeWidth={active ? 7 : 5}
                      strokeLinecap="round"
                      opacity={0.22}
                    />
                    <line
                      x1={x1}
                      y1={node.y}
                      x2={x2}
                      y2={node.y}
                      stroke={node.color}
                      strokeWidth={active ? 2.4 : 1.7}
                      strokeLinecap="round"
                    />
                    <line
                      x1={x1}
                      y1={node.y - 5}
                      x2={x1}
                      y2={node.y + 5}
                      stroke={node.color}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {/* Masked Group: Continuity & Cross-branch Curves softly avoid milestone text */}
              <g mask="url(#timeline-edge-clear-mask)">
                {layout.edges.map((edge) => {
                  const highlighted = isEdgeHighlighted(
                    edge.sourceId,
                    edge.targetId,
                    edge.fromBranchId,
                    edge.toBranchId
                  );
                  const dimmed = isEdgeDimmed(
                    edge.sourceId,
                    edge.targetId,
                    edge.fromBranchId,
                    edge.toBranchId
                  );

                  return (
                    <path
                      key={edge.id}
                      d={edge.path}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={highlighted ? 2.1 : 1.5}
                      strokeDasharray={edge.kind === "merge" ? "5 4" : undefined}
                      strokeLinecap="round"
                      opacity={dimmed ? 0.1 : highlighted ? 0.9 : 0.3}
                      className={styles.edgePath}
                    />
                  );
                })}
              </g>

              {/* Minimal Diagonal Pointer Stems connecting branch nodes to borderless annotations */}
              {layout.nodes.map((node) => {
                const isHovered = hoveredMilestoneId === node.id;
                const isOutOfFocus =
                  activeBranchId !== null && node.branchId !== activeBranchId;
                const dimmed =
                  isOutOfFocus ||
                  (focusBranch !== null && focusBranch !== node.branchId) ||
                  (connectedNodeIds !== null && !connectedNodeIds.has(node.id));
                const { anchorX, anchorY } = getAnnotationGeometry(node);

                return (
                  <g
                    key={`callout-${node.id}`}
                    className={styles.calloutSvgGroup}
                    opacity={
                      isOutOfFocus ? 0.1 : dimmed ? 0.16 : isHovered ? 0.96 : 0.65
                    }
                  >
                    <line
                      x1={node.x}
                      y1={node.y}
                      x2={anchorX}
                      y2={anchorY}
                      stroke={node.color}
                      strokeWidth={isHovered ? 1.5 : 1}
                    />
                    <circle
                      cx={anchorX}
                      cy={anchorY}
                      r={isHovered ? 2.1 : 1.65}
                      fill={node.color}
                    />
                  </g>
                );
              })}

              {/* Future Horizon Speculative Projection + Pointer Stem */}
              {activeFuture &&
                (() => {
                  const { anchorX, anchorY } = getAnnotationGeometry(activeFuture);
                  return (
                    <g className={styles.futureSvgGroup}>
                      <line
                        x1={activeFuture.fromX}
                        y1={activeFuture.y}
                        x2={activeFuture.x}
                        y2={activeFuture.y}
                        stroke={activeFuture.color}
                        strokeWidth={1.65}
                        strokeDasharray="5 5"
                        strokeOpacity={0.62}
                        strokeLinecap="round"
                        mask="url(#timeline-edge-clear-mask)"
                      />
                      <line
                        x1={activeFuture.x}
                        y1={activeFuture.y}
                        x2={anchorX}
                        y2={anchorY}
                        stroke={activeFuture.color}
                        strokeWidth={1.1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.58}
                      />
                      <circle
                        cx={anchorX}
                        cy={anchorY}
                        r={2}
                        fill="var(--bg)"
                        stroke={activeFuture.color}
                        strokeWidth={1.15}
                        strokeOpacity={0.72}
                      />
                    </g>
                  );
                })()}
            </svg>

            {/* Milestones & Open Architectural Canvas Annotations */}
            {layout.nodes.map((node) => {
              const isHovered = hoveredMilestoneId === node.id;
              const isOutOfFocus =
                activeBranchId !== null && node.branchId !== activeBranchId;
              const isPastReceded =
                activeBranchId !== null &&
                node.branchId === activeBranchId &&
                !isHovered;
              const isDimmed =
                !isOutOfFocus &&
                ((focusBranch !== null && focusBranch !== node.branchId) ||
                  (connectedNodeIds !== null && !connectedNodeIds.has(node.id)));
              const isAbove = node.cardPlacement === "above";

              const duration =
                formatPeriodDuration(node.period, currentDecimalYear, locale) ??
                node.period;

              const depthClass = isOutOfFocus
                ? styles.milestoneOutOfFocus
                : isPastReceded
                  ? styles.milestonePastReceded
                  : "";

              return (
                <div
                  key={node.id}
                  className={`${styles.milestoneGroup} ${
                    isDimmed ? styles.milestoneDimmed : ""
                  }`}
                  style={{
                    zIndex: isHovered ? 24 : 12,
                  }}
                  onMouseEnter={() => setHoveredMilestoneId(node.id)}
                  onMouseLeave={() => setHoveredMilestoneId(null)}
                >
                  {/* Visual Node Marker on the Branch Lane */}
                  <span
                    className={`${styles.nodeMarker} ${
                      node.isOrigin
                        ? styles.nodeShapeOrigin
                        : styles.nodeShapeCommit
                    } ${isHovered ? styles.nodeMarkerActive : ""} ${depthClass}`}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      borderColor: node.color,
                      color: node.color,
                    }}
                    onClick={() => focusMilestoneInView(node)}
                    aria-hidden="true"
                  >
                    <span
                      className={styles.nodeInnerCore}
                      style={{ backgroundColor: node.color }}
                    />
                  </span>

                  {/* Open Boxless Editorial Annotation anchored directly on the SVG shelf */}
                  <button
                    ref={(el) => {
                      if (el) {
                        cardButtonRefs.current.set(node.id, el);
                      } else {
                        cardButtonRefs.current.delete(node.id);
                      }
                    }}
                    type="button"
                    data-milestone-card="true"
                    className={`${styles.milestoneAnnotation} ${
                      isAbove ? styles.annotationAbove : styles.annotationBelow
                    } ${depthClass}`}
                    style={{
                      left: `${node.cardRect.x}px`,
                      top: `${node.cardRect.y}px`,
                      width: `${node.cardRect.width}px`,
                      height: `${node.cardRect.height}px`,
                    }}
                    onClick={() => focusMilestoneInView(node)}
                    aria-label={`${node.title}${
                      node.organization ? ` — ${node.organization}` : ""
                    } (${duration})`}
                  >
                    <div className={styles.cardMetaRow}>
                      <span
                        className={styles.cardCompany}
                        style={{ color: node.inkColor }}
                      >
                        {node.organization || copy.branches[node.branchId]}
                      </span>
                      <span className={styles.metaSep} aria-hidden="true">
                        ·
                      </span>
                      <span className={styles.periodBadge}>{duration}</span>
                    </div>

                    <h3 className={styles.cardTitle}>
                      {formatMilestoneTitle(node.title)}
                    </h3>
                  </button>
                </div>
              );
            })}

            {/* Speculative Future Milestone (visible only when a branch is actively highlighted) */}
            {activeFuture && activeFutureCopy && (
              <div
                key={`future-${activeFuture.branchId}`}
                className={`${styles.milestoneGroup} ${styles.futureMilestoneGroup}`}
                style={{ zIndex: 20 }}
              >
                <span
                  className={`${styles.nodeMarker} ${styles.nodeShapeCommit} ${styles.nodeMarkerFuture}`}
                  style={{
                    left: `${activeFuture.x}px`,
                    top: `${activeFuture.y}px`,
                    borderColor: activeFuture.color,
                    color: activeFuture.color,
                  }}
                  onClick={() =>
                    scrollToTrackX(
                      activeFuture.x,
                      prefersReducedMotion ? "auto" : "smooth",
                      0.65
                    )
                  }
                  aria-hidden="true"
                >
                  <span
                    className={styles.nodeInnerCoreFuture}
                    style={{ backgroundColor: activeFuture.color }}
                  />
                </span>

                <button
                  type="button"
                  data-future-milestone="true"
                  className={`${styles.milestoneAnnotation} ${
                    styles.futureAnnotation
                  } ${
                    activeFuture.cardPlacement === "above"
                      ? styles.annotationAbove
                      : styles.annotationBelow
                  }`}
                  style={{
                    left: `${activeFuture.cardRect.x}px`,
                    top: `${activeFuture.cardRect.y}px`,
                    width: `${activeFuture.cardRect.width}px`,
                    height: `${activeFuture.cardRect.height}px`,
                  }}
                  onClick={() =>
                    scrollToTrackX(
                      activeFuture.x,
                      prefersReducedMotion ? "auto" : "smooth",
                      0.65
                    )
                  }
                  aria-label={`${copy.branches[activeFuture.branchId]} — ${activeFutureCopy.title}`}
                >
                  <div className={styles.cardMetaRow}>
                    <FutureMetaParticles
                      color={activeFuture.inkColor}
                      width={86}
                      height={13}
                      count={22}
                      seed={11}
                      reducedMotion={prefersReducedMotion}
                    />
                    <span className={styles.metaSep} aria-hidden="true">
                      ·
                    </span>
                    <FutureMetaParticles
                      color="#64645d"
                      width={42}
                      height={13}
                      count={11}
                      seed={23}
                      reducedMotion={prefersReducedMotion}
                    />
                  </div>
                  <h3 className={styles.cardTitle}>
                    {activeFutureCopy.title}
                  </h3>
                </button>
              </div>
            )}

            {/* Time Axis at Stage Bottom */}
            <div
              className={styles.axisLine}
              style={{ top: `${layout.axisY}px` }}
              aria-hidden="true"
            />
            {layout.ticks.map((tick) => (
              <div
                key={tick.year}
                className={styles.axisTick}
                style={{ left: `${tick.x}px`, top: `${layout.axisY}px` }}
                aria-hidden="true"
              >
                <span className={styles.tickMark} />
                <span className={styles.tickYear}>{tick.year}</span>
                <span className={styles.tickAge}>
                  {tick.isFirstYear ? `${tick.age} ${copy.ageUnit}` : tick.age}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Compact Horizontal Strip (Minimap Scrubber + Quick Jumps) */}
      <div className={styles.bottomStrip}>
        <button
          type="button"
          className={styles.jumpBtn}
          onClick={() =>
            scrollToTrackX(
              layout.startX,
              prefersReducedMotion ? "auto" : "smooth",
              0.12
            )
          }
          disabled={scrollLeft <= 12}
        >
          ← {layout.minYear}
        </button>

        <div
          ref={minimapRef}
          className={styles.minimapTrack}
          role="group"
          aria-label={copy.minimapLabel}
          onPointerDown={handleMinimapPointerDown}
          onPointerMove={handleMinimapPointerMove}
          onPointerUp={handleMinimapPointerUp}
          onPointerCancel={handleMinimapPointerUp}
        >
          {/* 3 mini horizontal branch rails */}
          {layout.branches.map((branch, idx) => {
            const topPct = 24 + idx * 26;
            const dimmed = focusBranch !== null && focusBranch !== branch.id;
            return (
              <span
                key={`mini-line-${branch.id}`}
                className={styles.minimapLane}
                style={{
                  top: `${topPct}%`,
                  backgroundColor: branch.color,
                  opacity: dimmed ? 0.14 : 0.32,
                }}
                aria-hidden="true"
              />
            );
          })}

          {/* Interactive viewport lens */}
          <span
            className={styles.minimapLens}
            style={{
              left: `${lensLeftPct}%`,
              width: `${lensWidthPct}%`,
            }}
            aria-hidden="true"
          />

          {activeFuture && (
            <>
              <span
                className={styles.minimapTodayLine}
                style={{
                  left: `${(layout.presentX / layout.width) * 100}%`,
                }}
                aria-hidden="true"
              />
              <span
                className={styles.minimapFutureDot}
                style={{
                  left: `${(activeFuture.x / layout.width) * 100}%`,
                  top: `${
                    24 + TIMELINE_BRANCH_ORDER.indexOf(activeFuture.branchId) * 26
                  }%`,
                  borderColor: activeFuture.color,
                }}
                aria-hidden="true"
              />
            </>
          )}

          {/* Milestone dots on the minimap */}
          {layout.nodes.map((node) => {
            const branchIdx = TIMELINE_BRANCH_ORDER.indexOf(node.branchId);
            const topPct = 24 + branchIdx * 26;
            const leftPct = (node.x / layout.width) * 100;
            const isHovered = hoveredMilestoneId === node.id;
            const dimmed = focusBranch !== null && focusBranch !== node.branchId;

            return (
              <button
                key={`mini-dot-${node.id}`}
                type="button"
                className={`${styles.minimapDot} ${
                  isHovered ? styles.minimapDotActive : ""
                }`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  backgroundColor: node.color,
                  opacity: dimmed ? 0.22 : 1,
                }}
                title={`${node.title} (${
                  formatPeriodDuration(node.period, currentDecimalYear, locale) ??
                  node.period
                })`}
                aria-label={`${node.title} (${
                  formatPeriodDuration(node.period, currentDecimalYear, locale) ??
                  node.period
                })`}
                onClick={(e) => {
                  e.stopPropagation();
                  focusMilestoneInView(node);
                }}
              />
            );
          })}
        </div>

        <button
          type="button"
          className={styles.jumpBtn}
          onClick={() =>
            scrollToTrackX(
              layout.presentX,
              prefersReducedMotion ? "auto" : "smooth",
              0.75
            )
          }
          disabled={scrollLeft >= maxScroll - 12}
        >
          {currentYear} →
        </button>
      </div>
    </section>
  );
}
