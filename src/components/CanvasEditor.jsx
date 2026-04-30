/**
 * CanvasEditor.jsx
 *
 * Renders the current GIF frame onto an HTML Canvas and draws the
 * configured text overlay on top.  The user can drag the text to
 * reposition it; touch events are forwarded to the same logic.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useProject } from '../store/projectStore';

/** Draw a frame + overlay onto a canvas context. */
export function renderFrameWithOverlay(ctx, imageData, overlay, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(imageData, 0, 0);

  if (!overlay?.text) return;

  const x = (overlay.x / 100) * width;
  const y = (overlay.y / 100) * height;
  const fontSize = overlay.fontSize ?? 24;
  const color = overlay.color ?? '#ffffff';
  const fontFamily = overlay.fontFamily ?? 'Arial';

  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = color;
  ctx.fillText(overlay.text, x, y);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export default function CanvasEditor() {
  const { state, getOverlay, updateOverlay } = useProject();
  const { frames, currentFrameIndex, width, height } = state;
  const canvasRef = useRef(null);
  const dragging = useRef(false);

  const frame = frames[currentFrameIndex];
  const overlay = getOverlay(currentFrameIndex);

  // Re-render whenever frame or overlay changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame?.imageData) return;
    const ctx = canvas.getContext('2d');
    renderFrameWithOverlay(ctx, frame.imageData, overlay, width, height);
  }, [frame, overlay, width, height]);

  // ─── Drag handling ───────────────────────────────────────────────────────

  const getCanvasPos = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 50, y: 50 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const px = (clientX - rect.left) * scaleX;
      const py = (clientY - rect.top) * scaleY;
      return {
        x: Math.round(Math.max(0, Math.min(100, (px / width) * 100))),
        y: Math.round(Math.max(0, Math.min(100, (py / height) * 100))),
      };
    },
    [width, height]
  );

  const onPointerDown = (e) => {
    if (!overlay.text) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      updateOverlay(currentFrameIndex, pos);
    },
    [getCanvasPos, currentFrameIndex, updateOverlay]
  );

  const onPointerUp = () => {
    dragging.current = false;
  };

  if (!frames.length) return null;

  // Scale canvas for display while keeping native resolution
  const MAX_WIDTH = 600;
  const displayWidth = Math.min(MAX_WIDTH, width);
  const displayHeight = Math.round((height / width) * displayWidth);

  return (
    <div className="canvas-editor">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: displayWidth, height: displayHeight, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="canvas-editor__canvas"
        aria-label="GIF frame editor – drag text to reposition"
      />
      {overlay.text && (
        <p className="canvas-editor__hint">
          💬 Drag the text on the canvas to reposition it
        </p>
      )}
    </div>
  );
}
