"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useSPA } from "@/components/layout/SPAContext";
import type { LocalizedPersonalInfo } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
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
  type: "home" | "circle" | "projection";
  title?: string;
  intersectionTitle?: string;
  colorVar?: string;
  name?: string;
  tagline?: string;
  valueProp?: string;
}

interface SegmentContentProps {
  content: SegmentContentData | null;
}

const SegmentContent = ({ content }: SegmentContentProps) => {
  if (!content) return null;

  return (
    <motion.div
      className={styles.segmentContent}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {content.type === "home" ? (
        <div
          key="home-intro-inner"
          className={styles.segmentContent}
          style={{ width: "100%" }}
          data-venn-text="true"
        >
          <h1 className={styles.name}>{content.name}</h1>
          <div className={styles.tagline}>{content.tagline}</div>
          {content.valueProp ? (
            <p className={styles.valueProp}>{content.valueProp}</p>
          ) : null}
        </div>
      ) : content.type === "projection" ? (
        <div
          key={`projection-inner-${content.id}`}
          className={styles.projectionWrapper}
        >
          <motion.div
            layoutId={`venn-title-${content.id}`}
            className={styles.handwrittenTitle}
            data-venn-text="true"
            style={{
              color: content.colorVar,
              textShadow: `0 0 25px ${content.colorVar}35`,
            }}
          >
            <AnimatedText text={content.title || ""} stagger={0.02} />
          </motion.div>

          {/* Minimalist Projected Particle Cluster Anchor (no white background) */}
          <motion.div
            id="venn-projection-anchor"
            className={styles.projectedCircleNode}
            data-venn-text="true"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className={styles.projectedIntersectionLabel}>
              {content.intersectionTitle}
            </span>
          </motion.div>
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
            data-venn-text="true"
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
        </div>
      )}
    </motion.div>
  );
};

export default function Hero({ personal }: HeroProps) {
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
      tags: focusData.circle1.tags ?? [],
      color: "var(--accent)",
      hex: "#2d5be3",
    },
    {
      title: focusData.circle2.title,
      items: focusData.circle2.items,
      tags: focusData.circle2.tags ?? [],
      color: "var(--accent-2)",
      hex: "#7c3aed",
    },
    {
      title: focusData.circle3.title,
      items: focusData.circle3.items,
      tags: focusData.circle3.tags ?? [],
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
      if (selectedSegment !== null) {
        if (hoveredSegment === targetId && targetId !== selectedSegment) {
          return {
            id: `circle-${targetId}`,
            type: "projection",
            title: circles[targetId].title,
            intersectionTitle: getIntersectionTitle(selectedSegment, targetId),
            colorVar: circles[targetId].color,
          };
        }
        return null;
      }

      if (hoveredSegment === targetId) {
        return {
          id: `circle-${targetId}`,
          type: "circle",
          title: circles[targetId].title,
          colorVar: circles[targetId].color,
        };
      }
      return null;
    };

    if (slot === "top") {
      const active0 = showInSlot(0);
      if (active0) return active0;

      if (hasInteraction) return null;

      return {
        id: "home-intro",
        type: "home",
        name: personal.name,
        tagline: personal.tagline,
        valueProp: personal.description,
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
    // Use the concise 1-2 word tags so they fit comfortably inside the circle
    const tags = circles[circleIdx].tags || [];

    // Symmetric triangle well inside the circle (radius 50%, center 50%, 50%)
    const positions = [
      { left: "29%", top: "48%" },
      { left: "71%", top: "48%" },
      { left: "50%", top: "73%" },
    ];

    return (
      <>
        {tags.slice(0, 3).map((tag, idx) => {
          const pos = positions[idx] ?? { left: "50%", top: "68%" };

          return (
            /* Static outer wrapper holds translate(-50%, -50%) so Framer Motion scale never shifts it */
            <div
              key={tag}
              style={{
                position: "absolute",
                left: pos.left,
                top: pos.top,
                transform: "translate(-50%, -50%)",
                zIndex: 15,
                pointerEvents: "none",
              }}
            >
              <motion.div
                id={`venn-tag-${circleIdx}-${idx}`}
                className={styles.subConceptNode}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -3, 0] }}
                transition={{
                  scale: {
                    type: "spring",
                    stiffness: 56,
                    damping: 13,
                    delay: 0.14 + idx * 0.08,
                  },
                  opacity: { duration: 0.28, delay: 0.14 + idx * 0.08 },
                  y: {
                    repeat: Infinity,
                    repeatType: "mirror",
                    duration: 4 + idx * 0.6,
                    ease: "easeInOut",
                    delay: 0.5 + idx * 0.2,
                  },
                }}
              >
                {tag}
              </motion.div>
            </div>
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
      <div
        className={`${styles.heroGrid} ${
          selectedSegment !== null ? styles.heroGridZoomed : ""
        }`}
      >
        <div className={styles.gridTop}>
          <AnimatePresence mode="wait">
            {topContent && (
              <SegmentContent
                key={topContent.id}
                content={topContent}
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
