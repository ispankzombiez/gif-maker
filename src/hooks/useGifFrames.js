/**
 * useGifFrames.js
 *
 * Custom hook that parses a GIF file using the `omggif` library and
 * returns individual frames as ImageData objects suitable for <canvas>.
 *
 * Usage:
 *   const { extractFrames, loading, error } = useGifFrames();
 *   await extractFrames(file);   // triggers store.setFrames(…)
 */

import { useCallback, useState } from 'react';
import { useProject } from '../store/projectStore';

export function useGifFrames() {
  const { setFrames } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const extractFrames = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Dynamically import omggif (avoids SSR issues)
        const { GifReader } = await import('omggif');
        const reader = new GifReader(uint8);

        const width = reader.width;
        const height = reader.height;
        const frameCount = reader.numFrames();

        const frames = [];

        // We composite each frame onto a persistent off-screen canvas so
        // that GIFs using "do not dispose" between frames render correctly.
        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const offCtx = offscreen.getContext('2d');

        for (let i = 0; i < frameCount; i++) {
          const frameInfo = reader.frameInfo(i);
          const pixelData = new Uint8ClampedArray(width * height * 4);
          reader.decodeAndBlitFrameRGBA(i, pixelData);

          // Build per-frame ImageData
          const frameImageData = new ImageData(pixelData, width, height);

          // Composite onto off-screen canvas (respects disposal method 0/1)
          offCtx.putImageData(frameImageData, 0, 0);

          // Capture composite snapshot
          const snapshot = offCtx.getImageData(0, 0, width, height);

          frames.push({
            imageData: snapshot,
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

  return { extractFrames, loading, error };
}
