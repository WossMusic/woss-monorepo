// routes/notifications.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { execute } = require("../config/db");
const {
  getUserNotificationPrefs,
  setUserNotificationPref,
} = require("../utils/notifications");

/* ========================= Helpers ========================= */
function parseLimit(v, def = 5, min = 1, max = 50) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

async function getUnreadCount(userId) {
  const [rows] = await execute(
    "SELECT COUNT(*) AS c FROM user_notifications WHERE user_id = ? AND read_at IS NULL",
    [userId]
  );
  return Number(rows?.[0]?.c || 0);
}

/* ========================= Prefs (existing) ========================= */
router.get("/prefs", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false });
    const prefs = await getUserNotificationPrefs?.(userId);
    res.json({ success: true, prefs });
  } catch (e) {
    console.error("GET /notifications/prefs error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/prefs", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { key, enabled } = req.body || {};
    const allowed = new Set(["invites", "split_updates"]);
    if (!userId) return res.status(401).json({ success: false });
    if (!allowed.has(String(key))) {
      return res.status(400).json({ success: false, message: "Invalid key" });
    }
    await setUserNotificationPref?.(userId, key, !!enabled);
    res.json({ success: true });
  } catch (e) {
    console.error("PATCH /notifications/prefs error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ========================= List / Unread ========================= */
/**
 * GET /api/notifications/unread?limit=5
 * Returns latest unread notifications for the current user.
 */
router.get("/unread", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false });

    const limit = parseLimit(req.query.limit);
    const [rows] = await execute(
      `SELECT id,
              title,
              body AS message,
              created_at
         FROM user_notifications
        WHERE user_id = ? AND read_at IS NULL
        ORDER BY created_at DESC
        LIMIT ?`,
      [userId, limit]
    );

    const unread_count = await getUnreadCount(userId);
    res.json({
      success: true,
      notifications: rows || [],
      unread_count,
    });
  } catch (e) {
    console.error("GET /notifications/unread error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /api/notifications?limit=5&unread=1
 * Generic listing; if unread=1 filters unread, else returns latest (read or unread).
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false });

    const limit = parseLimit(req.query.limit);
    const unreadOnly = String(req.query.unread || "") === "1";

    let sql = `SELECT id,
                      title,
                      body AS message,
                      created_at,
                      read_at
                 FROM user_notifications
                WHERE user_id = ?`;
    const params = [userId];

    if (unreadOnly) {
      sql += " AND read_at IS NULL";
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const [rows] = await execute(sql, params);
    const unread_count = await getUnreadCount(userId);

    res.json({
      success: true,
      notifications: rows || [],
      unread_count,
    });
  } catch (e) {
    console.error("GET /notifications error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ========================= Mark all read ========================= */
/**
 * POST /api/notifications/mark-all-read
 * (Legacy alias also provided: /markAsReadAll)
 */
async function markAllReadHandler(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false });

    const [result] = await execute(
      "UPDATE user_notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL",
      [userId]
    );

    const updated =
      typeof result?.affectedRows === "number" ? result.affectedRows : 0;

    res.json({ success: true, updated });
  } catch (e) {
    console.error("POST /notifications/mark-all-read error", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

router.post("/mark-all-read", verifyToken, markAllReadHandler);
router.post("/markAsReadAll", verifyToken, markAllReadHandler); // legacy alias

module.exports = router;
