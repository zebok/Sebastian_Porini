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

export default function Projects({
  dict,
  projects,
  projectsRuntime,
  isActive = true,
  lang = "es",
}: ProjectsProps) {
  const prefersReducedMotion = useReducedMotionPreference();
  const isEs = lang === "es";

  const [activeProjectId, setActiveProjectId] = useState<string>(
    projects[0]?.id ?? "geological-data-platform"
  );
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

  const focusTag = hoveredTag ?? selectedTag;

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0],
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

  // Sync state with shared canvas particle runtime
  const syncRuntime = useCallback(() => {
    if (!projectsRuntime) return;
    projectsRuntime.stateRef.current = {
      enabled: isActive,
      activeProjectId: activeProject?.id ?? "",
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
    activeProject,
    hoveredProjectId,
    selectedTag,
    hoveredTag,
    projects,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    syncRuntime();
  }, [syncRuntime]);

  // Clear transient hover/tag states when leaving section
  useEffect(() => {
    if (!isActive) {
      setHoveredProjectId(null);
      setHoveredTag(null);
    }
  }, [isActive]);

  const handleSelectProject = useCallback(
    (proj: LocalizedProject) => {
      setActiveProjectId(proj.id);
      if (selectedTag && !proj.tags.includes(selectedTag)) {
        setSelectedTag(null);
      }
    },
    [selectedTag]
  );

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  // Keyboard navigation (Up/Down to switch projects, Escape to clear selected tag)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Escape" && selectedTag !== null) {
        e.preventDefault();
        setSelectedTag(null);
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = projects.findIndex(
          (p) => p.id === activeProject?.id
        );
        if (currentIdx === -1) return;
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          (currentIdx + delta + projects.length) % projects.length;
        handleSelectProject(projects[nextIdx]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, selectedTag, projects, activeProject, handleSelectProject]);

  if (!activeProject) return null;

  const activeStyle = getProjectCategoryStyle(activeProject.category);
  const categoryLabel =
    dict.projects.categories[
      activeProject.category as keyof typeof dict.projects.categories
    ] || activeProject.category;

  const privateLabel = isEs
    ? "Trabajo Profesional · Código Privado"
    : "Professional Work · Private Code";
  const publicShortLabel = "GitHub";
  const privateShortLabel = isEs ? "Privado" : "Private";

  return (
    <section className={styles.section} aria-label={dict.projects.title}>
      <div className={styles.stage}>
        {/* ─── LEFT COLUMN: EDITORIAL INDEX ─────────────────────────────── */}
        <nav
          className={styles.indexCol}
          aria-label={isEs ? "Índice de proyectos" : "Projects index"}
        >
          {projects.map((proj, idx) => {
            const style = getProjectCategoryStyle(proj.category);
            const isSelected = proj.id === activeProject.id;
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
                onClick={() => handleSelectProject(proj)}
                onMouseEnter={() => setHoveredProjectId(proj.id)}
                onMouseLeave={() => setHoveredProjectId(null)}
                onFocus={() => setHoveredProjectId(proj.id)}
                onBlur={() => setHoveredProjectId(null)}
                aria-current={isSelected ? "true" : undefined}
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

                {/* Node marker on the inner channel edge where canvas particles orbit */}
                <span
                  id={`project-node-${proj.id}`}
                  className={`${styles.nodeMarker} ${
                    isSelected || isTagMatch ? styles.nodeMarkerActive : ""
                  }`}
                  style={{
                    borderColor: style.color,
                    color: style.color,
                  }}
                  aria-hidden="true"
                >
                  <span
                    className={styles.nodeInnerCore}
                    style={{ backgroundColor: style.color }}
                  />
                </span>
              </button>
            );
          })}
        </nav>

        {/* ─── RIGHT COLUMN: ACTIVE PROJECT STAGE ───────────────────────── */}
        <div className={styles.detailCol}>
          <AnimatePresence mode="wait">
            <motion.article
              key={activeProject.id}
              className={styles.detailArticle}
              initial={
                prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }
              }
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Meta & Nature Row */}
              <div
                className={styles.detailHeader}
                data-projects-readability-zone="true"
              >
                <div className={styles.detailMetaRow}>
                  <span className={styles.categoryIndicator}>
                    <span
                      className={styles.categoryDot}
                      style={{ backgroundColor: activeStyle.color }}
                    />
                    <span style={{ color: activeStyle.inkColor }}>
                      {categoryLabel}
                    </span>
                  </span>

                  {activeProject.codeUrl ? (
                    <a
                      href={activeProject.codeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.repoLinkPill}
                      style={{
                        borderColor: `${activeStyle.color}55`,
                      }}
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

                <h2 className={styles.detailTitle}>{activeProject.title}</h2>
                <p className={styles.detailDesc}>{activeProject.description}</p>
              </div>

              {/* 3 Concise Architectural Highlights receiving particle filaments */}
              <ul className={styles.highlightsList}>
                {activeProject.highlights.map((highlight, idx) => (
                  <li key={idx} className={styles.highlightItem}>
                    <span
                      id={`project-highlight-${idx}`}
                      className={styles.highlightDot}
                      style={{
                        borderColor: activeStyle.color,
                        backgroundColor: `${activeStyle.color}22`,
                      }}
                      aria-hidden="true"
                    />
                    <span
                      className={styles.highlightText}
                      data-projects-readability-zone="true"
                    >
                      {highlight}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Interactive Stack Tags (click or hover to illuminate shared projects) */}
              <div className={styles.tagsSection}>
                <div className={styles.tagsRow}>
                  {activeProject.tags.map((tag, idx) => {
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
                                boxShadow: `0 0 18px ${activeStyle.color}30`,
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
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
