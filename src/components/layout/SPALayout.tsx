"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import type { Dictionary } from "@/lib/i18n";
import type { LocalizedPortfolioData } from "@/lib/data";
import Header from "./Header";
import Footer from "./Footer";
import { SPAContext, SectionType } from "./SPAContext";
import InteractiveNetwork from "../effects/InteractiveNetwork";
import SmartLoader from "../effects/SmartLoader";
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
import UnderConstruction from "../sections/UnderConstruction/UnderConstruction";
import type { ConstructionMode } from "../effects/renderers/ConstructionParticleRenderer";

import layoutStyles from "./SPALayout.module.css";

interface SPALayoutProps {
  lang: string;
  dict: Dictionary;
  data: LocalizedPortfolioData;
  initialSection: SectionType;
}

export default function SPALayout({
  lang,
  dict,
  data,
  initialSection
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
  const [showLoader, setShowLoader] = useState(true);
  
  // Venn Diagram states shared via context
  const [hoveredVennCircle, setHoveredVennCircle] = useState<number | null>(null);
  const [activeVennCircles, setActiveVennCircles] = useState<number[]>([]);
  const [selectedVennCircle, setSelectedVennCircle] = useState<number | null>(null);
  const [constructionMode, setConstructionMode] = useState<ConstructionMode>("lemniscate");
  
  const isTransitioningRef = useRef(false);
  const activeSectionRef = useRef<SectionType>(initialSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // Sync section state if initialSection changes (e.g. initial server load or language switch)
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const changeSection = useCallback((targetSection: SectionType, pushState = true) => {
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
      }
    });

    // 1. Animate out the active section
    if (currentEl) {
      tl.to(currentEl, {
        opacity: 0,
        y: -20,
        scale: 0.96,
        filter: "blur(6px)",
        duration: 0.45,
        ease: "power2.inOut"
      });
    }

    // 2. Animate in the target section
    if (nextEl) {
      tl.fromTo(nextEl,
        {
          opacity: 0,
          y: 25,
          scale: 0.98,
          filter: "blur(6px)"
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.55,
          ease: "power3.out"
        },
        "-=0.25" // overlap exit & entry for fluidity
      );
    }

    // 3. Update the address bar without reloading
    if (pushState) {
      const path = targetSection === "how-am-i" ? `/${lang}` : `/${lang}/${targetSection}`;
      window.history.pushState({ section: targetSection }, "", path);
    }

    // Reset Venn states when leaving how-am-i
    if (targetSection !== "how-am-i") {
      setHoveredVennCircle(null);
      setActiveVennCircles([]);
      setSelectedVennCircle(null);
    }
  }, [lang]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const pathSegments = window.location.pathname.split("/");
      const lastSegment = pathSegments[pathSegments.length - 1];
      
      // Determine target section
      const section: SectionType = 
        (lastSegment === lang || !lastSegment) ? "how-am-i" : (lastSegment as SectionType);

      if (["how-am-i", "skills", "timeline", "projects"].includes(section)) {
        changeSection(section, false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [lang, changeSection]);

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
    <>
      {showLoader && (
        <SmartLoader onComplete={() => setShowLoader(false)} />
      )}

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
        {!showLoader && (
          <InteractiveNetwork 
            activeSection={nextSection || activeSection}
            brainConcepts={data.brain.concepts}
            brainRuntime={brainRuntime}
            timelineRuntime={timelineRuntime}
          />
        )}

        <main id="main-content" className={layoutStyles.main}>
          <div className={layoutStyles.viewport}>
            {/* How Am I Section (Venn Diagram) */}
            <div
              id="section-how-am-i"
              className={layoutStyles.sectionLayer}
              style={getSectionStyle("how-am-i")}
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
                isActive={activeSection === "skills" && !showLoader}
              />
            </div>

            {/* Timeline / Under Construction Section */}
            <div
              id="section-timeline"
              className={layoutStyles.sectionLayer}
              style={getSectionStyle("timeline")}
            >
              <UnderConstruction dict={dict} lang={lang} />
            </div>


            {/* Projects / Under Construction Section */}
            <div
              id="section-projects"
              className={layoutStyles.sectionLayer}
              style={getSectionStyle("projects")}
            >
              <UnderConstruction dict={dict} lang={lang} />
            </div>

          </div>
        </main>

        <Footer dict={dict} personal={data.personal} lang={lang} />
      </SPAContext.Provider>
    </>
  );
}
