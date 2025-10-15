const mysql = require("mysql2/promise");

/* ===================== Helpers ===================== */
function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

const trim = (s) => String(s || "").trim();
const stripTrailing = (s) => trim(s).replace(/\/+$/, "");

/* ===================== Singleton Pool (Vercel-friendly) ===================== */
let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "crossover.proxy.rlwy.net",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "aVUJWKwCStnJlRgbGTMRZdSvzuwbLqqn",
      database: process.env.DB_NAME || "woss_portal",
      port: toInt(process.env.DB_PORT, 27176),
      waitForConnections: true,
      connectionLimit: toInt(process.env.DB_POOL_SIZE, 10),
      queueLimit: 0,
      connectTimeout: toInt(process.env.DB_CONNECT_TIMEOUT_MS, 15000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // Relax unless a CA bundle is provided
      ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

/* ===================== Site / Frontend allowlist ===================== */
const allowedFrontends = String(process.env.ALLOWED_FRONTENDS || "")
  .split(",")
  .map((s) => trim(s))
  .filter(Boolean);

if (allowedFrontends.length === 0) {
  // Safe locals for dev
  allowedFrontends.push(
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173"
  );
}

// site name only; domain will be resolved per-request in routes/website.js
const websiteConfig = {
  name: process.env.SITE_NAME || "Woss Music",
  domain: "", // filled dynamically in /api/website/config
  frontends: allowedFrontends,
};

/* ===================== CORS (exact match + wildcard support) ===================== */
/**
 * Wildcard matching: allow entries like *.vercel.app
 */
function isAllowedOrigin(origin, allowlist) {
  if (!origin) return true; // server-to-server / same-origin
  try {
    const url = new URL(origin);
    const host = url.host; // e.g. frontend-woss.vercel.app
    const full = `${url.protocol}//${url.host}`;

    return allowlist.some((entry) => {
      // exact
      if (entry === full) return true;

      // wildcard like *.vercel.app (matches sub.example)
      if (entry.startsWith("*.")) {
        const suffix = entry.slice(1); // ".vercel.app"
        return host.endsWith(suffix);
      }
      return false;
    });
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, cb) {
    if (isAllowedOrigin(origin, allowedFrontends)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin || "<no-origin>"}`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

/* ===================== Exports ===================== */
module.exports = {
  getPool,
  execute: (...args) => getPool().execute(...args),
  websiteConfig,
  corsOptions,
};
