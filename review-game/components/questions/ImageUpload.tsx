'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowUpTrayIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  canAddImages: boolean;
  bankId: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Computed once from the build-time env var. Empty string when absent;
// delete/change guards check for non-empty to avoid silent skips.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_STORAGE_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/question-images/`
  : '';

export default function ImageUpload({
  value,
  onChange,
  disabled = false,
  canAddImages,
  bankId,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Ref so the paste handler always reads the latest function without re-subscribing
  const handleFileUploadRef = useRef<(file: File) => Promise<void>>(() => Promise.resolve());
  const isUploadingRef = useRef(false);
  isUploadingRef.current = isUploading;

  const handleFileUpload = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only JPEG and PNG images are allowed');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('File size must not exceed 5MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    // If a Supabase-hosted image is already present, delete it before uploading
    // the replacement so we don't leak storage or inflate the counter.
    if (SUPABASE_STORAGE_PREFIX && value.startsWith(SUPABASE_STORAGE_PREFIX)) {
      try {
        await fetch('/api/images/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: value }),
        });
      } catch {
        // Non-fatal — proceed with new upload even if old file deletion fails
      }
    }

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('bankId', bankId);

      const res = await fetch('/api/images/upload', { method: 'POST', body: form });
      const data: unknown = await res.json();

      if (!res.ok) {
        const errMsg = data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'Upload failed';
        setUploadError(errMsg);
        return;
      }

      if (data && typeof data === 'object' && 'url' in data && typeof (data as { url: unknown }).url === 'string') {
        onChange((data as { url: string }).url);
        setShowUrlInput(false);
      }
    } catch {
      setUploadError('Upload failed — please try again');
    } finally {
      setIsUploading(false);
    }
  }, [bankId, onChange, value]);

  // Keep ref current
  handleFileUploadRef.current = handleFileUpload;

  // Clipboard paste handler — scoped to avoid intercepting pastes
  // while the user is editing a text field elsewhere on the page.
  useEffect(() => {
    if (!canAddImages || disabled) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (isUploadingRef.current) return;
      // Skip if focus is inside a text-editable element
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (file) {
        void handleFileUploadRef.current(file);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [canAddImages, disabled]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
    // Reset so the same file can be re-selected after removal
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  const handleUrlUpload = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const form = new FormData();
      form.append('url', trimmed);
      form.append('bankId', bankId);

      const res = await fetch('/api/images/upload', { method: 'POST', body: form });
      const data: unknown = await res.json();

      if (!res.ok) {
        const errMsg = data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'Upload failed';
        setUploadError(errMsg);
        return;
      }

      if (data && typeof data === 'object' && 'url' in data && typeof (data as { url: unknown }).url === 'string') {
        onChange((data as { url: string }).url);
        setUrlInput('');
        setShowUrlInput(false);
      }
    } catch {
      setUploadError('Upload failed — please try again');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    let deleteFailed = false;
    if (SUPABASE_STORAGE_PREFIX && value.startsWith(SUPABASE_STORAGE_PREFIX)) {
      try {
        const res = await fetch('/api/images/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: value }),
        });
        if (!res.ok) {
          deleteFailed = true;
          console.warn('[ImageUpload] Failed to delete image from storage — file may be orphaned');
        }
      } catch {
        deleteFailed = true;
        console.warn('[ImageUpload] Failed to delete image from storage — file may be orphaned');
      }
    }
    onChange('');
    if (deleteFailed) {
      setUploadError('Image removed from this question, but could not be deleted from storage.');
    } else {
      setUploadError(null);
    }
  };

  // ── Locked state ──────────────────────────────────────────────────────────
  if (!canAddImages) {
    return (
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700">
          Image (optional)
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            BASIC/PREMIUM Only
          </span>
        </label>
        <p className="mt-1 text-xs text-yellow-700">
          Upgrade to BASIC or PREMIUM to add images to questions
        </p>
      </div>
    );
  }

  // ── Has image state ───────────────────────────────────────────────────────
  if (value) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image (optional)
        </label>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- external/storage URLs; Next Image requires allowlist */}
          <img
            src={value}
            alt="Question image preview"
            className="h-16 w-16 rounded object-cover border border-gray-200 flex-shrink-0"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />
              Change
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={handleFileInputChange}
          disabled={disabled || isUploading}
        />
        {uploadError && (
          <p className="mt-1 text-sm text-red-600">{uploadError}</p>
        )}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Image (optional)
      </label>

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        } ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          {isUploading ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="text-sm text-gray-600">Uploading…</p>
            </>
          ) : (
            <>
              <PhotoIcon className="h-8 w-8 text-gray-400" aria-hidden="true" />
              <p className="text-sm text-gray-600">
                Drag &amp; drop or{' '}
                <span className="font-medium text-indigo-600">Browse Files</span>
              </p>
              <p className="text-xs text-gray-400">JPEG or PNG · max 5 MB · paste also works</p>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={handleFileInputChange}
        disabled={disabled || isUploading}
      />

      {/* URL toggle */}
      {!showUrlInput ? (
        <button
          type="button"
          onClick={() => setShowUrlInput(true)}
          disabled={disabled || isUploading}
          className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add from URL instead
        </button>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            disabled={disabled || isUploading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleUrlUpload();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleUrlUpload()}
            disabled={disabled || isUploading || !urlInput.trim()}
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
            disabled={disabled || isUploading}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      )}

      {uploadError && (
        <p className="mt-1 text-sm text-red-600">{uploadError}</p>
      )}
    </div>
  );
}
