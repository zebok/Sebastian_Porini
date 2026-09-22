import type { BrainSkillKind } from "@/types/brain";

export type BrainMissionPhase =
  | "inactive"
  | "intro"
  | "exploring";

export interface BrainGraphState {
  missionPhase: BrainMissionPhase;
  candidateConceptId: string | null;
  hoveredConceptId: string | null;
  selectedConceptId: string | null;
  discoveredConceptIds: Set<string>;
  cursor: {
    visible: boolean;
    kind: BrainSkillKind | null;
  };
}

export type BrainGraphAction =
  | { type: "ACTIVATE"; showIntro: boolean }
  | { type: "DEACTIVATE" }
  | { type: "START_EXPLORING" }
  | { type: "REPLAY_INTRO" }
  | { type: "SET_CURSOR_VISIBLE"; visible: boolean }
  | {
      type: "UPDATE_PROXIMITY";
      candidateConceptId: string | null;
      hoveredConceptId: string | null;
      cursorKind: BrainSkillKind | null;
    }
  | {
      type: "FOCUS_CONCEPT";
      conceptId: string;
      cursorKind: BrainSkillKind | null;
    }
  | { type: "CLEAR_PROXIMITY" }
  | { type: "REVEAL_CONCEPT"; conceptId: string }
  | { type: "SELECT_CONCEPT"; conceptId: string }
  | { type: "CLEAR_SELECTION" };

export const createInitialBrainGraphState = (): BrainGraphState => ({
  missionPhase: "inactive",
  candidateConceptId: null,
  hoveredConceptId: null,
  selectedConceptId: null,
  discoveredConceptIds: new Set(),
  cursor: {
    visible: false,
    kind: null,
  },
});

const resetState = (missionPhase: BrainMissionPhase): BrainGraphState => ({
  ...createInitialBrainGraphState(),
  missionPhase,
});

export const brainGraphReducer = (
  state: BrainGraphState,
  action: BrainGraphAction
): BrainGraphState => {
  switch (action.type) {
    case "ACTIVATE":
      return resetState(action.showIntro ? "intro" : "exploring");
    case "DEACTIVATE": {
      if (state.missionPhase === "inactive") return state;
      if (isMissionSequenceRunning(state.missionPhase)) {
        return resetState("inactive");
      }

      return {
        ...state,
        candidateConceptId: null,
        hoveredConceptId: null,
        cursor: { visible: false, kind: null },
      };
    }
    case "START_EXPLORING":
      return state.missionPhase === "intro"
        ? { ...state, missionPhase: "exploring" }
        : state;
    case "REPLAY_INTRO":
      return {
        ...state,
        missionPhase: "intro",
      };
    case "SET_CURSOR_VISIBLE":
      return state.cursor.visible === action.visible
        ? state
        : {
            ...state,
            cursor: { ...state.cursor, visible: action.visible },
          };
    case "UPDATE_PROXIMITY":
      if (
        state.candidateConceptId === action.candidateConceptId &&
        state.hoveredConceptId === action.hoveredConceptId &&
        state.cursor.kind === action.cursorKind
      ) {
        return state;
      }
      return {
        ...state,
        candidateConceptId: action.candidateConceptId,
        hoveredConceptId: action.hoveredConceptId,
        cursor: { ...state.cursor, kind: action.cursorKind },
      };
    case "FOCUS_CONCEPT":
      return {
        ...state,
        candidateConceptId: action.conceptId,
        hoveredConceptId: action.conceptId,
        cursor: { ...state.cursor, kind: action.cursorKind },
      };
    case "CLEAR_PROXIMITY":
      if (
        state.candidateConceptId === null &&
        state.hoveredConceptId === null &&
        state.cursor.kind === null
      ) {
        return state;
      }
      return {
        ...state,
        candidateConceptId: null,
        hoveredConceptId: null,
        cursor: { ...state.cursor, kind: null },
      };
    case "REVEAL_CONCEPT": {
      const discoveredConceptIds = state.discoveredConceptIds.has(
        action.conceptId
      )
        ? state.discoveredConceptIds
        : new Set(state.discoveredConceptIds).add(action.conceptId);

      return {
        ...state,
        candidateConceptId: null,
        hoveredConceptId: null,
        selectedConceptId: action.conceptId,
        discoveredConceptIds,
        cursor: { visible: false, kind: null },
      };
    }
    case "SELECT_CONCEPT":
      return {
        ...state,
        candidateConceptId: null,
        hoveredConceptId: null,
        selectedConceptId: action.conceptId,
        cursor: { ...state.cursor, kind: null },
      };
    case "CLEAR_SELECTION":
      return state.selectedConceptId === null
        ? state
        : { ...state, selectedConceptId: null };
  }
};

export const isMissionSequenceRunning = (
  phase: BrainMissionPhase
): boolean => phase === "intro";
