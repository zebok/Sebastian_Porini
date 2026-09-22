import type {
  MouseEventHandler,
  ReactNode,
  RefObject,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { BrainConceptFocusNode } from "../BrainGraph.config";
import type {
  BrainConceptViewModel,
  BrainSkillKind,
  BrainSkillViewModel,
  BrainViewModel,
} from "@/types/brain";
import type { SkillId } from "@/types/content";
import { BRAIN_MASK_CLIP_PATH } from "../BrainGraph.geometry";
import {
  brainCursorStyle,
  conceptVisualStyle,
  protagonistHotspotStyle,
} from "./BrainGraph.visuals";
import styles from "../BrainGraph.module.css";

interface BrainGraphCursorProps {
  visible: boolean;
  kind: BrainSkillKind | null;
  cursorRef: RefObject<HTMLSpanElement | null>;
  reduceMotion: boolean;
}

export function BrainGraphCursor({
  visible,
  kind,
  cursorRef,
  reduceMotion,
}: BrainGraphCursorProps) {
  if (typeof document === "undefined") return null;

  // Rendering at body level keeps fixed viewport coordinates independent from
  // transformed section ancestors (GSAP scale/translate creates a new fixed
  // containing block, which otherwise offsets clientX/clientY).
  return createPortal(
    <motion.span
      ref={cursorRef}
      className={`${styles.brainCursor} ${
        kind ? styles.brainCursorNear : ""
      }`}
      style={brainCursorStyle(kind)}
      aria-hidden="true"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
    />,
    document.body
  );
}

interface BrainGraphSceneProps {
  navigation: ReactNode;
  concepts: BrainConceptViewModel[];
  selectedConcept: BrainConceptViewModel | null;
  selectedFocusNodes: BrainConceptFocusNode[];
  skillsById: Map<SkillId, BrainSkillViewModel>;
  isPinned: boolean;
  missionRunning: boolean;
  ui: BrainViewModel["ui"];
  particleAnchorRef: RefObject<HTMLDivElement | null>;
  zoomAnchorRef: RefObject<HTMLDivElement | null>;
  conceptTitleRef: RefObject<HTMLDivElement | null>;
  onMouseEnter: MouseEventHandler<HTMLDivElement>;
  onMouseMove: MouseEventHandler<HTMLDivElement>;
  onMouseLeave: () => void;
  onActivateHovered: () => void;
  onFocusConcept: (concept: BrainConceptViewModel) => void;
  onBlurConcept: () => void;
  onClickConcept: (conceptId: string) => void;
}

const getVerticalSlots = (count: number): number[] => {
  if (count === 1) return [49];
  if (count === 2) return [15, 83];
  if (count === 3) return [12, 49, 86];
  return Array.from({ length: count }, (_, i) => 10 + (i / (count - 1)) * 78);
};

export default function BrainGraphScene({
  navigation,
  concepts,
  selectedConcept,
  selectedFocusNodes,
  skillsById,
  isPinned,
  missionRunning,
  ui,
  particleAnchorRef,
  zoomAnchorRef,
  conceptTitleRef,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onActivateHovered,
  onFocusConcept,
  onBlurConcept,
  onClickConcept,
}: BrainGraphSceneProps) {
  const leftNodes = selectedFocusNodes
    .filter((n) => !n.protagonist && n.x <= 50)
    .sort((a, b) => a.y - b.y);
  const rightNodes = selectedFocusNodes
    .filter((n) => !n.protagonist && n.x > 50)
    .sort((a, b) => a.y - b.y);

  const leftSlots = getVerticalSlots(leftNodes.length);
  const rightSlots = getVerticalSlots(rightNodes.length);

  return (
    <div
      className={`${styles.brainScene} ${
        selectedConcept ? styles.brainScenePinned : ""
      }`}
    >
      {selectedConcept ? (
        <aside
          ref={conceptTitleRef}
          className={styles.conceptTitle}
          style={conceptVisualStyle(selectedConcept)}
          aria-live="polite"
          aria-labelledby={`brain-concept-title-${selectedConcept.id}`}
        >
          <h2 id={`brain-concept-title-${selectedConcept.id}`}>
            {selectedConcept.title}
          </h2>
        </aside>
      ) : null}

      <div ref={particleAnchorRef} className={styles.brainAnchor}>
        <div
          className={styles.areaLayer}
          style={{ clipPath: BRAIN_MASK_CLIP_PATH }}
          onMouseEnter={onMouseEnter}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onClick={onActivateHovered}
        >
          {concepts.map((concept) => (
            <button
              type="button"
              key={concept.id}
              className={styles.areaHotspot}
              style={protagonistHotspotStyle(concept)}
              aria-label={`${concept.title} · ${concept.subtitles.length} ${ui.connectedIdeas}`}
              aria-pressed={selectedConcept?.id === concept.id}
              tabIndex={missionRunning ? -1 : undefined}
              onFocus={() => {
                if (!isPinned) onFocusConcept(concept);
              }}
              onBlur={onBlurConcept}
              onClick={(event) => {
                event.stopPropagation();
                onClickConcept(concept.id);
              }}
            />
          ))}
        </div>
      </div>

      <div className={styles.brainNavigationSlot}>{navigation}</div>

      {selectedConcept ? (
        <div
          ref={zoomAnchorRef}
          className={styles.conceptZoom}
          style={conceptVisualStyle(selectedConcept)}
          role="img"
          aria-label={`${selectedConcept.title} · ${ui.expandedNetwork}`}
        >
          <div className={styles.conceptZoomField} aria-hidden="true" />
          <div className={styles.conceptNeuronLabels} aria-hidden="true">
            {/* SVG connectors linking HTML labels to canvas nodes */}
            <svg viewBox="0 0 100 100" className={styles.labelConnectors}>
              {leftNodes.map((node, i) => {
                const skill = skillsById.get(node.skillId);
                if (!skill) return null;
                const slotY = leftSlots[i];

                return (
                  <line
                    key={`line-${node.skillId}`}
                    x1={node.x}
                    y1={node.y}
                    x2={12}
                    y2={slotY}
                    className={`${styles.connectorLine} ${styles[skill.kind]}`}
                  />
                );
              })}
              {rightNodes.map((node, i) => {
                const skill = skillsById.get(node.skillId);
                if (!skill) return null;
                const slotY = rightSlots[i];

                return (
                  <line
                    key={`line-${node.skillId}`}
                    x1={node.x}
                    y1={node.y}
                    x2={88}
                    y2={slotY}
                    className={`${styles.connectorLine} ${styles[skill.kind]}`}
                  />
                );
              })}
            </svg>

            {leftNodes.map((node, i) => {
              const skill = skillsById.get(node.skillId);
              if (!skill) return null;
              const slotY = leftSlots[i];

              return (
                <span
                  key={node.skillId}
                  className={`${styles.conceptNeuronLabel} ${styles.leftLabel} ${
                    styles[skill.kind]
                  }`}
                  style={{ top: `${slotY}%` }}
                >
                  {node.label}
                </span>
              );
            })}

            {rightNodes.map((node, i) => {
              const skill = skillsById.get(node.skillId);
              if (!skill) return null;
              const slotY = rightSlots[i];

              return (
                <span
                  key={node.skillId}
                  className={`${styles.conceptNeuronLabel} ${styles.rightLabel} ${
                    styles[skill.kind]
                  }`}
                  style={{ top: `${slotY}%` }}
                >
                  {node.label}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
