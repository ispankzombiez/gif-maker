/**
 * ExportButton.jsx
 *
 * Opens an export-settings modal where the user can choose:
 *   – File name
 *   – Format: GIF (via gif.js), WebM, MP4, or MOV video (via MediaRecorder)
 *   – GIF quality (1 = best / slowest … 20 = fastest / largest)
 *
 * gif.js relies on a Web Worker; the worker script must be served from the
 * Vite public directory at the configured base path.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useProject } from '../store/projectStore';
import { renderFrameWithLayers } from './CanvasEditor';

function getGifQualityLabel(q) {
  if (q === 1) return 'Best';
  if (q <= 5) return 'High';
  if (q <= 12) return 'Balanced';
  return 'Fast';
}

const FORMAT_EXT = { gif: 'gif', webm: 'webm', mp4: 'mp4', mov: 'mov' };

const WEBM_MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const MP4_MIME_TYPES = ['video/mp4;codecs=avc1', 'video/mp4'];

export default function ExportButton({ initialSpeed = 1.0 }) {
  const { state } = useProject();
  const { frames, width, height, textLayers, gifFileName } = state;

  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  // Settings
  const defaultName = gifFileName ? gifFileName.replace(/\.[^.]+$/, '') : 'edited';
  const [fileName, setFileName] = useState(defaultName);
  const [format, setFormat] = useState('gif');
  const [gifQuality, setGifQuality] = useState(10);
  const [reverseExport, setReverseExport] = useState(false);
  const [exportSpeed, setExportSpeed] = useState(initialSpeed);

  // Sync default filename when a new GIF is loaded
  useEffect(() => {
    setFileName(gifFileName ? gifFileName.replace(/\.[^.]+$/, '') : 'edited');
  }, [gifFileName]);

  const openModal = () => { setExportSpeed(initialSpeed); setShowModal(true); };
  const closeModal = () => { if (!exporting) setShowModal(false); };

  /** Pre-load all image layers into a Map and return it. */
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
            img.onerror = resolve;
            img.src = layer.src;
          })
      )
    );
    return imageCache;
  }, [textLayers]);

  /** Export as GIF using gif.js. */
  const exportGif = useCallback(async (imageCache) => {
    const GIF = (await import('gif.js')).default;
    const gif = new GIF({
      workers: 2,
      quality: gifQuality,
      width,
      height,
      workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
    });

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');

    const frameList = reverseExport ? [...frames].reverse() : frames;
    frameList.forEach((_, i) => {
      const origIndex = reverseExport ? frames.length - 1 - i : i;
      const frame = frames[origIndex];
      renderFrameWithLayers(ctx, frame, textLayers, origIndex, width, height, imageCache);
      const adjustedDelay = Math.max(10, Math.round((frame.delay ?? 100) / exportSpeed));
      gif.addFrame(offscreen, { copy: true, delay: adjustedDelay });
    });

    gif.on('progress', (p) => {
      setProgress(Math.round(p * 100));
      setProgressLabel(`Encoding… ${Math.round(p * 100)}%`);
    });

    await new Promise((resolve, reject) => {
      gif.on('finished', (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName || 'edited'}.gif`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      });
      gif.on('error', reject);
      gif.render();
    });
  }, [frames, width, height, textLayers, fileName, gifQuality, reverseExport, exportSpeed]);

  /**
   * Shared video export using canvas.captureStream + MediaRecorder.
   * @param {string} mimeType  - MIME type for MediaRecorder (e.g. 'video/mp4')
   * @param {string} ext       - File extension for the download (e.g. 'mp4', 'mov')
   * @param {Map}    imageCache
   */
  const exportVideo = useCallback(async (mimeType, ext, imageCache) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      throw new Error(
        `${ext.toUpperCase()} recording is not supported in this browser. ` +
        `Please try a different format (WebM is the most widely supported).`
      );
    }

    const stream = offscreen.captureStream(0);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const totalFrames = frames.length;

    await new Promise((resolve, reject) => {
      recorder.onerror = (e) => reject(e.error ?? new Error('MediaRecorder error'));
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName || 'edited'}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      };

      recorder.start();

      let i = 0;
      const track = stream.getVideoTracks()[0];

      const renderNext = () => {
        if (i >= totalFrames) {
          recorder.stop();
          return;
        }
        const origIndex = reverseExport ? totalFrames - 1 - i : i;
        const frame = frames[origIndex];
        renderFrameWithLayers(ctx, frame, textLayers, origIndex, width, height, imageCache);
        if (track.requestFrame) track.requestFrame();
        const adjustedDelay = Math.max(10, Math.round((frame.delay ?? 100) / exportSpeed));
        setProgress(Math.round(((i + 1) / totalFrames) * 100));
        setProgressLabel(`Rendering… ${i + 1} / ${totalFrames}`);
        setTimeout(() => { i++; renderNext(); }, adjustedDelay);
      };

      renderNext();
    });
  }, [frames, width, height, textLayers, fileName, reverseExport, exportSpeed]);

  /** Export as WebM video using canvas.captureStream + MediaRecorder. */
  const exportWebM = useCallback(async (imageCache) => {
    const mimeType = WEBM_MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) {
      throw new Error(
        'WebM recording is not supported in this browser. Your browser does not support any of the required WebM codecs (VP8/VP9). Please use GIF format instead.'
      );
    }
    await exportVideo(mimeType, 'webm', imageCache);
  }, [exportVideo]);

  /** Export as MP4 video. Requires Chrome 130+ / Edge. */
  const exportMp4 = useCallback(async (imageCache) => {
    const mimeType = MP4_MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) {
      throw new Error(
        'MP4 recording is not supported in this browser. ' +
        'Try Chrome 130+ or Edge, or use WebM format instead.'
      );
    }
    await exportVideo(mimeType, 'mp4', imageCache);
  }, [exportVideo]);

  /** Export as MOV video. Uses the same H.264/MP4 stream with a .mov extension. */
  const exportMov = useCallback(async (imageCache) => {
    const mimeType = MP4_MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) {
      throw new Error(
        'MOV export is not supported in this browser. ' +
        'Try Chrome 130+ or Edge, or use WebM format instead.'
      );
    }
    await exportVideo(mimeType, 'mov', imageCache);
  }, [exportVideo]);

  const handleExport = useCallback(async () => {
    if (!frames.length) return;
    setExporting(true);
    setProgress(0);
    setProgressLabel('Preparing…');

    try {
      const imageCache = await buildImageCache();
      if (format === 'gif') {
        await exportGif(imageCache);
      } else if (format === 'webm') {
        await exportWebM(imageCache);
      } else if (format === 'mp4') {
        await exportMp4(imageCache);
      } else if (format === 'mov') {
        await exportMov(imageCache);
      }
      setShowModal(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message ?? err}`);
    } finally {
      setExporting(false);
      setProgress(0);
      setProgressLabel('');
    }
  }, [frames, format, buildImageCache, exportGif, exportWebM, exportMp4, exportMov]);

  if (!frames.length) return null;

  const ext = FORMAT_EXT[format] ?? format;
  const isVideoFormat = format !== 'gif';

  return (
    <>
      <button className="btn btn--primary" onClick={openModal}>
        ⬇️ Export
      </button>

      {showModal && (
        <div
          className="export-modal-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label="Export settings"
        >
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="export-modal__header">
              <h2 className="export-modal__title">Export Settings</h2>
              <button
                className="export-modal__close"
                onClick={closeModal}
                disabled={exporting}
                aria-label="Close export settings"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="export-modal__body">
              {/* File name */}
              <label className="export-modal__field">
                <span className="export-modal__field-label">File Name</span>
                <div className="export-modal__name-row">
                  <input
                    className="export-modal__input"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="filename"
                    disabled={exporting}
                    maxLength={100}
                  />
                  <span className="export-modal__ext">.{ext}</span>
                </div>
              </label>

              {/* Format */}
              <label className="export-modal__field">
                <span className="export-modal__field-label">Format</span>
                <select
                  className="export-modal__select"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  disabled={exporting}
                >
                  <option value="gif">Animated GIF (.gif)</option>
                  <option value="webm">WebM Video (.webm)</option>
                  <option value="mp4">MP4 Video (.mp4)</option>
                  <option value="mov">QuickTime Video (.mov)</option>
                </select>
              </label>

              {/* GIF-only quality option */}
              {format === 'gif' && (
                <div className="export-modal__field">
                  <div className="export-modal__quality-header">
                    <span className="export-modal__field-label">Quality</span>
                    <span className="export-modal__quality-value">
                      {getGifQualityLabel(gifQuality)} ({gifQuality})
                    </span>
                  </div>
                  <input
                    className="export-modal__range"
                    type="range"
                    min={1}
                    max={20}
                    value={gifQuality}
                    onChange={(e) => setGifQuality(Number(e.target.value))}
                    disabled={exporting}
                    aria-label="GIF quality"
                  />
                  <div className="export-modal__range-labels">
                    <span>Best quality</span>
                    <span>Fastest</span>
                  </div>
                </div>
              )}

              {format === 'webm' && (
                <p className="export-modal__hint">
                  WebM captures frames at their original delays using the browser's MediaRecorder API.
                  Supported in Chrome, Edge, and Firefox.
                </p>
              )}

              {format === 'mp4' && (
                <p className="export-modal__hint">
                  MP4 export uses the browser's MediaRecorder API with H.264 encoding.
                  Requires Chrome 130+ or Edge. Files are compatible with most players.
                </p>
              )}

              {format === 'mov' && (
                <p className="export-modal__hint">
                  MOV export uses H.264 video in a QuickTime-compatible container.
                  Requires Chrome 130+ or Edge. Ideal for macOS / iOS playback.
                </p>
              )}

              {/* Reverse */}
              <div className="export-modal__field">
                <span className="export-modal__field-label">Playback</span>
                <label className="export-modal__checkbox-row">
                  <input
                    type="checkbox"
                    checked={reverseExport}
                    onChange={(e) => setReverseExport(e.target.checked)}
                    disabled={exporting}
                  />
                  Reverse frame order
                </label>
              </div>

              {/* Speed */}
              <div className="export-modal__field">
                <span className="export-modal__field-label">Speed</span>
                <div className="export-modal__speed-row">
                  <input
                    className="export-modal__speed-input"
                    type="number"
                    min={0.1}
                    max={20}
                    step={0.1}
                    value={exportSpeed}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) setExportSpeed(v);
                    }}
                    disabled={exporting}
                    aria-label="Export speed multiplier"
                  />
                  <span className="export-modal__speed-unit">×</span>
                  <span className="export-modal__speed-hint">
                    {exportSpeed === 1 ? 'original speed' : exportSpeed > 1 ? 'faster' : 'slower'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="export-modal__footer">
              {exporting && (
                <div className="export-modal__progress">
                  <div
                    className="export-modal__progress-bar"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                  <span className="export-modal__progress-label">{progressLabel}</span>
                </div>
              )}
              <div className="export-modal__footer-btns">
                <button className="btn btn--ghost" onClick={closeModal} disabled={exporting}>
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleExport}
                  disabled={exporting || !fileName.trim()}
                  aria-busy={exporting}
                >
                  {exporting
                    ? `${progressLabel || 'Exporting…'}`
                    : `⬇️ Export ${ext.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

