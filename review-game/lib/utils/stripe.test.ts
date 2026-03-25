import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithTimeout, isValidSubscription, verifySubscriptionOwnership, isValidPriceId, STRIPE_PRICE_ID_PATTERN } from './stripe';
import type Stripe from 'stripe';

// Mock the logger to prevent actual error logging in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeSubscription = (overrides?: Record<string, unknown>): Stripe.Subscription =>
  ({
    id: 'sub_test123',
    customer: 'cus_test123',
    current_period_end: 1000,
    current_period_start: 900,
    cancel_at_period_end: false,
    cancel_at: null,
    ...overrides,
  } as unknown as Stripe.Subscription);

// ─── fetchWithTimeout ─────────────────────────────────────────────────────────

describe('fetchWithTimeout', () => {
  it('resolves with the promise value when it completes within timeout', async () => {
    const result = await fetchWithTimeout(Promise.resolve('hello'), 1000);
    expect(result).toBe('hello');
  });

  it('rejects with timeout error when promise exceeds timeout', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(fetchWithTimeout(slow, 50)).rejects.toThrow('Stripe API request timeout');
  });

  it('uses a default timeout of 10000ms without explicit argument', async () => {
    const quick = Promise.resolve(42);
    await expect(fetchWithTimeout(quick)).resolves.toBe(42);
  });
});

// ─── isValidSubscription ─────────────────────────────────────────────────────

describe('isValidSubscription', () => {
  it('returns true for a subscription with all required numeric fields', () => {
    expect(isValidSubscription(makeSubscription())).toBe(true);
  });

  it('returns false when current_period_end is missing', () => {
    const sub = makeSubscription({ current_period_end: undefined });
    expect(isValidSubscription(sub)).toBe(false);
  });

  it('returns false when current_period_start is missing', () => {
    const sub = makeSubscription({ current_period_start: undefined });
    expect(isValidSubscription(sub)).toBe(false);
  });

  it('returns false when cancel_at_period_end is not a boolean', () => {
    const sub = makeSubscription({ cancel_at_period_end: 'yes' });
    expect(isValidSubscription(sub)).toBe(false);
  });

  it('returns true when cancel_at is a number', () => {
    const sub = makeSubscription({ cancel_at: 1234567890 });
    expect(isValidSubscription(sub)).toBe(true);
  });

  it('returns false when cancel_at is a non-null non-number', () => {
    const sub = makeSubscription({ cancel_at: 'never' });
    expect(isValidSubscription(sub)).toBe(false);
  });
});

// ─── verifySubscriptionOwnership ─────────────────────────────────────────────

describe('verifySubscriptionOwnership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not throw when customer matches', () => {
    const sub = makeSubscription({ customer: 'cus_abc' });
    expect(() => verifySubscriptionOwnership(sub, 'cus_abc', 'user-1', 'test')).not.toThrow();
  });

  it('throws when expectedCustomerId is null', () => {
    const sub = makeSubscription();
    expect(() => verifySubscriptionOwnership(sub, null, 'user-1', 'test'))
      .toThrow('No billing account found');
  });

  it('throws when customer does not match expectedCustomerId', () => {
    const sub = makeSubscription({ customer: 'cus_abc' });
    expect(() => verifySubscriptionOwnership(sub, 'cus_different', 'user-1', 'test'))
      .toThrow('Unauthorized access to subscription');
  });
});

// ─── isValidPriceId ──────────────────────────────────────────────────────────

describe('isValidPriceId', () => {
  it('returns true for a valid price_* ID with 24 chars', () => {
    expect(isValidPriceId('price_1234567890abcdefghijklmn')).toBe(true);
  });

  it('returns false for an ID without price_ prefix', () => {
    expect(isValidPriceId('sub_1234567890abcdefghijklmn')).toBe(false);
  });

  it('returns false for a price_ ID that is too short', () => {
    expect(isValidPriceId('price_short')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidPriceId('')).toBe(false);
  });
});

// ─── STRIPE_PRICE_ID_PATTERN ─────────────────────────────────────────────────

describe('STRIPE_PRICE_ID_PATTERN', () => {
  it('matches price_ prefix followed by 24+ alphanumeric chars', () => {
    expect(STRIPE_PRICE_ID_PATTERN.test('price_1234567890abcdefghijklmn')).toBe(true);
  });

  it('does not match shorter IDs', () => {
    expect(STRIPE_PRICE_ID_PATTERN.test('price_abc123')).toBe(false);
  });
});
