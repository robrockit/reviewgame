import { describe, it, expect } from 'vitest';
import {
  calcPointsEarned,
  PUB_TRIVIA_POINT_BRACKETS,
  OPTION_ELIMINATION_THRESHOLDS,
} from './pub-trivia';

describe('calcPointsEarned', () => {
  it('returns 1000 at 0% elapsed (instant answer)', () => {
    expect(calcPointsEarned(0)).toBe(1000);
  });

  it('returns 1000 at 25% elapsed (boundary)', () => {
    expect(calcPointsEarned(0.25)).toBe(1000);
  });

  it('returns 800 just past 25% elapsed', () => {
    expect(calcPointsEarned(0.26)).toBe(800);
  });

  it('returns 800 at 50% elapsed (boundary)', () => {
    expect(calcPointsEarned(0.5)).toBe(800);
  });

  it('returns 600 just past 50% elapsed', () => {
    expect(calcPointsEarned(0.51)).toBe(600);
  });

  it('returns 600 at 75% elapsed (boundary)', () => {
    expect(calcPointsEarned(0.75)).toBe(600);
  });

  it('returns 400 just past 75% elapsed', () => {
    expect(calcPointsEarned(0.76)).toBe(400);
  });

  it('returns 400 at 100% elapsed (out of time)', () => {
    expect(calcPointsEarned(1.0)).toBe(400);
  });

  it('returns 400 for values slightly above 1 (safety)', () => {
    expect(calcPointsEarned(1.01)).toBe(400);
  });

  it('returns 1000 at exactly 0.24 (below first bracket boundary)', () => {
    expect(calcPointsEarned(0.24)).toBe(1000);
  });

  it('all bracket points are positive', () => {
    for (const b of PUB_TRIVIA_POINT_BRACKETS) {
      expect(b.points).toBeGreaterThan(0);
    }
  });
});

describe('PUB_TRIVIA_POINT_BRACKETS', () => {
  it('brackets are ordered by maxPct ascending', () => {
    for (let i = 1; i < PUB_TRIVIA_POINT_BRACKETS.length; i++) {
      expect(PUB_TRIVIA_POINT_BRACKETS[i].maxPct).toBeGreaterThan(
        PUB_TRIVIA_POINT_BRACKETS[i - 1].maxPct,
      );
    }
  });

  it('brackets have decreasing point values', () => {
    for (let i = 1; i < PUB_TRIVIA_POINT_BRACKETS.length; i++) {
      expect(PUB_TRIVIA_POINT_BRACKETS[i].points).toBeLessThan(
        PUB_TRIVIA_POINT_BRACKETS[i - 1].points,
      );
    }
  });

  it('last bracket covers 100%', () => {
    const last = PUB_TRIVIA_POINT_BRACKETS[PUB_TRIVIA_POINT_BRACKETS.length - 1];
    expect(last.maxPct).toBe(1.0);
  });
});

describe('OPTION_ELIMINATION_THRESHOLDS', () => {
  it('has exactly 2 thresholds', () => {
    expect(OPTION_ELIMINATION_THRESHOLDS).toHaveLength(2);
  });

  it('first threshold is 40%', () => {
    expect(OPTION_ELIMINATION_THRESHOLDS[0]).toBe(0.4);
  });

  it('second threshold is 70%', () => {
    expect(OPTION_ELIMINATION_THRESHOLDS[1]).toBe(0.7);
  });

  it('thresholds are in ascending order', () => {
    expect(OPTION_ELIMINATION_THRESHOLDS[1]).toBeGreaterThan(OPTION_ELIMINATION_THRESHOLDS[0]);
  });

  it('both thresholds are before the last scoring bracket boundary (75%)', () => {
    for (const t of OPTION_ELIMINATION_THRESHOLDS) {
      expect(t).toBeLessThan(0.76);
    }
  });
});
