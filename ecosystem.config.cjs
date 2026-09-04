const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const rootDir = __dirname;
const rootEnvFile = path.join(rootDir, ".env");
const appEnvFile = path.join(rootDir, "app", ".env");
loadEnvFile(rootEnvFile);
loadEnvFile(appEnvFile);

console.info(
  "[pm2-env]",
  `rootEnv=${fs.existsSync(rootEnvFile) ? "yes" : "no"}`,
  `appEnv=${fs.existsSync(appEnvFile) ? "yes" : "no"}`,
  `mail=${(process.env.RESEND_API_KEY || "").startsWith("re_") ? "ok" : "MISSING_RESEND_API_KEY"}`,
  `db=${process.env.DATABASE_URL ? "set" : "MISSING_DATABASE_URL"}`,
);

const appName = process.env.APP_NAME || "postvmeste";
const appPort = Number(process.env.APP_PORT || 3001);

module.exports = {
  apps: [
    {
      name: appName,
      cwd: `${rootDir}/app`,
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
        DATABASE_URL: process.env.DATABASE_URL || "",
        SESSION_SECRET: process.env.SESSION_SECRET || "",
        APP_URL: process.env.APP_URL || "https://postvmeste.ru",
        MAIL_FROM: process.env.MAIL_FROM || "postvmeste <service@postvmeste.ru>",
        RESEND_API_KEY: process.env.RESEND_API_KEY || "",
      },
    },
  ],
};
