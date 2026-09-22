"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  getBrainConceptFocusNodes,
  getBrainSkillPosition,
} from "./BrainGraph.config";
import {
  resetBrainRuntimeState,
  type BrainRuntime,
} from "./BrainGraph.runtime";
import {
  brainGraphReducer,
  createInitialBrainGraphState,
  isMissionSequenceRunning as getIsMissionSequenceRunning,
} from "./brain/BrainGraph.reducer";
import BrainGraphMission from "./brain/BrainGraphMission";
import BrainGraphNavigation from "./brain/BrainGraphNavigation";
import BrainGraphScene, {
  BrainGraphCursor,
} from "./brain/BrainGraphScene";
import {
  brainConceptClientPoint,
  createMiniBrainLinks,
} from "./brain/BrainGraph.visuals";
import {
  BRAIN_BOUNDS_SCALE_X,
  BRAIN_BOUNDS_SCALE_Y,
  isPointInBrain,
} from "./BrainGraph.geometry";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type { BrainConceptViewModel, BrainViewModel } from "@/types/brain";
import styles from "./BrainGraph.module.css";

interface BrainGraphProps {
  isActive: boolean;
  viewModel: BrainViewModel;
  brainRuntime: BrainRuntime;
}

const BRAIN_INTRO_SESSION_KEY = "brain-concept-tour-intro-v5-completed";
const BRAIN_INTRO_PREVIEW_PARAM = "brain-intro";
const BRAIN_INTRO_BRAIN_SETTLE_DURATION_SECONDS = 1.55;
const BRAIN_INTRO_DIM_DURATION_SECONDS = 0.26;
const BRAIN_INTRO_TITLE_DURATION_SECONDS = 1.85;
const BRAIN_INTRO_CONCEPT_INTERVAL_SECONDS = 2.1;

const isBrainIntroPreviewEnabled = () => {
  if (process.env.NODE_ENV === "development") return true;

  try {
    return (
      new URLSearchParams(window.location.search).get(
        BRAIN_INTRO_PREVIEW_PARAM
      ) === "preview"
    );
  } catch {
    return false;
  }
};

const hasCompletedBrainIntro = () => {
  try {
    return window.sessionStorage.getItem(BRAIN_INTRO_SESSION_KEY) === "true";
  } catch {
    return false;
  }
};

const persistCompletedBrainIntro = () => {
  try {
    window.sessionStorage.setItem(BRAIN_INTRO_SESSION_KEY, "true");
  } catch {
    // The in-memory ref still preserves the behavior for this SPA lifecycle.
  }
};

