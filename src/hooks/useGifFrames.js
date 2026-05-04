/**
 * useGifFrames.js
 *
 * Custom hook that parses a GIF file using the `omggif` library and
 * returns individual frames as ImageData objects suitable for <canvas>.
 *
 * GIFs use delta frames — only changed pixels are stored per frame.
 * The disposal method controls how the canvas is prepared before each frame:
 *   0 / 1 — keep previous canvas state (draw new frame on top)
 *   2     — restore the previous frame's region to the background before drawing
 *   3     — restore to the canvas state from before the previous frame was drawn
 *
 * Usage:
 *   const { extractFrames, extractImageAsFrame, loading, error } = useGifFrames();
 *   await extractFrames(file);         // GIF → triggers store.setFrames(…)
 *   await extractImageAsFrame(file);   // image → single-frame store.setFrames(…)
 */

import { useCallback, useState } from 'react';
import { useProject } from '../store/projectStore';

export function useGifFrames() {
  const { setFrames } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const extractImageAsFrame = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);

      try {
        const url = URL.createObjectURL(file);
        const img = new Image();

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Failed to load image.'));
          img.src = url;
        });

        URL.revokeObjectURL(url);

        const { width, height } = img;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, width, height);
        setFrames([{ imageData, delay: 100 }], width, height, file.name);
      } catch (err) {
        console.error('Image loading error:', err);
        setError('Failed to load image. Please try another file.');
      } finally {
        setLoading(false);
      }
    },
    [setFrames]
  );

  const extractFrames = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        const { GifReader } = await import('omggif');
        const reader = new GifReader(uint8);

        const width = reader.width;
        const height = reader.height;
        const frameCount = reader.numFrames();

        const frames = [];

        // Persistent compositing canvas — state is maintained across frames.
        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const offCtx = offscreen.getContext('2d');

        // Temporary canvas used to blit a single frame's delta pixels via
        // drawImage so that transparent pixels composite correctly (source-over)
        // rather than overwriting everything like putImageData would.
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = width;
        tmpCanvas.height = height;
        const tmpCtx = tmpCanvas.getContext('2d');

        // Saved canvas state for disposal method 3 of the previous frame.
        let savedSnapshot = null;

        for (let i = 0; i < frameCount; i++) {
          const frameInfo = reader.frameInfo(i);

          // ── Step 1: apply the disposal method of the PREVIOUS frame ──────────
          if (i > 0) {
            const prevInfo = reader.frameInfo(i - 1);
            switch (prevInfo.disposal) {
              case 2:
                // Restore the region occupied by the previous frame to the
                // background (treat as transparent — clearRect erases to rgba 0).
                offCtx.clearRect(prevInfo.x, prevInfo.y, prevInfo.width, prevInfo.height);
                break;
              case 3:
                // Restore the canvas to the state captured before the previous
                // frame was drawn.
                if (savedSnapshot) {
                  offCtx.putImageData(savedSnapshot, 0, 0);
                }
                break;
              default:
                // Disposal 0 or 1: leave the canvas as-is.
                break;
            }
          }

          // ── Step 2: optionally save canvas state for disposal 3 later ────────
          savedSnapshot = frameInfo.disposal === 3
            ? offCtx.getImageData(0, 0, width, height)
            : null;

          // ── Step 3: decode this frame's delta pixels ──────────────────────────
          // decodeAndBlitFrameRGBA fills a full-canvas buffer; pixels outside the
          // frame's bounding box are (0, 0, 0, 0) — transparent.
          const pixelData = new Uint8ClampedArray(width * height * 4);
          reader.decodeAndBlitFrameRGBA(i, pixelData);

          // ── Step 4: composite onto the offscreen canvas ───────────────────────
          // Use drawImage (source-over) so that transparent delta pixels do NOT
          // overwrite the underlying composite state — this is the key fix for the
          // black-chunk / incomplete-pixel rendering bug.
          tmpCtx.clearRect(0, 0, width, height);
          tmpCtx.putImageData(new ImageData(pixelData, width, height), 0, 0);
          offCtx.drawImage(tmpCanvas, 0, 0);

          // ── Step 5: snapshot the fully composited frame ───────────────────────
          frames.push({
            imageData: offCtx.getImageData(0, 0, width, height),
            delay: (frameInfo.delay || 10) * 10, // centiseconds → ms
          });
        }

        setFrames(frames, width, height, file.name);
      } catch (err) {
        console.error('GIF parsing error:', err);
        setError('Failed to parse GIF. Please try another file.');
      } finally {
        setLoading(false);
      }
    },
    [setFrames]
  );

  return { extractFrames, extractImageAsFrame, loading, error };
}
