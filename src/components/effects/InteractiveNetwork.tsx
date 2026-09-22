"use client";

import { useEffect, useRef } from "react";
import { useSPA, SectionType } from "../layout/SPAContext";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
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
  renderConstructionParticles,
  setConstructionTargets,
} from "./renderers/ConstructionParticleRenderer";

interface NetworkNode extends BrainRendererNode {
  vx: number;
  vy: number;
  group: number; // Venn group (0, 1, 2)
  color: string;
  radiusMultiplier: number;
}

interface InteractiveNetworkProps {
  activeSection: SectionType;
  brainConcepts: BrainConceptViewModel[];
  brainRuntime: BrainRuntime;
  timelineRuntime: TimelineRuntime;
}

// Centralized Theme Colors config
const THEME_COLORS = {
  accent: { r: 45, g: 91, b: 227 },    // Royal Blue (--accent)
  accent2: { r: 124, g: 58, b: 237 },  // Purple (--accent-2)
  accent3: { r: 5, g: 150, b: 105 }    // Green (--accent-3)
};

const getRGBA = (color: { r: number; g: number; b: number }, alpha: number) => {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
};

const getGroupColor = (group: number) => {
  if (group === 0) return THEME_COLORS.accent;
  if (group === 1) return THEME_COLORS.accent2;
  return THEME_COLORS.accent3;
};

// ─── TARGET COORDINATES CALCULATORS ─────────────────────────────────────────

const setVennTargets = (
  nodes: NetworkNode[],
  vennCenters: { x: number; y: number; r: number }[],
  selectedCircleIdx: number | null,
  hoveredCircleIdx: number | null,
  frameCount: number
) => {
  nodes.forEach((node, i) => {
    const circleGroup = node.group;
    const circle = vennCenters[circleGroup];
    const groupLocalId = i - (circleGroup === 0 ? 0 : circleGroup === 1 ? 66 : 132);
    const isBoundary = groupLocalId < 40;

    if (selectedCircleIdx !== null) {
      if (selectedCircleIdx === circleGroup) {
        if (isBoundary) {
          const angle = (groupLocalId / 40) * Math.PI * 2 + frameCount * 0.0022;
          const wave = Math.sin(frameCount * 0.015 + groupLocalId * 0.25) * 3;
          node.tx = circle.x + Math.cos(angle) * (circle.r + wave);
          node.ty = circle.y + Math.sin(angle) * (circle.r + wave);
        } else if (groupLocalId >= 40 && groupLocalId < 44) {
          const tagIndex = groupLocalId - 40;
          const tagEl = document.getElementById(`venn-tag-${selectedCircleIdx}-${tagIndex}`);
          if (tagEl) {
            const rect = tagEl.getBoundingClientRect();
            node.tx = rect.left + rect.width / 2;
            node.ty = rect.top + rect.height / 2;
          } else {
            const angle = tagIndex < 2 ? (-Math.PI / 6 - tagIndex * (Math.PI / 1.5)) : (Math.PI / 6 + (tagIndex - 2) * (Math.PI / 1.5));
            node.tx = circle.x + Math.cos(angle) * (circle.r * 0.55);
            node.ty = circle.y + Math.sin(angle) * (circle.r * 0.55);
          }
        } else if (groupLocalId >= 44 && groupLocalId < 47) {
          const k = groupLocalId - 44;
          const titleEl = document.getElementById(`venn-title-text-${selectedCircleIdx}`);
          if (titleEl) {
            const rect = titleEl.getBoundingClientRect();
            if (k === 0) { node.tx = rect.left - 4; node.ty = rect.top + rect.height / 2; }
            else if (k === 1) { node.tx = rect.left + rect.width * 0.5; node.ty = rect.top - 2; }
            else { node.tx = rect.left + rect.width + 4; node.ty = rect.top + rect.height / 2; }
          } else {
            const tAngle = -Math.PI / 2 + (k - 1) * 0.3;
            node.tx = circle.x + Math.cos(tAngle) * (circle.r * 0.5);
            node.ty = circle.y + Math.sin(tAngle) * (circle.r * 0.5);
          }
        } else {
          const tagIndex = (groupLocalId - 47) % 4;
          const tagEl = document.getElementById(`venn-tag-${selectedCircleIdx}-${tagIndex}`);
          let tagX = circle.x, tagY = circle.y, tagW = 80, tagH = 26;
          if (tagEl) {
            const rect = tagEl.getBoundingClientRect();
            tagX = rect.left + rect.width / 2; tagY = rect.top + rect.height / 2; tagW = rect.width; tagH = rect.height;
          }
          const localAngle = node.angleOffset + frameCount * 0.01;
          node.tx = tagX + (tagW / 2 + 3 + 8 * node.radiusMultiplier) * Math.cos(localAngle) + Math.sin(frameCount * 0.005 + node.id * 0.5) * 3;
          node.ty = tagY + (tagH / 2 + 3 + 8 * node.radiusMultiplier) * Math.sin(localAngle) + Math.cos(frameCount * 0.004 + node.id * 0.7) * 3;
        }
      } else {
        const isHovered = hoveredCircleIdx === circleGroup;
        if (isBoundary) {
          const angle = (groupLocalId / 40) * Math.PI * 2 + frameCount * 0.002;
          const r = circle.r * (isHovered ? 1.15 : 1.0);
          const wave = isHovered ? Math.sin(frameCount * 0.02 + groupLocalId * 0.2) * 2.0 : 0;
          node.tx = circle.x + Math.cos(angle) * (r + wave);
          node.ty = circle.y + Math.sin(angle) * (r + wave);
        } else {
          const orbitAngle = node.angleOffset + frameCount * (isHovered ? 0.006 : 0.003);
          const baseR = isHovered ? 10 : 6;
          const varR = isHovered ? 20 : 12;
          const orbitRadius = (baseR + varR * node.radiusMultiplier) * (circle.r / 50);
          const vibration = isHovered ? Math.sin(frameCount * 0.025 + node.id * 0.5) * 1.5 : 0;
          node.tx = circle.x + Math.cos(orbitAngle) * (orbitRadius + vibration);
          node.ty = circle.y + Math.sin(orbitAngle) * (orbitRadius + vibration);
        }
      }
    } else {
      // Idle / Hover state
      let circleRadius = circle.r;
      if (hoveredCircleIdx !== null && hoveredCircleIdx === circleGroup) {
        circleRadius = circle.r * 1.08;
      }

      const isBoundary = groupLocalId < 40;
      if (isBoundary) {
        const angle = (groupLocalId / 40) * Math.PI * 2;
        const wave = Math.sin(frameCount * 0.015 + groupLocalId * 0.2) * (hoveredCircleIdx === circleGroup ? 2.5 : 1.2);
        node.tx = circle.x + Math.cos(angle) * (circleRadius + wave);
        node.ty = circle.y + Math.sin(angle) * (circleRadius + wave);
      } else {
        const isHovered = hoveredCircleIdx === circleGroup;
        const coreR = (isHovered ? 28 : 22) * node.radiusMultiplier;
        const vibration = Math.sin(frameCount * 0.02 + node.id * 0.5) * 1.5;
        const orbitAngle = node.angleOffset + frameCount * (isHovered ? 0.007 : 0.004);

        node.tx = circle.x + Math.cos(orbitAngle) * (coreR + vibration);
        node.ty = circle.y + Math.sin(orbitAngle) * (coreR + vibration);
      }
    }
  });
};

