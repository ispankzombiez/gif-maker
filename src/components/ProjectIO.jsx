/**
 * ProjectIO.jsx
 *
 * Save / load the editing project as a JSON file.
 *
 * ⚠️  ImageData cannot be serialised to JSON directly.
 *     We store each frame's pixel data as a base64-encoded PNG data-URL
 *     and restore it on load.
 */

import React, { useRef, useCallback } from 'react';
import { useProject } from '../store/projectStore';

// ─── Serialisation helpers ────────────────────────────────────────────────────

function imageDataToDataURL(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function dataURLToImageData(dataURL, width, height) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, width, height));
    };
    img.src = dataURL;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectIO() {
  const { state, loadProject } = useProject();
  const { frames, width, height, frameOverlays, gifFileName, currentFrameIndex } = state;
  const inputRef = useRef(null);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!frames.length) {
      alert('Nothing to save yet – upload a GIF first.');
      return;
    }

    const serialisedFrames = frames.map((f) => ({
      dataURL: imageDataToDataURL(f.imageData),
      delay: f.delay,
    }));

    const project = {
      version: 1,
      gifFileName,
      width,
      height,
      currentFrameIndex,
      frameOverlays,
      frames: serialisedFrames,
    };

    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gifFileName.replace(/\.gif$/i, '') || 'project'}.gifmaker.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [frames, width, height, frameOverlays, gifFileName, currentFrameIndex]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const handleLoad = useCallback(
    async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const project = JSON.parse(text);

        if (!project.frames || !project.width || !project.height) {
          throw new Error('Invalid project file');
        }

        // Restore ImageData from data-URLs
        const frames = await Promise.all(
          project.frames.map(async (f) => ({
            imageData: await dataURLToImageData(f.dataURL, project.width, project.height),
            delay: f.delay,
          }))
        );

        loadProject({
          frames,
          width: project.width,
          height: project.height,
          gifFileName: project.gifFileName ?? '',
          currentFrameIndex: project.currentFrameIndex ?? 0,
          frameOverlays: project.frameOverlays ?? {},
        });
      } catch (err) {
        console.error('Load error:', err);
        alert('Failed to load project file. Make sure it is a valid .gifmaker.json file.');
      }

      // Reset input so the same file can be re-loaded
      e.target.value = '';
    },
    [loadProject]
  );

  return (
    <div className="project-io">
      <button className="btn btn--secondary" onClick={handleSave} title="Save project as JSON">
        💾 Save project
      </button>

      <button
        className="btn btn--secondary"
        onClick={() => inputRef.current?.click()}
        title="Load project from JSON"
      >
        📂 Load project
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleLoad}
        style={{ display: 'none' }}
      />
    </div>
  );
}
