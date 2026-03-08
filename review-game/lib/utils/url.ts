/**
 * Returns true only for http: or https: URLs.
 * Prevents rendering data:, javascript:, or other scheme URLs in <img> tags.
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
