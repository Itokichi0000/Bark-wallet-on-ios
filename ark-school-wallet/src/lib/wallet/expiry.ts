import type { VtxoView } from './types';

/** Average Bitcoin block interval, used ONLY for a rough reference estimate. */
export const AVG_BLOCK_MINUTES = 10;

/**
 * Fallback "review soon" threshold in blocks, used only when neither the Ark
 * server's VTXO lifetime nor Bark's refresh threshold is known (demo / error).
 * This is a user-facing nudge, NOT a safety line (spec 7.2).
 */
export const DEFAULT_REVIEW_THRESHOLD_BLOCKS = 288;

/** Share of the server's VTXO lifetime below which we suggest a review. */
export const REVIEW_LIFETIME_FRACTION = 0.25;

/**
 * "Review" threshold derived from server/wallet data instead of a fixed number:
 * the larger of Bark's own refresh threshold (Config.vtxoRefreshExpiryThreshold)
 * and 25% of the server's VTXO lifetime (ArkInfo.vtxoLifetime).
 * Example: Second's Signet server (lifetime 144, Bark threshold 12) → 36 blocks.
 */
export function reviewThreshold(server: { vtxoLifetimeBlocks?: number; refreshThresholdBlocks?: number } | undefined): number {
  const bark = server?.refreshThresholdBlocks;
  const life = server?.vtxoLifetimeBlocks;
  if (life === undefined && bark === undefined) return DEFAULT_REVIEW_THRESHOLD_BLOCKS;
  return Math.max(bark ?? 0, life !== undefined ? Math.floor(life * REVIEW_LIFETIME_FRACTION) : 0);
}

/** blocksRemaining = expiryHeight - tipHeight. Only when BOTH are known (T11). Can be negative. */
export function blocksRemaining(expiryHeight: number | undefined, tipHeight: number | undefined): number | undefined {
  if (expiryHeight === undefined || tipHeight === undefined) return undefined;
  if (!Number.isInteger(expiryHeight) || !Number.isInteger(tipHeight)) return undefined;
  return expiryHeight - tipHeight;
}

/** Reference-only time estimate in hours. Real block intervals vary. */
export function approxHours(blocks: number | undefined): number | undefined {
  if (blocks === undefined) return undefined;
  return (blocks * AVG_BLOCK_MINUTES) / 60;
}

export type RiskLevel = 'no-data' | 'healthy' | 'review' | 'action-needed' | 'expired-or-exited';

export interface RiskInput {
  vtxo: Pick<VtxoView, 'state' | 'expiryHeight' | 'exitDepth'>;
  tipHeight?: number;
  reviewThresholdBlocks?: number;
  maxExitDepth?: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  blocksRemaining?: number;
  reasons: RiskReason[];
}

export type RiskReason =
  | 'state-unknown'
  | 'tip-unknown'
  | 'expiry-unknown'
  | 'sdk-needs-refresh'
  | 'expired'
  | 'exited'
  | 'spent'
  | 'near-expiry'
  | 'near-max-exit-depth'
  | 'pending'
  | 'locked';

/**
 * Spec 7.2 risk ladder. Order matters:
 *  1. terminal states (spent/exited) and passed expiry
 *  2. the SDK's own needs-refresh verdict
 *  3. no data
 *  4. our educational review threshold
 *  5. healthy
 */
export function assessRisk({ vtxo, tipHeight, reviewThresholdBlocks, maxExitDepth }: RiskInput): RiskAssessment {
  const remaining = blocksRemaining(vtxo.expiryHeight, tipHeight);
  const reasons: RiskReason[] = [];
  const threshold = reviewThresholdBlocks ?? DEFAULT_REVIEW_THRESHOLD_BLOCKS;

  if (vtxo.state === 'exited') return { level: 'expired-or-exited', blocksRemaining: remaining, reasons: ['exited'] };
  if (vtxo.state === 'spent') return { level: 'expired-or-exited', blocksRemaining: remaining, reasons: ['spent'] };
  if (remaining !== undefined && remaining <= 0) {
    return { level: 'expired-or-exited', blocksRemaining: remaining, reasons: ['expired'] };
  }
  if (vtxo.state === 'needs-refresh') {
    return { level: 'action-needed', blocksRemaining: remaining, reasons: ['sdk-needs-refresh'] };
  }
  if (vtxo.state === 'unknown') reasons.push('state-unknown');
  if (tipHeight === undefined) reasons.push('tip-unknown');
  if (vtxo.expiryHeight === undefined) reasons.push('expiry-unknown');
  if (remaining === undefined || vtxo.state === 'unknown') return { level: 'no-data', blocksRemaining: remaining, reasons };

  if (remaining <= threshold) reasons.push('near-expiry');
  if (maxExitDepth !== undefined && vtxo.exitDepth !== undefined && vtxo.exitDepth >= maxExitDepth - 1) {
    reasons.push('near-max-exit-depth');
  }
  if (vtxo.state === 'pending') reasons.push('pending');
  if (vtxo.state === 'locked') reasons.push('locked');
  const review = reasons.some((r) => r === 'near-expiry' || r === 'near-max-exit-depth' || r === 'pending' || r === 'locked');
  return { level: review ? 'review' : 'healthy', blocksRemaining: remaining, reasons };
}
