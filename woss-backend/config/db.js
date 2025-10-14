const mysql = require("mysql2/promise");

/* ===================== Helpers ===================== */
function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

/* ===================== Singleton Pool (Vercel-friendly) ===================== */
let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "woss_portal",
      port: toInt(process.env.DB_PORT, 3306),
      waitForConnections: true,
      connectionLimit: toInt(process.env.DB_POOL_SIZE, 10),
      queueLimit: 0,
      connectTimeout: toInt(process.env.DB_CONNECT_TIMEOUT_MS, 15000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // Often required on hosted MySQLs; relax unless you load a CA
      ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false }
    });
  }
  return pool;
}

/* ===================== Site / API config ===================== */
const DEFAULT_API_DOMAIN = process.env.API_DOMAIN || "http://localhost:4000";
const allowedFrontends = String(process.env.ALLOWED_FRONTENDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
if (allowedFrontends.length === 0) {
  allowedFrontends.push("http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173");
}

const websiteConfig = {
  name: process.env.SITE_NAME || "Woss Music",
  domain: DEFAULT_API_DOMAIN.replace(/\/$/, ""),
  frontends: allowedFrontends,
  frontendOrigin:
    (process.env.FRONTEND_ORIGIN && process.env.FRONTEND_ORIGIN.replace(/\/$/, "")) ||
    allowedFrontends[0],
};

/* ===================== Shared CORS options ===================== */
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || websiteConfig.frontends.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

/* ===================== Exports ===================== */
module.exports = {
  getPool,
  execute: (...args) => getPool().execute(...args),
  websiteConfig,
  corsOptions,
};
