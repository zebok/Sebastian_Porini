import type {
  BrainConceptViewModel,
  BrainSkillKind,
} from "@/types/brain";
import type { SkillId } from "@/types/content";

export type { BrainSkillKind } from "@/types/brain";

export interface BrainSkillPosition {
  id: SkillId;
  kind: BrainSkillKind;
  x: number;
  y: number;
  region:
    | "systems"
    | "analysis"
    | "product"
    | "social"
    | "adaptation"
    | "language"
    | "communication";
}

export interface BrainConceptFocusNode {
  skillId: SkillId;
  label: string;
  x: number;
  y: number;
  energy: number;
  protagonist: boolean;
}

/**
 * Skills deliberately cross both hemispheres. The positions describe functional
 * regions, not a left-brain/right-brain personality split. The seven concept
 * protagonists form a central hub plus three balanced pairs; supporting skills
 * live in the quieter corridors between them.
 */
export const BRAIN_SKILL_POSITIONS: BrainSkillPosition[] = [
  { id: "software-engineering", kind: "hard", x: -0.52, y: -0.5, region: "systems" },
  { id: "data-analytics", kind: "hard", x: -0.65, y: 0.08, region: "analysis" },
  { id: "devops", kind: "hard", x: 0.42, y: 0.57, region: "adaptation" },
  { id: "product-management", kind: "hard", x: 0.52, y: -0.5, region: "product" },

  { id: "empathy", kind: "soft", x: 0.65, y: 0.08, region: "social" },
  { id: "communication", kind: "soft", x: 0, y: 0, region: "communication" },
  { id: "adaptability", kind: "soft", x: 0, y: -0.3, region: "adaptation" },
  { id: "leadership", kind: "soft", x: -0.42, y: 0.57, region: "adaptation" },

  { id: "spanish", kind: "language", x: -0.2, y: 0.29, region: "communication" },
  { id: "english", kind: "language", x: 0.2, y: 0.29, region: "communication" },
  { id: "german", kind: "language", x: 0, y: 0.55, region: "communication" },
];

export const getBrainConceptEnergy = (
  concept: BrainConceptViewModel,
  skillId: SkillId
) => {
  if (skillId === concept.visual.protagonistId) return 1;
  return (
    concept.visual.satellites.find(
      (satellite) => satellite.skillId === skillId
    )?.energy ?? 0
  );
};

const FOCUS_TISSUE_LAYOUTS: Record<number, readonly [number, number][]> = {
  1: [[74, 42]],
  2: [
    [25, 31],
    [74, 68],
  ],
  3: [
    [23, 29],
    [77, 39],
    [34, 77],
  ],
  4: [
    [24, 28],
    [75, 23],
    [78, 67],
    [29, 77],
  ],
};

const FOCUS_TISSUE_FALLBACK: readonly [number, number][] = [
  [22, 28],
  [74, 22],
  [80, 62],
  [60, 79],
  [27, 77],
  [17, 51],
  [47, 16],
  [83, 40],
  [45, 84],
  [68, 46],
];

/**
 * A conceptual close-up: the Core stays central while editable subtitles form
 * an organic constellation around it. Geometry comes from the renderer only;
 * content has no weights or layout responsibilities.
 */
export const getBrainConceptFocusNodes = (
  concept: BrainConceptViewModel
): BrainConceptFocusNode[] => {
  const tissueLayout =
    FOCUS_TISSUE_LAYOUTS[concept.visual.satellites.length] ??
    FOCUS_TISSUE_FALLBACK;
  const mirrorLayout = concept.index % 2 === 1;

  return [
    {
      skillId: concept.visual.protagonistId,
      label: concept.title,
      x: 50,
      y: 49,
      energy: 1,
      protagonist: true,
    },
    ...concept.visual.satellites.map((satellite, index) => {
      const [slotX, slotY] =
        tissueLayout[index % tissueLayout.length] ?? FOCUS_TISSUE_FALLBACK[0];

      return {
        skillId: satellite.skillId,
        label: concept.subtitles[index] ?? "",
        x: mirrorLayout ? 100 - slotX : slotX,
        y: slotY,
        energy: satellite.energy,
        protagonist: false,
      };
    }),
  ];
};

export const getBrainSkillPosition = (id: SkillId) =>
  BRAIN_SKILL_POSITIONS.find((position) => position.id === id);

export const getBrainSubnodePosition = (
  skillId: SkillId,
  subIndex: number,
  expanded: boolean
) => {
  const skill = getBrainSkillPosition(skillId);
  if (!skill || subIndex === 0) {
    return skill ? { x: skill.x, y: skill.y } : { x: 0, y: 0 };
  }

  let centerwardAngle = skill.x > 0 ? Math.PI : 0;
  if (skill.y < -0.48) centerwardAngle = Math.PI / 2;
  if (skill.y > 0.48) centerwardAngle = -Math.PI / 2;
  if (skill.kind === "language") {
    centerwardAngle = skill.x > 0 ? 0 : Math.PI;
  }

  const spread = expanded ? 0.72 : 0.36;
  const radiusX = expanded ? 0.19 : 0.034;
  const radiusY = expanded ? 0.15 : 0.026;
  const angle = centerwardAngle + (subIndex - 2) * spread;

  return {
    x: skill.x + Math.cos(angle) * radiusX,
    y: skill.y + Math.sin(angle) * radiusY,
  };
};
