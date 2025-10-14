require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { corsOptions, execute } = require("./config/db");
const verifyToken = require("./middleware/verifyToken");
const {
  ensureDirs,
  UPLOADS_DIR,
  TEMP_DIR,
  EXPORTS_DIR,
  ROYALTIES_DIR,
} = require("./utils/paths");

const app = express();

/* ---------- Prepare writable folders (works on Vercel: /tmp) ---------- */
ensureDirs();

/* ---------- Basic hardening ---------- */
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cookieParser());

/* ---------- CORS ---------- */
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ---------- Parsers ---------- */
app.use(express.json({ limit: "250mb" }));
app.use(express.urlencoded({ extended: true, limit: "250mb" }));

/* ---------- Static (read-only bundle is OK for *serving*, not writing) ---------- */
// These now point to writable dirs (local project in dev, /tmp on Vercel)
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(
  "/temp",
  express.static(TEMP_DIR, {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".zip") || filePath.endsWith(".xlsx")) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${path.basename(filePath)}"`
        );
      }
    },
  })
);

// Optional: serve any public assets baked into the repo (read-only is fine)
app.use(express.static(path.join(__dirname, "../public")));
app.use("/assets/images", express.static(path.join(__dirname, "src", "assets", "images")));

/* ---------- Open/Guarded API wall ---------- */
app.use("/api", (req, res, next) => {
  const p = (req.path || "").toLowerCase();
  const isOpen =
    p.startsWith("/auth") ||
    p.startsWith("/website") ||
    p.startsWith("/withdrawals/exports") ||
    p.startsWith("/royalties/exports");
  if (isOpen) return next();
  return verifyToken(req, res, next);
});

/* ---------- Routes ---------- */
app.use("/api", require("./routes/distribute"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/website", require("./routes/website"));
app.use("/api/user", require("./routes/user"));
app.use("/api/royalties", require("./routes/royalties"));
app.use("/api/splits", require("./routes/splits"));
app.use("/api/bankaccounts", require("./routes/bankaccounts"));
app.use("/api/rbac", require("./routes/rbac"));
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api/withdrawals", require("./routes/withdrawals"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/system", require("./routes/system"));

/* ---------- Static exports (served from writable dirs) ---------- */
app.use("/api/withdrawals/exports", express.static(EXPORTS_DIR));
app.use("/api/royalties/exports", express.static(ROYALTIES_DIR));

/* ---------- Health ---------- */
app.get("/api/health", (req, res) =>
  res.json({ ok: true, uptime: process.uptime(), node: process.version })
);

/* ---------- Auto-distribute: on-demand (use Vercel Cron) ---------- */
async function runAutoDistribute() {
  const [result] = await execute(
    `UPDATE releases
       SET status = 'Distributed',
           distributed_at = IFNULL(distributed_at, NOW())
     WHERE UPPER(TRIM(status)) = 'APPROVED'
       AND (
             (product_release_date IS NOT NULL
              AND TIMESTAMP(product_release_date, '00:00:00') <= NOW())
          OR (approved_at IS NOT NULL
              AND approved_at <= NOW())
           )`
  );
  return result?.affectedRows || 0;
}

app.post("/api/system/auto-distribute", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers["x-cron-secret"] !== secret) {
      return res.status(401).json({ ok: false, message: "unauthorized" });
    }
    const updated = await runAutoDistribute();
    res.json({ ok: true, updated });
  } catch (err) {
    next(err);
  }
});

/* ---------- 404 / Error handlers ---------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ success: false, message: "Not Found" });
  return next();
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Server Error",
    });
  }
});

/* ---------- Local dev ---------- */
if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

module.exports = app;
