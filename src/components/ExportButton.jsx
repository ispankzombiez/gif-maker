/**
 * ExportButton.jsx
 *
 * Renders each frame with its active text layers onto an off-screen canvas,
 * then encodes the result in the chosen format:
 *   - GIF  : gif.js (Web Worker based)
 *   - MP4  : MediaRecorder API with video/mp4
 *   - WebM : MediaRecorder API with video/webm
 *   - MOV  : MediaRecorder API with video/quicktime (Safari) or video/mp4 fallback
 *
 * gif.js relies on a Web Worker; the worker script must be served from the
 * Vite public directory at the configured base path.
 */

import React, { useCallback, useState } from 'react';
import { useProject } from '../store/projectStore';
import { renderFrameWithLayers } from './CanvasEditor';

const FORMAT_OPTIONS = [
  { value: 'gif',  label: 'GIF (.gif)',   mime: null,               ext: 'gif'  },
  { value: 'mp4',  label: 'MP4 (.mp4)',   mime: 'video/mp4',        ext: 'mp4'  },
  { value: 'webm', label: 'WebM (.webm)', mime: 'video/webm',       ext: 'webm' },
  { value: 'mov',  label: 'MOV (.mov)',   mime: 'video/quicktime',  ext: 'mov'  },
];

export default function ExportButton() {
  const { state } = useProject();
  const { frames, width, height, textLayers } = state;
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [format, setFormat] = useState('gif');

  /** Pre-load all image overlay sources into an HTMLImageElement cache. */
  const buildImageCache = useCallback(async () => {
    const imageCache = new Map();
    const imageLayers = textLayers.filter((l) => l.type === 'image' && l.src);
    await Promise.all(
      imageLayers.map(
        (layer) =>
          new Promise((resolve) => {
            if (imageCache.has(layer.src)) { resolve(); return; }
            const img = new Image();
            img.onload = () => { imageCache.set(layer.src, img); resolve(); };
            img.onerror = resolve; // don't fail export on a bad image
            img.src = layer.src;
          })
      )
    );
    return imageCache;
  }, [textLayers]);

  /**
   * Export via MediaRecorder (MP4 / WebM / MOV).
   * Falls back to a supported MIME type when the requested one is unavailable.
   */
  const exportVideo = useCallback(
    async (imageCache, mime, ext) => {
      if (typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) {
        throw new Error('Video export is not supported in this browser. Try exporting as GIF instead.');
      }

      // Resolve the best available MIME type
      let actualMime = mime;
      if (!MediaRecorder.isTypeSupported(mime)) {
        if (MediaRecorder.isTypeSupported('video/mp4')) {
          actualMime = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          actualMime = 'video/webm';
        } else {
          throw new Error(
            'No supported video format found in this browser. Try exporting as GIF instead.'
          );
        }
      }

      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d');

      const stream = offscreen.captureStream(25);
      const recorder = new MediaRecorder(stream, { mimeType: actualMime });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.start();

      for (let i = 0; i < frames.length; i++) {
        renderFrameWithLayers(ctx, frames[i].imageData, textLayers, i, width, height, imageCache);
        setProgress(Math.round(((i + 1) / frames.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, frames[i].delay));
      }

      recorder.stop();

      await new Promise((resolve, reject) => {
        recorder.onstop = () => {
          try {
            const blob = new Blob(chunks, { type: actualMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edited.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        recorder.onerror = (e) => reject(e.error ?? new Error('MediaRecorder error'));
      });
    },
    [frames, width, height, textLayers]
  );

  const handleExport = useCallback(async () => {
    if (!frames.length) return;
    setExporting(true);
    setProgress(0);

    // Track whether gif.js took ownership of the export lifecycle via its
    // 'finished' callback (which will call setExporting/setProgress itself).
    let gifHandlesCleanup = false;

    try {
      const imageCache = await buildImageCache();
      const fmt = FORMAT_OPTIONS.find((f) => f.value === format) ?? FORMAT_OPTIONS[0];

      if (format === 'gif') {
        const GIF = (await import('gif.js')).default;

        const gif = new GIF({
          workers: 2,
          quality: 10,
          width,
          height,
          workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
        });

        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');

        frames.forEach((frame, i) => {
          renderFrameWithLayers(ctx, frame.imageData, textLayers, i, width, height, imageCache);
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

        gifHandlesCleanup = true;
        gif.render();
        // setExporting(false) is handled inside the 'finished' callback above
        return;
      }

      await exportVideo(imageCache, fmt.mime, fmt.ext);
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message || 'Check the console for details.'}`);
    } finally {
      // Reset state for video exports, and for GIF if render never started.
      if (!gifHandlesCleanup) {
        setExporting(false);
        setProgress(0);
      }
    }
  }, [frames, width, height, textLayers, format, buildImageCache, exportVideo]);

  if (!frames.length) return null;

  return (
    <div className="export-button">
      <select
        className="export-button__format"
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        disabled={exporting}
        aria-label="Export format"
      >
        {FORMAT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <button
        className="btn btn--primary"
        onClick={handleExport}
        disabled={exporting}
        aria-busy={exporting}
      >
        {exporting ? `Exporting… ${progress}%` : '⬇️ Export'}
      </button>
    </div>
  );
}
