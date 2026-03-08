'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ImageModalProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/**
 * Full-screen lightbox for viewing a question image at full size.
 *
 * - Dark overlay backdrop
 * - Closes on ESC, backdrop click, or X button
 * - Focus trapped inside while open; restored to trigger element on close
 * - Saves and restores body overflow so the outer modal's scroll lock is preserved
 */
export default function ImageModal({ src, alt, onClose }: ImageModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save the previously focused element and focus the close button on mount.
  // Snapshot the current overflow value so restoring it doesn't clear a lock
  // that was set by the parent QuestionModal.
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Only one focusable element exists; prevent Tab from escaping to the background.
      if (e.key === 'Tab') e.preventDefault();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-90 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Enlarged view: ${alt}`}
    >
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded"
        aria-label="Close image viewer"
      >
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element -- external user-supplied URLs; remotePatterns config not required */}
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
