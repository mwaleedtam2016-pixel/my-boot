const assert = require("node:assert/strict");
const test = require("node:test");

test("Vercel routes root and favicon requests to the CommonJS health endpoint", async (context) => {
  const vercelConfig = require("../vercel.json");
  const healthSource = "api/health.js";

  assert.equal(vercelConfig.builds[0].src, healthSource);
  assert.equal(vercelConfig.routes[0].dest, healthSource);

  const routePattern = new RegExp(vercelConfig.routes[0].src);
  const healthHandler = require(`../${healthSource}`);

  for (const requestPath of ["/", "/favicon.ico"]) {
    await context.test(`${requestPath} returns the health response`, () => {
      assert.match(requestPath, routePattern);

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
