"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ChevronDown, Filter } from "lucide-react";
import { Dictionary } from "@/lib/i18n";
import { LocalizedProject } from "@/lib/data";
import styles from "./Projects.module.css";
import { CategoryVisual } from "./CategoryVisual";
import { FilterGroupOptions } from "./FilterGroupOptions";
import { ProjectDetailsModal } from "./ProjectDetailsModal";

interface ProjectsProps {
  dict: Dictionary;
  projects: LocalizedProject[];
}

export default function Projects({ dict, projects }: ProjectsProps) {
  // Filter States
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);

  // Desktop Dropdown Open State: "type" | "area" | "tech" | null
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Accordion Collapse States (for mobile drawer only)
  const [typeExpanded, setTypeExpanded] = useState<boolean>(true);
  const [areaExpanded, setAreaExpanded] = useState<boolean>(true);
  const [techExpanded, setTechExpanded] = useState<boolean>(true);

  // Mobile Drawer State
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Details Modal State
  const [selectedProject, setSelectedProject] = useState<LocalizedProject | null>(null);

  // Consolidated Ref for Click Outside Detection (Faceted Dropdowns selector bar)
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Technologies List (Prominent tags from content)
  const filterTechs = [
    "TypeScript",
    "JavaScript",
    "Python",
    "SQL",
    "AWS SAM",
    "D3.js",
    "Google Apps Script"
  ];

  // Close dropdowns on clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterBarRef.current && !filterBarRef.current.contains(target)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtering Logic: OR within groups, AND across groups
  const filteredProjects = projects.filter(p => {
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(p.projectType);
    const matchesArea = selectedAreas.length === 0 || selectedAreas.includes(p.category);
    const matchesTech = selectedTechs.length === 0 || p.tags.some(t => selectedTechs.includes(t));
    return matchesType && matchesArea && matchesTech;
  });

  // Dynamic count helpers showing intersection quantity
  const getCountForType = (type: string) => {
    return projects.filter(p => {
      const matchesArea = selectedAreas.length === 0 || selectedAreas.includes(p.category);
      const matchesTech = selectedTechs.length === 0 || p.tags.some(t => selectedTechs.includes(t));
      return p.projectType === type && matchesArea && matchesTech;
    }).length;
  };

  const getCountForArea = (area: string) => {
    return projects.filter(p => {
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(p.projectType);
      const matchesTech = selectedTechs.length === 0 || p.tags.some(t => selectedTechs.includes(t));
      return p.category === area && matchesType && matchesTech;
    }).length;
  };

  const getCountForTech = (tech: string) => {
    return projects.filter(p => {
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(p.projectType);
      const matchesArea = selectedAreas.length === 0 || selectedAreas.includes(p.category);
      return p.tags.includes(tech) && matchesType && matchesArea;
    }).length;
  };

  // Toggle handlers
  const handleToggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleToggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleToggleTech = (tech: string) => {
    setSelectedTechs(prev =>
      prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
    );
  };

  const filterProps = {
    selectedTypes,
    selectedAreas,
    selectedTechs,
    filterTechs,
    dict,
    getCountForType,
    getCountForArea,
    getCountForTech,
    handleToggleType,
    handleToggleArea,
    handleToggleTech,
  };

  const handleClearFilters = () => {
    setSelectedTypes([]);
    setSelectedAreas([]);
    setSelectedTechs([]);
    setActiveDropdown(null);
  };

  const isAnyFilterActive = selectedTypes.length > 0 || selectedAreas.length > 0 || selectedTechs.length > 0;

  // Results Text singular/plural
  const resultsCountText = filteredProjects.length === 1
    ? dict.projects.resultsCountOne
    : dict.projects.resultsCountMany.replace("{count}", filteredProjects.length.toString());

  // Variants for Grid and Cards
  const gridVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  } as const;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.45,
        ease: "easeOut" as const,
      },
    },
  } as const;

  // Dropdown fade animation variants
  const dropdownVariants = {
    hidden: { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.15, ease: "easeOut" as const }
    },
    exit: {
      opacity: 0,
      y: 8,
      transition: { duration: 0.1, ease: "easeIn" as const }
    }
  } as const;

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        {/* Title and Subtitle */}
        <div className={styles.header}>
          <h1 className={styles.title}>{dict.projects.title}</h1>
          <p className={styles.subtitle}>{dict.projects.subtitle}</p>
        </div>

        {/* Faceted Top Dropdowns selector bar */}
        <div className={styles.filterBar} ref={filterBarRef}>
          {/* Project Type Dropdown */}
          <div className={styles.dropdownContainer}>
            <button
              className={`${styles.dropdownBtn} ${activeDropdown === "type" ? styles.dropdownBtnActive : ""}`}
              onClick={() => setActiveDropdown(activeDropdown === "type" ? null : "type")}
            >
              <span>
                {dict.projects.filterGroups.type}
                {selectedTypes.length > 0 && ` (${selectedTypes.length})`}
              </span>
              <ChevronDown size={14} className={`${styles.chevron} ${activeDropdown === "type" ? styles.chevronRotated : ""}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === "type" && (
                <motion.div
                  className={styles.dropdownMenu}
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  <FilterGroupOptions type="type" {...filterProps} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Project Area Dropdown */}
          <div className={styles.dropdownContainer}>
            <button
              className={`${styles.dropdownBtn} ${activeDropdown === "area" ? styles.dropdownBtnActive : ""}`}
              onClick={() => setActiveDropdown(activeDropdown === "area" ? null : "area")}
            >
              <span>
                {dict.projects.filterGroups.area}
                {selectedAreas.length > 0 && ` (${selectedAreas.length})`}
              </span>
              <ChevronDown size={14} className={`${styles.chevron} ${activeDropdown === "area" ? styles.chevronRotated : ""}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === "area" && (
                <motion.div
                  className={styles.dropdownMenu}
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  <FilterGroupOptions type="area" {...filterProps} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Project Technology Dropdown */}
          <div className={styles.dropdownContainer}>
            <button
              className={`${styles.dropdownBtn} ${activeDropdown === "tech" ? styles.dropdownBtnActive : ""}`}
              onClick={() => setActiveDropdown(activeDropdown === "tech" ? null : "tech")}
            >
              <span>
                {dict.projects.filterGroups.tech}
                {selectedTechs.length > 0 && ` (${selectedTechs.length})`}
              </span>
              <ChevronDown size={14} className={`${styles.chevron} ${activeDropdown === "tech" ? styles.chevronRotated : ""}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === "tech" && (
                <motion.div
                  className={styles.dropdownMenu}
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  <FilterGroupOptions type="tech" {...filterProps} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Results Bar */}
        <div className={styles.resultsBar}>
          <span className={styles.resultsCount}>
            {resultsCountText}
          </span>
          {isAnyFilterActive && (
            <button className={styles.clearAllBtn} onClick={handleClearFilters}>
              {dict.projects.clearAll}
            </button>
          )}
        </div>

        {/* Cards Grid */}
        <AnimatePresence mode="wait">
          {filteredProjects.length > 0 ? (
            <motion.div
              key={`${selectedTypes.join("-")}-${selectedAreas.join("-")}-${selectedTechs.join("-")}`}
              className={styles.grid}
              variants={gridVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              {filteredProjects.map((project) => (
                <motion.div
                  key={project.id}
                  className={styles.card}
                  variants={cardVariants}
                  onClick={() => setSelectedProject(project)}
                  layout
                >
                  <div className={styles.cardVisual}>
                    <CategoryVisual category={project.category} />
                  </div>

                  <div className={styles.cardBody}>
                    <span className={styles.cardCategory}>
                      {dict.projects.categories[project.category as keyof typeof dict.projects.categories] || project.category}
                    </span>
                    <h3 className={styles.cardTitle}>{project.title}</h3>
                    <p className={styles.cardDesc}>{project.description}</p>

                    <div className={styles.cardFooter}>
                      <span className={styles.tagPreview}>
                        {project.tags.slice(0, 3).join(" • ")}
                      </span>
                      <button className={styles.moreInfoBtn}>
                        {dict.projects.moreDetails} <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className={styles.noProjects}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p>{dict.projects.noProjects}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating mobile filter button */}
      <button className={styles.mobileFiltersBtn} onClick={() => setIsMobileDrawerOpen(true)}>
        <Filter size={16} />
        {dict.projects.showFilters} {isAnyFilterActive && `(${selectedTypes.length + selectedAreas.length + selectedTechs.length})`}
      </button>

      {/* Mobile Drawer Overlay and Panel */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <>
            <motion.div
              className={styles.drawerOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <motion.div
              className={styles.drawerContent}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
            >
              <div className={styles.drawerHeader}>
                <h3 className={styles.drawerTitle}>{dict.projects.title}</h3>
                <button className={styles.drawerCloseBtn} onClick={() => setIsMobileDrawerOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.drawerBody}>
                {/* Mobile accordion filters */}
                <div className={styles.mobileFilterGroup}>
                  <button className={styles.mobileGroupHeader} onClick={() => setTypeExpanded(!typeExpanded)}>
                    <span className={styles.mobileGroupTitle}>{dict.projects.filterGroups.type}</span>
                    <ChevronDown size={15} className={`${styles.chevron} ${typeExpanded ? styles.chevronRotated : ""}`} />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: typeExpanded ? "auto" : 0, opacity: typeExpanded ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={styles.mobileGroupOptions}
                    style={{ pointerEvents: typeExpanded ? "auto" : "none" }}
                  >
                    <FilterGroupOptions type="type" {...filterProps} />
                  </motion.div>
                </div>

                <div className={styles.mobileFilterGroup}>
                  <button className={styles.mobileGroupHeader} onClick={() => setAreaExpanded(!areaExpanded)}>
                    <span className={styles.mobileGroupTitle}>{dict.projects.filterGroups.area}</span>
                    <ChevronDown size={15} className={`${styles.chevron} ${areaExpanded ? styles.chevronRotated : ""}`} />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: areaExpanded ? "auto" : 0, opacity: areaExpanded ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={styles.mobileGroupOptions}
                    style={{ pointerEvents: areaExpanded ? "auto" : "none" }}
                  >
                    <FilterGroupOptions type="area" {...filterProps} />
                  </motion.div>
                </div>

                <div className={styles.mobileFilterGroup}>
                  <button className={styles.mobileGroupHeader} onClick={() => setTechExpanded(!techExpanded)}>
                    <span className={styles.mobileGroupTitle}>{dict.projects.filterGroups.tech}</span>
                    <ChevronDown size={15} className={`${styles.chevron} ${techExpanded ? styles.chevronRotated : ""}`} />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: techExpanded ? "auto" : 0, opacity: techExpanded ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={styles.mobileGroupOptions}
                    style={{ pointerEvents: techExpanded ? "auto" : "none" }}
                  >
                    <FilterGroupOptions type="tech" {...filterProps} />
                  </motion.div>
                </div>
              </div>

              <div className={styles.drawerFooter}>
                {isAnyFilterActive && (
                  <button className={styles.secondaryBtn} onClick={handleClearFilters}>
                    {dict.projects.clearAll}
                  </button>
                )}
                <button className={styles.primaryBtn} onClick={() => setIsMobileDrawerOpen(false)}>
                  OK ({filteredProjects.length})
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>      {/* Project Details Modal Pop-up */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailsModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            dict={dict}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
