const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  loadDailyClaimStates,
  saveDailyClaimStates,
} = require("../dist/dailyClaimStore.js");

test("missing daily claim file starts with an empty store", () => {
  const missingFile = path.join(os.tmpdir(), `fire-bank-missing-${Date.now()}.json`);

  assert.deepEqual(loadDailyClaimStates(missingFile), new Map());
});

test("daily claim states survive a save and reload", (context) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fire-bank-daily-"));
  context.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));
  const claimFile = path.join(tempDirectory, "daily_claims.json");
  const claimStates = new Map([
    ["user-1", { lastClaimAt: 1_000_000, streak: 4 }],
    ["user-2", { lastClaimAt: 2_000_000, streak: 11 }],
  ]);

  saveDailyClaimStates(claimFile, claimStates);

  assert.deepEqual(loadDailyClaimStates(claimFile), claimStates);
});

test("malformed daily claim state is rejected", (context) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fire-bank-daily-"));
  context.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));
  const claimFile = path.join(tempDirectory, "daily_claims.json");
  fs.writeFileSync(claimFile, JSON.stringify({ "user-1": { streak: -3 } }));

  assert.throws(
    () => loadDailyClaimStates(claimFile),
    /Invalid daily claim store/,
  );
});
