import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BrainConceptViewModel, BrainViewModel } from "@/types/brain";
import {
  getConceptKind,
  miniBrainNodeStyle,
  miniBrainPoint,
  MINI_BRAIN_HEIGHT,
  MINI_BRAIN_WIDTH,
  type MiniBrainLink,
} from "./BrainGraph.visuals";
import styles from "../BrainGraph.module.css";

interface BrainGraphNavigationProps {
  visible: boolean;
  concepts: BrainConceptViewModel[];
  links: MiniBrainLink[];
  discoveredConceptIds: Set<string>;
  candidateConceptId: string | null;
  hoveredConceptId: string | null;
  selectedConceptId: string | null;
  ui: BrainViewModel["ui"];
  menuRef: RefObject<HTMLElement | null>;
  backControlRef: RefObject<HTMLButtonElement | null>;
  reduceMotion: boolean;
  onSelectConcept: (conceptId: string) => void;
  onReleaseConcept: () => void;
  onHoverConcept?: (conceptId: string | null) => void;
}

export default function BrainGraphNavigation({
  visible,
  concepts,
  links,
  discoveredConceptIds,
  candidateConceptId,
  hoveredConceptId,
  selectedConceptId,
  ui,
  menuRef,
  backControlRef,
  reduceMotion,
  onSelectConcept,
  onReleaseConcept,
  onHoverConcept,
}: BrainGraphNavigationProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.nav
          ref={menuRef}
          className={styles.miniBrainMenu}
          aria-label={ui.mapAriaLabel}
          initial={
            reduceMotion
              ? false
              : { opacity: 0, scale: 0.9, filter: "blur(7px)" }
          }
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.94, filter: "blur(5px)" }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { delay: 0.42, duration: 0.46 }
          }
        >
          <svg
            className={styles.miniBrainShape}
            viewBox={`0 0 ${MINI_BRAIN_WIDTH} ${MINI_BRAIN_HEIGHT}`}
            aria-hidden="true"
          >
            <path
              className={styles.miniBrainOutline}
              d="M89 14C73 5 54 11 45 25C28 25 17 40 20 57C8 69 13 87 28 96C26 112 42 126 60 123C69 138 85 137 90 124C97 138 115 138 123 123C141 126 156 112 153 95C169 86 170 66 158 56C160 39 146 25 130 24C121 10 103 7 89 14Z"
            />
            <path
              className={styles.miniBrainFissure}
              d="M90 16C88 35 93 49 89 67C86 84 94 101 90 124"
            />
            <path
              className={styles.miniBrainFold}
              d="M45 34C61 32 72 40 75 54M28 62C47 55 64 65 69 78M38 99C54 88 70 95 76 111M135 34C119 31 107 40 104 54M153 63C134 55 117 64 111 79M142 99C126 88 109 96 103 111"
            />

            {links.map((link) => {
              const source = miniBrainPoint(link.source);
              const target = miniBrainPoint(link.target);
              const isActive =
                discoveredConceptIds.has(link.source.id) &&
                discoveredConceptIds.has(link.target.id);
              const isSelected =
                isActive &&
                (selectedConceptId === link.source.id ||
                  selectedConceptId === link.target.id);

              return (
                <line
                  key={`${link.source.id}-${link.target.id}`}
                  className={`${styles.miniBrainLink} ${
                    isActive ? styles.miniBrainLinkActive : ""
                  } ${isSelected ? styles.miniBrainLinkSelected : ""}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
              );
            })}
          </svg>

          {concepts.map((concept, index) => {
            const isDiscovered = discoveredConceptIds.has(concept.id);
            const isCandidate = candidateConceptId === concept.id;
            const isPreselected = hoveredConceptId === concept.id;
            const isSelected = selectedConceptId === concept.id;
            const animationDelay = !isDiscovered
              ? `${((index * 0.12) % 3.8).toFixed(2)}s`
              : undefined;

            return (
              <button
                key={concept.id}
                type="button"
                className={`${styles.miniBrainNeuron} ${
                  styles[getConceptKind(concept)]
                } ${isDiscovered ? styles.miniBrainDiscovered : ""} ${
                  isCandidate ? styles.miniBrainCandidate : ""
                } ${isPreselected ? styles.miniBrainPreselected : ""} ${
                  isSelected ? styles.miniBrainSelected : ""
                }`}
                style={{ ...miniBrainNodeStyle(concept), animationDelay }}
                aria-label={
                  isDiscovered ? concept.title : ui.undiscoveredConcept
                }
                onMouseEnter={() => onHoverConcept?.(concept.id)}
                onMouseLeave={() => onHoverConcept?.(null)}
                onClick={() => {
                  if (isSelected) onReleaseConcept();
                  else onSelectConcept(concept.id);
                }}
              >
                <span aria-hidden="true" />
                <i
                  aria-hidden="true"
                  style={!isDiscovered ? { animationDelay } : undefined}
                />
              </button>
            );
          })}

          {selectedConceptId ? (
            <button
              ref={backControlRef}
              type="button"
              className={styles.backControl}
              onClick={(event) => {
                event.stopPropagation();
                onReleaseConcept();
              }}
              aria-label={ui.backToMapAriaLabel}
            >
              <i aria-hidden="true">←</i>
              <span>{ui.back}</span>
            </button>
          ) : null}
        </motion.nav>
      ) : null}
    </AnimatePresence>
  );
}
