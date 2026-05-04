/**
 * FrameEditor.jsx
 *
 * Sidebar panel for managing GIF frames:
 *   – Navigate to a frame by clicking its thumbnail
 *   – Duplicate a frame (inserts a copy after the selected frame)
 *   – Delete a frame (disabled when only one frame remains)
 *   – Reorder frames with ↑ / ↓ buttons
 *   – Edit per-frame delay inline
 */

import React, { useEffect, useRef, useState } from 'react';
import { useProject } from '../store/projectStore';

const THUMB_H = 36;

/** Small thumbnail canvas for a single frame. */
function FrameThumb({ frame }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame?.imageData) return;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(frame.imageData, 0, 0);
  }, [frame]);

  const { width, height } = frame?.imageData ?? { width: 1, height: 1 };
  const thumbW = Math.round((width / height) * THUMB_H);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: thumbW, height: THUMB_H }}
      className="frame-editor__thumb"
    />
  );
}

/** Controlled delay input that allows free typing before committing on blur/Enter. */
function DelayInput({ value, onChange }) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const commit = () => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      const clamped = Math.max(10, Math.min(60000, n));
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value));
    }
  };

  return (
    <input
      className="frame-editor__delay-input"
      type="number"
      min={10}
      max={60000}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      aria-label="Frame delay in milliseconds"
    />
  );
}

export default function FrameEditor() {
  const { state, setCurrentFrame, deleteFrame, duplicateFrame, reorderFrames, updateFrameDelay } =
    useProject();
  const { frames, currentFrameIndex } = state;

  if (!frames.length) return null;

  return (
    <div className="frame-editor" aria-label="Frame editor">
      <div className="frame-editor__header">
        <h3 className="frame-editor__title">Frames</h3>
        <span className="frame-editor__count">{frames.length} frame{frames.length !== 1 ? 's' : ''}</span>
      </div>

      <ul className="frame-editor__list">
        {frames.map((frame, i) => (
          <li
            key={i}
            className={`frame-editor__item${i === currentFrameIndex ? ' frame-editor__item--active' : ''}`}
          >
            {/* Thumbnail + frame number – click to navigate */}
            <button
              className="frame-editor__thumb-btn"
              onClick={() => setCurrentFrame(i)}
              title={`Go to frame ${i + 1}`}
              aria-label={`Frame ${i + 1}${i === currentFrameIndex ? ' (current)' : ''}`}
            >
              <FrameThumb frame={frame} />
              <span className="frame-editor__num">{i + 1}</span>
            </button>

            {/* Delay editor */}
            <div className="frame-editor__delay-wrap">
              <DelayInput
                value={frame.delay ?? 100}
                onChange={(v) => updateFrameDelay(i, v)}
              />
              <span className="frame-editor__delay-unit">ms</span>
            </div>

            {/* Action buttons */}
            <div className="frame-editor__actions">
              <button
                className="frame-editor__act-btn"
                onClick={() => reorderFrames(i, i - 1)}
                disabled={i === 0}
                title="Move frame earlier"
                aria-label="Move frame earlier"
              >
                ↑
              </button>
              <button
                className="frame-editor__act-btn"
                onClick={() => reorderFrames(i, i + 1)}
                disabled={i === frames.length - 1}
                title="Move frame later"
                aria-label="Move frame later"
              >
                ↓
              </button>
              <button
                className="frame-editor__act-btn"
                onClick={() => duplicateFrame(i)}
                title="Duplicate frame"
                aria-label="Duplicate frame"
              >
                ⧉
              </button>
              <button
                className={`frame-editor__act-btn frame-editor__act-btn--danger`}
                onClick={() => deleteFrame(i)}
                disabled={frames.length <= 1}
                title="Delete frame"
                aria-label="Delete frame"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
