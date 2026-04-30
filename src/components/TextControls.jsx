/**
 * TextControls.jsx
 *
 * Sidebar panel for managing multiple independent text overlay layers.
 * Each layer can be:
 *   – added via the "Add Text" button
 *   – selected by clicking its row in the layer list
 *   – deleted via the trash button in its row
 *
 * The selected layer's properties are editable:
 *   – text content, font family, font size, text color
 *   – background color + opacity (alpha)
 *   – X / Y position (percentage of canvas)
 *   – start frame / end frame (1-indexed for display, 0-indexed internally)
 */

import React from 'react';
import { useProject } from '../store/projectStore';

const FONT_FAMILIES = ['Arial', 'Georgia', 'Impact', 'Courier New', 'Verdana'];

export default function TextControls() {
  const { state, addLayer, deleteLayer, updateLayer, selectLayer } = useProject();
  const { frames, textLayers, selectedLayerId } = state;

  if (!frames.length) return null;

  const frameCount = frames.length;
  const selectedLayer = textLayers.find((l) => l.id === selectedLayerId) ?? null;

  const update = (field, value) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, { [field]: value });
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

          {/* Font size */}
          <label className="text-controls__label">
            Size ({selectedLayer.fontSize}px)
            <input
              className="text-controls__range"
              type="range"
              min={10}
              max={120}
              value={selectedLayer.fontSize}
              onChange={(e) => update('fontSize', Number(e.target.value))}
            />
          </label>

          {/* Text colour */}
          <label className="text-controls__label">
            Text Color
            <input
              className="text-controls__color"
              type="color"
              value={selectedLayer.color}
              onChange={(e) => update('color', e.target.value)}
            />
          </label>

          {/* Background colour + opacity */}
          <div className="text-controls__bg-row">
            <label className="text-controls__label text-controls__label--inline">
              Background
              <input
                className="text-controls__color"
                type="color"
                value={selectedLayer.bgColor}
                onChange={(e) => update('bgColor', e.target.value)}
              />
            </label>
            <label className="text-controls__label text-controls__label--grow">
              Opacity ({Math.round(selectedLayer.bgAlpha * 100)}%)
              <input
                className="text-controls__range"
                type="range"
                min={0}
                max={100}
                value={Math.round(selectedLayer.bgAlpha * 100)}
                onChange={(e) => update('bgAlpha', Number(e.target.value) / 100)}
              />
            </label>
          </div>

          {/* X position */}
          <label className="text-controls__label">
            X position ({selectedLayer.x}%)
            <input
              className="text-controls__range"
              type="range"
              min={0}
              max={100}
              value={selectedLayer.x}
              onChange={(e) => update('x', Number(e.target.value))}
            />
          </label>

          {/* Y position */}
          <label className="text-controls__label">
            Y position ({selectedLayer.y}%)
            <input
              className="text-controls__range"
              type="range"
              min={0}
              max={100}
              value={selectedLayer.y}
              onChange={(e) => update('y', Number(e.target.value))}
            />
          </label>

          {/* Frame range */}
          <div className="text-controls__frame-range">
            <label className="text-controls__label">
              Start Frame
              <input
                className="text-controls__input text-controls__input--num"
                type="number"
                min={1}
                max={selectedLayer.endFrame + 1}
                value={selectedLayer.startFrame + 1}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(selectedLayer.endFrame + 1, Number(e.target.value) || 1));
                  update('startFrame', v - 1);
                }}
              />
            </label>
            <label className="text-controls__label">
              End Frame
              <input
                className="text-controls__input text-controls__input--num"
                type="number"
                min={selectedLayer.startFrame + 1}
                max={frameCount}
                value={selectedLayer.endFrame + 1}
                onChange={(e) => {
                  const v = Math.max(selectedLayer.startFrame + 1, Math.min(frameCount, Number(e.target.value) || frameCount));
                  update('endFrame', v - 1);
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
