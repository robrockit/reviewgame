import { describe, it, expect } from 'vitest';
import { SCORE_ANIMATION_DURATION, FLASH_EFFECT_DURATION, easeOutQuad } from './animations';

describe('animation constants', () => {
  it('SCORE_ANIMATION_DURATION is 600ms', () => {
    expect(SCORE_ANIMATION_DURATION).toBe(600);
  });

  it('FLASH_EFFECT_DURATION is 600ms', () => {
    expect(FLASH_EFFECT_DURATION).toBe(600);
  });
});

describe('easeOutQuad', () => {
  it('returns 0 at t=0 (start of animation)', () => {
    expect(easeOutQuad(0)).toBe(0);
  });

  it('returns 1 at t=1 (end of animation)', () => {
    expect(easeOutQuad(1)).toBe(1);
  });

  it('returns a value between 0 and 1 for t=0.5', () => {
    const result = easeOutQuad(0.5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('is greater than linear at t=0.5 (easing decelerates)', () => {
    // easeOutQuad should be faster than linear at the start (result > t for t in (0,1))
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
  });

  it('is monotonically increasing from 0 to 1', () => {
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(easeOutQuad);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});
