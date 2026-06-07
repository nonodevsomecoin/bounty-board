import { SIGNATURE_MAX_SKEW_MS } from '@/lib/config';

// Builds the exact message a wallet signs. Binding the action (and optional
// resource id) into the message lets the server confirm a signature was made
// for THIS operation, preventing cross-action replay within the freshness window.
export function buildMessage(
  action: string,
  timestampMs: number,
  resourceId?: string,
): string {
  const target = resourceId ? `${action} (id: ${resourceId})` : action;
  return [
    `$TICKER Bounties — proving wallet ownership to ${target}.`,
    `Timestamp: ${timestampMs}`,
  ].join('\n');
}

export function extractTimestamp(message: string): number | null {
  const m = message.match(/Timestamp:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export function isTimestampFresh(
  timestampMs: number,
  nowMs: number,
  maxSkewMs: number = SIGNATURE_MAX_SKEW_MS,
): boolean {
  return Math.abs(nowMs - timestampMs) <= maxSkewMs;
}
