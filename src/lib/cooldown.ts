import { COOLDOWN_MS } from '@/lib/config';

export interface CooldownResult {
  allowed: boolean;
  remainingMs: number;
}

export function checkCooldown(
  lastProposalMs: number | null,
  nowMs: number,
  cooldownMs: number = COOLDOWN_MS,
): CooldownResult {
  if (lastProposalMs === null) return { allowed: true, remainingMs: 0 };
  const elapsed = nowMs - lastProposalMs;
  if (elapsed >= cooldownMs) return { allowed: true, remainingMs: 0 };
  return { allowed: false, remainingMs: cooldownMs - elapsed };
}
