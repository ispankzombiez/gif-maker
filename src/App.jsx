/**
 * App.jsx
 *
 * Root application component.  Lays out the GIF editor UI:
 *
 *   ┌─────────────────────────────────┐
 *   │  Header / toolbar               │
 *   ├─────────────────────────────────┤
 *   │  Uploader  (when no frames)     │
 *   │  Timeline  (when frames loaded) │
 *   ├───────────────┬─────────────────┤
 *   │  Canvas       │ Text controls   │
 *   │  Editor       │ + Export        │
 *   └───────────────┴─────────────────┘
 */

import React from 'react';
import { ProjectProvider, useProject } from './store/projectStore';
import Uploader from './components/Uploader';
import Timeline from './components/Timeline';
import CanvasEditor from './components/CanvasEditor';
import TextControls from './components/TextControls';
import ExportButton from './components/ExportButton';

function EditorLayout() {
  const { state, reset } = useProject();
  const hasFrames = state.frames.length > 0;

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
            <CanvasEditor />
            <aside className="app__sidebar">
              <TextControls />
              <ExportButton />
            </aside>
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
