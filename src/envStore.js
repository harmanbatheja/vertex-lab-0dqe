const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const CANDIDATES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.example",
];

function parseEnv(raw) {
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ key, value });
  }
  return entries;
}

function ensureDemoEnv() {
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) return envPath;
  const demo = [
    "# Demo secrets for EnvGuard — replace with your real values",
    "APP_NAME=EnvGuard",
    "DATABASE_URL=postgres://envguard:s3cret@localhost:5432/app",
    "API_KEY=eg_live_4f8c2a91b0d7e3c6",
    "SESSION_SECRET=change-me-before-production",
    "REDIS_URL=redis://127.0.0.1:6379/0",
    "",
  ].join("\n");
  fs.writeFileSync(envPath, demo, { mode: 0o600 });
  return envPath;
}

function listEnvFiles() {
  ensureDemoEnv();
  const found = [];
  for (const name of CANDIDATES) {
    const full = path.join(ROOT, name);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    const content = fs.readFileSync(full, "utf8");
    found.push({
      name,
      path: full,
      size: Buffer.byteLength(content, "utf8"),
      mtime: fs.statSync(full).mtime.toISOString(),
      entries: parseEnv(content),
      content,
    });
  }
  return found;
}

function getPrimaryEnv() {
  const files = listEnvFiles();
  return files.find((f) => f.name === ".env") || files[0] || null;
}

module.exports = { listEnvFiles, getPrimaryEnv, ensureDemoEnv, ROOT };
