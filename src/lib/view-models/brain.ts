import type {
  BrainConceptViewModel,
  BrainSkillViewModel,
  BrainViewModel,
} from "@/types/brain";
import type {
  LocalizedString,
  PortfolioContent,
  SkillId,
} from "@/types/content";
import { getBrainConceptVisualDefinition } from "@/lib/brainVisuals";

type BrainViewModelSource = Pick<PortfolioContent, "brain" | "skills">;
type ContentLocale = keyof LocalizedString;

const resolveLocale = (lang: string): ContentLocale =>
  lang === "es" ? "es" : "en";

const localize = (text: LocalizedString, locale: ContentLocale): string =>
  text[locale] ?? text.en;

const createSkillViewModels = (
  skills: PortfolioContent["skills"],
  locale: ContentLocale
): BrainSkillViewModel[] => [
  ...skills.hard.map((skill) => ({
    id: skill.id,
    kind: "hard" as const,
    name: localize(skill.name, locale),
    detail: `${skill.level}%`,
    subSkills: (skill.subSkills ?? []).map((subSkill) => ({
      name: localize(subSkill.name, locale),
      detail: `${subSkill.level}%`,
    })),
  })),
  ...skills.soft.map((skill) => ({
    id: skill.id,
    kind: "soft" as const,
    name: localize(skill.name, locale),
    subSkills: (skill.subSkills ?? []).map((subSkill) => ({
      name: localize(subSkill, locale),
    })),
  })),
  ...skills.languages.map((skill) => ({
    id: skill.id,
    kind: "language" as const,
    name: localize(skill.name, locale),
    detail: localize(skill.level, locale),
    subSkills: [],
  })),
];

export const createBrainViewModel = (
  source: BrainViewModelSource,
  lang: string
): BrainViewModel => {
  const locale = resolveLocale(lang);
  const conceptCount = source.brain.cores.length;
  const interpolateBrainText = (text: LocalizedString): string =>
    localize(text, locale)
      .replaceAll("{count}", String(conceptCount));

  const concepts: BrainConceptViewModel[] = source.brain.cores.map(
    (concept, index) => {
      const visualDefinition = getBrainConceptVisualDefinition(concept.id);
      const satellites = visualDefinition.satelliteIds
        .slice(0, concept.subtitles.length)
        .map((skillId, satelliteIndex) => ({
          skillId,
          // Deterministic rendering energy. It is deliberately calculated in
          // code and carries no editorial or proficiency meaning.
          energy: 0.74 + ((satelliteIndex + index * 2) % 4) * 0.07,
        }));

      return {
        id: concept.id,
        index,
        title: localize(concept.title, locale),
        subtitles: concept.subtitles.map((subtitle) =>
          localize(subtitle, locale)
        ),
        visual: {
          protagonistId: visualDefinition.protagonistId,
          satellites,
          skillIds: [
            visualDefinition.protagonistId,
            ...satellites.map((satellite) => satellite.skillId),
          ],
          connections: satellites.map(
            (satellite) =>
              [
                visualDefinition.protagonistId,
                satellite.skillId,
              ] as [SkillId, SkillId]
          ),
        },
      };
    }
  );

  return {
    conceptCount,
    intro: {
      ariaLabel: interpolateBrainText(source.brain.intro.ariaLabel),
      title: interpolateBrainText(source.brain.intro.title),
      instruction: interpolateBrainText(source.brain.intro.instruction),
      skip: interpolateBrainText(source.brain.intro.skip),
      play: interpolateBrainText(source.brain.intro.play),
    },
    ui: {
      mapAriaLabel: interpolateBrainText(source.brain.ui.mapAriaLabel),
      undiscoveredConcept: interpolateBrainText(
        source.brain.ui.undiscoveredConcept
      ),
      backToMapAriaLabel: interpolateBrainText(
        source.brain.ui.backToMapAriaLabel
      ),
      back: interpolateBrainText(source.brain.ui.back),
      connectedIdeas: interpolateBrainText(
        source.brain.ui.connectedIdeas
      ),
      expandedNetwork: interpolateBrainText(
        source.brain.ui.expandedNetwork
      ),
    },
    concepts,
    skills: createSkillViewModels(source.skills, locale),
  };
};
