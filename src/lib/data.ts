import fs from "fs";
import path from "path";
import { cache } from "react";
import { BRAIN_SKILL_POSITIONS } from "@/components/visualizations/BrainGraph.config";
import {
  BRAIN_CONCEPT_VISUAL_IDS,
  MAX_BRAIN_CONCEPT_SUBTITLES,
} from "@/lib/brainVisuals";
import { assertValidBrainReferences } from "@/lib/validation/brainReferences";
import { assertValidCareerRepositoryReferences } from "@/lib/validation/careerRepository";
import { createBrainViewModel } from "@/lib/view-models/brain";
import type { BrainViewModel } from "@/types/brain";
import type {
  Dictionary,
  FocusCircleItem,
  FocusIntersectionItem,
  LocalizedCareerRepository,
  LocalizedString,
  PortfolioContent,
} from "@/types/content";

// Hoisted static file reading at module level
const rawPortfolioData: unknown = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public/data/content.json"), "utf-8")
);

assertValidBrainReferences(rawPortfolioData, {
  positions: BRAIN_SKILL_POSITIONS,
  conceptIds: BRAIN_CONCEPT_VISUAL_IDS,
  maxConceptSubtitles: MAX_BRAIN_CONCEPT_SUBTITLES,
});
assertValidCareerRepositoryReferences(rawPortfolioData);

const _portfolioData = rawPortfolioData as PortfolioContent;

export const getPortfolioData = (): PortfolioContent => {
  return _portfolioData;
};

export interface LocalizedFocusCircleItem {
  title: string;
  description?: string;
  items: string[];
  tags?: string[];
}

export interface LocalizedFocusIntersectionItem {
  title: string;
  items: string[];
}

export interface LocalizedPersonalInfo {
  name: string;
  tagline: string;
  description: string;
  story: {
    title: string;
    paragraphs: string[];
  };
  focus: {
    circle1: LocalizedFocusCircleItem;
    circle2: LocalizedFocusCircleItem;
    circle3: LocalizedFocusCircleItem;
    intersection01: LocalizedFocusIntersectionItem;
    intersection02: LocalizedFocusIntersectionItem;
    intersection12: LocalizedFocusIntersectionItem;
    intersectionAll: LocalizedFocusIntersectionItem;
  };
  contactDetails: {
    fullName: string;
    dob: string;
    nationality: string;
    workModes: string;
    location: string;
    status: string;
    email: string;
    github: string;
    linkedin: string;
    cvPath: string;
  };
}

export interface LocalizedPortfolioData {
  personal: LocalizedPersonalInfo;
  ui: Dictionary;
  identity: {
    radarProfile: { axis: string; value: number }[];
  };
  brain: BrainViewModel;
  careerRepository: LocalizedCareerRepository;
  contact: {
    openTo: string[];
    superpower: string;
    passion: string;
  };
  projects: LocalizedProject[];
}

export interface LocalizedProject {
  id: string;
  title: string;
  description: string;
  category: string;
  projectType: "work" | "personal";
  tags: string[];
  highlights: string[];
  featured: boolean;
  demoUrl?: string;
  codeUrl?: string;
}

