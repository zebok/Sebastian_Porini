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
    <motion.div
      className={className}
      style={{ ...style, display: "inline-block" }}
    >
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
  type: "home" | "circle";
  title?: string;
  subtitle?: string;
  colorVar?: string;
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
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {content.type === "home" ? (
        <div
          key="home-intro-inner"
          className={styles.segmentContent}
          style={{ width: "100%" }}
        >
          <h1 className={styles.name}>{content.name}</h1>
          <div className={styles.tagline}>{content.tagline}</div>
          {content.valueProp ? (
            <p className={styles.valueProp}>{content.valueProp}</p>
          ) : null}
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
              stiffness: 48,
              damping: 14,
              mass: 1,
            }}
          >
            <AnimatedText text={content.title || ""} stagger={0.02} />
          </motion.div>
          {content.subtitle && (
            <motion.p
              className={styles.hoverSubtitle}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.28 }}
            >
              {content.subtitle}
            </motion.p>
          )}
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
      description: focusData.circle1.description,
      items: focusData.circle1.items,
      tags: focusData.circle1.tags,
      color: "var(--accent)",
      hex: "#2d5be3",
    },
    {
      title: focusData.circle2.title,
      description: focusData.circle2.description,
      items: focusData.circle2.items,
      tags: focusData.circle2.tags,
      color: "var(--accent-2)",
      hex: "#7c3aed",
    },
    {
      title: focusData.circle3.title,
      description: focusData.circle3.description,
      items: focusData.circle3.items,
      tags: focusData.circle3.tags,
      color: "var(--accent-3)",
      hex: "#059669",
    },
  ];

  const getIntersectionTitle = (a: number, b: number): string => {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    if (min === 0 && max === 1) return focusData.intersection01.title;
    if (min === 0 && max === 2) return focusData.intersection02.title;
    return focusData.intersection12.title;
  };

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.from(`.${styles.name}`, { opacity: 0, y: 16, duration: 0.7 })
        .from(
          `.${styles.tagline}`,
          { opacity: 0, y: 12, duration: 0.55 },
          "-=0.45"
        )
        .from(
          `.${styles.vennSizing}`,
          { opacity: 0, scale: 0.92, duration: 0.8, ease: "power3.out" },
          "-=0.45"
        );
    },
    { scope: heroRef }
  );

  const handleMouseEnterCircle = (id: number) => {
    setHoveredSegment(id);
  };

  const handleMouseLeaveCircle = () => {
    setHoveredSegment(null);
  };

  const handleResetVenn = () => {
    setSelectedSegment(null);
    setActiveSegments([]);
    setHoveredSegment(null);
  };

  const handleClickCircle = (id: number) => {
    // Clicking the already-selected circle resets back to the 3-circle overview;
    // clicking an overlapping companion circle glides directly into that companion!
    if (selectedSegment === id) {
      handleResetVenn();
      return;
    }

    setSelectedSegment(id);
    setActiveSegments([id]);
    setHoveredSegment(null);
  };

  const hasInteraction =
    activeSegments.length > 0 ||
    hoveredSegment !== null ||
    selectedSegment !== null;

  const getSlotContent = (
    slot: "top" | "left" | "right"
  ): SegmentContentData | null => {
    const showInSlot = (targetId: number): SegmentContentData | null => {
      // When immersed in a circle, hovering one of its overlapping companions
      // shows that companion's title + their shared intersection concept in the outer space
      if (selectedSegment !== null) {
        if (hoveredSegment === targetId && targetId !== selectedSegment) {
          return {
            id: `circle-${targetId}`,
            type: "circle",
            title: circles[targetId].title,
            subtitle: `∩ ${getIntersectionTitle(selectedSegment, targetId)}`,
            colorVar: circles[targetId].color,
          };
        }
        return null;
      }

      // 1st Animation (Hover in overview): Title appears in the available outer space
      if (hoveredSegment === targetId) {
        return {
          id: `circle-${targetId}`,
          type: "circle",
          title: circles[targetId].title,
          subtitle: circles[targetId].description,
          colorVar: circles[targetId].color,
        };
      }
      return null;
    };

    if (slot === "top") {
      const active0 = showInSlot(0);
      if (active0) return active0;

      if (hasInteraction) return null;

      const { url: activeCvUrl, filename: downloadFilename } =
        getCvDownloadInfo(personal.contactDetails.cvPath, lang);

      return {
        id: "home-intro",
        type: "home",
        name: personal.name,
        tagline: personal.tagline,
        valueProp: personal.description,
        email: personal.contactDetails.email,
        ctaProjectsLabel:
          dict?.hero?.ctaProjects ||
          (lang === "es" ? "Ver Proyectos" : "View Projects"),
        ctaContactLabel:
          dict?.hero?.ctaContact ||
          (lang === "es" ? "Contactar" : "Get in Touch"),
        cvUrl: activeCvUrl,
        downloadFilename,
        downloadLabel:
          dict?.contact?.downloadCv ||
          (lang === "es" ? "Descargar CV" : "Download CV"),
      };
    }
    if (slot === "left") {
      return showInSlot(1);
    }
    if (slot === "right") {
      return showInSlot(2);
    }

    return null;
  };

  const renderCircleTitle = (circleIdx: number) => (
    <motion.div
      layoutId={`venn-title-circle-${circleIdx}`}
      className={styles.circleTitle}
      style={{
        color: circles[circleIdx].color,
        textShadow: `0 0 24px ${circles[circleIdx].hex}30`,
      }}
      transition={{
        type: "spring",
        stiffness: 48,
        damping: 14,
        mass: 1,
      }}
    >
      <span
        id={`venn-title-text-${circleIdx}`}
        style={{
          display: "inline-block",
          position: "relative",
          padding: "2px 8px",
        }}
      >
        <AnimatedText text={circles[circleIdx].title} stagger={0.025} />
      </span>
    </motion.div>
  );

  const renderImmersedConcepts = (circleIdx: number) => {
    const concepts = circles[circleIdx].items || [];

    // Symmetric positions inside the 1:1 circle around the central particle hub (50%, 50%)
    const positions =
      concepts.length === 3
        ? [
            { left: "26%", top: "48%" },
            { left: "74%", top: "48%" },
            { left: "50%", top: "75%" },
          ]
        : [
            { left: "27%", top: "44%" },
            { left: "73%", top: "44%" },
            { left: "30%", top: "72%" },
            { left: "70%", top: "72%" },
          ];

    return (
      <>
        {concepts.map((concept, idx) => {
          const pos = positions[idx] ?? { left: "50%", top: "65%" };
          return (
            <motion.div
              id={`venn-tag-${circleIdx}-${idx}`}
              key={concept}
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                zIndex: 15,
              }}
              initial={{
                left: "50%",
                top: "50%",
                scale: 0.4,
                opacity: 0,
              }}
              animate={{
                left: pos.left,
                top: pos.top,
                scale: 1,
                opacity: 1,
              }}
              transition={{
                left: {
                  type: "spring",
                  stiffness: 58,
                  damping: 13,
                  delay: 0.12 + idx * 0.08,
                },
                top: {
                  type: "spring",
                  stiffness: 58,
                  damping: 13,
                  delay: 0.12 + idx * 0.08,
                },
                scale: {
                  type: "spring",
                  stiffness: 58,
                  damping: 13,
                  delay: 0.12 + idx * 0.08,
                },
                opacity: { duration: 0.3, delay: 0.12 + idx * 0.08 },
              }}
            >
              <motion.div
                className={styles.attachedTag}
                whileHover={{ scale: 1.05 }}
                style={{
                  borderColor: `${circles[circleIdx].hex}88`,
                  boxShadow: `0 0 22px ${circles[circleIdx].hex}30, inset 0 0 8px ${circles[circleIdx].hex}18`,
                }}
                animate={{
                  y: [0, -3.5, 0],
                }}
                transition={{
                  y: {
                    repeat: Infinity,
                    repeatType: "mirror",
                    duration: 4.2 + idx * 0.7,
                    ease: "easeInOut",
                    delay: 0.6 + idx * 0.2,
                  },
                }}
              >
                {concept}
              </motion.div>
            </motion.div>
          );
        })}
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
      onClick={(e) => {
        if (e.target === e.currentTarget && selectedSegment !== null) {
          handleResetVenn();
        }
      }}
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
                onViewProjects={
                  spa ? () => spa.setActiveSection("projects") : undefined
                }
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
                  className={`${styles.vennCirclePlaceholder} ${
                    styles["circle" + idx]
                  } ${
                    activeSegments.includes(idx) || selectedSegment === idx
                      ? styles.active
                      : ""
                  } ${hoveredSegment === idx ? styles.hovered : ""}`}
                  aria-label={circle.title}
                  aria-pressed={selectedSegment === idx}
                  onMouseEnter={() => handleMouseEnterCircle(idx)}
                  onMouseLeave={handleMouseLeaveCircle}
                  onFocus={() => handleMouseEnterCircle(idx)}
                  onBlur={handleMouseLeaveCircle}
                  onClick={() => handleClickCircle(idx)}
                >
                  {selectedSegment === idx && renderCircleTitle(idx)}
                  {selectedSegment === idx && renderImmersedConcepts(idx)}
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
