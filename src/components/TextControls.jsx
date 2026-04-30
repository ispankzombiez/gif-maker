/**
 * TextControls.jsx
 *
 * Sidebar panel (desktop) / side-panel (mobile) for managing multiple
 * independent text overlay layers.
 * Each layer can be:
 *   – added via the "Add Text" button
 *   – selected by clicking its row in the layer list
 *   – deleted via the trash button in its row
 *
 * The selected layer's properties are editable:
 *   – text content, font family, font size, text color  (primary / always visible)
 *   – X / Y position (number inputs, auto-update when text is dragged)
 *   – rotation angle (degrees)                          (primary)
 *   – mirror H / V                                      (primary)
 *   – anchor radius                                     (primary)
 *   – background color + opacity (alpha)                (more options / collapsible)
 *   – start frame / end frame (1-indexed for display)   (more options / collapsible)
 */

import React, { useState, useEffect } from 'react';
import { useProject, getLayerPositionForFrame } from '../store/projectStore';

const FONT_FAMILIES = ['Arial', 'Georgia', 'Impact', 'Courier New', 'Verdana'];

/** Number input that lets you freely type/delete before committing on blur. */
function NumberInput({ value, min, max, onChange, className }) {
  const [raw, setRaw] = useState(String(value));

  // Sync external value changes (e.g. switching layers, drag updates)
  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const commit = () => {
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      const clamped =
        Math.max(min !== undefined ? min : -Infinity, Math.min(max !== undefined ? max : Infinity, num));
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value));
    }
  };

  return (
    <input
      className={className}
      type="number"
      min={min}
      max={max}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

export default function TextControls() {
  const { state, addLayer, deleteLayer, updateLayer, updateLayerFramePos, selectLayer } = useProject();
  const { frames, textLayers, selectedLayerId, currentFrameIndex } = state;
  const [showMore, setShowMore] = useState(false);

  if (!frames.length) return null;

  const frameCount = frames.length;
  const selectedLayer = textLayers.find((l) => l.id === selectedLayerId) ?? null;

  // Resolve the current frame's position for the selected layer
  const currentPos = selectedLayer
    ? getLayerPositionForFrame(selectedLayer, currentFrameIndex)
    : { x: 50, y: 90 };

  const update = (field, value) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, { [field]: value });
  };

  const updatePos = (axis, rawValue) => {
    if (!selectedLayer) return;
    const value = Math.max(0, Math.min(100, Number(rawValue) || 0));
    updateLayerFramePos(
      selectedLayer.id,
      currentFrameIndex,
      axis === 'x' ? value : currentPos.x,
      axis === 'y' ? value : currentPos.y
    );
  };

  return (
    <div className="text-controls" aria-label="Text overlay controls">
      {/* ── Layer list ──────────────────────────────────────────────────── */}
      <div className="text-controls__layer-header">
        <h3 className="text-controls__title">Text Layers</h3>
        <button
          className="btn btn--secondary text-controls__add-btn"
          onClick={addLayer}
          title="Add a new text layer"
        >
          + Add Text
        </button>
      </div>

      {textLayers.length === 0 && (
        <p className="text-controls__empty">No text layers yet. Click "+ Add Text" to start.</p>
      )}

      <ul className="text-controls__layer-list">
        {textLayers.map((layer) => (
          <li
            key={layer.id}
            className={`text-controls__layer-item${layer.id === selectedLayerId ? ' text-controls__layer-item--active' : ''}`}
            onClick={() => selectLayer(layer.id)}
          >
            <span className="text-controls__layer-label">
              {layer.text ? `"${layer.text.slice(0, 20)}${layer.text.length > 20 ? '…' : ''}"` : '(empty)'}
            </span>
            <span className="text-controls__layer-range">
              {layer.startFrame + 1}–{layer.endFrame + 1}
            </span>
            <button
              className="text-controls__layer-delete"
              onClick={(e) => {
                e.stopPropagation();
                deleteLayer(layer.id);
              }}
              title="Delete this layer"
              aria-label="Delete layer"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* ── Selected layer editor ────────────────────────────────────────── */}
      {selectedLayer && (
        <div className="text-controls__editor">
          <h4 className="text-controls__editor-title">Edit Layer</h4>

          {/* Text content */}
          <label className="text-controls__label">
            Text
            <input
              className="text-controls__input"
              type="text"
              value={selectedLayer.text}
              onChange={(e) => update('text', e.target.value)}
              placeholder="Enter text…"
              maxLength={200}
            />
          </label>

          {/* Font size */}
          <label className="text-controls__label">
            Size (px)
            <NumberInput
              className="text-controls__input text-controls__input--num"
              value={selectedLayer.fontSize}
              min={10}
              max={120}
              onChange={(v) => update('fontSize', v)}
            />
          </label>

          {/* Text colour */}
          <div className="text-controls__label">
            <span>Text Color</span>
            <input
              className="text-controls__color"
              type="color"
              value={selectedLayer.color}
              onChange={(e) => update('color', e.target.value)}
            />
          </div>

          {/* Font family */}
          <label className="text-controls__label">
            Font
            <select
              className="text-controls__select"
              value={selectedLayer.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          {/* X / Y position — number inputs (auto-updated by drag) */}
          <div className="text-controls__pos-row">
            <label className="text-controls__label text-controls__label--grow">
              X % (Frame {currentFrameIndex + 1})
              <NumberInput
                className="text-controls__input text-controls__input--num"
                value={currentPos.x}
                min={0}
                max={100}
                onChange={(v) => updatePos('x', v)}
              />
            </label>
            <label className="text-controls__label text-controls__label--grow">
              Y %
              <NumberInput
                className="text-controls__input text-controls__input--num"
                value={currentPos.y}
                min={0}
                max={100}
                onChange={(v) => updatePos('y', v)}
              />
            </label>
          </div>

          {/* Rotation angle */}
          <label className="text-controls__label">
            Angle (°)
            <NumberInput
              className="text-controls__input text-controls__input--num"
              value={selectedLayer.angle ?? 0}
              min={-360}
              max={360}
              onChange={(v) => update('angle', v)}
            />
          </label>

          {/* Mirror toggles */}
          <div className="text-controls__mirror-row">
            <button
              className={`btn btn--secondary text-controls__mirror-btn${selectedLayer.mirrorX ? ' text-controls__mirror-btn--active' : ''}`}
              onClick={() => update('mirrorX', !selectedLayer.mirrorX)}
              title="Mirror horizontally"
            >
              ↔ Mirror H
            </button>
            <button
              className={`btn btn--secondary text-controls__mirror-btn${selectedLayer.mirrorY ? ' text-controls__mirror-btn--active' : ''}`}
              onClick={() => update('mirrorY', !selectedLayer.mirrorY)}
              title="Mirror vertically"
            >
              ↕ Mirror V
            </button>
          </div>

          {/* Anchor radius */}
          <label className="text-controls__label">
            Anchor Size (px)
            <NumberInput
              className="text-controls__input text-controls__input--num"
              value={selectedLayer.anchorRadius ?? 18}
              min={8}
              max={60}
              onChange={(v) => update('anchorRadius', v)}
            />
          </label>

          {/* ── More options toggle ──────────────────────────────────────── */}
          <button
            className="text-controls__more-toggle"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
          >
            {showMore ? '▲ Less options' : '▼ More options'}
          </button>

          {/* ── Collapsible secondary controls ──────────────────────────── */}
          {showMore && (
            <>
              {/* Background colour + opacity */}
              <div className="text-controls__bg-row">
                <div className="text-controls__label text-controls__label--inline">
                  <span>Background</span>
                  <input
                    className="text-controls__color"
                    type="color"
                    value={selectedLayer.bgColor}
                    onChange={(e) => update('bgColor', e.target.value)}
                  />
                </div>
                <label className="text-controls__label text-controls__label--grow">
                  Opacity (%)
                  <NumberInput
                    className="text-controls__input text-controls__input--num"
                    value={Math.round(selectedLayer.bgAlpha * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => update('bgAlpha', v / 100)}
                  />
                </label>
              </div>

              {/* Frame range */}
              <div className="text-controls__frame-range">
                <label className="text-controls__label">
                  Start Frame
                  <NumberInput
                    className="text-controls__input text-controls__input--num"
                    value={selectedLayer.startFrame + 1}
                    min={1}
                    max={selectedLayer.endFrame + 1}
                    onChange={(v) => update('startFrame', Math.round(v) - 1)}
                  />
                </label>
                <label className="text-controls__label">
                  End Frame
                  <NumberInput
                    className="text-controls__input text-controls__input--num"
                    value={selectedLayer.endFrame + 1}
                    min={selectedLayer.startFrame + 1}
                    max={frameCount}
                    onChange={(v) => update('endFrame', Math.round(v) - 1)}
                  />
                </label>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
