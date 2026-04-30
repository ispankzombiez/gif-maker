/**
 * Timeline.jsx
 *
 * Horizontal scrollable strip showing a thumbnail for every GIF frame.
 * The active frame is highlighted; clicking a thumbnail makes it active.
 */

import React, { useEffect, useRef } from 'react';
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
  const { state, setCurrentFrame } = useProject();
  const { frames, currentFrameIndex } = state;
  const stripRef = useRef(null);

  // Auto-scroll active frame into view
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector('.timeline__thumb--active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentFrameIndex]);

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
      <p className="timeline__info">
        Frame {currentFrameIndex + 1} / {frames.length} &nbsp;·&nbsp;
        {frames[currentFrameIndex]?.delay} ms
      </p>
    </div>
  );
}
