#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");

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

loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(rootDir, "app", ".env"));

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.log("==> apply-migrations: DATABASE_URL missing, skip");
  process.exit(0);
}
if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysqls://")) {
  console.log("==> apply-migrations: not a MySQL URL, skip");
  process.exit(0);
}

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  console.error("==> apply-migrations: DATABASE_URL is not a valid URL");
  process.exit(1);
}

const user = decodeURIComponent(parsed.username || "");
const password = decodeURIComponent(parsed.password || "");
const host = parsed.hostname || "localhost";
const port = parsed.port || "3306";
const database = decodeURIComponent((parsed.pathname || "/").replace(/^\//, ""));

if (!user || !database) {
  console.error("==> apply-migrations: MySQL user or database name is empty");
  process.exit(1);
}

const migrationsDir = path.join(rootDir, "prisma", "migrations");
if (!fs.existsSync(migrationsDir)) {
  console.log("==> apply-migrations: no prisma/migrations, skip");
  process.exit(0);
}

const mysqlBin = process.env.MYSQL_BIN || "mysql";

function runMysql(sql) {
  const cnfPath = path.join(
    rootDir,
    `.mysql-migrate-${process.pid}.cnf`,
  );
  fs.writeFileSync(
    cnfPath,
    [
      "[client]",
      `host=${host}`,
      `port=${port}`,
      `user=${user}`,
      `password=${JSON.stringify(password)}`,
      "default-character-set=utf8mb4",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  try {
    const result = spawnSync(
      mysqlBin,
      [
        `--defaults-extra-file=${cnfPath}`,
        "--connect-timeout=8",
        "--batch",
        "--raw",
        database,
      ],
      {
        input: sql,
        encoding: "utf8",
        timeout: 30000,
      },
    );
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const err = (result.stderr || result.stdout || "mysql failed").trim();
      throw new Error(err.replaceAll(password, "***"));
    }
    return result.stdout || "";
  } finally {
    fs.rmSync(cnfPath, { force: true });
  }
}

const folders = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (folders.length === 0) {
  console.log("==> apply-migrations: no migration folders, skip");
  process.exit(0);
}

runMysql(`
CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`checksum\` VARCHAR(64) NOT NULL,
  \`finished_at\` DATETIME(3) NULL,
  \`migration_name\` VARCHAR(255) NOT NULL,
  \`logs\` TEXT NULL,
  \`rolled_back_at\` DATETIME(3) NULL,
  \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`applied_steps_count\` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`);

const appliedOut = runMysql(
  "SELECT \`migration_name\` FROM \`_prisma_migrations\` WHERE \`rolled_back_at\` IS NULL;",
);
const applied = new Set(
  appliedOut
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "migration_name"),
);

let appliedCount = 0;
for (const name of folders) {
  if (applied.has(name)) continue;
  const sqlPath = path.join(migrationsDir, name, "migration.sql");
  if (!fs.existsSync(sqlPath)) continue;
  const sql = fs.readFileSync(sqlPath, "utf8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");
  const id = crypto.randomUUID();
  console.log(`==> apply-migrations: ${name}`);
  runMysql(sql);
  runMysql(`
    INSERT INTO \`_prisma_migrations\` (\`id\`, \`checksum\`, \`finished_at\`, \`migration_name\`, \`applied_steps_count\`)
    VALUES ('${id}', '${checksum}', CURRENT_TIMESTAMP(3), '${name}', 1);
  `);
  appliedCount += 1;
}

if (appliedCount === 0) {
  console.log("==> apply-migrations: already up to date");
} else {
  console.log(`==> apply-migrations: applied ${appliedCount}`);
}
