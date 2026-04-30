/**
 * CanvasEditor.jsx
 *
 * Renders the current GIF frame onto an HTML Canvas and draws all active
 * text layers on top.  The user can drag the selected layer to reposition it.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useProject } from '../store/projectStore';

/** Draw a single text layer onto a canvas context. */
function drawTextLayer(ctx, layer, width, height, isSelected) {
  const x = (layer.x / 100) * width;
  const y = (layer.y / 100) * height;
  const fontSize = layer.fontSize ?? 24;
  const color = layer.color ?? '#ffffff';
  const fontFamily = layer.fontFamily ?? 'Arial';

  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Optional background rect
  const bgAlpha = layer.bgAlpha ?? 0;
  if (bgAlpha > 0) {
    const metrics = ctx.measureText(layer.text);
    const pad = fontSize * 0.2;
    const bgW = metrics.width + pad * 2;
    const bgH = fontSize + pad * 2;
    ctx.save();
    ctx.globalAlpha = bgAlpha;
    ctx.fillStyle = layer.bgColor ?? '#000000';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillRect(x - bgW / 2, y - bgH / 2, bgW, bgH);
    ctx.restore();
  }

  // Text shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = color;
  ctx.fillText(layer.text, x, y);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Highlight border around the selected layer's approximate bounding box
  if (isSelected) {
    const metrics = ctx.measureText(layer.text);
    const pad = fontSize * 0.3;
    const bw = metrics.width + pad * 2;
    const bh = fontSize + pad * 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(124,92,252,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.shadowColor = 'transparent';
    ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.restore();
  }
}

/**
 * Render a GIF frame plus all text layers that are active at `frameIndex`
 * onto the given canvas context.
 *
 * Called by CanvasEditor (preview) and ExportButton (export pipeline).
 */
export function renderFrameWithLayers(ctx, imageData, textLayers, frameIndex, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.putImageData(imageData, 0, 0);

  const activeLayers = (textLayers ?? []).filter(
    (l) => l.text && frameIndex >= l.startFrame && frameIndex <= l.endFrame
  );

  for (const layer of activeLayers) {
    drawTextLayer(ctx, layer, width, height, false);
  }
}

export default function CanvasEditor() {
  const { state, updateLayer } = useProject();
  const { frames, currentFrameIndex, width, height, textLayers, selectedLayerId } = state;
  const canvasRef = useRef(null);
  const dragging = useRef(false);

  const frame = frames[currentFrameIndex];
  const selectedLayer = textLayers.find((l) => l.id === selectedLayerId) ?? null;
  const selectedActiveOnFrame =
    selectedLayer &&
    currentFrameIndex >= selectedLayer.startFrame &&
    currentFrameIndex <= selectedLayer.endFrame;

  // Re-render whenever frame or layers change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame?.imageData) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(frame.imageData, 0, 0);

    const activeLayers = textLayers.filter(
      (l) => l.text && currentFrameIndex >= l.startFrame && currentFrameIndex <= l.endFrame
    );
    for (const layer of activeLayers) {
      drawTextLayer(ctx, layer, width, height, layer.id === selectedLayerId);
    }
  }, [frame, textLayers, selectedLayerId, currentFrameIndex, width, height]);

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

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current || !selectedLayerId) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      updateLayer(selectedLayerId, pos);
    },
    [getCanvasPos, selectedLayerId, updateLayer]
  );

  const onPointerUp = () => {
    dragging.current = false;
  };

  const onPointerDownCanvas = (e) => {
    // If clicking on the canvas while no layer is selected, do nothing.
    // If a layer is selected and active, start dragging.
    if (selectedActiveOnFrame) {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  if (!frames.length) return null;

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
        onPointerDown={onPointerDownCanvas}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="canvas-editor__canvas"
        aria-label="GIF frame editor – drag selected text layer to reposition"
      />
      {selectedActiveOnFrame && selectedLayer?.text && (
        <p className="canvas-editor__hint">
          💬 Drag the selected text on the canvas to reposition it
        </p>
      )}
    </div>
  );
}
