/**
 * ExportButton.jsx
 *
 * Renders each frame with its text overlay onto an off-screen canvas,
 * then feeds all frames into gif.js to produce a downloadable GIF.
 *
 * gif.js relies on a Web Worker; the worker script is loaded from a CDN
 * path stored in window.GIF_WORKER_URL (set in index.html) or falls back
 * to the bundled copy served from the Vite public directory.
 */

import React, { useCallback, useState } from 'react';
import { useProject } from '../store/projectStore';
import { renderFrameWithOverlay } from './CanvasEditor';

export default function ExportButton() {
  const { state, getOverlay } = useProject();
  const { frames, width, height } = state;
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = useCallback(async () => {
    if (!frames.length) return;
    setExporting(true);
    setProgress(0);

    try {
      // Dynamically import gif.js
      const GIF = (await import('gif.js')).default;

      const gif = new GIF({
        workers: 2,
        quality: 10,
        width,
        height,
        workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
      });

      // Off-screen canvas for compositing
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d');

      frames.forEach((frame, i) => {
        const overlay = getOverlay(i);
        renderFrameWithOverlay(ctx, frame.imageData, overlay, width, height);
        gif.addFrame(offscreen, { copy: true, delay: frame.delay });
      });

      gif.on('progress', (p) => setProgress(Math.round(p * 100)));

      gif.on('finished', (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited.gif';
        a.click();
        URL.revokeObjectURL(url);
        setExporting(false);
        setProgress(0);
      });

      gif.render();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check the console for details.');
      setExporting(false);
      setProgress(0);
    }
  }, [frames, width, height, getOverlay]);

  if (!frames.length) return null;

  return (
    <div className="export-button">
      <button
        className="btn btn--primary"
        onClick={handleExport}
        disabled={exporting}
        aria-busy={exporting}
      >
        {exporting ? `Exporting… ${progress}%` : '⬇️ Export GIF'}
      </button>
    </div>
  );
}
