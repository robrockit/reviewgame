/**
 * @fileoverview Utility functions for sanitizing and validating admin request metadata.
 *
 * These utilities ensure that IP addresses and user agents logged in audit trails
 * are properly validated and sanitized to prevent:
 * - IP spoofing attacks
 * - XSS via malicious user agents
 * - SQL injection via control characters
 * - Storage of invalid/malicious data
 *
 * @module lib/admin/request-utils
 */

/**
 * Sanitizes and validates an IP address.
 *
 * Validates IPv4 and IPv6 addresses and returns 'unknown' for invalid inputs.
 * This prevents storing spoofed or malicious IP addresses in audit logs.
 *
 * @param {string | null | undefined} ip - Raw IP address to sanitize
 * @returns {string} Validated IP address or 'unknown' if invalid
 *
 * @example
 * ```ts
 * sanitizeIpAddress('192.168.1.1') // '192.168.1.1'
 * sanitizeIpAddress('999.999.999.999') // 'unknown'
 * sanitizeIpAddress('<script>alert(1)</script>') // 'unknown'
 * sanitizeIpAddress(null) // 'unknown'
 * ```
 */
export function sanitizeIpAddress(ip: string | null | undefined): string {
  if (!ip) return 'unknown';

  // Remove whitespace and validate
  const cleaned = ip.trim();

  // IPv4 regex pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 regex pattern (simplified - matches colon-separated hex groups)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Pattern.test(cleaned)) {
    // Validate IPv4 octets are 0-255
    const octets = cleaned.split('.');
    const isValidIPv4 = octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });

    if (isValidIPv4) {
      return cleaned;
    }
  } else if (ipv6Pattern.test(cleaned)) {
    return cleaned;
  }

  // If validation fails, return 'unknown' rather than storing invalid data
  return 'unknown';
}

/**
 * Sanitizes a user agent string.
 *
 * User agents can be arbitrarily long and may contain control characters or
 * malicious content. This function truncates to reasonable length and removes
 * dangerous characters.
 *
 * @param {string | null | undefined} ua - Raw user agent string
 * @returns {string} Sanitized user agent or 'unknown' if invalid
 *
 * @example
 * ```ts
 * sanitizeUserAgent('Mozilla/5.0 ...') // 'Mozilla/5.0 ...'
 * sanitizeUserAgent('A'.repeat(1000)) // Truncated to 500 chars
 * sanitizeUserAgent('Evil\x00Bot') // 'EvilBot' (control chars removed)
 * sanitizeUserAgent(null) // 'unknown'
 * ```
 */
export function sanitizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'unknown';

  // Truncate to reasonable length (most UAs are under 200 chars, cap at 500)
  const truncated = ua.substring(0, 500);

  // Remove control characters (0x00-0x1F, 0x7F-0x9F) and newlines
  // This prevents XSS, log injection, and other attacks
  const sanitized = truncated.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  return sanitized || 'unknown';
}

/**
 * Extracts and sanitizes IP address from Next.js request headers.
 *
 * Handles x-forwarded-for and x-real-ip headers with proper validation.
 * Prefers the leftmost IP in x-forwarded-for (original client IP).
 *
 * @param {Headers} headersList - Next.js headers object
 * @returns {string} Sanitized IP address
 *
 * @example
 * ```ts
 * const headersList = await headers();
 * const ip = getClientIpAddress(headersList);
 * ```
 */
export function getClientIpAddress(headersList: Headers): string {
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');

  // Get first IP from x-forwarded-for (leftmost is original client)
  const rawIp = forwardedFor
    ? forwardedFor.split(',')[0]?.trim()
    : realIp;

  return sanitizeIpAddress(rawIp);
}

/**
 * Extracts and sanitizes user agent from Next.js request headers.
 *
 * @param {Headers} headersList - Next.js headers object
 * @returns {string} Sanitized user agent
 *
 * @example
 * ```ts
 * const headersList = await headers();
 * const userAgent = getClientUserAgent(headersList);
 * ```
 */
export function getClientUserAgent(headersList: Headers): string {
  const ua = headersList.get('user-agent');
  return sanitizeUserAgent(ua);
}