export default function BrainGraph({
  isActive,
  viewModel,
  brainRuntime,
}: BrainGraphProps) {
  const { concepts, intro, skills, ui } = viewModel;
  const {
    particleAnchorRef,
    requestRenderRef,
    stateRef,
    zoomAnchorRef,
  } = brainRuntime;
  const prefersReducedMotion = useReducedMotionPreference();
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const introRef = useRef<HTMLElement>(null);
  const introTitleRef = useRef<HTMLHeadingElement>(null);
  const introConceptListRef = useRef<HTMLDivElement>(null);
  const introInstructionRef = useRef<HTMLParagraphElement>(null);
  const introSkipRef = useRef<HTMLButtonElement>(null);
  const conceptTitleRef = useRef<HTMLDivElement>(null);
  const miniBrainMenuRef = useRef<HTMLElement>(null);
  const backControlRef = useRef<HTMLButtonElement>(null);
  const introTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const introExitTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const focusExitTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const candidateAreaRef = useRef<string | null>(null);
  const hoveredAreaRef = useRef<string | null>(null);
  const hasExploredCoreRef = useRef(false);
  const [brainState, dispatch] = useReducer(
    brainGraphReducer,
    undefined,
    createInitialBrainGraphState
  );
  const {
    candidateConceptId: candidateAreaId,
    cursor,
    discoveredConceptIds: discoveredAreaIds,
    hoveredConceptId: hoveredAreaId,
    missionPhase,
    selectedConceptId: selectedAreaId,
  } = brainState;
  const missionPhaseRef = useRef(missionPhase);
  missionPhaseRef.current = missionPhase;
  const cursorKind = cursor.kind;
  const isCursorVisible = cursor.visible;
  const isMissionSequenceRunning =
    getIsMissionSequenceRunning(missionPhase);
  const showProgress = missionPhase === "exploring";

  // Activation / Deactivation state management
  useEffect(() => {
    if (!isActive) {
      introTimelineRef.current?.kill();
      introTimelineRef.current = null;
      introExitTimelineRef.current?.kill();
      introExitTimelineRef.current = null;
      candidateAreaRef.current = null;
      hoveredAreaRef.current = null;
      stateRef.current.candidateConceptId = null;
      stateRef.current.conceptProximity = 0;
      stateRef.current.introCoreSkillIds = new Set();
      stateRef.current.introIntensity = 1;
      dispatch({ type: "DEACTIVATE" });
      requestRenderRef.current();
      return;
    }

    resetBrainRuntimeState(brainRuntime);
    const isIntroPreview = isBrainIntroPreviewEnabled();
    const hasCompletedIntro =
      hasExploredCoreRef.current || hasCompletedBrainIntro();
    if (!isIntroPreview) {
      hasExploredCoreRef.current = hasCompletedIntro;
    }
    const showIntro = isIntroPreview || !hasCompletedIntro;
    dispatch({ type: "ACTIVATE", showIntro });

    return () => {
      introTimelineRef.current?.kill();
      introTimelineRef.current = null;
      introExitTimelineRef.current?.kill();
      introExitTimelineRef.current = null;
      resetBrainRuntimeState(brainRuntime);
    };
  }, [isActive, brainRuntime, requestRenderRef, stateRef]);

  useGSAP(
    () => {
      if (missionPhase !== "intro") return;
      if (prefersReducedMotion) {
        hasExploredCoreRef.current = true;
        persistCompletedBrainIntro();
        dispatch({ type: "START_EXPLORING" });
        requestRenderRef.current();
        return;
      }

      const intro = introRef.current;
      const title = introTitleRef.current;
      const conceptList = introConceptListRef.current;
      const instruction = introInstructionRef.current;
      const skip = introSkipRef.current;
      if (
        !intro ||
        !title ||
        !conceptList ||
        !instruction ||
        !skip
      ) {
        return;
      }

      const conceptCards = Array.from(
        conceptList.querySelectorAll<HTMLElement>("[data-intro-concept]")
      );
      const titleCharacters = Array.from(
        title.querySelectorAll<HTMLElement>(
          '[data-intro-writing="title"]'
        )
      );
      const instructionChars = Array.from(
        instruction.querySelectorAll<HTMLElement>("[data-intro-char]")
      );

      gsap.set(intro, {
        autoAlpha: 0,
        pointerEvents: "none",
      });
      gsap.set(title, { autoAlpha: 0, y: 16, scale: 0.975 });
      gsap.set(conceptCards, { autoAlpha: 0, x: -22, y: 9 });
      gsap.set(titleCharacters, {
        autoAlpha: 0,
        y: 7,
        rotation: -1.4,
        clipPath: "inset(0 100% 0 0)",
      });
      conceptCards.forEach((card) => {
        gsap.set(
          card.querySelectorAll<HTMLElement>(
            '[data-intro-writing="concept"]'
          ),
          {
            autoAlpha: 0,
            y: 6,
            rotation: -1.2,
            clipPath: "inset(0 100% 0 0)",
          }
        );
      });
      gsap.set(instruction, { autoAlpha: 1 });
      gsap.set(instructionChars, {
        autoAlpha: 0,
        y: 12,
        filter: "blur(12px)",
      });
      gsap.set(skip, { autoAlpha: 0, y: -7 });

      candidateAreaRef.current = null;
      hoveredAreaRef.current = null;

      stateRef.current.introIntensity = 1;
      requestRenderRef.current();

      const clearIntroPreview = () => {
        const interaction = stateRef.current;
        interaction.activeConceptId = null;
        interaction.candidateConceptId = null;
        interaction.conceptProximity = 0;
        interaction.selectedSkillIds = new Set();
        interaction.relatedSkillGroups = [];
        interaction.introCoreSkillIds = new Set();
        interaction.pinned = false;
        requestRenderRef.current();
      };

      const showIntroConcept = (
        concept: BrainConceptViewModel,
        strength: number
      ) => {
        const interaction = stateRef.current;
        interaction.activeConceptId = null;
        interaction.candidateConceptId = concept.id;
        interaction.conceptProximity = strength;
        interaction.selectedSkillIds = new Set();
        interaction.relatedSkillGroups = concept.visual.connections;
        interaction.introCoreSkillIds = new Set([
          concept.visual.protagonistId,
        ]);
        interaction.pinned = false;
        requestRenderRef.current();
      };

      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          introTimelineRef.current = null;
          resetBrainRuntimeState(brainRuntime);
          hasExploredCoreRef.current = true;
          persistCompletedBrainIntro();
          dispatch({ type: "START_EXPLORING" });
        },
      });
      introTimelineRef.current = timeline;
      const brainDimClock = { intensity: 1 };
      const brainRestoreClock = { intensity: 0 };

      const tourStart =
        BRAIN_INTRO_BRAIN_SETTLE_DURATION_SECONDS +
        BRAIN_INTRO_DIM_DURATION_SECONDS +
        BRAIN_INTRO_TITLE_DURATION_SECONDS +
        0.02;

      timeline
        .addLabel("dim", BRAIN_INTRO_BRAIN_SETTLE_DURATION_SECONDS)
        .to(
          brainDimClock,
          {
            intensity: 0,
            duration: BRAIN_INTRO_DIM_DURATION_SECONDS,
            ease: "power2.inOut",
            onUpdate: () => {
              stateRef.current.introIntensity = brainDimClock.intensity;
              requestRenderRef.current();
            },
          },
          "dim"
        )
        .addLabel(
          "surface",
          BRAIN_INTRO_BRAIN_SETTLE_DURATION_SECONDS +
            BRAIN_INTRO_DIM_DURATION_SECONDS
        )
        .set(
          intro,
          { autoAlpha: 1, pointerEvents: "auto" },
          "surface"
        )
        .to(
          skip,
          { autoAlpha: 1, y: 0, duration: 0.28 },
          "surface+=0.04"
        )
        .to(
          title,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.26,
            ease: "power4.out",
          },
          "surface+=0.1"
        )
        .to(
          titleCharacters,
          {
            autoAlpha: 1,
            y: 0,
            rotation: 0,
            clipPath: "inset(0 0% 0 0)",
            duration: 0.52,
            stagger: 0.015,
            ease: "power2.inOut",
          },
          "surface+=0.12"
        )
        .addLabel("tour", tourStart);

      concepts.forEach((concept, index) => {
        const card = conceptCards[index];
        const characters = card
          ? Array.from(
              card.querySelectorAll<HTMLElement>(
                '[data-intro-writing="concept"]'
              )
            )
          : [];
        const focusClock = { progress: 0 };
        const label = `concept-${String(index + 1).padStart(2, "0")}`;
        const position = tourStart + index * BRAIN_INTRO_CONCEPT_INTERVAL_SECONDS;

        timeline
          .addLabel(label, position)
          .call(() => showIntroConcept(concept, 0), [], label);

        if (card) {
          timeline
            .to(
              card,
              {
                autoAlpha: 1,
                x: 0,
                y: 0,
                duration: 0.32,
                ease: "power4.out",
              },
              label
            )
            .to(
              characters,
              {
                autoAlpha: 1,
                y: 0,
                rotation: 0,
                clipPath: "inset(0 0% 0 0)",
                duration: 0.46,
                stagger: 0,
                ease: "power1.inOut",
              },
              `${label}+=0.04`
            )
            .to(
              card,
              {
                autoAlpha: 0,
                x: 14,
                y: -7,
                duration: 0.25,
                ease: "power2.in",
              },
              `${label}+=1.82`
            );
        }

        timeline
          .to(
            focusClock,
            {
              progress: 1,
              duration: 0.48,
              ease: "power2.out",
              onUpdate: () => showIntroConcept(concept, focusClock.progress),
            },
            `${label}+=0.02`
          )
          .to(
            focusClock,
            {
              progress: 0,
              duration: 0.24,
              ease: "power2.in",
              onUpdate: () => showIntroConcept(concept, focusClock.progress),
            },
            `${label}+=1.78`
          )
          .call(clearIntroPreview, [], `${label}+=2.06`);
      });

      const unisonTime =
        tourStart + concepts.length * BRAIN_INTRO_CONCEPT_INTERVAL_SECONDS;
      const introCopy = intro.querySelector(`.${styles.introCopy}`);

      timeline
        .addLabel("handoff", unisonTime)
        .call(clearIntroPreview, [], "handoff")
        .to(
          brainRestoreClock,
          {
            intensity: 1,
            duration: 0.3,
            ease: "power2.inOut",
            onUpdate: () => {
              stateRef.current.introIntensity = brainRestoreClock.intensity;
              requestRenderRef.current();
            },
          },
          "handoff"
        )
        .to(
          skip,
          { autoAlpha: 0, y: -5, duration: 0.18, pointerEvents: "none" },
          "handoff+=0.22"
        )
        .to(
          introCopy || title,
          {
            autoAlpha: 0,
            y: -9,
            duration: 0.28,
            ease: "power3.inOut",
          },
          "handoff+=0.46"
        )
        .to(
          instructionChars,
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            stagger: 0.02,
            duration: 0.55,
            ease: "power2.out",
          },
          "handoff+=0.3"
        )
        .to(
          title,
          {
            autoAlpha: 0,
            y: -12,
            filter: "blur(8px)",
            duration: 0.85,
            ease: "power2.in",
          },
          "handoff+=3.3"
        )
        .to(
          instructionChars,
          {
            autoAlpha: 0,
            x: () => gsap.utils.random(-18, 18),
            y: () => gsap.utils.random(20, 42),
            rotation: () => gsap.utils.random(-45, 45),
            filter: "blur(8px)",
            stagger: {
              each: 0.015,
              from: "random",
            },
            duration: 0.85,
            ease: "power1.in",
          },
          "handoff+=3.3"
        )
        .set(
          intro,
          {
            pointerEvents: "none",
          },
          "handoff+=4.2"
        )
        .to(
          `.${styles.brainAnchor}`,
          {
            scale: 1.06,
            duration: 0.32,
            ease: "power2.out",
          },
          "handoff+=4.0"
        )
        .to(
          `.${styles.brainAnchor}`,
          {
            scale: 1.0,
            duration: 0.75,
            ease: "elastic.out(1.1, 0.45)",
          }
        );

      return () => {
        timeline.kill();
        if (introTimelineRef.current === timeline) {
          introTimelineRef.current = null;
        }
        introExitTimelineRef.current?.kill();
        introExitTimelineRef.current = null;

        // Reset intro state to prevent getting stuck if killed or interrupted
        const interaction = stateRef.current;
        interaction.introCoreSkillIds = new Set();
        interaction.introIntensity = 1;
        requestRenderRef.current();
      };
    },
    {
      scope: stageRef,
      dependencies: [
        concepts,
        prefersReducedMotion,
        requestRenderRef,
        stateRef,
        missionPhase,
      ],
      revertOnUpdate: true,
    }
  );

  useEffect(() => {
    if (!prefersReducedMotion) return;

    introTimelineRef.current?.progress(1);
    introExitTimelineRef.current?.progress(1);
  }, [prefersReducedMotion]);

  const { contextSafe } = useGSAP({ scope: stageRef });

  const handleSkipIntro = contextSafe(() => {
    const intro = introRef.current;
    const title = introTitleRef.current;
    const conceptList = introConceptListRef.current;
    const instruction = introInstructionRef.current;
    if (
      missionPhaseRef.current !== "intro" ||
      !intro ||
      !title ||
      !conceptList ||
      !instruction ||
      !introSkipRef.current ||
      introExitTimelineRef.current
    ) {
      return;
    }

    const cards = Array.from(
      conceptList.querySelectorAll<HTMLElement>("[data-intro-concept]")
    );
    const skip = introSkipRef.current;
    const brainRestoreClock = {
      intensity: stateRef.current.introIntensity,
    };

    introTimelineRef.current?.kill();
    introTimelineRef.current = null;
    hasExploredCoreRef.current = true;
    persistCompletedBrainIntro();
    gsap.set(intro, { pointerEvents: "none" });

    introExitTimelineRef.current = gsap
      .timeline({
        onComplete: () => {
          introExitTimelineRef.current = null;
          resetBrainRuntimeState(brainRuntime);
          dispatch({ type: "START_EXPLORING" });
        },
      })
      .to(
        [title, instruction, skip, ...cards],
        {
          autoAlpha: 0,
          y: -7,
          duration: 0.26,
          stagger: 0.018,
          ease: "power2.in",
        },
        0
      )
      .to(
        brainRestoreClock,
        {
          intensity: 1,
          duration: 0.42,
          ease: "power2.inOut",
          onUpdate: () => {
            stateRef.current.introIntensity = brainRestoreClock.intensity;
            requestRenderRef.current();
          },
        },
        0
      );
  });

  const handlePlayIntro = contextSafe(() => {
    // Reset hasExploredCore to run it again
    hasExploredCoreRef.current = false;
    dispatch({ type: "REPLAY_INTRO" });
  });

  useGSAP(
    () => {
      if (missionPhase !== "exploring") return;
      if (!introSkipRef.current) return;

      gsap.fromTo(
        introSkipRef.current,
        { autoAlpha: 0, y: -5 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          ease: "power2.out",
          clearProps: "transform",
        }
      );
    },
    { scope: stageRef, dependencies: [missionPhase] }
  );

  useGSAP(
    () => {
      const title = conceptTitleRef.current;
      const zoom = zoomAnchorRef.current;
      const back = backControlRef.current;
      if (!selectedAreaId || !title || !zoom) return;

      focusExitTimelineRef.current?.kill();
      focusExitTimelineRef.current = null;
      const labels = Array.from(
        zoom.querySelectorAll<HTMLElement>(`.${styles.conceptNeuronLabel}`)
      );
      const lines = Array.from(
        zoom.querySelectorAll<SVGElement>(`.${styles.connectorLine}`)
      );

      if (prefersReducedMotion) {
        stateRef.current.focusProgress = 1;
        gsap.set(title, {
          autoAlpha: 1,
          filter: "none",
        });
        gsap.set(zoom, {
          autoAlpha: 1,
          filter: "none",
        });
        if (back) {
          gsap.set(back, {
            autoAlpha: 1,
            filter: "none",
          });
        }
        gsap.set(labels, { autoAlpha: 1, filter: "none" });
        gsap.set(lines, { autoAlpha: 0.52 });
        requestRenderRef.current();
        return;
      }

      const reveal = { progress: 0 };

      stateRef.current.focusProgress = 0;
      gsap.set(title, {
        autoAlpha: 0,
        filter: "blur(14px)",
      });
      gsap.set(zoom, {
        autoAlpha: 0,
        filter: "blur(10px)",
        scale: 0.96,
        transformOrigin: "center center",
      });
      if (back) {
        gsap.set(back, {
          autoAlpha: 0,
          filter: "blur(5px)",
        });
      }
      gsap.set(labels, {
        autoAlpha: 0,
        filter: "blur(5px)",
        y: "-45%",
        scale: 0.9,
        transformOrigin: "center center",
      });

      gsap.set(lines, { autoAlpha: 0 });

      const timeline = gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .to(reveal, {
          progress: 1,
          duration: 1.05,
          ease: "power2.inOut",
          onUpdate: () => {
            stateRef.current.focusProgress = reveal.progress;
            requestRenderRef.current();
          },
        })
        .to(
          zoom,
          {
            autoAlpha: 1,
            filter: "blur(0px)",
            scale: 1,
            duration: 0.78,
            ease: "power4.out",
          },
          0.04
        )
        .to(
          title,
          {
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.9,
          },
          0.12
        )
        // All satellite labels stagger outward
        .to(
          labels,
          {
            autoAlpha: 1,
            filter: "blur(0px)",
            y: "-50%",
            scale: 1,
            duration: 0.46,
            stagger: { each: 0.07, ease: "power2.out" },
            ease: "back.out(1.3)",
          },
          0.38
        )
        // All connector lines stagger outward matching labels
        .to(
          lines,
          {
            autoAlpha: 0.52,
            duration: 0.38,
            stagger: { each: 0.07, ease: "power2.out" },
          },
          0.45
        );

      if (back) {
        timeline.to(
          back,
          {
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.42,
          },
          0.6
        );
      }

      return () => timeline.kill();

    },
    {
      scope: stageRef,
      dependencies: [
        prefersReducedMotion,
        requestRenderRef,
        selectedAreaId,
        stateRef,
        zoomAnchorRef,
      ],
      revertOnUpdate: true,
    }
  );

  const skillsById = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill])),
    [skills]
  );
  const miniBrainLinks = useMemo(
    () => createMiniBrainLinks(concepts),
    [concepts]
  );

  const rememberCoreExploration = () => {
    if (hasExploredCoreRef.current) return;

    hasExploredCoreRef.current = true;
    persistCompletedBrainIntro();
  };
  const conceptsById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept])),
    [concepts]
  );

  const clearProximityRuntime = () => {
    stateRef.current.candidateConceptId = null;
    stateRef.current.conceptProximity = 0;
    candidateAreaRef.current = null;
    hoveredAreaRef.current = null;
    requestRenderRef.current();
  };

  const clearProximity = () => {
    clearProximityRuntime();
    dispatch({ type: "CLEAR_PROXIMITY" });
  };

  const revealConcept = (conceptId: string) => {
    clearProximityRuntime();
    dispatch({ type: "REVEAL_CONCEPT", conceptId });
  };

  const selectConcept = (conceptId: string) => {
    clearProximityRuntime();
    if (!discoveredAreaIds.has(conceptId)) {
      dispatch({ type: "REVEAL_CONCEPT", conceptId });
    }
    dispatch({ type: "SELECT_CONCEPT", conceptId });
  };

  const handleHoverConceptFromNav = (conceptId: string | null) => {
    hoveredAreaRef.current = conceptId;
    if (conceptId) {
      const concept = concepts.find((c) => c.id === conceptId);
      if (concept) {
        stateRef.current.candidateConceptId = conceptId;
        stateRef.current.conceptProximity = 1;
        stateRef.current.relatedSkillGroups = concept.visual.connections;
      }
    } else {
      stateRef.current.candidateConceptId = null;
      stateRef.current.conceptProximity = 0;
      stateRef.current.relatedSkillGroups = [];
    }
    requestRenderRef.current();

    dispatch({
      type: "UPDATE_PROXIMITY",
      candidateConceptId: conceptId,
      hoveredConceptId: conceptId,
      cursorKind: conceptId
        ? getBrainSkillPosition(
            concepts.find((c) => c.id === conceptId)!.visual.protagonistId
          )?.kind ?? null
        : null,
    });
  };

  const releaseConcept = contextSafe(() => {
    const title = conceptTitleRef.current;
    const zoom = zoomAnchorRef.current;
    const back = backControlRef.current;
    if (!selectedAreaId || !zoom) {
      dispatch({ type: "CLEAR_SELECTION" });
      return;
    }

    focusExitTimelineRef.current?.kill();
    if (prefersReducedMotion) {
      stateRef.current.focusProgress = 0;
      gsap.set([title, zoom, back].filter(Boolean), {
        autoAlpha: 0,
        filter: "none",
      });
      requestRenderRef.current();
      dispatch({ type: "CLEAR_SELECTION" });
      return;
    }

    const reveal = {
      progress: stateRef.current.focusProgress,
    };

    focusExitTimelineRef.current = gsap
      .timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => dispatch({ type: "CLEAR_SELECTION" }),
      })
      .to([title, zoom, back].filter(Boolean), {
        autoAlpha: 0,
        filter: "blur(9px)",
        duration: 0.34,
        stagger: 0.025,
      })
      .to(
        reveal,
        {
          progress: 0,
          duration: 0.58,
          onUpdate: () => {
            stateRef.current.focusProgress = reveal.progress;
            requestRenderRef.current();
          },
        },
        0.06
      );
  });

  const handleStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!selectedAreaId) return;

    const target = event.target as Node;
    if (
      conceptTitleRef.current?.contains(target) ||
      zoomAnchorRef.current?.contains(target) ||
      miniBrainMenuRef.current?.contains(target)
    ) {
      return;
    }

    const anchor = particleAnchorRef.current;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const normalizedX =
        (event.clientX - (rect.left + rect.width / 2)) /
        (rect.width * BRAIN_BOUNDS_SCALE_X);
      const normalizedY =
        (event.clientY - (rect.top + rect.height / 2)) /
        (rect.height * BRAIN_BOUNDS_SCALE_Y);
      if (isPointInBrain(normalizedX, normalizedY)) return;
    }

    releaseConcept();
  };

  const moveBrainCursor = (event: ReactMouseEvent<HTMLDivElement>) => {
    const cursor = cursorRef.current;
    const anchor = particleAnchorRef.current;
    if (!cursor || !anchor) return;

    const rect = anchor.getBoundingClientRect();
    cursor.style.setProperty("--cursor-x", `${event.clientX}px`);
    cursor.style.setProperty("--cursor-y", `${event.clientY}px`);
    if (selectedAreaId !== null) {
      clearProximity();
      return;
    }

    let nearestConcept: BrainConceptViewModel | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const concept of concepts) {
      const point = brainConceptClientPoint(concept, rect);
      if (!point) continue;
      const distance = Math.hypot(
        event.clientX - point.x,
        event.clientY - point.y
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestConcept = concept;
      }
    }

    const proximityRadius = Math.max(78, Math.min(132, rect.width * 0.19));
    const selectionRadius = Math.max(38, Math.min(62, rect.width * 0.086));
    const proximity = Math.max(
      0,
      Math.min(1, 1 - nearestDistance / proximityRadius)
    );
    const nextCandidate =
      nearestConcept && proximity > 0 ? nearestConcept : null;
    const nextHovered =
      nextCandidate && nearestDistance <= selectionRadius
        ? nextCandidate
        : null;

    if (nextHovered) rememberCoreExploration();

    stateRef.current.candidateConceptId = nextCandidate?.id ?? null;
    stateRef.current.conceptProximity = nextCandidate ? proximity : 0;
    requestRenderRef.current();

    const nextKind = nextCandidate
      ? getBrainSkillPosition(nextCandidate.visual.protagonistId)?.kind ?? null
      : null;
    const nextCandidateId = nextCandidate?.id ?? null;
    const nextHoveredId = nextHovered?.id ?? null;
    if (
      candidateAreaRef.current === nextCandidateId &&
      hoveredAreaRef.current === nextHoveredId &&
      cursorKind === nextKind
    ) {
      return;
    }

    candidateAreaRef.current = nextCandidateId;
    hoveredAreaRef.current = nextHoveredId;
    dispatch({
      type: "UPDATE_PROXIMITY",
      candidateConceptId: nextCandidateId,
      hoveredConceptId: nextHoveredId,
      cursorKind: nextKind,
    });
  };

  const viewedAreaId = selectedAreaId ?? hoveredAreaId;
  const viewedArea = viewedAreaId
    ? conceptsById.get(viewedAreaId) ?? null
    : null;
  const isPinned = selectedAreaId !== null;

  useEffect(() => {
    if (!isActive) return;

    const interaction = stateRef.current;
    interaction.focusSide = null;
    interaction.focusSkillId = null;
    interaction.focusSubIndex = null;

    if (!viewedArea) {
      interaction.activeConceptId = null;
      interaction.pinned = false;
      interaction.selectedSkillIds = new Set();
      interaction.relatedSkillGroups = [];
      interaction.focusProgress = 0;
      requestRenderRef.current();
      return;
    }

    interaction.activeConceptId = viewedArea.id;
    interaction.pinned = isPinned;
    interaction.selectedSkillIds = new Set(viewedArea.visual.skillIds);
    interaction.relatedSkillGroups = viewedArea.visual.connections;
    if (!isPinned) interaction.focusProgress = 0;
    requestRenderRef.current();
  }, [
    brainRuntime,
    isActive,
    isPinned,
    requestRenderRef,
    stateRef,
    viewedArea,
  ]);

  useEffect(() => {
    if (!isPinned) return;

    const releaseZoom = (event: KeyboardEvent) => {
      if (event.key === "Escape") releaseConcept();
    };

    window.addEventListener("keydown", releaseZoom);
    return () => window.removeEventListener("keydown", releaseZoom);
  }, [isPinned, releaseConcept]);

  const selectedConcept = selectedAreaId
    ? conceptsById.get(selectedAreaId) ?? null
    : null;
  const selectedFocusNodes = selectedConcept
    ? getBrainConceptFocusNodes(selectedConcept)
    : [];

  const handleCursorEnter = (event: ReactMouseEvent<HTMLDivElement>) => {
    // Position the persistent cursor before revealing it, preventing a stale
    // first frame when the pointer crosses into the clipped brain area.
    moveBrainCursor(event);
    dispatch({ type: "SET_CURSOR_VISIBLE", visible: true });
  };

  const handleCursorLeave = () => {
    dispatch({ type: "SET_CURSOR_VISIBLE", visible: false });
    clearProximity();
  };

  const handleFocusConcept = (concept: BrainConceptViewModel) => {
    rememberCoreExploration();
    const protagonist = getBrainSkillPosition(concept.visual.protagonistId);
    candidateAreaRef.current = concept.id;
    hoveredAreaRef.current = concept.id;
    dispatch({
      type: "FOCUS_CONCEPT",
      conceptId: concept.id,
      cursorKind: protagonist?.kind ?? null,
    });
  };

  const activateHoveredConcept = () => {
    const conceptId = hoveredAreaRef.current;
    if (conceptId) revealConcept(conceptId);
  };

  const handleConceptClick = (conceptId: string) => {
    rememberCoreExploration();
    if (hoveredAreaRef.current === conceptId) revealConcept(conceptId);
  };

  return (
    <div className={`${styles.container} ${isPinned ? styles.zoomed : ""}`}>
      <BrainGraphCursor
        visible={isCursorVisible}
        kind={cursorKind}
        cursorRef={cursorRef}
        reduceMotion={prefersReducedMotion}
      />

      <div
        ref={stageRef}
        className={`${styles.brainStage} ${isMissionSequenceRunning ? styles.sequenceRunning : ""
          }`}
        onClick={handleStageClick}
      >
        <BrainGraphMission
          concepts={concepts}
          intro={intro}
          isRunning={isMissionSequenceRunning}
          introRef={introRef}
          titleRef={introTitleRef}
          conceptListRef={introConceptListRef}
          instructionRef={introInstructionRef}
          skipRef={introSkipRef}
          onSkip={handleSkipIntro}
          onPlay={handlePlayIntro}
        />

        <BrainGraphScene
          navigation={
            <BrainGraphNavigation
              visible={showProgress}
              concepts={concepts}
              links={miniBrainLinks}
              discoveredConceptIds={discoveredAreaIds}
              candidateConceptId={candidateAreaId}
              hoveredConceptId={hoveredAreaId}
              selectedConceptId={selectedAreaId}
              ui={ui}
              menuRef={miniBrainMenuRef}
              backControlRef={backControlRef}
              reduceMotion={prefersReducedMotion}
              onSelectConcept={selectConcept}
              onReleaseConcept={releaseConcept}
              onHoverConcept={handleHoverConceptFromNav}
            />
          }
          concepts={concepts}
          selectedConcept={selectedConcept}
          selectedFocusNodes={selectedFocusNodes}
          skillsById={skillsById}
          isPinned={isPinned}
          missionRunning={isMissionSequenceRunning}
          ui={ui}
          particleAnchorRef={particleAnchorRef}
          zoomAnchorRef={zoomAnchorRef}
          conceptTitleRef={conceptTitleRef}
          onMouseEnter={handleCursorEnter}
          onMouseMove={moveBrainCursor}
          onMouseLeave={handleCursorLeave}
          onActivateHovered={activateHoveredConcept}
          onFocusConcept={handleFocusConcept}
          onBlurConcept={clearProximity}
          onClickConcept={handleConceptClick}
        />
      </div>
    </div>
  );
}
