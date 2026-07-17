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
 *   └─────────────────────────────────┘
 *   ⚙ Floating settings button → side panel slides in from right
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProjectProvider, useProject } from './store/projectStore';
import Uploader from './components/Uploader';
import Timeline from './components/Timeline';
import CanvasEditor from './components/CanvasEditor';
import TextControls from './components/TextControls';
import FrameEditor from './components/FrameEditor';
import RotateFlipEditor from './components/RotateFlipEditor';
import ExportButton from './components/ExportButton';
import ProjectIO from './components/ProjectIO';

function EditorLayout() {
  const { state, reset, addLayer, setCurrentFrame } = useProject();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('layers'); // 'layers' | 'frames' | 'rotate'
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewSpeed, setPreviewSpeed] = useState(1.0);
  const playRef = useRef(null); // { frameIndex, timeoutId }
  const hasFrames = state.frames.length > 0;

  // ─── Preview playback ────────────────────────────────────────────────────────

  const stopPreview = useCallback(() => {
    if (playRef.current?.timeoutId) {
      clearTimeout(playRef.current.timeoutId);
    }
    playRef.current = null;
    setIsPlaying(false);
  }, []);

  // Stop preview when GIF is reset
  useEffect(() => {
    if (!hasFrames && isPlaying) {
      stopPreview();
    }
  }, [hasFrames, isPlaying, stopPreview]);

  // Auto-open the panel on mobile when a layer is selected
  useEffect(() => {
    if (state.selectedLayerId !== null && window.matchMedia('(max-width: 640px)').matches) {
      setIsPanelOpen(true);
    }
  }, [state.selectedLayerId]);

  // Close panel when all layers are deleted
  useEffect(() => {
    if (state.textLayers.length === 0) {
      setIsPanelOpen(false);
    }
  }, [state.textLayers.length]);

  const handleAddLayer = () => {
    addLayer();
    if (window.matchMedia('(max-width: 640px)').matches) {
      setIsPanelOpen(true);
    }
  };

  const handleLayerSelected = () => {
    if (window.matchMedia('(max-width: 640px)').matches) {
      setActiveTab('layers');
      setIsPanelOpen(true);
    }
  };

  const startPreview = useCallback(() => {
    if (!state.frames.length) return;
    // Stop any existing playback first
    if (playRef.current?.timeoutId) {
      clearTimeout(playRef.current.timeoutId);
    }
    setIsPlaying(true);

    const totalFrames = state.frames.length;
    const frameDelays = state.frames.map((f) => f.delay ?? 100);
    let frameIndex = state.currentFrameIndex;

    function scheduleNext() {
      const rawDelay = frameDelays[frameIndex] ?? 100;
      const delay = Math.max(10, Math.round(rawDelay / previewSpeed));
      const tid = setTimeout(() => {
        // If playback was stopped, do nothing
        if (!playRef.current) return;
        frameIndex = (frameIndex + 1) % totalFrames;
        setCurrentFrame(frameIndex);
        playRef.current = { frameIndex, timeoutId: scheduleNext() };
      }, delay);
      return tid;
    }

    const tid = scheduleNext();
    playRef.current = { frameIndex, timeoutId: tid };
  }, [state.frames, state.currentFrameIndex, setCurrentFrame, previewSpeed]);

  const togglePreview = () => {
    if (isPlaying) {
      stopPreview();
    } else {
      startPreview();
    }
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="app__header">
        <h1 className="app__title">🎬 GIF Maker</h1>
        <nav className="app__nav">
          {hasFrames && (
            <>
              <ExportButton initialSpeed={previewSpeed} />
              <ProjectIO />
              <div className="preview-speed-row">
                <label className="preview-speed-row__label" htmlFor="preview-speed">
                  Speed
                </label>
                <input
                  id="preview-speed"
                  className="preview-speed-row__input"
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={previewSpeed}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setPreviewSpeed(v);
                  }}
                  aria-label="Preview speed multiplier"
                  title="Preview playback speed (1 = original)"
                />
                <span className="preview-speed-row__unit">×</span>
              </div>
              <button
                className={`btn ${isPlaying ? 'btn--primary' : 'btn--secondary'}`}
                onClick={togglePreview}
                title={isPlaying ? 'Stop preview' : 'Preview animation with edits'}
                aria-label={isPlaying ? 'Stop preview' : 'Preview animation'}
              >
                {isPlaying ? '⏹ Stop' : '▶ Preview'}
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => { stopPreview(); reset(); }}
                title="Start over with a new file"
              >
                ✖ New
              </button>
            </>
          )}
        </nav>
      </header>

      {/* ── Upload prompt ──────────────────────────────────────────── */}
      {!hasFrames && (
        <main className="app__upload">
          <div className="app__upload-options">
            <Uploader />
            <div className="app__upload-divider">
              <span>or</span>
            </div>
            <ProjectIO />
          </div>
        </main>
      )}

      {/* ── Editor (shown when a GIF is loaded) ────────────────────── */}
      {hasFrames && (
        <main className="app__editor">
          <Timeline />

          <div className="app__workspace">
            <CanvasEditor
              onLayerSelected={handleLayerSelected}
              isPlaying={isPlaying}
            />
            {/* Desktop sidebar */}
            <aside className="app__sidebar">
              <div className="sidebar-tabs" role="tablist" aria-label="Editor panels">
                <button
                  className={`sidebar-tabs__tab${activeTab === 'layers' ? ' sidebar-tabs__tab--active' : ''}`}
                  role="tab"
                  aria-selected={activeTab === 'layers'}
                  onClick={() => setActiveTab('layers')}
                >
                  🖊 Layers
                </button>
                <button
                  className={`sidebar-tabs__tab${activeTab === 'frames' ? ' sidebar-tabs__tab--active' : ''}`}
                  role="tab"
                  aria-selected={activeTab === 'frames'}
                  onClick={() => setActiveTab('frames')}
                >
                  🎞 Frames
                </button>
                <button
                  className={`sidebar-tabs__tab${activeTab === 'rotate' ? ' sidebar-tabs__tab--active' : ''}`}
                  role="tab"
                  aria-selected={activeTab === 'rotate'}
                  onClick={() => setActiveTab('rotate')}
                >
                  🔄 Rotate/Flip
                </button>
              </div>
              <div className="sidebar-tabs__content">
                {activeTab === 'layers' && <TextControls />}
                {activeTab === 'frames' && <FrameEditor />}
                {activeTab === 'rotate' && <RotateFlipEditor />}
              </div>
            </aside>
          </div>

          {/* Mobile: floating settings button */}
          <button
            className="settings-fab"
            onClick={() => setIsPanelOpen(true)}
            aria-label="Open text settings"
            title="Text settings"
          >
            ⚙
          </button>

          {/* Mobile: backdrop */}
          <div
            className={`side-panel-backdrop${isPanelOpen ? ' side-panel-backdrop--visible' : ''}`}
            onClick={() => setIsPanelOpen(false)}
            aria-hidden="true"
          />

          {/* Mobile: side panel */}
          <aside
            className={`side-panel${isPanelOpen ? ' side-panel--open' : ''}`}
            role="dialog"
            aria-label="Editor controls"
          >
            <div className="side-panel__header">
              <span className="side-panel__title">
                {activeTab === 'layers' ? 'Text Settings' : activeTab === 'frames' ? 'Frame Editor' : 'Rotate / Flip'}
              </span>
              <button
                className="side-panel__close"
                onClick={() => setIsPanelOpen(false)}
                aria-label="Close settings panel"
              >
                ✕
              </button>
            </div>
            <div className="sidebar-tabs sidebar-tabs--panel" role="tablist" aria-label="Editor panels">
              <button
                className={`sidebar-tabs__tab${activeTab === 'layers' ? ' sidebar-tabs__tab--active' : ''}`}
                role="tab"
                aria-selected={activeTab === 'layers'}
                onClick={() => setActiveTab('layers')}
              >
                🖊 Layers
              </button>
              <button
                className={`sidebar-tabs__tab${activeTab === 'frames' ? ' sidebar-tabs__tab--active' : ''}`}
                role="tab"
                aria-selected={activeTab === 'frames'}
                onClick={() => setActiveTab('frames')}
              >
                🎞 Frames
              </button>
              <button
                className={`sidebar-tabs__tab${activeTab === 'rotate' ? ' sidebar-tabs__tab--active' : ''}`}
                role="tab"
                aria-selected={activeTab === 'rotate'}
                onClick={() => setActiveTab('rotate')}
              >
                🔄 Rotate/Flip
              </button>
            </div>
            <div className="side-panel__content">
              {activeTab === 'layers' && <TextControls />}
              {activeTab === 'frames' && <FrameEditor />}
              {activeTab === 'rotate' && <RotateFlipEditor />}
            </div>
          </aside>
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
