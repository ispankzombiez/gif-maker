/**
 * CanvasEditor.jsx
 *
 * Renders the current GIF frame onto an HTML Canvas and draws all active
 * text layers on top.  Touch/pointer interactions:
 *   - Single pointer drag → reposition selected text (only after movement threshold)
 *   - Tap on text layer → select it
 *   - Tap on empty space → deselect
 *   - Tap on anchor circle → start anchor drag
 *   - Two-finger pinch → resize text
 *   - Two-finger rotation → rotate text
 * A floating "+" button lets users add new text layers.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useProject, getLayerPositionForFrame } from '../store/projectStore';

const DRAG_THRESHOLD_PX = 6;

/** Apply rotation and mirror transforms, draw text centred at origin. */
function drawTextLayer(ctx, layer, width, height, isSelected) {
  const x = (layer.x / 100) * width;
  const y = (layer.y / 100) * height;
  const fontSize = layer.fontSize ?? 24;
  const color = layer.color ?? '#ffffff';
  const fontFamily = layer.fontFamily ?? 'Arial';
  const angleRad = ((layer.angle ?? 0) * Math.PI) / 180;
  const mirrorX = layer.mirrorX ?? false;
  const mirrorY = layer.mirrorY ?? false;
  const bgAlpha = layer.bgAlpha ?? 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  if (mirrorX) ctx.scale(-1, 1);
  if (mirrorY) ctx.scale(1, -1);

  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Optional background rect
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
    ctx.fillRect(-bgW / 2, -bgH / 2, bgW, bgH);
    ctx.restore();
  }

  // Text shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = color;
  ctx.fillText(layer.text, 0, 0);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Selection border
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
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }

  ctx.restore();
}

/** Draw the anchor circle for the selected layer. */
function drawAnchor(ctx, layer, width, height) {
  const ax = ((layer.anchorX ?? layer.x ?? 50) / 100) * width;
  const ay = ((layer.anchorY ?? layer.y ?? 90) / 100) * height;
  const r = layer.anchorRadius ?? 18;

  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,216,164,0.9)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 3]);
  ctx.shadowColor = 'transparent';
  ctx.stroke();

  // Cross-hairs
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ax - r * 0.5, ay);
  ctx.lineTo(ax + r * 0.5, ay);
  ctx.moveTo(ax, ay - r * 0.5);
  ctx.lineTo(ax, ay + r * 0.5);
  ctx.stroke();
  ctx.restore();
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
    const pos = getLayerPositionForFrame(layer, frameIndex);
    drawTextLayer(ctx, { ...layer, ...pos }, width, height, false);
  }
}

