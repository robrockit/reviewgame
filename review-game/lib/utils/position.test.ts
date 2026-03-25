import { describe, it, expect } from 'vitest';
import { getOrdinalSuffix, getPositionDisplay } from './position';

describe('getOrdinalSuffix', () => {
  it('returns 1st for 1', () => expect(getOrdinalSuffix(1)).toBe('1st'));
  it('returns 2nd for 2', () => expect(getOrdinalSuffix(2)).toBe('2nd'));
  it('returns 3rd for 3', () => expect(getOrdinalSuffix(3)).toBe('3rd'));
  it('returns 4th for 4', () => expect(getOrdinalSuffix(4)).toBe('4th'));
  it('returns 11th for 11 (special case)', () => expect(getOrdinalSuffix(11)).toBe('11th'));
  it('returns 12th for 12 (special case)', () => expect(getOrdinalSuffix(12)).toBe('12th'));
  it('returns 13th for 13 (special case)', () => expect(getOrdinalSuffix(13)).toBe('13th'));
  it('returns 21st for 21', () => expect(getOrdinalSuffix(21)).toBe('21st'));
  it('returns 111th for 111 (special case)', () => expect(getOrdinalSuffix(111)).toBe('111th'));
  it('returns 112th for 112', () => expect(getOrdinalSuffix(112)).toBe('112th'));
});

describe('getPositionDisplay', () => {
  it('position 0 gets gold medal emoji and yellow color', () => {
    const display = getPositionDisplay(0);
    expect(display.emoji).toBe('🥇');
    expect(display.text).toBe('1st');
    expect(display.color).toBe('text-yellow-500');
  });

  it('position 1 gets silver medal emoji and gray color', () => {
    const display = getPositionDisplay(1);
    expect(display.emoji).toBe('🥈');
    expect(display.text).toBe('2nd');
    expect(display.color).toBe('text-gray-400');
  });

  it('position 2 gets bronze medal emoji and orange color', () => {
    const display = getPositionDisplay(2);
    expect(display.emoji).toBe('🥉');
    expect(display.text).toBe('3rd');
    expect(display.color).toBe('text-orange-500');
  });

  it('position 3 gets medal emoji and blue color with 4th text', () => {
    const display = getPositionDisplay(3);
    expect(display.emoji).toBe('🏅');
    expect(display.text).toBe('4th');
    expect(display.color).toBe('text-blue-400');
  });

  it('higher positions use ordinal suffix correctly', () => {
    const display = getPositionDisplay(10);
    expect(display.text).toBe('11th');
  });
});
