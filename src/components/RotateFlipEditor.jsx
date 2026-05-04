/**
 * RotateFlipEditor.jsx
 *
 * Sidebar panel for applying per-frame rotation and flip transforms to the
 * base GIF image (not to text/image overlay layers).
 *
 * For each frame the user can set:
 *   – Rotation angle in degrees (plain number input)
 *   – Flip Horizontal (checkbox)
 *   – Flip Vertical (checkbox)
 *
 * Clicking a frame thumbnail navigates to that frame (mirrors FrameEditor
 * behaviour so the canvas preview updates immediately).
 */

import React, { useEffect, useState } from 'react';
import { useProject } from '../store/projectStore';
import { FrameThumb } from './FrameEditor';

/** Controlled number input that allows free typing before committing on blur / Enter. */
function RotationInput({ value, onChange }) {
  const [raw, setRaw] = useState(String(value ?? 0));

  useEffect(() => {
    setRaw(String(value ?? 0));
  }, [value]);

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const clamped = Math.max(-360, Math.min(360, n));
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value ?? 0));
    }
  };

  return (
    <input
      className="rotate-flip-editor__rotation-input"
      type="number"
      min={-360}
      max={360}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      aria-label="Rotation in degrees"
      title="Rotation (degrees)"
    />
  );
}

export default function RotateFlipEditor() {
  const { state, setCurrentFrame, updateFrameTransform } = useProject();
  const { frames, currentFrameIndex } = state;

  if (!frames.length) return null;

  return (
    <div className="rotate-flip-editor" aria-label="Rotate and flip editor">
      <div className="rotate-flip-editor__header">
        <h3 className="rotate-flip-editor__title">Rotate / Flip</h3>
        <span className="rotate-flip-editor__count">
          {frames.length} frame{frames.length !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="rotate-flip-editor__hint">
        Set rotation (°) and flip for each frame. Changes are applied to the base image.
      </p>

      {/* Column headers */}
      <div className="rotate-flip-editor__col-headers" aria-hidden="true">
        <span className="rotate-flip-editor__col-thumb" />
        <span className="rotate-flip-editor__col-label">Rotation (°)</span>
        <span className="rotate-flip-editor__col-label">Flip H</span>
        <span className="rotate-flip-editor__col-label">Flip V</span>
      </div>

      <ul className="rotate-flip-editor__list">
        {frames.map((frame, i) => (
          <li
            key={i}
            className={`rotate-flip-editor__item${i === currentFrameIndex ? ' rotate-flip-editor__item--active' : ''}`}
          >
            {/* Thumbnail — click to navigate */}
            <button
              className="rotate-flip-editor__thumb-btn"
              onClick={() => setCurrentFrame(i)}
              title={`Go to frame ${i + 1}`}
              aria-label={`Frame ${i + 1}${i === currentFrameIndex ? ' (current)' : ''}`}
            >
              <FrameThumb frame={frame} />
              <span className="rotate-flip-editor__frame-num">{i + 1}</span>
            </button>

            {/* Rotation */}
            <RotationInput
              value={frame.rotation ?? 0}
              onChange={(v) => updateFrameTransform(i, { rotation: v })}
            />

            {/* Flip Horizontal */}
            <label className="rotate-flip-editor__checkbox-label" title="Flip horizontally">
              <input
                type="checkbox"
                className="rotate-flip-editor__checkbox"
                checked={frame.flipH ?? false}
                onChange={(e) => updateFrameTransform(i, { flipH: e.target.checked })}
                aria-label={`Frame ${i + 1} flip horizontal`}
              />
            </label>

            {/* Flip Vertical */}
            <label className="rotate-flip-editor__checkbox-label" title="Flip vertically">
              <input
                type="checkbox"
                className="rotate-flip-editor__checkbox"
                checked={frame.flipV ?? false}
                onChange={(e) => updateFrameTransform(i, { flipV: e.target.checked })}
                aria-label={`Frame ${i + 1} flip vertical`}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
