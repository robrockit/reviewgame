/**
 * Returns true only for http: or https: URLs.
 * Prevents rendering data:, javascript:, or other scheme URLs in <img> tags.
 *
 * http: is intentionally permitted alongside https: because:
 *  - Teachers may reference images on legacy HTTP-only hosts
 *  - Local dev environments often serve over HTTP
 * In production the browser will show a mixed-content warning for http: images
 * loaded inside an https: page, which is an acceptable trade-off vs. silently
 * hiding a teacher's image. A DB-level constraint is the belt-and-suspenders
 * approach for stricter enforcement (tracked separately).
 */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
