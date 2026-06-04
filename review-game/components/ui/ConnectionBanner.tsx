'use client';

interface ConnectionBannerProps {
  status: 'connecting' | 'connected' | 'disconnected';
}

/**
 * The Tailwind class that consumers must add to their root container's top padding
 * to prevent this fixed-position banner from occluding content when visible.
 * Centralised here so a banner height change only requires one edit.
 */
export const BANNER_OFFSET_CLASS = 'pt-10';

export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status !== 'disconnected') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 text-sm font-semibold text-center py-2 px-4"
    >
      Connection lost — attempting to reconnect…
    </div>
  );
}
