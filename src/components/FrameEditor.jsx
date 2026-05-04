/**
 * FrameEditor.jsx
 *
 * Sidebar panel for managing GIF frames:
 *   – Navigate to a frame by clicking its thumbnail
 *   – Add a new frame from an image file on your device
 *   – Duplicate a frame (inserts a copy after the selected frame)
 *   – Delete a frame (disabled when only one frame remains)
 *   – Reorder frames with ↑ / ↓ buttons or by typing a target position
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

/**
 * Position input: shows the 1-based frame number and lets the user type a
 * target position to move the frame there on blur / Enter.
 */
function PositionInput({ index, total, onMove }) {
  const [raw, setRaw] = useState(String(index + 1));

  useEffect(() => {
    setRaw(String(index + 1));
  }, [index]);

  const commit = () => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      const target = Math.max(1, Math.min(total, n)) - 1; // convert to 0-based
      if (target !== index) onMove(target);
      setRaw(String(target + 1));
    } else {
      setRaw(String(index + 1));
    }
  };

  return (
    <input
      className="frame-editor__pos-input"
      type="number"
      min={1}
      max={total}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      title="Frame position — type a number to move this frame"
      aria-label={`Frame position (1–${total})`}
    />
  );
}

export default function FrameEditor() {
  const { state, setCurrentFrame, deleteFrame, duplicateFrame, reorderFrames, updateFrameDelay, addFrame } =
    useProject();
  const { frames, currentFrameIndex } = state;
  const canvasWidth = state.width;
  const canvasHeight = state.height;

  const fileInputRef = useRef(null);

  /** Read an image file, draw it onto a canvas scaled to the project dimensions, and add it as a new frame. */
  const handleImageFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      // Draw the image scaled to fill the canvas (letterbox / pillarbox to keep aspect ratio)
      const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (canvasWidth - drawW) / 2;
      const offsetY = (canvasHeight - drawH) / 2;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      URL.revokeObjectURL(url);
      // Insert after the currently selected frame
      addFrame(currentFrameIndex + 1, imageData, 100);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('Could not load the selected image.');
    };
    img.src = url;
  };

  const onFileInputChange = (e) => {
    handleImageFile(e.target.files[0]);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  if (!frames.length) return null;

  return (
    <div className="frame-editor" aria-label="Frame editor">
      <div className="frame-editor__header">
        <h3 className="frame-editor__title">Frames</h3>
        <div className="frame-editor__header-actions">
          <span className="frame-editor__count">{frames.length} frame{frames.length !== 1 ? 's' : ''}</span>
          <button
            className="frame-editor__add-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Add frame from image file"
            aria-label="Add frame from image file"
          >
            + Add Frame
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onFileInputChange}
          />
        </div>
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
            </button>

            {/* Position input */}
            <PositionInput
              index={i}
              total={frames.length}
              onMove={(target) => reorderFrames(i, target)}
            />

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
