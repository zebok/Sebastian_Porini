export interface ProjectsRgb {
  r: number;
  g: number;
  b: number;
}

export interface ProjectCategoryStyle {
  color: string;
  inkColor: string;
  rgb: ProjectsRgb;
}

export const PROJECT_CATEGORY_STYLE: Record<string, ProjectCategoryStyle> = {
  data: {
    color: "#2d5be3",
    inkColor: "#2449b8",
    rgb: { r: 45, g: 91, b: 227 },
  },
  software: {
    color: "#7c3aed",
    inkColor: "#6528c7",
    rgb: { r: 124, g: 58, b: 237 },
  },
  product: {
    color: "#059669",
    inkColor: "#047857",
    rgb: { r: 5, g: 150, b: 105 },
  },
  ai: {
    color: "#059669",
    inkColor: "#047857",
    rgb: { r: 5, g: 150, b: 105 },
  },
};

export const getProjectCategoryStyle = (
  category: string
): ProjectCategoryStyle => {
  return PROJECT_CATEGORY_STYLE[category] ?? PROJECT_CATEGORY_STYLE.data;
};

export interface ProjectsRuntimeItem {
  id: string;
  category: string;
  projectType: "work" | "personal";
  tags: string[];
}

export interface ProjectsRuntimeState {
  enabled: boolean;
  activeProjectId: string;
  hoveredProjectId: string | null;
  selectedTag: string | null;
  hoveredTag: string | null;
  projects: ProjectsRuntimeItem[];
  reducedMotion: boolean;
}

export interface ProjectsRuntime {
  stateRef: { current: ProjectsRuntimeState };
  requestRenderRef: { current: () => void };
}

export const createProjectsRuntime = (): ProjectsRuntime => ({
  stateRef: {
    current: {
      enabled: false,
      activeProjectId: "geological-data-platform",
      hoveredProjectId: null,
      selectedTag: null,
      hoveredTag: null,
      projects: [],
      reducedMotion: false,
    },
  },
  requestRenderRef: {
    current: () => undefined,
  },
});
