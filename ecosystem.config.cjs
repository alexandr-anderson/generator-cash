const appName = process.env.APP_NAME || "postvmeste";
const appPort = Number(process.env.APP_PORT || 3000);

module.exports = {
  apps: [
    {
      name: appName,
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${appPort}`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: appPort,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
