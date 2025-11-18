/**
 * @fileoverview Client component to check for active impersonation sessions.
 *
 * Polls the impersonation status API and displays the ImpersonationBanner
 * when an admin has an active impersonation session.
 *
 * @module app/admin/components/ImpersonationCheck
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ImpersonationBanner from './ImpersonationBanner';
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

/**
 * Impersonation Check Component
 *
 * Checks for active impersonation sessions on mount and displays banner if active.
 * Polls every 30 seconds to handle session expiry.
 */
export default function ImpersonationCheck() {
  const router = useRouter();
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetches the current impersonation status
   * Wrapped in useCallback to prevent memory leaks from useEffect
   */
  const checkImpersonationStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/impersonate/status');

      if (!response.ok) {
        // If unauthorized or error, clear session
        setSession(null);
        return;
      }

      const data = await response.json();

      if (data.active && data.session) {
        setSession(data.session);
      } else {
        setSession(null);
      }
    } catch (error) {
      logger.error('Error checking impersonation status', error instanceof Error ? error : new Error(String(error)), {
        operation: 'checkImpersonationStatus',
      });
      // On error, clear session
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array - function doesn't depend on external values

  /**
   * Handles ending the impersonation session
   */
  const handleSessionEnd = () => {
    setSession(null);
    router.refresh();
  };

  // Check impersonation status on mount and poll based on session state
  useEffect(() => {
    checkImpersonationStatus();

    // Smart polling: 30s when session is active, 5 minutes when inactive
    // This reduces unnecessary API calls when no impersonation is happening
    const pollInterval = session ? 30000 : 300000;
    const interval = setInterval(checkImpersonationStatus, pollInterval);

    return () => clearInterval(interval);
  }, [checkImpersonationStatus, session]);

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // Only render banner if there's an active session
  if (!session) {
    return null;
  }

  return (
    <ImpersonationBanner
      session={session}
      onEnd={handleSessionEnd}
    />
  );
}
