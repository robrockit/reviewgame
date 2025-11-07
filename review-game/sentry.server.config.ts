/**
 * Sentry Server-side Configuration
 * This file configures Sentry for the Node.js server-side
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  // Sentry DSN - Set this in your environment variables
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // You can also set beforeSend to filter out certain events
  beforeSend(event, hint) {
    // Filter out events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
