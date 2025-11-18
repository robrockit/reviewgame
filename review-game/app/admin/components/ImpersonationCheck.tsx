/**
 * @fileoverview Client component to check for active impersonation sessions.
 *
 * Polls the impersonation status API and displays the ImpersonationBanner
 * when an admin has an active impersonation session.
 *
 * @module app/admin/components/ImpersonationCheck
 */

'use client';

import { useEffect, useState } from 'react';
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
   */
  const checkImpersonationStatus = async () => {
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
  };

  /**
   * Handles ending the impersonation session
   */
  const handleSessionEnd = () => {
    setSession(null);
    router.refresh();
  };

  // Check impersonation status on mount
  useEffect(() => {
    checkImpersonationStatus();

    // Poll every 30 seconds to handle session expiry
    const interval = setInterval(checkImpersonationStatus, 30000);

    return () => clearInterval(interval);
  }, []);

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
