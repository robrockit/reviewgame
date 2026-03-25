import { describe, it, expect } from 'vitest';
import { isSafeImageUrl } from './url';

describe('isSafeImageUrl', () => {
  it('returns true for a valid https URL', () => {
    expect(isSafeImageUrl('https://example.com/image.png')).toBe(true);
  });

  it('returns false for http URLs (mixed-content risk)', () => {
    expect(isSafeImageUrl('http://example.com/image.png')).toBe(false);
  });

  it('returns false for javascript: URLs (XSS risk)', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
  });

  it('returns false for data: URLs', () => {
    expect(isSafeImageUrl('data:image/png;base64,abc')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSafeImageUrl(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSafeImageUrl(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSafeImageUrl('')).toBe(false);
  });

  it('returns false for a relative path', () => {
    expect(isSafeImageUrl('/images/foo.png')).toBe(false);
  });

  it('returns false for a plain string that is not a URL', () => {
    expect(isSafeImageUrl('not-a-url')).toBe(false);
  });

  it('type-narrows to string when true', () => {
    const url: string | null = 'https://cdn.example.com/img.jpg';
    if (isSafeImageUrl(url)) {
      // TypeScript should be happy with url as string here
      expect(url.startsWith('https')).toBe(true);
    }
  });
});
