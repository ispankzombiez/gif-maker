/**
 * Uploader.jsx
 *
 * Drag-and-drop / click-to-browse file input that accepts GIFs, videos,
 * and common image formats.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useGifFrames } from '../hooks/useGifFrames';

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'ogv', 'm4v'];
const VIDEO_EXTENSION_PATTERN = new RegExp(`\\.(${VIDEO_EXTENSIONS.join('|')})$`, 'i');
const ACCEPTED_TYPES = [
  'image/gif',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  '.gif',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.avif',
  ...VIDEO_EXTENSIONS.map((ext) => `.${ext}`),
].join(',');

function isGif(file) {
  return file.type === 'image/gif' || file.name?.toLowerCase().endsWith('.gif');
}

function isVideo(file) {
  return file.type?.startsWith('video/') || VIDEO_EXTENSION_PATTERN.test(file.name ?? '');
}

function isImage(file) {
  if (isGif(file)) return false;
  if (isVideo(file)) return false;
  return file.type?.startsWith('image/') || /\.(png|jpe?g|webp|bmp|avif)$/i.test(file.name ?? '');
}

export default function Uploader() {
  const { extractFrames, extractVideoAsFrames, extractImageAsFrame, loading, error } = useGifFrames();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      if (isGif(file)) {
        extractFrames(file);
      } else if (isVideo(file)) {
        extractVideoAsFrames(file);
      } else if (isImage(file)) {
        extractImageAsFrame(file);
      } else {
        alert('Please upload a GIF, video, or image file.');
      }
    },
    [extractFrames, extractVideoAsFrames, extractImageAsFrame]
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
      aria-label="Upload a GIF, video, or image file"
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
            <strong>Click</strong> or <strong>drag & drop</strong> a GIF, video, or image here
          </p>
          <p className="uploader__hint">
            Videos are automatically split into editable frames and exported back out as GIFs
          </p>
        </>
      )}

      {error && <p className="uploader__error">{error}</p>}
    </div>
  );
}
