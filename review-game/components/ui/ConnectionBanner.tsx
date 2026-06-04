'use client';

interface ConnectionBannerProps {
  status: 'connecting' | 'connected' | 'disconnected';
}

export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status !== 'disconnected') return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 text-sm font-semibold text-center py-2 px-4">
      Connection lost — attempting to reconnect…
    </div>
  );
}
