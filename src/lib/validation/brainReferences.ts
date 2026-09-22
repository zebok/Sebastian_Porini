import type { BrainSkillPosition } from "@/components/visualizations/BrainGraph.config";
import type { BrainSkillKind } from "@/types/brain";
import type { BrainIntro, BrainUi } from "@/types/content";

interface BrainReferenceGraph {
  positions: readonly BrainSkillPosition[];
  conceptIds: readonly string[];
  maxConceptSubtitles: number;
}

type UnknownRecord = Record<string, unknown>;

const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CONTENT_SKILL_GROUPS = [
  ["hard", "hard"],
  ["soft", "soft"],
  ["languages", "language"],
] as const satisfies readonly (readonly [string, BrainSkillKind])[];

const BRAIN_INTRO_KEYS = [
  "ariaLabel",
  "title",
  "instruction",
  "skip",
  "play",
] as const satisfies readonly (keyof BrainIntro<unknown>)[];

const BRAIN_UI_KEYS = [
  "mapAriaLabel",
  "undiscoveredConcept",
  "backToMapAriaLabel",
  "back",
  "connectedIdeas",
  "expandedNetwork",
] as const satisfies readonly (keyof BrainUi<unknown>)[];

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateId = (value: unknown, path: string, errors: string[]) => {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return null;
  }
  if (!CONTENT_ID_PATTERN.test(value)) {
    errors.push(
      `${path} must use lowercase kebab-case; received "${value}"`
    );
  }
  return value;
};

const validateLocalizedText = (
  value: unknown,
  path: string,
  errors: string[]
) => {
  if (!isRecord(value)) {
    errors.push(`${path} must contain localized text`);
    return;
  }
  if (typeof value.en !== "string" || value.en.length === 0) {
    errors.push(`${path}.en must be a non-empty string`);
  }
  if (typeof value.es !== "string" || value.es.length === 0) {
    errors.push(`${path}.es must be a non-empty string`);
  }
};

/**
 * Validates the boundary between editable portfolio content and brain geometry.
 * It runs before the JSON is cast, so broken content fails during development
 * and `next build` instead of degrading silently in the client.
 */
export const getBrainReferenceErrors = (
  content: unknown,
  graph: BrainReferenceGraph
): string[] => {
  const errors: string[] = [];
  const contentSkillKinds = new Map<string, BrainSkillKind>();
  const contentSkillPaths = new Map<string, string>();

  const root = isRecord(content) ? content : null;
  const skills = root && isRecord(root.skills) ? root.skills : null;

  if (!skills) {
    return ["content.skills must be an object"];
  }

  for (const [groupName, kind] of CONTENT_SKILL_GROUPS) {
    const group = skills[groupName];
    if (!Array.isArray(group)) {
      errors.push(`content.skills.${groupName} must be an array`);
      continue;
    }

    group.forEach((candidate, index) => {
      const path = `content.skills.${groupName}[${index}].id`;
      const id = validateId(isRecord(candidate) ? candidate.id : null, path, errors);
      if (!id) return;

      const existingPath = contentSkillPaths.get(id);
      if (existingPath) {
        errors.push(`${path} duplicates the ID declared at ${existingPath}`);
        return;
      }

      contentSkillKinds.set(id, kind);
      contentSkillPaths.set(id, path);
    });
  }

  const positionedIds = new Set<string>();
  graph.positions.forEach((position, index) => {
    const path = `BRAIN_SKILL_POSITIONS[${index}]`;
    if (positionedIds.has(position.id)) {
      errors.push(`${path}.id duplicates the position for "${position.id}"`);
      return;
    }
    positionedIds.add(position.id);

    const contentKind = contentSkillKinds.get(position.id);
    if (!contentKind) {
      errors.push(`${path}.id references unknown skill "${position.id}"`);
    } else if (contentKind !== position.kind) {
      errors.push(
        `${path}.kind is "${position.kind}" but "${position.id}" is a "${contentKind}" skill`
      );
    }
  });

  contentSkillKinds.forEach((_kind, id) => {
    if (!positionedIds.has(id)) {
      errors.push(`Skill "${id}" has no entry in BRAIN_SKILL_POSITIONS`);
    }
  });

  const brain = root && isRecord(root.brain) ? root.brain : null;
  if (!brain) {
    errors.push("content.brain must be an object");
    return errors;
  }

  const intro = isRecord(brain.intro) ? brain.intro : null;
  if (!intro) {
    errors.push("content.brain.intro must be an object");
  } else {
    BRAIN_INTRO_KEYS.forEach((key) =>
      validateLocalizedText(intro[key], `content.brain.intro.${key}`, errors)
    );
  }

  const ui = isRecord(brain.ui) ? brain.ui : null;
  if (!ui) {
    errors.push("content.brain.ui must be an object");
  } else {
    BRAIN_UI_KEYS.forEach((key) =>
      validateLocalizedText(ui[key], `content.brain.ui.${key}`, errors)
    );
  }

  const cores = brain.cores;
  if (!Array.isArray(cores)) {
    errors.push("content.brain.cores must be an array");
  } else {
    const conceptIds = new Set<string>();
    const visualConceptIds = new Set(graph.conceptIds);

    cores.forEach((candidate, conceptIndex) => {
      const path = `content.brain.cores[${conceptIndex}]`;
      if (!isRecord(candidate)) {
        errors.push(`${path} must be an object`);
        return;
      }

      const conceptId = validateId(candidate.id, `${path}.id`, errors);
      if (conceptId) {
        if (conceptIds.has(conceptId)) {
          errors.push(`${path}.id duplicates concept "${conceptId}"`);
        }
        conceptIds.add(conceptId);
        if (!visualConceptIds.has(conceptId)) {
          errors.push(
            `${path}.id has no renderer entry for Core "${conceptId}"`
          );
        }
      }

      validateLocalizedText(candidate.title, `${path}.title`, errors);

      if (!Array.isArray(candidate.subtitles)) {
        errors.push(`${path}.subtitles must be an array`);
        return;
      }

      if (candidate.subtitles.length > graph.maxConceptSubtitles) {
        errors.push(
          `${path}.subtitles supports at most ${graph.maxConceptSubtitles} entries`
        );
      }
      candidate.subtitles.forEach((subtitle, subtitleIndex) =>
        validateLocalizedText(
          subtitle,
          `${path}.subtitles[${subtitleIndex}]`,
          errors
        )
      );
    });

    graph.conceptIds.forEach((conceptId) => {
      if (!conceptIds.has(conceptId)) {
        errors.push(`Core visual "${conceptId}" has no content.brain.cores entry`);
      }
    });
  }

  return errors;
};

export const assertValidBrainReferences = (
  content: unknown,
  graph: BrainReferenceGraph
): void => {
  const errors = getBrainReferenceErrors(content, graph);
  if (errors.length === 0) return;

  throw new Error(
    `Invalid brain content:\n${errors
      .map((error) => `- ${error}`)
      .join("\n")}`
  );
};
