'use client';

interface ConnectionBannerProps {
  status: 'connecting' | 'connected' | 'disconnected';
}

/**
 * The Tailwind class consumers must add to their root container's top padding
 * when the banner is visible. Centralised here so a height change only requires
 * one edit. Applied once the channel has ever connected (status !== 'connecting')
 * so the space is always reserved after first connect, eliminating layout jumps
 * on disconnect/reconnect cycles.
 */
export const BANNER_OFFSET_CLASS = 'pt-10';

/**
 * Fixed-position banner that announces WebSocket disconnection to the user.
 *
 * Renders but stays visually hidden (opacity-0) when connected so the
 * container's pt-10 offset is always reserved after first connection,
 * preventing layout jumps when the banner appears or dismisses.
 * Returns null entirely before the first connection ('connecting') to avoid
 * reserving space before the WS has ever connected.
 */
export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status === 'connecting') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 text-sm font-semibold text-center py-2 px-4 transition-opacity duration-300 ${
        status === 'disconnected' ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      Connection lost — attempting to reconnect…
    </div>
  );
}
