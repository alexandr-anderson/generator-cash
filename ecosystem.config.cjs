const appName = process.env.APP_NAME || "postvmeste";
const appPort = Number(process.env.APP_PORT || 3001);

module.exports = {
  apps: [
    {
      name: appName,
      cwd: `${__dirname}/app`,
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 3,
      min_uptime: "10s",
      watch: false,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: appPort,
        HOSTNAME: "127.0.0.1",
        NEXT_TELEMETRY_DISABLED: "1",
        UV_THREADPOOL_SIZE: "2",
        NODE_OPTIONS: "--max-old-space-size=192",
      },
    },
  ],
};
