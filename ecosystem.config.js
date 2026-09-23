module.exports = {
  apps: [
    {
      name: "fire-bank",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "src/main.ts",
      interpreter: "node",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
