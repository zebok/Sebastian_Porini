export interface LocalizedString {
  en: string;
  es: string;
  de?: string;
}

export interface LocalizedList {
  en: string[];
  es: string[];
  de?: string[];
}

/** Stable, locale-independent identifier used by the brain graph. */
export type SkillId = string;

export type RadarAxisName =
  | "curiosity"
  | "observation"
  | "structure"
  | "chaosMgmt"
  | "bureaucracy"
  | "formalism";

export interface RadarAxis {
  axis: RadarAxisName;
  value: number;
}

export interface HardSubSkill {
  name: LocalizedString;
  level: number;
}

export interface HardSkill {
  id: SkillId;
  name: LocalizedString;
  level: number;
  subSkills?: HardSubSkill[];
}

export interface SoftSkill {
  id: SkillId;
  name: LocalizedString;
  subSkills?: LocalizedString[];
}

export interface LanguageSkill {
  id: SkillId;
  name: LocalizedString;
  level: LocalizedString;
}

export interface BrainConceptDefinition<TText> {
  id: string;
  title: TText;
  subtitles: TText[];
}

export interface BrainIntro<TText> {
  ariaLabel: TText;
  title: TText;
  instruction: TText;
  skip: TText;
  play: TText;
}

export interface BrainUi<TText> {
  mapAriaLabel: TText;
  undiscoveredConcept: TText;
  backToMapAriaLabel: TText;
  back: TText;
  connectedIdeas: TText;
  expandedNetwork: TText;
}

export interface BrainContent {
  intro: BrainIntro<LocalizedString>;
  ui: BrainUi<LocalizedString>;
  cores: BrainConceptDefinition<LocalizedString>[];
}

export type CareerBranchId =
  | "main"
  | "feature/cloud-infra"
  | "feature/backend-api"
  | "feature/data-ai"
  | "feature/product-delivery"
  | "learn/education";

export type CareerCommitStatus = "committed" | "wip" | "forecast";

export type CareerTimePrecision = "month" | "year" | "year-plus";

export type CareerCommitKind =
  | "foundation"
  | "role"
  | "education"
  | "project"
  | "milestone";

export type CareerParentKind = "first-parent" | "merge-parent";

export type CareerParentTarget = "commit" | "staging";

export type CareerRefKind = "head" | "branch" | "tag";

export interface CareerTime {
  /** Coarse ISO value (`YYYY` or `YYYY-MM`); exact days are never inferred. */
  value: string;
  precision: CareerTimePrecision;
}

export interface CareerParent<
  TTarget extends CareerParentTarget = CareerParentTarget,
> {
  id: string;
  target: TTarget;
  kind: CareerParentKind;
}

export interface CareerBranch<TText = LocalizedString> {
  id: CareerBranchId;
  label: string;
  description: TText;
  color: string;
}

export interface CareerCommit<
  TText = LocalizedString,
  TList = LocalizedList,
> {
  id: string;
  /** Authored seven-character lowercase hexadecimal commit identifier. */
  sha: string;
  branchId: CareerBranchId;
  parents: CareerParent<"commit">[];
  status: "committed";
  kind: Exclude<CareerCommitKind, "milestone">;
  time: CareerTime;
  period: TText;
  title: TText;
  organization?: string;
  summary: TText;
  details: TList;
}

export interface CareerStagingItem<TText = LocalizedString> {
  id: string;
  branchId: CareerBranchId;
  parents: CareerParent[];
  status: Exclude<CareerCommitStatus, "committed">;
  kind: "milestone";
  time: CareerTime;
  title: TText;
  summary: TText;
}

export interface CareerRef {
  id: string;
  kind: CareerRefKind;
  name: string;
  targetId: string;
}

export interface CareerRepository<
  TText = LocalizedString,
  TList = LocalizedList,
> {
  name: string;
  headIdentity: TText;
  branches: CareerBranch<TText>[];
  commits: CareerCommit<TText, TList>[];
  staging: CareerStagingItem<TText>[];
  refs: CareerRef[];
}

export type LocalizedCareerRepository = CareerRepository<string, string[]>;

export interface ContactInfo {
  openTo: LocalizedList;
  superpower: LocalizedString;
  passion: LocalizedString;
}

export interface ProjectItem {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  category: string;
  projectType: "work" | "personal";
  tags: string[];
  highlights: LocalizedList;
  featured: boolean;
  demoUrl?: string;
  codeUrl?: string;
}

export interface FocusCircleItem {
  title: LocalizedString;
  description?: LocalizedString;
  items: LocalizedString[];
  tags?: LocalizedString[];
}

export interface FocusIntersectionItem {
  title: LocalizedString;
  items: LocalizedString[];
}

