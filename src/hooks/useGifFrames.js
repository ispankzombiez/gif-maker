/**
 * useGifFrames.js
 *
 * Custom hook that parses GIF or video uploads into ImageData frames suitable
 * for <canvas>.
 *
 * GIFs use delta frames — only changed pixels are stored per frame.
 * The disposal method controls how the canvas is prepared before each frame:
 *   0 / 1 — keep previous canvas state (draw new frame on top)
 *   2     — restore the previous frame's region to the background before drawing
 *   3     — restore to the canvas state from before the previous frame was drawn
 *
 * Usage:
 *   const { extractFrames, extractVideoAsFrames, extractImageAsFrame, loading, error } = useGifFrames();
 *   await extractFrames(file);         // GIF → triggers store.setFrames(…)
 *   await extractVideoAsFrames(file);  // video → triggers store.setFrames(…)
 *   await extractImageAsFrame(file);   // image → single-frame store.setFrames(…)
 */

import { useCallback, useState } from 'react';
import { useProject } from '../store/projectStore';

const DEFAULT_FRAME_DELAY_MS = 100;
const MIN_FRAME_DELAY_MS = 10;
const MIN_FRAME_TIME_DELTA_SECONDS = 0.0005;
const LONG_VIDEO_THRESHOLD_SECONDS = 10;
const FAST_VIDEO_PLAYBACK_RATE = 8;
const NORMAL_VIDEO_PLAYBACK_RATE = 4;

function clampFrameDelay(ms) {
  return Math.max(MIN_FRAME_DELAY_MS, Math.round(ms || DEFAULT_FRAME_DELAY_MS));
}

function waitForMediaEvent(media, successEvent, failureMessage) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      media.removeEventListener(successEvent, onSuccess);
      media.removeEventListener('error', onError);
    };

    const onSuccess = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(failureMessage));
    };

    media.addEventListener(successEvent, onSuccess, { once: true });
    media.addEventListener('error', onError, { once: true });
  });
}

