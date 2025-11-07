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

/**
 * Sensitive keys that should never be logged
 * These will be automatically redacted from log context
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'stripe_secret',
  'service_role',
  'bearer',
  'credential',
  'private',
  'session',
  'cookie',
  'code', // OAuth codes
] as const;

/**
 * Base log context with common fields
 * Restricts values to primitives only (no objects) for security
 */
interface BaseLogContext {
  userId?: string;
  gameId?: string;
  teamId?: string;
  questionId?: string;
  operation: string; // Required - must specify what operation failed
  [key: string]: string | number | boolean | undefined | null | Error | unknown;
}

/**
 * Forbidden keys that should trigger type errors
 * Prevents accidental logging of sensitive data at compile time
 */
type ForbiddenKeys =
  | 'password'
  | 'token'
  | 'secret'
  | 'apiKey'
  | 'authorization'
  | 'stripe_secret'
  | 'service_role'
  | 'code'; // OAuth codes

/**
 * Log context type that forbids sensitive keys
 */
export type LogContext = BaseLogContext & {
  [K in ForbiddenKeys]?: never;
};

/**
 * Sanitize context data to remove sensitive information
 * Defense in depth - catches what TypeScript might miss
 */
function sanitizeContext(context?: LogContext | Record<string, unknown>): Record<string, unknown> {
  if (!context) return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    // Check if key contains any sensitive terms
    const keyLower = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sensitive =>
      keyLower.includes(sensitive.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value instanceof Error) {
      // Preserve error messages but not the full object
      sanitized[key] = value.message;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
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
    const sanitized = sanitizeContext(context);

    if (process.env.NODE_ENV === 'development') {
      console.info(`[INFO] ${message}`, sanitized);
    }

    // Send to Sentry as a breadcrumb for context in production
    Sentry.addBreadcrumb({
      category: 'info',
      message,
      level: 'info',
      data: sanitized,
    });
  },

  /**
   * Log warning messages for non-critical issues
   * @param message - Human-readable message describing the warning
   * @param context - Additional context for debugging
   */
  warn: (message: string, context?: LogContext) => {
    const sanitized = sanitizeContext(context);

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[WARN] ${message}`, sanitized);
    }

    // Send to Sentry with warning level
    Sentry.captureMessage(message, {
      level: 'warning',
      contexts: {
        custom: sanitized,
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
    const sanitized = sanitizeContext(context);

    if (process.env.NODE_ENV === 'development') {
      console.error(`[ERROR] ${message}`, error || '', sanitized);
    }

    // Send to Sentry with full error tracking
    if (error instanceof Error) {
      Sentry.captureException(error, {
        contexts: {
          custom: {
            ...sanitized,
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
            ...sanitized,
            errorData: error,
          },
        },
      });
    }
  },
};
