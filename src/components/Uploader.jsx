/**
 * Uploader.jsx
 *
 * Drag-and-drop / click-to-browse file input that accepts GIF files and
 * common image formats (PNG, JPEG, WebP, etc.).
 * GIF files are parsed into frames via useGifFrames; image files are treated
 * as the first (and only) frame of a new GIF project.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useGifFrames } from '../hooks/useGifFrames';

const ACCEPTED_TYPES = 'image/gif,image/png,image/jpeg,image/webp,image/bmp,image/avif,.gif,.png,.jpg,.jpeg,.webp,.bmp,.avif';

function isGif(file) {
  return file.type === 'image/gif' || file.name?.toLowerCase().endsWith('.gif');
}

function isImage(file) {
  return file.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp|avif)$/i.test(file.name ?? '');
}

export default function Uploader() {
  const { extractFrames, extractImageAsFrame, loading, error } = useGifFrames();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      if (isGif(file)) {
        extractFrames(file);
      } else if (isImage(file)) {
        extractImageAsFrame(file);
      } else {
        alert('Please upload a GIF or image file (PNG, JPEG, WebP, etc.).');
      }
    },
    [extractFrames, extractImageAsFrame]
  );

  const onInputChange = (e) => handleFile(e.target.files[0]);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  return (
    <div
      className={`uploader${dragging ? ' uploader--dragging' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      aria-label="Upload a GIF or image file"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={onInputChange}
        style={{ display: 'none' }}
      />

      {loading ? (
        <p className="uploader__status">⏳ Loading…</p>
      ) : (
        <>
          <span className="uploader__icon">🎞️</span>
          <p className="uploader__label">
            <strong>Click</strong> or <strong>drag & drop</strong> a GIF or image here
          </p>
          <p className="uploader__hint">
            Supports animated GIFs up to ~10 MB, or any image (PNG, JPEG, WebP…)
          </p>
        </>
      )}

      {error && <p className="uploader__error">{error}</p>}
    </div>
  );
}
