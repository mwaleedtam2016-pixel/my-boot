import fs from "fs";
import { type DailyClaimState } from "./dailyReward";

export function loadDailyClaimStates(filePath: string): Map<string, DailyClaimState> {
  if (!fs.existsSync(filePath)) return new Map();

  const parsedClaims: unknown = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!isClaimRecord(parsedClaims)) {
    throw new Error(`Invalid daily claim store: ${filePath}`);
  }
  return new Map(Object.entries(parsedClaims));
}

export function saveDailyClaimStates(
  filePath: string,
  claimStates: Map<string, DailyClaimState>,
): void {
  const temporaryFile = `${filePath}.tmp`;
  const serializedClaims = JSON.stringify(Object.fromEntries(claimStates), null, 2);
  fs.writeFileSync(temporaryFile, serializedClaims, "utf-8");
  fs.renameSync(temporaryFile, filePath);
}

function isClaimRecord(candidate: unknown): candidate is Record<string, DailyClaimState> {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return false;
  }
  return Object.values(candidate).every(isDailyClaimState);
}

function isDailyClaimState(candidate: unknown): candidate is DailyClaimState {
  if (candidate === null || typeof candidate !== "object") return false;
  const claimState = candidate as Record<string, unknown>;
  const lastClaimAt = claimState.lastClaimAt;
  const streak = claimState.streak;
  return typeof lastClaimAt === "number" && Number.isFinite(lastClaimAt) &&
    lastClaimAt >= 0 && Number.isInteger(lastClaimAt) &&
    typeof streak === "number" && Number.isInteger(streak) && streak > 0;
}
