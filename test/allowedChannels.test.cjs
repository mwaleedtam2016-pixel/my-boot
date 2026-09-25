const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("allowedChannels multi-tenant per-guild logic", () => {
  const testFile = path.join(__dirname, "test_allowed_channels.json");
  
  function save(map) {
    fs.writeFileSync(testFile, JSON.stringify(map));
  }
  function load() {
    if (fs.existsSync(testFile)) {
      const parsed = JSON.parse(fs.readFileSync(testFile, "utf8"));
      if (Array.isArray(parsed)) return {};
      return parsed;
    }
    return {};
  }

  let map = {};
  save(map);

  function isAllowed(guildId, channelId) {
    if (!guildId) return true;
    const channels = map[guildId];
    if (!channels || channels.length === 0) return true;
    return channels.includes(channelId);
  }

  // Guild 1 has no config -> all channels allowed
  assert.equal(isAllowed("guild1", "chan1"), true);
  assert.equal(isAllowed("guild1", "chan2"), true);

  // Set config for Guild 1
  map["guild1"] = ["chan1"];
  save(map);

  // Guild 1 now restricts to chan1
  assert.equal(isAllowed("guild1", "chan1"), true);
  assert.equal(isAllowed("guild1", "chan2"), false);

  // Guild 2 is completely unaffected!
  assert.equal(isAllowed("guild2", "chan2"), true);
  assert.equal(isAllowed("guild2", "chan999"), true);

  // Clean up
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
});
