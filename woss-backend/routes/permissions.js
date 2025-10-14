// routes/permissions.js
const express = require("express");
const router = express.Router();
const { execute } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

const ADMIN_ROLES = new Set(["admin", "super admin"]);
const norm = (s) => String(s || "").trim().toLowerCase();

/** Canonicalize permission keys (and handle legacy aliases) */
const canonKey = (raw) => {
  const k = String(raw || "").trim().toLowerCase();
  const ks = k.replace(/^splits\./, "split."); // old "splits.*" → "split.*"
  if (/^release\.(request_?edit|edit(?:_update)?)$/.test(ks)) return "release.edit_update";
  return ks;
};

async function getRole(userId) {
  const [[u]] = await execute("SELECT role FROM users WHERE id = ?", [userId]);
  return String(u?.role || "");
}

/** Expand a canonical key into the set of DB keys to look for */
function expandAliasesForQuery(k) {
  if (k === "release.edit_update") {
    return ["release.edit_update", "release.edit", "release.request_edit"];
  }
  return [k];
}

/** Batch fetch DB overrides; Map<canonicalKey, boolean|null> (null = no row) */
async function getDbPerms(userId, keys) {
  if (!userId || !Array.isArray(keys) || keys.length === 0) return new Map();

  const canonicalKeys = keys.map(canonKey);
  const placeholdersKeys = Array.from(
    new Set(canonicalKeys.flatMap(expandAliasesForQuery))
  );

  const placeholders = placeholdersKeys.map(() => "?").join(",");

  let rows;
  try {
    // New schema
    [rows] = await execute(
      `SELECT perm_key AS k, perm_value AS v
         FROM user_permissions
        WHERE user_id = ? AND perm_key IN (${placeholders})`,
      [userId, ...placeholdersKeys]
    );
  } catch {
    // Legacy fallback
    [rows] = await execute(
      `SELECT permission_key AS k, allowed AS v
         FROM user_permissions
        WHERE user_id = ? AND permission_key IN (${placeholders})`,
      [userId, ...placeholdersKeys]
    );
  }

  const map = new Map();
  // init (canonical) to null
  for (const k of canonicalKeys) map.set(k, null);

  for (const r of rows || []) {
    const canon = canonKey(String(r.k || "").trim());
    const v = r.v === null || r.v === undefined ? null : !!Number(r.v);
    const cur = map.get(canon);
    if (v === true) map.set(canon, true);
    else if (v === false && cur !== true) map.set(canon, false);
  }

  // DEBUG
  try {
    console.log("[permissions/me] DB rows", {
      userId,
      schema: rows?.length && rows[0]?.k ? "perm_key/perm_value" : "legacy",
      rows,
    });
  } catch {}

  return map;
}

/** Role defaults aligned with AdminPanel */
const ARTIST_DISTRIBUTOR_DEFAULTS = new Set([
  "release.create",
  "release.edit_update",   // unified
  "release.add_comment",
  "release.distribute",
  "track.create",
  "track.edit",
  "track.delete",
  "split.view",
  "split.create",
  "split.delete",
]);

const ROYALTY_SHARE_DEFAULTS = new Set([
  "split.view",
]);

function roleDefault(role, kRaw) {
  const r = norm(role);
  const k = canonKey(kRaw);

  if (ADMIN_ROLES.has(r)) return true;                  // admins allow everything by default
  if (k.startsWith("notifications.")) return true;      // notifications default ON for all

  switch (r) {
    case "artist/manager":
    case "distributor":
      return ARTIST_DISTRIBUTOR_DEFAULTS.has(k);
    case "royalty share":
      return ROYALTY_SHARE_DEFAULTS.has(k);
    default:
      return false;
  }
}

/** Parse keys from query (?keys=a,b or ?keys=a&keys=b) */
function parseKeys(req) {
  const q = req.query.keys;
  let list = [];
  if (Array.isArray(q)) {
    q.forEach((v) => {
      if (typeof v === "string" && v.length) list.push(...v.split(","));
    });
  } else if (typeof q === "string" && q.length) {
    list = q.split(",");
  }

  // default set if none provided (back-compat)
  if (!list.length) {
    list = [
      "split.view", "split.create", "split.edit", "split.delete",
      "splits.view", "splits.create", "splits.edit", "splits.delete",
    ];
  }

  // normalize, dedupe, drop empties, and cap size for safety
  return Array.from(
    new Set(list.map((s) => canonKey(String(s).trim())).filter(Boolean))
  ).slice(0, 200);
}

/** GET /api/permissions/me?keys=split.view,splits.view,release.edit_update,... */
router.get("/me", verifyToken, async (req, res) => {
  const started = Date.now();
  try {
    const uid = req.user?.id ?? req.user?.userId;
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const role = await getRole(uid);
    const keys = parseKeys(req);
    if (keys.length === 0) return res.json({ success: true, role, permissions: {} });

    const dbMap = await getDbPerms(uid, keys);

    // rebuild original query list (preserve exact forms for response keys)
    const originalKeys = [];
    const q = req.query.keys;
    if (Array.isArray(q)) {
      q.forEach((v) => v.split(",").forEach((x) => originalKeys.push(String(x).trim())));
    } else if (typeof q === "string") {
      originalKeys.push(...q.split(",").map((x) => String(x).trim()));
    } else {
      originalKeys.push(
        "split.view", "split.create", "split.edit", "split.delete",
        "splits.view", "splits.create", "splits.edit", "splits.delete"
      );
    }

    const out = {};
    const dbResolved = {};
    const canonicalQueried = [];
    for (const original of originalKeys) {
      if (!original) continue;
      const k = canonKey(original);           // canonical
      canonicalQueried.push(k);

      const db = dbMap.get(k);                // boolean | null
      dbResolved[k] = db === null ? null : !!db;

      // start from role default if no DB row, otherwise DB value
      let allowed = db === null ? roleDefault(role, k) : !!db;

      // ——— “Minimum access floor” to avoid onboarding dead-ends ———
      // Royalty Share should NEVER lose Splits visibility.
      if (k === "split.view" && norm(role) === "royalty share" && allowed === false) {
        console.warn(
          "[permissions/me] FLOOR APPLIED: forcing split.view=true for Royalty Share",
          { userId: uid, role, originalKey: original, canonical: k }
        );
        allowed = true;
      }

      out[original] = !!allowed;              // return under exact original key
    }

    const payload = {
      success: true,
      role,
      permissions: out,
    };

    // DEBUG block to mirror what you printed earlier
    try {
      console.log("[permissions/me]", {
        userId: uid,
        role,
        requestedOriginal: originalKeys,
        canonicalQueried,
        dbResolved,
        final: out,
        ms: Date.now() - started,
        ts: new Date().toISOString(),
      });
    } catch {}

    return res.json(payload);
  } catch (e) {
    console.error("permissions/me error:", e);
    return res.status(500).json({ success: false, message: "Failed to compute permissions" });
  }
});

module.exports = router;
