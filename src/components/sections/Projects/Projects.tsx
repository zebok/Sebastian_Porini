"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowUpRight, ExternalLink, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { LocalizedProject } from "@/lib/data";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import {
  getProjectCategoryStyle,
  type ProjectsRuntime,
} from "@/components/visualizations/Projects.runtime";
import styles from "./Projects.module.css";

interface ProjectsProps {
  dict: Dictionary;
  projects: LocalizedProject[];
  projectsRuntime?: ProjectsRuntime;
  isActive?: boolean;
  lang?: string;
}

interface ConceptCallout {
  label: { es: string; en: string };
  top: string;
  left: string;
}

const PROJECT_CONCEPT_CALLOUTS: Record<string, ConceptCallout[]> = {
  "geological-data-platform": [
    {
      label: { es: "Ingesta AWS Lambda", en: "AWS Lambda Ingestion" },
      top: "13%",
      left: "50%",
    },
    {
      label: { es: "SSOT PostgreSQL (RDS)", en: "SSOT PostgreSQL (RDS)" },
      top: "52%",
      left: "50%",
    },
    {
      label: { es: "Aislamiento VPC · IAM", en: "Private VPC · IAM" },
      top: "87%",
      left: "50%",
    },
  ],
  "attorney-scrapper": [
    {
      label: { es: "Fuentes Públicas", en: "Public Sources" },
      top: "26%",
      left: "21%",
    },
    {
      label: { es: "Motor de Similitud", en: "Similarity Engine" },
      top: "74%",
      left: "45%",
    },
    {
      label: { es: "Human-in-the-Loop", en: "Human-in-the-Loop" },
      top: "16%",
      left: "60%",
    },
  ],
  "cloud-iac-hardening": [
    {
      label: { es: "Perímetro VPC Segmentado", en: "Segmented VPC Perimeter" },
      top: "14%",
      left: "44%",
    },
    {
      label: { es: "Núcleo AWS SAM / IaC", en: "AWS SAM / IaC Core" },
      top: "50%",
      left: "44%",
    },
    {
      label: { es: "CI/CD & Migraciones", en: "CI/CD & Migrations" },
      top: "64%",
      left: "80%",
    },
  ],
  "portfolio-cv-engine": [
    {
      label: { es: "Modelo Único JSON (SSOT)", en: "Single JSON Model (SSOT)" },
      top: "50%",
      left: "26%",
    },
    {
      label: { es: "Canvas 2D & GSAP", en: "Canvas 2D & GSAP" },
      top: "20%",
      left: "76%",
    },
    {
      label: { es: "Motor de CVs en PDF", en: "Automated PDF Engine" },
      top: "80%",
      left: "76%",
    },
  ],
};

