// utils/notifications.js
const { execute } = require("../config/db");

/**
 * Known notification channels (default = ON if unset)
 * - "invites"             : split invites (email the invitee)
 * - "split_updates"       : split response status to inviter (Accepted/Rejected)
 * - "royalties"           : statements / imports
 * - "withdrawals"         : payment advice / PDFs
 * - "releases"            : release lifecycle emails
 * - "security"            : login, password, MFA, etc.
 * - "system"              : maintenance / broadcast
 */
const CHANNELS = new Set([
  "royalties",
  "withdrawals",
  "releases",
  "invites",
  "split_updates", // ⬅️ inviter gets Accept/Reject update
  "security",
  "system",
]);

/**
 * Optional: export a list the UI can iterate to render switches
 * id = permission suffix (notifications.<id>), label = human name
 */
const NOTIFICATION_CHANNELS = [
  { id: "invites",       label: "Split Invites" },
  { id: "split_updates", label: "Split Updates (Accept/Reject)" },
  { id: "royalties",     label: "Royalties" },
  { id: "withdrawals",   label: "Withdrawals / Payments" },
  { id: "releases",      label: "Releases" },
  { id: "security",      label: "Security" },
  { id: "system",        label: "System" },
];

/** Normalize aliases we might receive in code paths */
function canonChannel(ch) {
  const s = String(ch || "").trim().toLowerCase();
  // Accept a few synonyms and map them to our canonical keys
  if (s === "split.update" || s === "split-update" || s === "splitupdates") return "split_updates";
  if (s === "split.invite" || s === "split-invite" || s === "split_invite") return "invites";
  return s;
}

/**
 * Batch-fetch permissions for a user.
 * Returns a map { key: boolean|null } where null = no row (unset).
 *
 * Supports both schemas:
 *   NEW: user_permissions(user_id, perm_key, perm_value)
 *   OLD: user_permissions(user_id, permission_key, allowed)
 *
 * Expected keys we may read:
 *   - notifications.all
 *   - notifications.<channel>
 *   - (legacy) release.suppress_notifications
 */
async function fetchPerms(userId, keys) {
  if (!userId || !Array.isArray(keys) || keys.length === 0) return {};
  const placeholders = keys.map(() => "?").join(",");
  const params = [userId, ...keys];

  // Try NEW columns first (perm_key/perm_value). If that fails, fall back to OLD.
  let rows;
  try {
    [rows] = await execute(
      `
      SELECT perm_key AS k, perm_value AS a
      FROM user_permissions
      WHERE user_id = ? AND perm_key IN (${placeholders})
      `,
      params
    );
  } catch (err) {
    // Fallback for legacy column names
    [rows] = await execute(
      `
      SELECT permission_key AS k, allowed AS a
      FROM user_permissions
      WHERE user_id = ? AND permission_key IN (${placeholders})
      `,
      params
    );
  }

  const map = {};
  for (const r of rows || []) {
    const k = String(r.k || "").trim();
    // null/undefined → null (unset), numbers → boolean
    map[k] = r.a === null || r.a === undefined ? null : !!Number(r.a);
  }
  return map;
}

/**
 * shouldNotify(userId, channel)
 *
 * Logic:
 *  - If notifications.all === false → block everything.
 *  - Else if notifications.<channel> === false → block that channel.
 *  - Else default allow (true).
 *  - Back-compat: if notifications.all is unset (null) and legacy release.suppress_notifications === true → block.
 *  - Unknown channel → allow (fail-open so we don't accidentally silence).
 */
async function shouldNotify(userId, channel) {
  try {
    const ch = canonChannel(channel);
    if (!CHANNELS.has(ch)) return true; // unknown → allow

    const keys = [
      "notifications.all",
      `notifications.${ch}`,
      "release.suppress_notifications", // legacy
    ];

    const perms = await fetchPerms(userId, keys);

    const all = Object.prototype.hasOwnProperty.call(perms, "notifications.all")
      ? perms["notifications.all"]
      : null;
    if (all === false) return false;

    const chKey = `notifications.${ch}`;
    const chPerm = Object.prototype.hasOwnProperty.call(perms, chKey) ? perms[chKey] : null;
    if (chPerm === false) return false;

    // Legacy back-compat only if master is unset
    if (all === null) {
      const legacy = Object.prototype.hasOwnProperty.call(perms, "release.suppress_notifications")
        ? perms["release.suppress_notifications"]
        : null;
      if (legacy === true) return false;
    }

    return true; // default allow
  } catch (e) {
    console.warn("[notifications] shouldNotify error:", e.message);
    return true; // fail-open
  }
}

/* Convenience wrappers used by routes */
async function isRoyaltiesEmailEnabled(userId)    { return shouldNotify(userId, "royalties"); }
async function isWithdrawalsEmailEnabled(userId)  { return shouldNotify(userId, "withdrawals"); }
async function isInvitesEmailEnabled(userId)      { return shouldNotify(userId, "invites"); }
async function isSplitUpdatesEmailEnabled(userId) { return shouldNotify(userId, "split_updates"); }

module.exports = {
  shouldNotify,
  isRoyaltiesEmailEnabled,
  isWithdrawalsEmailEnabled,
  isInvitesEmailEnabled,
  isSplitUpdatesEmailEnabled,
  NOTIFICATION_CHANNELS, // for SectionPerms UI
};
