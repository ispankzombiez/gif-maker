/**
 * Timeline.jsx
 *
 * Horizontal scrollable strip showing a thumbnail for every GIF frame.
 * The active frame is highlighted; clicking a thumbnail makes it active.
 *
 * Controls below the strip allow:
 *   - Adding a custom frame from a device image file
 *   - Moving the current frame to an arbitrary position
 */

import React, { useEffect, useRef, useState } from 'react';
import { useProject } from '../store/projectStore';

/** Renders a single frame thumbnail onto a small canvas. */
function FrameThumb({ frame, index, isActive, onClick }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame?.imageData) return;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(frame.imageData, 0, 0);
  }, [frame]);

  const { width, height } = frame?.imageData ?? { width: 1, height: 1 };
  const THUMB_HEIGHT = 64;
  const thumbWidth = Math.round((width / height) * THUMB_HEIGHT);

  return (
    <button
      className={`timeline__thumb${isActive ? ' timeline__thumb--active' : ''}`}
      onClick={() => onClick(index)}
      title={`Frame ${index + 1}`}
      aria-label={`Frame ${index + 1}${isActive ? ' (selected)' : ''}`}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: thumbWidth, height: THUMB_HEIGHT }}
      />
      <span className="timeline__frame-num">{index + 1}</span>
    </button>
  );
}

export default function Timeline() {
  const { state, setCurrentFrame, insertFrame, reorderFrame } = useProject();
  const { frames, currentFrameIndex, width, height } = state;
  const stripRef = useRef(null);
  const addFrameInputRef = useRef(null);
  const [moveTarget, setMoveTarget] = useState('');

  // Auto-scroll active frame into view
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector('.timeline__thumb--active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentFrameIndex]);

  const handleAddFrameFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Scale image to GIF dimensions (contain + black background)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        const scale = Math.min(width / img.width, height / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (width - sw) / 2, (height - sh) / 2, sw, sh);
        const imageData = ctx.getImageData(0, 0, width, height);
        const avgDelay = frames.length
          ? Math.round(frames.reduce((s, f) => s + f.delay, 0) / frames.length)
          : 100;
        insertFrame({ imageData, delay: avgDelay }, currentFrameIndex + 1);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleMoveFrame = () => {
    const target = parseInt(moveTarget, 10) - 1; // 1-indexed → 0-indexed
    setMoveTarget('');
    if (isNaN(target) || target < 0 || target >= frames.length || target === currentFrameIndex) return;
    reorderFrame(currentFrameIndex, target);
  };

  if (!frames.length) return null;

  return (
    <div className="timeline" aria-label="Frame timeline">
      <div className="timeline__strip" ref={stripRef}>
        {frames.map((frame, i) => (
          <FrameThumb
            key={i}
            frame={frame}
            index={i}
            isActive={i === currentFrameIndex}
            onClick={setCurrentFrame}
          />
        ))}
      </div>

      <div className="timeline__controls">
        <p className="timeline__info">
          Frame {currentFrameIndex + 1} / {frames.length} &nbsp;·&nbsp;
          {frames[currentFrameIndex]?.delay} ms
        </p>

        <button
          className="btn btn--secondary timeline__add-btn"
          onClick={() => addFrameInputRef.current?.click()}
          title="Insert a frame from an image file after the current frame"
        >
          🖼 Add Frame
        </button>
        <input
          ref={addFrameInputRef}
          type="file"
          accept="image/*"
          onChange={handleAddFrameFile}
          style={{ display: 'none' }}
        />

        <div className="timeline__move-row">
          <label htmlFor="timeline-move-input" className="timeline__move-label">
            Move to:
          </label>
          <input
            id="timeline-move-input"
            className="timeline__move-input"
            type="number"
            min={1}
            max={frames.length}
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMoveFrame()}
            placeholder={currentFrameIndex + 1}
            aria-label="Target frame position"
          />
          <button
            className="btn btn--secondary timeline__move-btn"
            onClick={handleMoveFrame}
            title="Move current frame to the specified position"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
