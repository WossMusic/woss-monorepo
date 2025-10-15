// woss-backend/app.js
require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const verifyToken = require("./middleware/verifyToken");

// config/db exports both corsOptions (if you still want it) and websiteConfig
const { websiteConfig } = require("./config/db");

const {
  ensureDirs,
  UPLOADS_DIR,
  TEMP_DIR,
  EXPORTS_DIR,
  ROYALTIES_DIR,
} = require("./utils/paths");

const app = express();
const isVercel = process.env.VERCEL === "1";

/* ----------------------------------------
   0) Local writable folders (skip on Vercel)
----------------------------------------- */
if (!isVercel) ensureDirs();

/* ----------------------------------------
   1) Hardening + parsers
----------------------------------------- */
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.json({ limit: "250mb" }));
app.use(express.urlencoded({ extended: true, limit: "250mb" }));

/* ----------------------------------------
   2) GLOBAL CORS (works for 200/404/500 + preflights)
      Uses websiteConfig.frontends as the allow-list
----------------------------------------- */
function isAllowedOrigin(origin) {
  try {
    if (!origin) return false;
    const list = Array.isArray(websiteConfig?.frontends)
      ? websiteConfig.frontends
      : [];
    return list.includes(origin);
  } catch {
    return false;
  }
}

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* ----------------------------------------
   3) Root + favicon (reduce noise)
----------------------------------------- */
app.get("/", (_req, res) => {
  res
    .type("text/plain")
    .send("Woss API • OK\nTry: /api/health  /api/website/config  /website/config");
});
app.get("/favicon.ico", (_req, res) => res.sendStatus(204));

/* ----------------------------------------
   4) Static (read-only on Vercel; writable /tmp is handled by utils/paths)
----------------------------------------- */
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

// Optional local public folder (harmless on Vercel)
app.use(express.static(path.join(__dirname, "../public")));

// Images in repo (read-only)
app.use("/assets/images", express.static(path.join(__dirname, "src", "assets", "images")));

/* ----------------------------------------
   5) Open/guard wall for /api/*
   (health + website + exports are open)
----------------------------------------- */
app.use("/api", (req, res, next) => {
  const p = (req.path || "").toLowerCase();
  const isOpen =
    p.startsWith("/auth") ||
    p.startsWith("/website") ||
    p.startsWith("/health") ||
    p.startsWith("/withdrawals/exports") ||
    p.startsWith("/royalties/exports");

  if (isOpen) return next();
  return verifyToken(req, res, next);
});

/* ----------------------------------------
   6) Guarantee /api/website/config (and non-/api fallback)
----------------------------------------- */
// Explicit handler so nothing can shadow it
app.get("/api/website/config", (_req, res) => {
  res.json({ success: true, config: websiteConfig });
});

// Router mounts
app.use("/api/website", require("./routes/website"));
app.use("/website", require("./routes/website")); // fallback for legacy calls

/* ----------------------------------------
   7) Other API routes (order matters: keep specific first)
----------------------------------------- */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/user", require("./routes/user"));
app.use("/api/royalties", require("./routes/royalties"));
app.use("/api/splits", require("./routes/splits"));
app.use("/api/bankaccounts", require("./routes/bankaccounts"));
app.use("/api/rbac", require("./routes/rbac"));
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api/withdrawals", require("./routes/withdrawals"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/system", require("./routes/system"));

// ⬇️ IMPORTANT: don't mount this at "/api"
app.use("/api/distribute", require("./routes/distribute"));

/* ----------------------------------------
   8) Static exports (open)
----------------------------------------- */
app.use("/api/withdrawals/exports", express.static(EXPORTS_DIR));
app.use("/api/royalties/exports", express.static(ROYALTIES_DIR));

/* ----------------------------------------
   9) Health
----------------------------------------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), node: process.version });
});

/* ----------------------------------------
   10) 404 / Error handlers (leave CORS headers set already)
----------------------------------------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Not Found" });
  }
  return next();
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  // If someone threw an Error("Not Found") without a status, don't mask it as 500
  const status = err.status || (err.message === "Not Found" ? 404 : 500);
  res.status(status).json({ success: false, message: err.message || "Server Error" });
});

/* ----------------------------------------
   11) Local dev listener
----------------------------------------- */
if (!isVercel && process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

module.exports = app;
