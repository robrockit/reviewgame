/**
 * @fileoverview Utility helper functions for the application.
 *
 * This module provides general-purpose utility functions used throughout the application.
 *
 * @module lib/utils/helpers
 */

/**
 * Gets the base URL of the application based on the environment.
 *
 * This function determines the correct base URL for the application by checking
 * environment variables in the following priority order:
 * 1. NEXT_PUBLIC_SITE_URL (set in production)
 * 2. NEXT_PUBLIC_VERCEL_URL (automatically set by Vercel)
 * 3. http://localhost:3000/ (development fallback)
 *
 * The function ensures the URL:
 * - Uses HTTPS in production environments
 * - Includes a trailing slash
 *
 * @returns {string} The fully qualified base URL of the application
 *
 * @example
 * ```tsx
 * const baseUrl = getURL();
 * // Production: 'https://reviewgame.com/'
 * // Vercel Preview: 'https://reviewgame-abc123.vercel.app/'
 * // Development: 'http://localhost:3000/'
 *
 * // Use for constructing absolute URLs
 * const redirectUrl = `${getURL()}api/auth/callback`;
 * ```
 */
export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    "http://localhost:3000/";
  // Make sure to include `https` in production URLs.
  url = url.includes("http") ? url : `https://${url}`;
  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === "/" ? url : `${url}/`;
  return url;
};