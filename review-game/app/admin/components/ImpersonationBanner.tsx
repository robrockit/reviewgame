/**
 * @fileoverview Persistent banner displayed during user impersonation sessions.
 *
 * Shows impersonation status, target user info, session expiry time, and exit button.
 * Always visible at the top of the page when an admin is impersonating a user.
 *
 * @module app/admin/components/ImpersonationBanner
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldExclamationIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

interface ImpersonationSession {
  sessionId: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string | null;
  startedAt: string;
  expiresAt: string;
  reason: string;
}

interface ImpersonationBannerProps {
  session: ImpersonationSession;
  onEnd: () => void;
}

/**
 * Impersonation Banner Component
 *
 * Displays a persistent banner at the top of the page during impersonation sessions.
 * Shows target user info, countdown timer, and exit button.
 */
export default function ImpersonationBanner({
  session,
  onEnd,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  /**
   * Calculate and update time remaining until session expires
   * Fixed: Clear interval before router.refresh() to prevent race condition
   */
  useEffect(() => {
    const updateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return true; // Signal that session has expired
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      return false;
    };

    // Update immediately and check if already expired
    const isExpired = updateTimeRemaining();
    if (isExpired) {
      // Session already expired, refresh immediately without setting up interval
      router.refresh();
      return;
    }

    // Update every second and check for expiry
    const interval = setInterval(() => {
      const isExpired = updateTimeRemaining();
      if (isExpired) {
        // Clear interval BEFORE calling router.refresh() to prevent race condition
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session.expiresAt, router]);

  /**
   * Handles ending the impersonation session
   */
  const handleEndImpersonation = async () => {
    setIsEnding(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/impersonate/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to end impersonation');
      }

      // Success - notify parent and refresh
      onEnd();
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      logger.error('Failed to end impersonation session', err instanceof Error ? err : new Error(errorMessage), {
        operation: 'endImpersonation',
        sessionId: session.sessionId,
      });
    } finally {
      setIsEnding(false);
    }
  };

  const displayName = session.targetUserName || session.targetUserEmail;

  return (
    <div className="bg-amber-500 border-b-4 border-amber-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3">
          {/* Main banner content */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <ShieldExclamationIcon className="h-6 w-6 text-white flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">
                    Impersonating:
                  </span>
                  <span className="text-sm font-medium text-white bg-amber-600 px-2 py-0.5 rounded truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-amber-100">
                    ({session.targetUserEmail})
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-amber-100">
                    Expires in: <span className="font-mono font-semibold">{timeRemaining}</span>
                  </span>
                  {session.reason && (
                    <span className="text-xs text-amber-100 truncate">
                      Reason: {session.reason}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Exit button */}
            <button
              type="button"
              onClick={handleEndImpersonation}
              disabled={isEnding}
              className="ml-4 flex-shrink-0 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-amber-700 shadow-sm hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Exit impersonation"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>{isEnding ? 'Ending...' : 'Exit Impersonation'}</span>
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-3">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Failed to end impersonation
                  </h3>
                  <div className="mt-1 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
