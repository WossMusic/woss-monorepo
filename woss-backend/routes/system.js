const express = require("express");
const router = express.Router();
const { execute } = require("../config/db");

async function ensureKvTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS system_kv (
      k VARCHAR(191) NOT NULL PRIMARY KEY,
      v LONGTEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
function normalizePages(input) {
  const out = {};
  if (input && typeof input === "object") {
    for (const [k, v] of Object.entries(input)) {
      const key = String(k || "").trim().toLowerCase();
      if (!key) continue;
      out[key] = !!v;
    }
  }
  return out;
}

router.get("/maintenance-pages", async (_req, res) => {
  try {
    await ensureKvTable();
    const [[row]] = await execute(
      "SELECT v FROM system_kv WHERE k='maintenance_pages' LIMIT 1"
    );
    let pages = {};
    if (row?.v) {
      try { pages = normalizePages(JSON.parse(row.v)); } catch {}
    }
    res.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
    return res.json({ success: true, pages });
  } catch (e) {
    console.error("GET /api/system/maintenance-pages error:", e);
    return res.status(500).json({ success: false, message: "Failed to load maintenance map" });
  }
});

module.exports = router;
