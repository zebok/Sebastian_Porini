"use client";

import type { RefObject } from "react";
import type {
  BrainConceptViewModel,
  BrainViewModel,
} from "@/types/brain";
import { getConceptKind } from "./BrainGraph.visuals";
import styles from "../BrainGraph.module.css";

interface AnimatedLabelProps {
  text: string;
  kind: "title" | "concept";
}

function AnimatedLabel({ text, kind }: AnimatedLabelProps) {
  if (kind === "title") {
    const lines = text.split("\n");
    if (lines.length > 2) {
      return (
        <span aria-hidden="true" data-intro-writing={kind}>
          <span className={styles.introTitleNumber}>{lines[0]}</span>
          <span className={styles.introTitleText}>{lines[1]}</span>
          <span className={styles.introTitleSubText}>{lines[2]}</span>
        </span>
      );
    } else if (lines.length > 1) {
      return (
        <span aria-hidden="true" data-intro-writing={kind}>
          <span className={styles.introTitleNumber}>{lines[0]}</span>
          <span className={styles.introTitleText}>{lines[1]}</span>
        </span>
      );
    }
  }

  return (
    <span aria-hidden="true" data-intro-writing={kind}>
      {text}
    </span>
  );
}

interface BrainGraphMissionProps {
  concepts: BrainConceptViewModel[];
  intro: BrainViewModel["intro"];
  isRunning: boolean;
  introRef: RefObject<HTMLElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  conceptListRef: RefObject<HTMLDivElement | null>;
  instructionRef: RefObject<HTMLParagraphElement | null>;
  skipRef: RefObject<HTMLButtonElement | null>;
  onSkip: () => void;
  onPlay?: () => void;
}

export default function BrainGraphMission({
  concepts,
  intro,
  isRunning,
  introRef,
  titleRef,
  conceptListRef,
  instructionRef,
  skipRef,
  onSkip,
  onPlay,
}: BrainGraphMissionProps) {
  return (
    <section
      ref={introRef}
      className={`${styles.brainIntro} ${!isRunning ? styles.brainIntroExplore : ""}`}
      aria-hidden={false}
      aria-label={intro.ariaLabel}
      style={!isRunning ? { pointerEvents: "none" } : undefined}
    >
      <button
        ref={skipRef}
        type="button"
        className={`${styles.introSkip} ${!isRunning ? styles.introPlay : ""}`}
        style={!isRunning ? { pointerEvents: "auto" } : undefined}
        tabIndex={0}
        onClick={isRunning ? onSkip : onPlay}
      >
        <span>{isRunning ? intro.skip : intro.play}</span>
        <i aria-hidden="true" />
      </button>

      <div className={styles.introConceptStage} aria-hidden="true">
        <div ref={conceptListRef} className={styles.introConceptList}>
          {concepts.map((concept) => (
            <div
              key={concept.id}
              className={`${styles.introConcept} ${
                styles[getConceptKind(concept)]
              }`}
              data-intro-concept={concept.id}
            >
              <span className={styles.introConceptWriting}>
                <AnimatedLabel text={concept.title} kind="concept" />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.introInstructionContainer}>
        <p
          ref={instructionRef}
          className={styles.introInstruction}
          aria-label={intro.instruction}
        >
          {intro.instruction.split(" · ").map((line, lineIndex) => (
            <span
              key={lineIndex}
              className={styles.introInstructionLine}
              style={{ display: "block" }}
            >
              {line.split("").map((char, index) => (
                <span
                  key={index}
                  data-intro-char
                  style={{
                    display: "inline-block",
                    whiteSpace: char === " " ? "pre" : "normal",
                  }}
                >
                  {char}
                </span>
              ))}
            </span>
          ))}
        </p>
      </div>

      <div className={styles.introCopy}>
        <h2
          ref={titleRef}
          className={styles.introTitle}
          aria-label={intro.title}
        >
          <span className={styles.introTitleWriting} aria-hidden="true">
            <AnimatedLabel text={intro.title} kind="title" />
          </span>
        </h2>
      </div>
    </section>
  );
}
