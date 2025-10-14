// utils/rbac.js
const { execute } = require("../config/db");

// ---- Role helpers ----
async function getRole(userId) {
  const [[u]] = await execute("SELECT role FROM users WHERE id = ?", [userId]);
  const role = String(u?.role || "");
  console.log("[rbac:getRole]", { userId, role });
  return role;
}

async function isAdminUser(userId) {
  const role = await getRole(userId);
  const ok = /^(admin|super admin)$/i.test(String(role || "").trim());
  console.log("[rbac:isAdminUser]", { userId, role, ok });
  return ok;
}

// ---- Permission override (auto-detect schema: new or legacy) ----
let PERM_SCHEMA = null; // { keyCol: string, valCol: string } | null

async function detectPermSchema() {
  if (PERM_SCHEMA !== null) return PERM_SCHEMA;
  try {
    const [cols] = await execute("SHOW COLUMNS FROM user_permissions");
    const names = new Set((cols || []).map((c) => String(c.Field)));
    const candidates = [
      { keyCol: "perm_key",       valCol: "perm_value" }, // new
      { keyCol: "permission_key", valCol: "allowed" },    // legacy
      { keyCol: "`key`",          valCol: "`value`" },    // super-legacy
      { keyCol: "permission",     valCol: "allowed" },
    ];
    for (const c of candidates) {
      const rawKey = c.keyCol.replace(/`/g, "");
      const rawVal = c.valCol.replace(/`/g, "");
      if (names.has(rawKey) && names.has(rawVal)) {
        PERM_SCHEMA = c;
        console.log("[rbac:detectPermSchema] detected", PERM_SCHEMA);
        return PERM_SCHEMA;
      }
    }
    PERM_SCHEMA = null;
    console.warn("[rbac:detectPermSchema] user_permissions table present but no known columns");
    return PERM_SCHEMA;
  } catch (e) {
    PERM_SCHEMA = null;
    console.warn("[rbac:detectPermSchema] table missing or error:", e?.message || e);
    return PERM_SCHEMA;
  }
}

/**
 * Return explicit DB override for a permission key:
 *  - true | false if row exists
 *  - null if no row / table missing
 */
async function getPermOverride(userId, permKey) {
  const schema = await detectPermSchema();
  if (!schema) {
    console.log("[rbac:getPermOverride]", { userId, permKey, result: null, reason: "no schema" });
    return null;
  }

  const sql = `
    SELECT ${schema.valCol} AS v
      FROM user_permissions
     WHERE user_id = ? AND ${schema.keyCol} = ?
     LIMIT 1
  `;
  try {
    const [[row]] = await execute(sql, [userId, permKey]);
    if (!row) {
      console.log("[rbac:getPermOverride]", { userId, permKey, result: null, reason: "no row" });
      return null;
    }
    const vRaw = row.v;
    const v =
      vRaw === null || vRaw === undefined
        ? null
        : typeof vRaw === "boolean"
        ? vRaw
        : !!Number(vRaw);
    console.log("[rbac:getPermOverride]", { userId, permKey, vRaw, result: v });
    return v;
  } catch (e) {
    console.warn("[rbac:getPermOverride] error:", { userId, permKey, err: e?.message || e });
    return null;
  }
}

module.exports = {
  getRole,
  isAdminUser,
  getPermOverride,
};
