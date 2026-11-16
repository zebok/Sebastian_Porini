"use client";

import { useEffect, useRef } from "react";
import { useSPA, SectionType } from "../layout/SPAContext";
import type { BrainConceptViewModel } from "@/types/brain";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import {
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
  type BrainBounds,
  type BrainConnectionSignal,
  type BrainFiring,
  type BrainRendererNode,
} from "./renderers/BrainParticleRenderer";
import type { BrainRuntime } from "../visualizations/BrainGraph.runtime";
import {
  getNetworkRenderPolicy,
  NETWORK_MAX_PARTICLE_COUNT,
} from "./InteractiveNetwork.config";
import type { TimelineRuntime } from "../visualizations/Timeline.runtime";
import {
  drawTimelineParticles,
  getTimelineGroupColor,
  setTimelineParticleTargets,
} from "./renderers/TimelineParticleRenderer";
import type { ProjectsRuntime } from "../visualizations/Projects.runtime";
import {
  drawProjectsParticles,
  getProjectsGroupColor,
  setProjectsParticleTargets,
} from "./renderers/ProjectsParticleRenderer";
import {
  drawVennParticles,
  setVennParticleTargets,
  updateVennCircleGeometry,
  VENN_COLORS,
  type VennCircleState,
} from "./renderers/VennParticleRenderer";

interface NetworkNode extends BrainRendererNode {
  vx: number;
  vy: number;
  group: number; // Venn group (0, 1, 2)
  r: number;
  g: number;
  b: number;
  color: string;
  radiusMultiplier: number;
}

interface InteractiveNetworkProps {
  activeSection: SectionType;
  brainConcepts: BrainConceptViewModel[];
  brainRuntime: BrainRuntime;
  timelineRuntime: TimelineRuntime;
  projectsRuntime: ProjectsRuntime;
}

const THEME_COLORS = {
  accent: { r: 45, g: 91, b: 227 }, // Royal Blue (--accent)
  accent2: { r: 124, g: 58, b: 237 }, // Purple (--accent-2)
  accent3: { r: 5, g: 150, b: 105 }, // Green (--accent-3)
};

