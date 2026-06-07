import { describe, it, expect } from 'vitest';
import { checkCooldown } from '@/lib/cooldown';

const FIVE_MIN = 5 * 60 * 1000;

describe('checkCooldown', () => {
  it('allows when there is no prior proposal', () => {
    const r = checkCooldown(null, 1_000_000);
    expect(r.allowed).toBe(true);
    expect(r.remainingMs).toBe(0);
  });

  it('blocks within the cooldown window and reports remaining', () => {
    const last = 1_000_000;
    const now = last + 60_000; // 1 min later
    const r = checkCooldown(last, now);
    expect(r.allowed).toBe(false);
    expect(r.remainingMs).toBe(FIVE_MIN - 60_000);
  });

  it('allows exactly at the boundary', () => {
    const last = 1_000_000;
    const r = checkCooldown(last, last + FIVE_MIN);
    expect(r.allowed).toBe(true);
    expect(r.remainingMs).toBe(0);
  });
});
