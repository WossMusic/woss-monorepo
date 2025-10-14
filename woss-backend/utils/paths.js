// woss-backend/utils/paths.js
const path = require("path");
const fs = require("fs");

// Writable root: /tmp on Vercel, repo folder locally (override with UPLOAD_DIR)
const WRITABLE_ROOT =
  process.env.UPLOAD_DIR || (process.env.VERCEL ? "/tmp" : path.join(__dirname, ".."));

const UPLOADS_DIR   = path.join(WRITABLE_ROOT, "uploads");
const TEMP_DIR      = path.join(WRITABLE_ROOT, "temp");
const EXPORTS_DIR   = path.join(WRITABLE_ROOT, "exports");
const ROYALTIES_DIR = path.join(EXPORTS_DIR, "royalties");

function ensureDirs() {
  [UPLOADS_DIR, TEMP_DIR, EXPORTS_DIR, ROYALTIES_DIR].forEach((p) => {
    try { fs.mkdirSync(p, { recursive: true }); } catch {}
  });
}

module.exports = {
  WRITABLE_ROOT,
  UPLOADS_DIR,
  TEMP_DIR,
  EXPORTS_DIR,
  ROYALTIES_DIR,
  ensureDirs,
};
