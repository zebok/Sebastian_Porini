"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import type { Dictionary } from "@/lib/i18n";
import type { LocalizedPortfolioData } from "@/lib/data";
import { BASE_PATH } from "@/lib/site";
import Header from "./Header";
import Footer from "./Footer";
import { SPAContext, SectionType } from "./SPAContext";
import InteractiveNetwork from "../effects/InteractiveNetwork";
import {
  createBrainRuntime,
  type BrainRuntime,
} from "../visualizations/BrainGraph.runtime";
import {
  createTimelineRuntime,
  type TimelineRuntime,
} from "../visualizations/Timeline.runtime";

// Import Section Components
import Hero from "../sections/Hero/Hero";
import Skills from "../sections/Skills/Skills";
import TimelinePage from "../sections/TimelinePage/TimelinePage";
import Projects from "../sections/Projects/Projects";
import type { ConstructionMode } from "../effects/renderers/ConstructionParticleRenderer";

import layoutStyles from "./SPALayout.module.css";

interface SPALayoutProps {
  lang: string;
  dict: Dictionary;
  data: LocalizedPortfolioData;
  initialSection: SectionType;
}

const VALID_SECTIONS: readonly SectionType[] = [
  "about",
  "skills",
  "timeline",
  "projects",
];

export default function SPALayout({
  lang,
  dict,
  data,
  initialSection,
}: SPALayoutProps) {
  const brainRuntimeRef = useRef<BrainRuntime | null>(null);
  if (brainRuntimeRef.current === null) {
    brainRuntimeRef.current = createBrainRuntime();
  }
  const brainRuntime = brainRuntimeRef.current;
  const timelineRuntimeRef = useRef<TimelineRuntime | null>(null);
  if (timelineRuntimeRef.current === null) {
    timelineRuntimeRef.current = createTimelineRuntime();
  }
  const timelineRuntime = timelineRuntimeRef.current;
  const [activeSection, setActiveSection] = useState<SectionType>(initialSection);
  const [nextSection, setNextSection] = useState<SectionType | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Venn Diagram states shared via context
  const [hoveredVennCircle, setHoveredVennCircle] = useState<number | null>(null);
  const [activeVennCircles, setActiveVennCircles] = useState<number[]>([]);
  const [selectedVennCircle, setSelectedVennCircle] = useState<number | null>(null);
  const [constructionMode, setConstructionMode] =
    useState<ConstructionMode>("lemniscate");

  const isTransitioningRef = useRef(false);
  const activeSectionRef = useRef<SectionType>(initialSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // Sync section state if initialSection changes (e.g. initial server load or language switch)
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const changeSection = useCallback(
    (targetSection: SectionType, pushState = true) => {
      const currentSec = activeSectionRef.current;
      if (isTransitioningRef.current || targetSection === currentSec) return;

      isTransitioningRef.current = true;
      setIsTransitioning(true);
      setNextSection(targetSection);

      const currentEl = document.getElementById(`section-${currentSec}`);
      const nextEl = document.getElementById(`section-${targetSection}`);

      const tl = gsap.timeline({
        onComplete: () => {
          setActiveSection(targetSection);
          setNextSection(null);
          isTransitioningRef.current = false;
          setIsTransitioning(false);
        },
      });

      // 1. Animate out the active section
      if (currentEl) {
        tl.to(currentEl, {
          opacity: 0,
          y: -16,
          duration: 0.3,
          ease: "power2.inOut",
        });
      }

      // 2. Animate in the target section
      if (nextEl) {
        tl.fromTo(
          nextEl,
          {
            opacity: 0,
            y: 18,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: "power3.out",
          },
          "-=0.18"
        );
      }

      // 3. Update the address bar without reloading, preserving NEXT_PUBLIC_BASE_PATH
      if (pushState) {
        const path =
          targetSection === "about" ? `/${lang}` : `/${lang}/${targetSection}`;
        window.history.pushState(
          { section: targetSection },
          "",
          `${BASE_PATH}${path}`
        );
      }

      // Reset Venn states when leaving about
      if (targetSection !== "about") {
        setHoveredVennCircle(null);
        setActiveVennCircles([]);
        setSelectedVennCircle(null);
      }
    },
    [lang]
  );

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const rawPathname = window.location.pathname;
      const pathnameWithoutBase =
        BASE_PATH && rawPathname.startsWith(BASE_PATH)
          ? rawPathname.slice(BASE_PATH.length) || "/"
          : rawPathname;
      const pathSegments = pathnameWithoutBase.split("/").filter(Boolean);
      const sectionSegment =
        pathSegments.length <= 1 ? "about" : pathSegments[1];

      if (VALID_SECTIONS.includes(sectionSegment as SectionType)) {
        changeSection(sectionSegment as SectionType, false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [changeSection]);

  const getSectionStyle = (id: SectionType): React.CSSProperties => {
    const isActive = activeSection === id;
    const isTarget = nextSection === id;
    const isVisible = isActive || isTarget;

    return {
      opacity: isActive ? 1 : 0,
      pointerEvents: isActive ? "auto" : "none",
      visibility: isVisible ? "visible" : "hidden",
      zIndex: isActive ? 1 : 0,
    };
  };

  return (
    <SPAContext.Provider
      value={{
        activeSection,
        setActiveSection: changeSection,
        isTransitioning,
        hoveredVennCircle,
        setHoveredVennCircle,
        activeVennCircles,
        setActiveVennCircles,
        selectedVennCircle,
        setSelectedVennCircle,
        constructionMode,
        setConstructionMode,
      }}
    >
      <Header dict={dict} cvPath={data.personal.contactDetails.cvPath} />

      {/* Background Network Layer */}
      <InteractiveNetwork
        activeSection={nextSection || activeSection}
        brainConcepts={data.brain.concepts}
        brainRuntime={brainRuntime}
        timelineRuntime={timelineRuntime}
      />

      <main id="main-content" className={layoutStyles.main}>
        <div className={layoutStyles.viewport}>
          {/* About Section (Venn Diagram) */}
          <div
            id="section-about"
            className={layoutStyles.sectionLayer}
            style={getSectionStyle("about")}
          >
            <Hero personal={data.personal} dict={dict} lang={lang} />
          </div>

          {/* Skills Section */}
          <div
            id="section-skills"
            className={layoutStyles.sectionLayer}
            style={getSectionStyle("skills")}
          >
            <Skills
              viewModel={data.brain}
              brainRuntime={brainRuntime}
              isActive={activeSection === "skills"}
            />
          </div>

          {/* Timeline Section */}
          <div
            id="section-timeline"
            className={layoutStyles.sectionLayer}
            style={getSectionStyle("timeline")}
          >
            <TimelinePage
              dict={dict}
              repository={data.careerRepository}
              timelineRuntime={timelineRuntime}
              isActive={activeSection === "timeline"}
              isTransitioningIn={nextSection === "timeline"}
              lang={lang}
            />
          </div>

          {/* Projects Section */}
          <div
            id="section-projects"
            className={layoutStyles.sectionLayer}
            style={getSectionStyle("projects")}
          >
            <Projects dict={dict} projects={data.projects} />
          </div>
        </div>
      </main>

      <Footer dict={dict} personal={data.personal} lang={lang} />
    </SPAContext.Provider>
  );
}
