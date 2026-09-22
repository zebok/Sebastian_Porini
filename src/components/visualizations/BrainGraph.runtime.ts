import { createRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { BrainSkillKind } from "@/types/brain";
import type { SkillId } from "@/types/content";

export type BrainFocusSide = BrainSkillKind | "center";

export interface BrainInteractionState {
  focusSide: BrainFocusSide | null;
  focusSkillId: SkillId | null;
  focusSubIndex: number | null;
  activeConceptId: string | null;
  candidateConceptId: string | null;
  conceptProximity: number;
  pinned: boolean;
  selectedSkillIds: Set<SkillId>;
  relatedSkillGroups: SkillId[][];
  focusProgress: number;
  /** 0 dims the ambient brain during the intro; 1 restores normal rendering. */
  introIntensity: number;
  /** Core nodes highlighted by the intro without activating their networks. */
  introCoreSkillIds: Set<SkillId>;
}

export interface BrainRuntime {
  stateRef: MutableRefObject<BrainInteractionState>;
  requestRenderRef: MutableRefObject<() => void>;
  particleAnchorRef: RefObject<HTMLDivElement | null>;
  zoomAnchorRef: RefObject<HTMLDivElement | null>;
}

const createInitialBrainInteractionState = (): BrainInteractionState => ({
  focusSide: null,
  focusSkillId: null,
  focusSubIndex: null,
  activeConceptId: null,
  candidateConceptId: null,
  conceptProximity: 0,
  pinned: false,
  selectedSkillIds: new Set(),
  relatedSkillGroups: [],
  focusProgress: 0,
  introIntensity: 1,
  introCoreSkillIds: new Set(),
});

export const createBrainRuntime = (): BrainRuntime => ({
  stateRef: { current: createInitialBrainInteractionState() },
  requestRenderRef: { current: () => undefined },
  particleAnchorRef: createRef<HTMLDivElement>(),
  zoomAnchorRef: createRef<HTMLDivElement>(),
});

export const resetBrainRuntimeState = (runtime: BrainRuntime): void => {
  runtime.stateRef.current = createInitialBrainInteractionState();
  runtime.requestRenderRef.current();
};
