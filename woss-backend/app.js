// woss-backend/app.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { corsOptions } = require("./config/db");
const verifyToken = require("./middleware/verifyToken");
const {
  ensureDirs,
  UPLOADS_DIR,
  TEMP_DIR,
  EXPORTS_DIR,
  ROYALTIES_DIR,
} = require("./paths");

const app = express();
const isVercel = process.env.VERCEL === "1";

/* ---------- Ensure local folders (skip on Vercel; /tmp already exists) ---------- */
if (!isVercel) ensureDirs();

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

/* ---------- Static (exports/uploads/temp) ---------- */
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

// optional public next to API (local use)
app.use(express.static(path.join(__dirname, "../public")));

// images inside repo (read-only, fine on Vercel)
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

/* static exports (open) */
app.use("/api/withdrawals/exports", express.static(EXPORTS_DIR));
app.use("/api/royalties/exports", express.static(ROYALTIES_DIR));

/* ---------- Health ---------- */
app.get("/api/health", (req, res) =>
  res.json({ ok: true, uptime: process.uptime(), node: process.version })
);

/* ---------- 404 / Error handlers ---------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Not Found" });
  }
  return next();
});
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || "Server Error" });
});

/* ---------- Local dev listener ---------- */
if (!isVercel && process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}
module.exports = app;
