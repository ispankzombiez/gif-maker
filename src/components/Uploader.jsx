/**
 * Uploader.jsx
 *
 * Drag-and-drop / click-to-browse file input that accepts GIF files.
 * Calls extractFrames() from the useGifFrames hook on selection.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useGifFrames } from '../hooks/useGifFrames';

export default function Uploader() {
  const { extractFrames, loading, error } = useGifFrames();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      // Accept any file; validate by attempting to parse as GIF below.
      // Avoid strict MIME-type gating here because some mobile browsers
      // (e.g. Samsung Internet) report a blank or non-standard MIME type
      // for GIF files picked from the gallery.
      if (file.type && !file.type.includes('gif') && !file.name?.toLowerCase().endsWith('.gif')) {
        alert('Please upload a GIF file.');
        return;
      }
      extractFrames(file);
    },
    [extractFrames]
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
      aria-label="Upload a GIF file"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/gif,.gif"
        onChange={onInputChange}
        style={{ display: 'none' }}
      />

      {loading ? (
        <p className="uploader__status">⏳ Parsing GIF frames…</p>
      ) : (
        <>
          <span className="uploader__icon">🎞️</span>
          <p className="uploader__label">
            <strong>Click</strong> or <strong>drag & drop</strong> a GIF here
          </p>
          <p className="uploader__hint">Supports animated GIFs up to ~10 MB</p>
        </>
      )}

      {error && <p className="uploader__error">{error}</p>}
    </div>
  );
}
