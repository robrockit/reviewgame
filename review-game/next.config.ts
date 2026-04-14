import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const cspHeader = [
  "default-src 'self'",
  // Next.js requires unsafe-inline for its hydration scripts; Stripe.js loaded from CDN
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  // Tailwind CSS uses inline styles
  "style-src 'self' 'unsafe-inline'",
  // Supabase REST/Auth (HTTPS) + Supabase Realtime (WSS); Stripe API for checkout
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
  // Fonts are self-hosted via next/font — no external font CDN needed
  "font-src 'self'",
  "img-src 'self' data: blob: https:",
  // Stripe uses an iframe for secure card input
  "frame-src https://js.stripe.com",
  // Sentry replay uses a blob worker; Sentry requests route through /monitoring (app domain)
  "worker-src blob: 'self'",
].join('; ');

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the Sentry DSN is publicly available before enabling this option.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
});