export default function CanvasEditor({ onLayerSelected, isPlaying }) {
  const { state, updateLayerFramePos, moveAnchor, selectLayer, updateLayer } = useProject();
  const { frames, currentFrameIndex, width, height, textLayers, selectedLayerId } = state;
  const canvasRef = useRef(null);

  // Pointer drag state
  const ptr = useRef({
    isDown: false,
    startClientX: 0,
    startClientY: 0,
    isDragging: false,
    mode: null, // 'text' | 'anchor'
    hitLayerId: null,
  });

  // Two-finger gesture state
  const touch2 = useRef(null);

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
      const pos = getLayerPositionForFrame(layer, currentFrameIndex);
      drawTextLayer(ctx, { ...layer, ...pos }, width, height, layer.id === selectedLayerId && !isPlaying);
    }

    // Draw anchor for selected layer (hidden during preview playback)
    if (selectedLayer && selectedActiveOnFrame && !isPlaying) {
      drawAnchor(ctx, selectedLayer, width, height);
    }
  }, [frame, textLayers, selectedLayerId, currentFrameIndex, width, height, selectedLayer, selectedActiveOnFrame, isPlaying]);

  // ─── Coordinate helpers ──────────────────────────────────────────────────────

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

  const getCanvasPx = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return { px: 0, py: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return {
        px: (clientX - rect.left) * scaleX,
        py: (clientY - rect.top) * scaleY,
      };
    },
    [width, height]
  );

  /** Test if a tap hits a text layer. Returns layer or null. */
  const hitTestText = useCallback(
    (tapPx, tapPy) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return null;
      const activeLayers = textLayers.filter(
        (l) => l.text && currentFrameIndex >= l.startFrame && currentFrameIndex <= l.endFrame
      );
      for (let i = activeLayers.length - 1; i >= 0; i--) {
        const layer = activeLayers[i];
        const pos = getLayerPositionForFrame(layer, currentFrameIndex);
        const lx = (pos.x / 100) * width;
        const ly = (pos.y / 100) * height;
        const fontSize = layer.fontSize ?? 24;
        const angleRad = ((layer.angle ?? 0) * Math.PI) / 180;

        // Transform tap into layer's local (pre-rotation) space
        const dx = tapPx - lx;
        const dy = tapPy - ly;
        const cos = Math.cos(-angleRad);
        const sin = Math.sin(-angleRad);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        ctx.font = `bold ${fontSize}px ${layer.fontFamily ?? 'Arial'}`;
        const metrics = ctx.measureText(layer.text);
        const pad = fontSize * 0.3;
        const bw = metrics.width + pad * 2;
        const bh = fontSize + pad * 2;

        if (localX >= -bw / 2 && localX <= bw / 2 && localY >= -bh / 2 && localY <= bh / 2) {
          return layer;
        }
      }
      return null;
    },
    [textLayers, currentFrameIndex, width, height]
  );

  /** Test if a tap hits the anchor circle of the selected layer. */
  const hitTestAnchor = useCallback(
    (tapPx, tapPy) => {
      if (!selectedLayer || !selectedActiveOnFrame) return false;
      const ax = ((selectedLayer.anchorX ?? selectedLayer.x ?? 50) / 100) * width;
      const ay = ((selectedLayer.anchorY ?? selectedLayer.y ?? 90) / 100) * height;
      const r = (selectedLayer.anchorRadius ?? 18) + 8; // slightly larger hit area
      const dist = Math.hypot(tapPx - ax, tapPy - ay);
      return dist <= r;
    },
    [selectedLayer, selectedActiveOnFrame, width, height]
  );

  // ─── Pointer events (single-touch drag) ──────────────────────────────────────

  const onPointerDownCanvas = useCallback(
    (e) => {
      if (isPlaying) return;
      const { px, py } = getCanvasPx(e.clientX, e.clientY);
      ptr.current = {
        isDown: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        isDragging: false,
        mode: null,
        hitLayerId: null,
        startPx: px,
        startPy: py,
      };

      // Determine what was tapped (but don't commit to select/drag yet).
      // Text is checked before anchor so that dragging on text always creates
      // a per-frame keyframe even when the anchor circle overlaps the text.
      const hit = hitTestText(px, py);
      if (hit) {
        ptr.current.mode = 'text';
        ptr.current.hitLayerId = hit.id;
      } else if (hitTestAnchor(px, py)) {
        ptr.current.mode = 'anchor';
        ptr.current.hitLayerId = selectedLayerId;
      } else {
        ptr.current.mode = 'empty';
      }
    },
    [isPlaying, getCanvasPx, hitTestAnchor, hitTestText, selectedLayerId]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!ptr.current.isDown) return;

      const distMoved = Math.hypot(
        e.clientX - ptr.current.startClientX,
        e.clientY - ptr.current.startClientY
      );

      if (!ptr.current.isDragging) {
        if (distMoved < DRAG_THRESHOLD_PX) return;
        // Threshold crossed — start dragging
        ptr.current.isDragging = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      const pos = getCanvasPos(e.clientX, e.clientY);

      if (ptr.current.mode === 'anchor' && ptr.current.hitLayerId) {
        moveAnchor(ptr.current.hitLayerId, pos.x, pos.y);
      } else if (ptr.current.mode === 'text' && ptr.current.hitLayerId) {
        updateLayerFramePos(ptr.current.hitLayerId, currentFrameIndex, pos.x, pos.y);
      } else if (ptr.current.mode === 'empty' && selectedLayerId && selectedActiveOnFrame) {
        // Dragging from empty space moves selected text
        updateLayerFramePos(selectedLayerId, currentFrameIndex, pos.x, pos.y);
      }
    },
    [getCanvasPos, moveAnchor, updateLayerFramePos, currentFrameIndex, selectedLayerId, selectedActiveOnFrame]
  );

  const onPointerUp = useCallback(
    () => {
      if (!ptr.current.isDragging) {
        // It was a tap — handle selection
        const { mode, hitLayerId } = ptr.current;
        if (mode === 'text' && hitLayerId) {
          selectLayer(hitLayerId);
          onLayerSelected?.();
        } else if (mode === 'empty') {
          // Deselect
          selectLayer(null);
        }
        // Tapping anchor doesn't change selection
      }
      ptr.current.isDown = false;
      ptr.current.isDragging = false;
    },
    [selectLayer, onLayerSelected]
  );

  // ─── Two-finger gesture handling (pinch + rotate) ─────────────────────────

  const onTouchStart = useCallback(
    (e) => {
      if (e.touches.length !== 2 || !selectedLayer) return;
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      touch2.current = {
        initDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        initAngle: Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * (180 / Math.PI),
        initFontSize: selectedLayer.fontSize ?? 24,
        initRotation: selectedLayer.angle ?? 0,
      };
    },
    [selectedLayer]
  );

  const onTouchMove = useCallback(
    (e) => {
      if (e.touches.length !== 2 || !touch2.current || !selectedLayer) return;
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];

      const curDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const curAngle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * (180 / Math.PI);

      const { initDist, initAngle, initFontSize, initRotation } = touch2.current;

      const newFontSize =
        initDist > 0
          ? Math.max(10, Math.min(120, Math.round(initFontSize * (curDist / initDist))))
          : initFontSize;

      const angleDelta = curAngle - initAngle;
      const newAngle = Math.round(initRotation + angleDelta);

      updateLayer(selectedLayer.id, { fontSize: newFontSize, angle: newAngle });
    },
    [selectedLayer, updateLayer]
  );

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      touch2.current = null;
    }
  }, []);

  if (!frames.length) return null;

  const MAX_WIDTH = 600;
  const displayWidth = Math.min(MAX_WIDTH, width);
  const displayHeight = Math.round((height / width) * displayWidth);

  return (
    <div className="canvas-editor">
      <div className="canvas-editor__canvas-wrap">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: displayWidth, height: displayHeight, touchAction: 'none' }}
          onPointerDown={onPointerDownCanvas}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="canvas-editor__canvas"
          aria-label="GIF frame editor – tap text to select, drag to reposition"
        />

      </div>
      {selectedActiveOnFrame && selectedLayer?.text && !isPlaying && (
        <p className="canvas-editor__hint">
          💬 Drag text or anchor to reposition · Pinch/rotate with two fingers
        </p>
      )}
    </div>
  );
}
