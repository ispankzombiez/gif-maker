/**
 * projectStore.jsx
 *
 * Centralised state for the GIF editing project.
 * This module exports a React context + custom hook so every
 * component can read / write shared state without prop-drilling.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// ─── Default text layer properties ────────────────────────────────────────────

export const DEFAULT_TEXT_LAYER_PROPS = {
  text: '',
  x: 50,       // default x (% of canvas width) — used as fallback when no per-frame position exists
  y: 90,       // default y (% of canvas height) — used as fallback when no per-frame position exists
  fontSize: 24,
  color: '#ffffff',
  fontFamily: 'Arial',
  bgColor: '#000000',
  bgAlpha: 0,  // 0 = transparent, 1 = fully opaque
  /**
   * Per-frame position overrides.
   * Shape: { [frameIndex: number]: { x: number, y: number } }
   * When resolving position for a frame, we check for an exact match, then
   * walk backwards to inherit from the nearest previous keyframe, then fall
   * back to the layer-level x/y defaults above.
   */
  positions: {},
};

/**
 * Resolve the x/y position of a text layer for a specific frame.
 *
 * Resolution order:
 *  1. Exact per-frame position stored in layer.positions[frameIndex]
 *  2. Walk backwards through earlier frames for the nearest keyframe (inheritance)
 *  3. Layer-level x/y defaults
 */
export function getLayerPositionForFrame(layer, frameIndex) {
  const positions = layer.positions ?? {};
  if (positions[frameIndex] !== undefined) {
    return positions[frameIndex];
  }
  for (let i = frameIndex - 1; i >= 0; i--) {
    if (positions[i] !== undefined) {
      return positions[i];
    }
  }
  return { x: layer.x ?? 50, y: layer.y ?? 90 };
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  /** Array of { imageData: ImageData, delay: number } objects */
  frames: [],
  /** Original image dimensions */
  width: 0,
  height: 0,
  /** Index of the frame currently open in the editor */
  currentFrameIndex: 0,
  /**
   * All text overlay layers. Each layer is independent and has its own
   * text content, styling, position, and frame range.
   */
  textLayers: [],
  /** ID of the currently selected text layer (null = none). */
  selectedLayerId: null,
  /** Monotonically increasing counter for generating unique layer IDs. */
  nextLayerId: 1,
  /** Original GIF file name */
  gifFileName: '',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FRAMES':
      return {
        ...state,
        frames: action.frames,
        width: action.width,
        height: action.height,
        gifFileName: action.gifFileName,
        currentFrameIndex: 0,
        textLayers: [],
        selectedLayerId: null,
        nextLayerId: 1,
      };

    case 'SET_CURRENT_FRAME':
      return { ...state, currentFrameIndex: action.index };

    case 'ADD_LAYER': {
      const id = state.nextLayerId;
      const newLayer = {
        ...DEFAULT_TEXT_LAYER_PROPS,
        id,
        startFrame: 0,
        endFrame: Math.max(0, state.frames.length - 1),
      };
      return {
        ...state,
        textLayers: [...state.textLayers, newLayer],
        selectedLayerId: id,
        nextLayerId: id + 1,
      };
    }

    case 'DELETE_LAYER': {
      const remaining = state.textLayers.filter((l) => l.id !== action.id);
      const newSelectedId =
        state.selectedLayerId === action.id
          ? remaining.length > 0 ? remaining[remaining.length - 1].id : null
          : state.selectedLayerId;
      return { ...state, textLayers: remaining, selectedLayerId: newSelectedId };
    }

    case 'UPDATE_LAYER':
      return {
        ...state,
        textLayers: state.textLayers.map((l) =>
          l.id === action.id ? { ...l, ...action.changes } : l
        ),
      };

    case 'UPDATE_LAYER_FRAME_POS':
      return {
        ...state,
        textLayers: state.textLayers.map((l) =>
          l.id === action.id
            ? {
                ...l,
                positions: {
                  ...(l.positions ?? {}),
                  [action.frameIndex]: { x: action.x, y: action.y },
                },
              }
            : l
        ),
      };

    case 'SELECT_LAYER':
      return { ...state, selectedLayerId: action.id };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setFrames = useCallback((frames, width, height, gifFileName) => {
    dispatch({ type: 'SET_FRAMES', frames, width, height, gifFileName });
  }, []);

  const setCurrentFrame = useCallback((index) => {
    dispatch({ type: 'SET_CURRENT_FRAME', index });
  }, []);

  const addLayer = useCallback(() => {
    dispatch({ type: 'ADD_LAYER' });
  }, []);

  const deleteLayer = useCallback((id) => {
    dispatch({ type: 'DELETE_LAYER', id });
  }, []);

  const updateLayer = useCallback((id, changes) => {
    dispatch({ type: 'UPDATE_LAYER', id, changes });
  }, []);

  const updateLayerFramePos = useCallback((id, frameIndex, x, y) => {
    dispatch({ type: 'UPDATE_LAYER_FRAME_POS', id, frameIndex, x, y });
  }, []);

  const selectLayer = useCallback((id) => {
    dispatch({ type: 'SELECT_LAYER', id });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        state,
        setFrames,
        setCurrentFrame,
        addLayer,
        deleteLayer,
        updateLayer,
        updateLayerFramePos,
        selectLayer,
        reset,
        DEFAULT_TEXT_LAYER_PROPS,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
}
