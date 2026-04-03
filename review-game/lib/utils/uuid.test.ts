import { describe, it, expect } from 'vitest';
import { isValidUUID } from './uuid';

describe('isValidUUID', () => {
  it('returns true for a valid lowercase UUID', () => {
    expect(isValidUUID('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true);
  });

  it('returns true for an uppercase UUID', () => {
    expect(isValidUUID('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true);
  });

  it('returns true for a mixed-case UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-A716-446655440000')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('returns false when a segment is too short', () => {
    expect(isValidUUID('aaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false);
  });

  it('returns false when hyphens are missing', () => {
    expect(isValidUUID('aaaaaaaabbbbccccddddeeeeeeeeeeee')).toBe(false);
  });

  it('returns false for non-hex characters', () => {
    expect(isValidUUID('zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('returns false when trailing characters are present', () => {
    expect(isValidUUID('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-extra')).toBe(false);
  });
});
