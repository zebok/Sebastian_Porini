import type { CSSProperties } from "react";
import { getBrainSkillPosition } from "../BrainGraph.config";
import type {
  BrainConceptViewModel,
  BrainSkillKind,
} from "@/types/brain";
import type { SkillId } from "@/types/content";
import {
  BRAIN_BOUNDS_SCALE_X,
  BRAIN_BOUNDS_SCALE_Y,
} from "../BrainGraph.geometry";

const AREA_SCALE_X = BRAIN_BOUNDS_SCALE_X * 100;
const AREA_SCALE_Y = BRAIN_BOUNDS_SCALE_Y * 100;

export const MINI_BRAIN_WIDTH = 180;
export const MINI_BRAIN_HEIGHT = 145;

export interface MiniBrainLink {
  source: BrainConceptViewModel;
  target: BrainConceptViewModel;
  sharedSkills: number;
}

const neuronLabelStyle = (skillId: SkillId): CSSProperties => {
  const position = getBrainSkillPosition(skillId);
  if (!position) return {};

  return {
    left: `${50 + position.x * AREA_SCALE_X}%`,
    top: `${50 + position.y * AREA_SCALE_Y}%`,
  };
};

export const protagonistHotspotStyle = (
  concept: BrainConceptViewModel
): CSSProperties => neuronLabelStyle(concept.visual.protagonistId);

export const brainConceptClientPoint = (
  concept: BrainConceptViewModel,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">
) => {
  const protagonist = getBrainSkillPosition(concept.visual.protagonistId);
  if (!protagonist) return null;

  return {
    x: rect.left +
      rect.width * ((50 + protagonist.x * AREA_SCALE_X) / 100),
    y: rect.top +
      rect.height * ((50 + protagonist.y * AREA_SCALE_Y) / 100),
  };
};

const conceptColors = (concept: BrainConceptViewModel) =>
  Array.from(
    new Set(
      concept.visual.skillIds.flatMap((skillId) => {
        const kind = getBrainSkillPosition(skillId)?.kind;
        if (kind === "hard") return ["var(--hard-color)"];
        if (kind === "soft") return ["var(--accent)"];
        if (kind === "language") return ["var(--accent-3)"];
        return [];
      })
    )
  );

export const conceptVisualStyle = (
  concept: BrainConceptViewModel
): CSSProperties => {
  const colors = conceptColors(concept);

  return {
    "--concept-spectrum": `linear-gradient(90deg, ${colors.join(", ")})`,
  } as CSSProperties;
};

export const miniBrainPoint = (concept: BrainConceptViewModel) => {
  const protagonist = getBrainSkillPosition(concept.visual.protagonistId);

  return {
    x: 90 + (protagonist?.x ?? 0) * 70,
    y: 70 + (protagonist?.y ?? 0) * 57,
  };
};

export const miniBrainNodeStyle = (
  concept: BrainConceptViewModel
): CSSProperties => {
  const point = miniBrainPoint(concept);

  return {
    ...conceptVisualStyle(concept),
    left: `${(point.x / MINI_BRAIN_WIDTH) * 100}%`,
    top: `${(point.y / MINI_BRAIN_HEIGHT) * 100}%`,
  } as CSSProperties;
};

export const focusNodeStyle = (x: number, y: number): CSSProperties => ({
  left: `${x}%`,
  top: `${y}%`,
});

/** Panel centre in percentage units */
const PANEL_CX = 50;
const PANEL_CY = 49;

/**
 * Computes coordinates for labels pushed radially from the center of the panel
 * to avoid overlapping canvas beacons and halos.
 */
export const getFocusLabelCoords = (
  x: number,
  y: number,
  protagonist: boolean
) => {
  if (protagonist) {
    return { x, y: y + 12 };
  }

  const dx = x - PANEL_CX;
  const dy = y - PANEL_CY;
  const dist = Math.hypot(dx, dy) || 1;
  
  // Intelligent placement: push labels INWARD (towards the center)
  // this prevents text clipping at panel borders and uses the empty inner space.
  const dirX = -dx / dist;
  const dirY = -dy / dist;
  const pushPercent = 9.5;

  return {
    x: x + dirX * pushPercent,
    y: y + dirY * pushPercent,
  };
};

/**
 * Pushes the label radially away from the panel centre so it never
 * overlaps the canvas-drawn neuron halo.
 */
export const focusNodeLabelStyle = (
  x: number,
  y: number,
  protagonist: boolean
): CSSProperties => {
  const coords = getFocusLabelCoords(x, y, protagonist);
  return {
    left: `${coords.x}%`,
    top: `${coords.y}%`,
  };
};


export const createMiniBrainLinks = (
  concepts: BrainConceptViewModel[]
): MiniBrainLink[] =>
  concepts
    .flatMap((source, sourceIndex) =>
      concepts.slice(sourceIndex + 1).flatMap((target) => {
        const sharedSkills = source.visual.skillIds.filter((skillId) =>
          target.visual.skillIds.includes(skillId)
        ).length;
        if (sharedSkills === 0) return [];

        return [{ source, target, sharedSkills }];
      })
    )
    .sort((first, second) => second.sharedSkills - first.sharedSkills)
    .slice(0, 10);

export const getConceptKind = (
  concept: BrainConceptViewModel
): BrainSkillKind =>
  getBrainSkillPosition(concept.visual.protagonistId)?.kind ?? "soft";

export const brainCursorStyle = (
  cursorKind: BrainSkillKind | null
): CSSProperties =>
  ({
    "--cursor-color":
      cursorKind === "hard"
        ? "var(--hard-color)"
        : cursorKind === "soft"
          ? "var(--accent)"
          : cursorKind === "language"
            ? "var(--accent-3)"
            : "var(--ink-muted)",
  }) as CSSProperties;
