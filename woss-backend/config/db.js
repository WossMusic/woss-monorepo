// woss-backend/config/db.js
const mysql = require("mysql2/promise");

/* ---------------- helpers ---------------- */
const toInt = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const trim = (s) => String(s || "").trim();

/**
 * Build final DB config:
 * - Prefer explicit DB_* envs you set in Vercel
 * - Fall back to MYSQL_PUBLIC_URL if present
 * - Force TLS for public proxy (rlwy.net) unless explicitly disabled
 */
function buildConfig() {
  let fromUrl = null;
  const URL_STR = trim(
    process.env.MYSQL_PUBLIC_URL ||
      process.env.DATABASE_URL ||
      process.env.MYSQL_URL ||
      ""
  );

  if (URL_STR) {
    try {
      const u = new URL(URL_STR);
      fromUrl = {
        host: u.hostname,
        port: toInt(u.port, 3306),
        user: decodeURIComponent(u.username || "root"),
        password: decodeURIComponent(u.password || ""),
        database: (u.pathname || "/").replace(/^\//, "") || "woss_portal",
      };
    } catch {
      // ignore parse errors; we'll rely on explicit envs
    }
  }

  // Accept both DB_PASSWORD and legacy DB_PASS
  const DB_PASSWORD = trim(process.env.DB_PASSWORD || process.env.DB_PASS || "");

  const host = trim(process.env.DB_HOST || fromUrl?.host || "127.0.0.1");
  const port = toInt(process.env.DB_PORT || fromUrl?.port || 3306, 3306);
  const user = trim(process.env.DB_USER || fromUrl?.user || "root");
  const password = DB_PASSWORD || fromUrl?.password || "";
  const database = trim(process.env.DB_NAME || fromUrl?.database || "woss_portal");

  // Decide SSL:
  // - force on for public Railway proxy (rlwy.net) unless DB_SSL=false
  // - or DB_SSL=true explicitly enables it
  const dbSslEnv = String(process.env.DB_SSL || "").toLowerCase();
  const looksLikeRailwayProxy = /\.rlwy\.net$/.test(host) || /proxy\.railway\.net$/.test(host);
  const wantSSL = dbSslEnv === "true" || (dbSslEnv !== "false" && looksLikeRailwayProxy);

  const cfg = {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: toInt(process.env.DB_POOL_SIZE, 8),
    queueLimit: 0,
    connectTimeout: toInt(process.env.DB_CONNECT_TIMEOUT_MS, 15000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };

  if (wantSSL) {
    // Loosened CA check because Railway public proxy doesn’t ship a CA bundle
    cfg.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: false };
  }

  return cfg;
}

/* ---------------- singleton pool (Vercel-friendly) ---------------- */
let pool;
function getPool() {
  if (!pool) {
    const cfg = buildConfig();
    pool = mysql.createPool(cfg);
    // small log to confirm which host we connected to (shows in Vercel logs)
    console.log(
      `[db] pool created -> ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} ssl=${!!cfg.ssl}`
    );
  }
  return pool;
}

// tiny wrapper to match your call sites
async function execute(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return [rows];
}

/* ---------------- site config + CORS allowlist ---------------- */
const allowedFrontends = String(process.env.ALLOWED_FRONTENDS || "")
  .split(",")
  .map((s) => trim(s))
  .filter(Boolean);

if (allowedFrontends.length === 0) {
  allowedFrontends.push(
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173"
  );
}

const websiteConfig = {
  name: process.env.SITE_NAME || "Woss Music",
  // filled in routes/website from request host; default to your prod frontend:
  domain: process.env.SITE_DOMAIN || "https://frontend-woss.vercel.app",
  frontends: allowedFrontends,
};

// Same CORS helper you already had
function isAllowedOrigin(origin, allowlist) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.host;
    const full = `${url.protocol}//${url.host}`;
    return allowlist.some((entry) => {
      if (entry === full) return true;
      if (entry.startsWith("*.")) {
        const suffix = entry.slice(1);
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

/* ---------------- exports ---------------- */
module.exports = {
  // expose pool so code like `.pool.getConnection()` continues working
  pool: getPool(),
  getPool,
  execute,
  websiteConfig,
  corsOptions,
};
