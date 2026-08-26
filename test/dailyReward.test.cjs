const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DAILY_CLAIM_INTERVAL_MS,
  DAILY_STREAK_WINDOW_MS,
  calculateDailyClaim,
} = require("../dist/dailyReward.js");

test("first daily claim starts a streak with the base reward", () => {
  const claim = calculateDailyClaim({}, 1_000_000);

  assert.deepEqual(claim, {
    eligible: true,
    reward: 10_000,
    streak: 1,
  });
});

test("daily claim timing boundaries enforce cooldown and streak rules", async (context) => {
  const lastClaimAt = 1_000_000;
  const scenarios = [
    {
      name: "just before 24 hours is rejected",
      state: { lastClaimAt, streak: 1 },
      claimedAt: lastClaimAt + DAILY_CLAIM_INTERVAL_MS - 1,
      expected: { eligible: false, remainingMs: 1 },
    },
    {
      name: "exactly 24 hours continues the streak",
      state: { lastClaimAt, streak: 1 },
      claimedAt: lastClaimAt + DAILY_CLAIM_INTERVAL_MS,
      expected: { eligible: true, reward: 12_000, streak: 2 },
    },
    {
      name: "exactly 48 hours continues the streak",
      state: { lastClaimAt, streak: 4 },
      claimedAt: lastClaimAt + DAILY_STREAK_WINDOW_MS,
      expected: { eligible: true, reward: 18_000, streak: 5 },
    },
    {
      name: "after 48 hours resets the streak",
      state: { lastClaimAt, streak: 9 },
      claimedAt: lastClaimAt + DAILY_STREAK_WINDOW_MS + 1,
      expected: { eligible: true, reward: 10_000, streak: 1 },
    },
  ];

  for (const scenario of scenarios) {
    await context.test(scenario.name, () => {
      const claim = calculateDailyClaim(scenario.state, scenario.claimedAt);
      assert.deepEqual(claim, scenario.expected);
    });
  }
});

test("daily reward stays capped at 30,000 dollars", () => {
  const lastClaimAt = 1_000_000;
  const claim = calculateDailyClaim(
    { lastClaimAt, streak: 20 },
    lastClaimAt + DAILY_CLAIM_INTERVAL_MS,
  );

  assert.deepEqual(claim, {
    eligible: true,
    reward: 30_000,
    streak: 21,
  });
});
