import type { BrainIntro, BrainUi, SkillId } from "@/types/content";

export type BrainSkillKind = "hard" | "soft" | "language";

export interface BrainSkillViewModel {
  id: SkillId;
  kind: BrainSkillKind;
  name: string;
  detail?: string;
  subSkills: {
    name: string;
    detail?: string;
  }[];
}

export interface BrainConceptViewModel {
  id: string;
  index: number;
  title: string;
  subtitles: string[];
  /** Renderer-only anchors. Editorial content never depends on these IDs. */
  visual: {
    protagonistId: SkillId;
    satellites: {
      skillId: SkillId;
      energy: number;
    }[];
    skillIds: SkillId[];
    connections: [SkillId, SkillId][];
  };
}

/** Plain, localized and serializable model consumed by the client brain UI. */
export interface BrainViewModel {
  conceptCount: number;
  intro: BrainIntro<string>;
  ui: BrainUi<string>;
  concepts: BrainConceptViewModel[];
  skills: BrainSkillViewModel[];
}
