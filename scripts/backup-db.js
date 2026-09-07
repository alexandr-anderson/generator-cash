#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const keepCount = Math.max(1, Number(process.env.BACKUP_KEEP) || 7);
const backupDir = path.join(rootDir, "backups");

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

function redact(text, password) {
  if (!password) return String(text || "");
  return String(text || "").split(password).join("***");
}

function findDumpBin() {
  if (process.env.MYSQLDUMP_BIN) return process.env.MYSQLDUMP_BIN;
  for (const name of ["mysqldump", "mariadb-dump"]) {
    const check = spawnSync(name, ["--version"], { encoding: "utf8", timeout: 8000 });
    if (!check.error && check.status === 0) return name;
  }
  return null;
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    "-",
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join("");
}

function rotateBackups() {
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith("postvmeste-") && /\.sql(\.gz)?$/.test(name))
    .map((name) => {
      const full = path.join(backupDir, name);
      return { full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  for (const extra of files.slice(keepCount)) {
    fs.rmSync(extra.full, { force: true });
  }
}

loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(rootDir, "app", ".env"));

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.log("==> backup-db: DATABASE_URL missing, skip");
  process.exit(0);
}
if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysqls://")) {
  console.log("==> backup-db: not a MySQL URL, skip");
  process.exit(0);
}

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  console.log("==> backup-db: DATABASE_URL is not a valid URL, skip");
  process.exit(0);
}

const user = decodeURIComponent(parsed.username || "");
const password = decodeURIComponent(parsed.password || "");
const host = parsed.hostname || "localhost";
const port = parsed.port || "3306";
const database = decodeURIComponent((parsed.pathname || "/").replace(/^\//, ""));

if (!user || !database) {
  console.log("==> backup-db: MySQL user or database name is empty, skip");
  process.exit(0);
}

const dumpBin = findDumpBin();
if (!dumpBin) {
  console.log("==> backup-db: mysqldump/mariadb-dump not found, skip");
  process.exit(0);
}

fs.mkdirSync(backupDir, { recursive: true });

const sqlPath = path.join(backupDir, `postvmeste-${stamp()}.sql`);
const cnfPath = path.join(rootDir, `.mysql-backup-${process.pid}.cnf`);
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

let outFd;
try {
  outFd = fs.openSync(sqlPath, "w", 0o600);
  const result = spawnSync(
    dumpBin,
    [
      `--defaults-extra-file=${cnfPath}`,
      "--single-transaction",
      "--quick",
      "--routines",
      "--triggers",
      "--no-tablespaces",
      "--set-charset",
      database,
    ],
    {
      stdio: ["ignore", outFd, "pipe"],
      encoding: "utf8",
      timeout: 120000,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(redact(result.stderr || result.stdout || "dump failed", password));
  }
} catch (caught) {
  if (outFd !== undefined) {
    try {
      fs.closeSync(outFd);
    } catch {
      /* ignore */
    }
    outFd = undefined;
  }
  fs.rmSync(sqlPath, { force: true });
  fs.rmSync(cnfPath, { force: true });
  console.log(`==> backup-db: ${caught instanceof Error ? caught.message : "dump failed"}`);
  process.exit(0);
} finally {
  if (outFd !== undefined) {
    try {
      fs.closeSync(outFd);
    } catch {
      /* ignore */
    }
  }
  fs.rmSync(cnfPath, { force: true });
}

const gzip = spawnSync("gzip", ["-f", sqlPath], { encoding: "utf8", timeout: 30000 });
const finalPath = gzip.error || gzip.status !== 0 ? sqlPath : `${sqlPath}.gz`;
if (gzip.error || gzip.status !== 0) {
  console.log("==> backup-db: gzip unavailable, kept uncompressed SQL");
}

rotateBackups();
console.log(`==> backup-db: ${path.basename(finalPath)}`);
