"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { BrainViewModel } from "@/types/brain";
import type { BrainRuntime } from "@/components/visualizations/BrainGraph.runtime";
import { BRAIN_MASK_CLIP_PATH } from "@/components/visualizations/BrainGraph.geometry";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import styles from "./Skills.module.css";

const BrainGraph = dynamic(
  () => import("@/components/visualizations/BrainGraph"),
  {
    ssr: false,
    loading: () => (
      <div
        className={styles.brainSkeleton}
        style={{ clipPath: BRAIN_MASK_CLIP_PATH }}
      />
    ),
  }
);

interface SkillsProps {
  viewModel: BrainViewModel;
  brainRuntime: BrainRuntime;
  isActive: boolean;
}

export default function Skills({
  viewModel,
  brainRuntime,
  isActive,
}: SkillsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotionPreference();

  useGSAP(
    () => {
      gsap.from(`.${styles.graphWrapper}`, {
        opacity: 0,
        scale: prefersReducedMotion ? 1 : 0.975,
        filter: prefersReducedMotion ? "none" : "blur(5px)",
        duration: prefersReducedMotion ? 0 : 0.95,
        ease: "power4.out",
      });
    },
    {
      scope: containerRef,
      dependencies: [prefersReducedMotion],
      revertOnUpdate: true,
    }
  );

  return (
    <section className={styles.section} ref={containerRef}>
      <div className={styles.container}>
        <div className={styles.graphWrapper}>
          <BrainGraph
            isActive={isActive}
            viewModel={viewModel}
            brainRuntime={brainRuntime}
          />
        </div>
      </div>
    </section>
  );
}
