module.exports = function healthEndpoint(_request, response) {
  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Fire Bank Bot is online!");
};
