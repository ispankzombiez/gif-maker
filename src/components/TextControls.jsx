/**
 * TextControls.jsx
 *
 * Controls for the text overlay on the current frame:
 *   – text content
 *   – font size
 *   – colour
 *   – font family
 *   – X / Y position sliders (percentage of canvas)
 *   – "Apply to all frames" shortcut
 */

import React from 'react';
import { useProject } from '../store/projectStore';

const FONT_FAMILIES = ['Arial', 'Georgia', 'Impact', 'Courier New', 'Verdana'];

export default function TextControls() {
  const { state, getOverlay, updateOverlay, applyOverlayToAll } = useProject();
  const { currentFrameIndex, frames } = state;

  if (!frames.length) return null;

  const overlay = getOverlay(currentFrameIndex);

  const update = (field, value) => updateOverlay(currentFrameIndex, { [field]: value });

  return (
    <div className="text-controls" aria-label="Text overlay controls">
      <h3 className="text-controls__title">Text Overlay</h3>

      {/* Text content */}
      <label className="text-controls__label">
        Text
        <input
          className="text-controls__input"
          type="text"
          value={overlay.text}
          onChange={(e) => update('text', e.target.value)}
          placeholder="Enter text…"
          maxLength={200}
        />
      </label>

      {/* Font family */}
      <label className="text-controls__label">
        Font
        <select
          className="text-controls__select"
          value={overlay.fontFamily}
          onChange={(e) => update('fontFamily', e.target.value)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      {/* Font size */}
      <label className="text-controls__label">
        Size ({overlay.fontSize}px)
        <input
          className="text-controls__range"
          type="range"
          min={10}
          max={120}
          value={overlay.fontSize}
          onChange={(e) => update('fontSize', Number(e.target.value))}
        />
      </label>

      {/* Colour */}
      <label className="text-controls__label">
        Color
        <input
          className="text-controls__color"
          type="color"
          value={overlay.color}
          onChange={(e) => update('color', e.target.value)}
        />
      </label>

      {/* X position */}
      <label className="text-controls__label">
        X position ({overlay.x}%)
        <input
          className="text-controls__range"
          type="range"
          min={0}
          max={100}
          value={overlay.x}
          onChange={(e) => update('x', Number(e.target.value))}
        />
      </label>

      {/* Y position */}
      <label className="text-controls__label">
        Y position ({overlay.y}%)
        <input
          className="text-controls__range"
          type="range"
          min={0}
          max={100}
          value={overlay.y}
          onChange={(e) => update('y', Number(e.target.value))}
        />
      </label>

      {/* Apply to all */}
      <button
        className="text-controls__apply-all btn btn--secondary"
        onClick={() => applyOverlayToAll(currentFrameIndex)}
        disabled={!overlay.text}
        title="Copy this frame's text overlay to every frame"
      >
        Apply to all frames
      </button>
    </div>
  );
}
