const express = require("express");
const router = express.Router();
const { websiteConfig } = require("../config/db");

const trim = (s) => String(s || "").trim();
const stripTrailing = (s) => trim(s).replace(/\/+$/, "");

/**
 * Build absolute base URL for the API:
 * 1) Prefer PUBLIC_API_BASE env (e.g. https://api-woss.vercel.app)
 * 2) Otherwise derive from incoming request (works on Vercel)
 */
function resolveApiBase(req) {
  const envBase = stripTrailing(process.env.PUBLIC_API_BASE || "");
  if (envBase) return envBase;

  // Derive from request
  const proto =
    (req.headers["x-forwarded-proto"] || "").split(",")[0] ||
    (req.secure ? "https" : "http");

  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  return `${proto}://${host}`;
}

// GET /api/website/config
router.get("/config", (req, res) => {
  const domain = resolveApiBase(req);
  const payload = {
    success: true,
    config: {
      ...websiteConfig,
      domain, // ensure frontend receives correct absolute base
    },
  };
  res.json(payload);
});

module.exports = router;