export interface PersonalInfo {
  name: string;
  tagline: LocalizedString;
  description: LocalizedString;
  story: {
    title: LocalizedString;
    paragraphs: LocalizedString[];
  };
  focus: {
    circle1: FocusCircleItem;
    circle2: FocusCircleItem;
    circle3: FocusCircleItem;
    intersection01: FocusIntersectionItem;
    intersection02: FocusIntersectionItem;
    intersection12: FocusIntersectionItem;
    intersectionAll: FocusIntersectionItem;
  };
  contactDetails: {
    fullName: string;
    dob: LocalizedString;
    nationality: LocalizedString;
    workModes: LocalizedString;
    location: string;
    status: LocalizedString;
    email: string;
    github: string;
    linkedin: string;
    cvPath: LocalizedString;
  };
}

export interface Dictionary {
  nav: {
    whoAmI: string;
    skills: string;
    timeline: string;
    projects: string;
  };
  hero: {
    greeting: string;
    ctaProjects: string;
    ctaContact: string;
  };
  footer: {
    tagline: string;
    rights: string;
  };
  radar: {
    curiosity: string;
    observation: string;
    structure: string;
    chaosMgmt: string;
    bureaucracy: string;
    formalism: string;
  };
  whoAmI: {
    title: string;
    subtitle: string;
    chartTitle: string;
  };
  skills: {
    title: string;
    subtitle: string;
  };
  timeline: {
    title: string;
    subtitle: string;
    repositoryLabel: string;
    commitLabel: string;
    mergeLabel: string;
    branchLabel: string;
    headLabel: string;
    wipLabel: string;
    forecastLabel: string;
    historyLabel: string;
    stagingLabel: string;
    scrollHint: string;
  };
  contact: {
    downloadCv: string;
  };
  projects: {
    title: string;
    subtitle: string;
    metaDescription: string;
    all: string;
    categories: {
      software: string;
      data: string;
      ai: string;
      product: string;
    };
    filterGroups: {
      type: string;
      area: string;
      tech: string;
    };
    types: {
      work: string;
      personal: string;
    };
    clearAll: string;
    showFilters: string;
    hideFilters: string;
    resultsCountOne: string;
    resultsCountMany: string;
    viewDemo: string;
    viewCode: string;
    moreDetails: string;
    closeDetails: string;
    keyHighlights: string;
    noProjects: string;
  };
}

export interface RawDictionary {
  nav: {
    whoAmI: LocalizedString;
    skills: LocalizedString;
    timeline: LocalizedString;
    projects: LocalizedString;
  };
  hero: {
    greeting: LocalizedString;
    ctaProjects: LocalizedString;
    ctaContact: LocalizedString;
  };
  footer: {
    tagline: LocalizedString;
    rights: LocalizedString;
  };
  radar: {
    curiosity: LocalizedString;
    observation: LocalizedString;
    structure: LocalizedString;
    chaosMgmt: LocalizedString;
    bureaucracy: LocalizedString;
    formalism: LocalizedString;
  };
  whoAmI: {
    title: LocalizedString;
    subtitle: LocalizedString;
    chartTitle: LocalizedString;
  };
  skills: {
    title: LocalizedString;
    subtitle: LocalizedString;
  };
  timeline: {
    title: LocalizedString;
    subtitle: LocalizedString;
    repositoryLabel: LocalizedString;
    commitLabel: LocalizedString;
    mergeLabel: LocalizedString;
    branchLabel: LocalizedString;
    headLabel: LocalizedString;
    wipLabel: LocalizedString;
    forecastLabel: LocalizedString;
    historyLabel: LocalizedString;
    stagingLabel: LocalizedString;
    scrollHint: LocalizedString;
  };
  contact: {
    downloadCv: LocalizedString;
  };
  projects: {
    title: LocalizedString;
    subtitle: LocalizedString;
    metaDescription: LocalizedString;
    all: LocalizedString;
    categories: {
      software: LocalizedString;
      data: LocalizedString;
      ai: LocalizedString;
      product: LocalizedString;
    };
    filterGroups: {
      type: LocalizedString;
      area: LocalizedString;
      tech: LocalizedString;
    };
    types: {
      work: LocalizedString;
      personal: LocalizedString;
    };
    clearAll: LocalizedString;
    showFilters: LocalizedString;
    hideFilters: LocalizedString;
    resultsCountOne: LocalizedString;
    resultsCountMany: LocalizedString;
    viewDemo: LocalizedString;
    viewCode: LocalizedString;
    moreDetails: LocalizedString;
    closeDetails: LocalizedString;
    keyHighlights: LocalizedString;
    noProjects: LocalizedString;
  };
}

export interface PortfolioContent {
  personal: PersonalInfo;
  ui: RawDictionary;
  identity: {
    radarProfile: RadarAxis[];
  };
  skills: {
    hard: HardSkill[];
    soft: SoftSkill[];
    languages: LanguageSkill[];
  };
  brain: BrainContent;
  careerRepository: CareerRepository;
  contact: ContactInfo;
  projects: ProjectItem[];
}
