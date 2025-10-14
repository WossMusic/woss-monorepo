// middleware/requirePermission.js
const { execute } = require("../config/db");

const ADMIN_ROLES = new Set(["admin", "super admin"]);
const norm = (s) => String(s || "").trim().toLowerCase();

/** Canonicalize permission keys (and handle legacy aliases) */
const canonKey = (raw) => {
  const k = String(raw || "").trim().toLowerCase();

  // old "splits.*" → "split.*"
  const ks = k.replace(/^splits\./, "split.");

  // unify edit/update/request_edit → edit_update
  if (/^release\.(request_?edit|edit(?:_update)?)$/.test(ks)) return "release.edit_update";

  return ks;
};

// ---- schema autodetect (cached) ----
let PERM_SCHEMA = null; // { keyCol: string, valCol: string } | null

async function detectPermSchema() {
  if (PERM_SCHEMA !== null) return PERM_SCHEMA; // already known (or known-missing)
  try {
    const [cols] = await execute("SHOW COLUMNS FROM user_permissions");
    const names = new Set((cols || []).map((c) => String(c.Field)));

    const candidates = [
      { keyCol: "perm_key",       valCol: "perm_value" },
      { keyCol: "permission_key", valCol: "allowed"    },
      { keyCol: "`key`",          valCol: "`value`"    }, // reserved words
      { keyCol: "permission",     valCol: "allowed"    },
    ];

    for (const c of candidates) {
      const rawKey = c.keyCol.replace(/`/g, "");
      const rawVal = c.valCol.replace(/`/g, "");
      if (names.has(rawKey) && names.has(rawVal)) {
        PERM_SCHEMA = c;
        return PERM_SCHEMA;
      }
    }

    PERM_SCHEMA = null; // table exists but unknown layout
    return PERM_SCHEMA;
  } catch {
    PERM_SCHEMA = null; // table doesn't exist
    return PERM_SCHEMA;
  }
}

/* ---- DB helpers ---- */
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

// Batch fetch DB overrides for keys; returns Map<canonicalKey, boolean|null>
async function getDbPerms(userId, keys) {
  const out = new Map();
  if (!userId || !Array.isArray(keys) || keys.length === 0) return out;

  // default all keys to null (no override)
  const canonicalKeys = keys.map(canonKey);
  for (const k of canonicalKeys) out.set(k, null);

  const schema = await detectPermSchema();
  if (!schema) return out; // no table or unknown schema → no overrides

  // Include legacy aliases in the query
  const queryKeys = Array.from(new Set(canonicalKeys.flatMap(expandAliasesForQuery)));
  const placeholders = queryKeys.map(() => "?").join(",");
  const sql = `
    SELECT ${schema.keyCol} AS k, ${schema.valCol} AS v
      FROM user_permissions
     WHERE user_id = ? AND ${schema.keyCol} IN (${placeholders})
  `;

  try {
    const [rows] = await execute(sql, [userId, ...queryKeys]);
    for (const r of rows || []) {
      const rawKey = String(r.k || "").trim();
      const canon = canonKey(rawKey);
      const v =
        r.v === null || r.v === undefined
          ? null
          : typeof r.v === "boolean"
          ? r.v
          : !!Number(r.v);

      const cur = out.get(canon);
      if (v === true) out.set(canon, true);
      else if (v === false && cur !== true) out.set(canon, false);
      // ignore null
    }
  } catch {
    // fall back to role defaults
  }
  return out;
}

/* ---- Role defaults aligned with AdminPanel ---- */
const ARTIST_DISTRIBUTOR_DEFAULTS = new Set([
  "release.create",
  "release.edit_update",  // unified
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

function roleDefault(role, key) {
  const r = norm(role);
  const k = canonKey(key);

  if (ADMIN_ROLES.has(r)) return true;             // admins default allow all
  if (k.startsWith("notifications.")) return true; // notifications ON by default

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

/**
 * Safe "floor" allow:
 * - For Royalty Share:
 *   - Always allow `split.view`
 *   - Allow *read-only* views in Accounting / Analytics / Royalties areas
 *     (keys like `accounting.view`, `analytics.view`, `royalties.view`,
 *      or `accounting.*.view`, etc.)
 * - Never force-allow create/edit/delete keys
 */
function floorAllow(role, key) {
  const r = norm(role);
  const k = canonKey(key);

  if (r !== "royalty share") return null;

  if (k === "split.view") return true;

  // allow ".view" endpoints under these domains
  const isView = /\.view$/.test(k);
  if (!isView) return null;

  if (/^(accounting|analytics|royalties)\b/.test(k)) return true;

  // optional: allow common page-specific views (if you use them)
  // e.g., accounting.statement.view, accounting.categories.view, etc.
  return null;
}

/* ---- Middleware ---- */
function requirePermission(keys, mode = "any") {
  const inputList = Array.isArray(keys) ? keys : [keys];
  const list = inputList.map(canonKey);

  // No keys = nothing to check
  if (!list.length) {
    return (_req, _res, next) => next();
  }

  return async (req, res, next) => {
    try {
      const userId = req.user?.id ?? req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const role = await getRole(userId);
      const dbMap = await getDbPerms(userId, list);

      const checks = list.map((k) => {
        // 1) hard floor (only ever force-allows safe read keys)
        const flo = floorAllow(role, k);
        if (flo === true) return true;

        // 2) DB override if present, else role default
        const db = dbMap.get(k); // boolean | null
        const allow = db === null ? roleDefault(role, k) : db;
        return !!allow;
      });

      const ok = mode === "all" ? checks.every(Boolean) : checks.some(Boolean);
      if (!ok) {
        return res.status(403).json({
          success: false,
          message: "Forbidden",
          missing: inputList, // original keys for clarity
        });
      }

      next();
    } catch (e) {
      console.error("requirePermission error:", e);
      res.status(500).json({ success: false, message: "Permission check failed" });
    }
  };
}

module.exports = requirePermission;
