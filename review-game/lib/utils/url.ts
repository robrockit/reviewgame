/**
 * Returns true only for https: URLs.
 * Prevents rendering data:, javascript:, http:, or other scheme URLs in <img> tags.
 *
 * http: is intentionally excluded: browsers block mixed-content (http images
 * inside an https page) silently, resulting in broken images with no explanation
 * to the user. Restricting to https: here matches the form-level validation so
 * that any http: URL already stored in the database is also not rendered.
 */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:';
  } catch {
    return false;
  }
}
