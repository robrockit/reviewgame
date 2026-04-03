/**
 * UUID v4 validation utilities shared across API routes.
 * Centralises the regex so a format change is a single-place edit.
 */

/** Pattern that matches any well-formed UUID (case-insensitive). */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true when {@link value} is a syntactically valid UUID.
 * Used for early-exit input validation in API routes to avoid needless DB
 * round-trips for obviously invalid identifiers.
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