async function imageDataFromImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = url;
    });

    const width = img.width;
    const height = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    return {
      width,
      height,
      imageData: ctx.getImageData(0, 0, width, height),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeAnimatedWebpFrames(file) {
  if (typeof globalThis.ImageDecoder === 'undefined') {
    return null;
  }

  if (typeof globalThis.ImageDecoder.isTypeSupported === 'function' && !globalThis.ImageDecoder.isTypeSupported(file.type)) {
    return null;
  }

  let decoder;

  try {
    decoder = new globalThis.ImageDecoder({ data: file.stream(), type: file.type });
    await decoder.tracks.ready;

    const track = decoder.tracks.selectedTrack;
    if (!track || !track.frameCount || !track.animated) {
      return null;
    }

    const frames = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    for (let frameIndex = 0; frameIndex < track.frameCount; frameIndex += 1) {
      const result = await decoder.decode({ frameIndex });
      const frame = result.image;
      const width = frame.codedWidth || frame.displayWidth;
      const height = frame.codedHeight || frame.displayHeight;

      if (!canvas.width || !canvas.height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      frames.push({
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        delay: clampFrameDelay((frame.duration ?? DEFAULT_FRAME_DELAY_MS * 1000) / 1000),
      });
      frame.close();
    }

    return {
      frames,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (err) {
    console.warn('Animated WebP decode failed, falling back to a single frame.', err);
    return null;
  } finally {
    if (decoder) {
      decoder.close();
    }
  }
}

export function useGifFrames() {
  const { setFrames } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const extractImageAsFrame = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);

      try {
        const { width, height, imageData } = await imageDataFromImageFile(file);
        setFrames([{ imageData, delay: DEFAULT_FRAME_DELAY_MS }], width, height, file.name);
      } catch (err) {
        console.error('Image loading error:', err);
        setError('Failed to load image. Please try another file.');
      } finally {
        setLoading(false);
      }
    },
    [setFrames]
  );

  const extractWebpAsFrames = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);

      try {
        const decoded = await decodeAnimatedWebpFrames(file);

        if (decoded?.frames?.length) {
          setFrames(decoded.frames, decoded.width, decoded.height, file.name);
          return;
        }

        const { width, height, imageData } = await imageDataFromImageFile(file);
        setFrames([{ imageData, delay: DEFAULT_FRAME_DELAY_MS }], width, height, file.name);
      } catch (err) {
        console.error('WebP loading error:', err);
        setError('Failed to load WebP image. Please try another file.');
      } finally {
        setLoading(false);
      }
    },
    [setFrames]
  );

  const extractVideoAsFrames = useCallback(
    async (file) => {
      setLoading(true);
      setError(null);

      let url = null;
      let video = null;

      try {
        url = URL.createObjectURL(file);
        video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = url;

        await waitForMediaEvent(video, 'loadeddata', 'Failed to load video.');

        const width = video.videoWidth;
        const height = video.videoHeight;

        if (!width || !height || !Number.isFinite(video.duration) || video.duration <= 0) {
          throw new Error('Unsupported or empty video file.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const capturedFrames = [];

        const captureFrame = (mediaTime) => {
          const safeMediaTime = Number.isFinite(mediaTime) ? mediaTime : video.currentTime;
          const lastTime = capturedFrames[capturedFrames.length - 1]?.mediaTime;

          if (
            lastTime !== undefined &&
            Math.abs(safeMediaTime - lastTime) < MIN_FRAME_TIME_DELTA_SECONDS
          ) {
            return;
          }

          ctx.drawImage(video, 0, 0, width, height);
          capturedFrames.push({
            mediaTime: safeMediaTime,
            imageData: ctx.getImageData(0, 0, width, height),
          });
        };

        captureFrame(0);

        await new Promise((resolve, reject) => {
          let finished = false;
          let frameCallbackId = null;
          let rafId = null;

          const cleanup = () => {
            finished = true;
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('error', onError);
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
            }
            if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
              video.cancelVideoFrameCallback(frameCallbackId);
            }
          };

          const settle = (err) => {
            cleanup();
            if (err) reject(err);
            else resolve();
          };

          const onEnded = () => {
            captureFrame(video.duration);
            settle();
          };

          const onError = () => {
            settle(new Error('Failed while decoding video frames.'));
          };

          const pollFrames = () => {
            if (finished) return;
            captureFrame(video.currentTime);
            rafId = requestAnimationFrame(pollFrames);
          };

          const captureFromVideoFrameCallback = (_now, metadata) => {
            if (finished) return;
            captureFrame(metadata?.mediaTime);
            if (!finished) {
              frameCallbackId = video.requestVideoFrameCallback(captureFromVideoFrameCallback);
            }
          };

          video.addEventListener('ended', onEnded, { once: true });
          video.addEventListener('error', onError, { once: true });

          if (typeof video.requestVideoFrameCallback === 'function') {
            frameCallbackId = video.requestVideoFrameCallback(captureFromVideoFrameCallback);
          } else {
            pollFrames();
          }

          video.playbackRate =
            video.duration > LONG_VIDEO_THRESHOLD_SECONDS
              ? FAST_VIDEO_PLAYBACK_RATE
              : NORMAL_VIDEO_PLAYBACK_RATE;
          video.play().catch(() => {
            settle(new Error('Video playback could not be started.'));
          });
        });

        if (!capturedFrames.length) {
          throw new Error('No video frames were captured.');
        }

        const averageFrameDeltaMs =
          capturedFrames.length > 1
            ? capturedFrames
                .slice(1)
                .reduce(
                  (sum, frame, index) => {
                    const previousFrame = capturedFrames[index];
                    return sum + ((frame.mediaTime - previousFrame.mediaTime) * 1000);
                  },
                  0
                ) / (capturedFrames.length - 1)
            : DEFAULT_FRAME_DELAY_MS;
        const fallbackDelayMs = clampFrameDelay(averageFrameDeltaMs);

        const frames = capturedFrames.map((frame, index) => {
          const nextTime = capturedFrames[index + 1]?.mediaTime;
          const previousDelta =
            index > 0
              ? (capturedFrames[index].mediaTime - capturedFrames[index - 1].mediaTime) * 1000
              : null;
          const delay =
            nextTime !== undefined
              ? (nextTime - frame.mediaTime) * 1000
              : previousDelta ?? fallbackDelayMs;

          return {
            imageData: frame.imageData,
            delay: clampFrameDelay(delay > 0 ? delay : fallbackDelayMs),
          };
        });

        setFrames(frames, width, height, file.name);
      } catch (err) {
        console.error('Video parsing error:', err);
        setError('Failed to load video. Please try another file.');
      } finally {
        if (video) {
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
        if (url) {
          URL.revokeObjectURL(url);
        }
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

  return { extractFrames, extractVideoAsFrames, extractImageAsFrame, extractWebpAsFrames, loading, error };
}