export const getLocalizedData = cache((lang: string): LocalizedPortfolioData => {
  const raw = getPortfolioData();
  const locale = lang.trim().toLowerCase().split(/[-_]/)[0];
  const languageKey: "en" | "es" | "de" =
    locale === "es" || locale === "de" ? locale : "en";

  const get = <T>(
    obj: { en: T; es: T; de?: T } | undefined | null
  ): T => {
    if (!obj) return undefined as unknown as T;
    return obj[languageKey] ?? obj.en;
  };

  const getList = (
    obj: { en: string[]; es: string[]; de?: string[] } | undefined | null
  ): string[] => {
    if (!obj) return [];
    return obj[languageKey] ?? obj.en;
  };

  const mapCircle = (c: FocusCircleItem): LocalizedFocusCircleItem => ({
    title: get(c.title),
    description: get(c.description),
    items: c.items.map((it: LocalizedString) => get(it)),
    tags: c.tags ? c.tags.map((it: LocalizedString) => get(it)) : undefined
  });

  const mapIntersection = (c: FocusIntersectionItem): LocalizedFocusIntersectionItem => ({
    title: get(c.title),
    items: c.items.map((it: LocalizedString) => get(it))
  });

  return {
    personal: {
      name: raw.personal.name,
      tagline: get(raw.personal.tagline),
      description: get(raw.personal.description),
      story: {
        title: get(raw.personal.story.title),
        paragraphs: raw.personal.story.paragraphs.map(p => get(p))
      },
      focus: {
        circle1: mapCircle(raw.personal.focus.circle1),
        circle2: mapCircle(raw.personal.focus.circle2),
        circle3: mapCircle(raw.personal.focus.circle3),
        intersection01: mapIntersection(raw.personal.focus.intersection01),
        intersection02: mapIntersection(raw.personal.focus.intersection02),
        intersection12: mapIntersection(raw.personal.focus.intersection12),
        intersectionAll: mapIntersection(raw.personal.focus.intersectionAll),
      },
      contactDetails: {
        fullName: raw.personal.contactDetails.fullName,
        dob: get(raw.personal.contactDetails.dob),
        nationality: get(raw.personal.contactDetails.nationality),
        workModes: get(raw.personal.contactDetails.workModes),
        location: raw.personal.contactDetails.location,
        status: get(raw.personal.contactDetails.status),
        email: raw.personal.contactDetails.email,
        github: raw.personal.contactDetails.github,
        linkedin: raw.personal.contactDetails.linkedin,
        cvPath: get(raw.personal.contactDetails.cvPath),
      }
    },
    ui: {
      nav: {
        whoAmI: get(raw.ui.nav.whoAmI),
        skills: get(raw.ui.nav.skills),
        timeline: get(raw.ui.nav.timeline),
        projects: get(raw.ui.nav.projects),
      },
      hero: {
        greeting: get(raw.ui.hero.greeting),
        ctaProjects: get(raw.ui.hero.ctaProjects),
        ctaContact: get(raw.ui.hero.ctaContact),
      },
      footer: {
        tagline: get(raw.ui.footer.tagline),
        rights: get(raw.ui.footer.rights),
      },
      radar: {
        curiosity: get(raw.ui.radar.curiosity),
        observation: get(raw.ui.radar.observation),
        structure: get(raw.ui.radar.structure),
        chaosMgmt: get(raw.ui.radar.chaosMgmt),
        bureaucracy: get(raw.ui.radar.bureaucracy),
        formalism: get(raw.ui.radar.formalism),
      },
      whoAmI: {
        title: get(raw.ui.whoAmI.title),
        subtitle: get(raw.ui.whoAmI.subtitle),
        chartTitle: get(raw.ui.whoAmI.chartTitle),
      },
      skills: {
        title: get(raw.ui.skills.title),
        subtitle: get(raw.ui.skills.subtitle),
      },
      timeline: {
        title: get(raw.ui.timeline.title),
        subtitle: get(raw.ui.timeline.subtitle),
        repositoryLabel: get(raw.ui.timeline.repositoryLabel),
        commitLabel: get(raw.ui.timeline.commitLabel),
        mergeLabel: get(raw.ui.timeline.mergeLabel),
        branchLabel: get(raw.ui.timeline.branchLabel),
        headLabel: get(raw.ui.timeline.headLabel),
        wipLabel: get(raw.ui.timeline.wipLabel),
        forecastLabel: get(raw.ui.timeline.forecastLabel),
        historyLabel: get(raw.ui.timeline.historyLabel),
        stagingLabel: get(raw.ui.timeline.stagingLabel),
        scrollHint: get(raw.ui.timeline.scrollHint),
      },
      contact: {
        downloadCv: get(raw.ui.contact.downloadCv),
      },
      projects: {
        title: get(raw.ui.projects.title),
        subtitle: get(raw.ui.projects.subtitle),
        metaDescription: get(raw.ui.projects.metaDescription),
        all: get(raw.ui.projects.all),
        categories: {
          software: get(raw.ui.projects.categories.software),
          data: get(raw.ui.projects.categories.data),
          ai: get(raw.ui.projects.categories.ai),
          product: get(raw.ui.projects.categories.product),
        },
        filterGroups: {
          type: get(raw.ui.projects.filterGroups.type),
          area: get(raw.ui.projects.filterGroups.area),
          tech: get(raw.ui.projects.filterGroups.tech),
        },
        types: {
          work: get(raw.ui.projects.types.work),
          personal: get(raw.ui.projects.types.personal),
        },
        clearAll: get(raw.ui.projects.clearAll),
        showFilters: get(raw.ui.projects.showFilters),
        hideFilters: get(raw.ui.projects.hideFilters),
        resultsCountOne: get(raw.ui.projects.resultsCountOne),
        resultsCountMany: get(raw.ui.projects.resultsCountMany),
        viewDemo: get(raw.ui.projects.viewDemo),
        viewCode: get(raw.ui.projects.viewCode),
        moreDetails: get(raw.ui.projects.moreDetails),
        closeDetails: get(raw.ui.projects.closeDetails),
        keyHighlights: get(raw.ui.projects.keyHighlights),
        noProjects: get(raw.ui.projects.noProjects),
      }
    },
    identity: {
      radarProfile: raw.identity.radarProfile.map((p) => ({
        axis: p.axis,
        value: p.value,
      })),
    },
    brain: createBrainViewModel(raw, lang),
    careerRepository: {
      name: raw.careerRepository.name,
      headIdentity: get(raw.careerRepository.headIdentity),
      branches: raw.careerRepository.branches.map((branch) => ({
        ...branch,
        description: get(branch.description),
      })),
      commits: raw.careerRepository.commits.map((commit) => ({
        ...commit,
        parents: commit.parents.map((parent) => ({ ...parent })),
        time: { ...commit.time },
        period: get(commit.period),
        title: get(commit.title),
        summary: get(commit.summary),
        details: getList(commit.details),
      })),
      staging: raw.careerRepository.staging.map((item) => ({
        ...item,
        parents: item.parents.map((parent) => ({ ...parent })),
        time: { ...item.time },
        title: get(item.title),
        summary: get(item.summary),
      })),
      refs: raw.careerRepository.refs.map((ref) => ({ ...ref })),
    },
    contact: {
      openTo: getList(raw.contact.openTo),
      superpower: get(raw.contact.superpower),
      passion: get(raw.contact.passion),
    },
    projects: raw.projects ? raw.projects.map((p) => ({
      id: p.id,
      title: get(p.title),
      description: get(p.description),
      category: p.category,
      projectType: p.projectType,
      tags: p.tags,
      highlights: getList(p.highlights),
      featured: p.featured,
      demoUrl: p.demoUrl,
      codeUrl: p.codeUrl,
    })) : [],
  };
});
