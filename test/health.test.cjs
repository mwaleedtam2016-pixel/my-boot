const assert = require("node:assert/strict");
const test = require("node:test");

test("Vercel routes health requests to the CommonJS health endpoint", async (context) => {
  const vercelConfig = require("../vercel.json");
  const healthSource = "api/health.js";

  const healthRewrite = vercelConfig.rewrites.find((r) => r.source === "/api/health");
  assert.equal(healthRewrite?.destination, `/${healthSource}`);

  const healthHandler = require(`../${healthSource}`);

  for (const requestPath of ["/", "/favicon.ico", "/api/health"]) {
    await context.test(`${requestPath} returns the health response`, () => {
      let statusCode;
      let body = "";
      const response = {
        writeHead(code) {
          statusCode = code;
          return this;
        },
        end(chunk) {
          body += chunk ?? "";
          return this;
        },
      };

      healthHandler({ url: requestPath }, response);

      assert.equal(statusCode, 200);
      assert.equal(body, "Fire Bank Bot is online!");
    });
  }
});