const getRGBA = (color: { r: number; g: number; b: number }, alpha: number) => {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(
    color.b
  )}, ${alpha})`;
};

const getGroupColor = (
  group: number,
  section?: SectionType,
  projectsRuntime?: ProjectsRuntime
) => {
  if (section === "timeline") {
    return getTimelineGroupColor(group);
  }
  if (section === "projects") {
    return getProjectsGroupColor(group, projectsRuntime);
  }
  if (group === 0) return THEME_COLORS.accent;
  if (group === 1) return THEME_COLORS.accent2;
  return THEME_COLORS.accent3;
};

export default function InteractiveNetwork({
  activeSection,
  brainConcepts,
  brainRuntime,
  timelineRuntime,
  projectsRuntime,
}: InteractiveNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spa = useSPA();
  const spaRef = useRef(spa);
  const prefersReducedMotion = useReducedMotionPreference();
  spaRef.current = spa;

  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const nodesRef = useRef<NetworkNode[]>([]);
  const sectionRef = useRef<SectionType>("about");
  const firingsRef = useRef<BrainFiring[]>([]);
  const brainSignalsRef = useRef<BrainConnectionSignal[]>([]);

  const vennCirclesRef = useRef<VennCircleState[]>([
    {
      x: 0,
      y: 0,
      r: 140,
      tx: 0,
      ty: 0,
      tr: 140,
      color: VENN_COLORS[0],
    },
    {
      x: 0,
      y: 0,
      r: 140,
      tx: 0,
      ty: 0,
      tr: 140,
      color: VENN_COLORS[1],
    },
    {
      x: 0,
      y: 0,
      r: 140,
      tx: 0,
      ty: 0,
      tr: 140,
      color: VENN_COLORS[2],
    },
  ]);

  const brainBoundsRef = useRef<BrainBounds>({
    x: 0,
    y: 0,
    width: 610,
    height: 610,
    centerX: 305,
    centerY: 305,
    halfWidth: 280,
    halfHeight: 280,
  });

  useEffect(() => {
    sectionRef.current = activeSection;
    brainRuntime.requestRenderRef.current();
  }, [activeSection, brainRuntime]);

  useEffect(() => {
    brainRuntime.requestRenderRef.current();
  }, [brainRuntime, spa]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number | null = null;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let renderPolicy = getNetworkRenderPolicy(
      viewportWidth,
      prefersReducedMotion
    );
    const brainBlueprint = createBrainBlueprint(NETWORK_MAX_PARTICLE_COUNT);
    const conceptProtagonistIds = new Set(
      brainConcepts.map((concept) => concept.visual.protagonistId)
    );
    if (!renderPolicy.animateContinuously) {
      firingsRef.current = [];
      brainSignalsRef.current = [];
    }

    const resizeCanvas = () => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(viewportWidth * pixelRatio);
      canvas.height = Math.round(viewportHeight * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      renderPolicy = getNetworkRenderPolicy(
        viewportWidth,
        prefersReducedMotion
      );

      const w = viewportWidth;
      const h = viewportHeight;

      const brainAnchor = brainRuntime.particleAnchorRef.current;
      brainBoundsRef.current = getBrainBounds(brainAnchor, w, h);

      const currentSpa = spaRef.current;
      updateVennCircleGeometry(
        vennCirclesRef.current,
        w,
        h,
        currentSpa?.selectedVennCircle ?? null,
        currentSpa?.hoveredVennCircle ?? null,
        false
      );

      reconcileNodes(renderPolicy.particleCount, w, h);
      requestRender();
    };

    const reconcileNodes = (
      particleCount: number,
      width: number,
      height: number
    ) => {
      const nodes = nodesRef.current.slice(0, particleCount);

      for (let i = nodes.length; i < particleCount; i++) {
        let group = 0;
        if (i >= 66 && i < 132) group = 1;
        else if (i >= 132 && i < 200) group = 2;
        else if (i >= 200) group = (i - 200) % 3;

        const brainPoint = brainBlueprint[i];
        const initColor = getGroupColor(
          group,
          sectionRef.current,
          projectsRuntime
        );

        nodes.push({
          id: i,
          x: Math.random() * width,
          y: Math.random() * height,
          vx: 0,
          vy: 0,
          tx: width / 2,
          ty: height / 2,
          baseRadius:
            i < 200
              ? Math.random() * 2 + 1.2
              : Math.random() * 1.35 + 0.72,
          group,
          r: initColor.r,
          g: initColor.g,
          b: initColor.b,
          color: getRGBA(initColor, 0.4),
          angleOffset: Math.random() * Math.PI * 2,
          radiusMultiplier: 0.15 + 0.72 * Math.sqrt(Math.random()),
          brainX: brainPoint.x,
          brainY: brainPoint.y,
          brainRole: brainPoint.role,
          brainSide: brainPoint.side,
          brainTrack: brainPoint.track,
          brainSkill: brainPoint.skill,
          brainSubIndex: brainPoint.subIndex ?? -1,
          pulse: 0,
        });
      }
      nodesRef.current = nodes;
      updateTargets(width, height, 0);
    };

    const updateTargets = (w: number, h: number, frameCount: number) => {
      const nodes = nodesRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const section = sectionRef.current;

      switch (section) {
        case "about": {
          const currentSpa = spaRef.current;
          const selectedIdx = currentSpa?.selectedVennCircle ?? null;
          const hoveredIdx = currentSpa?.hoveredVennCircle ?? null;

          updateVennCircleGeometry(
            vennCirclesRef.current,
            w,
            h,
            selectedIdx,
            hoveredIdx,
            renderPolicy.animateContinuously
          );

          setVennParticleTargets(
            nodes,
            vennCirclesRef.current,
            selectedIdx,
            hoveredIdx,
            frameCount
          );
          break;
        }
        case "skills": {
          const brainAnchor = brainRuntime.particleAnchorRef.current;
          const brainState = brainRuntime.stateRef.current;
          const brainBounds = getBrainBounds(brainAnchor, w, h);
          brainBoundsRef.current = brainBounds;
          setBrainTargets(
            nodes,
            brainBounds,
            frameCount,
            brainState.focusSkillId,
            brainState.selectedSkillIds,
            brainState.pinned
          );
          break;
        }
        case "timeline": {
          setTimelineParticleTargets(nodes, w, h, frameCount, timelineRuntime);
          break;
        }
        case "projects": {
          setProjectsParticleTargets(nodes, w, h, frameCount, projectsRuntime);
          break;
        }
        default:
          nodes.forEach((node) => {
            node.tx = cx;
            node.ty = cy;
          });
      }
    };

    let frameCount = 0;

    const drawNetwork = () => {
      frameCount = renderPolicy.animateContinuously ? frameCount + 1 : 0;
      const w = viewportWidth;
      const h = viewportHeight;
      const nodes = nodesRef.current;
      const mouse = mouseRef.current;
      const section = sectionRef.current;
      const coreNeurons =
        section === "skills"
          ? nodes.filter(
              (node) =>
                node.brainRole === "neuron" &&
                node.brainSkill !== null &&
                node.brainSubIndex === 0 &&
                conceptProtagonistIds.has(node.brainSkill)
            )
          : [];

      ctx.clearRect(0, 0, w, h);

      // Recalculate targets on EVERY frame for fluid morphs
      updateTargets(w, h, frameCount);

      const brainBounds = brainBoundsRef.current;
      const brainState = brainRuntime.stateRef.current;
      const brainFocus = brainState.focusSide;
      const brainSkill = brainState.focusSkillId;
      const brainConcept = brainState.activeConceptId;
      const brainCandidate = brainState.candidateConceptId;
      const brainProximity = brainState.conceptProximity;
      const brainPinned = brainState.pinned;
      const brainSelectedSkills = brainState.selectedSkillIds;
      const brainRelatedGroups = brainState.relatedSkillGroups;
      const brainSubIndex = brainState.focusSubIndex;
      const brainFocusProgress = brainState.focusProgress;
      const brainIntroIntensity = brainState.introIntensity;
      const brainIntroCoreSkillIds = brainState.introCoreSkillIds;

      const currentSpa = spaRef.current;
      const selectedCircleIdx = currentSpa?.selectedVennCircle ?? null;
      const hoveredCircleIdx = currentSpa?.hoveredVennCircle ?? null;

      const driftSpeed = 0.0015;
      const globalDriftX =
        selectedCircleIdx !== null
          ? 0
          : Math.sin(frameCount * driftSpeed) * 3.5;
      const globalDriftY =
        selectedCircleIdx !== null
          ? 0
          : Math.cos(frameCount * driftSpeed * 0.8) * 3.5;

      // Update positions and smooth RGB transitions
      nodes.forEach((node) => {
        const targetColor = getGroupColor(
          node.group,
          section,
          projectsRuntime
        );
        if (!renderPolicy.animateContinuously) {
          node.x = node.tx;
          node.y = node.ty;
          node.r = targetColor.r;
          node.g = targetColor.g;
          node.b = targetColor.b;
          return;
        }

        node.r += (targetColor.r - node.r) * 0.07;
        node.g += (targetColor.g - node.g) * 0.07;
        node.b += (targetColor.b - node.b) * 0.07;

        const isBrainStructural =
          section === "skills" &&
          (node.brainRole === "boundary" ||
            node.brainRole === "fissure" ||
            node.brainRole === "gyrus" ||
            node.brainRole === "sulcus" ||
            node.brainRole === "fill");

        if (isBrainStructural) {
          node.x += (node.tx - node.x) * 0.035;
          node.y += (node.ty - node.y) * 0.035;
        } else if (section === "timeline") {
          const time = frameCount * 0.008 + node.id;
          const targetX = node.tx + Math.sin(time) * 1.4;
          const targetY = node.ty + Math.cos(time * 0.8) * 1.4;

          if (
            Math.abs(targetX - node.x) > w * 0.6 &&
            Math.abs(targetY - node.y) < 48
          ) {
            node.x = targetX;
          } else {
            node.x += (targetX - node.x) * 0.085;
          }
          node.y += (targetY - node.y) * 0.085;

          if (mouse.active) {
            const dx = mouse.x - node.x;
            const dy = mouse.y - node.y;
            const dist = Math.hypot(dx, dy);
            const limitDist = 64;
            if (dist > 0.001 && dist < limitDist) {
              const force = (limitDist - dist) / limitDist;
              node.x -= dx * force * 0.04;
              node.y -= dy * force * 0.04;
            }
          }
        } else if (section === "projects" || section === "about") {
          const lerpSpeed = section === "about" ? 0.085 : 0.08;
          node.x += (node.tx - node.x) * lerpSpeed;
          node.y += (node.ty - node.y) * lerpSpeed;

          if (mouse.active) {
            const dx = mouse.x - node.x;
            const dy = mouse.y - node.y;
            const dist = Math.hypot(dx, dy);
            const limitDist = 58;
            if (dist > 0.001 && dist < limitDist) {
              const force = (limitDist - dist) / limitDist;
              node.x -= dx * force * 0.035;
              node.y -= dy * force * 0.035;
            }
          }
        } else {
          const time = frameCount * 0.008 + node.id;
          const driftAmount = 0.34;
          const driftX = Math.sin(time) * driftAmount;
          const driftY = Math.cos(time * 0.8) * driftAmount;

          const targetX = node.tx + driftX;
          const targetY = node.ty + driftY;

          node.x += (targetX - node.x) * 0.035;
          node.y += (targetY - node.y) * 0.035;

          if (
            section === "skills" &&
            node.brainRole === "neuron" &&
            node.brainSkill === null
          ) {
            const repulsionRadius = Math.max(
              24,
              Math.min(brainBounds.width, brainBounds.height) * 0.042
            );

            coreNeurons.forEach((core) => {
              let deltaX = node.x - core.x;
              let deltaY = node.y - core.y;
              let distance = Math.hypot(deltaX, deltaY);
              if (distance >= repulsionRadius) return;

              if (distance < 0.001) {
                const angle = (node.id - core.id) * 1.618;
                deltaX = Math.cos(angle);
                deltaY = Math.sin(angle);
                distance = 1;
              }

              const force = (repulsionRadius - distance) * 0.18;
              node.x += (deltaX / distance) * force;
              node.y += (deltaY / distance) * force;
            });
          }
        }
      });

      // ─── DRAW SECTION VISUALIZATIONS ──────────────────────────────────────

      if (section === "about") {
        drawVennParticles(
          ctx,
          nodes,
          vennCirclesRef.current,
          selectedCircleIdx,
          hoveredCircleIdx,
          mouse,
          globalDriftX,
          globalDriftY,
          frameCount
        );
      } else if (section === "timeline") {
        drawTimelineParticles(
          ctx,
          nodes,
          timelineRuntime,
          mouse,
          globalDriftX,
          globalDriftY
        );
      } else if (section === "projects") {
        drawProjectsParticles(
          ctx,
          nodes,
          projectsRuntime,
          mouse,
          globalDriftX,
          globalDriftY,
          frameCount
        );
      } else if (section === "skills") {
        ctx.globalAlpha = 0.62 + brainIntroIntensity * 0.38;
        drawBrainStructure(
          ctx,
          nodes,
          brainBounds,
          brainConcepts,
          brainFocus,
          brainSkill,
          brainSelectedSkills,
          brainPinned,
          frameCount
        );
        drawBrainConceptMap(
          ctx,
          nodes,
          brainBounds,
          brainConcepts,
          brainConcept,
          brainPinned,
          frameCount
        );
        ctx.save();
        traceBrainOutline(
          ctx,
          nodes.filter((node) => node.brainRole === "boundary")
        );
        ctx.clip();
        drawBrainRelationConnections(
          ctx,
          nodes,
          brainConcepts,
          brainRelatedGroups,
          brainSignalsRef.current,
          brainPinned,
          brainConcept,
          renderPolicy.animateContinuously
        );
        ctx.restore();

        if (
          brainIntroIntensity >= 1 &&
          brainIntroCoreSkillIds.size === 0 &&
          renderPolicy.animateContinuously &&
          firingsRef.current.length < 6 &&
          Math.random() < (brainPinned ? 0.018 : 0.009)
        ) {
          const selectedNeurons = nodes.filter(
            (node) =>
              node.brainRole === "neuron" &&
              node.brainSkill !== null &&
              (brainPinned || node.brainSubIndex === 0) &&
              brainSelectedSkills.has(node.brainSkill)
          );
          const neurons = selectedNeurons.length
            ? selectedNeurons
            : nodes.filter(
                (node) =>
                  node.brainRole === "neuron" &&
                  (node.brainSkill === null || node.brainSubIndex === 0)
              );
          const neuron = neurons[Math.floor(Math.random() * neurons.length)];
          if (neuron) {
            neuron.pulse = 1;
            firingsRef.current.push({
              x: neuron.x,
              y: neuron.y,
              radius: 2,
              life: 1,
              side: neuron.brainSide,
            });
          }
        }
        ctx.save();
        traceBrainOutline(
          ctx,
          nodes.filter((node) => node.brainRole === "boundary")
        );
        ctx.clip();
        drawBrainParticles(
          ctx,
          nodes,
          brainBounds,
          brainConcepts,
          brainFocus,
          brainSkill,
          brainSelectedSkills,
          brainConcept,
          brainPinned,
          brainSubIndex,
          frameCount
        );
        ctx.globalAlpha = 0.72 + brainIntroIntensity * 0.28;
        drawBrainBeacons(
          ctx,
          nodes,
          brainConcepts,
          brainCandidate,
          brainProximity,
          brainConcept,
          brainPinned,
          brainIntroCoreSkillIds,
          brainIntroIntensity,
          frameCount
        );
        if (
          renderPolicy.animateContinuously &&
          brainIntroIntensity >= 1 &&
          brainIntroCoreSkillIds.size === 0
        ) {
          drawBrainFirings(ctx, firingsRef.current);
        }
        ctx.restore();
        drawBrainZoom(
          ctx,
          nodes,
          brainConcepts,
          brainRuntime.zoomAnchorRef.current,
          brainFocusProgress,
          brainConcept,
          frameCount
        );
        ctx.globalAlpha = 1;
      }
    };

    const requestRender = () => {
      if (
        document.visibilityState === "hidden" ||
        animationFrameId !== null
      ) {
        return;
      }

      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        drawNetwork();
        if (renderPolicy.animateContinuously) requestRender();
      });
    };

    const pauseNetwork = () => {
      if (animationFrameId === null) return;
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseNetwork();
        mouseRef.current.active = false;
        return;
      }

      requestRender();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
      if (
        renderPolicy.animateContinuously ||
        sectionRef.current === "about"
      ) {
        requestRender();
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      if (
        renderPolicy.animateContinuously ||
        sectionRef.current === "about"
      ) {
        requestRender();
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (sectionRef.current !== "skills") return;

      const bounds = brainBoundsRef.current;
      const normalizedX = (event.clientX - bounds.centerX) / bounds.halfWidth;
      const normalizedY = (event.clientY - bounds.centerY) / bounds.halfHeight;
      if (!isPointInBrain(normalizedX, normalizedY)) {
        return;
      }

      const neurons = nodesRef.current.filter(
        (node) => node.brainRole === "neuron"
      );
      let closest: NetworkNode | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      neurons.forEach((node) => {
        const distance = Math.hypot(
          node.x - event.clientX,
          node.y - event.clientY
        );
        if (distance < closestDistance) {
          closest = node;
          closestDistance = distance;
        }
      });

      const firingNode = closest as NetworkNode | null;
      if (firingNode && closestDistance < 105) {
        firingNode.pulse = 1;
      }

      if (renderPolicy.animateContinuously) {
        firingsRef.current.push({
          x: event.clientX,
          y: event.clientY,
          radius: 2,
          life: 1,
          side:
            firingNode && closestDistance < 105
              ? firingNode.brainSide
              : "center",
        });
      }
      requestRender();
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    brainRuntime.requestRenderRef.current = requestRender;
    timelineRuntime.requestRenderRef.current = requestRender;
    projectsRuntime.requestRenderRef.current = requestRender;

    resizeCanvas();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      pauseNetwork();
      if (brainRuntime.requestRenderRef.current === requestRender) {
        brainRuntime.requestRenderRef.current = () => undefined;
      }
      if (timelineRuntime.requestRenderRef.current === requestRender) {
        timelineRuntime.requestRenderRef.current = () => undefined;
      }
      if (projectsRuntime.requestRenderRef.current === requestRender) {
        projectsRuntime.requestRenderRef.current = () => undefined;
      }
    };
  }, [
    brainConcepts,
    brainRuntime,
    prefersReducedMotion,
    timelineRuntime,
    projectsRuntime,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        mixBlendMode: "normal",
        opacity: 0.94,
        transition: prefersReducedMotion ? "none" : "opacity 500ms ease",
      }}
    />
  );
}