// ─── STRUCTURAL RENDERING HELPERS ───────────────────────────────────────────

const drawVennStructure = (
  ctx: CanvasRenderingContext2D,
  nodes: NetworkNode[],
  vennCenters: { x: number; y: number; r: number; color: string; hovered: boolean; active: boolean }[],
  selectedVenn: number | null,
  frameCount: number,
  globalDriftX: number,
  globalDriftY: number,
  anim: { suspensionProgress: number; spineProgress: number; tagsProgress: number }
) => {
  vennCenters.forEach((circle, groupIndex) => {
    const isSelected = selectedVenn !== null && groupIndex === selectedVenn;
    const isBackground = selectedVenn !== null && groupIndex !== selectedVenn;
    const isHovered = circle.hovered || circle.active;

    ctx.beginPath();
    const startIndex = groupIndex === 0 ? 0 : groupIndex === 1 ? 66 : 132;
    const node0 = nodes[startIndex];
    ctx.moveTo(node0.x + globalDriftX, node0.y + globalDriftY);

    for (let k = 1; k < 40; k++) {
      const node = nodes[startIndex + k];
      ctx.lineTo(node.x + globalDriftX, node.y + globalDriftY);
    }
    ctx.closePath();

    // Determine styles based on state
    let fillAlpha = 0.025;
    let strokeAlpha = 0.2;
    let lineWidth = 1.2;
    let useDash = false;

    if (selectedVenn !== null) {
      if (isSelected) {
        fillAlpha = 0.015;
        const pulse = 0.35 + 0.12 * Math.sin(frameCount * 0.04);
        strokeAlpha = pulse;
        lineWidth = 2.0;
      } else if (isBackground) {
        fillAlpha = isHovered ? 0.015 : 0;
        strokeAlpha = isHovered ? 0.22 : 0.08;
        lineWidth = isHovered ? 1.2 : 0.8;
        useDash = true;
      }
    } else {
      fillAlpha = isHovered ? 0.06 : 0.025;
      strokeAlpha = isHovered ? 0.5 : 0.2;
      lineWidth = isHovered ? 1.8 : 1.2;
    }

    if (useDash) {
      ctx.setLineDash([3, 4]);
    } else {
      ctx.setLineDash([]);
    }

    const circleColorRGB = getGroupColor(groupIndex);

    // Circle Fill
    if (fillAlpha !== 0) {
      ctx.fillStyle = getRGBA(circleColorRGB, fillAlpha);
      ctx.fill();
    }

    // Circle Stroke
    ctx.strokeStyle = getRGBA(circleColorRGB, strokeAlpha);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  });

  // Draw filaments/lines to the title and tags (Phase 1: Suspension, Phase 2: Spine, Phase 3: Tags)
  if (selectedVenn !== null && (anim.suspensionProgress > 0 || anim.spineProgress > 0 || anim.tagsProgress > 0)) {
    const groupIndex = selectedVenn;
    const startIndex = groupIndex === 0 ? 0 : groupIndex === 1 ? 66 : 132;
    const circleColorRGB = getGroupColor(groupIndex);
    const circle = vennCenters[groupIndex];

    const hubX = circle.x + globalDriftX;
    const hubY = circle.y + globalDriftY;

    // 1. Draw 3 suspension filaments drawing from border to title (Phase 1)
    if (anim.suspensionProgress > 0) {
      ctx.globalAlpha = anim.suspensionProgress;
      ctx.setLineDash([2.5, 3.5]);

      const angles = [
        -Math.PI * 0.8, // Left-top
        -Math.PI * 0.5, // Top-middle
        -Math.PI * 0.2  // Right-top
      ];

      for (let k = 0; k < 3; k++) {
        const titleNode = nodes[startIndex + 44 + k];
        if (titleNode) {
          const borderAngle = angles[k];
          const bx = circle.x + Math.cos(borderAngle) * circle.r + globalDriftX;
          const by = circle.y + Math.sin(borderAngle) * circle.r + globalDriftY;
          const tx = titleNode.x + globalDriftX;
          const ty = titleNode.y + globalDriftY;

          // Animated coordinate of line tip drawing towards title
          const endX = bx + (tx - bx) * anim.suspensionProgress;
          const endY = by + (ty - by) * anim.suspensionProgress;

          // Outer glow gradient
          const gradGlow = ctx.createLinearGradient(bx, by, endX, endY);
          gradGlow.addColorStop(0, getRGBA(circleColorRGB, 0.08));
          gradGlow.addColorStop(1, getRGBA(circleColorRGB, 0.38));

          ctx.strokeStyle = gradGlow;
          ctx.lineWidth = 4.0;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Sharp inner core gradient
          const gradCore = ctx.createLinearGradient(bx, by, endX, endY);
          gradCore.addColorStop(0, getRGBA(circleColorRGB, 0.26));
          gradCore.addColorStop(1, getRGBA(circleColorRGB, 0.95));

          ctx.strokeStyle = gradCore;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Draw a tiny glowing dot at the connection points on the text (solid dots) when line reaches it
          if (anim.suspensionProgress > 0.9) {
            const dotAlpha = (anim.suspensionProgress - 0.9) / 0.1;
            ctx.setLineDash([]);
            ctx.fillStyle = getRGBA(circleColorRGB, 0.95 * dotAlpha);
            ctx.beginPath();
            ctx.arc(tx, ty, 3.0, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([2.5, 3.5]);
          }

          // Flowing energy pulses (beads) only when line is fully drawn
          if (anim.suspensionProgress === 1.0) {
            const progress = (frameCount * 0.0055 + k * 0.33) % 1.0;
            const beadX = bx + (tx - bx) * progress;
            const beadY = by + (ty - by) * progress;

            ctx.setLineDash([]);
            ctx.fillStyle = getRGBA(circleColorRGB, 0.95);
            ctx.beginPath();
            ctx.arc(beadX, beadY, 2.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = getRGBA(circleColorRGB, 0.25);
            ctx.beginPath();
            ctx.arc(beadX, beadY, 5.0, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([2.5, 3.5]);
          }
        }
      }
    }

    // 2. Draw vertical connection line (spine) from middle title node to central hub (Phase 2)
    const titleNodeMid = nodes[startIndex + 45]; // Top/Middle title node
    if (anim.spineProgress > 0 && titleNodeMid) {
      ctx.globalAlpha = anim.spineProgress;
      ctx.setLineDash([2.5, 3.5]);

      const spineX = titleNodeMid.x + globalDriftX;
      const spineY = titleNodeMid.y + globalDriftY;

      // Draw tip of spine drawing downwards from title to hub
      const endSpineX = spineX + (hubX - spineX) * anim.spineProgress;
      const endSpineY = spineY + (hubY - spineY) * anim.spineProgress;

      // Outer glow spine
      const gradGlow = ctx.createLinearGradient(spineX, spineY, endSpineX, endSpineY);
      gradGlow.addColorStop(0, getRGBA(circleColorRGB, 0.08));
      gradGlow.addColorStop(1, getRGBA(circleColorRGB, 0.38));

      ctx.strokeStyle = gradGlow;
      ctx.lineWidth = 4.0;
      ctx.beginPath();
      ctx.moveTo(spineX, spineY);
      ctx.lineTo(endSpineX, endSpineY);
      ctx.stroke();

      // Inner core spine
      const gradCore = ctx.createLinearGradient(spineX, spineY, endSpineX, endSpineY);
      gradCore.addColorStop(0, getRGBA(circleColorRGB, 0.26));
      gradCore.addColorStop(1, getRGBA(circleColorRGB, 0.95));

      ctx.strokeStyle = gradCore;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(spineX, spineY);
      ctx.lineTo(endSpineX, endSpineY);
      ctx.stroke();

      // Draw central visible hub anchor point (fading/scaling in as spine reaches it)
      ctx.setLineDash([]);
      const pulseRadius = (4.2 + Math.sin(frameCount * 0.055) * 0.8) * anim.spineProgress;
      ctx.fillStyle = getRGBA(circleColorRGB, 0.85 * anim.spineProgress);
      ctx.beginPath();
      ctx.arc(hubX, hubY, pulseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle outer halo around the hub
      ctx.strokeStyle = getRGBA(circleColorRGB, 0.25 * anim.spineProgress);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(hubX, hubY, pulseRadius * 2.0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([2.5, 3.5]);
    }

    // 3. Draw star-pattern filaments from hub outwards to expanding tags (Phase 3)
    if (anim.tagsProgress > 0) {
      ctx.globalAlpha = anim.tagsProgress;
      ctx.setLineDash([2.5, 3.5]);

      const tagAnchorNodes = [
        nodes[startIndex + 40],
        nodes[startIndex + 41],
        nodes[startIndex + 42],
        nodes[startIndex + 43]
      ].filter(n => !!n);

      if (tagAnchorNodes.length === 4) {
        tagAnchorNodes.forEach((anchorNode, idx) => {
          const ax = anchorNode.x + globalDriftX;
          const ay = anchorNode.y + globalDriftY;

          // Outer glow gradient from hub outwards (stretches dynamically with tag positions)
          const gradGlow = ctx.createLinearGradient(hubX, hubY, ax, ay);
          gradGlow.addColorStop(0, getRGBA(circleColorRGB, 0.15));
          gradGlow.addColorStop(1, getRGBA(circleColorRGB, 0.35));

          ctx.strokeStyle = gradGlow;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(hubX, hubY);
          ctx.lineTo(ax, ay);
          ctx.stroke();

          // Sharp inner core gradient
          const gradCore = ctx.createLinearGradient(hubX, hubY, ax, ay);
          gradCore.addColorStop(0, getRGBA(circleColorRGB, 0.3));
          gradCore.addColorStop(1, getRGBA(circleColorRGB, 0.85));

          ctx.strokeStyle = gradCore;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(hubX, hubY);
          ctx.lineTo(ax, ay);
          ctx.stroke();

          // Draw a tiny dot at the tag connection point (solid dots)
          ctx.setLineDash([]);
          ctx.fillStyle = getRGBA(circleColorRGB, 0.95);
          ctx.beginPath();
          ctx.arc(ax, ay, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.setLineDash([2.5, 3.5]);

          // Draw flowing energy pulse (bead) sliding from hub to tag (only when fully emerged)
          if (anim.tagsProgress === 1.0) {
            const progress = (frameCount * 0.0045 + idx * 0.25) % 1.0;
            const beadX = hubX + (ax - hubX) * progress;
            const beadY = hubY + (ay - hubY) * progress;

            ctx.setLineDash([]);
            ctx.fillStyle = getRGBA(circleColorRGB, 0.95);
            ctx.beginPath();
            ctx.arc(beadX, beadY, 2.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.setLineDash([2.5, 3.5]);
          }
        });
      }
    }

    ctx.globalAlpha = 1.0; // Restore default alpha
  }

  ctx.setLineDash([]);
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function InteractiveNetwork({
  activeSection,
  brainConcepts,
  brainRuntime,
  timelineRuntime,
}: InteractiveNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spa = useSPA();
  const spaRef = useRef(spa);
  const prefersReducedMotion = useReducedMotionPreference();
  spaRef.current = spa;

  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const nodesRef = useRef<NetworkNode[]>([]);
  const sectionRef = useRef<SectionType>("how-am-i");
  const firingsRef = useRef<BrainFiring[]>([]);
  const brainSignalsRef = useRef<BrainConnectionSignal[]>([]);

  const vennCentersRef = useRef([
    { x: 0, y: 0, r: 130, color: getRGBA(THEME_COLORS.accent, 1), hovered: false, active: false },
    { x: 0, y: 0, r: 130, color: getRGBA(THEME_COLORS.accent2, 1), hovered: false, active: false },
    { x: 0, y: 0, r: 130, color: getRGBA(THEME_COLORS.accent3, 1), hovered: false, active: false }
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
  const animRef = useRef({
    suspensionProgress: 0,
    spineProgress: 0,
    tagsProgress: 0
  });

  const selectedVennCircle = spa ? spa.selectedVennCircle : null;
  useGSAP(
    () => {
      gsap.killTweensOf(animRef.current);

      if (prefersReducedMotion) {
        gsap.set(animRef.current, {
          suspensionProgress: selectedVennCircle === null ? 0 : 1,
          spineProgress: selectedVennCircle === null ? 0 : 1,
          tagsProgress: selectedVennCircle === null ? 0 : 1,
        });
        brainRuntime.requestRenderRef.current();
        return;
      }

      if (selectedVennCircle !== null) {
        // Zoom in: choreograph sequential reveal
        animRef.current.suspensionProgress = 0;
        animRef.current.spineProgress = 0;
        animRef.current.tagsProgress = 0;

        // Phase 1: Draw suspension lines from border to title (t=0.7s to 1.5s)
        gsap.to(animRef.current, {
          suspensionProgress: 1,
          duration: 0.8,
          delay: 0.7,
          ease: "power2.out",
          overwrite: "auto",
        });

        // Phase 2: Draw vertical spine connection from title to hub (t=1.45s to 2.1s)
        gsap.to(animRef.current, {
          spineProgress: 1,
          duration: 0.65,
          delay: 1.45,
          ease: "power1.inOut",
          overwrite: "auto",
        });

        // Phase 3: Star lines expand & tags pop out springy from hub (t=2.05s to 2.95s)
        gsap.to(animRef.current, {
          tagsProgress: 1,
          duration: 0.9,
          delay: 2.05,
          ease: "back.out(1.4)",
          overwrite: "auto",
        });
      } else {
        // Zoom out: reset all animation parameters quickly
        gsap.to(animRef.current, {
          suspensionProgress: 0,
          spineProgress: 0,
          tagsProgress: 0,
          duration: 0.25,
          ease: "power2.inOut",
          overwrite: "auto",
        });
      }

      return () => gsap.killTweensOf(animRef.current);
    },
    {
      dependencies: [brainRuntime, prefersReducedMotion, selectedVennCircle],
      revertOnUpdate: true,
    }
  );

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
      const cx = w / 2;
      const cy = h / 2;

      const brainAnchor = brainRuntime.particleAnchorRef.current;
      brainBoundsRef.current = getBrainBounds(brainAnchor, w, h);

      const vennAnchor = document.getElementById("venn-diagram-anchor");
      const vennCenters = [
        { x: cx, y: cy - 90, r: 130, color: getRGBA(THEME_COLORS.accent, 1), hovered: false, active: false },
        { x: cx - 110, y: cy + 60, r: 130, color: getRGBA(THEME_COLORS.accent2, 1), hovered: false, active: false },
        { x: cx + 110, y: cy + 60, r: 130, color: getRGBA(THEME_COLORS.accent3, 1), hovered: false, active: false }
      ];
      if (vennAnchor) {
        const rect = vennAnchor.getBoundingClientRect();
        const vCx = rect.left + rect.width / 2;
        const vCy = rect.top + rect.height / 2;

        const c0 = document.getElementById("venn-circle-0");
        const c1 = document.getElementById("venn-circle-1");
        const c2 = document.getElementById("venn-circle-2");

        if (c0 && c1 && c2) {
          const r0 = c0.getBoundingClientRect();
          const r1 = c1.getBoundingClientRect();
          const r2 = c2.getBoundingClientRect();

          vennCenters[0].x = r0.left + r0.width / 2; vennCenters[0].y = r0.top + r0.height / 2; vennCenters[0].r = r0.width / 2;
          vennCenters[1].x = r1.left + r1.width / 2; vennCenters[1].y = r1.top + r1.height / 2; vennCenters[1].r = r1.width / 2;
          vennCenters[2].x = r2.left + r2.width / 2; vennCenters[2].y = r2.top + r2.height / 2; vennCenters[2].r = r2.width / 2;
        } else {
          const scale = rect.width / 500;
          vennCenters[0].x = vCx; vennCenters[0].y = vCy - 90 * scale; vennCenters[0].r = 130 * scale;
          vennCenters[1].x = vCx - 110 * scale; vennCenters[1].y = vCy + 60 * scale; vennCenters[1].r = 130 * scale;
          vennCenters[2].x = vCx + 110 * scale; vennCenters[2].y = vCy + 60 * scale; vennCenters[2].r = 130 * scale;
        }
      }
      vennCentersRef.current = vennCenters;

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

        nodes.push({
          id: i,
          x: Math.random() * width,
          y: Math.random() * height,
          vx: 0,
          vy: 0,
          tx: width / 2,
          ty: height / 2,
          baseRadius: i < 200 ? Math.random() * 2 + 1.2 : Math.random() * 1.35 + 0.72,
          group,
          color: getRGBA(getGroupColor(group), 0.4),
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

      const vennCenters = vennCentersRef.current;

      if (section === "how-am-i") {
        const c0 = document.getElementById("venn-circle-0");
        const c1 = document.getElementById("venn-circle-1");
        const c2 = document.getElementById("venn-circle-2");
        if (c0 && c1 && c2) {
          const r0 = c0.getBoundingClientRect();
          const r1 = c1.getBoundingClientRect();
          const r2 = c2.getBoundingClientRect();
          vennCenters[0].x = r0.left + r0.width / 2; vennCenters[0].y = r0.top + r0.height / 2; vennCenters[0].r = r0.width / 2;
          vennCenters[1].x = r1.left + r1.width / 2; vennCenters[1].y = r1.top + r1.height / 2; vennCenters[1].r = r1.width / 2;
          vennCenters[2].x = r2.left + r2.width / 2; vennCenters[2].y = r2.top + r2.height / 2; vennCenters[2].r = r2.width / 2;
        }
      }

      switch (section) {
        case "how-am-i": {
          const currentSpa = spaRef.current;
          setVennTargets(
            nodes,
            vennCenters,
            currentSpa?.selectedVennCircle ?? null,
            currentSpa?.hoveredVennCircle ?? null,
            frameCount
          );
          break;
        }
        case "skills":
          {
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
          }
          break;
        case "timeline":
        case "projects": {
          const currentSpa = spaRef.current;
          const mode = currentSpa?.constructionMode ?? "lemniscate";
          setConstructionTargets(nodes, w, h, cx, cy, mode, frameCount, mouseRef.current);
          break;
        }
        default:
          nodes.forEach(node => {
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

      if (section === "timeline" || section === "projects") {
        updateTargets(w, h, frameCount);
        nodes.forEach((node) => {
          if (!renderPolicy.animateContinuously) {
            node.x = node.tx;
            node.y = node.ty;
            return;
          }
          node.x += (node.tx - node.x) * 0.045;
          node.y += (node.ty - node.y) * 0.045;
        });
        const currentSpa = spaRef.current;
        const mode = currentSpa?.constructionMode ?? "lemniscate";
        renderConstructionParticles(ctx, nodes, w, h, mode, frameCount);
        return;
      }



      // Recalculate targets on EVERY frame for perfect fluid morphs
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
      const vennCenters = vennCentersRef.current;
      const currentSpa = spaRef.current;
      const selectedCircleIdx = currentSpa?.selectedVennCircle ?? null;

      if (currentSpa) {
        vennCenters[0].hovered = currentSpa.hoveredVennCircle === 0;
        vennCenters[1].hovered = currentSpa.hoveredVennCircle === 1;
        vennCenters[2].hovered = currentSpa.hoveredVennCircle === 2;

        vennCenters[0].active = currentSpa.activeVennCircles.includes(0);
        vennCenters[1].active = currentSpa.activeVennCircles.includes(1);
        vennCenters[2].active = currentSpa.activeVennCircles.includes(2);
      }

      const driftSpeed = 0.0015;
      const globalDriftX =
        selectedCircleIdx !== null
          ? 0
          : Math.sin(frameCount * driftSpeed) * 4;
      const globalDriftY =
        selectedCircleIdx !== null
          ? 0
          : Math.cos(frameCount * driftSpeed * 0.8) * 4;

      // Update positions
      nodes.forEach((node, i) => {
        if (!renderPolicy.animateContinuously) {
          node.x = node.tx;
          node.y = node.ty;
          return;
        }

        const circleGroup = node.group;
        const startIdx = circleGroup === 0 ? 0 : circleGroup === 1 ? 66 : 132;
        const groupLocal = i - startIdx;
        const isAnchorNode = section === "how-am-i" && selectedCircleIdx !== null && circleGroup === selectedCircleIdx && groupLocal >= 40 && groupLocal < 47;

        let isStructural = false;
        if (section === "how-am-i") {
          isStructural = groupLocal < 40;
        } else if (section === "skills") {
          isStructural =
            node.brainRole === "boundary" ||
            node.brainRole === "fissure" ||
            node.brainRole === "gyrus" ||
            node.brainRole === "sulcus" ||
            node.brainRole === "fill";
        }

        if (isAnchorNode) {
          node.x = node.tx;
          node.y = node.ty;
        } else if (isStructural) {
          node.x += (node.tx - node.x) * 0.035;
          node.y += (node.ty - node.y) * 0.035;
        } else {
          const time = frameCount * 0.008 + node.id;
          const driftAmount = section === "skills" ? 0.34 : 2;
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

          if (section === "how-am-i" && selectedCircleIdx === null) {
            const circle = vennCenters[node.group];
            const dx = node.x - circle.x;
            const dy = node.y - circle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > circle.r - 12) {
              node.x = circle.x + (dx * (circle.r - 15)) / dist;
              node.y = circle.y + (dy * (circle.r - 15)) / dist;
            }
          }

          const isTitleAnchor = section === "how-am-i" && selectedCircleIdx !== null && node.group === selectedCircleIdx && groupLocal >= 44 && groupLocal < 47;

          if (mouse.active && !isTitleAnchor && section !== "skills") {
            const dx = mouse.x - node.x;
            const dy = mouse.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const limitDist = 60;
            if (dist < limitDist) {
              const force = (limitDist - dist) / limitDist;
              node.x -= dx * force * 0.04;
              node.y -= dy * force * 0.04;
            }
          }
        }
      });

      // ─── DRAW STRUCTURES ──────────────────────────────────────────────────

      if (section === "skills") {
        ctx.globalAlpha = 0.62 + brainIntroIntensity * 0.38;
      }

      if (section === "how-am-i") {
        drawVennStructure(ctx, nodes, vennCenters, selectedCircleIdx, frameCount, globalDriftX, globalDriftY, animRef.current);
      } else if (section === "skills") {
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
      }

      // ─── GENERAL CONNECTIONS ──────────────────────────────────────────────

      const selectedSet = currentSpa?.selectedVennCircle ?? null;
      const connectionDist = (section === "how-am-i" && selectedSet !== null) ? (w < 768 ? 130 : 170) : (w < 768 ? 85 : 120);
      const connectionNodeCount =
        section === "skills" ? 0 : Math.min(nodes.length, 200);
      ctx.lineWidth = selectedSet !== null ? 0.75 : 0.5;

      for (let i = 0; i < connectionNodeCount; i++) {
        for (let j = i + 1; j < connectionNodeCount; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];

          // Skip drawing connection lines between boundary nodes ONLY when in idle 3-circle Venn state
          if (section === "how-am-i" && selectedSet === null && i < 200 && j < 200 && n1.group === n2.group) {
            const groupIndex = n1.group;
            const startIdx = groupIndex === 0 ? 0 : groupIndex === 1 ? 66 : 132;
            const groupLocal1 = i - startIdx;
            const groupLocal2 = j - startIdx;
            if (groupLocal1 >= 0 && groupLocal1 < 40 && groupLocal2 >= 0 && groupLocal2 < 40) continue;
          }

          // FIX: Skip cross-group connection lines in selected mode to avoid visual clutter
          if (section === "how-am-i" && selectedSet !== null && n1.group !== n2.group) {
            continue;
          }

          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const baseAlpha = (1 - dist / connectionDist) * 0.08;
            let alpha = baseAlpha;

            if (mouse.active) {
              const midX = (n1.x + n2.x) / 2;
              const midY = (n1.y + n2.y) / 2;
              const mDx = mouse.x - midX;
              const mDy = mouse.y - midY;
              const mDist = Math.sqrt(mDx * mDx + mDy * mDy);
              if (mDist < 120) {
                alpha = baseAlpha * (1 + ((120 - mDist) / 120) * 1.5);
              }
            }

            let baseColor = THEME_COLORS.accent;
            if (section === "how-am-i" && n1.group === n2.group) {
              baseColor = getGroupColor(n1.group);
            }
            if (section === "how-am-i" && selectedSet !== null) {
              if (n1.group !== selectedSet || n2.group !== selectedSet) {
                alpha *= 0.35;
              }
            }
            ctx.strokeStyle = getRGBA(baseColor, alpha);

            ctx.beginPath();
            ctx.moveTo(n1.x + globalDriftX, n1.y + globalDriftY);
            ctx.lineTo(n2.x + globalDriftX, n2.y + globalDriftY);
            ctx.stroke();
          }
        }
      }

      // ─── DRAW NODES ───────────────────────────────────────────────────────

      if (section === "skills") {
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
      } else {
        nodes.forEach((node, i) => {
          let radius = node.baseRadius;
          let alphaMultiplier = 1;

          let isStructural = false;
          if (section === "how-am-i") {
            const circleGroup = node.group;
            const startIdx =
              circleGroup === 0 ? 0 : circleGroup === 1 ? 66 : 132;
            const groupLocal = i - startIdx;
            isStructural = groupLocal >= 0 && groupLocal < 40;
          }

          const selectedVenn = currentSpa?.selectedVennCircle ?? null;
          const hoveredVenn = currentSpa?.hoveredVennCircle ?? null;

          if (section === "how-am-i") {
            if (selectedVenn !== null) {
              if (node.group === selectedVenn) {
                const startIdx =
                  selectedVenn === 0 ? 0 : selectedVenn === 1 ? 66 : 132;
                const groupLocal = i - startIdx;
                const isAnchorNode = groupLocal >= 40 && groupLocal < 44;
                const isSatellite = groupLocal >= 44;

                if (isAnchorNode || isSatellite) {
                  return;
                }
                radius *= 1.35;
                alphaMultiplier *= 1.8;
              } else {
                const isThisHovered = hoveredVenn === node.group;
                radius *= isThisHovered ? 1.05 : 0.85;
                alphaMultiplier *= isThisHovered ? 1.4 : 0.85;
              }
            } else {
              if (hoveredVenn === node.group) {
                radius *= 1.25;
                alphaMultiplier *= 1.8;
              } else if (isStructural) {
                radius *= 1.25;
                alphaMultiplier *= 1.6;
              }
            }
          } else if (isStructural) {
            radius *= 1.25;
            alphaMultiplier *= 1.6;
          }

          if (mouse.active && !isStructural) {
            const dx = mouse.x - node.x;
            const dy = mouse.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const hoverRadius = 140;
            if (dist < hoverRadius) {
              const ratio = (hoverRadius - dist) / hoverRadius;
              radius *= 1 + ratio * 0.8;
              alphaMultiplier *= 1 + ratio * 1.8;
            }
          }

          const baseColor = getGroupColor(node.group);

          ctx.fillStyle = getRGBA(baseColor, 0.24 * alphaMultiplier);
          ctx.beginPath();
          ctx.arc(
            node.x + globalDriftX,
            node.y + globalDriftY,
            radius,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.fillStyle = getRGBA(baseColor, 0.58 * alphaMultiplier);
          ctx.beginPath();
          ctx.arc(
            node.x + globalDriftX,
            node.y + globalDriftY,
            radius * 0.4,
            0,
            Math.PI * 2
          );
          ctx.fill();
        });
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
        sectionRef.current === "how-am-i"
      ) {
        requestRender();
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      if (
        renderPolicy.animateContinuously ||
        sectionRef.current === "how-am-i"
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

      const neurons = nodesRef.current.filter((node) => node.brainRole === "neuron");
      let closest: NetworkNode | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      neurons.forEach((node) => {
        const distance = Math.hypot(node.x - event.clientX, node.y - event.clientY);
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
    };
  }, [brainConcepts, brainRuntime, prefersReducedMotion, timelineRuntime]);

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
        mixBlendMode: (activeSection === "skills" || activeSection === "timeline" || activeSection === "projects") ? "normal" : "multiply",
        opacity: (activeSection === "skills" || activeSection === "timeline" || activeSection === "projects") ? 0.94 : 0.55,
        transition: prefersReducedMotion ? "none" : "opacity 500ms ease",
      }}
    />
  );
}
