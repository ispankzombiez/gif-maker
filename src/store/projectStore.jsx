/**
 * projectStore.js
 *
 * Centralised state for the GIF editing project.
 * This module exports a React context + custom hook so every
 * component can read / write shared state without prop-drilling.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// ─── Initial state ────────────────────────────────────────────────────────────

const DEFAULT_TEXT_OVERLAY = {
  text: '',
  x: 50,       // percentage of canvas width
  y: 90,       // percentage of canvas height
  fontSize: 24,
  color: '#ffffff',
  fontFamily: 'Arial',
};

const initialState = {
  /** Array of { imageData: ImageData, delay: number } objects */
  frames: [],
  /** Original image dimensions */
  width: 0,
  height: 0,
  /** Index of the frame currently open in the editor */
  currentFrameIndex: 0,
  /**
   * Per-frame text overlay config.
   * Key = frame index, value = text overlay object.
   * Frames not present in the map inherit DEFAULT_TEXT_OVERLAY.
   */
  frameOverlays: {},
  /** Original GIF file name, used when saving a project */
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
        frameOverlays: {},
      };

    case 'SET_CURRENT_FRAME':
      return { ...state, currentFrameIndex: action.index };

    case 'UPDATE_OVERLAY': {
      const existing = state.frameOverlays[action.index] ?? { ...DEFAULT_TEXT_OVERLAY };
      return {
        ...state,
        frameOverlays: {
          ...state.frameOverlays,
          [action.index]: { ...existing, ...action.overlay },
        },
      };
    }

    case 'APPLY_OVERLAY_TO_ALL': {
      const source = state.frameOverlays[action.index] ?? { ...DEFAULT_TEXT_OVERLAY };
      const newOverlays = {};
      state.frames.forEach((_, i) => {
        newOverlays[i] = { ...source };
      });
      return { ...state, frameOverlays: newOverlays };
    }

    case 'LOAD_PROJECT':
      return { ...action.project };

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

  const updateOverlay = useCallback((index, overlay) => {
    dispatch({ type: 'UPDATE_OVERLAY', index, overlay });
  }, []);

  const applyOverlayToAll = useCallback((index) => {
    dispatch({ type: 'APPLY_OVERLAY_TO_ALL', index });
  }, []);

  const loadProject = useCallback((project) => {
    dispatch({ type: 'LOAD_PROJECT', project });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const getOverlay = useCallback(
    (index) => state.frameOverlays[index] ?? { ...DEFAULT_TEXT_OVERLAY },
    [state.frameOverlays]
  );

  return (
    <ProjectContext.Provider
      value={{
        state,
        setFrames,
        setCurrentFrame,
        updateOverlay,
        applyOverlayToAll,
        loadProject,
        reset,
        getOverlay,
        DEFAULT_TEXT_OVERLAY,
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
