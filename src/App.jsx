/**
 * App.jsx
 *
 * Root application component.  Lays out the GIF editor UI:
 *
 *   Desktop:
 *   ┌─────────────────────────────────┐
 *   │  Header / toolbar               │
 *   ├─────────────────────────────────┤
 *   │  Timeline                       │
 *   ├───────────────┬─────────────────┤
 *   │  Canvas       │ Text controls   │
 *   │  Editor + FAB │ + Export        │
 *   └───────────────┴─────────────────┘
 *
 *   Mobile (≤640px):
 *   ┌─────────────────────────────────┐
 *   │  Header / toolbar               │
 *   ├─────────────────────────────────┤
 *   │  Timeline                       │
 *   ├─────────────────────────────────┤
 *   │  Canvas Editor  (+ FAB overlay) │
 *   ├─────────────────────────────────┤
 *   │  Layer chips bar                │
 *   └─────────────────────────────────┘
 *   [ Bottom sheet slides up when layer selected ]
 */

import React, { useState, useEffect, useRef } from 'react';
import { ProjectProvider, useProject } from './store/projectStore';
import Uploader from './components/Uploader';
import Timeline from './components/Timeline';
import CanvasEditor from './components/CanvasEditor';
import TextControls from './components/TextControls';
import ExportButton from './components/ExportButton';

/** Horizontal scrollable row of layer chips shown below the canvas on mobile. */
const MAX_CHIP_TEXT_LENGTH = 12;

function LayerChips({ onChipSelect }) {
  const { state, selectLayer, deleteLayer } = useProject();
  const { textLayers, selectedLayerId } = state;

  return (
    <div className="layer-chips-bar">
      {textLayers.length === 0 ? (
        <p className="layer-chips__empty">Tap + to add text</p>
      ) : (
        <div className="layer-chips">
          {textLayers.map((layer, idx) => (
            <div
              key={layer.id}
              className={`layer-chip${layer.id === selectedLayerId ? ' layer-chip--active' : ''}`}
              onClick={() => {
                selectLayer(layer.id);
                onChipSelect?.();
              }}
            >
              <span className="layer-chip__label">
                {layer.text ? layer.text.slice(0, MAX_CHIP_TEXT_LENGTH) : `Text ${idx + 1}`}
              </span>
              <button
                className="layer-chip__delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteLayer(layer.id);
                }}
                aria-label={`Delete text layer ${idx + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditorLayout() {
  const { state, reset, addLayer } = useProject();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const touchStartY = useRef(0);
  const hasFrames = state.frames.length > 0;

  // Auto-open the bottom sheet on mobile whenever a layer is selected
  useEffect(() => {
    if (state.selectedLayerId !== null && window.matchMedia('(max-width: 640px)').matches) {
      setIsSheetOpen(true);
    }
  }, [state.selectedLayerId]);

  // Close sheet when all layers are deleted
  useEffect(() => {
    if (state.textLayers.length === 0) {
      setIsSheetOpen(false);
    }
  }, [state.textLayers.length]);

  const handleAddLayer = () => {
    addLayer();
    if (window.matchMedia('(max-width: 640px)').matches) {
      setIsSheetOpen(true);
    }
  };

  const handleLayerSelected = () => {
    if (window.matchMedia('(max-width: 640px)').matches) {
      setIsSheetOpen(true);
    }
  };

  // Swipe-down-to-dismiss on the handle bar
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 60) setIsSheetOpen(false);
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="app__header">
        <h1 className="app__title">🎬 GIF Maker</h1>
        <nav className="app__nav">
          {hasFrames && (
            <button
              className="btn btn--ghost"
              onClick={reset}
              title="Start over with a new GIF"
            >
              ✖ New
            </button>
          )}
        </nav>
      </header>

      {/* ── Upload prompt ──────────────────────────────────────────── */}
      {!hasFrames && (
        <main className="app__upload">
          <Uploader />
        </main>
      )}

      {/* ── Editor (shown when a GIF is loaded) ────────────────────── */}
      {hasFrames && (
        <main className="app__editor">
          <Timeline />

          <div className="app__workspace">
            <CanvasEditor onAddLayer={handleAddLayer} onLayerSelected={handleLayerSelected} />
            {/* Desktop sidebar */}
            <aside className="app__sidebar">
              <TextControls />
              <ExportButton />
            </aside>
          </div>

          {/* Mobile: layer chips row (hidden on desktop via CSS) */}
          <LayerChips onChipSelect={() => setIsSheetOpen(true)} />

          {/* Mobile: backdrop behind bottom sheet */}
          <div
            className={`bottom-sheet-backdrop${isSheetOpen ? ' bottom-sheet-backdrop--visible' : ''}`}
            onClick={() => setIsSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Mobile: bottom sheet (hidden on desktop via CSS) */}
          <div
            className={`bottom-sheet${isSheetOpen ? ' bottom-sheet--open' : ''}`}
            role="dialog"
            aria-label="Text layer controls"
          >
            {/* Drag handle – tap or swipe down to close */}
            <div
              className="bottom-sheet__handle-bar"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => setIsSheetOpen(false)}
              aria-label="Tap or swipe down to close"
            >
              <span className="bottom-sheet__handle" />
            </div>
            <div className="bottom-sheet__content">
              <TextControls />
              <ExportButton />
            </div>
          </div>
        </main>
      )}

      <footer className="app__footer">
        <small>
          GIF Maker &mdash; open source &middot;{' '}
          <a
            href="https://github.com/ispankzombiez/gif-maker"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </small>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <EditorLayout />
    </ProjectProvider>
  );
}
