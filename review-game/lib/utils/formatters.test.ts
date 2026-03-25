import { describe, it, expect } from 'vitest';
import { getOrdinal } from './formatters';

describe('getOrdinal', () => {
  it('returns 1st for 1', () => expect(getOrdinal(1)).toBe('1st'));
  it('returns 2nd for 2', () => expect(getOrdinal(2)).toBe('2nd'));
  it('returns 3rd for 3', () => expect(getOrdinal(3)).toBe('3rd'));
  it('returns 4th for 4', () => expect(getOrdinal(4)).toBe('4th'));
  it('returns 11th for 11 (teen exception)', () => expect(getOrdinal(11)).toBe('11th'));
  it('returns 12th for 12 (teen exception)', () => expect(getOrdinal(12)).toBe('12th'));
  it('returns 13th for 13 (teen exception)', () => expect(getOrdinal(13)).toBe('13th'));
  it('returns 21st for 21', () => expect(getOrdinal(21)).toBe('21st'));
  it('returns 22nd for 22', () => expect(getOrdinal(22)).toBe('22nd'));
  it('returns 23rd for 23', () => expect(getOrdinal(23)).toBe('23rd'));
  it('returns 100th for 100', () => expect(getOrdinal(100)).toBe('100th'));
  it('returns 101st for 101', () => expect(getOrdinal(101)).toBe('101st'));
  it('returns 111th for 111', () => expect(getOrdinal(111)).toBe('111th'));
  it('returns 42nd for 42', () => expect(getOrdinal(42)).toBe('42nd'));
});
