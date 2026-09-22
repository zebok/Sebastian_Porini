import type { SkillId } from "@/types/content";

export interface BrainConceptVisualDefinition {
  protagonistId: SkillId;
  satelliteIds: readonly SkillId[];
}

/**
 * Renderer-only anchors for the seven Core neurons.
 *
 * Nothing in this map is editorial content: the IDs only select existing
 * particle anchors, while ordering provides deterministic visual variety.
 * Titles and subtitles always come from public/data/content.json.
 */
export const BRAIN_CONCEPT_VISUALS = {
  "build-systems": {
    protagonistId: "software-engineering",
    satelliteIds: [
      "devops",
      "data-analytics",
      "leadership",
      "adaptability",
      "communication",
      "product-management",
      "empathy",
      "spanish",
      "english",
      "german",
    ],
  },
  "shape-product": {
    protagonistId: "product-management",
    satelliteIds: [
      "empathy",
      "data-analytics",
      "adaptability",
      "communication",
      "leadership",
      "software-engineering",
      "devops",
      "spanish",
      "english",
      "german",
    ],
  },
  "read-complexity": {
    protagonistId: "data-analytics",
    satelliteIds: [
      "software-engineering",
      "adaptability",
      "product-management",
      "communication",
      "leadership",
      "devops",
      "empathy",
      "spanish",
      "english",
      "german",
    ],
  },
  "connect-people": {
    protagonistId: "empathy",
    satelliteIds: [
      "communication",
      "leadership",
      "product-management",
      "adaptability",
      "data-analytics",
      "software-engineering",
      "devops",
      "spanish",
      "english",
      "german",
    ],
  },
  "adapt-lead": {
    protagonistId: "leadership",
    satelliteIds: [
      "adaptability",
      "empathy",
      "devops",
      "communication",
      "product-management",
      "data-analytics",
      "software-engineering",
      "spanish",
      "english",
      "german",
    ],
  },
  "language-context": {
    protagonistId: "communication",
    satelliteIds: [
      "spanish",
      "english",
      "german",
      "software-engineering",
      "empathy",
      "product-management",
      "adaptability",
      "leadership",
      "data-analytics",
      "devops",
    ],
  },
  "sustain-evolve": {
    protagonistId: "devops",
    satelliteIds: [
      "software-engineering",
      "adaptability",
      "leadership",
      "data-analytics",
      "communication",
      "product-management",
      "empathy",
      "spanish",
      "english",
      "german",
    ],
  },
} as const satisfies Record<string, BrainConceptVisualDefinition>;

export type BrainConceptVisualId = keyof typeof BRAIN_CONCEPT_VISUALS;

export const BRAIN_CONCEPT_VISUAL_IDS = Object.keys(
  BRAIN_CONCEPT_VISUALS
) as BrainConceptVisualId[];

export const MAX_BRAIN_CONCEPT_SUBTITLES = 10;

export const getBrainConceptVisualDefinition = (conceptId: string) => {
  if (conceptId in BRAIN_CONCEPT_VISUALS) {
    return BRAIN_CONCEPT_VISUALS[conceptId as BrainConceptVisualId];
  }

  throw new Error(`Unknown brain Core visual id: "${conceptId}"`);
};
