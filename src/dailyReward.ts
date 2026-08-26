export const DAILY_CLAIM_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const DAILY_STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;

const DAILY_BASE_REWARD = 10_000;
const DAILY_STREAK_BONUS = 2_000;
const DAILY_MAX_REWARD = 30_000;

export interface DailyClaimState {
  lastClaimAt?: number;
  streak?: number;
}

export type DailyClaim =
  | { eligible: false; remainingMs: number }
  | { eligible: true; reward: number; streak: number };

export function calculateDailyClaim(
  claimState: DailyClaimState,
  claimedAt: number,
): DailyClaim {
  if (claimState.lastClaimAt !== undefined) {
    const elapsedMs = claimedAt - claimState.lastClaimAt;
    if (elapsedMs < DAILY_CLAIM_INTERVAL_MS) {
      return {
        eligible: false,
        remainingMs: DAILY_CLAIM_INTERVAL_MS - elapsedMs,
      };
    }

    if (elapsedMs <= DAILY_STREAK_WINDOW_MS) {
      return dailyRewardForStreak((claimState.streak ?? 0) + 1);
    }
  }

  return dailyRewardForStreak(1);
}

function dailyRewardForStreak(
  streak: number,
): Extract<DailyClaim, { eligible: true }> {
  const streakBonus = (streak - 1) * DAILY_STREAK_BONUS;
  return {
    eligible: true,
    reward: Math.min(DAILY_BASE_REWARD + streakBonus, DAILY_MAX_REWARD),
    streak,
  };
}
