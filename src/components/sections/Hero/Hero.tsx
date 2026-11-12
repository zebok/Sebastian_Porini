"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, FileDown, Mail } from "lucide-react";
import { useSPA } from "@/components/layout/SPAContext";
import { LocalizedPersonalInfo } from "@/lib/data";
import { Dictionary } from "@/lib/i18n";
import { getCvDownloadInfo } from "@/lib/cv";
import styles from "./Hero.module.css";

const AnimatedText = ({
  text,
  delay = 0,
  className = "",
  stagger = 0.02,
  style = {},
}: {
  text: string;
  delay?: number;
  className?: string;
  stagger?: number;
  style?: React.CSSProperties;
}) => {
  const chars = Array.from(text);

  return (
    <motion.div className={className} style={{ ...style, display: "inline-block" }}>
      {chars.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: 0.35,
            delay: delay + i * stagger,
            ease: [0.25, 1, 0.5, 1],
          }}
          style={{
            display: "inline-block",
            whiteSpace: char === " " ? "pre" : "normal",
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.div>
  );
};

interface HeroProps {
  personal: LocalizedPersonalInfo;
  dict?: Dictionary;
  lang?: string;
}

interface SegmentContentData {
  id: string;
  type: "home" | "circle" | "intersection";
  title?: string;
  description?: string;
  items?: string[];
  colorVar?: string;
  isActive?: boolean;
  name?: string;
  tagline?: string;
  valueProp?: string;
  email?: string;
  ctaProjectsLabel?: string;
  ctaContactLabel?: string;
  cvUrl?: string;
  downloadFilename?: string;
  downloadLabel?: string;
}

interface SegmentContentProps {
  content: SegmentContentData | null;
  onViewProjects?: () => void;
}

const SegmentContent = ({ content, onViewProjects }: SegmentContentProps) => {
  if (!content) return null;

  return (
    <motion.div
      className={styles.segmentContent}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {content.type === "home" ? (
        <div key="home-intro-inner" className={styles.segmentContent} style={{ width: "100%" }}>
          <h1 className={styles.name}>{content.name}</h1>
          <div className={styles.tagline}>{content.tagline}</div>
          {content.valueProp && (
            <p className={styles.valueProp}>{content.valueProp}</p>
          )}
          <div className={styles.heroCtaWrapper}>
            {onViewProjects && (
              <button
                type="button"
                onClick={onViewProjects}
                className={styles.heroPrimaryBtn}
              >
                <span>{content.ctaProjectsLabel}</span>
                <ArrowRight size={14} className={styles.heroBtnArrow} />
              </button>
            )}
            {content.cvUrl && (
              <a
                href={content.cvUrl}
                download={content.downloadFilename}
                className={styles.heroCvBtn}
              >
                <FileDown size={14} className={styles.heroCvIcon} />
                <span>{content.downloadLabel}</span>
                <span className={styles.heroPdfBadge}>PDF</span>
              </a>
            )}
            {content.email && (
              <a
                href={`mailto:${content.email}`}
                className={styles.heroContactLink}
              >
                <Mail size={14} />
                <span>{content.ctaContactLabel}</span>
              </a>
            )}
          </div>
        </div>
      ) : (
        <div
          key={`circle-inner-${content.id}`}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <motion.div
            layoutId={`venn-title-${content.id}`}
            className={styles.handwrittenTitle}
            style={{
              color: content.colorVar,
              textShadow: `0 0 25px ${content.colorVar}35`,
            }}
            transition={{
              type: "spring",
              stiffness: 38,
              damping: 13,
              mass: 1,
            }}
          >
            <AnimatedText text={content.title || ""} stagger={0.02} />
          </motion.div>

          <motion.div
            initial={false}
            animate={{
              height: content.isActive ? "auto" : 0,
              opacity: content.isActive ? 1 : 0,
              y: content.isActive ? 0 : -10,
              scale: content.isActive ? 1 : 0.98,
            }}
            transition={{
              duration: 0.6,
              ease: [0.16, 1, 0.3, 1],
              opacity: { duration: 0.45 },
            }}
            style={{ overflow: "hidden", transformOrigin: "top center", width: "100%" }}
          >
            {content.items && content.items.length > 0 && (
              <div className={styles.setContainer}>
                <div className={styles.itemsWrapper}>
                  {content.items.map((item: string, idx: number) => (
                    <motion.span
                      key={item}
                      className={styles.setItem}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
                      whileHover={{
                        y: -2,
                        borderColor: content.colorVar,
                        boxShadow: `0 4px 12px ${content.colorVar}30`,
                      }}
                    >
                      {item}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default function Hero({ personal, dict, lang = "en" }: HeroProps) {
  const spa = useSPA();

  const [localActive, setLocalActive] = useState<number[]>([]);
  const [localHover, setLocalHover] = useState<number | null>(null);
  const [localSelected, setLocalSelected] = useState<number | null>(null);

  const activeSegments = spa ? spa.activeVennCircles : localActive;
  const hoveredSegment = spa ? spa.hoveredVennCircle : localHover;
  const selectedSegment = spa ? spa.selectedVennCircle : localSelected;

  const setActiveSegments = (val: number[]) => {
    if (spa) spa.setActiveVennCircles(val);
    else setLocalActive(val);
  };

  const setHoveredSegment = (val: number | null) => {
    if (spa) spa.setHoveredVennCircle(val);
    else setLocalHover(val);
  };

  const setSelectedSegment = (val: number | null) => {
    if (spa) spa.setSelectedVennCircle(val);
    else setLocalSelected(val);
  };

  const heroRef = useRef<HTMLDivElement>(null);
  const focusData = personal.focus;

  const circles = [
    {
      title: focusData.circle1.title,
      items: focusData.circle1.items,
      tags: focusData.circle1.tags,
      color: "var(--accent)",
      hex: "#2d5be3",
      targetSection: "skills" as const,
    },
    {
      title: focusData.circle2.title,
      items: focusData.circle2.items,
      tags: focusData.circle2.tags,
      color: "var(--accent-2)",
      hex: "#7c3aed",
      targetSection: "projects" as const,
    },
    {
      title: focusData.circle3.title,
      items: focusData.circle3.items,
      tags: focusData.circle3.tags,
      color: "var(--accent-3)",
      hex: "#059669",
      targetSection: "skills" as const,
    },
  ];

  const { contextSafe } = useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.from(`.${styles.name}`, { opacity: 0, y: 16, duration: 0.7 })
        .from(`.${styles.tagline}`, { opacity: 0, y: 12, duration: 0.55 }, "-=0.45")
        .from(`.${styles.vennSizing}`, { opacity: 0, scale: 0.92, duration: 0.8, ease: "power3.out" }, "-=0.45");
    },
    { scope: heroRef }
  );

  const handleMouseEnterCircle = contextSafe((id: number) => {
    setHoveredSegment(id);
    const targetEl = document.getElementById(`venn-circle-${id}`);
    if (targetEl) {
      gsap.to(targetEl, {
        scale: 1.25,
        duration: 0.35,
        ease: "power2.out",
      });
    }
  });

  const handleMouseLeaveCircle = contextSafe((id: number) => {
    setHoveredSegment(null);
    const targetEl = document.getElementById(`venn-circle-${id}`);
    if (targetEl) {
      gsap.to(targetEl, {
        scale: 1.0,
        duration: 0.35,
        ease: "power2.out",
      });
    }
  });

  const handleResetVenn = contextSafe(() => {
    setSelectedSegment(null);
    setActiveSegments([]);
    setHoveredSegment(null);
  });

  const handleClickCircle = contextSafe((id: number) => {
    if (selectedSegment !== null) {
      handleResetVenn();
      return;
    }

    setSelectedSegment(id);
    setActiveSegments([id]);

    const targetEl = document.getElementById(`venn-circle-${id}`);
    if (targetEl) {
      gsap.fromTo(
        targetEl,
        { scale: 0.92 },
        { scale: 1.08, duration: 0.5, ease: "elastic.out(1.2, 0.4)" }
      );
    }
  });

  const hasInteraction =
    activeSegments.length > 0 ||
    hoveredSegment !== null ||
    selectedSegment !== null;

  const getSlotContent = (slot: "top" | "left" | "right"): SegmentContentData | null => {
    const showInSlot = (targetId: number): SegmentContentData | null => {
      if (selectedSegment !== null) {
        if (targetId === selectedSegment) {
          return {
            id: `circle-${targetId}`,
            type: "circle",
            title: circles[targetId].title,
            items: circles[targetId].items,
            colorVar: circles[targetId].color,
            isActive: true,
          };
        }
        return null;
      }

      const isSelected = activeSegments.includes(targetId);
      const isHovered = hoveredSegment === targetId;

      if (isSelected || isHovered) {
        return {
          id: `circle-${targetId}`,
          type: "circle",
          title: circles[targetId].title,
          items: circles[targetId].items,
          colorVar: circles[targetId].color,
          isActive: isSelected,
        };
      }
      return null;
    };

    if (slot === "top") {
      if (selectedSegment !== null) return null;

      const active0 = showInSlot(0);
      if (active0) return active0;

      if (hasInteraction) return null;

      const { url: activeCvUrl, filename: downloadFilename } = getCvDownloadInfo(
        personal.contactDetails.cvPath,
        lang
      );

      return {
        id: "home-intro",
        type: "home",
        name: personal.name,
        tagline: personal.tagline,
        valueProp: personal.description,
        email: personal.contactDetails.email,
        ctaProjectsLabel: dict?.hero?.ctaProjects || (lang === "es" ? "Ver Proyectos" : "View Projects"),
        ctaContactLabel: dict?.hero?.ctaContact || (lang === "es" ? "Contactar" : "Get in Touch"),
        cvUrl: activeCvUrl,
        downloadFilename,
        downloadLabel: dict?.contact?.downloadCv || (lang === "es" ? "Descargar CV" : "Download CV"),
        isActive: true,
      };
    }
    if (slot === "left") {
      if (selectedSegment !== null) return null;
      return showInSlot(1);
    }
    if (slot === "right") {
      if (selectedSegment !== null) return null;
      return showInSlot(2);
    }

    return null;
  };

  const renderCircleTitle = (circleIdx: number) => (
    <motion.div
      layoutId={`venn-title-circle-${circleIdx}`}
      className={styles.circleTitle}
      style={{ color: circles[circleIdx].color }}
      transition={{
        type: "spring",
        stiffness: 38,
        damping: 13,
        mass: 1,
      }}
    >
      <span
        id={`venn-title-text-${circleIdx}`}
        style={{
          display: "inline-block",
          position: "relative",
          border: "1px solid transparent",
          borderRadius: "12px",
          padding: "1.5px 6px",
        }}
      >
        <AnimatedText text={circles[circleIdx].title} stagger={0.03} />
      </span>
    </motion.div>
  );

  const renderAttachedTags = (circleIdx: number) => {
    const tags = circles[circleIdx].tags || [];

    const positions = [
      { left: "10%", top: "50%" },
      { left: "30%", top: "80%" },
      { left: "66%", top: "75%" },
      { left: "70%", top: "55%" },
    ];

    return (
      <>
        {tags.map((tag, idx) => (
          <motion.div
            id={`venn-tag-${circleIdx}-${idx}`}
            key={tag}
            style={{
              position: "absolute",
              transform: "translate(-50%, -50%)",
              zIndex: 15,
            }}
            initial={{
              left: "50%",
              top: "50%",
              scale: 0,
              opacity: 0,
            }}
            animate={{
              left: positions[idx].left,
              top: positions[idx].top,
              scale: 1,
              opacity: 1,
            }}
            transition={{
              left: { type: "spring", stiffness: 42, damping: 10.5, delay: 1.2 + idx * 0.25 },
              top: { type: "spring", stiffness: 42, damping: 10.5, delay: 1.2 + idx * 0.25 },
              scale: { type: "spring", stiffness: 42, damping: 10.5, delay: 1.2 + idx * 0.25 },
              opacity: { duration: 0.4, delay: 1.2 + idx * 0.25 },
            }}
          >
            <motion.div
              className={styles.attachedTag}
              whileHover={{ scale: 1.04 }}
              style={{
                borderColor: `${circles[circleIdx].hex}cc`,
                boxShadow: `0 0 20px ${circles[circleIdx].hex}45, inset 0 0 8px ${circles[circleIdx].hex}25`,
              }}
              animate={{
                y: [0, -3.5, 0],
              }}
              transition={{
                y: {
                  repeat: Infinity,
                  repeatType: "mirror",
                  duration: 4.5 + idx * 0.8,
                  ease: "easeInOut",
                  delay: 2.0 + idx * 0.3,
                },
              }}
            >
              {tag}
            </motion.div>
          </motion.div>
        ))}
      </>
    );
  };

  const topContent = getSlotContent("top");
  const leftContent = getSlotContent("left");
  const rightContent = getSlotContent("right");

  return (
    <section
      className={styles.hero}
      ref={heroRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && selectedSegment !== null) {
          handleResetVenn();
        }
      }}
    >
      <div className={styles.heroGrid}>
        <div className={styles.gridTop}>
          <AnimatePresence mode="wait">
            {topContent && (
              <SegmentContent
                key={topContent.id}
                content={topContent}
                onViewProjects={spa ? () => spa.setActiveSection("projects") : undefined}
              />
            )}
          </AnimatePresence>
        </div>

        <div className={styles.gridBottomLeft}>
          <AnimatePresence mode="wait">
            {leftContent && (
              <SegmentContent key={leftContent.id} content={leftContent} />
            )}
          </AnimatePresence>
        </div>

        <div className={styles.gridCenter}>
          <div className={styles.vennSizing}>
            <div
              id="venn-diagram-anchor"
              className={`${styles.vennAnchor} ${
                selectedSegment !== null
                  ? `${styles.zoomed} ${styles["selected" + selectedSegment]}`
                  : ""
              }`}
            >
              {circles.map((circle, idx) => (
                <button
                  key={circle.title}
                  type="button"
                  id={`venn-circle-${idx}`}
                  className={`${styles.vennCirclePlaceholder} ${styles["circle" + idx]} ${
                    activeSegments.includes(idx) || selectedSegment === idx
                      ? styles.active
                      : ""
                  } ${hoveredSegment === idx ? styles.hovered : ""}`}
                  aria-label={circle.title}
                  aria-pressed={selectedSegment === idx}
                  onMouseEnter={() =>
                    selectedSegment === null ? handleMouseEnterCircle(idx) : undefined
                  }
                  onMouseLeave={() =>
                    selectedSegment === null ? handleMouseLeaveCircle(idx) : undefined
                  }
                  onFocus={() =>
                    selectedSegment === null ? handleMouseEnterCircle(idx) : undefined
                  }
                  onBlur={() =>
                    selectedSegment === null ? handleMouseLeaveCircle(idx) : undefined
                  }
                  onClick={() => handleClickCircle(idx)}
                >
                  {selectedSegment === idx && renderCircleTitle(idx)}
                  {selectedSegment === idx && renderAttachedTags(idx)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.gridBottomRight}>
          <AnimatePresence mode="wait">
            {rightContent && (
              <SegmentContent key={rightContent.id} content={rightContent} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