export default function Projects({
  dict,
  projects,
  projectsRuntime,
  isActive = true,
  lang = "es",
}: ProjectsProps) {
  const prefersReducedMotion = useReducedMotionPreference();
  const isEs = lang === "es";

  // Starts null so particles float freely in the stage until a project is clicked
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

  const focusTag = hoveredTag ?? selectedTag;

  const activeProject = useMemo(
    () =>
      activeProjectId
        ? projects.find((p) => p.id === activeProjectId) ?? null
        : null,
    [projects, activeProjectId]
  );

  // Count how many projects share each tag
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => {
      p.tags.forEach((t) => {
        map.set(t, (map.get(t) ?? 0) + 1);
      });
    });
    return map;
  }, [projects]);

  // All unique tags ordered by shared count first (for idle footer state)
  const allUniqueTags = useMemo(() => {
    const unique = Array.from(tagCounts.keys());
    return unique.sort(
      (a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0)
    );
  }, [tagCounts]);

  const displayedTags = activeProject ? activeProject.tags : allUniqueTags;

  // Sync state with shared canvas particle runtime
  const syncRuntime = useCallback(() => {
    if (!projectsRuntime) return;
    projectsRuntime.stateRef.current = {
      enabled: isActive,
      activeProjectId,
      hoveredProjectId,
      selectedTag,
      hoveredTag,
      projects: projects.map((p) => ({
        id: p.id,
        category: p.category,
        projectType: p.projectType,
        tags: p.tags,
      })),
      reducedMotion: prefersReducedMotion,
    };
    projectsRuntime.requestRenderRef.current();
  }, [
    projectsRuntime,
    isActive,
    activeProjectId,
    hoveredProjectId,
    selectedTag,
    hoveredTag,
    projects,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    syncRuntime();
  }, [syncRuntime]);

  // Clear transient hover states when leaving section
  useEffect(() => {
    if (!isActive) {
      setHoveredProjectId(null);
      setHoveredTag(null);
    }
  }, [isActive]);

  const handleToggleProject = useCallback(
    (proj: LocalizedProject) => {
      setActiveProjectId((prev) => {
        const next = prev === proj.id ? null : proj.id;
        if (next && selectedTag && !proj.tags.includes(selectedTag)) {
          setSelectedTag(null);
        }
        return next;
      });
    },
    [selectedTag]
  );

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  // Keyboard navigation (Up/Down to switch projects, Escape to release back to free-floating)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (selectedTag !== null) {
          e.preventDefault();
          setSelectedTag(null);
          return;
        }
        if (activeProjectId !== null) {
          e.preventDefault();
          setActiveProjectId(null);
          return;
        }
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!activeProjectId) {
          const first =
            e.key === "ArrowDown"
              ? projects[0]
              : projects[projects.length - 1];
          if (first) setActiveProjectId(first.id);
          return;
        }
        const currentIdx = projects.findIndex((p) => p.id === activeProjectId);
        if (currentIdx === -1) return;
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          (currentIdx + delta + projects.length) % projects.length;
        handleToggleProject(projects[nextIdx]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, selectedTag, activeProjectId, projects, handleToggleProject]);

  const activeStyle = getProjectCategoryStyle(
    activeProject?.category ?? "data"
  );
  const conceptCallouts = activeProject
    ? PROJECT_CONCEPT_CALLOUTS[activeProject.id] ?? []
    : [];

  const privateLabel = isEs
    ? "Trabajo Profesional · Código Privado"
    : "Professional Work · Private Code";
  const publicShortLabel = "GitHub";
  const privateShortLabel = isEs ? "Privado" : "Private";
  const stagePrompt = isEs
    ? "Hacé clic en un proyecto para reagrupar las partículas en su arquitectura"
    : "Click a project to regroup the particles into its architecture";

  return (
    <section className={styles.section} aria-label={dict.projects.title}>
      <div className={styles.stage}>
        {/* ─── LEFT COLUMN: CLEAN EDITORIAL INDEX (No connection dots) ──── */}
        <nav
          className={styles.indexCol}
          aria-label={isEs ? "Índice de proyectos" : "Projects index"}
        >
          {projects.map((proj, idx) => {
            const style = getProjectCategoryStyle(proj.category);
            const isSelected = proj.id === activeProjectId;
            const isTagMatch =
              focusTag !== null && proj.tags.includes(focusTag);
            const isDimmed = focusTag !== null && !isTagMatch;
            const projCategoryLabel =
              dict.projects.categories[
                proj.category as keyof typeof dict.projects.categories
              ] || proj.category;
            const isPublic = Boolean(proj.codeUrl);

            return (
              <button
                key={proj.id}
                type="button"
                className={`${styles.indexItem} ${
                  isSelected ? styles.indexItemActive : ""
                } ${isTagMatch ? styles.indexItemTagMatch : ""} ${
                  isDimmed ? styles.indexItemDimmed : ""
                }`}
                style={
                  isSelected
                    ? { borderLeftColor: style.color }
                    : isTagMatch
                    ? { borderLeftColor: `${style.color}77` }
                    : undefined
                }
                onClick={() => handleToggleProject(proj)}
                onMouseEnter={() => setHoveredProjectId(proj.id)}
                onMouseLeave={() => setHoveredProjectId(null)}
                onFocus={() => setHoveredProjectId(proj.id)}
                onBlur={() => setHoveredProjectId(null)}
                aria-pressed={isSelected}
              >
                <div
                  className={styles.indexTextBlock}
                  data-projects-readability-zone="true"
                >
                  <div className={styles.indexMetaRow}>
                    <span className={styles.indexNumber}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={styles.indexCategory}
                      style={{ color: style.inkColor }}
                    >
                      {projCategoryLabel}
                    </span>
                    <span className={styles.metaSep} aria-hidden="true">
                      ·
                    </span>
                    <span className={styles.indexNature}>
                      {isPublic ? (
                        <>
                          <ArrowUpRight size={11} />
                          <span>{publicShortLabel}</span>
                        </>
                      ) : (
                        <>
                          <Lock size={10} />
                          <span>{privateShortLabel}</span>
                        </>
                      )}
                    </span>
                    {isTagMatch && (
                      <span
                        className={styles.indexMatchedTag}
                        style={{
                          borderColor: `${style.color}66`,
                          color: style.inkColor,
                          backgroundColor: `${style.color}12`,
                        }}
                      >
                        {focusTag}
                      </span>
                    )}
                  </div>

                  <span className={styles.indexTitle}>{proj.title}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* ─── RIGHT COLUMN: PARTICLE PROTAGONIST STAGE + ORDERED FOOTER ── */}
        <div className={styles.rightCol}>
          {/* 1. Protagonist Particle Stage */}
          <div
            id="projects-particle-stage"
            className={styles.particleStage}
            onClick={() => {
              if (activeProjectId !== null) setActiveProjectId(null);
            }}
          >
            <AnimatePresence mode="wait">
              {activeProject ? (
                <motion.div
                  key={`callouts-${activeProject.id}`}
                  className={styles.calloutsLayer}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {conceptCallouts.map((callout, idx) => (
                    <motion.span
                      key={callout.label.en}
                      className={styles.conceptCallout}
                      data-projects-readability-zone="true"
                      style={{
                        top: callout.top,
                        left: callout.left,
                        borderColor: `${activeStyle.color}55`,
                        color: activeStyle.inkColor,
                      }}
                      initial={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : { opacity: 0, scale: 0.88 }
                      }
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: prefersReducedMotion ? 0 : 0.14 + idx * 0.08,
                        duration: 0.32,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <span
                        className={styles.calloutDot}
                        style={{ backgroundColor: activeStyle.color }}
                      />
                      <span>
                        {isEs ? callout.label.es : callout.label.en}
                      </span>
                    </motion.span>
                  ))}
                </motion.div>
              ) : (
                <motion.p
                  key="idle-prompt"
                  className={styles.stageIdleHint}
                  data-projects-readability-zone="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {stagePrompt}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* 2. Ordered Footer Dock: Summary/Links + Technologies */}
          <footer
            className={styles.stageFooter}
            data-projects-readability-zone="true"
          >
            <AnimatePresence mode="wait">
              {activeProject && (
                <motion.div
                  key={`footer-meta-${activeProject.id}`}
                  className={styles.footerTopRow}
                  initial={
                    prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -4 }
                  }
                  transition={{ duration: 0.22 }}
                >
                  <p className={styles.footerDesc}>
                    {activeProject.description}
                  </p>

                  <div className={styles.footerLinks}>
                    {activeProject.codeUrl ? (
                      <a
                        href={activeProject.codeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.repoLinkPill}
                        style={{ borderColor: `${activeStyle.color}66` }}
                      >
                        <span>GitHub · {dict.projects.viewCode}</span>
                        <ArrowUpRight size={13} />
                      </a>
                    ) : (
                      <span className={styles.privateBadge}>
                        <Lock size={11} />
                        <span>{privateLabel}</span>
                      </span>
                    )}

                    {activeProject.demoUrl && activeProject.demoUrl !== "#" && (
                      <a
                        href={activeProject.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.repoLinkPill}
                      >
                        <span>{dict.projects.viewDemo}</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={styles.tagsRow}>
              {displayedTags.map((tag, idx) => {
                const isPinned = selectedTag === tag;
                const isFocused = focusTag === tag;
                const sharedCount = tagCounts.get(tag) ?? 1;

                return (
                  <button
                    key={tag}
                    id={`project-tag-${idx}`}
                    type="button"
                    data-project-tag={tag}
                    className={`${styles.tagPill} ${
                      isFocused ? styles.tagPillActive : ""
                    }`}
                    style={
                      isFocused
                        ? {
                            borderColor: activeStyle.color,
                            color: activeStyle.inkColor,
                            boxShadow: `0 0 14px ${activeStyle.color}28`,
                          }
                        : undefined
                    }
                    onClick={() => handleToggleTag(tag)}
                    onMouseEnter={() => setHoveredTag(tag)}
                    onMouseLeave={() => setHoveredTag(null)}
                    onFocus={() => setHoveredTag(tag)}
                    onBlur={() => setHoveredTag(null)}
                    aria-pressed={isPinned}
                  >
                    <span>{tag}</span>
                    {sharedCount > 1 && (
                      <span
                        className={styles.tagSharedCount}
                        style={
                          isFocused
                            ? {
                                backgroundColor: activeStyle.color,
                                color: "#ffffff",
                              }
                            : undefined
                        }
                        title={
                          isEs
                            ? `Compartido en ${sharedCount} proyectos`
                            : `Shared across ${sharedCount} projects`
                        }
                      >
                        {sharedCount}
                      </span>
                    )}
                    {isPinned && (
                      <X
                        size={11}
                        className={styles.tagClearIcon}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}
