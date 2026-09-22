"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useSPA } from "@/components/layout/SPAContext";
import { LocalizedPersonalInfo } from "@/lib/data";
import { Dictionary } from "@/lib/i18n";
import styles from "./Hero.module.css";

const AnimatedText = ({ text, delay = 0, className = "", stagger = 0.02, style = {} }: { text: string; delay?: number; className?: string; stagger?: number; style?: React.CSSProperties }) => {
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
            ease: [0.25, 1, 0.5, 1]
          }}
          style={{
            display: "inline-block",
            whiteSpace: char === " " ? "pre" : "normal"
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
  greeting?: string;
  name?: string;
  tagline?: string;
  cvUrl?: string;
  downloadFilename?: string;
  downloadLabel?: string;
}

interface SegmentContentProps {
  content: SegmentContentData | null;
}

const SegmentContent = ({ content }: SegmentContentProps) => {
  if (!content) return null;

  return (
    <motion.div
      className={styles.segmentContent}
      initial={{ opacity: 0, y: 15, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, scale: 0.96, filter: "blur(4px)" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {content.type === "home" ? (
        <div key="home-intro-inner" className={styles.segmentContent} style={{ width: "100%" }}>
          <h1 className={styles.name}>{content.name}</h1>
          <div className={styles.tagline}>{content.tagline}</div>
        </div>
      ) : (
        <div key={`circle-inner-${content.id}`} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <motion.div
            layoutId={`venn-title-${content.id}`}
            className={styles.handwrittenTitle}
            style={{
              color: content.colorVar,
              textShadow: `0 0 25px ${content.colorVar}35`
            }}
            transition={{
              type: "spring",
              stiffness: 38,
              damping: 13,
              mass: 1
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
              duration: 0.9,
              ease: [0.16, 1, 0.3, 1],
              opacity: { duration: 0.6 }
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
                        boxShadow: `0 4px 12px ${content.colorVar}30`
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

  // Fallbacks if SPAContext is not present
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
      targetSection: "skills" as const
    },
    {
      title: focusData.circle2.title,
      items: focusData.circle2.items,
      tags: focusData.circle2.tags,
      color: "var(--accent-2)",
      hex: "#7c3aed",
      targetSection: "projects" as const
    },
    {
      title: focusData.circle3.title,
      items: focusData.circle3.items,
      tags: focusData.circle3.tags,
      color: "var(--accent-3)",
      hex: "#059669",
      targetSection: "skills" as const
    },
  ];

  // GSAP animation setup with useGSAP and contextSafe
  const { contextSafe } = useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
    tl.from(`.${styles.name}`, { opacity: 0, y: 20, duration: 1.0 })
      .from(`.${styles.tagline}`, { opacity: 0, y: 15, duration: 0.8 }, "-=0.6")
      .from(`.${styles.vennSizing}`, { opacity: 0, scale: 0.85, duration: 1.2, ease: "back.out(1.2)" }, "-=0.7");
  }, { scope: heroRef });

  // Context-safe event handlers for mouse enter/leave and click
  const handleMouseEnterCircle = contextSafe((id: number) => {
    setHoveredSegment(id);
    const targetEl = document.getElementById(`venn-circle-${id}`);
    if (targetEl) {
      gsap.to(targetEl, {
        scale: 1.25,
        duration: 0.35,
        ease: "power2.out"
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
        ease: "power2.out"
      });
    }
  });

  const handleClickCircle = contextSafe((id: number) => {
    if (selectedSegment !== null) {
      if (id !== selectedSegment) {
        handleResetVenn();
      }
      return;
    }

    const newSelected = id;
    setSelectedSegment(newSelected);
    setActiveSegments([newSelected]);

    // Pulse animation on click
    const targetEl = document.getElementById(`venn-circle-${id}`);
    if (targetEl) {
      gsap.fromTo(targetEl,
        { scale: 0.92 },
        { scale: 1.08, duration: 0.5, ease: "elastic.out(1.2, 0.4)" }
      );
    }
  });

  const handleResetVenn = contextSafe(() => {
    setSelectedSegment(null);
    setActiveSegments([]);
    setHoveredSegment(null);
  });

  const hasInteraction = activeSegments.length > 0 || hoveredSegment !== null || selectedSegment !== null;

  const getSlotContent = (slot: "top" | "left" | "right") => {
    const showInSlot = (targetId: number) => {
      if (selectedSegment !== null) {
        // In selected/zoomed mode, only show details for the active selected category
        if (targetId === selectedSegment) {
          return {
            id: `circle-${targetId}`,
            type: "circle" as const,
            title: circles[targetId].title,
            items: circles[targetId].items,
            colorVar: circles[targetId].color,
            isActive: true
          };
        }
        return null;
      }

      const isSelected = activeSegments.includes(targetId);
      const isHovered = hoveredSegment === targetId;

      if (isSelected || isHovered) {
        return {
          id: `circle-${targetId}`,
          type: "circle" as const,
          title: circles[targetId].title,
          items: circles[targetId].items,
          colorVar: circles[targetId].color,
          isActive: isSelected
        };
      }
      return null;
    };

    if (slot === "top") {
      // When a circle is selected, all text slots are empty — the title lives inside the circle
      if (selectedSegment !== null) return null;

      const active0 = showInSlot(0);
      if (active0) return active0;

      // If there is any interaction (hover or selection on any segment), do not display top intro!
      if (hasInteraction) return null;

      // If Circle 0 is not hovered or selected, always display top intro!
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const cleanBasePath = basePath.replace(/\/$/, "");
      const cvPath = personal.contactDetails.cvPath || "/SebastianPorini_English.pdf";
      const cleanCvPath = cvPath.startsWith("/") ? cvPath : `/${cvPath}`;
      const activeCvUrl = `${cleanBasePath}${cleanCvPath}`;

      const downloadFilename =
        lang === "es"
          ? "Sebastian_Porini_CV_ES.pdf"
          : lang === "de"
          ? "Sebastian_Porini_Lebenslauf_DE.pdf"
          : "Sebastian_Porini_CV_EN.pdf";

      const downloadLabel = dict?.contact?.downloadCv || "Download CV";

      return {
        id: "home-intro",
        type: "home" as const,
        name: personal.name,
        tagline: personal.tagline,
        cvUrl: activeCvUrl,
        downloadFilename,
        downloadLabel,
        isActive: true
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

  const renderCircleTitle = (circleIdx: number) => {
    return (
      <motion.div
        layoutId={`venn-title-circle-${circleIdx}`}
        className={styles.circleTitle}
        style={{ color: circles[circleIdx].color }}
        transition={{
          type: "spring",
          stiffness: 38,
          damping: 13,
          mass: 1
        }}
      >
        <span
          id={`venn-title-text-${circleIdx}`}
          style={{
            display: "inline-block",
            position: "relative",
            border: "1px solid transparent", // completely transparent border box
            borderRadius: "12px",
            padding: "1.5px 6px" // very tight padding hugging the text
          }}
        >
          <AnimatedText text={circles[circleIdx].title} stagger={0.03} />
        </span>
      </motion.div>
    );
  };

  const renderAttachedTags = (circleIdx: number) => {
    const tags = circles[circleIdx].tags || [];

    const positions = [
      { left: "10%", top: "50%" },
      { left: "30%", top: "80%" },
      { left: "66%", top: "75%" },
      { left: "70%", top: "55%" }
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
              zIndex: 15
            }}
            initial={{
              left: "50%",
              top: "50%",
              scale: 0,
              opacity: 0
            }}
            animate={{
              left: positions[idx].left,
              top: positions[idx].top,
              scale: 1,
              opacity: 1
            }}
            transition={{
              left: { type: "spring", stiffness: 42, damping: 10.5, delay: 2.05 + idx * 0.45 },
              top: { type: "spring", stiffness: 42, damping: 10.5, delay: 2.05 + idx * 0.45 },
              scale: { type: "spring", stiffness: 42, damping: 10.5, delay: 2.05 + idx * 0.45 },
              opacity: { duration: 0.5, delay: 2.05 + idx * 0.45 }
            }}
          >
            <motion.div
              className={styles.attachedTag}
              whileHover={{ scale: 1.04 }}
              style={{
                borderColor: `${circles[circleIdx].hex}cc`,
                boxShadow: `0 0 20px ${circles[circleIdx].hex}45, inset 0 0 8px ${circles[circleIdx].hex}25`
              }}
              animate={{ 
                y: [0, -3.5, 0]
              }}
              transition={{
                y: {
                  repeat: Infinity,
                  repeatType: "mirror",
                  duration: 4.5 + idx * 0.8,
                  ease: "easeInOut",
                  delay: 3.25 + idx * 0.45
                }
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
    <section className={styles.hero} ref={heroRef}>
      <div className={styles.heroGrid}>

        <div className={styles.gridTop}>
          <AnimatePresence mode="wait">
            {topContent && (
              <SegmentContent key={topContent.id} content={topContent} />
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
            {/* HTML overlays that represent the Venn circles so the canvas knows their layout bounds */}
            <div
              id="venn-diagram-anchor"
              className={`${styles.vennAnchor} ${selectedSegment !== null ? `${styles.zoomed} ${styles["selected" + selectedSegment]}` : ""}`}
            >
              <div
                id="venn-circle-0"
                className={`${styles.vennCirclePlaceholder} ${styles.circle0} ${activeSegments.includes(0) || selectedSegment === 0 ? styles.active : ""} ${hoveredSegment === 0 ? styles.hovered : ""}`}
                onMouseEnter={() => selectedSegment === null ? handleMouseEnterCircle(0) : undefined}
                onMouseLeave={() => selectedSegment === null ? handleMouseLeaveCircle(0) : undefined}
                onClick={() => handleClickCircle(0)}
              >
                {selectedSegment === 0 && renderCircleTitle(0)}
                {selectedSegment === 0 && renderAttachedTags(0)}
              </div>
              <div
                id="venn-circle-1"
                className={`${styles.vennCirclePlaceholder} ${styles.circle1} ${activeSegments.includes(1) || selectedSegment === 1 ? styles.active : ""} ${hoveredSegment === 1 ? styles.hovered : ""}`}
                onMouseEnter={() => selectedSegment === null ? handleMouseEnterCircle(1) : undefined}
                onMouseLeave={() => selectedSegment === null ? handleMouseLeaveCircle(1) : undefined}
                onClick={() => handleClickCircle(1)}
              >
                {selectedSegment === 1 && renderCircleTitle(1)}
                {selectedSegment === 1 && renderAttachedTags(1)}
              </div>
              <div
                id="venn-circle-2"
                className={`${styles.vennCirclePlaceholder} ${styles.circle2} ${activeSegments.includes(2) || selectedSegment === 2 ? styles.active : ""} ${hoveredSegment === 2 ? styles.hovered : ""}`}
                onMouseEnter={() => selectedSegment === null ? handleMouseEnterCircle(2) : undefined}
                onMouseLeave={() => selectedSegment === null ? handleMouseLeaveCircle(2) : undefined}
                onClick={() => handleClickCircle(2)}
              >
                {selectedSegment === 2 && renderCircleTitle(2)}
                {selectedSegment === 2 && renderAttachedTags(2)}
              </div>
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
