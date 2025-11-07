/**
 * Centralized logging service with Sentry integration
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * // Info logging
 * logger.info('Operation completed', { userId: '123', action: 'login' });
 *
 * // Warning logging
 * logger.warn('Deprecated API used', { endpoint: '/api/old' });
 *
 * // Error logging
 * logger.error('Failed to update score', error, {
 *   teamId: team.id,
 *   gameId: game.id,
 *   scoreChange: 100
 * });
 * ```
 */

import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext extends Record<string, unknown> {
  userId?: string;
  gameId?: string;
  teamId?: string;
  operation?: string;
  timestamp?: string;
}

/**
 * Centralized logger that sends logs to Sentry in production
 * and console in development
 */
export const logger = {
  /**
   * Log informational messages
   * @param message - Human-readable message describing what happened
   * @param context - Additional context for debugging
   */
  info: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[INFO] ${message}`, context || '');
    }

    // Send to Sentry as a breadcrumb for context in production
    Sentry.addBreadcrumb({
      category: 'info',
      message,
      level: 'info',
      data: context,
    });
  },

  /**
   * Log warning messages for non-critical issues
   * @param message - Human-readable message describing the warning
   * @param context - Additional context for debugging
   */
  warn: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[WARN] ${message}`, context || '');
    }

    // Send to Sentry with warning level
    Sentry.captureMessage(message, {
      level: 'warning',
      contexts: {
        custom: context || {},
      },
    });
  },

  /**
   * Log error messages for critical issues
   * @param message - Human-readable message describing what went wrong
   * @param error - The error object (if available)
   * @param context - Additional context for debugging
   */
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ERROR] ${message}`, error || '', context || '');
    }

    // Send to Sentry with full error tracking
    if (error instanceof Error) {
      Sentry.captureException(error, {
        contexts: {
          custom: {
            ...context,
            errorMessage: message,
          },
        },
      });
    } else {
      // If not an Error object, send as a message with error level
      Sentry.captureMessage(message, {
        level: 'error',
        contexts: {
          custom: {
            ...context,
            errorData: error,
          },
        },
      });
    }
  },
};
