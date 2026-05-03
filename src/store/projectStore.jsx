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
  type: 'text',
  text: '',
  x: 50,       // default x (% of canvas width) — used as fallback when no per-frame position exists
  y: 90,       // default y (% of canvas height) — used as fallback when no per-frame position exists
  fontSize: 24,
  color: '#ffffff',
  fontFamily: 'Arial',
  bgColor: '#000000',
  bgAlpha: 0,  // 0 = transparent, 1 = fully opaque
  angle: 0,    // rotation in degrees
  mirrorX: false,  // horizontal flip
  mirrorY: false,  // vertical flip
  /** Anchor circle position (% of canvas). Text moves with anchor. */
  anchorX: 50,
  anchorY: 90,
  /** Anchor circle display radius in canvas pixels */
  anchorRadius: 18,
  /**
   * Per-frame position overrides.
   * Shape: { [frameIndex: number]: { x: number, y: number } }
   * When resolving position for a frame, we check for an exact match, then
   * walk backwards to inherit from the nearest previous keyframe, then fall
   * back to the layer-level x/y defaults above.
   */
  positions: {},
};

// ─── Default image layer properties ───────────────────────────────────────────

export const DEFAULT_IMAGE_LAYER_PROPS = {
  type: 'image',
  src: null,        // data URL of the image
  widthPct: 30,     // width as % of canvas width
  aspectRatio: 1,   // height / width of original image
  x: 50,
  y: 50,
  angle: 0,
  mirrorX: false,
  mirrorY: false,
  anchorX: 50,
  anchorY: 50,
  anchorRadius: 18,
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

/**
 * The subset of DEFAULT_TEXT_LAYER_PROPS that can be overridden via "Default Settings".
 * Position (x/y/anchorX/anchorY/positions) and frame range are intentionally excluded.
 */
export const DEFAULT_SETTINGS_KEYS = [
  'fontSize', 'color', 'fontFamily', 'bgColor', 'bgAlpha',
  'angle', 'mirrorX', 'mirrorY', 'anchorRadius',
];

function pickDefaultSettings(props) {
  return Object.fromEntries(DEFAULT_SETTINGS_KEYS.map((k) => [k, props[k]]));
}

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
  /**
   * Default styling applied to every new text layer.
   * Excludes position and frame-range fields; startFrame is always
   * set to the current frame index at the time the layer is created.
   */
  defaultLayerSettings: pickDefaultSettings(DEFAULT_TEXT_LAYER_PROPS),
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
        ...state.defaultLayerSettings,
        type: 'text',
        id,
        startFrame: state.currentFrameIndex,
        endFrame: Math.max(0, state.frames.length - 1),
      };
      return {
        ...state,
        textLayers: [...state.textLayers, newLayer],
        selectedLayerId: id,
        nextLayerId: id + 1,
      };
    }

    case 'ADD_IMAGE_LAYER': {
      const id = state.nextLayerId;
      const newLayer = {
        ...DEFAULT_IMAGE_LAYER_PROPS,
        id,
        src: action.src,
        widthPct: action.widthPct ?? 30,
        aspectRatio: action.aspectRatio ?? 1,
        startFrame: state.currentFrameIndex,
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

    case 'MOVE_ANCHOR': {
      // Move anchor and shift text positions from the current frame onwards so
      // that only frames at/after frameIndex are affected.  Earlier frames that
      // have no explicit keyframe are pinned at their current resolved position
      // (frame 0) so they don't follow the updated layer.x/y default.
      return {
        ...state,
        textLayers: state.textLayers.map((l) => {
          if (l.id !== action.id) return l;
          const clamp = (v) => Math.max(0, Math.min(100, v));
          const newAnchorX = clamp(action.anchorX);
          const newAnchorY = clamp(action.anchorY);
          const dx = newAnchorX - (l.anchorX ?? l.x ?? 50);
          const dy = newAnchorY - (l.anchorY ?? l.y ?? 90);
          const frameIndex = action.frameIndex ?? 0;
          const currentPositions = l.positions ?? {};
          const oldX = l.x ?? 50;
          const oldY = l.y ?? 90;

          // Resolve the text position at frameIndex so we can create a keyframe there.
          const resolved = getLayerPositionForFrame(l, frameIndex);
          const resolvedX = resolved.x;
          const resolvedY = resolved.y;

          const newPositions = {};

          // If no explicit keyframe exists before frameIndex, pin frame 0 at the
          // current default so earlier frames don't shift when layer.x/y updates.
          if (frameIndex > 0) {
            const hasEarlyKeyframe = Object.keys(currentPositions).some((k) => Number(k) < frameIndex);
            if (!hasEarlyKeyframe) {
              newPositions[0] = { x: oldX, y: oldY };
            }
          }

          // Carry over positions before frameIndex unchanged; shift those at/after.
          for (const [k, v] of Object.entries(currentPositions)) {
            const ki = Number(k);
            if (ki < frameIndex) {
              newPositions[ki] = v;
            } else {
              newPositions[ki] = { x: clamp(v.x + dx), y: clamp(v.y + dy) };
            }
          }

          // Always create/update a keyframe at frameIndex with the shifted position.
          newPositions[frameIndex] = { x: clamp(resolvedX + dx), y: clamp(resolvedY + dy) };

          return {
            ...l,
            anchorX: newAnchorX,
            anchorY: newAnchorY,
            x: clamp(oldX + dx),
            y: clamp(oldY + dy),
            positions: newPositions,
          };
        }),
      };
    }

    case 'SELECT_LAYER':
      return { ...state, selectedLayerId: action.id };

    case 'UPDATE_DEFAULT_SETTINGS':
      return {
        ...state,
        defaultLayerSettings: {
          ...state.defaultLayerSettings,
          ...action.changes,
        },
      };

    case 'LOAD_PROJECT':
      return {
        ...initialState,
        frames: action.frames,
        width: action.width,
        height: action.height,
        gifFileName: action.gifFileName ?? '',
        currentFrameIndex: action.currentFrameIndex ?? 0,
        textLayers: action.textLayers ?? [],
        selectedLayerId: null,
        nextLayerId: action.nextLayerId ?? 1,
        defaultLayerSettings: action.defaultLayerSettings ?? pickDefaultSettings(DEFAULT_TEXT_LAYER_PROPS),
      };

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

  const addImageLayer = useCallback((src, widthPct, aspectRatio) => {
    dispatch({ type: 'ADD_IMAGE_LAYER', src, widthPct, aspectRatio });
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

  const moveAnchor = useCallback((id, anchorX, anchorY, frameIndex) => {
    dispatch({ type: 'MOVE_ANCHOR', id, anchorX, anchorY, frameIndex });
  }, []);

  const selectLayer = useCallback((id) => {
    dispatch({ type: 'SELECT_LAYER', id });
  }, []);

  const updateDefaultSettings = useCallback((changes) => {
    dispatch({ type: 'UPDATE_DEFAULT_SETTINGS', changes });
  }, []);

  const loadProject = useCallback((projectState) => {
    dispatch({ type: 'LOAD_PROJECT', ...projectState });
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
        addImageLayer,
        deleteLayer,
        updateLayer,
        updateLayerFramePos,
        moveAnchor,
        selectLayer,
        updateDefaultSettings,
        loadProject,
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
