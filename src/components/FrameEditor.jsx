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
import { decodeFileToFrames } from '../hooks/useGifFrames';

const THUMB_H = 36;

/** Small thumbnail canvas for a single frame. */
export function FrameThumb({ frame }) {
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
  const { state, setCurrentFrame, deleteFrame, duplicateFrame, reorderFrames, updateFrameDelay, addFrame, addFrames } =
    useProject();
  const { frames, currentFrameIndex } = state;

  const fileInputRef = useRef(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [insertFrameValue, setInsertFrameValue] = useState('');
  const [insertPlacement, setInsertPlacement] = useState('after');

  useEffect(() => {
    if (!pendingImport) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cancelPendingImport();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingImport]);

  /** Read a file, decode it into one or more frames, and insert into the project. */
  const handleFile = async (file) => {
    if (!file) return;
    console.log('[handleFile] selected:', file.name, file.type, file.size);

    // Detect GIF/video so we can always show the modal for animated sources
    // even if the decoder only extracted 1 frame (useful for diagnosing issues).
    const isAnimatedSource =
      file.type === 'image/gif' ||
      file.name?.toLowerCase().endsWith('.gif') ||
      file.type?.startsWith('video/');

    try {
      const decoded = await decodeFileToFrames(file);
      const decodedFrames = decoded?.frames ?? [];

      console.log('[handleFile] decodedFrames.length:', decodedFrames.length);

      if (!decodedFrames.length) {
        alert('Could not load the selected file.');
        return;
      }

      // Single still images (png/jpg/etc.) insert directly.
      // GIFs and videos always open the modal so frame count is visible.
      if (decodedFrames.length === 1 && !isAnimatedSource) {
        addFrame(currentFrameIndex + 1, decodedFrames[0].imageData, decodedFrames[0].delay ?? 100);
        return;
      }

      const defaultInsertPosition = Math.min(frames.length + 1, currentFrameIndex + 2);
      setInsertFrameValue(String(defaultInsertPosition));
      setInsertPlacement('after');
      setPendingImport({ frames: decodedFrames, totalFrames: frames.length });
    } catch (err) {
      console.error('Frame import error:', err);
      alert('Could not load the selected file.');
    }
  };

  const cancelPendingImport = () => {
    setPendingImport(null);
    setInsertFrameValue('');
    setInsertPlacement('after');
  };

  const confirmPendingImport = () => {
    if (!pendingImport) return;

    const parsed = parseInt(insertFrameValue, 10);
    if (Number.isNaN(parsed)) {
      alert('Please enter a valid frame number.');
      return;
    }

    const referenceFrame = Math.max(1, Math.min(pendingImport.totalFrames, parsed));
    const referenceIndex = referenceFrame - 1;
    const insertAt = insertPlacement === 'before' ? referenceIndex : referenceIndex + 1;
    addFrames(insertAt, pendingImport.frames);
    cancelPendingImport();
  };

  const onFileInputChange = (e) => {
    // Capture the File reference BEFORE clearing the input so the async
    // file read that follows cannot be affected by the value reset.
    const file = e.target.files[0];
    e.target.value = '';
    handleFile(file);
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
            title="Add frames from an image, GIF, or video file"
            aria-label="Add frames from an image, GIF, or video file"
          >
            + Add Frame
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/gif,image/*,video/*,.gif,.mp4,.webm,.mov,.ogv,.m4v"
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

      {pendingImport && (
        <div className="frame-editor__modal-overlay" role="presentation" onMouseDown={cancelPendingImport}>
          <div
            className="frame-editor__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="frame-import-title"
            aria-describedby="frame-import-description"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 id="frame-import-title" className="frame-editor__modal-title">
              Insert imported frames
            </h4>
            <p id="frame-import-description" className="frame-editor__modal-copy">
              This file contains {pendingImport.frames.length} frames. Choose the 1-based frame number where they should start in the timeline.
            </p>
            <label className="frame-editor__modal-field">
              <span className="frame-editor__modal-label">Reference frame</span>
              <input
                className="frame-editor__modal-input"
                type="number"
                min={1}
                max={pendingImport.totalFrames}
                value={insertFrameValue}
                onChange={(e) => setInsertFrameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmPendingImport();
                  if (e.key === 'Escape') cancelPendingImport();
                }}
                autoFocus
              />
            </label>
            <div className="frame-editor__placement-group" role="radiogroup" aria-label="Insert relative to frame">
              <button
                type="button"
                className={`frame-editor__placement-btn${insertPlacement === 'before' ? ' frame-editor__placement-btn--active' : ''}`}
                onClick={() => setInsertPlacement('before')}
              >
                Before
              </button>
              <button
                type="button"
                className={`frame-editor__placement-btn${insertPlacement === 'after' ? ' frame-editor__placement-btn--active' : ''}`}
                onClick={() => setInsertPlacement('after')}
              >
                After
              </button>
            </div>
            <div className="frame-editor__modal-actions">
              <button className="btn btn--secondary" type="button" onClick={cancelPendingImport}>
                Cancel
              </button>
              <button className="btn btn--primary" type="button" onClick={confirmPendingImport}>
                Insert frames
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
