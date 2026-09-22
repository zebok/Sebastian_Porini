"use client";

import { createContext, useContext } from "react";
import type { ConstructionMode } from "../effects/renderers/ConstructionParticleRenderer";

export type SectionType = "how-am-i" | "skills" | "timeline" | "projects";

interface SPAContextProps {
  activeSection: SectionType;
  setActiveSection: (section: SectionType) => void;
  isTransitioning: boolean;
  hoveredVennCircle: number | null;
  setHoveredVennCircle: (circle: number | null) => void;
  activeVennCircles: number[];
  setActiveVennCircles: (circles: number[]) => void;
  selectedVennCircle: number | null;
  setSelectedVennCircle: (circle: number | null) => void;
  constructionMode: ConstructionMode;
  setConstructionMode: (mode: ConstructionMode) => void;
}

export const SPAContext = createContext<SPAContextProps | undefined>(undefined);

export const useSPA = () => {
  const context = useContext(SPAContext);
  return context;
};

