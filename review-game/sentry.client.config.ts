/**
 * Sentry Client-side Configuration
 * This file configures Sentry for the browser/client-side
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  // Sentry DSN - Set this in your environment variables
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replays are useful for watching session recordings
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // You can also set beforeSend to filter out certain events
  beforeSend(event, hint) {
    // Allow opt-in Sentry testing in development
    // Set SENTRY_DEBUG=true in .env.local to test Sentry integration locally
    if (process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_SENTRY_DEBUG !== 'true') {
      return null;
    }
    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    // Network errors
    'NetworkError',
    'Network request failed',
  ],
});
